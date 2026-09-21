<?php
/**
 * Adopte un Job — les CV : ce que le navigateur a lu (JSON), ce que
 * l'utilisateur a garde, le fichier d'origine (chiffre), le CV genere, et
 * l'export JSON Resume.
 *
 * La lecture du PDF reste dans l'appareil. Ce qui monte : le resultat de la
 * lecture (pour retraiter sans redemander le fichier), le choix de
 * l'utilisateur apres relecture (la seule mesure de qualite du moteur), et,
 * depuis le 21/09, le fichier lui-meme — chiffre au repos, remis au recruteur
 * seulement apres preselection.
 */

declare(strict_types=1);

require_once __DIR__ . '/documents.php';

const CV_OCTETS_MAX = 10 * 1024 * 1024;
const CV_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function cvPublic(array $r, ?array $x = null): array
{
    return [
        'id' => (int) $r['id'], 'nom' => $r['filename'], 'mime' => $r['mime'], 'octets' => (int) $r['bytes'],
        'actif' => (bool) $r['is_active'], 'depose' => $r['created_at'],
        'fichier' => $r['storage_key'] !== '',
        'lecture' => $x ? [
            'moteur' => $x['engine'], 'version' => $x['version'],
            'lu' => json_decode((string) $x['payload'], true),
            'retenu' => $x['accepted'] === null ? null : json_decode((string) $x['accepted'], true),
            'quand' => $x['created_at'],
        ] : null,
    ];
}

function derniereLecture(PDO $pdo, int $resumeId): ?array
{
    $st = $pdo->prepare('SELECT * FROM resume_extractions WHERE resume_id = ? ORDER BY id DESC LIMIT 1');
    $st->execute([$resumeId]);
    return $st->fetch() ?: null;
}

/** Le CV actif du candidat (ligne de resumes), s'il y en a un. Defini ici,
    car cv.php est charge avant candidatures.php qui s'en sert aussi. */
function cvActif(PDO $pdo, int $userId): ?array
{
    $st = $pdo->prepare('SELECT * FROM resumes WHERE user_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1');
    $st->execute([$userId]);
    return $st->fetch() ?: null;
}

function cvDuCandidat(PDO $pdo, int $userId, int $id): array
{
    $st = $pdo->prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?');
    $st->execute([$id, $userId]);
    $r = $st->fetch();
    if (!$r) {
        erreur('introuvable', 'Ce CV n’existe pas.', 404);
    }
    return $r;
}

/* ----------------------------------------------------------------- routes */

/* Le premier de tous : le dernier resume JSON lu. */
if (route('GET', 'profil/cv', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $st = $pdo->prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY is_active DESC, id DESC LIMIT 20');
    $st->execute([(int) $u['id']]);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $out[] = cvPublic($r, derniereLecture($pdo, (int) $r['id']));
    }
    envoie(['cv' => $out, 'actif' => $out[0] ?? null]);
}

if (($a = route('GET', 'profil/cv/*', $seg, $methode)) !== false && ctype_digit($a[0])) {
    $u = exigeConnexion('candidat');
    $r = cvDuCandidat($pdo, (int) $u['id'], (int) $a[0]);
    envoie(['cv' => cvPublic($r, derniereLecture($pdo, (int) $r['id']))]);
}

/* Ce que l'utilisateur a garde apres relecture. Sans cette route, on savait ce
   que le moteur lisait, jamais ce qui etait juste. */
if (($a = route('PUT', 'profil/cv/*', $seg, $methode)) !== false && ctype_digit($a[0])) {
    $u = exigeConnexion('candidat');
    $r = cvDuCandidat($pdo, (int) $u['id'], (int) $a[0]);
    $x = derniereLecture($pdo, (int) $r['id']);
    if (!$x) {
        erreur('introuvable', 'Aucune lecture enregistrée pour ce CV.', 404);
    }
    $pdo->prepare('UPDATE resume_extractions SET accepted = ? WHERE id = ?')
        ->execute([json_encode(champ('retenu', []), JSON_UNESCAPED_UNICODE), (int) $x['id']]);
    if (champ('actif') === true) {
        $pdo->prepare('UPDATE resumes SET is_active = 0 WHERE user_id = ?')->execute([(int) $u['id']]);
        $pdo->prepare('UPDATE resumes SET is_active = 1 WHERE id = ?')->execute([(int) $r['id']]);
    }
    trace((int) $u['id'], 'relecture_cv', 'resume', (int) $r['id']);
    envoie(['cv' => cvPublic(cvDuCandidat($pdo, (int) $u['id'], (int) $r['id']), derniereLecture($pdo, (int) $r['id']))]);
}

/* Le fichier d'origine, en multipart (champ « fichier »). Chiffre avant
   d'etre ecrit, hors docroot. Rattache au CV actif, ou en cree un. */
if (route('POST', 'profil/cv/fichier', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];
    limite('cvfichier:' . $id, 10, 3600);
    $f = $_FILES['fichier'] ?? null;
    if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        erreur('fichier_manquant', 'Aucun fichier reçu (champ « fichier », multipart/form-data).', 422);
    }
    if ((int) $f['size'] > CV_OCTETS_MAX) {
        erreur('fichier_trop_grand', 'Le fichier dépasse 10 Mo.', 413);
    }
    $contenu = (string) file_get_contents((string) $f['tmp_name']);
    // le type se lit dans les octets, pas dans ce que le client declare
    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($contenu) ?: 'application/octet-stream';
    if (!in_array($mime, CV_MIMES, true)) {
        erreur('format_refuse', 'Formats acceptés : PDF, JPEG, PNG, WebP.', 415);
    }
    [$cle, $iv, $tag] = rangeFichier($contenu);
    $nom = mb_substr(basename((string) $f['name']), 0, 190) ?: 'cv';
    $sha = hash('sha256', $contenu);

    $cvId = (int) champ('cv', 0) ?: (int) ($_POST['cv'] ?? 0);
    $actif = $cvId ? cvDuCandidat($pdo, $id, $cvId) : cvActif($pdo, $id);
    if ($actif) {
        supprimeFichier($actif['storage_key']);
        $pdo->prepare('UPDATE resumes SET filename = ?, mime = ?, bytes = ?, storage_key = ?, sha256 = ?, enc_iv = ?, enc_tag = ?, is_active = 1 WHERE id = ?')
            ->execute([$nom, $mime, strlen($contenu), $cle, $sha, $iv, $tag, (int) $actif['id']]);
        $rid = (int) $actif['id'];
    } else {
        $pdo->prepare('INSERT INTO resumes (user_id, filename, mime, bytes, storage_key, sha256, enc_iv, enc_tag, is_active, created_at) VALUES (?,?,?,?,?,?,?,?,1,?)')
            ->execute([$id, $nom, $mime, strlen($contenu), $cle, $sha, $iv, $tag, maintenant()]);
        $rid = (int) $pdo->lastInsertId();
    }
    $pdo->prepare('UPDATE resumes SET is_active = 0 WHERE user_id = ? AND id <> ?')->execute([$id, $rid]);
    // les candidatures en cours emportent le nouveau fichier
    $pdo->prepare('UPDATE applications SET resume_id = ? WHERE candidate_id = ? AND statut NOT IN ("refusee","retiree")')->execute([$rid, $id]);
    trace($id, 'depot_fichier_cv', 'resume', $rid);
    envoie(['cv' => cvPublic(cvDuCandidat($pdo, $id, $rid), derniereLecture($pdo, $rid))], 201);
}

if (($a = route('GET', 'profil/cv/*/fichier', $seg, $methode)) !== false) {
    $u = exigeConnexion('candidat');
    $r = cvDuCandidat($pdo, (int) $u['id'], (int) $a[0]);
    if ($r['storage_key'] === '') {
        erreur('introuvable', 'Ce CV n’a pas de fichier : seule la lecture a été enregistrée.', 404);
    }
    $clair = litFichier($r['storage_key'], (string) $r['enc_iv'], (string) $r['enc_tag']);
    if ($clair === null) {
        erreur('introuvable', 'Le fichier n’est plus disponible.', 404);
    }
    header('Content-Type: ' . $r['mime']);
    header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $r['filename']) . '"');
    header('Cache-Control: no-store');
    entetesSecurite();
    echo $clair;
    exit;
}

if (($a = route('DELETE', 'profil/cv/*', $seg, $methode)) !== false && ctype_digit($a[0])) {
    $u = exigeConnexion('candidat');
    $r = cvDuCandidat($pdo, (int) $u['id'], (int) $a[0]);
    supprimeFichier($r['storage_key']);
    $pdo->prepare('UPDATE applications SET resume_id = NULL WHERE resume_id = ?')->execute([(int) $r['id']]);
    $pdo->prepare('DELETE FROM resumes WHERE id = ?')->execute([(int) $r['id']]);
    trace((int) $u['id'], 'suppression_cv', 'resume', (int) $r['id']);
    envoie(['ok' => true]);
}

/* Le CV genere depuis le profil, sans poste cible. */
if (route('GET', 'profil/cv.pdf', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $p = profilComplet($pdo, (int) $u['id']);
    $bin = cvPdf($p, null, null, true, $u['email']);
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="cv.pdf"');
    header('Cache-Control: no-store');
    entetesSecurite();
    echo $bin;
    exit;
}

/* JSON Resume (jsonresume.org) : le schema norme cite par le HackAVP, pour
   emporter son profil ailleurs. Pas d'annee de diplome, par choix. */
if (route('GET', 'profil/jsonresume', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $p = profilComplet($pdo, (int) $u['id']);
    $niv = ['Bac', 'Bac+2', 'Bac+3', 'Bac+5'];
    envoie([
        '$schema' => 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
        'basics' => [
            'name' => trim($p['prenom'] . ' ' . $p['nom']),
            'email' => $u['email'],
            'phone' => $p['telephone'] ?: null,
            'summary' => $p['metiersOpt'] ? 'Métiers visés : ' . implode(', ', array_column($p['metiersOpt'], 'nom')) : null,
            'location' => ['region' => implode(', ', $p['zones']), 'countryCode' => 'NC'],
        ],
        'work' => array_map(static fn ($x) => ['position' => $x['poste'], 'name' => $x['secteur'], 'startDate' => $x['debut'] ?: null, 'endDate' => $x['fin'] ?: null], $p['experiences']),
        'education' => array_map(static fn ($f) => ['studyType' => $niv[max(0, min(3, (int) $f['niveau'] - 1))], 'area' => $f['domaine']], $p['formations']),
        'skills' => array_merge(
            array_map(static fn ($s) => ['name' => $s], $p['competences']),
            array_map(static fn ($s) => ['name' => $s['nom'], 'keywords' => ['OPT-NC:' . $s['code']]], $p['competencesOpt'])
        ),
        'languages' => array_map(static fn ($l) => ['language' => $l['langue'], 'fluency' => $l['niveau']], $p['langues']),
        'meta' => ['generator' => 'Adopte un Job', 'version' => 'v1.0.0', 'lastModified' => maintenant()],
    ]);
}

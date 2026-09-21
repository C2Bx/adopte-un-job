<?php
/**
 * Adopte un Job — candidatures, dossier, match.
 *
 * Le « oui » d'un candidat sur une offre EST une candidature. L'organisation
 * la voit anonyme, classee par score, et la traite : preselection (= match :
 * le contact s'ouvre et le dossier — CV genere + CV d'origine — est remis),
 * entretien, acceptee, refusee. Le candidat peut la retirer. Chaque
 * changement est un evenement journalise, et une notification (plus un
 * e-mail mis en file, jamais envoye pour l'instant).
 */

declare(strict_types=1);

require_once __DIR__ . '/documents.php';
require_once __DIR__ . '/organisation.php';

const STATUTS_CANDIDATURE = ['envoyee', 'vue', 'preselection', 'entretien', 'acceptee', 'refusee', 'retiree'];
/** A partir de la, le contact et le dossier sont ouverts a l'organisation. */
const STATUTS_OUVERTS = ['preselection', 'entretien', 'acceptee'];

function candidatureParId(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare(
        'SELECT a.*, j.company_id, j.titre, j.statut AS offre_statut FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?'
    );
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

/** Le candidat, ou un membre de l'organisation de l'offre. Sinon 403. Rend [candidature, cote]. */
function accesCandidature(PDO $pdo, array $u, int $id): array
{
    $a = candidatureParId($pdo, $id);
    if (!$a) {
        erreur('introuvable', 'Cette candidature n’existe pas.', 404);
    }
    if ((int) $a['candidate_id'] === (int) $u['id']) {
        return [$a, 'candidat'];
    }
    $st = $pdo->prepare('SELECT role FROM company_members WHERE company_id = ? AND user_id = ?');
    $st->execute([(int) $a['company_id'], (int) $u['id']]);
    if ($st->fetch() || $u['role'] === 'admin') {
        return [$a, 'organisation'];
    }
    erreur('interdit', 'Cette candidature ne te concerne pas.', 403);
}

function evenement(PDO $pdo, int $appId, ?int $acteur, string $type, array $payload = []): void
{
    $pdo->prepare('INSERT INTO application_events (application_id, acteur_id, type, payload, created_at) VALUES (?,?,?,?,?)')
        ->execute([$appId, $acteur, $type, json_encode($payload, JSON_UNESCAPED_UNICODE), maintenant()]);
}

/**
 * Cree (ou reactive) la candidature d'un candidat sur une offre. Rend la
 * ligne. Appele par POST candidatures et par le swipe « oui ».
 */
function candidate(PDO $pdo, int $candId, array $o, string $message = ''): array
{
    if ($o['statut'] !== 'publiee' || ($o['expires_at'] !== null && $o['expires_at'] <= maintenant())) {
        erreur('offre_close', 'Cette offre est close : on peut s’entraîner dessus, pas y candidater.', 409);
    }
    $st = $pdo->prepare('SELECT * FROM applications WHERE job_id = ? AND candidate_id = ?');
    $st->execute([(int) $o['id'], $candId]);
    $exist = $st->fetch();
    $cv = cvActif($pdo, $candId);
    $c = candidatPourScore($pdo, $candId);
    $e = $c ? evalue($pdo, $c, garnisOffre($pdo, $o)) : null;
    if ($e) {
        memoriseScore($pdo, (int) $o['id'], $candId, $e);
    }
    if ($exist && $exist['statut'] !== 'retiree') {
        return $exist;
    }
    // Photographie du score au moment du geste : le tableau de bord la lit,
    // meme apres que le cache des scores a ete efface.
    $detail = $e ? json_encode($e['detail'], JSON_UNESCAPED_UNICODE) : null;
    if ($exist) {
        $pdo->prepare('UPDATE applications SET statut = "envoyee", message = ?, resume_id = ?, qualite = ?, detail = ?, updated_at = ?, decided_at = NULL, decided_by = NULL WHERE id = ?')
            ->execute([mb_substr($message, 0, 2000) ?: null, $cv['id'] ?? null, $e['qualite'] ?? null, $detail, maintenant(), (int) $exist['id']]);
        $appId = (int) $exist['id'];
    } else {
        $pdo->prepare(
            'INSERT INTO applications (job_id, candidate_id, statut, resume_id, message, qualite, detail, created_at, updated_at)
             VALUES (?,?,"envoyee",?,?,?,?,?,?)'
        )->execute([(int) $o['id'], $candId, $cv['id'] ?? null, mb_substr($message, 0, 2000) ?: null, $e['qualite'] ?? null, $detail, maintenant(), maintenant()]);
        $appId = (int) $pdo->lastInsertId();
    }
    // le swipe suit : le deck ne doit plus proposer cette offre
    $pdo->prepare(
        'INSERT INTO swipes (sens, job_id, candidate_id, acteur_id, decision, created_at) VALUES ("candidat",?,?,?,"oui",?)
         ON DUPLICATE KEY UPDATE decision = "oui", created_at = VALUES(created_at)'
    )->execute([(int) $o['id'], $candId, $candId, maintenant()]);
    evenement($pdo, $appId, $candId, 'envoyee', ['qualite' => $e['qualite'] ?? null]);
    trace($candId, 'candidature', 'job', (int) $o['id']);
    foreach (membresIds($pdo, (int) $o['company_id']) as $m) {
        notifie($m, 'candidature', ['candidature' => $appId, 'offre' => (int) $o['id'], 'titre' => $o['titre']]);
    }
    return candidatureParId($pdo, $appId);
}

/** La candidature telle qu'on la rend, selon le cote qui regarde. */
function candidaturePublique(PDO $pdo, array $a, string $cote): array
{
    $o = offrePublique(garnisOffre($pdo, offreParId($pdo, (int) $a['job_id'])));
    $ouvert = in_array($a['statut'], STATUTS_OUVERTS, true);
    $st = $pdo->prepare('SELECT id, debut_utc, duree_min, mode, lieu, statut FROM entretiens WHERE application_id = ? ORDER BY debut_utc');
    $st->execute([(int) $a['id']]);
    $out = [
        'id' => (int) $a['id'], 'statut' => $a['statut'], 'message' => $a['message'],
        'qualite' => $a['qualite'] === null ? null : (int) $a['qualite'],
        'creee' => $a['created_at'], 'maj' => $a['updated_at'], 'decidee' => $a['decided_at'],
        'match' => $a['match_id'] === null ? null : (int) $a['match_id'],
        'offre' => $o,
        'entretiens' => $st->fetchAll(),
        'dossier' => [
            'cvGenere' => true,
            'cvOriginal' => (bool) ($a['resume_id'] ?? null) && cvAFichier($pdo, (int) $a['resume_id']),
            'ouvertPourOrganisation' => $ouvert,
        ],
    ];
    if ($cote === 'organisation') {
        $out['candidat'] = candidatVuParEntreprise($pdo, (int) $a['candidate_id'], $ouvert);
        $st = $pdo->prepare('SELECT detail FROM match_scores WHERE job_id = ? AND candidate_id = ?');
        $st->execute([(int) $a['job_id'], (int) $a['candidate_id']]);
        $d = $st->fetchColumn();
        $out['score'] = $d ? ['qualite' => $out['qualite'], 'detail' => json_decode((string) $d, true)] : null;
    }
    return $out;
}

function cvAFichier(PDO $pdo, int $resumeId): bool
{
    $st = $pdo->prepare('SELECT storage_key FROM resumes WHERE id = ?');
    $st->execute([$resumeId]);
    $k = $st->fetchColumn();
    return is_string($k) && $k !== '';
}

/** Ouvre le match pour une candidature (preselection) : contact + dossier + fil de messages. */
function ouvreMatch(PDO $pdo, array $a, int $acteur): int
{
    $st = $pdo->prepare('SELECT qualite FROM match_scores WHERE job_id = ? AND candidate_id = ?');
    $st->execute([(int) $a['job_id'], (int) $a['candidate_id']]);
    $q = (int) ($st->fetchColumn() ?: ($a['qualite'] ?? 0));
    $pdo->prepare('INSERT IGNORE INTO matches (job_id, candidate_id, qualite, created_at) VALUES (?,?,?,?)')
        ->execute([(int) $a['job_id'], (int) $a['candidate_id'], $q, maintenant()]);
    $m = matchExiste($pdo, (int) $a['job_id'], (int) $a['candidate_id']);
    $pdo->prepare(
        'INSERT INTO swipes (sens, job_id, candidate_id, acteur_id, decision, created_at) VALUES ("recruteur",?,?,?,"oui",?)
         ON DUPLICATE KEY UPDATE decision = "oui"'
    )->execute([(int) $a['job_id'], (int) $a['candidate_id'], $acteur, maintenant()]);
    $pdo->prepare('UPDATE applications SET match_id = ? WHERE id = ?')->execute([(int) $m['id'], (int) $a['id']]);
    notifie((int) $a['candidate_id'], 'match', ['offre' => (int) $a['job_id'], 'titre' => $a['titre'], 'candidature' => (int) $a['id']]);
    // l'e-mail au recruteur avec le dossier : en file, pas envoye
    $st = $pdo->prepare('SELECT u.email FROM company_members m JOIN users u ON u.id = m.user_id WHERE m.company_id = ?');
    $st->execute([(int) $a['company_id']]);
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $dest) {
        enfileMail($acteur, (string) $dest, 'Dossier de candidature — ' . $a['titre'],
            "Une candidature a été présélectionnée pour « {$a['titre']} ». Le CV généré et le CV d’origine sont joints ; le contact du candidat est ouvert dans l’application.",
            'candidature', (int) $a['id']);
    }
    $st = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $st->execute([(int) $a['candidate_id']]);
    enfileMail((int) $a['candidate_id'], (string) $st->fetchColumn(), 'Votre candidature a été retenue — ' . $a['titre'],
        "Bonne nouvelle : votre candidature au poste « {$a['titre']} » est présélectionnée. Le recruteur peut maintenant vous écrire et vous proposer un entretien.");
    trace($acteur, 'match', 'job', (int) $a['job_id']);
    return (int) $m['id'];
}

/* ----------------------------------------------------------------- routes */

if (route('POST', 'candidatures', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];
    limite('candidature:' . $id, 40, 3600);
    $manques = manquesProfil($pdo, $id);
    if ($manques) {
        envoie(['erreur' => 'profil_incomplet', 'message' => 'Complète ton profil avant de candidater.', 'manques' => $manques], 409);
    }
    $o = offreParId($pdo, (int) champ('offre', 0));
    if (!$o) {
        erreur('introuvable', 'Cette offre n’existe pas.', 404);
    }
    $a = candidate($pdo, $id, $o, (string) champ('message', ''));
    envoie(['candidature' => candidaturePublique($pdo, $a, 'candidat')], 201);
}

if (route('GET', 'candidatures', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $statut = in_array($_GET['statut'] ?? '', STATUTS_CANDIDATURE, true) ? $_GET['statut'] : '';
    $offre = (int) ($_GET['offre'] ?? 0);
    if ($u['role'] === 'candidat') {
        $st = $pdo->prepare('SELECT a.*, j.company_id, j.titre FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.candidate_id = ?'
            . ($statut ? ' AND a.statut = ?' : '') . ' ORDER BY a.updated_at DESC');
        $st->execute($statut ? [(int) $u['id'], $statut] : [(int) $u['id']]);
        $cote = 'candidat';
    } else {
        $org = organisationDe($pdo, $u);
        $sql = 'SELECT a.*, j.company_id, j.titre FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ?';
        $p = [(int) $org['id']];
        if ($statut) {
            $sql .= ' AND a.statut = ?';
            $p[] = $statut;
        }
        if ($offre) {
            $sql .= ' AND a.job_id = ?';
            $p[] = $offre;
        }
        $st = $pdo->prepare($sql . ' ORDER BY a.updated_at DESC LIMIT 300');
        $st->execute($p);
        $cote = 'organisation';
    }
    envoie(['candidatures' => array_map(static fn ($a) => candidaturePublique($pdo, $a, $cote), $st->fetchAll())]);
}

if (($a = route('GET', 'candidatures/*', $seg, $methode)) !== false && ctype_digit($a[0])) {
    $u = exigeConnexion();
    [$cand, $cote] = accesCandidature($pdo, $u, (int) $a[0]);
    if ($cote === 'organisation' && $cand['statut'] === 'envoyee') {
        // ouvrir la candidature, c'est l'avoir vue : le candidat le saura
        $pdo->prepare('UPDATE applications SET statut = "vue", vue_at = ?, updated_at = ? WHERE id = ?')->execute([maintenant(), maintenant(), (int) $cand['id']]);
        evenement($pdo, (int) $cand['id'], (int) $u['id'], 'vue');
        $cand = candidatureParId($pdo, (int) $cand['id']);
    }
    $out = ['candidature' => candidaturePublique($pdo, $cand, $cote)];
    $st = $pdo->prepare('SELECT type, payload, created_at, acteur_id FROM application_events WHERE application_id = ? ORDER BY id');
    $st->execute([(int) $cand['id']]);
    $out['evenements'] = array_map(static fn ($e) => ['type' => $e['type'], 'quand' => $e['created_at'], 'moi' => (int) $e['acteur_id'] === (int) $u['id'], 'donnees' => json_decode((string) $e['payload'], true)], $st->fetchAll());
    if ($cote === 'organisation') {
        trace((int) $u['id'], 'lecture_candidature', 'application', (int) $cand['id']);
    }
    envoie($out);
}

/* Changer le statut. L'organisation avance ou refuse ; le candidat retire. */
if (($a = route('PUT', 'candidatures/*/statut', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    [$cand, $cote] = accesCandidature($pdo, $u, (int) $a[0]);
    $s = (string) champ('statut', '');
    $permis = $cote === 'candidat' ? ['retiree'] : ['vue', 'preselection', 'entretien', 'acceptee', 'refusee'];
    if (!in_array($s, $permis, true)) {
        erreur('statut_invalide', 'Statut attendu : ' . implode(', ', $permis) . '.', 422);
    }
    if ($cote === 'organisation') {
        $org = organisationDe($pdo, $u);
        if ($org['membre_role'] === 'lecteur') {
            erreur('role_insuffisant', 'Un lecteur ne décide pas.', 403);
        }
    }
    if (in_array($cand['statut'], ['retiree'], true) && $cote === 'organisation') {
        erreur('candidature_retiree', 'Le candidat a retiré sa candidature.', 409);
    }
    $matchId = $cand['match_id'];
    if (in_array($s, STATUTS_OUVERTS, true) && !$matchId) {
        $matchId = ouvreMatch($pdo, $cand, (int) $u['id']);
    }
    $decide = in_array($s, ['preselection', 'entretien', 'acceptee', 'refusee'], true);
    $pdo->prepare('UPDATE applications SET statut = ?, updated_at = ?, decided_at = IF(?, ?, decided_at), decided_by = IF(?, ?, decided_by), match_id = ? WHERE id = ?')
        ->execute([$s, maintenant(), $decide ? 1 : 0, maintenant(), $decide ? 1 : 0, (int) $u['id'], $matchId, (int) $cand['id']]);
    evenement($pdo, (int) $cand['id'], (int) $u['id'], $s, ['motif' => mb_substr((string) champ('motif', ''), 0, 500) ?: null]);
    if ($cote === 'organisation') {
        notifie((int) $cand['candidate_id'], 'candidature_' . $s, ['candidature' => (int) $cand['id'], 'titre' => $cand['titre']]);
        if ($s === 'refusee') {
            $st = $pdo->prepare('SELECT email FROM users WHERE id = ?');
            $st->execute([(int) $cand['candidate_id']]);
            enfileMail((int) $cand['candidate_id'], (string) $st->fetchColumn(), 'Réponse à votre candidature — ' . $cand['titre'],
                "Votre candidature au poste « {$cand['titre']} » n’a pas été retenue. Votre profil reste visible pour les autres postes.");
        }
    } else {
        foreach (membresIds($pdo, (int) $cand['company_id']) as $m) {
            notifie($m, 'candidature_retiree', ['candidature' => (int) $cand['id'], 'titre' => $cand['titre']]);
        }
    }
    trace((int) $u['id'], 'statut_candidature_' . $s, 'application', (int) $cand['id']);
    envoie(['candidature' => candidaturePublique($pdo, candidatureParId($pdo, (int) $cand['id']), $cote)]);
}

/* Le CV genere, recentre sur le poste. Le candidat l'a toujours ; l'organisation
   seulement quand la candidature est ouverte (presélection et au-dela). */
if (($a = route('GET', 'candidatures/*/cv.pdf', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    [$cand, $cote] = accesCandidature($pdo, $u, (int) $a[0]);
    $ouvert = in_array($cand['statut'], STATUTS_OUVERTS, true);
    if ($cote === 'organisation' && !$ouvert) {
        erreur('dossier_ferme', 'Le dossier s’ouvre à la présélection.', 403);
    }
    $p = profilComplet($pdo, (int) $cand['candidate_id']);
    $garni = garnisOffre($pdo, offreParId($pdo, (int) $cand['job_id']));
    $c = candidatPourScore($pdo, (int) $cand['candidate_id']);
    $e = $c ? evalue($pdo, $c, $garni) : null;
    $st = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $st->execute([(int) $cand['candidate_id']]);
    $pdfBin = cvPdf($p, offrePublique($garni), $e, $ouvert || $cote === 'candidat', (string) $st->fetchColumn());
    if ($cote === 'organisation') {
        trace((int) $u['id'], 'telechargement_cv_genere', 'application', (int) $cand['id']);
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="cv-' . (int) $cand['id'] . '.pdf"');
    header('Cache-Control: no-store');
    entetesSecurite();
    echo $pdfBin;
    exit;
}

/* Le CV d'origine, tel que depose (dechiffre a la volee). Memes regles. */
if (($a = route('GET', 'candidatures/*/cv-original', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    [$cand, $cote] = accesCandidature($pdo, $u, (int) $a[0]);
    if ($cote === 'organisation' && !in_array($cand['statut'], STATUTS_OUVERTS, true)) {
        erreur('dossier_ferme', 'Le dossier s’ouvre à la présélection.', 403);
    }
    $r = null;
    if ($cand['resume_id']) {
        $st = $pdo->prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?');
        $st->execute([(int) $cand['resume_id'], (int) $cand['candidate_id']]);
        $r = $st->fetch() ?: null;
    }
    if (!$r || !$r['storage_key']) {
        erreur('introuvable', 'Aucun fichier de CV n’est joint à cette candidature.', 404);
    }
    $clair = litFichier($r['storage_key'], (string) $r['enc_iv'], (string) $r['enc_tag']);
    if ($clair === null) {
        erreur('introuvable', 'Le fichier n’est plus disponible.', 404);
    }
    if ($cote === 'organisation') {
        trace((int) $u['id'], 'telechargement_cv_original', 'resume', (int) $r['id']);
    }
    header('Content-Type: ' . ($r['mime'] ?: 'application/pdf'));
    header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $r['filename']) . '"');
    header('Cache-Control: no-store');
    entetesSecurite();
    echo $clair;
    exit;
}

/* Propositions de premiers messages, pour le cote qui demande. */
if (($a = route('GET', 'candidatures/*/suggestions', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    [$cand, $cote] = accesCandidature($pdo, $u, (int) $a[0]);
    $p = profilComplet($pdo, (int) $cand['candidate_id']);
    $garni = garnisOffre($pdo, offreParId($pdo, (int) $cand['job_id']));
    $c = candidatPourScore($pdo, (int) $cand['candidate_id']);
    $e = $c ? evalue($pdo, $c, $garni) : null;
    envoie(['suggestions' => suggestionsMessages($cote === 'candidat' ? 'candidat' : 'recruteur', $p, offrePublique($garni), $e)]);
}

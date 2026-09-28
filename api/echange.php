<?php
/**
 * Adopte un Job — la passerelle d'echange de fichiers.
 *
 * Pourquoi elle existe : les autres equipes du hackathon consomment du fichier,
 * pas une API. Pourquoi elle n'est PAS un acces direct au stockage : les CV
 * deposes sont chiffres sous un nom aleatoire, et les JSON Resume n'existent
 * pas en fichier — ils sont fabriques a la demande. Il faut donc un veilleur
 * entre les deux, et c'est une bonne nouvelle : un veilleur peut controler.
 *
 * Ce que le protocole ne sait pas faire, le veilleur le fait. FTPS transporte
 * des octets et ne sait pas ce qu'est un JSON : un fichier depose est valide
 * APRES coup, puis applique ou renvoye dans rejets/ avec une phrase qui dit
 * pourquoi.
 *
 * Contenu : nominatif, par decision de l'equipe. Chaque lecture est donc une
 * copie de donnees personnelles, et c'est pour cela que tout est journalise.
 */

declare(strict_types=1);

require_once __DIR__ . '/depot.php';
require_once __DIR__ . '/documents.php';

/** La racine des echanges, a cote du stockage des fichiers, hors docroot. */
function dossierEchange(): string
{
    $d = defined('ECHANGE_DIR') && ECHANGE_DIR !== ''
        ? ECHANGE_DIR
        : dirname(FICHIERS_DIR) . '/avp-echange';
    if (!is_dir($d)) {
        @mkdir($d, 0750, true);
    }
    return $d;
}

function journalEchange(PDO $pdo, string $partenaire, string $sens, string $fichier,
                        string $verdict, ?string $detail = null, ?int $userId = null,
                        ?int $octets = null): void
{
    $pdo->prepare(
        'INSERT INTO echange_journal (partenaire, sens, fichier, verdict, detail, user_id, octets, created_at)
         VALUES (?,?,?,?,?,?,?,?)'
    )->execute([$partenaire, $sens, mb_substr($fichier, 0, 190), $verdict,
                $detail !== null ? mb_substr($detail, 0, 500) : null, $userId, $octets, maintenant()]);
}

/** Ecriture atomique : on ecrit a cote, puis on renomme. Un partenaire qui lit
    pendant qu'on ecrit ne doit jamais tomber sur un fichier a moitie fait. */
function ecritSiChange(string $chemin, string $contenu): bool
{
    if (is_file($chemin) && hash_file('sha256', $chemin) === hash('sha256', $contenu)) {
        return false;
    }
    $tmp = $chemin . '.tmp';
    file_put_contents($tmp, $contenu, LOCK_EX);
    rename($tmp, $chemin);
    return true;
}

function partenaires(PDO $pdo): array
{
    return $pdo->query('SELECT * FROM echange_partenaires WHERE actif = 1 ORDER BY code')->fetchAll();
}

function arboPartenaire(string $code): string
{
    $base = dossierEchange() . '/' . $code;
    foreach (['', '/entrant', '/sortant', '/sortant/profils', '/sortant/cv',
              '/rejets', '/traites'] as $sous) {
        if (!is_dir($base . $sous)) {
            @mkdir($base . $sous, 0750, true);
        }
    }
    return $base;
}

/* ============================================================== le sortant */

/**
 * Ecrit, pour chaque partenaire qui y a droit, un JSON Resume par candidat et
 * — si le droit est accorde — le CV genere en PDF. Plus un index.json qui donne
 * la liste et l'empreinte de chaque fichier : un consommateur peut ainsi savoir
 * ce qui a change sans tout relire.
 */
function exporteSortant(PDO $pdo): array
{
    $liste = $pdo->query(
        "SELECT u.id, u.email FROM users u
           JOIN candidates c ON c.user_id = u.id
          WHERE u.role = 'candidat' AND u.status = 'actif'
            AND c.prenom <> '' ORDER BY u.id"
    )->fetchAll();

    $resumes = [];
    $pdfs = [];
    foreach ($liste as $u) {
        $p = profilComplet($pdo, (int) $u['id']);
        $resumes[(int) $u['id']] = json_encode(
            jsonResume($p, (string) $u['email']),
            JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
        );
        $pdfs[(int) $u['id']] = static fn (): string => cvPdf($p, null, null, true, (string) $u['email']);
    }

    $bilan = [];
    foreach (partenaires($pdo) as $part) {
        $code = (string) $part['code'];
        $base = arboPartenaire($code);
        $ecrits = 0;
        $index = [];

        if ((int) $part['lit_profils'] === 1) {
            foreach ($resumes as $uid => $contenu) {
                $nom = "profil-$uid.json";
                if (ecritSiChange("$base/sortant/profils/$nom", $contenu)) {
                    $ecrits++;
                    journalEchange($pdo, $code, 'sortant', "profils/$nom", 'ecrit', null, $uid, strlen($contenu));
                }
                $index[] = ['fichier' => "profils/$nom", 'candidat' => $uid,
                            'sha256' => hash('sha256', $contenu), 'octets' => strlen($contenu)];
            }
            // Ce qui ne correspond plus a un compte actif s'en va.
            foreach (glob("$base/sortant/profils/profil-*.json") ?: [] as $f) {
                if (preg_match('/profil-(\d+)\.json$/', $f, $m) && !isset($resumes[(int) $m[1]])) {
                    @unlink($f);
                    journalEchange($pdo, $code, 'sortant', basename($f), 'ecrit', 'retire : compte inactif');
                }
            }
        }

        if ((int) $part['lit_cv_pdf'] === 1) {
            foreach ($pdfs as $uid => $fabrique) {
                $contenu = $fabrique();
                $nom = "cv-$uid.pdf";
                if (ecritSiChange("$base/sortant/cv/$nom", $contenu)) {
                    $ecrits++;
                    journalEchange($pdo, $code, 'sortant', "cv/$nom", 'ecrit', null, $uid, strlen($contenu));
                }
                $index[] = ['fichier' => "cv/$nom", 'candidat' => $uid,
                            'sha256' => hash('sha256', $contenu), 'octets' => strlen($contenu)];
            }
        }

        ecritSiChange("$base/sortant/index.json", json_encode([
            'genere_le' => maintenant(),
            'partenaire' => $code,
            'contenu' => 'nominatif',
            'fichiers' => $index,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $bilan[$code] = ['fichiers' => count($index), 'ecrits' => $ecrits];
    }
    return $bilan;
}

/* ============================================================== l'entrant */

const ECHANGE_TAILLE_MAX = 1048576;          // 1 Mo : un CV structure en fait 5 ko
const JSONRESUME_SECTIONS = ['$schema', 'basics', 'work', 'volunteer', 'education', 'awards',
    'certificates', 'publications', 'skills', 'languages', 'interests', 'references',
    'projects', 'meta'];

/**
 * Valide un JSON Resume depose. Rend [donnees, null] ou [null, raison].
 *
 * Les champs inconnus sont REFUSES et non ignores : un contrat qu'on accepte a
 * moitie, on decouvre trois semaines plus tard que personne ne lisait le meme.
 */
function valideJsonResume(string $brut): array
{
    if ($brut === '') {
        return [null, 'fichier vide'];
    }
    if (strlen($brut) > ECHANGE_TAILLE_MAX) {
        return [null, 'fichier trop gros (' . strlen($brut) . ' octets, maximum ' . ECHANGE_TAILLE_MAX . ')'];
    }
    if (!mb_check_encoding($brut, 'UTF-8')) {
        return [null, 'le fichier n’est pas en UTF-8'];
    }
    $d = json_decode($brut, true, 32);
    if (!is_array($d)) {
        return [null, 'JSON invalide : ' . json_last_error_msg()];
    }
    $inconnues = array_diff(array_keys($d), JSONRESUME_SECTIONS);
    if ($inconnues) {
        return [null, 'sections hors JSON Resume : ' . implode(', ', array_slice($inconnues, 0, 5))];
    }
    if (!isset($d['basics']) || !is_array($d['basics'])) {
        return [null, '« basics » manquant : on ne sait pas de qui il s’agit'];
    }
    $email = mb_strtolower(trim((string) ($d['basics']['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return [null, '« basics.email » absent ou invalide : c’est la clé de rattachement'];
    }
    foreach (['work', 'education', 'skills', 'languages'] as $section) {
        if (isset($d[$section]) && !array_is_list((array) $d[$section])) {
            return [null, "« $section » doit être une liste"];
        }
        if (isset($d[$section]) && count((array) $d[$section]) > 60) {
            return [null, "« $section » : 60 entrées au maximum"];
        }
    }
    return [$d, null];
}

/** Le niveau de formation depuis le libelle JSON Resume (« Bac+3 »…). */
function niveauDepuisStudyType(?string $t): int
{
    $s = mb_strtolower((string) $t);
    if (str_contains($s, '+5') || str_contains($s, 'master') || str_contains($s, 'ingén')) {
        return 4;
    }
    if (str_contains($s, '+3') || str_contains($s, 'licence') || str_contains($s, 'bachelor')) {
        return 3;
    }
    if (str_contains($s, '+2') || str_contains($s, 'bts') || str_contains($s, 'dut')) {
        return 2;
    }
    return 1;
}

/** Applique un JSON Resume valide au compte qui porte cette adresse. */
function appliqueJsonResume(PDO $pdo, array $d, string $partenaire, string $fichier): array
{
    $email = mb_strtolower(trim((string) $d['basics']['email']));
    $st = $pdo->prepare("SELECT id, role, status FROM users WHERE email = ?");
    $st->execute([$email]);
    $u = $st->fetch();
    if (!$u) {
        return [null, "aucun compte avec l’adresse $email — la passerelle ne crée jamais de compte"];
    }
    if ($u['status'] !== 'actif' || $u['role'] !== 'candidat') {
        return [null, "le compte $email n’est pas un compte candidat actif"];
    }
    $id = (int) $u['id'];

    $nomComplet = trim((string) ($d['basics']['name'] ?? ''));
    $morceaux = preg_split('/\s+/', $nomComplet) ?: [];
    $prenom = $morceaux[0] ?? '';
    $nom = count($morceaux) > 1 ? implode(' ', array_slice($morceaux, 1)) : '';

    $pdo->beginTransaction();
    try {
        if ($prenom !== '') {
            $pdo->prepare('UPDATE candidates SET prenom = ?, initiale = ?, nom = ?, updated_at = ? WHERE user_id = ?')
                ->execute([mb_substr($prenom, 0, 40), mb_substr($nom !== '' ? $nom : $prenom, 0, 1),
                           mb_substr($nom, 0, 60), maintenant(), $id]);
        }
        if (($tel = trim((string) ($d['basics']['phone'] ?? ''))) !== '') {
            $pdo->prepare('UPDATE candidates SET telephone = ?, updated_at = ? WHERE user_id = ?')
                ->execute([mb_substr($tel, 0, 30), maintenant(), $id]);
        }

        if (isset($d['work'])) {
            $pdo->prepare('DELETE FROM candidate_experiences WHERE user_id = ?')->execute([$id]);
            $ins = $pdo->prepare('INSERT INTO candidate_experiences (user_id, poste, secteur, debut, fin, rang) VALUES (?,?,?,?,?,?)');
            $rang = 0;
            foreach ((array) $d['work'] as $w) {
                $poste = trim((string) ($w['position'] ?? ''));
                if ($poste === '') {
                    continue;
                }
                $date = static fn ($v) => preg_match('/^(\d{4})(-\d{2})?/', (string) $v, $m) ? ($m[1] . ($m[2] ?? '')) : '';
                $ins->execute([$id, mb_substr($poste, 0, 120), mb_substr((string) ($w['name'] ?? ''), 0, 60),
                               $date($w['startDate'] ?? ''), $date($w['endDate'] ?? ''), $rang++]);
            }
        }
        if (isset($d['education'])) {
            $pdo->prepare('DELETE FROM candidate_educations WHERE user_id = ?')->execute([$id]);
            $ins = $pdo->prepare('INSERT INTO candidate_educations (user_id, niveau, domaine, rang) VALUES (?,?,?,?)');
            $rang = 0;
            $max = null;
            foreach ((array) $d['education'] as $e) {
                $domaine = trim((string) ($e['area'] ?? $e['studyType'] ?? ''));
                if ($domaine === '') {
                    continue;
                }
                $niv = niveauDepuisStudyType((string) ($e['studyType'] ?? ''));
                $max = max($max ?? 0, $niv);
                $ins->execute([$id, $niv, mb_substr($domaine, 0, 90), $rang++]);
            }
            if ($max !== null) {
                $pdo->prepare('UPDATE candidates SET formation_max = ?, updated_at = ? WHERE user_id = ?')
                    ->execute([$max, maintenant(), $id]);
            }
        }
        if (isset($d['skills'])) {
            $noms = [];
            foreach ((array) $d['skills'] as $s) {
                $n = trim((string) ($s['name'] ?? ''));
                if ($n !== '') {
                    $noms[] = mb_substr($n, 0, 60);
                }
            }
            if ($noms) {
                remplace($pdo, 'candidate_skills', 'skill_id', $id, idsOuCree($pdo, array_slice(array_unique($noms), 0, 40)));
            }
        }
        if (isset($d['languages'])) {
            $pdo->prepare('DELETE FROM candidate_languages WHERE user_id = ?')->execute([$id]);
            $ins = $pdo->prepare('INSERT IGNORE INTO candidate_languages (user_id, langue, niveau) VALUES (?,?,?)');
            foreach ((array) $d['languages'] as $l) {
                $langue = trim((string) ($l['language'] ?? ''));
                $niv = strtoupper(trim((string) ($l['fluency'] ?? '')));
                if ($langue !== '' && preg_match('/^[ABC][12]$/', $niv)) {
                    $ins->execute([$id, mb_substr($langue, 0, 30), $niv]);
                }
            }
        }

        // Trace de la matiere recue : on doit pouvoir rejouer ou expliquer.
        $pdo->prepare(
            'INSERT INTO resume_extractions (resume_id, engine, version, payload, accepted, created_at)
             VALUES (NULL, ?, ?, ?, NULL, ?)'
        )->execute(['passerelle:' . $partenaire, mb_substr($fichier, 0, 20),
                    json_encode($d, JSON_UNESCAPED_UNICODE), maintenant()]);

        $pdo->prepare('DELETE FROM match_scores WHERE candidate_id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        return [null, 'écriture refusée : ' . mb_substr($e->getMessage(), 0, 160)];
    }
    return [$id, null];
}

/** Traite tout ce qui attend dans les dossiers entrant/. */
function ingereEntrant(PDO $pdo): array
{
    $bilan = [];
    foreach (partenaires($pdo) as $part) {
        if ((int) $part['depose_profils'] !== 1) {
            continue;
        }
        $code = (string) $part['code'];
        $base = arboPartenaire($code);
        $acceptes = 0;
        $refuses = 0;

        foreach (glob("$base/entrant/*") ?: [] as $chemin) {
            if (!is_file($chemin)) {
                continue;
            }
            $nom = basename($chemin);
            if (str_ends_with($nom, '.tmp') || str_starts_with($nom, '.')) {
                continue;            // depot en cours
            }
            $raison = null;
            $uid = null;

            if (strtolower(pathinfo($nom, PATHINFO_EXTENSION)) !== 'json') {
                $raison = 'seuls les fichiers .json sont acceptés';
            } else {
                [$d, $raison] = valideJsonResume((string) file_get_contents($chemin));
                if ($raison === null) {
                    [$uid, $raison] = appliqueJsonResume($pdo, $d, $code, $nom);
                }
            }

            $octets = (int) filesize($chemin);
            if ($raison === null) {
                $mois = gmdate('Y-m');
                @mkdir("$base/traites/$mois", 0750, true);
                rename($chemin, "$base/traites/$mois/$nom");
                journalEchange($pdo, $code, 'entrant', $nom, 'accepte', "profil $uid mis à jour", $uid, $octets);
                $acceptes++;
            } else {
                rename($chemin, "$base/rejets/$nom");
                file_put_contents("$base/rejets/$nom.erreur.txt",
                    "Refusé le " . maintenant() . " (UTC)\n\n$raison\n\n"
                    . "Le format attendu est JSON Resume (jsonresume.org).\n"
                    . "« basics.email » doit correspondre à un compte candidat existant :\n"
                    . "la passerelle ne crée jamais de compte.\n");
                journalEchange($pdo, $code, 'entrant', $nom, 'refuse', $raison, null, $octets);
                $refuses++;
            }
        }
        $bilan[$code] = ['acceptes' => $acceptes, 'refuses' => $refuses];
    }
    return $bilan;
}

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

/**
 * Le dossier d'echange, unique.
 *
 * Il y a eu quatre dossiers, un par partenaire, tant qu'on pensait ouvrir un
 * acces par personne. L'acces FTPS est finalement UN compte partage, chroote
 * sur un seul dossier : ecrire ailleurs revenait a ecrire ou personne ne
 * regarde. La table `echange_partenaires` reste en base, inutilisee.
 */
function partenaire(): string
{
    return defined('ECHANGE_PARTENAIRE') && ECHANGE_PARTENAIRE !== '' ? ECHANGE_PARTENAIRE : 'equipe';
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
    verrouilleFtps($base);
    return $base;
}

/** Les deux comptes FTPS de la passerelle (cf. outils/passerelle_comptes.py). */
const FTPS_COMPTE_DEPOT = 'avp-echange';
const FTPS_COMPTE_LECTURE = 'avp-lecture';

/**
 * Les CV et les profils se LISENT, ils ne se deposent pas.
 *
 * Plesk accepte un reglage « lecture seule » sur un compte FTP supplementaire,
 * mais l'ignore sous Linux : tous les comptes d'un abonnement sont le meme
 * utilisateur systeme. Ce qui tient, c'est le serveur FTP lui-meme (ProFTPD),
 * par un `.ftpaccess` dans chaque dossier :
 *
 *   - partout : aucune ecriture, aucun chmod, pour les deux comptes ;
 *   - entrant/ : le compte de depot y ecrit, et seulement des `.json` — un PDF,
 *     une image ou un dossier sont refuses au moment du depot (« Forbidden
 *     filename »), avant meme d'arriver sur le disque.
 *
 * Les regles visent les comptes par leur nom : un compte d'administration
 * temporaire (passerelle_comptes.py) garde la main pour reparer. Le veilleur,
 * lui, ecrit par le systeme de fichiers et n'est pas concerne. Il les reecrit a
 * chaque passage : une arborescence recreee retrouve ses verrous toute seule.
 * Verifie le 05/10/2026 : ecriture, suppression, renommage, chmod et creation
 * de dossier refuses ; lecture intacte.
 */
function verrouilleFtps(string $base): void
{
    $lecture = "<Limit WRITE SITE_CHMOD>\n"
             . "  DenyUser " . FTPS_COMPTE_DEPOT . "\n"
             . "  DenyUser " . FTPS_COMPTE_LECTURE . "\n"
             . "</Limit>\n";
    $depot = "<Limit WRITE>\n"
           . "  AllowUser " . FTPS_COMPTE_DEPOT . "\n"
           . "</Limit>\n"
           . "<Limit MKD XMKD RMD XRMD SITE_CHMOD>\n"
           . "  DenyUser " . FTPS_COMPTE_DEPOT . "\n"
           . "</Limit>\n"
           . 'PathAllowFilter "' . chr(92) . '.[jJ][sS][oO][nN]$"' . "\n";
    // l'exception d'abord : le parent verrouille, entrant/ doit deja la porter
    ecritSiChange("$base/entrant/.ftpaccess", $depot);
    ecritSiChange("$base/sortant/.ftpaccess", $lecture);   // le compte lecture est chroote ici
    ecritSiChange("$base/.ftpaccess", $lecture);
}

/* ============================================================== le sortant */

/**
 * Ecrit dans `sortant/` ce que l'equipe vient chercher :
 *
 *   profils/profil-<id>.json   le profil au format JSON Resume
 *   cv/cv-<id>.<ext>           LE FICHIER TEL QUE LA PERSONNE L'A DEPOSE
 *   index.json                 la liste, avec l'empreinte de chaque fichier
 *
 * Le CV exporte est l'original, pas le PDF que nous fabriquons : c'est lui
 * qu'une chaine d'extraction doit lire. Il repart dans son format d'origine,
 * quel qu'il soit.
 *
 * **Le numero dans le nom EST le lien au compte.** `cv-42.docx` et
 * `profil-42.json` sont la meme personne, et un JSON Resume renvoye sous le
 * nom `profil-42.json` retombera sur elle sans qu'aucune adresse n'ait besoin
 * d'etre conservee en chemin. `index.json` le redit en clair, et le meme
 * numero est ecrit dans `meta.candidat` du profil sortant, pour une chaine qui
 * renommerait les fichiers.
 */
function exporteSortant(PDO $pdo): array
{
    $liste = $pdo->query(
        "SELECT u.id, u.email FROM users u
           JOIN candidates c ON c.user_id = u.id
          WHERE u.role = 'candidat' AND u.status = 'actif' ORDER BY u.id"
    )->fetchAll();

    $code = partenaire();
    $base = arboPartenaire($code);
    $ecrits = 0;
    $index = [];
    $vusProfils = [];
    $vusCv = [];

    foreach ($liste as $u) {
        $uid = (int) $u['id'];
        $p = profilComplet($pdo, $uid);

        /* Le profil. Il part meme quand il est vide : c'est justement le cas
           ou quelqu'un attend que le CV soit analyse pour lui. */
        $resume = jsonResume($p, (string) $u['email']);
        $resume['meta']['candidat'] = $uid;
        $contenu = json_encode($resume, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $nom = "profil-$uid.json";
        $vusProfils[] = $nom;
        if (ecritSiChange("$base/sortant/profils/$nom", $contenu)) {
            $ecrits++;
            journalEchange($pdo, $code, 'sortant', "profils/$nom", 'ecrit', null, $uid, strlen($contenu));
        }
        $index[] = ['fichier' => "profils/$nom", 'candidat' => $uid, 'type' => 'jsonresume',
                    'sha256' => hash('sha256', $contenu), 'octets' => strlen($contenu)];

        /* Le CV d'origine, dechiffre le temps de l'ecriture. */
        $cv = cvActif($pdo, $uid);
        if (!$cv || ($cv['storage_key'] ?? '') === '') {
            continue;
        }
        $clair = litFichier((string) $cv['storage_key'], (string) $cv['enc_iv'], (string) $cv['enc_tag']);
        if ($clair === null) {
            journalEchange($pdo, $code, 'sortant', "cv/cv-$uid", 'erreur', 'fichier illisible', $uid);
            continue;
        }
        $ext = extensionCv((string) $cv['mime'], (string) $cv['filename']) ?? 'bin';
        $nomCv = "cv-$uid.$ext";
        $vusCv[] = $nomCv;
        if (ecritSiChange("$base/sortant/cv/$nomCv", $clair)) {
            $ecrits++;
            journalEchange($pdo, $code, 'sortant', "cv/$nomCv", 'ecrit', null, $uid, strlen($clair));
        }
        $index[] = ['fichier' => "cv/$nomCv", 'candidat' => $uid, 'type' => 'cv-origine',
                    'mime' => $cv['mime'], 'depose_le' => $cv['created_at'] ?? null,
                    'sha256' => hash('sha256', $clair), 'octets' => strlen($clair)];
    }

    /* Ce qui ne correspond plus a rien s'en va : un compte supprime ne doit
       pas laisser son CV dans un dossier que d'autres lisent. */
    foreach ([['profils', $vusProfils], ['cv', $vusCv]] as [$sous, $vus]) {
        foreach (glob("$base/sortant/$sous/*") ?: [] as $f) {
            if (!in_array(basename($f), $vus, true)) {
                @unlink($f);
                journalEchange($pdo, $code, 'sortant', "$sous/" . basename($f), 'ecrit', 'retire : compte inactif ou CV remplace');
            }
        }
    }

    ecritSiChange("$base/sortant/index.json", json_encode([
        'genere_le'  => maintenant(),
        'contenu'    => 'nominatif',
        'convention' => 'Le nombre dans le nom de fichier est l’identifiant du candidat : '
                      . 'cv-42.docx et profil-42.json sont la même personne. Renvoyez le JSON Resume '
                      . 'sous le nom profil-42.json, ou avec meta.candidat = 42.',
        'fichiers'   => $index,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    return [$code => ['fichiers' => count($index), 'ecrits' => $ecrits]];
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

/**
 * A quel compte ce fichier revient-il ?
 *
 * Dans l'ordre : le numero dans le NOM du fichier (`profil-42.json`), puis
 * `meta.candidat` dans le document, puis l'adresse e-mail. Les deux premiers
 * survivent a un changement d'adresse et a une chaine de traitement qui ne
 * garde pas l'e-mail ; le troisieme reste pour un partenaire qui produit du
 * JSON Resume standard sans rien savoir de nos conventions.
 */
function candidatDuFichier(PDO $pdo, array $d, string $fichier): array
{
    $id = 0;
    $par = '';
    if (preg_match('/(?:^|[^a-z0-9])(?:profil|cv)-(\d+)(?:[^0-9]|$)/i', pathinfo($fichier, PATHINFO_FILENAME), $m)) {
        $id = (int) $m[1];
        $par = 'le nom du fichier';
    } elseif (isset($d['meta']['candidat']) && (int) $d['meta']['candidat'] > 0) {
        $id = (int) $d['meta']['candidat'];
        $par = 'meta.candidat';
    }

    if ($id > 0) {
        $st = $pdo->prepare("SELECT id, email, role, status FROM users WHERE id = ?");
        $st->execute([$id]);
        if ($u = $st->fetch()) {
            if ($u['status'] !== 'actif' || $u['role'] !== 'candidat') {
                return [0, "le compte $id n’est pas un compte candidat actif"];
            }
            return [(int) $u['id'], null];
        }
        return [0, "aucun compte ne porte le numéro $id (lu dans $par) — "
                 . "la passerelle ne crée jamais de compte"];
    }

    $email = mb_strtolower(trim((string) ($d['basics']['email'] ?? '')));
    if ($email === '') {
        return [0, "impossible de savoir à qui ce fichier appartient : ni numéro dans le nom "
                 . "(attendu : profil-42.json), ni meta.candidat, ni basics.email"];
    }
    $st = $pdo->prepare("SELECT id, role, status FROM users WHERE email = ?");
    $st->execute([$email]);
    $u = $st->fetch();
    if (!$u) {
        return [0, "aucun compte avec l’adresse $email — la passerelle ne crée jamais de compte"];
    }
    if ($u['status'] !== 'actif' || $u['role'] !== 'candidat') {
        return [0, "le compte $email n’est pas un compte candidat actif"];
    }
    return [(int) $u['id'], null];
}

/** Applique un JSON Resume valide au compte auquel il revient. */
function appliqueJsonResume(PDO $pdo, array $d, string $partenaire, string $fichier): array
{
    [$id, $raison] = candidatDuFichier($pdo, $d, $fichier);
    if ($id === 0) {
        return [null, $raison];
    }

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

        /* Trace de la matiere recue : on doit pouvoir rejouer ou expliquer.
           Elle est RATTACHEE au CV actif : sans ce lien, l'application ne peut
           pas dire a la personne que son CV a ete lu, et son ecran reste muet
           entre le depot et le remplissage. */
        $cv = cvActif($pdo, $id);
        $pdo->prepare(
            'INSERT INTO resume_extractions (resume_id, engine, version, payload, accepted, created_at)
             VALUES (?, ?, ?, ?, NULL, ?)'
        )->execute([$cv['id'] ?? null, 'passerelle:' . $partenaire, mb_substr($fichier, 0, 20),
                    json_encode($d, JSON_UNESCAPED_UNICODE), maintenant()]);

        $pdo->prepare('DELETE FROM match_scores WHERE candidate_id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        return [null, 'écriture refusée : ' . mb_substr($e->getMessage(), 0, 160)];
    }
    return [$id, null];
}

/** Traite tout ce qui attend dans entrant/. */
function ingereEntrant(PDO $pdo): array
{
    $code = partenaire();
    $base = arboPartenaire($code);
    $acceptes = 0;
    $refuses = 0;
    {

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
            /* Un document qui n'est pas du JSON (un CV en PDF deguise en .json,
               par exemple) n'est pas garde : rejets/ n'est pas un second depot
               de CV. Seule la raison reste. */
            $conserve = $raison === null
                || json_decode((string) file_get_contents($chemin), true, 32) !== null;
            if ($raison === null) {
                $mois = gmdate('Y-m');
                @mkdir("$base/traites/$mois", 0750, true);
                rename($chemin, "$base/traites/$mois/$nom");
                journalEchange($pdo, $code, 'entrant', $nom, 'accepte', "profil $uid mis à jour", $uid, $octets);
                $acceptes++;
            } else {
                if ($conserve) {
                    rename($chemin, "$base/rejets/$nom");
                } else {
                    unlink($chemin);
                }
                file_put_contents("$base/rejets/$nom.erreur.txt",
                    "Refusé le " . maintenant() . " (UTC)\n\n$raison\n\n"
                    . ($conserve ? '' : "Ce n'est pas du JSON : le fichier n'a pas été conservé.\n"
                        . "Les CV se lisent dans sortant/cv/, ils ne se déposent pas.\n\n")
                    . "Le format attendu est JSON Resume (jsonresume.org).\n"
                    . "\n"
                    . "Pour que le fichier retombe sur la bonne personne, gardez le nom que porte\n"
                    . "son profil dans sortant/ : profil-42.json pour le candidat 42, qui est aussi\n"
                    . "celui de cv-42.pdf.\n"
                    . "\n"
                    . "A defaut : meta.candidat = 42 dans le document, ou une adresse basics.email\n"
                    . "qui existe deja. La passerelle ne cree jamais de compte.\n");
                journalEchange($pdo, $code, 'entrant', $nom, 'refuse', $raison, null, $octets);
                $refuses++;
            }
        }
    }
    return [$code => ['acceptes' => $acceptes, 'refuses' => $refuses]];
}

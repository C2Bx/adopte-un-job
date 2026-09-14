<?php
/**
 * Adopte un Job — API de production.
 *
 * Un seul point d'entree. Les chemins s'ecrivent /avp/app/api/<ressource>, et
 * fonctionnent aussi en ?r=<ressource> si le serveur n'expose pas PATH_INFO —
 * un deploiement ne doit pas dependre d'une reecriture d'URL.
 *
 * Conventions : JSON en entree comme en sortie, jeton de session en cookie
 * httpOnly (navigateur) ou en en-tete Authorization (application native).
 */

declare(strict_types=1);

require __DIR__ . '/noyau.php';
require __DIR__ . '/depot.php';
require __DIR__ . '/score.php';

const ZONES    = ['Grand Nouméa', 'Sud', 'Nord', 'Îles'];
const CONTRATS = ['CDI', 'CDD', 'Alternance', 'Intérim', 'Stage'];
const NIVEAUX  = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

try {
    $pdo = db();
} catch (Throwable $e) {
    erreur('base_indisponible', 'La base de données ne répond pas.', 503);
}

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$chemin  = trim((string) ($_SERVER['PATH_INFO'] ?? ($_GET['r'] ?? '')), '/');
$seg     = $chemin === '' ? [] : explode('/', $chemin);

if ($methode === 'OPTIONS') {
    envoie(null, 204);
}

/** Compare la route demandee a un motif ; « * » capture un segment. */
function route(string $m, string $motif, array $seg, string $methode): array|false
{
    if ($m !== $methode) {
        return false;
    }
    $parts = $motif === '' ? [] : explode('/', $motif);
    if (count($parts) !== count($seg)) {
        return false;
    }
    $args = [];
    foreach ($parts as $i => $p) {
        if ($p === '*') {
            $args[] = $seg[$i];
        } elseif ($p !== $seg[$i]) {
            return false;
        }
    }
    return $args;
}

/* ============================================================ presentation */

if (route('GET', '', $seg, $methode) !== false) {
    envoie([
        'api'     => 'Adopte un Job',
        'version' => '1.0',
        'algo'    => ALGO,
        'routes'  => [
            'POST   auth/inscription', 'POST auth/connexion', 'POST auth/deconnexion',
            'GET    auth/moi', 'GET auth/export', 'DELETE auth/compte',
            'GET    referentiels',
            'GET    profil', 'PUT profil', 'POST profil/cv',
            'GET    entreprise', 'PUT entreprise',
            'GET    offres', 'POST offres', 'GET offres/{id}', 'PUT offres/{id}', 'DELETE offres/{id}',
            'GET    deck', 'GET deck/{offre}',
            'POST   swipes',
            'GET    matchs', 'GET matchs/{id}',
            'GET    matchs/{id}/messages', 'POST matchs/{id}/messages', 'POST matchs/{id}/rdv',
            'POST   rdv/{id}',
            'GET    notifications', 'POST notifications/lu',
        ],
    ]);
}

/* =================================================================== compte */

if (route('POST', 'auth/inscription', $seg, $methode) !== false) {
    $email = mb_strtolower(texte('email', 190, true));
    $mdp   = (string) champ('motdepasse', '');
    $role  = champ('role') === 'recruteur' ? 'recruteur' : 'candidat';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        erreur('email_invalide', 'Cette adresse e-mail n’est pas valide.', 422);
    }
    // Douze caracteres, sans regle de composition : la longueur protege mieux
    // qu'une majuscule obligatoire, et se retient.
    if (mb_strlen($mdp) < 12) {
        erreur('mot_de_passe_court', 'Le mot de passe doit faire au moins 12 caractères.', 422);
    }

    $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $st->execute([$email]);
    if ($st->fetch()) {
        erreur('email_pris', 'Un compte existe déjà avec cette adresse.', 409);
    }

    $algo = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
    $pdo->prepare('INSERT INTO users (email, pass_hash, role, created_at) VALUES (?,?,?,?)')
        ->execute([$email, password_hash($mdp, $algo), $role, maintenant()]);
    $id = (int) $pdo->lastInsertId();

    if ($role === 'candidat') {
        $pdo->prepare('INSERT INTO candidates (user_id, updated_at) VALUES (?,?)')->execute([$id, maintenant()]);
    }
    // Le consentement est trace des l'inscription : sa version compte autant
    // que le fait qu'il ait ete donne.
    $pdo->prepare('INSERT INTO consents (user_id, finalite, version, accorde, created_at, ip_hash) VALUES (?,?,?,?,?,?)')
        ->execute([$id, 'traitement_candidature', '2026-09', 1, maintenant(), empreinteIp()]);

    trace($id, 'inscription', 'user', $id);
    $t = ouvreSession($id);
    envoie(['jeton' => $t, 'utilisateur' => ['id' => $id, 'email' => $email, 'role' => $role]], 201);
}

if (route('POST', 'auth/connexion', $seg, $methode) !== false) {
    $email = mb_strtolower(texte('email', 190, true));
    $mdp   = (string) champ('motdepasse', '');

    $st = $pdo->prepare('SELECT id, pass_hash, role, status FROM users WHERE email = ?');
    $st->execute([$email]);
    $u = $st->fetch();

    // Meme message et meme temps de reponse dans les deux cas : distinguer
    // « compte inconnu » de « mot de passe faux » revient a publier la liste
    // des comptes.
    if (!$u || !password_verify($mdp, $u['pass_hash'])) {
        password_verify($mdp, '$2y$12$usqhsO1Rn0Y1eIXY.J1Wtu6mFxaMzNkiDmVj1kOJgqO2LQmkP7q3W');
        trace(null, 'connexion_echouee', 'user');
        erreur('identifiants', 'Adresse ou mot de passe incorrect.', 401);
    }
    if ($u['status'] !== 'actif') {
        erreur('compte_inactif', 'Ce compte n’est plus actif.', 403);
    }

    trace((int) $u['id'], 'connexion', 'user', (int) $u['id']);
    $t = ouvreSession((int) $u['id']);
    envoie(['jeton' => $t, 'utilisateur' => ['id' => (int) $u['id'], 'email' => $email, 'role' => $u['role']]]);
}

if (route('POST', 'auth/deconnexion', $seg, $methode) !== false) {
    $t = jeton();
    if ($t !== '') {
        $pdo->prepare('DELETE FROM sessions WHERE token = ?')->execute([$t]);
    }
    setcookie(COOKIE, '', ['expires' => time() - 3600, 'path' => '/avp/app/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    envoie(['ok' => true]);
}

if (route('GET', 'auth/moi', $seg, $methode) !== false) {
    $u = utilisateur();
    envoie($u ? ['utilisateur' => ['id' => (int) $u['id'], 'email' => $u['email'], 'role' => $u['role']]]
              : ['utilisateur' => null]);
}

/* Export et suppression sont livres avec la version 1. Ajoutes apres, ils
   obligent a repasser sur tout le schema — et la loi ne les rend pas optionnels. */
if (route('GET', 'auth/export', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $id = (int) $u['id'];
    $out = ['compte' => ['email' => $u['email'], 'role' => $u['role']]];
    if ($u['role'] === 'candidat') {
        $out['profil'] = profilComplet($pdo, $id);
    }
    foreach (['swipes' => 'SELECT sens, job_id, decision, created_at FROM swipes WHERE acteur_id = ?',
              'matchs' => 'SELECT id, job_id, qualite, statut, created_at FROM matches WHERE candidate_id = ?',
              'messages' => 'SELECT match_id, corps, created_at FROM messages WHERE auteur_id = ?',
              'consentements' => 'SELECT finalite, version, accorde, created_at FROM consents WHERE user_id = ?'] as $cle => $sql) {
        $st = $pdo->prepare($sql);
        $st->execute([$id]);
        $out[$cle] = $st->fetchAll();
    }
    trace($id, 'export_donnees', 'user', $id);
    envoie($out);
}

if (route('DELETE', 'auth/compte', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $id = (int) $u['id'];
    // Anonymisation plutot que suppression : les statistiques du projet
    // survivent, et plus aucune donnee personnelle ne subsiste.
    $pdo->prepare(
        'UPDATE users SET email = CONCAT("supprime+", id, "@invalide"), pass_hash = "", status = "anonymise",
                          anonymized_at = ? WHERE id = ?'
    )->execute([maintenant(), $id]);
    $pdo->prepare('UPDATE candidates SET prenom = "", initiale = "", nom = "", telephone = "", resume_json = NULL, visible = 0 WHERE user_id = ?')
        ->execute([$id]);
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$id]);
    trace($id, 'suppression_compte', 'user', $id);
    envoie(['ok' => true, 'message' => 'Compte anonymisé. Les données personnelles ont été effacées.']);
}

/* ============================================================ referentiels */

if (route('GET', 'referentiels', $seg, $methode) !== false) {
    envoie([
        'zones'    => ZONES,
        'contrats' => CONTRATS,
        'niveauxLangue' => NIVEAUX,
        'formations' => [1 => 'Bac', 2 => 'Bac+2', 3 => 'Bac+3', 4 => 'Bac+5'],
        'metiers'  => $pdo->query('SELECT slug, label, family FROM occupations ORDER BY family, label')->fetchAll(),
        'competences' => $pdo->query('SELECT slug, label, family FROM skills ORDER BY family, label')->fetchAll(),
    ]);
}

/* ================================================================== profil */

if (route('GET', 'profil', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    envoie(['profil' => profilComplet($pdo, (int) $u['id'])]);
}

if (route('PUT', 'profil', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'INSERT INTO candidates (user_id, prenom, initiale, nom, telephone, dispo, teletravail,
                                     ouverture, salaire_min, permis, formation_max, experience_ans,
                                     resume_json, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
                prenom = VALUES(prenom), initiale = VALUES(initiale), nom = VALUES(nom),
                telephone = VALUES(telephone), dispo = VALUES(dispo), teletravail = VALUES(teletravail),
                ouverture = VALUES(ouverture), salaire_min = VALUES(salaire_min), permis = VALUES(permis),
                formation_max = VALUES(formation_max), experience_ans = VALUES(experience_ans),
                resume_json = VALUES(resume_json), updated_at = VALUES(updated_at)'
        )->execute([
            $id,
            texte('prenom', 40),
            mb_substr(texte('initiale', 2), 0, 2),
            texte('nom', 60),
            texte('telephone', 30),
            preg_match('/^\d{4}-\d{2}$/', (string) champ('dispo', '')) ? champ('dispo') : null,
            in_array(champ('teletravail'), ['peu importe', 'non', 'hybride', 'total'], true) ? champ('teletravail') : 'peu importe',
            champ('ouverture') === 'ouvert' ? 'ouvert' : 'strict',
            entierOuNull('salaireMin'),
            champ('permis') === null ? null : (champ('permis') ? 1 : 0),
            entierOuNull('formation'),
            entierOuNull('experienceAns'),
            json_encode(champ('resume'), JSON_UNESCAPED_UNICODE) ?: null,
            maintenant(),
        ]);

        remplace($pdo, 'candidate_zones', 'zone', $id, liste('zones', ZONES, 4));
        remplace($pdo, 'candidate_contracts', 'contract', $id, liste('contrats', CONTRATS, 5));

        // metiers : on accepte les slugs du referentiel, on ignore le reste
        $slugs = array_slice(array_filter(array_map('strval', (array) champ('metiers', []))), 0, 3);
        $occ = [];
        if ($slugs) {
            $in = implode(',', array_fill(0, count($slugs), '?'));
            $st = $pdo->prepare("SELECT id FROM occupations WHERE slug IN ($in)");
            $st->execute($slugs);
            $occ = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
        }
        remplace($pdo, 'candidate_occupations', 'occupation_id', $id, $occ);

        // Une competence inconnue du referentiel n'est pas perdue : elle y entre.
        // Le referentiel se construit avec l'usage, pas contre lui.
        $comps = array_slice((array) champ('competences', []), 0, 40);
        remplace($pdo, 'candidate_skills', 'skill_id', $id, idsOuCree($pdo, $comps));

        $pdo->prepare('DELETE FROM candidate_languages WHERE user_id = ?')->execute([$id]);
        $ins = $pdo->prepare('INSERT IGNORE INTO candidate_languages (user_id, langue, niveau) VALUES (?,?,?)');
        foreach (array_slice((array) champ('langues', []), 0, 8) as $l) {
            $lg = mb_substr(trim((string) ($l['langue'] ?? '')), 0, 30);
            $nv = in_array($l['niveau'] ?? '', NIVEAUX, true) ? $l['niveau'] : 'B1';
            if ($lg !== '') {
                $ins->execute([$id, $lg, $nv]);
            }
        }

        $pdo->prepare('DELETE FROM candidate_experiences WHERE user_id = ?')->execute([$id]);
        $ins = $pdo->prepare('INSERT INTO candidate_experiences (user_id, poste, secteur, debut, fin, rang) VALUES (?,?,?,?,?,?)');
        foreach (array_slice((array) champ('experiences', []), 0, 12) as $i => $x) {
            $ins->execute([
                $id,
                mb_substr(trim((string) ($x['poste'] ?? '')), 0, 120),
                mb_substr(trim((string) ($x['secteur'] ?? '')), 0, 60),
                preg_match('/^\d{4}(-\d{2})?$/', (string) ($x['debut'] ?? '')) ? $x['debut'] : '',
                preg_match('/^\d{4}(-\d{2})?$/', (string) ($x['fin'] ?? '')) ? $x['fin'] : '',
                $i,
            ]);
        }

        $pdo->prepare('DELETE FROM candidate_educations WHERE user_id = ?')->execute([$id]);
        $ins = $pdo->prepare('INSERT INTO candidate_educations (user_id, niveau, domaine, rang) VALUES (?,?,?,?)');
        foreach (array_slice((array) champ('formations', []), 0, 8) as $i => $f) {
            $n = (int) ($f['niveau'] ?? 1);
            $ins->execute([$id, max(1, min(4, $n)), mb_substr(trim((string) ($f['domaine'] ?? '')), 0, 120), $i]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        erreur('enregistrement', 'Le profil n’a pas pu être enregistré.', 500);
    }

    // Le profil a change : les scores en cache ne valent plus rien.
    $pdo->prepare('DELETE FROM match_scores WHERE candidate_id = ?')->execute([$id]);
    trace($id, 'maj_profil', 'candidate', $id);
    envoie(['profil' => profilComplet($pdo, $id)]);
}

/** Vide puis reecrit une table de liaison a une colonne. */
function remplace(PDO $pdo, string $table, string $colonne, int $userId, array $valeurs): void
{
    $pdo->prepare("DELETE FROM `$table` WHERE user_id = ?")->execute([$userId]);
    if (!$valeurs) {
        return;
    }
    $ins = $pdo->prepare("INSERT IGNORE INTO `$table` (user_id, `$colonne`) VALUES (?,?)");
    foreach ($valeurs as $v) {
        $ins->execute([$userId, $v]);
    }
}

/**
 * Resout des libelles en identifiants de competences.
 * Trois passes dans l'ordre : le slug canonique, puis les alias connus, puis la
 * creation. Comparer par slug apres coup recreerait chaque alias en double —
 * « dev web » deviendrait une competence distincte de « Developpement web ».
 */
function idsOuCree(PDO $pdo, array $libelles): array
{
    $ids = [];
    $parSlug  = $pdo->prepare('SELECT id FROM skills WHERE slug = ?');
    $parAlias = $pdo->prepare('SELECT skill_id FROM skill_aliases WHERE alias = ?');
    $ins      = $pdo->prepare('INSERT IGNORE INTO skills (slug, label, family) VALUES (?,?,?)');

    foreach ($libelles as $brut) {
        $lab = trim((string) $brut);
        $s = slugue($lab);
        if ($s === '') {
            continue;
        }
        $parSlug->execute([$s]);
        $id = $parSlug->fetchColumn();
        if ($id === false) {
            $parAlias->execute([mb_strtolower($lab, 'UTF-8')]);
            $id = $parAlias->fetchColumn();
        }
        if ($id === false) {
            // Inconnue du referentiel : elle y entre plutot que d'etre perdue.
            $ins->execute([$s, mb_substr($lab, 0, 80), 'libre']);
            $parSlug->execute([$s]);
            $id = $parSlug->fetchColumn();
        }
        if ($id !== false && !in_array((int) $id, $ids, true)) {
            $ids[] = (int) $id;
        }
    }
    return $ids;
}

/* Depot de CV : on garde la trace du fichier et de ce que l'utilisateur a
   valide, pas le fichier lui-meme — l'extraction se fait dans le navigateur. */
if (route('POST', 'profil/cv', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];
    $nom = texte('nom', 190, true);

    $pdo->prepare('UPDATE resumes SET is_active = 0 WHERE user_id = ?')->execute([$id]);
    $pdo->prepare(
        'INSERT INTO resumes (user_id, filename, mime, bytes, storage_key, sha256, is_active, created_at)
         VALUES (?,?,?,?,?,?,1,?)'
    )->execute([
        $id, $nom, texte('mime', 80) ?: 'application/pdf', (int) champ('octets', 0),
        '', mb_substr(texte('sha256', 64), 0, 64), maintenant(),
    ]);
    $resumeId = (int) $pdo->lastInsertId();

    $pdo->prepare(
        'INSERT INTO resume_extractions (resume_id, engine, version, payload, accepted, created_at)
         VALUES (?,?,?,?,?,?)'
    )->execute([
        $resumeId, texte('moteur', 40) ?: 'pdfjs', texte('version', 20) ?: '3.11.174',
        json_encode(champ('brut', []), JSON_UNESCAPED_UNICODE),
        json_encode(champ('retenu', []), JSON_UNESCAPED_UNICODE),
        maintenant(),
    ]);
    trace($id, 'depot_cv', 'resume', $resumeId);
    envoie(['cv' => ['id' => $resumeId, 'nom' => $nom]], 201);
}

/* ============================================================== entreprise */

if (route('GET', 'entreprise', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $cid = entrepriseDe($pdo, (int) $u['id']);
    if (!$cid) {
        envoie(['entreprise' => null]);
    }
    $st = $pdo->prepare('SELECT id, name, ridet, sector, size, website, pitch FROM companies WHERE id = ?');
    $st->execute([$cid]);
    envoie(['entreprise' => $st->fetch()]);
}

if (route('PUT', 'entreprise', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $id = (int) $u['id'];
    $cid = entrepriseDe($pdo, $id);
    $donnees = [
        texte('nom', 160, true), texte('ridet', 20), texte('secteur', 80),
        in_array(champ('taille'), ['1-10', '11-50', '51-200', '200+'], true) ? champ('taille') : null,
        texte('site', 190), mb_substr((string) champ('pitch', ''), 0, 2000),
    ];
    if ($cid) {
        $pdo->prepare('UPDATE companies SET name=?, ridet=?, sector=?, size=?, website=?, pitch=? WHERE id=?')
            ->execute([...$donnees, $cid]);
    } else {
        $pdo->prepare('INSERT INTO companies (name, ridet, sector, size, website, pitch, created_at) VALUES (?,?,?,?,?,?,?)')
            ->execute([...$donnees, maintenant()]);
        $cid = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO company_members (company_id, user_id, role, created_at) VALUES (?,?,?,?)')
            ->execute([$cid, $id, 'proprietaire', maintenant()]);
    }
    trace($id, 'maj_entreprise', 'company', $cid);
    envoie(['entreprise' => ['id' => $cid, 'nom' => $donnees[0]]]);
}

/* =================================================================== offres */

if (route('GET', 'offres', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $cid = entrepriseDe($pdo, (int) $u['id']);
    if (!$cid) {
        envoie(['offres' => []]);
    }
    $st = $pdo->prepare(
        'SELECT j.*, c.name AS entreprise, c.sector AS secteur, c.size AS taille, c.pitch,
                (SELECT COUNT(*) FROM matches m WHERE m.job_id = j.id) AS matchs,
                (SELECT COUNT(*) FROM swipes s WHERE s.job_id = j.id AND s.sens = "candidat" AND s.decision = "oui") AS interesses
           FROM jobs j JOIN companies c ON c.id = j.company_id
          WHERE j.company_id = ? ORDER BY j.created_at DESC'
    );
    $st->execute([$cid]);
    $out = [];
    foreach ($st->fetchAll() as $o) {
        $p = offrePublique(garnisOffre($pdo, $o));
        $p['statut'] = $o['statut'];
        $p['matchs'] = (int) $o['matchs'];
        $p['interesses'] = (int) $o['interesses'];
        $out[] = $p;
    }
    envoie(['offres' => $out]);
}

if (($a = route('GET', 'offres/*', $seg, $methode)) !== false) {
    $o = offreParId($pdo, (int) $a[0]);
    if (!$o || ($o['statut'] !== 'publiee' && !utilisateur())) {
        erreur('introuvable', 'Cette offre n’existe pas ou n’est plus publiée.', 404);
    }
    envoie(['offre' => offrePublique(garnisOffre($pdo, $o))]);
}

if (route('POST', 'offres', $seg, $methode) !== false || ($a = route('PUT', 'offres/*', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    $cid = entrepriseDe($pdo, (int) $u['id']);
    if (!$cid) {
        erreur('entreprise_manquante', 'Renseignez d’abord votre entreprise.', 409);
    }

    $occSlug = (string) champ('metier', '');
    $st = $pdo->prepare('SELECT id FROM occupations WHERE slug = ?');
    $st->execute([$occSlug]);
    $occ = $st->fetchColumn();

    $vals = [
        texte('titre', 160, true),
        $occ === false ? null : (int) $occ,
        in_array(champ('contrat'), CONTRATS, true) ? champ('contrat') : 'CDI',
        in_array(champ('zone'), ZONES, true) ? champ('zone') : ZONES[0],
        in_array(champ('teletravail'), ['non', 'hybride', 'total'], true) ? champ('teletravail') : 'non',
        entierOuNull('salaireMin'),
        entierOuNull('salaireMax'),
        max(0, (int) champ('experienceMin', 0)),
        entierOuNull('formationMin'),
        champ('permis') ? 1 : 0,
        preg_match('/^\d{4}-\d{2}$/', (string) champ('debut', '')) ? champ('debut') : null,
        mb_substr((string) champ('description', ''), 0, 6000),
        champ('statut') === 'publiee' ? 'publiee' : 'brouillon',
    ];

    $modif = isset($a[0]);
    if ($modif) {
        $o = offreParId($pdo, (int) $a[0]);
        if (!$o || (int) $o['company_id'] !== $cid) {
            erreur('interdit', 'Cette offre n’appartient pas à votre entreprise.', 403);
        }
        $pdo->prepare(
            'UPDATE jobs SET titre=?, occupation_id=?, contrat=?, zone=?, teletravail=?, salaire_min=?,
                             salaire_max=?, experience_min=?, formation_min=?, permis_requis=?, debut=?,
                             description=?, statut=?, updated_at=?,
                             published_at = IF(?="publiee" AND published_at IS NULL, ?, published_at)
              WHERE id = ?'
        )->execute([...$vals, maintenant(), $vals[12], maintenant(), (int) $a[0]]);
        $jobId = (int) $a[0];
        // L'offre a change : les scores calcules sur l'ancienne version sautent.
        $pdo->prepare('DELETE FROM match_scores WHERE job_id = ?')->execute([$jobId]);
    } else {
        $pdo->prepare(
            'INSERT INTO jobs (company_id, created_by, titre, occupation_id, contrat, zone, teletravail,
                               salaire_min, salaire_max, experience_min, formation_min, permis_requis,
                               debut, description, statut, published_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        )->execute([$cid, (int) $u['id'], ...$vals,
            $vals[12] === 'publiee' ? maintenant() : null, maintenant(), maintenant()]);
        $jobId = (int) $pdo->lastInsertId();
    }

    $pdo->prepare('DELETE FROM job_skills WHERE job_id = ?')->execute([$jobId]);
    $ins = $pdo->prepare('INSERT IGNORE INTO job_skills (job_id, skill_id, niveau) VALUES (?,?,?)');
    foreach (idsOuCree($pdo, array_slice((array) champ('requis', []), 0, 12)) as $sid) {
        $ins->execute([$jobId, $sid, 'exige']);
    }
    foreach (idsOuCree($pdo, array_slice((array) champ('souhaite', []), 0, 12)) as $sid) {
        $ins->execute([$jobId, $sid, 'souhaite']);
    }

    trace((int) $u['id'], $modif ? 'maj_offre' : 'creation_offre', 'job', $jobId);
    envoie(['offre' => offrePublique(garnisOffre($pdo, offreParId($pdo, $jobId)))], $modif ? 200 : 201);
}

if (($a = route('DELETE', 'offres/*', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    $cid = entrepriseDe($pdo, (int) $u['id']);
    $o = offreParId($pdo, (int) $a[0]);
    if (!$o || (int) $o['company_id'] !== $cid) {
        erreur('interdit', 'Cette offre n’appartient pas à votre entreprise.', 403);
    }
    // On ferme, on ne supprime pas : des matchs et des conversations en dependent.
    $pdo->prepare('UPDATE jobs SET statut = "fermee", updated_at = ? WHERE id = ?')->execute([maintenant(), (int) $a[0]]);
    trace((int) $u['id'], 'fermeture_offre', 'job', (int) $a[0]);
    envoie(['ok' => true]);
}

/* ===================================================================== deck */

if (route('GET', 'deck', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];
    // Le deck ne s'ouvre pas sur un profil incomplet : un score calcule sur
    // trois champs vides n'est pas un score, c'est un ordre au hasard.
    $manques = manquesProfil($pdo, $id);
    if ($manques) {
        envoie(['erreur' => 'profil_incomplet',
                'message' => 'Complète ton profil pour ouvrir le deck.',
                'manques' => $manques], 409);
    }
    $c = candidatPourScore($pdo, $id);

    $st = $pdo->prepare(
        'SELECT j.*, c.name AS entreprise, c.sector AS secteur, c.size AS taille, c.pitch
           FROM jobs j JOIN companies c ON c.id = j.company_id
          WHERE j.statut = "publiee"
            AND (j.expires_at IS NULL OR j.expires_at > ?)
            AND j.id NOT IN (SELECT job_id FROM swipes WHERE sens = "candidat" AND candidate_id = ?)
          ORDER BY j.published_at DESC LIMIT 200'
    );
    $st->execute([maintenant(), $id]);

    $out = [];
    foreach ($st->fetchAll() as $ligne) {
        $o = garnisOffre($pdo, $ligne);
        $e = evalue($pdo, $c, $o);
        if (!$e['contraintes']['ok']) {
            continue;                                   // filtre dur : hors deck
        }
        if ($e['passerelle'] && $c['ouverture'] === 'strict') {
            continue;                                   // le candidat a demande son métier seul
        }
        memoriseScore($pdo, (int) $o['id'], $id, $e);
        $out[] = offrePublique($o) + [
            'score' => [
                'qualite'    => $e['qualite'],
                'recruteur'  => $e['fit_recruteur'],
                'candidat'   => $e['fit_candidat'],
                'confiance'  => $e['confiance'],
                'passerelle' => $e['passerelle'],
                'passerelleRaison' => $e['passerelle_raison'],
                'vigilance'  => $e['contraintes']['vigilance'],
                'detail'     => $e['detail'],
            ],
        ];
    }
    usort($out, static fn ($x, $y) => $y['score']['qualite'] <=> $x['score']['qualite']);
    trace($id, 'deck', 'candidate', $id);
    envoie(['offres' => array_slice($out, 0, 40)]);
}

if (($a = route('GET', 'deck/*', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    $cid = entrepriseDe($pdo, (int) $u['id']);
    $o = offreParId($pdo, (int) $a[0]);
    if (!$o || (int) $o['company_id'] !== $cid) {
        erreur('interdit', 'Cette offre n’appartient pas à votre entreprise.', 403);
    }
    $o = garnisOffre($pdo, $o);

    $st = $pdo->prepare(
        'SELECT c.user_id FROM candidates c JOIN users u ON u.id = c.user_id
          WHERE c.visible = 1 AND u.status = "actif"
            AND c.user_id NOT IN (SELECT candidate_id FROM swipes WHERE sens = "recruteur" AND job_id = ?)
          LIMIT 200'
    );
    $st->execute([(int) $o['id']]);

    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $candId) {
        $c = candidatPourScore($pdo, (int) $candId);
        if (!$c || !$c['competences']) {
            continue;
        }
        $e = evalue($pdo, $c, $o);
        if (!$e['contraintes']['ok']) {
            continue;
        }
        memoriseScore($pdo, (int) $o['id'], (int) $candId, $e);
        // Avant match, l'entreprise ne voit ni nom ni contact : le tri se fait
        // sur les competences, et sur rien d'autre.
        $out[] = candidatVuParEntreprise($pdo, (int) $candId, false) + [
            'score' => [
                'qualite'   => $e['qualite'],
                'recruteur' => $e['fit_recruteur'],
                'candidat'  => $e['fit_candidat'],
                'confiance' => $e['confiance'],
                'detail'    => $e['detail'],
            ],
        ];
    }
    usort($out, static fn ($x, $y) => $y['score']['qualite'] <=> $x['score']['qualite']);
    trace((int) $u['id'], 'deck_candidats', 'job', (int) $o['id']);
    envoie(['candidats' => array_slice($out, 0, 40)]);
}

/* ================================================================== swipes */

if (route('POST', 'swipes', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $jobId = (int) champ('offre', 0);
    /* Trois décisions, pas deux : « plus tard » n'est ni un oui ni un non, et
       le forcer dans l'un des deux fausse le score comme l'historique. */
    $decision = in_array(champ('decision'), ['oui', 'non', 'plus_tard'], true)
        ? champ('decision') : 'non';
    if ($u['role'] === 'candidat') {
        $sens = 'candidat';
        $candId = (int) $u['id'];
        $manques = manquesProfil($pdo, $candId);
        if ($manques) {
            envoie(['erreur' => 'profil_incomplet',
                    'message' => 'Impossible de swiper tant que le profil est incomplet.',
                    'manques' => $manques], 409);
        }
    }

    $o = offreParId($pdo, $jobId);
    if (!$o) {
        erreur('introuvable', 'Cette offre n’existe pas.', 404);
    }

    if ($u['role'] !== 'candidat') {
        $sens = 'recruteur';
        $candId = (int) champ('candidat', 0);
        $cid = entrepriseDe($pdo, (int) $u['id']);
        if ((int) $o['company_id'] !== $cid) {
            erreur('interdit', 'Cette offre n’appartient pas à votre entreprise.', 403);
        }
    }

    $pdo->prepare(
        'INSERT INTO swipes (sens, job_id, candidate_id, acteur_id, decision, created_at)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE decision = VALUES(decision), created_at = VALUES(created_at)'
    )->execute([$sens, $jobId, $candId, (int) $u['id'], $decision, maintenant()]);

    // Un match n'existe que si les deux ont dit oui. Un seul oui ne cree rien,
    // et l'autre partie n'en est pas informee.
    $match = null;
    if ($decision === 'oui') {
        $autre = $sens === 'candidat' ? 'recruteur' : 'candidat';
        $st = $pdo->prepare('SELECT id FROM swipes WHERE sens = ? AND job_id = ? AND candidate_id = ? AND decision = "oui"');
        $st->execute([$autre, $jobId, $candId]);
        if ($st->fetch()) {
            $st = $pdo->prepare('SELECT qualite FROM match_scores WHERE job_id = ? AND candidate_id = ?');
            $st->execute([$jobId, $candId]);
            $q = (int) ($st->fetchColumn() ?: 0);

            $pdo->prepare('INSERT IGNORE INTO matches (job_id, candidate_id, qualite, created_at) VALUES (?,?,?,?)')
                ->execute([$jobId, $candId, $q, maintenant()]);
            $match = matchExiste($pdo, $jobId, $candId);

            notifie($candId, 'match', ['offre' => $jobId, 'titre' => $o['titre']]);
            $st = $pdo->prepare('SELECT user_id FROM company_members WHERE company_id = ?');
            $st->execute([$o['company_id']]);
            foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $m) {
                notifie((int) $m, 'match', ['offre' => $jobId, 'candidat' => $candId]);
            }
            trace((int) $u['id'], 'match', 'job', $jobId);
        }
    }

    envoie([
        'ok' => true,
        'match' => $match ? ['id' => (int) $match['id'], 'qualite' => (int) $match['qualite']] : null,
    ]);
}

/* Revenir sur une décision. Sans cette route, « retour » ne pourrait que
   réécrire le swipe : la carte reviendrait au deck en restant décidée. */
if (($a = route('DELETE', 'swipes/*', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $jobId = (int) $a[0];
    $id = (int) $u['id'];
    if ($u['role'] === 'candidat') {
        if (matchExiste($pdo, $jobId, $id)) {
            erreur('match_existant', 'Impossible de revenir : un match a déjà été créé.', 409);
        }
        $pdo->prepare('DELETE FROM swipes WHERE sens = "candidat" AND job_id = ? AND candidate_id = ?')
            ->execute([$jobId, $id]);
    } else {
        $candId = (int) champ('candidat', 0);
        $pdo->prepare('DELETE FROM swipes WHERE sens = "recruteur" AND job_id = ? AND candidate_id = ?')
            ->execute([$jobId, $candId]);
    }
    envoie(['ok' => true]);
}

/* Mes intérêts : tout ce que j'ai décidé, avec l'offre et son score. Sans cette
   route, l'écran ne pouvait montrer que les matchs — donc presque toujours rien,
   puisqu'un match demande aussi le oui de l'entreprise. */
if (route('GET', 'interets', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];
    $st = $pdo->prepare(
        'SELECT s.decision, s.created_at AS quand, j.*,
                c.name AS entreprise, c.sector AS secteur, c.size AS taille, c.pitch,
                ms.qualite, ms.fit_recruteur, ms.fit_candidat, ms.confiance, ms.detail,
                (SELECT m.id FROM matches m WHERE m.job_id = j.id AND m.candidate_id = ?) AS match_id
           FROM swipes s
           JOIN jobs j ON j.id = s.job_id
           JOIN companies c ON c.id = j.company_id
           LEFT JOIN match_scores ms ON ms.job_id = j.id AND ms.candidate_id = ?
          WHERE s.sens = "candidat" AND s.candidate_id = ?
          ORDER BY s.created_at DESC'
    );
    $st->execute([$id, $id, $id]);

    /* Le cache des scores est vidé à chaque modification du profil : c'est
       voulu, un score périmé ment. Mais l'écran des intérêts doit quand même
       afficher un chiffre — alors on recalcule ce qui manque, et on le range. */
    $c = candidatPourScore($pdo, $id);
    $out = [];
    foreach ($st->fetchAll() as $ligne) {
        $garni = garnisOffre($pdo, $ligne);
        if ($ligne['qualite'] === null && $c) {
            $e = evalue($pdo, $c, $garni);
            memoriseScore($pdo, (int) $ligne['id'], $id, $e);
            $ligne['qualite'] = $e['qualite'];
            $ligne['fit_recruteur'] = $e['fit_recruteur'];
            $ligne['fit_candidat'] = $e['fit_candidat'];
            $ligne['confiance'] = $e['confiance'];
            $ligne['detail'] = json_encode($e['detail'], JSON_UNESCAPED_UNICODE);
        }
        $o = offrePublique($garni);
        $o['decision'] = $ligne['decision'];
        $o['quand'] = $ligne['quand'];
        $o['match'] = $ligne['match_id'] === null ? null : (int) $ligne['match_id'];
        $o['statut'] = $ligne['statut'];
        if ($ligne['qualite'] !== null) {
            $o['score'] = [
                'qualite' => (int) $ligne['qualite'],
                'recruteur' => (int) $ligne['fit_recruteur'],
                'candidat' => (int) $ligne['fit_candidat'],
                'confiance' => (int) $ligne['confiance'],
                'detail' => json_decode((string) $ligne['detail'], true),
            ];
        }
        $out[] = $o;
    }
    envoie(['interets' => $out]);
}

/* ================================================================== matchs */

if (route('GET', 'matchs', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $id = (int) $u['id'];
    if ($u['role'] === 'candidat') {
        $st = $pdo->prepare(
            'SELECT m.id, m.qualite, m.statut, m.created_at, j.id AS offre, j.titre, c.name AS entreprise,
                    (SELECT COUNT(*) FROM messages x WHERE x.match_id = m.id AND x.read_at IS NULL AND x.auteur_id <> ?) AS non_lus
               FROM matches m JOIN jobs j ON j.id = m.job_id JOIN companies c ON c.id = j.company_id
              WHERE m.candidate_id = ? ORDER BY m.created_at DESC'
        );
        $st->execute([$id, $id]);
    } else {
        $cid = entrepriseDe($pdo, $id);
        $st = $pdo->prepare(
            'SELECT m.id, m.qualite, m.statut, m.created_at, j.id AS offre, j.titre, m.candidate_id,
                    (SELECT COUNT(*) FROM messages x WHERE x.match_id = m.id AND x.read_at IS NULL AND x.auteur_id <> ?) AS non_lus
               FROM matches m JOIN jobs j ON j.id = m.job_id
              WHERE j.company_id = ? ORDER BY m.created_at DESC'
        );
        $st->execute([$id, (int) $cid]);
    }
    envoie(['matchs' => $st->fetchAll()]);
}

if (($a = route('GET', 'matchs/*', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $m = accesAuMatch($pdo, $u, (int) $a[0]);
    $o = garnisOffre($pdo, offreParId($pdo, (int) $m['job_id']));
    $out = ['match' => ['id' => (int) $m['id'], 'qualite' => (int) $m['qualite'], 'statut' => $m['statut']],
            'offre' => offrePublique($o)];
    if ((int) $m['candidate_id'] !== (int) $u['id']) {
        // Apres match, le contact s'ouvre : c'est tout l'interet du match.
        $out['candidat'] = candidatVuParEntreprise($pdo, (int) $m['candidate_id'], true);
        trace((int) $u['id'], 'lecture_profil_candidat', 'candidate', (int) $m['candidate_id']);
    }
    $st = $pdo->prepare('SELECT id, debut_utc, duree_min, mode, lieu, statut FROM appointments WHERE match_id = ? ORDER BY debut_utc');
    $st->execute([(int) $m['id']]);
    $out['rdv'] = $st->fetchAll();
    envoie($out);
}

/* =============================================================== messagerie */

if (($a = route('GET', 'matchs/*/messages', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $m = accesAuMatch($pdo, $u, (int) $a[0]);
    $st = $pdo->prepare('SELECT id, auteur_id, corps, created_at, read_at FROM messages WHERE match_id = ? ORDER BY id');
    $st->execute([(int) $m['id']]);
    $msgs = $st->fetchAll();
    $pdo->prepare('UPDATE messages SET read_at = ? WHERE match_id = ? AND auteur_id <> ? AND read_at IS NULL')
        ->execute([maintenant(), (int) $m['id'], (int) $u['id']]);
    envoie(['messages' => array_map(static fn ($x) => [
        'id'    => (int) $x['id'],
        'moi'   => (int) $x['auteur_id'] === (int) $u['id'],
        'corps' => $x['corps'],
        'quand' => $x['created_at'],
    ], $msgs)]);
}

if (($a = route('POST', 'matchs/*/messages', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $m = accesAuMatch($pdo, $u, (int) $a[0]);
    $corps = trim((string) champ('corps', ''));
    if ($corps === '') {
        erreur('message_vide', 'Le message est vide.', 422);
    }
    $pdo->prepare('INSERT INTO messages (match_id, auteur_id, corps, created_at) VALUES (?,?,?,?)')
        ->execute([(int) $m['id'], (int) $u['id'], mb_substr($corps, 0, 4000), maintenant()]);

    $destinataire = (int) $m['candidate_id'] === (int) $u['id'] ? null : (int) $m['candidate_id'];
    if ($destinataire) {
        notifie($destinataire, 'message', ['match' => (int) $m['id']]);
    } else {
        $st = $pdo->prepare('SELECT user_id FROM company_members WHERE company_id = ?');
        $st->execute([$m['company_id']]);
        foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $x) {
            notifie((int) $x, 'message', ['match' => (int) $m['id']]);
        }
    }
    envoie(['ok' => true], 201);
}

/* ================================================================ rendez-vous */

if (($a = route('POST', 'matchs/*/rdv', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $m = accesAuMatch($pdo, $u, (int) $a[0]);
    $debut = (string) champ('debut', '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $debut)) {
        erreur('date_invalide', 'La date doit être au format AAAA-MM-JJ HH:MM (UTC).', 422);
    }
    $pdo->prepare(
        'INSERT INTO appointments (match_id, propose_par, debut_utc, duree_min, mode, lieu, statut, created_at)
         VALUES (?,?,?,?,?,?,"propose",?)'
    )->execute([
        (int) $m['id'], (int) $u['id'], substr($debut, 0, 19),
        max(15, min(240, (int) champ('duree', 30))),
        in_array(champ('mode'), ['sur place', 'visio', 'telephone'], true) ? champ('mode') : 'sur place',
        mb_substr((string) champ('lieu', ''), 0, 190), maintenant(),
    ]);
    $autre = (int) $m['candidate_id'] === (int) $u['id'] ? null : (int) $m['candidate_id'];
    if ($autre) {
        notifie($autre, 'rdv', ['match' => (int) $m['id']]);
    }
    envoie(['rdv' => ['id' => (int) $pdo->lastInsertId()]], 201);
}

if (($a = route('POST', 'rdv/*', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $st = $pdo->prepare('SELECT * FROM appointments WHERE id = ?');
    $st->execute([(int) $a[0]]);
    $r = $st->fetch();
    if (!$r) {
        erreur('introuvable', 'Ce rendez-vous n’existe pas.', 404);
    }
    accesAuMatch($pdo, $u, (int) $r['match_id']);
    $s = champ('statut');
    if (!in_array($s, ['accepte', 'refuse', 'annule'], true)) {
        erreur('statut_invalide', 'Statut attendu : accepte, refuse ou annule.', 422);
    }
    $pdo->prepare('UPDATE appointments SET statut = ? WHERE id = ?')->execute([$s, (int) $r['id']]);
    envoie(['ok' => true]);
}

/* ============================================================ notifications */

if (route('GET', 'notifications', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $st = $pdo->prepare('SELECT id, type, payload, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50');
    $st->execute([(int) $u['id']]);
    envoie(['notifications' => array_map(static fn ($n) => [
        'id'    => (int) $n['id'],
        'type'  => $n['type'],
        'donnees' => json_decode((string) $n['payload'], true),
        'quand' => $n['created_at'],
        'lu'    => $n['read_at'] !== null,
    ], $st->fetchAll())]);
}

if (route('POST', 'notifications/lu', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $pdo->prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
        ->execute([maintenant(), (int) $u['id']]);
    envoie(['ok' => true]);
}

erreur('route_inconnue', 'Cette route n’existe pas : ' . $methode . ' /' . $chemin, 404);

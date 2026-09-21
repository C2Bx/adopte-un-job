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
require __DIR__ . '/opt.php';

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

/* Avant toute route : la limite de debit globale, et le refus des ecritures
   venues d'une origine inconnue. Ce sont des regles, pas des options. */
limiteGlobale();
exigeOrigineSure($methode);

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
    require __DIR__ . '/doc.php';
    envoie(['api' => 'Adopte un Job', 'version' => '2.0', 'algo' => ALGO, 'openapi' => 'openapi.json',
            'routes' => array_map(static fn ($r) => $r[0] . ' ' . $r[1], routesDocumentees())]);
}

/* =================================================================== compte */

if (route('POST', 'auth/inscription', $seg, $methode) !== false) {
    limite('inscription:' . empreinteIp(), 10, 3600);
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
    [$verifClair, $verifHash] = jetonUnique();
    $pdo->prepare('INSERT INTO users (email, pass_hash, role, verify_hash, created_at) VALUES (?,?,?,?,?)')
        ->execute([$email, password_hash($mdp, $algo), $role, $verifHash, maintenant()]);
    $id = (int) $pdo->lastInsertId();

    $organisation = null;
    if ($role === 'candidat') {
        $pdo->prepare('INSERT INTO candidates (user_id, updated_at) VALUES (?,?)')->execute([$id, maintenant()]);
    } else {
        /* Un recruteur rejoint une organisation par son code, ou en cree une.
           Sans l'un ni l'autre, le compte existe et l'ecran le lui demandera. */
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) champ('code', '')) ?? '');
        $nomOrg = texte('organisation', 160);
        if ($code !== '') {
            $st = $pdo->prepare('SELECT id, name FROM companies WHERE invite_code = ?');
            $st->execute([$code]);
            if ($c = $st->fetch()) {
                $pdo->prepare('INSERT INTO company_members (company_id, user_id, role, created_at) VALUES (?,?,"recruteur",?)')->execute([(int) $c['id'], $id, maintenant()]);
                $organisation = ['id' => (int) $c['id'], 'nom' => $c['name']];
            }
        } elseif ($nomOrg !== '') {
            $slug = slugue($nomOrg) . '-' . substr(bin2hex(random_bytes(3)), 0, 5);
            $pdo->prepare('INSERT INTO companies (name, slug, invite_code, source, created_at) VALUES (?,?,?,"app",?)')->execute([$nomOrg, $slug, codeInvitation(), maintenant()]);
            $cid = (int) $pdo->lastInsertId();
            $pdo->prepare('INSERT INTO company_members (company_id, user_id, role, created_at) VALUES (?,?,"proprietaire",?)')->execute([$cid, $id, maintenant()]);
            $organisation = ['id' => $cid, 'nom' => $nomOrg];
        }
    }
    enfileMail($id, $email, 'Vérifiez votre adresse — Adopte un Job', "Code de vérification : $verifClair");
    // Le consentement est trace des l'inscription : sa version compte autant
    // que le fait qu'il ait ete donne.
    $pdo->prepare('INSERT INTO consents (user_id, finalite, version, accorde, created_at, ip_hash) VALUES (?,?,?,?,?,?)')
        ->execute([$id, 'traitement_candidature', '2026-09', 1, maintenant(), empreinteIp()]);

    trace($id, 'inscription', 'user', $id);
    $t = ouvreSession($id);
    envoie(['jeton' => $t, 'utilisateur' => ['id' => $id, 'email' => $email, 'role' => $role, 'organisation' => $organisation]], 201);
}

if (route('POST', 'auth/connexion', $seg, $methode) !== false) {
    $email = mb_strtolower(texte('email', 190, true));
    $mdp   = (string) champ('motdepasse', '');
    limite('connexion:' . empreinteIp(), 30, 900);
    limite('connexion:' . substr(hash('sha256', $email), 0, 24), 10, 900);

    $st = $pdo->prepare('SELECT id, pass_hash, role, status FROM users WHERE email = ?');
    $st->execute([$email]);
    $u = $st->fetch();

    // Meme message et meme temps de reponse dans les deux cas : distinguer
    // « compte inconnu » de « mot de passe faux » revient a publier la liste
    // des comptes.
    if (!$u || !password_verify($mdp, $u['pass_hash'])) {
        // Le hash factice est du MEME algorithme que les vrais (Argon2id) :
        // un bcrypt repondait plus vite, et le temps trahissait l'existence du compte.
        password_verify($mdp, HASH_FACTICE);
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
    if (!$u) {
        envoie(['utilisateur' => null]);
    }
    $st = $pdo->prepare('SELECT email_verified_at FROM users WHERE id = ?');
    $st->execute([(int) $u['id']]);
    $out = ['id' => (int) $u['id'], 'email' => $u['email'], 'role' => $u['role'], 'emailVerifie' => $st->fetchColumn() !== null];
    if ($u['role'] !== 'candidat') {
        $st = $pdo->prepare('SELECT c.id, c.name, m.role FROM company_members m JOIN companies c ON c.id = m.company_id WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1');
        $st->execute([(int) $u['id']]);
        $o = $st->fetch();
        $out['organisation'] = $o ? ['id' => (int) $o['id'], 'nom' => $o['name'], 'role' => $o['role']] : null;
    }
    envoie(['utilisateur' => $out]);
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
              'candidatures' => 'SELECT job_id, statut, created_at, updated_at FROM applications WHERE candidate_id = ?',
              'entretiens' => 'SELECT job_id, debut_utc, duree_min, mode, statut FROM entretiens WHERE candidate_id = ?',
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
    // les fichiers de CV disparaissent avec le compte, la trace de leur depot reste
    $st = $pdo->prepare('SELECT id, storage_key FROM resumes WHERE user_id = ?');
    $st->execute([$id]);
    foreach ($st->fetchAll() as $r) {
        supprimeFichier($r['storage_key']);
    }
    $pdo->prepare('UPDATE resumes SET storage_key = "", enc_iv = NULL, enc_tag = NULL, filename = "supprime" WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM resume_extractions WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = ?)')->execute([$id]);
    $pdo->prepare('UPDATE applications SET statut = "retiree", message = NULL, updated_at = ? WHERE candidate_id = ? AND statut NOT IN ("acceptee","refusee")')->execute([maintenant(), $id]);
    $pdo->prepare('UPDATE api_keys SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')->execute([maintenant(), $id]);
    // un compte RH quitte son organisation : elle ne doit plus le lister
    $pdo->prepare('DELETE FROM company_members WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('UPDATE entretiens SET statut = "annule", updated_at = ? WHERE statut IN ("propose","confirme") AND (candidate_id = ? OR propose_par = ?)')
        ->execute([maintenant(), $id, $id]);
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
        // le referentiel OPT-NC : ce que le candidat vise, dans les mots de l'employeur
        'metiersOpt' => $pdo->query('SELECT m.code_metier AS code, m.nom, m.famille_id AS famille, f.libelle AS familleLibelle FROM opt_metiers m LEFT JOIN opt_familles f ON f.id = m.famille_id WHERE m.actif = 1 ORDER BY f.libelle, m.nom')->fetchAll(),
        'familles' => $pdo->query('SELECT id, libelle, couleur FROM opt_familles ORDER BY libelle')->fetchAll(),
        'villes' => $pdo->query('SELECT DISTINCT ville FROM jobs WHERE ville IS NOT NULL ORDER BY ville')->fetchAll(PDO::FETCH_COLUMN),
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

        // metiers OPT vises : des codes du referentiel, trois au plus
        $codes = array_slice(array_values(array_filter(array_map(static fn ($x) => strtoupper((string) $x), (array) champ('metiersOpt', [])), static fn ($x) => preg_match('/^OP\d{3}$/', $x) === 1)), 0, 3);
        $validesOpt = [];
        if ($codes) {
            $in = implode(',', array_fill(0, count($codes), '?'));
            $st = $pdo->prepare("SELECT code_metier FROM opt_metiers WHERE code_metier IN ($in)");
            $st->execute($codes);
            $validesOpt = $st->fetchAll(PDO::FETCH_COLUMN);
        }
        remplace($pdo, 'candidate_opt_metiers', 'code_metier', $id, $validesOpt);

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

    // Les competences libres se rattachent au referentiel OPT (alias, puis mots
    // communs) ; le candidat voit le resultat et le corrige dans son profil.
    $libelles = array_merge((array) champ('competences', []),
        array_map(static fn ($x) => (string) ($x['poste'] ?? ''), (array) champ('experiences', [])));
    rattacheCompetences($pdo, $id, $libelles);
    // les competences OPT cochees explicitement par le candidat
    $saisies = array_slice(array_values(array_filter(array_map('strval', (array) champ('competencesOptSaisies', [])), static fn ($x) => preg_match('/^COMP\d+$/', $x) === 1)), 0, 40);
    $pdo->prepare('DELETE FROM candidate_opt_competences WHERE user_id = ? AND source = "saisie"')->execute([$id]);
    $ins = $pdo->prepare('INSERT INTO candidate_opt_competences (user_id, code_competence, source) VALUES (?,?,"saisie") ON DUPLICATE KEY UPDATE source = "saisie"');
    foreach ($saisies as $code) {
        $ins->execute([$id, $code]);
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

/* ============================================================== domaines */

/* Chaque domaine vit dans son fichier et lit $pdo, $seg, $methode. L'ordre
   compte : une route plus specifique (avp/filtres) passe avant une route a
   segment libre (avp/*), et chaque fichier s'en charge pour les siennes. */
require __DIR__ . '/cv.php';
require __DIR__ . '/compte.php';
require __DIR__ . '/organisation.php';
require __DIR__ . '/avp.php';
require __DIR__ . '/candidatures.php';
require __DIR__ . '/agenda.php';
require __DIR__ . '/tableau.php';

/* =================================================================== offres */

/* Les offres saisies par une organisation (source 'app'). Les AVP OPT (source
   'opt') arrivent par synchronisation et ne se modifient pas ici. */
if (route('GET', 'offres', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    $st = $pdo->prepare(
        'SELECT j.*, c.name AS entreprise, c.sector AS secteur, c.size AS taille, c.pitch,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS candidatures,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.statut IN ("envoyee","vue")) AS en_attente,
                (SELECT COUNT(*) FROM matches m WHERE m.job_id = j.id) AS matchs,
                (SELECT COUNT(*) FROM job_views v WHERE v.job_id = j.id) AS vues
           FROM jobs j JOIN companies c ON c.id = j.company_id
          WHERE j.company_id = ? ORDER BY j.statut = "publiee" DESC, en_attente DESC, candidatures DESC, j.published_at DESC, j.created_at DESC'
    );
    $st->execute([(int) $org['id']]);
    $out = [];
    foreach ($st->fetchAll() as $o) {
        $p = offrePublique(garnisOffre($pdo, $o));
        $p['candidatures'] = (int) $o['candidatures'];
        $p['enAttente'] = (int) $o['en_attente'];
        $p['matchs'] = (int) $o['matchs'];
        $p['vues'] = (int) $o['vues'];
        $out[] = $p;
    }
    envoie(['offres' => $out, 'organisation' => organisationPublique($org)]);
}

if (route('POST', 'offres', $seg, $methode) !== false || ($a = route('PUT', 'offres/*', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    if ($org['membre_role'] === 'lecteur') {
        erreur('role_insuffisant', 'Un lecteur ne publie pas d’offre.', 403);
    }
    $codeMetier = strtoupper((string) champ('codeMetier', ''));
    $m = $codeMetier !== '' ? metierOpt($pdo, $codeMetier) : null;
    $familles = $m ? [$m['famille']] : [];

    $vals = [
        texte('titre', 160, true),
        null,
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
        $m ? $m['code_metier'] : null,
        texte('ville', 60) ?: null,
        json_encode($familles, JSON_UNESCAPED_UNICODE),
        preg_match('/^\d{4}-\d{2}-\d{2}/', (string) champ('expire', ''), $mm) ? $mm[0] . ' 23:59:59' : null,
    ];
    $comp = array_slice(array_values(array_filter(array_map('strval', (array) champ('competencesTexte', [])))), 0, 20);
    $ct = json_encode(array_map(static fn ($t) => ['texte' => mb_substr($t, 0, 240), 'type' => 'savoir-faire', 'mots' => motsPorteurs($t)], $comp), JSON_UNESCAPED_UNICODE);
    $texte = $vals[0] . "\n" . $vals[11] . "\n" . implode("\n", $comp) . ' ' . ($m['nom'] ?? '');

    $modif = isset($a[0]);
    if ($modif) {
        $o = exigeOffreDeOrganisation($pdo, $org, (int) $a[0]);
        if ($o['source'] === 'opt') {
            erreur('offre_synchronisee', 'Un AVP de l’OPT-NC se modifie à la source, pas ici.', 409);
        }
        $pdo->prepare(
            'UPDATE jobs SET titre=?, occupation_id=?, contrat=?, zone=?, teletravail=?, salaire_min=?, salaire_max=?,
                             experience_min=?, formation_min=?, permis_requis=?, debut=?, description=?, statut=?,
                             code_metier=?, ville=?, familles=?, expires_at=?, competences_texte=?, texte_recherche=?, updated_at=?,
                             published_at = IF(?="publiee" AND published_at IS NULL, ?, published_at)
              WHERE id = ?'
        )->execute([...$vals, $ct, $texte, maintenant(), $vals[12], maintenant(), (int) $a[0]]);
        $jobId = (int) $a[0];
        $pdo->prepare('DELETE FROM match_scores WHERE job_id = ?')->execute([$jobId]);
    } else {
        $pdo->prepare(
            'INSERT INTO jobs (company_id, created_by, titre, occupation_id, contrat, zone, teletravail, salaire_min, salaire_max,
                               experience_min, formation_min, permis_requis, debut, description, statut, code_metier, ville, familles,
                               expires_at, competences_texte, texte_recherche, source, published_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"app",?,?,?)'
        )->execute([(int) $org['id'], (int) $u['id'], ...$vals, $ct, $texte,
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
    $org = organisationDe($pdo, $u);
    $o = exigeOffreDeOrganisation($pdo, $org, (int) $a[0]);
    if ($o['source'] === 'opt') {
        erreur('offre_synchronisee', 'Un AVP de l’OPT-NC se ferme à la source.', 409);
    }
    // On ferme, on ne supprime pas : des candidatures en dependent.
    $pdo->prepare('UPDATE jobs SET statut = "fermee", updated_at = ? WHERE id = ?')->execute([maintenant(), (int) $a[0]]);
    trace((int) $u['id'], 'fermeture_offre', 'job', (int) $a[0]);
    envoie(['ok' => true]);
}

/* ================================================================== swipes */

/* Le geste du deck. « oui » est une candidature ; « non » et « plus tard »
   restent des decisions privees du candidat. Le cote organisation ne swipe
   plus : il traite des candidatures (PUT candidatures/{id}/statut). */
if (route('POST', 'swipes', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $candId = (int) $u['id'];
    limite('swipe:' . $candId, 600, 3600);
    $decision = in_array(champ('decision'), ['oui', 'non', 'plus_tard'], true) ? champ('decision') : 'non';
    $o = offreParId($pdo, (int) champ('offre', 0));
    if (!$o) {
        erreur('introuvable', 'Cette offre n’existe pas.', 404);
    }
    if ($decision === 'oui') {
        $manques = manquesProfil($pdo, $candId);
        if ($manques) {
            envoie(['erreur' => 'profil_incomplet', 'message' => 'Complète ton profil avant de candidater.', 'manques' => $manques], 409);
        }
        if ($o['statut'] !== 'publiee' || ($o['expires_at'] !== null && $o['expires_at'] <= maintenant())) {
            // un AVP clos : le geste est enregistre (entrainement), pas la candidature
            $pdo->prepare('INSERT INTO swipes (sens, job_id, candidate_id, acteur_id, decision, created_at) VALUES ("candidat",?,?,?,"oui",?) ON DUPLICATE KEY UPDATE decision = "oui", created_at = VALUES(created_at)')
                ->execute([(int) $o['id'], $candId, $candId, maintenant()]);
            envoie(['ok' => true, 'candidature' => null, 'entrainement' => true, 'message' => 'Offre close : geste enregistré pour t’entraîner, sans candidature.']);
        }
        $a = candidate($pdo, $candId, $o, (string) champ('message', ''));
        envoie(['ok' => true, 'candidature' => ['id' => (int) $a['id'], 'statut' => $a['statut']], 'match' => null], 201);
    }
    $pdo->prepare(
        'INSERT INTO swipes (sens, job_id, candidate_id, acteur_id, decision, created_at) VALUES ("candidat",?,?,?,?,?)
         ON DUPLICATE KEY UPDATE decision = VALUES(decision), created_at = VALUES(created_at)'
    )->execute([(int) $o['id'], $candId, $candId, $decision, maintenant()]);
    envoie(['ok' => true, 'candidature' => null, 'match' => null]);
}

/* Revenir sur une decision. Une candidature deja ouverte par l'organisation
   ne s'efface pas : elle se retire (statut), pour que l'autre cote le sache. */
if (($a = route('DELETE', 'swipes/*', $seg, $methode)) !== false) {
    $u = exigeConnexion('candidat');
    $jobId = (int) $a[0];
    $id = (int) $u['id'];
    $st = $pdo->prepare('SELECT * FROM applications WHERE job_id = ? AND candidate_id = ?');
    $st->execute([$jobId, $id]);
    $app = $st->fetch();
    if ($app && in_array($app['statut'], STATUTS_OUVERTS, true)) {
        erreur('match_existant', 'Cette candidature a été présélectionnée : retire-la depuis « Mes candidatures ».', 409);
    }
    if ($app) {
        $pdo->prepare('UPDATE applications SET statut = "retiree", updated_at = ? WHERE id = ?')->execute([maintenant(), (int) $app['id']]);
        evenement($pdo, (int) $app['id'], $id, 'retiree');
    }
    $pdo->prepare('DELETE FROM swipes WHERE sens = "candidat" AND job_id = ? AND candidate_id = ?')->execute([$jobId, $id]);
    envoie(['ok' => true]);
}

/* Mes interets : tout ce que j'ai decide, avec l'offre, son score et, si
   c'est un oui, l'etat de la candidature. */
if (route('GET', 'interets', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];
    $st = $pdo->prepare(
        'SELECT s.decision, s.created_at AS quand, j.*,
                c.name AS entreprise, c.sector AS secteur, c.size AS taille, c.pitch,
                ms.qualite, ms.fit_recruteur, ms.fit_candidat, ms.confiance, ms.detail,
                a.id AS application_id, a.statut AS application_statut, a.match_id
           FROM swipes s
           JOIN jobs j ON j.id = s.job_id
           JOIN companies c ON c.id = j.company_id
           LEFT JOIN match_scores ms ON ms.job_id = j.id AND ms.candidate_id = ?
           LEFT JOIN applications a ON a.job_id = j.id AND a.candidate_id = ?
          WHERE s.sens = "candidat" AND s.candidate_id = ?
          ORDER BY s.created_at DESC'
    );
    $st->execute([$id, $id, $id]);
    $c = candidatPourScore($pdo, $id);
    $out = [];
    foreach ($st->fetchAll() as $ligne) {
        $garni = garnisOffre($pdo, $ligne);
        $o = offrePublique($garni);
        if ($ligne['qualite'] === null && $c) {
            $e = evalue($pdo, $c, $garni);
            memoriseScore($pdo, (int) $ligne['id'], $id, $e);
            $o['score'] = scorePublic($e);
        } elseif ($ligne['qualite'] !== null) {
            $o['score'] = [
                'qualite' => (int) $ligne['qualite'], 'recruteur' => (int) $ligne['fit_recruteur'],
                'candidat' => (int) $ligne['fit_candidat'], 'confiance' => (int) $ligne['confiance'],
                'detail' => json_decode((string) $ligne['detail'], true),
            ];
            $o['score']['ecarts'] = $o['score']['detail']['ecarts'] ?? [];
        }
        $o['decision'] = $ligne['decision'];
        $o['quand'] = $ligne['quand'];
        $o['match'] = $ligne['match_id'] === null ? null : (int) $ligne['match_id'];
        $o['candidature'] = $ligne['application_id'] ? ['id' => (int) $ligne['application_id'], 'statut' => $ligne['application_statut']] : null;
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
                    (SELECT a.id FROM applications a WHERE a.match_id = m.id LIMIT 1) AS candidature,
                    (SELECT COUNT(*) FROM messages x WHERE x.match_id = m.id AND x.read_at IS NULL AND x.auteur_id <> ?) AS non_lus
               FROM matches m JOIN jobs j ON j.id = m.job_id JOIN companies c ON c.id = j.company_id
              WHERE m.candidate_id = ? ORDER BY m.created_at DESC'
        );
        $st->execute([$id, $id]);
    } else {
        $org = organisationDe($pdo, $u);
        $st = $pdo->prepare(
            'SELECT m.id, m.qualite, m.statut, m.created_at, j.id AS offre, j.titre, m.candidate_id,
                    ca.prenom, ca.initiale,
                    (SELECT a.id FROM applications a WHERE a.match_id = m.id LIMIT 1) AS candidature,
                    (SELECT COUNT(*) FROM messages x WHERE x.match_id = m.id AND x.read_at IS NULL AND x.auteur_id <> ?) AS non_lus
               FROM matches m JOIN jobs j ON j.id = m.job_id JOIN candidates ca ON ca.user_id = m.candidate_id
              WHERE j.company_id = ? ORDER BY m.created_at DESC'
        );
        $st->execute([$id, (int) $org['id']]);
    }
    envoie(['matchs' => array_map(static fn ($m) => $m + ['non_lus' => (int) $m['non_lus'], 'candidature' => $m['candidature'] === null ? null : (int) $m['candidature']], $st->fetchAll())]);
}

if (($a = route('GET', 'matchs/*', $seg, $methode)) !== false && ctype_digit($a[0])) {
    $u = exigeConnexion();
    $m = accesAuMatch($pdo, $u, (int) $a[0]);
    $o = garnisOffre($pdo, offreParId($pdo, (int) $m['job_id']));
    $out = ['match' => ['id' => (int) $m['id'], 'qualite' => (int) $m['qualite'], 'statut' => $m['statut']],
            'offre' => offrePublique($o)];
    $st = $pdo->prepare('SELECT id, statut FROM applications WHERE match_id = ? LIMIT 1');
    $st->execute([(int) $m['id']]);
    $out['candidature'] = $st->fetch() ?: null;
    if ((int) $m['candidate_id'] !== (int) $u['id']) {
        $out['candidat'] = candidatVuParEntreprise($pdo, (int) $m['candidate_id'], true);
        trace((int) $u['id'], 'lecture_profil_candidat', 'candidate', (int) $m['candidate_id']);
    }
    $st = $pdo->prepare('SELECT id, debut_utc, duree_min, mode, lieu, statut FROM entretiens WHERE job_id = ? AND candidate_id = ? ORDER BY debut_utc');
    $st->execute([(int) $m['job_id'], (int) $m['candidate_id']]);
    $out['entretiens'] = $st->fetchAll();
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
        'id' => (int) $x['id'], 'moi' => (int) $x['auteur_id'] === (int) $u['id'], 'corps' => $x['corps'], 'quand' => $x['created_at'],
    ], $msgs)]);
}

if (($a = route('POST', 'matchs/*/messages', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $m = accesAuMatch($pdo, $u, (int) $a[0]);
    limite('msg:' . $u['id'], 120, 3600);
    $corps = trim((string) champ('corps', ''));
    if ($corps === '') {
        erreur('message_vide', 'Le message est vide.', 422);
    }
    $pdo->prepare('INSERT INTO messages (match_id, auteur_id, corps, created_at) VALUES (?,?,?,?)')
        ->execute([(int) $m['id'], (int) $u['id'], mb_substr($corps, 0, 4000), maintenant()]);
    if ((int) $m['candidate_id'] === (int) $u['id']) {
        foreach (membresIds($pdo, (int) $m['company_id']) as $x) {
            notifie($x, 'message', ['match' => (int) $m['id']]);
        }
    } else {
        notifie((int) $m['candidate_id'], 'message', ['match' => (int) $m['id']]);
    }
    envoie(['ok' => true], 201);
}

/* Propositions de message pour un match (memes regles que par candidature). */
if (($a = route('GET', 'matchs/*/suggestions', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $m = accesAuMatch($pdo, $u, (int) $a[0]);
    $p = profilComplet($pdo, (int) $m['candidate_id']);
    $garni = garnisOffre($pdo, offreParId($pdo, (int) $m['job_id']));
    $c = candidatPourScore($pdo, (int) $m['candidate_id']);
    $e = $c ? evalue($pdo, $c, $garni) : null;
    envoie(['suggestions' => suggestionsMessages((int) $m['candidate_id'] === (int) $u['id'] ? 'candidat' : 'recruteur', $p, offrePublique($garni), $e)]);
}

/* ============================================================ notifications */

if (route('GET', 'notifications', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $st = $pdo->prepare('SELECT id, type, payload, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50');
    $st->execute([(int) $u['id']]);
    envoie(['notifications' => array_map(static fn ($n) => [
        'id' => (int) $n['id'], 'type' => $n['type'], 'donnees' => json_decode((string) $n['payload'], true),
        'quand' => $n['created_at'], 'lu' => $n['read_at'] !== null,
    ], $st->fetchAll())]);
}

if (route('POST', 'notifications/lu', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $pdo->prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')->execute([maintenant(), (int) $u['id']]);
    envoie(['ok' => true]);
}

/* ============================================================== openapi */

if (route('GET', 'openapi.json', $seg, $methode) !== false) {
    require __DIR__ . '/doc.php';
    envoie(openapi());
}

erreur('route_inconnue', 'Cette route n’existe pas : ' . $methode . ' /' . $chemin, 404);

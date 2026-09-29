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
require __DIR__ . '/equipe.php';

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

/* L'inscription et la connexion sont deleguees a l'API de l'equipe (voir
   equipe.php) : elle seule tient les mots de passe. Ici on ne fait que
   retrouver ou creer la ligne locale a laquelle tout le reste se rattache,
   et ouvrir notre session. */

if (route('POST', 'auth/inscription', $seg, $methode) !== false) {
    limite('inscription:' . empreinteIp(), 10, 3600);
    $email  = mb_strtolower(texte('email', 190, true));
    $mdp    = (string) champ('motdepasse', '');
    $prenom = texte('prenom', 40);
    $nom    = texte('nom', 60);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        erreur('email_invalide', 'Cette adresse e-mail n’est pas valide.', 422);
    }
    if ($prenom === '' || $nom === '') {
        erreur('identite_manquante', 'Le prénom et le nom sont demandés à la création du compte.', 422);
    }
    // Douze caracteres, sans regle de composition : la longueur protege mieux
    // qu'une majuscule obligatoire, et se retient. Leur API en exige huit ;
    // on reste plus strict, c'est compatible.
    if (mb_strlen($mdp) < 12) {
        erreur('mot_de_passe_court', 'Le mot de passe doit faire au moins 12 caractères.', 422);
    }

    /* On demande d'abord a leur API. Creer la ligne locale avant aurait laisse
       un compte orphelin a chaque refus de leur cote. */
    /* Leur `UserResponse` porte l'identifiant du compte chez eux : on le
       garde, c'est un lien qui survivra a un changement d'adresse. */
    $chezEux = equipeInscrit($email, $mdp, $prenom, $nom);
    $u = utilisateurLocal($pdo, $email, $prenom, $nom, (int) ($chezEux['id'] ?? 0));

    trace($u['id'], 'inscription', 'user', $u['id']);
    $t = ouvreSession($u['id']);
    envoie(['jeton' => $t, 'utilisateur' => ['id' => $u['id'], 'email' => $email]], 201);
}

if (route('POST', 'auth/connexion', $seg, $methode) !== false) {
    $email = mb_strtolower(texte('email', 190, true));
    $mdp   = (string) champ('motdepasse', '');
    limite('connexion:' . empreinteIp(), 30, 900);
    limite('connexion:' . substr(hash('sha256', $email), 0, 24), 10, 900);

    /* Leur API repond 401 sans distinguer « compte inconnu » de « mot de passe
       faux » : la precaution qu'on prenait ici (hash factice, temps constant)
       est devenue la leur. */
    equipeConnecte($email, $mdp);

    /* Un compte peut exister chez eux sans exister ici — cree directement sur
       leur API, ou avant que cette application ne lui soit branchee. La
       premiere connexion cree alors sa ligne locale, vide. */
    $u = utilisateurLocal($pdo, $email);

    trace($u['id'], 'connexion', 'user', $u['id']);
    $t = ouvreSession($u['id']);
    envoie(['jeton' => $t, 'utilisateur' => ['id' => $u['id'], 'email' => $email]]);
}

if (route('POST', 'auth/deconnexion', $seg, $methode) !== false) {
    /* Toutes les sessions presentees, et le cookie sur tous ses chemins : se
       deconnecter à moitie, c'est rester connecte. Cette route effaçait
       d'ailleurs le cookie sur /avp/app/ alors que la v2 le pose sur /avp/. */
    foreach (jetons() as $t) {
        if (!str_starts_with($t, 'aj_')) {
            $pdo->prepare('DELETE FROM sessions WHERE token = ?')->execute([$t]);
        }
    }
    effaceCookieSession();
    envoie(['ok' => true]);
}

if (route('GET', 'auth/moi', $seg, $methode) !== false) {
    $u = utilisateur();
    if (!$u) {
        envoie(['utilisateur' => null, 'comptesModifiables' => comptesModifiables()]);
    }
    envoie(['utilisateur' => ['id' => (int) $u['id'], 'email' => $u['email'],
                              'comptesModifiables' => comptesModifiables()],
            'comptesModifiables' => comptesModifiables()]);
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

              'candidatures' => 'SELECT job_id, statut, created_at, updated_at FROM applications WHERE candidate_id = ?',
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
        'UPDATE users SET email = CONCAT("supprime+", id, "@invalide"), equipe_user_id = NULL,
                          status = "anonymise", anonymized_at = ? WHERE id = ?'
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
require __DIR__ . '/avp.php';
require __DIR__ . '/candidatures.php';

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
            /* Le detail memorise avant le 28/09 nomme cette moitie « recruteur ».
               On la rend sous son nom actuel plutot que de reecrire la base. */
            $detail = json_decode((string) $ligne['detail'], true);
            if (is_array($detail) && isset($detail['recruteur']) && !isset($detail['poste'])) {
                $detail = ['poste' => $detail['recruteur']] + $detail;
                unset($detail['recruteur']);
            }
            $o['score'] = [
                'qualite' => (int) $ligne['qualite'], 'poste' => (int) $ligne['fit_recruteur'],
                'candidat' => (int) $ligne['fit_candidat'], 'confiance' => (int) $ligne['confiance'],
                'detail' => $detail,
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

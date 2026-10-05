<?php
/**
 * Adopte un Job — les comptes, tenus par l'API de l'equipe.
 *
 * Le HackAVP decoupe le produit en microservices : l'un d'eux tient les
 * comptes (`POST /auth/register`, `POST /auth/login`). Depuis le 29/09,
 * c'est LUI qui fait autorite — cette application ne stocke plus aucun mot
 * de passe et n'en verifie plus aucun.
 *
 * Ce qui reste ici, c'est la ligne `users` : tout le reste du schema s'y
 * rattache (profil, CV, candidatures, sessions). Elle ne porte plus AUCUN
 * secret — la colonne `pass_hash` a ete supprimee le 29/09 — seulement une
 * adresse, et l'identifiant que leur API nous rend a l'inscription.
 *
 * Elle est retrouvee par l'ADRESSE, apres que leur API a valide les
 * identifiants. `equipe_user_id` est la pour le jour ou ils ouvriront le
 * changement d'adresse : ce jour-la, l'e-mail cessera d'etre un lien fiable.
 *
 * Trois consequences, assumees :
 *   - leur API en panne = personne ne se connecte, meme avec une session
 *     valide en cours (celle-la continue de vivre, seule l'ouverture casse) ;
 *   - ils n'exposent ni changement ni reinitialisation de mot de passe :
 *     ces parcours n'existent plus ici non plus ;
 *   - le mot de passe transite par leur serveur. Il n'est jamais journalise
 *     de notre cote, et n'entre dans aucune trace.
 */

declare(strict_types=1);

/** L'adresse de leur API, ou '' si la configuration la desactive. */
function baseEquipe(): string
{
    $base = defined('EQUIPE_API_BASE') ? EQUIPE_API_BASE : (defined('EQUIPE_API_DEFAUT') ? EQUIPE_API_DEFAUT : '');
    return rtrim((string) $base, '/');
}

/**
 * Traduit leur reponse en erreur lisible, et coupe court.
 * Leur API rend un corps Spring generique (`{timestamp, status, error, path}`)
 * sans detail de champ : on ne peut pas dire mieux que ce qu'on sait.
 */
function echecEquipe(int $code, string $ou): never
{
    if ($code === 0) {
        erreur('service_comptes', 'Le service de comptes de l’équipe ne répond pas. Réessaie dans un instant.', 503);
    }
    if ($code === 401 || $code === 403) {
        erreur('identifiants', 'Adresse ou mot de passe incorrect.', 401);
    }
    if ($code === 409 || $code === 422 || ($code === 400 && $ou === 'register')) {
        erreur('inscription_refusee', 'Le service de comptes a refusé ces informations. Une adresse déjà utilisée, ou un mot de passe trop court (huit caractères au minimum).', 422);
    }
    if ($code === 400) {
        erreur('champs_manquants', 'Adresse et mot de passe sont attendus.', 422);
    }
    erreur('service_comptes', 'Le service de comptes a répondu ' . $code . '.', 502);
}

/**
 * Cree le compte chez eux. Rend leur `UserResponse`.
 * `nom` et `prenom` sont obligatoires de leur cote (leur schema les declare
 * `required`), d'ou leur presence dans notre formulaire d'inscription.
 */
function equipeInscrit(string $email, string $mdp, string $prenom, string $nom): array
{
    $base = baseEquipe();
    if ($base === '') {
        erreur('service_comptes', 'Aucun service de comptes n’est configuré.', 503);
    }
    [$code, $corps] = httpPostJson($base . '/auth/register', [
        'email' => $email, 'password' => $mdp,
        'prenom' => $prenom, 'nom' => $nom, 'role' => 'CANDIDAT',
    ], [], 20);
    if ($code < 200 || $code >= 300) {
        echecEquipe($code, 'register');
    }
    $d = json_decode((string) $corps, true);
    return is_array($d) ? $d : [];
}

/**
 * Verifie les identifiants chez eux. Rend leur `LoginResponse`
 * (`accessToken`, `tokenType`, `expiresIn`).
 *
 * Le jeton n'est pas conserve : aucune route de cette application n'en a
 * besoin, et garder un secret dont on ne se sert pas est un risque sans
 * contrepartie. Il faudra le stocker le jour ou l'on appellera une de leurs
 * routes protegees pour le compte de l'utilisateur.
 */
function equipeConnecte(string $email, string $mdp): array
{
    $base = baseEquipe();
    if ($base === '') {
        erreur('service_comptes', 'Aucun service de comptes n’est configuré.', 503);
    }
    [$code, $corps] = httpPostJson($base . '/auth/login', ['email' => $email, 'password' => $mdp], [], 20);
    if ($code < 200 || $code >= 300) {
        echecEquipe($code, 'login');
    }
    $d = json_decode((string) $corps, true);
    return is_array($d) ? $d : [];
}

/**
 * La ligne `users` qui porte les donnees locales de cette adresse, creee au
 * besoin. Appelee UNIQUEMENT apres que leur API a valide les identifiants :
 * c'est leur reponse qui fait foi, cette fonction ne decide de rien.
 *
 * Elle cree aussi la ligne `candidates` et trace le consentement, comme le
 * faisait l'inscription : un compte qui arrive par la connexion (parce qu'il
 * a ete cree chez eux directement) doit etre aussi complet qu'un autre.
 */
function utilisateurLocal(PDO $pdo, string $email, string $prenom = '', string $nom = '', int $equipeId = 0): array
{
    $st = $pdo->prepare('SELECT id, status, role FROM users WHERE email = ?');
    $st->execute([$email]);
    $u = $st->fetch();

    if ($u) {
        if ($u['status'] !== 'actif') {
            erreur('compte_inactif', 'Ce compte n’est plus actif.', 403);
        }
        /* Il n'y a plus qu'une sorte de compte depuis le retrait du cote
           employeur. Une ligne restee en `recruteur` ouvrirait bien une
           session, mais toutes les routes candidat la refuseraient en 403 :
           on la remet d'aplomb, et on s'assure qu'elle a son profil. */
        if ($u['role'] !== 'candidat') {
            $pdo->prepare('UPDATE users SET role = "candidat" WHERE id = ?')->execute([(int) $u['id']]);
            $pdo->prepare('INSERT IGNORE INTO candidates (user_id, updated_at) VALUES (?,?)')
                ->execute([(int) $u['id'], maintenant()]);
            trace((int) $u['id'], 'role_normalise_candidat', 'user', (int) $u['id']);
        }
        return ['id' => (int) $u['id'], 'email' => $email, 'nouveau' => false];
    }

    $pdo->prepare('INSERT INTO users (email, equipe_user_id, role, created_at) VALUES (?,?,"candidat",?)')
        ->execute([$email, $equipeId > 0 ? $equipeId : null, maintenant()]);
    $id = (int) $pdo->lastInsertId();
    // Les longueurs sont celles du schema (prenom 40, nom 60) : leur API
    // accepte 255, une troncature silencieuse en base vaudrait une erreur.
    $pdo->prepare('INSERT INTO candidates (user_id, prenom, nom, updated_at) VALUES (?,?,?,?)')
        ->execute([$id, mb_substr($prenom, 0, 40), mb_substr($nom, 0, 60), maintenant()]);
    $pdo->prepare('INSERT INTO consents (user_id, finalite, version, accorde, created_at, ip_hash) VALUES (?,?,?,?,?,?)')
        ->execute([$id, 'traitement_candidature', '2026-09', 1, maintenant(), empreinteIp()]);
    trace($id, 'compte_cree_depuis_equipe', 'user', $id);

    return ['id' => $id, 'email' => $email, 'nouveau' => true];
}

/* ---------------------------------------------- changer ce qui est chez eux

   Trois gestes manquent a leur API au 29/09 : changer son mot de passe,
   changer son adresse, et le parcours « mot de passe oublie ». Ils sont
   demandes a l'equipe ; le contrat ci-dessous est celui qui leur a ete
   propose, et ces fonctions l'appliquent deja.

   `COMPTE_ROUTES_EQUIPE` vaut false tant qu'ils n'ont pas livre : les routes
   repondent alors 501, et l'interface affiche pourquoi au lieu d'un
   formulaire qui echouerait.

   Aucun jeton n'est conserve entre deux requetes : chacun de ces gestes exige
   le mot de passe courant de toute facon, on s'en sert pour obtenir un jeton
   frais juste avant l'appel. Un secret qu'on ne garde pas ne fuit pas. */

/** Leur API sait-elle modifier un compte ? Faux tant qu'ils n'ont pas livre. */
function comptesModifiables(): bool
{
    return defined('COMPTE_ROUTES_EQUIPE') && COMPTE_ROUTES_EQUIPE === true && baseEquipe() !== '';
}

/**
 * Leur API traite-t-elle le mot de passe oublie ? Oui depuis le 05/10/2026
 * (`POST /auth/forgot-password`, `POST /auth/reset-password`). Interrupteur a
 * part de `comptesModifiables()` : changer son mot de passe ou son adresse
 * n'existe toujours pas chez eux. Actif par defaut, coupe avec AVP_EQUIPE_OUBLI=0.
 */
function oubliPossible(): bool
{
    return (defined('OUBLI_EQUIPE') ? OUBLI_EQUIPE === true : true) && baseEquipe() !== '';
}

function exigeOubliPossible(): void
{
    if (!oubliPossible()) {
        erreur('non_disponible', 'La réinitialisation du mot de passe n’est pas disponible.', 501);
    }
}

function exigeComptesModifiables(): void
{
    if (!comptesModifiables()) {
        erreur('non_disponible',
            'Le service de comptes de l’équipe n’ouvre pas encore cette action. '
            . 'Elle sera disponible ici sans rien changer d’autre le jour où il l’expose.', 501);
    }
}

/** Un jeton frais, obtenu avec le mot de passe que l'utilisateur vient de saisir. */
function jetonEquipe(string $email, string $mdp): string
{
    $d = equipeConnecte($email, $mdp);
    $t = (string) ($d['accessToken'] ?? '');
    if ($t === '') {
        erreur('service_comptes', 'Le service de comptes n’a pas rendu de jeton.', 502);
    }
    return $t;
}

/** PUT /auth/password — le mot de passe courant est reverifie par eux. */
function equipeChangeMotDePasse(string $email, string $ancien, string $nouveau): void
{
    exigeComptesModifiables();
    $t = jetonEquipe($email, $ancien);
    [$code, ] = httpJson('PUT', baseEquipe() . '/auth/password',
        ['currentPassword' => $ancien, 'newPassword' => $nouveau],
        ['Authorization: Bearer ' . $t], 20);
    if ($code < 200 || $code >= 300) {
        echecEquipe($code, 'password');
    }
}

/** PUT /auth/email — rend la nouvelle adresse telle qu'ils l'ont enregistree. */
function equipeChangeEmail(string $email, string $mdp, string $nouveau): string
{
    exigeComptesModifiables();
    $t = jetonEquipe($email, $mdp);
    [$code, $corps] = httpJson('PUT', baseEquipe() . '/auth/email',
        ['password' => $mdp, 'newEmail' => $nouveau],
        ['Authorization: Bearer ' . $t], 20);
    if ($code < 200 || $code >= 300) {
        echecEquipe($code, 'email');
    }
    $d = json_decode((string) $corps, true);
    return mb_strtolower((string) (is_array($d) ? ($d['email'] ?? $nouveau) : $nouveau));
}

/** POST /auth/forgot-password — reponse identique que l'adresse existe ou non. */
function equipeOubli(string $email): void
{
    exigeOubliPossible();
    [$code, ] = httpPostJson(baseEquipe() . '/auth/forgot-password', ['email' => $email], [], 20);
    // Un 404 chez eux voudrait dire « adresse inconnue » : on ne le repercute
    // pas, sinon cette route publie la liste des comptes.
    if ($code >= 500 || $code === 0) {
        echecEquipe($code, 'forgot');
    }
}

/** POST /auth/reset-password — le code recu par courriel, et le nouveau mot de passe. */
function equipeReinit(string $code, string $nouveau): void
{
    exigeOubliPossible();
    // leur ResetPasswordRequest : {token, password} (et non newPassword : 400)
    [$http, ] = httpPostJson(baseEquipe() . '/auth/reset-password',
        ['token' => $code, 'password' => $nouveau], [], 20);
    if ($http < 200 || $http >= 300) {
        erreur('code_invalide', 'Ce code est inconnu, expiré ou déjà utilisé.', 422);
    }
}

/* ======================================== synchronisation des candidatures
   Depuis le 05/10/2026, leur API porte le cycle de candidature : le candidat
   depose son profil (PUT /profils/moi), un like sur un AVP cree une
   candidature EN_ATTENTE, un recruteur (AVPRO-NC) la passe en VALIDEE ou
   REJETEE. Cette application reste le cote candidat : elle leur envoie le
   profil et les swipes, et affiche la decision. Elle ne decide de rien.

   Leurs routes candidat exigent le jeton de l'utilisateur (JWT, 1 h). Il est
   garde ici, chiffre, dans la ligne de session : il meurt avec elle. Passe
   l'heure, rien ne casse : ce qui n'a pas pu partir est marque, et repart a
   la reconnexion suivante (synchroniseEquipe).

   Aucune de ces fonctions n'echoue a voix haute : leur API arretee ne doit
   jamais empecher de se connecter, d'enregistrer un profil ou de swiper. */

/** La cle du jeton : derivee de la cle des CV, pour ne pas reutiliser la meme. */
function cleJetonEquipe(): string
{
    return strlen(CV_CLE) === 64 ? hash_hmac('sha256', 'jeton-equipe', hex2bin(CV_CLE), true) : '';
}

/** Range leur jeton (LoginResponse) dans la session donnee. */
function gardeJetonEquipe(PDO $pdo, string $session, array $login): void
{
    $jwt = (string) ($login['accessToken'] ?? '');
    $cle = cleJetonEquipe();
    if ($jwt === '' || $cle === '' || $session === '') {
        return;
    }
    $iv = random_bytes(12);
    $tag = '';
    $c = openssl_encrypt($jwt, 'aes-256-gcm', $cle, OPENSSL_RAW_DATA, $iv, $tag);
    if ($c === false) {
        return;
    }
    // expiresIn : en secondes (au-dela de deux jours, ce seraient des millisecondes)
    $ei = (int) ($login['expiresIn'] ?? 3600);
    $s = $ei > 172800 ? intdiv($ei, 1000) : $ei;
    try {
        $pdo->prepare('UPDATE sessions SET equipe_jeton = ?, equipe_iv = ?, equipe_tag = ?, equipe_expire = ? WHERE token = ?')
            ->execute([base64_encode($c), bin2hex($iv), bin2hex($tag), gmdate('Y-m-d H:i:s', time() + max(60, $s) - 60), $session]);
    } catch (PDOException $e) {
        // migration 008 pas encore appliquee : la synchro attendra
    }
}

/** Leur jeton pour la session courante, s'il est encore valable. */
function jetonEquipeSession(PDO $pdo): ?string
{
    $cle = cleJetonEquipe();
    if ($cle === '' || baseEquipe() === '') {
        return null;
    }
    try {
        $st = $pdo->prepare('SELECT equipe_jeton, equipe_iv, equipe_tag FROM sessions WHERE token = ? AND equipe_expire > ?');
        $st->execute([jeton(), maintenant()]);
        $r = $st->fetch();
    } catch (PDOException $e) {
        return null;
    }
    if (!$r || !$r['equipe_jeton']) {
        return null;
    }
    $jwt = openssl_decrypt((string) base64_decode((string) $r['equipe_jeton']), 'aes-256-gcm', $cle,
        OPENSSL_RAW_DATA, hex2bin((string) $r['equipe_iv']), hex2bin((string) $r['equipe_tag']));
    return $jwt === false ? null : $jwt;
}

/** Oublie leur jeton de la session courante (refuse par eux : 401). */
function oublieJetonEquipe(PDO $pdo): void
{
    try {
        $pdo->prepare('UPDATE sessions SET equipe_jeton = NULL, equipe_iv = NULL, equipe_tag = NULL, equipe_expire = NULL WHERE token = ?')
            ->execute([jeton()]);
    } catch (PDOException $e) {
    }
}

/** Un appel a leur API pour le compte de l'utilisateur. Rend [code, corps decode]. */
function appelEquipe(string $methode, string $chemin, string $jwt, ?array $corps = null, int $timeout = 10): array
{
    if (!function_exists('curl_init')) {
        return [0, null];
    }
    $ch = curl_init(baseEquipe() . $chemin);
    $entetes = ['Accept: application/json', 'User-Agent: adopte-un-job/1.0', 'Authorization: Bearer ' . $jwt];
    $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $methode, CURLOPT_CONNECTTIMEOUT => 6,
             CURLOPT_TIMEOUT => $timeout, CURLOPT_SSL_VERIFYPEER => !SSL_INSECURE];
    if ($corps !== null) {
        $entetes[] = 'Content-Type: application/json';
        $opts[CURLOPT_POSTFIELDS] = json_encode($corps === [] ? new stdClass() : $corps, JSON_UNESCAPED_UNICODE);
    }
    $opts[CURLOPT_HTTPHEADER] = $entetes;
    curl_setopt_array($ch, $opts);
    $r = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($r === false) {
        return [0, null];
    }
    $d = json_decode((string) $r, true);
    return [$code, is_array($d) ? $d : null];
}

/** Leur identifiant d'AVP pour une offre d'ici. La cle commune est la reference OPT. */
function avpIdEquipe(array $job): ?int
{
    // 1. memorise a la synchronisation (jobPostingDepuisEquipe : source_equipe.id)
    $pile = [json_decode((string) ($job['json_data'] ?? ''), true)];
    while ($pile) {
        $x = array_pop($pile);
        if (!is_array($x)) {
            continue;
        }
        foreach ($x as $k => $v) {
            if ($k === 'source_equipe' && is_array($v) && !empty($v['id'])) {
                return (int) $v['id'];
            }
            if (is_array($v)) {
                $pile[] = $v;
            }
        }
    }
    // 2. sinon, leur catalogue public, une fois par requete
    static $carte = null;
    if ($carte === null) {
        $carte = [];
        foreach (avpDepuisEquipe() ?? [] as $a) {
            if (isset($a['reference'], $a['id'])) {
                $carte[(string) $a['reference']] = (int) $a['id'];
            }
        }
    }
    return $carte[(string) ($job['external_id'] ?? '')] ?? null;
}

/** Leur connexion, sans jamais echouer : [] si elle n'aboutit pas. */
function loginEquipeSilencieux(string $email, string $mdp): array
{
    if (baseEquipe() === '') {
        return [];
    }
    [$code, $corps] = httpPostJson(baseEquipe() . '/auth/login', ['email' => $email, 'password' => $mdp], [], 15);
    $d = json_decode((string) $corps, true);
    return ($code >= 200 && $code < 300 && is_array($d)) ? $d : [];
}

/**
 * Apres un enregistrement de profil : le profil est marque « a renvoyer »,
 * et part tout de suite si le dernier envoi date de plus de 30 s. L'ecran de
 * profil enregistre a chaque pause de frappe : sans ce frein, chaque mot
 * deviendrait un appel a leur API. Ce qui n'est pas parti part a la
 * synchronisation suivante.
 */
function profilModifieEquipe(PDO $pdo, int $userId): void
{
    try {
        $st = $pdo->prepare('SELECT equipe_profil_le FROM candidates WHERE user_id = ?');
        $st->execute([$userId]);
        $dernier = $st->fetchColumn();
        $pdo->prepare('UPDATE candidates SET equipe_profil_le = NULL WHERE user_id = ?')->execute([$userId]);
    } catch (PDOException $e) {
        return;
    }
    if ($dernier && strtotime($dernier . ' UTC') > time() - 30) {
        return;
    }
    $jwt = jetonEquipeSession($pdo);
    if ($jwt !== null) {
        envoieProfilEquipe($pdo, $userId, $jwt);
    }
}

/** PUT /profils/moi : le profil, au format JSON Resume. */
function envoieProfilEquipe(PDO $pdo, int $userId, string $jwt): bool
{
    require_once __DIR__ . '/documents.php';
    $st = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $st->execute([$userId]);
    $doc = jsonResume(profilComplet($pdo, $userId), (string) $st->fetchColumn());
    [$code, ] = appelEquipe('PUT', '/profils/moi', $jwt, $doc, 15);
    if ($code === 401) {
        oublieJetonEquipe($pdo);
    }
    if ($code >= 200 && $code < 300) {
        try {
            $pdo->prepare('UPDATE candidates SET equipe_profil_le = ? WHERE user_id = ?')->execute([maintenant(), $userId]);
        } catch (PDOException $e) {
        }
        return true;
    }
    return false;
}

/**
 * Le swipe chez eux : like = candidature EN_ATTENTE, dislike = ANNULEE.
 * Rend leur code HTTP (0 : pas parti). 409 = deja tranchee par un recruteur,
 * 400 = date limite passee, 403 = pas de profil chez eux.
 */
function envoieSwipeEquipe(PDO $pdo, int $userId, array $job, bool $like, string $jwt): int
{
    $avp = avpIdEquipe($job);
    if ($avp === null) {
        return 0;
    }
    [$code, ] = appelEquipe('PUT', '/swipes/candidats/avp/' . $avp, $jwt, ['estLike' => $like]);
    if ($code === 403 && envoieProfilEquipe($pdo, $userId, $jwt)) {
        // pas encore de profil chez eux : il vient de partir, on reessaie
        [$code, ] = appelEquipe('PUT', '/swipes/candidats/avp/' . $avp, $jwt, ['estLike' => $like]);
    }
    if ($code === 401) {
        oublieJetonEquipe($pdo);
        return $code;
    }
    if (($code >= 200 && $code < 300) || $code === 409) {
        try {
            if ($like) {
                $pdo->prepare('UPDATE applications SET equipe_envoi_le = ? WHERE job_id = ? AND candidate_id = ?')
                    ->execute([maintenant(), (int) $job['id'], $userId]);
            } else {
                $pdo->prepare('UPDATE applications SET equipe_envoi_le = ?, equipe_statut = "ANNULEE", equipe_statut_le = ? WHERE job_id = ? AND candidate_id = ?')
                    ->execute([maintenant(), maintenant(), (int) $job['id'], $userId]);
            }
        } catch (PDOException $e) {
        }
    }
    return $code;
}

/** GET /candidatures/moi : les statuts decides chez eux, rapportes sur les candidatures d'ici. */
function lisStatutsEquipe(PDO $pdo, int $userId, string $jwt): bool
{
    $statuts = [];
    for ($page = 1, $pages = 1; $page <= $pages && $page <= 20; $page++) {
        [$code, $d] = appelEquipe('GET', '/candidatures/moi?page=' . $page . '&taille=100', $jwt);
        if ($code === 401) {
            oublieJetonEquipe($pdo);
            return false;
        }
        if ($code !== 200 || !is_array($d)) {
            return false;
        }
        foreach ((array) ($d['contenu'] ?? []) as $c) {
            if (isset($c['avpReference'], $c['statut'])) {
                $statuts[(string) $c['avpReference']] = (string) $c['statut'];
            }
        }
        $pages = max(1, (int) ($d['totalPages'] ?? 1));
    }
    try {
        $maj = $pdo->prepare('UPDATE applications a JOIN jobs j ON j.id = a.job_id
                                 SET a.equipe_statut = ?, a.equipe_statut_le = ?
                               WHERE a.candidate_id = ? AND j.external_id = ?');
        foreach ($statuts as $ref => $s) {
            if (in_array($s, ['EN_ATTENTE', 'VALIDEE', 'REJETEE', 'ANNULEE'], true)) {
                $maj->execute([$s, maintenant(), $userId, $ref]);
            }
        }
    } catch (PDOException $e) {
        return false;
    }
    return true;
}

/**
 * Rattrapage : le profil s'il n'est jamais parti, les candidatures restees en
 * route, les retraits pas encore transmis, puis les statuts. Borne a 25 envois.
 * Rend true si leur jeton est disponible (la synchro a pu se faire).
 */
function synchroniseEquipe(PDO $pdo, int $userId, bool $statuts = true): bool
{
    $jwt = jetonEquipeSession($pdo);
    if ($jwt === null) {
        return false;
    }
    try {
        $st = $pdo->prepare('SELECT equipe_profil_le FROM candidates WHERE user_id = ?');
        $st->execute([$userId]);
        if ($st->fetchColumn() === null) {
            envoieProfilEquipe($pdo, $userId, $jwt);
        }
        $st = $pdo->prepare(
            'SELECT a.statut AS a_statut, a.equipe_envoi_le, a.equipe_statut, j.* FROM applications a JOIN jobs j ON j.id = a.job_id
              WHERE a.candidate_id = ? AND (
                    (a.statut IN ("envoyee","vue") AND a.equipe_envoi_le IS NULL)
                 OR (a.statut = "retiree" AND a.equipe_envoi_le IS NOT NULL AND (a.equipe_statut IS NULL OR a.equipe_statut = "EN_ATTENTE")))
              LIMIT 25'
        );
        $st->execute([$userId]);
        foreach ($st->fetchAll() as $r) {
            $like = $r['a_statut'] !== 'retiree';
            if ($like && $r['expires_at'] !== null && $r['expires_at'] <= maintenant()) {
                continue;                       // offre expiree : refusee chez eux (400)
            }
            if (envoieSwipeEquipe($pdo, $userId, $r, $like, $jwt) === 401) {
                return false;
            }
        }
    } catch (PDOException $e) {
        return false;
    }
    if ($statuts) {
        lisStatutsEquipe($pdo, $userId, $jwt);
    }
    return true;
}

/**
 * Avant l'anonymisation d'un compte : chez eux, rien ne se supprime (aucune
 * route DELETE). On vide au moins le profil et on annule les candidatures en
 * attente. Leur compte, lui, subsiste : a leur demander.
 */
function effaceChezEquipe(PDO $pdo, int $userId): void
{
    $jwt = jetonEquipeSession($pdo);
    if ($jwt === null) {
        return;
    }
    appelEquipe('PUT', '/profils/moi', $jwt, []);
    try {
        $st = $pdo->prepare('SELECT j.* FROM applications a JOIN jobs j ON j.id = a.job_id
                              WHERE a.candidate_id = ? AND a.equipe_envoi_le IS NOT NULL
                                AND (a.equipe_statut IS NULL OR a.equipe_statut = "EN_ATTENTE") LIMIT 50');
        $st->execute([$userId]);
        foreach ($st->fetchAll() as $j) {
            envoieSwipeEquipe($pdo, $userId, $j, false, $jwt);
        }
    } catch (PDOException $e) {
    }
}

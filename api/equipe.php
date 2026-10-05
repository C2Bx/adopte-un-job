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

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
 * rattache (profil, CV, candidatures, sessions). Elle est cree ou retrouvee
 * par l'ADRESSE, apres que leur API a valide les identifiants ; sa colonne
 * `pass_hash` reste vide, et une chaine vide ne peut correspondre a aucun
 * mot de passe.
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
function utilisateurLocal(PDO $pdo, string $email, string $prenom = '', string $nom = ''): array
{
    $st = $pdo->prepare('SELECT id, status FROM users WHERE email = ?');
    $st->execute([$email]);
    $u = $st->fetch();

    if ($u) {
        if ($u['status'] !== 'actif') {
            erreur('compte_inactif', 'Ce compte n’est plus actif.', 403);
        }
        return ['id' => (int) $u['id'], 'email' => $email, 'nouveau' => false];
    }

    $pdo->prepare('INSERT INTO users (email, pass_hash, role, created_at) VALUES (?,"","candidat",?)')
        ->execute([$email, maintenant()]);
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

<?php
/**
 * Adopte un Job — le compte, au-dela de la connexion : cles d'API, sessions.
 *
 * Le mot de passe et l'adresse ne sont plus a nous depuis le 29/09 : c'est
 * l'API de l'equipe qui les tient (voir equipe.php). Changer son mot de
 * passe, le reinitialiser, verifier son adresse — ces parcours n'existent
 * plus ici, et leur API ne les expose pas encore. Les remettre ici
 * reviendrait a tenir un deuxieme mot de passe, donc a en avoir deux.
 */

declare(strict_types=1);

/* ------------------------------------------------- le compte, chez l'equipe

   Ces quatre routes ne font que relayer : c'est leur service qui detient le
   mot de passe et l'adresse. Tant qu'il n'expose pas ces gestes, elles
   repondent 501 et l'interface le dit — cf. equipe.php. */

/* Changer son mot de passe, connecte : l'ancien est exige, et c'est eux qui
   le reverifient. Les autres sessions tombent : on change un mot de passe
   parce qu'on doute de quelqu'un. */
if (route('PUT', 'auth/motdepasse', $seg, $methode) !== false) {
    $u = exigeConnexion();
    limite('mdp:' . $u['id'], 5, 3600);
    $nouveau = (string) champ('nouveau', '');
    if (mb_strlen($nouveau) < 12) {
        erreur('mot_de_passe_court', 'Le mot de passe doit faire au moins 12 caractères.', 422);
    }
    equipeChangeMotDePasse((string) $u['email'], (string) champ('ancien', ''), $nouveau);
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?')->execute([(int) $u['id'], jeton()]);
    trace((int) $u['id'], 'changement_mot_de_passe', 'user', (int) $u['id']);
    envoie(['ok' => true]);
}

/* Changer son adresse. Elle est la cle qui relie le compte local au leur :
   elle ne bouge ici qu'une fois qu'elle a bouge chez eux. */
if (route('PUT', 'auth/email', $seg, $methode) !== false) {
    $u = exigeConnexion();
    limite('email:' . $u['id'], 5, 3600);
    $nouveau = mb_strtolower(texte('email', 190, true));
    if (!filter_var($nouveau, FILTER_VALIDATE_EMAIL)) {
        erreur('email_invalide', 'Cette adresse e-mail n’est pas valide.', 422);
    }
    $st = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
    $st->execute([$nouveau, (int) $u['id']]);
    if ($st->fetch()) {
        erreur('email_pris', 'Un compte existe déjà avec cette adresse.', 409);
    }
    $retenu = equipeChangeEmail((string) $u['email'], (string) champ('motdepasse', ''), $nouveau);
    $pdo->prepare('UPDATE users SET email = ? WHERE id = ?')->execute([$retenu, (int) $u['id']]);
    trace((int) $u['id'], 'changement_email', 'user', (int) $u['id']);
    envoie(['ok' => true, 'email' => $retenu]);
}

/* Mot de passe oublie. Meme reponse que l'adresse existe ou non : dire
   « inconnue » revient a publier la liste des comptes. */
if (route('POST', 'auth/oubli', $seg, $methode) !== false) {
    limite('oubli:' . empreinteIp(), 5, 3600);
    equipeOubli(mb_strtolower(texte('email', 190, true)));
    envoie(['ok' => true, 'message' => 'Si cette adresse a un compte, un code lui est envoyé.']);
}

if (route('POST', 'auth/oubli/confirme', $seg, $methode) !== false) {
    limite('oublic:' . empreinteIp(), 10, 3600);
    $mdp = (string) champ('motdepasse', '');
    if (mb_strlen($mdp) < 12) {
        erreur('mot_de_passe_court', 'Le mot de passe doit faire au moins 12 caractères.', 422);
    }
    equipeReinit((string) champ('code', ''), $mdp);
    envoie(['ok' => true, 'message' => 'Mot de passe changé. Connecte-toi.']);
}

/* Les sessions ouvertes, et de quoi fermer les autres. */
if (route('GET', 'auth/sessions', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $st = $pdo->prepare('SELECT token, created_at, last_seen, expires_at FROM sessions WHERE user_id = ? ORDER BY last_seen DESC');
    $st->execute([(int) $u['id']]);
    $moi = jeton();
    envoie(['sessions' => array_map(static fn ($s) => [
        'courante' => $s['token'] === $moi, 'ouverte' => $s['created_at'], 'active' => $s['last_seen'], 'expire' => $s['expires_at'],
    ], $st->fetchAll())]);
}

if (route('DELETE', 'auth/sessions', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?')->execute([(int) $u['id'], jeton()]);
    trace((int) $u['id'], 'fermeture_sessions', 'user', (int) $u['id']);
    envoie(['ok' => true]);
}

/* ------------------------------------------------------------ cles d'API */

if (route('GET', 'cles', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $st = $pdo->prepare('SELECT id, nom, prefixe, created_at, last_used_at FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY id');
    $st->execute([(int) $u['id']]);
    envoie(['cles' => array_map(static fn ($k) => ['id' => (int) $k['id'], 'nom' => $k['nom'], 'prefixe' => $k['prefixe'], 'creee' => $k['created_at'], 'utilisee' => $k['last_used_at']], $st->fetchAll())]);
}

/* Le secret n'est rendu qu'ici, une fois. Il n'est jamais relu. */
if (route('POST', 'cles', $seg, $methode) !== false) {
    $u = exigeConnexion();
    if (str_starts_with(jeton(), 'aj_')) {
        erreur('interdit', 'Une clé d’API ne crée pas de clé d’API.', 403);
    }
    limite('cles:' . $u['id'], 10, 86400);
    $k = creeCleApi((int) $u['id'], texte('nom', 80) ?: 'Intégration');
    trace((int) $u['id'], 'creation_cle_api', 'api_key', $k['id']);
    envoie(['cle' => $k, 'message' => 'Copie la clé maintenant : elle ne sera plus affichée.'], 201);
}

if (($a = route('DELETE', 'cles/*', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $pdo->prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ?')->execute([maintenant(), (int) $a[0], (int) $u['id']]);
    trace((int) $u['id'], 'revocation_cle_api', 'api_key', (int) $a[0]);
    envoie(['ok' => true]);
}

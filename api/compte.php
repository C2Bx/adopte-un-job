<?php
/**
 * Adopte un Job — le compte, au-dela de l'inscription : verification de
 * l'adresse, mot de passe oublie, cles d'API, sessions.
 *
 * Les e-mails de ces parcours sont mis en file, pas envoyes : le jeton de
 * verification et le lien de reinitialisation existent, un expediteur les
 * portera. En attendant, un compte non verifie reste utilisable — seul
 * l'envoi d'une candidature par e-mail (a venir) l'exigera.
 */

declare(strict_types=1);

/* Demande de reinitialisation. Meme reponse que l'adresse existe ou non :
   dire « inconnue » revient a publier la liste des comptes. */
if (route('POST', 'auth/reinit', $seg, $methode) !== false) {
    limite('reinit:' . empreinteIp(), 5, 3600);
    $email = mb_strtolower(texte('email', 190, true));
    $st = $pdo->prepare('SELECT id FROM users WHERE email = ? AND status = "actif"');
    $st->execute([$email]);
    $uid = $st->fetchColumn();
    if ($uid !== false) {
        [$clair, $hash] = jetonUnique();
        $pdo->prepare('INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)')
            ->execute([$hash, (int) $uid, gmdate('Y-m-d H:i:s', time() + 3600), maintenant()]);
        enfileMail((int) $uid, $email, 'Réinitialiser votre mot de passe — Adopte un Job',
            "Pour choisir un nouveau mot de passe, ouvrez l’application et saisissez ce code (valable une heure) : $clair");
        trace((int) $uid, 'demande_reinit', 'user', (int) $uid);
    }
    envoie(['ok' => true, 'message' => 'Si cette adresse a un compte, un code de réinitialisation lui est envoyé.']);
}

if (route('POST', 'auth/reinit/confirme', $seg, $methode) !== false) {
    limite('reinitc:' . empreinteIp(), 10, 3600);
    $code = (string) champ('code', '');
    $mdp = (string) champ('motdepasse', '');
    if (!preg_match('/^[a-f0-9]{64}$/', $code)) {
        erreur('code_invalide', 'Ce code n’est pas valide.', 422);
    }
    if (mb_strlen($mdp) < 12) {
        erreur('mot_de_passe_court', 'Le mot de passe doit faire au moins 12 caractères.', 422);
    }
    $st = $pdo->prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?');
    $st->execute([hash('sha256', $code), maintenant()]);
    $r = $st->fetch();
    if (!$r) {
        erreur('code_invalide', 'Ce code est expiré ou déjà utilisé.', 422);
    }
    $algo = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
    $pdo->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($mdp, $algo), (int) $r['user_id']]);
    $pdo->prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?')->execute([maintenant(), $r['token_hash']]);
    // toutes les sessions tombent : un mot de passe change parce qu'on doute
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([(int) $r['user_id']]);
    trace((int) $r['user_id'], 'reinit_mot_de_passe', 'user', (int) $r['user_id']);
    envoie(['ok' => true, 'message' => 'Mot de passe changé. Reconnecte-toi.']);
}

/* Verification de l'adresse : le jeton est cree a l'inscription et mis en
   file ; cette route le consomme. */
if (route('POST', 'auth/verification', $seg, $methode) !== false) {
    limite('verif:' . empreinteIp(), 20, 3600);
    $code = (string) champ('code', '');
    if (!preg_match('/^[a-f0-9]{64}$/', $code)) {
        erreur('code_invalide', 'Ce code n’est pas valide.', 422);
    }
    $st = $pdo->prepare('SELECT id FROM users WHERE verify_hash = ? AND email_verified_at IS NULL');
    $st->execute([hash('sha256', $code)]);
    $uid = $st->fetchColumn();
    if ($uid === false) {
        erreur('code_invalide', 'Ce code est inconnu ou déjà utilisé.', 422);
    }
    $pdo->prepare('UPDATE users SET email_verified_at = ?, verify_hash = NULL WHERE id = ?')->execute([maintenant(), (int) $uid]);
    trace((int) $uid, 'email_verifie', 'user', (int) $uid);
    envoie(['ok' => true]);
}

if (route('POST', 'auth/verification/renvoi', $seg, $methode) !== false) {
    $u = exigeConnexion();
    limite('verifr:' . $u['id'], 3, 3600);
    [$clair, $hash] = jetonUnique();
    $pdo->prepare('UPDATE users SET verify_hash = ? WHERE id = ? AND email_verified_at IS NULL')->execute([$hash, (int) $u['id']]);
    enfileMail((int) $u['id'], $u['email'], 'Vérifiez votre adresse — Adopte un Job', "Code de vérification : $clair");
    envoie(['ok' => true]);
}

/* Changer son mot de passe, connecte : l'ancien est exige. */
if (route('PUT', 'auth/motdepasse', $seg, $methode) !== false) {
    $u = exigeConnexion();
    limite('mdp:' . $u['id'], 5, 3600);
    $st = $pdo->prepare('SELECT pass_hash FROM users WHERE id = ?');
    $st->execute([(int) $u['id']]);
    if (!password_verify((string) champ('ancien', ''), (string) $st->fetchColumn())) {
        erreur('identifiants', 'L’ancien mot de passe est incorrect.', 401);
    }
    $mdp = (string) champ('nouveau', '');
    if (mb_strlen($mdp) < 12) {
        erreur('mot_de_passe_court', 'Le mot de passe doit faire au moins 12 caractères.', 422);
    }
    $algo = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
    $pdo->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($mdp, $algo), (int) $u['id']]);
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?')->execute([(int) $u['id'], jeton()]);
    trace((int) $u['id'], 'changement_mot_de_passe', 'user', (int) $u['id']);
    envoie(['ok' => true]);
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

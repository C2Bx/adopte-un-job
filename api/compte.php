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

<?php
/**
 * Adopte un Job — securite transversale : en-tetes, origine, limite de debit,
 * cles d'API, fichiers chiffres, file d'e-mails.
 *
 * Tout ce qui est ici s'applique avant les routes. Une regle de securite qui
 * depend d'une route est une regle qu'une route oubliera.
 */

declare(strict_types=1);

/* ------------------------------------------------------------- en-tetes */

/** En-tetes de reponse poses sur chaque appel, y compris les erreurs. */
function entetesSecurite(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    if (($_SERVER['HTTPS'] ?? '') !== '' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
        header('Strict-Transport-Security: max-age=15552000');
    }
    // Une reponse JSON n'a pas de script a executer : la CSP le dit, au cas ou
    // un navigateur la rendrait quand meme.
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
}

/**
 * CORS : seules les origines listees recoivent des identifiants. Jamais « * »
 * avec credentials — le navigateur le refuse, et ce serait de toute facon la
 * porte ouverte a n'importe quel site.
 */
function cors(): void
{
    $o = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($o !== '' && in_array($o, ORIGINES, true)) {
        header('Access-Control-Allow-Origin: ' . $o);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Sync-Token');
        header('Access-Control-Max-Age: 600');
        header('Vary: Origin');
    }
}

/**
 * Une ecriture venue d'un autre site est refusee, meme avec un cookie valide.
 * SameSite=Lax protege deja le navigateur ; ceci protege aussi contre un
 * jeton rejoue depuis une page tierce, et ne coute rien.
 */
function exigeOrigineSure(string $methode): void
{
    if (in_array($methode, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return;
    }
    $o = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($o === '') {
        // Pas d'en-tete Origin : un client natif ou un script. Sec-Fetch-Site,
        // s'il est la, doit confirmer que ce n'est pas un site tiers.
        $sfs = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
        if ($sfs === 'cross-site') {
            erreur('origine_refusee', 'Requête inter-sites refusée.', 403);
        }
        return;
    }
    if (!in_array($o, ORIGINES, true)) {
        erreur('origine_refusee', 'Cette origine n’est pas autorisée à écrire.', 403);
    }
}

/* ------------------------------------------------------- limite de debit */

/**
 * Compte les appels d'une cle sur une fenetre glissante approchee (fenetre
 * fixe reinitialisee a l'expiration). Suffisant pour freiner une force brute
 * ou une boucle ; un attaquant distribue passe, et ce n'est pas le sujet ici.
 */
function limite(string $cle, int $max, int $fenetreSec): void
{
    $pdo = db();
    $cle = substr($cle, 0, 120);
    $now = time();
    try {
        $st = $pdo->prepare('SELECT fenetre_debut, n FROM rate_limits WHERE cle = ?');
        $st->execute([$cle]);
        $r = $st->fetch();
        if (!$r || strtotime($r['fenetre_debut'] . ' UTC') + $fenetreSec <= $now) {
            $pdo->prepare('REPLACE INTO rate_limits (cle, fenetre_debut, n) VALUES (?,?,1)')
                ->execute([$cle, gmdate('Y-m-d H:i:s', $now)]);
            return;
        }
        if ((int) $r['n'] >= $max) {
            $attente = strtotime($r['fenetre_debut'] . ' UTC') + $fenetreSec - $now;
            header('Retry-After: ' . max(1, $attente));
            erreur('trop_de_requetes', 'Trop de tentatives. Réessaie dans ' . max(1, (int) ceil($attente / 60)) . ' min.', 429);
        }
        $pdo->prepare('UPDATE rate_limits SET n = n + 1 WHERE cle = ?')->execute([$cle]);
    } catch (PDOException) {
        // La table manque (migration non passee) : on ne bloque pas le service.
    }
}

/** Limite globale par appelant : jeton s'il y en a un, sinon l'empreinte IP. */
function limiteGlobale(): void
{
    $t = jeton();
    limite('g:' . ($t !== '' ? substr(hash('sha256', $t), 0, 32) : 'ip:' . empreinteIp()), 240, 60);
}

/* ------------------------------------------------------------ cles d'API */

/**
 * Une cle d'API tierce : « aj_<prefixe>.<secret> ». Le secret n'est jamais en
 * base ; on compare l'empreinte. Rend l'utilisateur proprietaire, ou null.
 */
function utilisateurParCleApi(string $brut): ?array
{
    if (!preg_match('/^aj_([a-f0-9]{8})\.([a-f0-9]{40})$/', $brut, $m)) {
        return null;
    }
    $st = db()->prepare(
        'SELECT k.id, k.hash, u.id AS uid, u.email, u.role, u.status
           FROM api_keys k JOIN users u ON u.id = k.user_id
          WHERE k.prefixe = ? AND k.revoked_at IS NULL'
    );
    $st->execute([$m[1]]);
    $k = $st->fetch();
    if (!$k || !hash_equals($k['hash'], hash('sha256', $brut)) || $k['status'] !== 'actif') {
        return null;
    }
    db()->prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')->execute([maintenant(), $k['id']]);
    return ['id' => (int) $k['uid'], 'email' => $k['email'], 'role' => $k['role'], 'status' => $k['status'], 'token' => null];
}

/** Cree une cle pour l'utilisateur ; le secret n'est montre qu'une fois. */
function creeCleApi(int $userId, string $nom): array
{
    $prefixe = bin2hex(random_bytes(4));
    $secret  = bin2hex(random_bytes(20));
    $brut = "aj_$prefixe.$secret";
    db()->prepare('INSERT INTO api_keys (user_id, nom, prefixe, hash, created_at) VALUES (?,?,?,?,?)')
        ->execute([$userId, mb_substr($nom, 0, 80), $prefixe, hash('sha256', $brut), maintenant()]);
    return ['id' => (int) db()->lastInsertId(), 'nom' => $nom, 'prefixe' => $prefixe, 'cle' => $brut];
}

/* ------------------------------------------------------ fichiers chiffres */

function dossierFichiers(): string
{
    $d = FICHIERS_DIR;
    if (!is_dir($d)) {
        @mkdir($d, 0700, true);
    }
    if (!is_dir($d) || !is_writable($d)) {
        erreur('stockage_indisponible', 'Le stockage des fichiers n’est pas disponible.', 503);
    }
    return $d;
}

/** Ecrit un blob chiffre (AES-256-GCM). Rend [cle de stockage, iv, tag]. */
function rangeFichier(string $contenu): array
{
    if (strlen(CV_CLE) !== 64) {
        erreur('chiffrement_absent', 'La clé de chiffrement des fichiers n’est pas configurée.', 503);
    }
    $iv  = random_bytes(16);
    $tag = '';
    $chiffre = openssl_encrypt($contenu, 'aes-256-gcm', hex2bin(CV_CLE), OPENSSL_RAW_DATA, $iv, $tag);
    if ($chiffre === false) {
        erreur('chiffrement', 'Le fichier n’a pas pu être chiffré.', 500);
    }
    $nom = bin2hex(random_bytes(20)) . '.bin';
    if (file_put_contents(dossierFichiers() . '/' . $nom, $chiffre, LOCK_EX) === false) {
        erreur('stockage', 'Le fichier n’a pas pu être écrit.', 500);
    }
    return [$nom, bin2hex($iv), bin2hex($tag)];
}

function litFichier(string $cle, string $ivHex, string $tagHex): ?string
{
    if (!preg_match('/^[a-f0-9]{40}\.bin$/', $cle)) {
        return null;
    }
    $chemin = dossierFichiers() . '/' . $cle;
    if (!is_file($chemin)) {
        return null;
    }
    $clair = openssl_decrypt((string) file_get_contents($chemin), 'aes-256-gcm', hex2bin(CV_CLE),
        OPENSSL_RAW_DATA, hex2bin($ivHex), hex2bin($tagHex));
    return $clair === false ? null : $clair;
}

function supprimeFichier(?string $cle): void
{
    if ($cle && preg_match('/^[a-f0-9]{40}\.bin$/', $cle)) {
        @unlink(dossierFichiers() . '/' . $cle);
    }
}

/* ------------------------------------------------------------- e-mails */

/**
 * Met un e-mail en file. RIEN NE PART : la file existe pour qu'un expediteur
 * (Brevo, SMTP) puisse etre branche sans toucher aux routes. Chaque appel
 * documente ce qui serait envoye, a qui, et avec quelle piece.
 */
function enfileMail(?int $userId, string $destinataire, string $sujet, string $corps, ?string $pieceType = null, ?int $pieceId = null): void
{
    if (!filter_var($destinataire, FILTER_VALIDATE_EMAIL)) {
        return;
    }
    try {
        db()->prepare(
            'INSERT INTO email_queue (user_id, destinataire, sujet, corps, piece_type, piece_id, statut, created_at)
             VALUES (?,?,?,?,?,?,"attente",?)'
        )->execute([$userId, $destinataire, mb_substr($sujet, 0, 190), $corps, $pieceType, $pieceId, maintenant()]);
    } catch (PDOException) {
        // La file est un confort, pas une condition.
    }
}

/* -------------------------------------------------------------- divers */

/** Un secret d'usage unique : on stocke son empreinte, on rend le clair. */
function jetonUnique(): array
{
    $clair = bin2hex(random_bytes(32));
    return [$clair, hash('sha256', $clair)];
}

function codeInvitation(): string
{
    // Sans 0/O/1/I : un code qu'on dicte au telephone.
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $c = '';
    for ($i = 0; $i < 12; $i++) {
        $c .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $c;
}

<?php
/**
 * Adopte un Job — noyau de l'API : reponses, entrees, sessions, journalisation.
 *
 * Une regle traverse tout le fichier : le serveur ne renvoie jamais un champ que
 * le destinataire n'a pas le droit de voir. Masquer dans l'interface serait une
 * faille, pas une regle — il suffit d'ouvrir les outils de developpement.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/securite.php';

/* ------------------------------------------------------------------ sorties */

function envoie(mixed $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    entetesSecurite();
    cors();
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Une erreur porte un code lisible par le client, pas seulement un statut HTTP. */
function erreur(string $code, string $message, int $http = 400): never
{
    envoie(['erreur' => $code, 'message' => $message], $http);
}

/* ------------------------------------------------------------------ entrees */

function corps(): array
{
    static $c = null;
    if ($c === null) {
        // Un corps JSON n'a aucune raison de depasser le mega-octet : au-dela,
        // c'est une erreur de client ou une tentative d'epuiser la memoire.
        // Un envoi de fichier (multipart) est deja decoupe par PHP dans $_FILES,
        // avec sa propre limite (upload_max_filesize) : php://input y est vide.
        $multipart = str_starts_with((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data');
        if (!$multipart && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 1_048_576) {
            erreur('corps_trop_grand', 'Le corps de la requête dépasse 1 Mo.', 413);
        }
        if ($multipart) {
            $c = [];
            return $c;
        }
        // En ligne de commande (recette sans serveur), le corps arrive par stdin.
        $flux = fopen(PHP_SAPI === 'cli' ? 'php://stdin' : 'php://input', 'rb');
        $brut = $flux ? (string) stream_get_contents($flux, 1_048_577) : '';
        $c = $brut === '' ? [] : (json_decode($brut, true) ?: []);
        if (!is_array($c)) {
            $c = [];
        }
    }
    return $c;
}

function champ(string $cle, mixed $defaut = null): mixed
{
    $c = corps();
    return array_key_exists($cle, $c) ? $c[$cle] : $defaut;
}

function texte(string $cle, int $max, bool $requis = false): string
{
    $v = trim((string) champ($cle, ''));
    if ($requis && $v === '') {
        erreur('champ_manquant', "Le champ « $cle » est obligatoire.", 422);
    }
    return mb_substr($v, 0, $max);
}

function entierOuNull(string $cle): ?int
{
    $v = champ($cle);
    return ($v === null || $v === '') ? null : (int) $v;
}

/** Accepte une liste de chaines et rejette tout ce qui n'est pas dans l'ensemble permis. */
function liste(string $cle, array $permis, int $max = 10): array
{
    $v = champ($cle, []);
    if (!is_array($v)) {
        return [];
    }
    $out = [];
    foreach ($v as $x) {
        $x = (string) $x;
        if (in_array($x, $permis, true) && !in_array($x, $out, true)) {
            $out[] = $x;
        }
    }
    return array_slice($out, 0, $max);
}

/* ----------------------------------------------------------------- sessions */

function maintenant(): string
{
    return gmdate('Y-m-d H:i:s');
}

function empreinteIp(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return substr(md5(IP_SEL . $ip), 0, 32);
}

/**
 * Le jeton arrive par cookie (navigateur) ou par en-tete Authorization
 * (application native, ou tout client sans cookie). Les deux, jamais l'un
 * seulement : la version en magasin n'aura pas de cookie de session.
 */
function jeton(): string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $h, $m)) {
        return strtolower($m[1]);
    }
    if (preg_match('/^Bearer\s+(aj_[a-f0-9]{8}\.[a-f0-9]{40})$/i', $h, $m)) {
        return strtolower($m[1]);                  // une cle d'API tierce
    }
    $c = $_COOKIE[COOKIE] ?? '';
    return preg_match('/^[a-f0-9]{64}$/', $c) ? $c : '';
}

function utilisateur(): ?array
{
    static $u = false;
    if ($u !== false) {
        return $u;
    }
    $u = null;
    $t = jeton();
    if ($t === '') {
        return null;
    }
    if (str_starts_with($t, 'aj_')) {
        $u = utilisateurParCleApi($t);
        return $u;
    }
    $st = db()->prepare(
        'SELECT u.id, u.email, u.role, u.status, s.token, s.ua_hash
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token = ? AND s.expires_at > ?'
    );
    $st->execute([$t, maintenant()]);
    $r = $st->fetch();
    if (!$r || $r['status'] !== 'actif') {
        return null;
    }
    /* Un jeton vole rejoue depuis un autre navigateur ne passe pas. Le
       navigateur d'un meme utilisateur ne change pas d'agent en cours de
       session ; une mise a jour du navigateur invalide la session, c'est le
       prix accepte. */
    if ($r['ua_hash'] !== null && $r['ua_hash'] !== empreinteUa()) {
        return null;
    }
    unset($r['ua_hash']);
    db()->prepare('UPDATE sessions SET last_seen = ? WHERE token = ?')->execute([maintenant(), $t]);
    $u = $r;
    return $u;
}

function exigeConnexion(?string $role = null): array
{
    $u = utilisateur();
    if (!$u) {
        erreur('non_connecte', 'Cette ressource demande une connexion.', 401);
    }
    if ($role !== null && $u['role'] !== $role && $u['role'] !== 'admin') {
        erreur('role_insuffisant', 'Ce compte n’a pas accès à cette ressource.', 403);
    }
    return $u;
}

function empreinteUa(): string
{
    return substr(md5($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 32);
}

function ouvreSession(int $userId): string
{
    // Rotation : la session courante, si elle existe, est remplacee. Un jeton
    // pose avant l'authentification ne survit pas a celle-ci.
    $ancien = jeton();
    if ($ancien !== '' && !str_starts_with($ancien, 'aj_')) {
        db()->prepare('DELETE FROM sessions WHERE token = ?')->execute([$ancien]);
    }
    $t = bin2hex(random_bytes(32));
    db()->prepare(
        'INSERT INTO sessions (token, user_id, created_at, last_seen, expires_at, ua_hash)
         VALUES (?,?,?,?,?,?)'
    )->execute([
        $t, $userId, maintenant(), maintenant(),
        gmdate('Y-m-d H:i:s', time() + SESSION_J * 86400),
        empreinteUa(),
    ]);
    // Secure + SameSite=Lax : le cookie ne part pas sur une requete inter-sites.
    setcookie(COOKIE, $t, [
        'expires'  => time() + SESSION_J * 86400,
        'path'     => COOKIE_PATH,
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    db()->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([maintenant(), $userId]);
    return $t;
}

/* ------------------------------------------------------------- tracabilite */

/**
 * Qui a consulte quelle donnee personnelle, et quand. Sans ce journal, aucune
 * demande d'acces n'est satisfaisable et aucune fuite n'est tracable.
 */
function trace(?int $acteur, string $action, string $cibleType, ?int $cibleId = null): void
{
    try {
        db()->prepare(
            'INSERT INTO audit_logs (acteur_id, action, cible_type, cible_id, created_at, ip_hash)
             VALUES (?,?,?,?,?,?)'
        )->execute([$acteur, $action, $cibleType, $cibleId, maintenant(), empreinteIp()]);
    } catch (Throwable) {
        // Le journal ne doit jamais faire echouer l'action qu'il observe.
    }
}

function notifie(int $userId, string $type, array $payload = []): void
{
    db()->prepare('INSERT INTO notifications (user_id, type, payload, created_at) VALUES (?,?,?,?)')
        ->execute([$userId, $type, json_encode($payload, JSON_UNESCAPED_UNICODE), maintenant()]);
}

/* ------------------------------------------------------------ referentiels */

/**
 * Reduit un libelle a une cle stable. Surtout pas iconv('//TRANSLIT') : selon
 * la bibliotheque C du serveur, « é » devient « e », « 'e » ou rien du tout —
 * et le referentiel se fragmente en silence.
 */
function slugue(string $t): string
{
    $t = mb_strtolower(trim($t), 'UTF-8');
    $t = strtr($t, [
        'à' => 'a', 'á' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'å' => 'a',
        'ç' => 'c', 'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i',
        'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u',
        'ý' => 'y', 'ÿ' => 'y', 'ñ' => 'n', 'œ' => 'oe', 'æ' => 'ae', 'ß' => 'ss',
    ]);
    $t = preg_replace('/[^a-z0-9]+/', '-', $t) ?? '';
    return trim($t, '-');
}

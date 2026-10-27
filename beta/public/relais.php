<?php
/**
 * Adopte un Job — le relais vers l'API de l'équipe (Dan et Timothée).
 *
 * Depuis le 05/10/2026, Adopte un Job ne fait plus que l'interface : il n'a ni
 * base, ni API à lui. Tout vit dans l'API de l'équipe. Ce fichier n'existe que
 * parce que leur serveur n'autorise pas encore les appels d'un autre site
 * (pas d'en-tête CORS) : le navigateur appelle ce relais, qui transmet tel quel.
 *
 * Aucun CV, corps ou jeton n’est conservé. Seuls des compteurs techniques
 * temporaires protègent le matching contre les abus. Il
 * ne parle qu'à une seule adresse, et seulement aux routes listées ci-dessous :
 * ce n'est pas un relais ouvert. Le jour où leur API envoie les en-têtes CORS,
 * l'interface l'appelle directement et ce fichier se supprime.
 */

declare(strict_types=1);

const CIBLE = 'https://hackavp-api.duckdns.org';
/* CV-Matching (MS5, Jo-Michel). Sa clé ne quitte jamais le serveur : elle est lue
   dans _secrets.php, posé par l'outil de dépôt et absent du dépôt git. */
const CIBLE_MATCHING = 'https://myz0-cv-matching.hf.space';
const TAILLE_MAX = 11 * 1024 * 1024;           // leur limite est 10 Mo par CV

/* Les routes que l'interface utilise, et elles seules, chacune avec SA méthode
   (audit du Swagger du 19/10). Route inconnue : 404. Méthode que l'interface
   n'emploie pas sur cette route : 405. */
const ROUTES = [
    '#^/auth/(login|register|forgot-password|reset-password)$#' => ['POST'],
    '#^/avp$#'                                                  => ['GET'],
    '#^/avp/compteur$#'                                         => ['GET'],
    '#^/swipes/candidats$#'                                     => ['GET'],
    '#^/swipes/candidats/avp/\d+$#'                             => ['PUT'],
    '#^/candidatures/moi$#'                                     => ['GET'],
    '#^/profils/moi$#'                                          => ['PUT'],
    '#^/profils/moi/cv$#'                                       => ['PUT'],
    '#^/profils/moi/cv/traitement$#'                            => ['POST'],
    '#^/profils/\d+$#'                                          => ['GET'],
    '#^/profils/\d+/cv$#'                                       => ['GET'],
    '#^/profils/\d+/cv-json$#'                                  => ['DELETE'],
    // CV-Matching : le CV face à toutes les offres, ou face à une seule
    '#^/matching/v1/match$#'                                    => ['POST'],
    '#^/matching/v1/score$#'                                    => ['POST'],
];

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function refuse(int $code, string $message): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

$chemin = is_string($_GET['p'] ?? null) ? $_GET['p'] : '';
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$permises = null;
foreach (ROUTES as $motif => $methodes) {
    if (preg_match($motif, $chemin)) {
        $permises = $methodes;
        break;
    }
}
if ($permises === null) {
    refuse(404, 'Route non relayée.');
}
if (!in_array($methode, $permises, true)) {
    refuse(405, 'Méthode non relayée.');
}

$query = $_GET;
unset($query['p']);
$versMatching = str_starts_with($chemin, '/matching/');
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($auth === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
        if (strcasecmp($k, 'Authorization') === 0) $auth = $v;
    }
}
$entetes = ['Accept: application/json'];
$corps = null;
if ($methode !== 'GET') {
    $limite = $versMatching ? 1024 * 1024 : TAILLE_MAX;
    $corps = (string) file_get_contents('php://input', false, null, 0, $limite + 1);
    if (strlen($corps) > $limite) refuse(413, 'La demande dépasse la taille autorisée.');
    if (!empty($_SERVER['CONTENT_TYPE'])) $entetes[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}
if ($versMatching) {
    require_once __DIR__ . '/matching-securite.php';
    try { $candidat = candidatMatching($auth); }
    catch (RuntimeException $e) { refuse($e->getCode(), $e->getMessage()); }
    $donnees = json_decode($corps ?? '', true);
    if (!is_array($donnees) || array_is_list($donnees)) refuse(400, 'Un profil JSON est attendu.');
    if ($chemin === '/matching/v1/score' && (!is_string($donnees['reference'] ?? null) || !is_array($donnees['cv'] ?? null))) {
        refuse(400, 'Une référence et un CV sont attendus.');
    }
    $secrets = is_file(__DIR__ . '/_secrets.php') ? require __DIR__ . '/_secrets.php' : [];
    $cle = is_array($secrets) ? (string) ($secrets['cle_matching'] ?? '') : '';
    if ($cle === '') refuse(503, 'Le calcul d’adéquation n’est pas disponible pour le moment.');
    $dossier = sys_get_temp_dir() . '/aj-matching-' . substr(hash('sha256', __DIR__), 0, 16);
    try {
        $libereIp = reserveMatching($dossier, hash_hmac('sha256', 'ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'inconnue'), $cle), 120, 8);
        register_shutdown_function($libereIp);
        // Validation réelle par le hub : ne jamais faire confiance au seul décodage du JWT.
        $verification = curl_init(CIBLE . '/swipes/candidats?page=1&taille=1');
        curl_setopt_array($verification, [
            CURLOPT_HTTPHEADER => ['Authorization: ' . $auth, 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $valide = curl_exec($verification);
        $statutAuth = (int) curl_getinfo($verification, CURLINFO_RESPONSE_CODE);
        curl_close($verification);
        if ($valide === false || $statutAuth >= 500 || $statutAuth === 0) refuse(503, 'La vérification de connexion est indisponible.');
        if ($statutAuth === 401) refuse(401, 'Ta session a expiré : reconnecte-toi.');
        if ($statutAuth !== 200) refuse(403, 'Le calcul est réservé aux candidats connectés.');
        $libereCandidat = reserveMatching($dossier, hash_hmac('sha256', 'compte:' . $candidat, $cle), 30, 2);
        register_shutdown_function($libereCandidat);
        $libereGlobal = reserveMatching($dossier, 'global', 180, 8);
        register_shutdown_function($libereGlobal);
    } catch (RuntimeException $e) {
        if ($e->getCode() === 429) header('Retry-After: 60');
        refuse($e->getCode() === 429 ? 429 : 503, 'Le calcul est momentanément occupé. Réessaie dans une minute.');
    }
    $query = $chemin === '/matching/v1/match' ? [
        'top' => min(100, max(1, (int) ($query['top'] ?? 100))),
        'inclure_fermes' => ($query['inclure_fermes'] ?? '') === 'true' ? 'true' : 'false',
    ] : [];
    $url = CIBLE_MATCHING . substr($chemin, strlen('/matching'));
    $entetes[] = 'X-API-Key: ' . $cle;
    // Le jeton du hub sert à vérifier l'accès, mais ne part JAMAIS au matching.
} else {
    $url = CIBLE . $chemin;
    if ($auth !== '') $entetes[] = 'Authorization: ' . $auth;
}
$url .= $query ? '?' . http_build_query($query) : '';

// la lecture d'un CV par n8n peut prendre jusqu'à 3 minutes chez eux
set_time_limit(240);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => $methode,
    CURLOPT_HTTPHEADER     => $entetes,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER         => true,
    CURLOPT_TIMEOUT        => $versMatching ? 60 : 230,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => false,
]);
if ($corps !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $corps);
}
$reponse = curl_exec($ch);
if ($reponse === false) {
    refuse(502, $versMatching
        ? 'Le calcul d’adéquation ne répond pas. Réessaie dans un instant.'
        : 'L’API de l’équipe ne répond pas. Réessaie dans un instant.');
}
$statut = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$tailleEntetes = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

http_response_code($statut);
foreach (explode("\r\n", substr($reponse, 0, $tailleEntetes)) as $ligne) {
    if (preg_match('#^(Content-Type|Content-Disposition):#i', $ligne)) {
        header($ligne);
    }
}
echo substr($reponse, $tailleEntetes);

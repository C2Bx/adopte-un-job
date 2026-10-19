<?php
/**
 * Adopte un Job — le relais vers l'API de l'équipe (Dan et Timothée).
 *
 * Depuis le 05/10/2026, Adopte un Job ne fait plus que l'interface : il n'a ni
 * base, ni API à lui. Tout vit dans l'API de l'équipe. Ce fichier n'existe que
 * parce que leur serveur n'autorise pas encore les appels d'un autre site
 * (pas d'en-tête CORS) : le navigateur appelle ce relais, qui transmet tel quel.
 *
 * Il ne garde RIEN : pas de base, pas de fichier, pas de journal des corps. Il
 * ne parle qu'à une seule adresse, et seulement aux routes listées ci-dessous :
 * ce n'est pas un relais ouvert. Le jour où leur API envoie les en-têtes CORS,
 * l'interface l'appelle directement et ce fichier se supprime.
 */

declare(strict_types=1);

const CIBLE = 'https://hackavp-api.duckdns.org';
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

$chemin = (string) ($_GET['p'] ?? '');
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
$url = CIBLE . $chemin . ($query ? '?' . http_build_query($query) : '');

$entetes = ['Accept: ' . ($_SERVER['HTTP_ACCEPT'] ?? 'application/json')];
// Apache ne passe l'en-tete a PHP que par le .htaccess (SetEnvIf), parfois
// sous le nom REDIRECT_ apres une reecriture.
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($auth !== '') {
    $entetes[] = 'Authorization: ' . $auth;
} elseif (function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
        if (strcasecmp($k, 'Authorization') === 0) {
            $entetes[] = 'Authorization: ' . $v;
        }
    }
}

$corps = null;
if ($methode !== 'GET') {
    $corps = (string) file_get_contents('php://input', false, null, 0, TAILLE_MAX + 1);
    if (strlen($corps) > TAILLE_MAX) {
        refuse(413, 'Fichier de plus de 10 Mo.');
    }
    if (!empty($_SERVER['CONTENT_TYPE'])) {
        $entetes[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
    }
}

// la lecture d'un CV par n8n peut prendre jusqu'à 3 minutes chez eux
set_time_limit(240);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => $methode,
    CURLOPT_HTTPHEADER     => $entetes,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER         => true,
    CURLOPT_TIMEOUT        => 230,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => false,
]);
if ($corps !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $corps);
}
$reponse = curl_exec($ch);
if ($reponse === false) {
    refuse(502, 'L’API de l’équipe ne répond pas. Réessaie dans un instant.');
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

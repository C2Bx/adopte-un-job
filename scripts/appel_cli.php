<?php
/* Appelle l'API sans serveur HTTP : utile la ou un antivirus ou un proxy se
   met entre le client et le serveur de developpement. Variables :
   AVP_METHOD, AVP_ROUTE, AVP_TOKEN, AVP_QUERY (json), AVP_HEADERS (json) ;
   le corps JSON arrive par stdin. La derniere ligne de sortie donne le statut. */
$_SERVER['REQUEST_METHOD'] = getenv('AVP_METHOD') ?: 'GET';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = 'appel_cli';
$_GET = json_decode(getenv('AVP_QUERY') ?: '{}', true) ?: [];
$_GET['r'] = getenv('AVP_ROUTE') ?: '';
foreach (json_decode(getenv('AVP_HEADERS') ?: '{}', true) ?: [] as $k => $v) {
    $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $k))] = $v;
}
if (($t = getenv('AVP_TOKEN')) !== false && $t !== '') {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $t;
}
register_shutdown_function(static function () {
    echo "\n__STATUS__=" . (http_response_code() ?: 200);
});
require __DIR__ . '/../api/index.php';

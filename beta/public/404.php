<?php
/**
 * Adopte un Job — la page servie par Apache quand une adresse du site
 * n'existe pas, ou qu'elle est fermee.
 *
 * Elle ne dessine rien elle-meme : le dessin vit dans `page_erreur.php`,
 * partage avec les erreurs de l'API. Corriger la page d'erreur a un seul
 * endroit, c'est tout l'interet.
 *
 * Attention : ce fichier est appele par `ErrorDocument`, donc PHP repond 200
 * par defaut. Sans le `http_response_code()` ci-dessous, un moteur de
 * recherche indexerait une page « introuvable » comme une page valide.
 */

declare(strict_types=1);

require_once __DIR__ . '/app/api/page_erreur.php';

/* Apache range le statut d'origine dans REDIRECT_STATUS. Ouverte
   directement, cette page n'en a pas : elle vaut alors ce qu'elle est,
   une 404. On refuse tout ce qui n'est pas un code d'erreur, sans quoi une
   requete forgee pourrait faire annoncer n'importe quoi a la page. */
$code = (int) ($_SERVER['REDIRECT_STATUS'] ?? 0);
if ($code < 400 || $code > 599) {
    $code = 404;
}

$messages = [
    403 => 'Cette adresse existe, mais elle ne t’est pas ouverte.',
    404 => 'Cette page n’existe pas, ou elle a changé d’adresse.',
];
$notes = [
    403 => 'Si tu penses que c’est une erreur, signale-le : certaines adresses '
        . 'ne sont accessibles qu’en ligne de commande, sur le serveur.',
    404 => 'Si tu es arrivé ici par un lien, il est probablement périmé. '
        . 'L’application a changé d’adresse le 29/09 : elle est maintenant à la racine du dossier.',
];

http_response_code($code);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
// Cette page n'a ni script ni image ni police distante : seulement son style
// en ligne. La CSP dit exactement cela, et rien de plus.
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");

echo pageErreur(
    $code,
    '',
    $messages[$code] ?? 'La demande n’a pas abouti.',
    $notes[$code] ?? ''
);

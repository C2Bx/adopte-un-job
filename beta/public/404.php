<?php
/**
 * Adopte un Job — la page servie par Apache quand une adresse du site
 * n'existe pas, ou qu'elle est fermee.
 *
 * Autonome : elle ne depend d'aucun autre fichier (l'API qui partageait son
 * dessin a ete retiree le 05/10/2026), elle s'affiche meme si tout le reste casse.
 *
 * Attention : ce fichier est appele par `ErrorDocument`, donc PHP repond 200
 * par defaut. Sans le `http_response_code()` ci-dessous, un moteur de
 * recherche indexerait une page « introuvable » comme une page valide.
 */

declare(strict_types=1);


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
        . 'L’application est à la racine du dossier : /avp/.',
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

/** La page rendue a qui ouvre une adresse d\'API dans son navigateur. */
function pageErreur(int $code, string $erreur, string $message, string $note = ''): string
{
    $titres = [
        400 => 'Demande mal formée',
        401 => 'Il faut être connecté',
        403 => 'Accès refusé',
        404 => 'Cette adresse n\'existe pas',
        409 => 'Conflit',
        413 => 'Fichier trop grand',
        415 => 'Format refusé',
        422 => 'Données incomplètes',
        429 => 'Trop de demandes',
        500 => 'Erreur du serveur',
        501 => 'Pas encore disponible',
        502 => 'Service indisponible',
        503 => 'Service indisponible',
    ];
    $titre = $titres[$code] ?? 'Erreur';
    $h = static fn (string $t): string => htmlspecialchars($t, ENT_QUOTES, 'UTF-8');
    $app = defined('APP_URL') ? APP_URL : '/avp/';

    /* Les valeurs viennent de `beta/src/design.css`, direction artistique
       « a » — celle qui est appliquee par defaut dans l\'application. Elles
       sont recopiees plutot que liees : la feuille de l\'application porte une
       empreinte dans son nom a chaque construction, et une page d\'erreur qui
       dependrait d\'un fichier introuvable s\'afficherait sans style.

       « Plus Jakarta Sans » n\'est chargee nulle part dans l\'application : elle
       rend donc en `system-ui`. On reprend la meme pile, sans police distante
       a autoriser dans la CSP — meme rendu, surface d\'attaque inchangee.

       Pas de mode sombre : l\'application n\'en a pas. */
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex">'
        . '<title>' . $code . ' — Adopte un Job</title><style>'
        . ':root{color-scheme:light;'
        . '--bg:#F4F6F8;--surface:#FFFFFF;--line:#DEE3EA;'
        . '--ink:#0F1A2B;--ink-2:#46536A;--ink-3:#7A869B;'
        . '--brand:#17356B;--brand-ink:#FFFFFF;--accent:#E8912B;'
        . '--font-ui:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;'
        . '--font-num:"JetBrains Mono",ui-monospace,monospace}'
        . '*{box-sizing:border-box}'
        . 'body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px 16px;'
        . 'background:var(--bg);color:var(--ink);font:15px/1.6 var(--font-ui)}'
        . 'main{max-width:33rem;width:100%;background:var(--surface);'
        . 'border:1px solid var(--line);border-radius:28px;padding:40px 32px;text-align:center;'
        . 'box-shadow:0 1px 2px rgba(15,26,43,.05),0 10px 24px -20px rgba(15,26,43,.5)}'
        . '.num{font-weight:800;letter-spacing:-.03em;line-height:.9;'
        . 'font-size:clamp(84px,22vw,148px);color:var(--brand);'
        . 'font-variant-numeric:tabular-nums}'
        . '.rule{width:56px;height:4px;border-radius:999px;background:var(--accent);'
        . 'margin:20px auto 24px}'
        . 'h1{font-size:22px;font-weight:800;letter-spacing:-.03em;margin:0 0 8px;'
        . 'text-wrap:balance}'
        . 'p{margin:0 0 16px;color:var(--ink-2)}'
        . '.note{font-size:13px;color:var(--ink-3)}'
        . 'a{display:inline-flex;align-items:center;justify-content:center;'
        . 'min-height:44px;padding:0 24px;border-radius:999px;'
        . 'background:var(--brand);color:var(--brand-ink);'
        . 'font-weight:700;text-decoration:none}'
        . 'a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}'
        . '.tag{margin-top:24px;font:11px/1 var(--font-num);letter-spacing:.12em;'
        . 'text-transform:uppercase;color:var(--ink-3)}'
        . '</style></head><body><main>'
        . '<div class="num">' . $code . '</div>'
        . '<div class="rule"></div>'
        . '<h1>' . $h($titre) . '</h1>'
        . '<p>' . $h($message) . '</p>'
        . ($note !== '' ? '<p class="note">' . $h($note) . '</p>' : '')
        . '<a href="' . $h($app) . '">Retour à l\'application</a>'
        . ($erreur !== '' ? '<div class="tag">' . $h($erreur) . '</div>' : '')
        . '</main></body></html>';
}

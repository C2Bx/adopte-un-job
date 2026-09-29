<?php
/**
 * Adopte un Job — la page d\'erreur lisible par un humain.
 *
 * Elle sert DEUX appelants : les erreurs de l\'API ouvertes dans un
 * navigateur (`noyau.php`), et la 404 du site posee par Apache
 * (`/avp/404.php`). Un seul dessin, un seul endroit ou le corriger.
 *
 * Ce fichier ne requiert rien et n\'ecrit rien : il declare une fonction. Il
 * peut donc etre inclus par du code qui n\'a ni configuration ni base — c\'est
 * exactement le cas d\'une page d\'erreur, qui doit s\'afficher meme quand le
 * reste est casse.
 */

declare(strict_types=1);

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

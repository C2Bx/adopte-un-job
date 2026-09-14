<?php
/**
 * Filtre d'acces aux pages de documentation.
 * A inclure en toute premiere ligne de chaque page : aucune sortie avant.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';

$tok = isset($_COOKIE['avp_token']) ? (string) $_COOKIE['avp_token'] : '';
$ok = false;

if (preg_match('/^[a-f0-9]{48}$/', $tok)) {
    try {
        $st = db()->prepare('SELECT member_id FROM sessions WHERE token = ?');
        $st->execute([$tok]);
        $ok = (bool) $st->fetch();
    } catch (Throwable $e) {
        $ok = false;
    }
}

if (!$ok) {
    // une page d'un sous-dossier declare ou revenir et comment se nommer
    $accueil = isset($GUARD_HOME) ? $GUARD_HOME : 'index.html';
    $depuis  = isset($GUARD_FROM) ? $GUARD_FROM : basename((string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    header('Location: ' . $accueil . '?from=' . rawurlencode($depuis));
    exit;
}

header('Cache-Control: private, no-store');
header('X-Robots-Tag: noindex, nofollow');

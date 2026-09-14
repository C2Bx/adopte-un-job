<?php
/**
 * Reconnaissance douce : dit si le visiteur fait partie de l'equipe, sans
 * jamais le rediriger. Sert aux pages publiques qui montrent un peu plus
 * a l'equipe qu'aux visiteurs.
 */

declare(strict_types=1);

function estEquipe(): bool
{
    $tok = isset($_COOKIE['avp_token']) ? (string) $_COOKIE['avp_token'] : '';
    if (!preg_match('/^[a-f0-9]{48}$/', $tok)) {
        return false;                       // pas de cookie : aucune requete en base
    }
    require_once __DIR__ . '/../config.php';
    try {
        $st = db()->prepare('SELECT member_id FROM sessions WHERE token = ?');
        $st->execute([$tok]);
        return (bool) $st->fetch();
    } catch (Throwable $e) {
        return false;
    }
}

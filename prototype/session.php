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
    /* La configuration du wiki a suivi le wiki dans /avp/projet/ le 29/09,
       quand l'application est passee a la racine. Ce chemin pointait encore
       l'ancien emplacement : la page rendait 500 pour les SEULS visiteurs
       porteurs du cookie — donc l'equipe, et personne d'autre. Un visiteur
       anonyme sortait avant, ce qui a rendu la panne invisible aux controles. */
    $conf = __DIR__ . '/../projet/config.php';
    if (!is_file($conf)) {
        return false;   // reconnaissance douce : son absence ne casse pas la page
    }
    require_once $conf;
    try {
        $st = db()->prepare('SELECT member_id FROM sessions WHERE token = ?');
        $st->execute([$tok]);
        return (bool) $st->fetch();
    } catch (Throwable $e) {
        return false;
    }
}

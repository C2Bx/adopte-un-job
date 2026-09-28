<?php
/**
 * Le veilleur de la passerelle d'echange, appele par une tache planifiee.
 *
 *   php passerelle.php              les deux sens
 *   php passerelle.php --sortant    seulement l'export
 *   php passerelle.php --entrant    seulement l'ingestion
 *
 * En ligne de commande uniquement : ce fichier n'a rien a faire derriere une
 * URL, et la garde le dit plutot que de compter sur le rangement des dossiers.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$_SERVER['REQUEST_METHOD'] = 'CLI';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = 'passerelle';

/* Le meme fichier sert depuis le depot (scripts/) et depuis le serveur, ou il
   est depose a cote de l'API : on cherche le noyau des deux cotes. */
$racine = is_file(__DIR__ . '/noyau.php') ? __DIR__ : __DIR__ . '/../api';
require $racine . '/noyau.php';
require $racine . '/echange.php';

$pdo = db();
$sens = $argv[1] ?? '--tout';
$debut = microtime(true);
$bilan = [];

if ($sens !== '--sortant') {
    $bilan['entrant'] = ingereEntrant($pdo);
}
if ($sens !== '--entrant') {
    $bilan['sortant'] = exporteSortant($pdo);
}

$bilan['duree_ms'] = (int) round((microtime(true) - $debut) * 1000);
echo json_encode($bilan, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";

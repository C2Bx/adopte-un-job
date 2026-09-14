<?php
/**
 * Adopte un Job — configuration de l'API. Copier en config.php et remplir.
 * config.php est ignore par git : il ne doit jamais etre versionne.
 */

declare(strict_types=1);

const DB_HOST = 'localhost';
const DB_NAME = 'avp';
const DB_USER = 'avp';
const DB_PASS = 'a-remplir';

const ALGO      = 'v1';           // version du moteur de score, ecrite dans match_scores
const SESSION_J = 30;             // duree de vie d'une session, en jours
const COOKIE    = 'avp_sid';

/** Le sel des empreintes d'adresse IP : 32 caracteres aleatoires, propres a
    chaque installation. `php -r 'echo bin2hex(random_bytes(16));'` */
const IP_SEL = 'a-generer';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    }
    return $pdo;
}

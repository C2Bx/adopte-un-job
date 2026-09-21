<?php
/**
 * Adopte un Job — configuration de l'API.
 *
 * Deux sources, dans l'ordre : un fichier d'environnement HORS docroot
 * (private/avp.env chez Plesk, une ligne CLE=VALEUR par secret), puis les
 * constantes ci-dessous en repli. Copier ce fichier en config.php ; config.php
 * est ignore par git et n'est jamais versionne.
 */

declare(strict_types=1);

/* Le fichier d'environnement : quatre niveaux au-dessus de api/, c'est la
   racine du vhost (httpdocs/avp/app/api -> vhost), ou vit private/. */
$env = [];
foreach ([__DIR__ . '/../../../../private/avp.env', __DIR__ . '/.env'] as $f) {
    if (is_readable($f)) {
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) {
            if ($l[0] === '#' || !str_contains($l, '=')) {
                continue;
            }
            [$k, $v] = explode('=', $l, 2);
            $env[trim($k)] = trim($v, " \t\"'");
        }
        break;
    }
}
$cfg = static fn (string $k, string $defaut = '') => $env[$k] ?? (getenv($k) ?: $defaut);

const DB_HOST = 'localhost';          // remplace par $cfg('AVP_DB_HOST') si tu preferes tout en env
define('DB_NAME', $cfg('AVP_DB_NAME', 'avp'));
define('DB_USER', $cfg('AVP_DB_USER', 'avp'));
define('DB_PASS', $cfg('AVP_DB_PASS', 'a-remplir'));

const ALGO      = 'v2';               // version du moteur de score, ecrite dans match_scores
const SESSION_J = 30;                 // duree de vie d'une session, en jours
const COOKIE    = 'avp_sid';
const COOKIE_PATH = '/avp/';          // le prototype (/avp/app) ET la beta (/avp/beta)

/** Hash Argon2id d'un mot de passe qui n'existe pas : compare quand le compte est
    inconnu, pour que la reponse prenne le meme temps qu'avec un vrai compte. */
const HASH_FACTICE = '$argon2id$v=19$m=65536,t=4,p=1$dUpRNExoanVUdXp4amZlaw$mUmctDTXwaiY+Lzq0DhTAE1UAojDng5lUtOTgV+/YkA';

/** Sel des empreintes d'adresse IP. 32 caracteres aleatoires par installation :
    php -r 'echo bin2hex(random_bytes(16));' */
define('IP_SEL', $cfg('AVP_IP_SEL', 'a-generer'));

/** Cle de chiffrement des CV au repos (AES-256-GCM), 64 caracteres hex :
    php -r 'echo bin2hex(random_bytes(32));' — la perdre rend les CV illisibles. */
define('CV_CLE', $cfg('AVP_CV_CLE', ''));

/** Dossier des fichiers, HORS docroot. Vide = private/avp-fichiers a la racine du vhost. */
define('FICHIERS_DIR', $cfg('AVP_FICHIERS_DIR', __DIR__ . '/../../../../private/avp-fichiers'));

/** Origines autorisees a appeler l'API avec des identifiants (CORS + controle Origin). */
define('ORIGINES', array_filter(array_map('trim', explode(',', $cfg('AVP_ORIGINES',
    'https://zako.nc,capacitor://localhost,http://localhost:5173')))));

/** Jeton du cron de synchronisation des AVP (en-tete X-Sync-Token). Vide = route fermee. */
define('SYNC_TOKEN', $cfg('AVP_SYNC_TOKEN', ''));

/** API OPT-NC (portail Apigee). Vide = repli sur le dataset Hugging Face, sans cle. */
define('OPT_API_KEY', $cfg('OPT_API_KEY', ''));
const OPT_API_BASE = 'https://api.opt.nc';
const HF_AVPS_URL  = 'https://huggingface.co/datasets/opt-nc/odata-avps/resolve/main/data/all_avps.jsonl';

/** DEV SEULEMENT : derriere un proxy qui reecrit le TLS (Kerio), les appels
    sortants echouent sur le certificat. Jamais a 1 en production. */
define('SSL_INSECURE', $cfg('AVP_SSL_INSECURE', '') === '1');

/** Adresse d'expedition des e-mails mis en file (rien n'est envoye pour l'instant). */
define('MAIL_DE', $cfg('AVP_MAIL_DE', 'candidatures@zako.nc'));

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

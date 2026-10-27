<?php
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

/** Quota technique : aucun jeton, CV ou IP en clair n'est conservé. */
function reserveMatching(string $dossier, string $identite, int $maximum, int $simultanes, ?int $maintenant = null): Closure
{
    $maintenant ??= time();
    if (!is_dir($dossier) && !@mkdir($dossier, 0700, true) && !is_dir($dossier)) {
        throw new RuntimeException('Limiteur indisponible', 503);
    }
    $chemin = $dossier . '/' . hash('sha256', $identite) . '.json';
    $fp = @fopen($chemin, 'c+');
    if ($fp === false || !flock($fp, LOCK_EX)) {
        if (is_resource($fp)) fclose($fp);
        throw new RuntimeException('Limiteur indisponible', 503);
    }
    try {
        $etat = json_decode(stream_get_contents($fp), true) ?: [];
        $dates = array_values(array_filter($etat['dates'] ?? [], fn($t) => is_int($t) && $t > $maintenant - 60));
        $baux = array_filter($etat['baux'] ?? [], fn($t) => is_int($t) && $t > $maintenant - 75);
        if (count($dates) >= $maximum || count($baux) >= $simultanes) {
            throw new RuntimeException('Trop de calculs simultanés ou rapprochés', 429);
        }
        $id = bin2hex(random_bytes(12));
        $dates[] = $maintenant;
        $baux[$id] = $maintenant;
        rewind($fp); ftruncate($fp, 0);
        if (fwrite($fp, json_encode(['dates' => $dates, 'baux' => $baux])) === false) {
            throw new RuntimeException('Limiteur indisponible', 503);
        }
    } finally { flock($fp, LOCK_UN); fclose($fp); }

    // Supprimer les fichiers inactifs ; prendre leur verrou évite une course avec une réservation.
    foreach (glob($dossier . '/*.json') ?: [] as $ancien) {
        if ($ancien === $chemin || @filemtime($ancien) >= $maintenant - 3600) continue;
        $f = @fopen($ancien, 'r+');
        if ($f && flock($f, LOCK_EX | LOCK_NB)) {
            if (@filemtime($ancien) < $maintenant - 3600) @unlink($ancien);
            flock($f, LOCK_UN);
        }
        if ($f) fclose($f);
    }
    return static function () use ($chemin, $id): void {
        $f = @fopen($chemin, 'r+');
        if (!$f) return;
        if (flock($f, LOCK_EX)) {
            $etat = json_decode(stream_get_contents($f), true) ?: [];
            unset($etat['baux'][$id]);
            rewind($f); ftruncate($f, 0); fwrite($f, json_encode($etat));
            flock($f, LOCK_UN);
        }
        fclose($f);
    };
}

/** Le JWT n'est pas considéré authentique ici : le hub le validera ensuite. */
function candidatMatching(string $auth): string
{
    if (!preg_match('/^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/D', $auth, $m)) {
        throw new RuntimeException('Connexion nécessaire pour calculer l’adéquation.', 401);
    }
    $payload = json_decode(base64_decode(strtr($m[2], '-_', '+/'), true) ?: '', true);
    $sub = (string) ($payload['sub'] ?? '');
    if (!ctype_digit($sub) || (int)$sub < 1 || !isset($payload['exp']) || !is_numeric($payload['exp']) || (int)$payload['exp'] <= time()) {
        throw new RuntimeException('Session expirée ou invalide.', 401);
    }
    return $sub;
}

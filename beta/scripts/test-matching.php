<?php
declare(strict_types=1);
require __DIR__ . '/../public/matching-securite.php';

function verifie(bool $ok, string $nom): void {
    if (!$ok) throw new RuntimeException($nom);
    echo "OK — $nom\n";
}
function refuseAvec(callable $action, int $code): bool {
    try { $action(); } catch (RuntimeException $e) { return $e->getCode() === $code; }
    return false;
}
verifie(refuseAvec(fn() => candidatMatching(''), 401), 'matching anonyme refusé');
verifie(refuseAvec(fn() => candidatMatching('Bearer invalide'), 401), 'jeton mal formé refusé');
$payload = rtrim(strtr(base64_encode(json_encode(['sub' => 10, 'exp' => time() + 60])), '+/', '-_'), '=');
verifie(candidatMatching("Bearer a.$payload.z") === '10', 'identifiant extrait pour validation ultérieure par le hub');
$expire = rtrim(strtr(base64_encode(json_encode(['sub' => 10, 'exp' => time() - 60])), '+/', '-_'), '=');
verifie(refuseAvec(fn() => candidatMatching("Bearer a.$expire.z"), 401), 'jeton expiré refusé');
$dossier = sys_get_temp_dir() . '/aj-test-' . bin2hex(random_bytes(6));
try {
    $a = reserveMatching($dossier, 'compte-a', 3, 1, 100);
    verifie(refuseAvec(fn() => reserveMatching($dossier, 'compte-a', 3, 1, 100), 429), 'limite de concurrence appliquée');
    $b = reserveMatching($dossier, 'compte-b', 3, 1, 100); $b();
    $a();
    $c = reserveMatching($dossier, 'compte-a', 3, 1, 101); $c();
    $d = reserveMatching($dossier, 'compte-a', 3, 1, 102); $d();
    verifie(refuseAvec(fn() => reserveMatching($dossier, 'compte-a', 3, 1, 103), 429), 'quota de fréquence appliqué');
    $e = reserveMatching($dossier, 'compte-a', 3, 1, 163); $e();
    verifie(true, 'quota libéré après expiration de la fenêtre');
    $f = reserveMatching($dossier, 'bail', 10, 1, 100);
    $g = reserveMatching($dossier, 'bail', 10, 1, 176); $g(); $f();
    verifie(true, 'bail abandonné libéré après expiration');
} finally {
    foreach (glob($dossier . '/*.json') ?: [] as $chemin) unlink($chemin);
    rmdir($dossier);
}

<?php
/**
 * Adopte un Job — les AVP reels de l'OPT-NC.
 *
 * Deux sources pour la meme donnee (schema.org/JobPosting) :
 *   - le dataset Hugging Face opt-nc/odata-avps (all_avps.jsonl), sans cle :
 *     c'est la source de synchronisation, un cron l'appelle ;
 *   - l'API Apigee de l'OPT (https://api.opt.nc/avps/search), avec une cle
 *     x-apikey : recherche semantique par prompt, utilisee en signal d'appoint
 *     quand la cle est configuree.
 *
 * Un AVP importe est une ligne de `jobs` (source 'opt') rattachee a
 * l'organisation OPT-NC. Il n'est jamais supprime : quand il disparait du
 * flux, il passe « fermee » et reste consultable, etiquete comme clos.
 */

declare(strict_types=1);

require_once __DIR__ . '/referentiel.php';

/* ---------------------------------------------------------- correspondances */

/** Les communes du Grand Noumea : la zone est plus fine que la province. */
const GRAND_NOUMEA = ['Nouméa', 'Dumbéa', 'Mont-Dore', 'Païta'];

function zoneDepuisAvp(?string $ville, ?string $province): string
{
    if ($ville && in_array($ville, GRAND_NOUMEA, true)) {
        return 'Grand Nouméa';
    }
    $p = mb_strtolower((string) $province, 'UTF-8');
    if (str_contains($p, 'nord')) {
        return 'Nord';
    }
    if (str_contains($p, 'les') || str_contains($p, 'îles') || str_contains($p, 'loyaut')) {
        return 'Îles';
    }
    return 'Sud';
}

function contratDepuisAvp(?string $employmentType): string
{
    return match ($employmentType) {
        'TEMPORARY'  => 'CDD',
        'CONTRACTOR' => 'CDD',
        'INTERN'     => 'Stage',
        default      => 'CDI',      // FULL_TIME, PART_TIME : un poste permanent
    };
}

/** « Bac+3 » ou « niveau licence » dans le texte de qualification → 1..4. */
function formationDepuisTexte(?string $t): ?int
{
    if (!$t) {
        return null;
    }
    $s = mb_strtolower($t, 'UTF-8');
    if (preg_match('/bac\s*\+\s*5|master|ingénieur|ingenieur|bac \+5/u', $s)) {
        return 4;
    }
    if (preg_match('/bac\s*\+\s*3|licence|bachelor/u', $s)) {
        return 3;
    }
    if (preg_match('/bac\s*\+\s*2|bts|dut/u', $s)) {
        return 2;
    }
    if (preg_match('/\bbac\b|baccalaur/u', $s)) {
        return 1;
    }
    return null;
}

function experienceDepuisTexte(?string $t): int
{
    if ($t && preg_match('/(\d+)\s*an/u', $t, $m)) {
        return min(15, (int) $m[1]);
    }
    return 0;
}

function dateSql(?string $iso): ?string
{
    if (!$iso) {
        return null;
    }
    $t = strtotime($iso);
    return $t ? gmdate('Y-m-d H:i:s', $t) : null;
}

/* ------------------------------------------------------------ organisation */

function organisationOpt(PDO $pdo): int
{
    $st = $pdo->prepare('SELECT id, invite_code FROM companies WHERE slug = ?');
    $st->execute(['opt-nc']);
    $org = $st->fetch();
    if ($org) {
        // Les RH de l'OPT rejoignent leur organisation par ce code : il doit exister.
        if (empty($org['invite_code'])) {
            $pdo->prepare('UPDATE companies SET invite_code = ? WHERE id = ?')->execute([codeInvitation(), (int) $org['id']]);
        }
        return (int) $org['id'];
    }
    $pdo->prepare(
        'INSERT INTO companies (name, slug, invite_code, sector, size, website, pitch, source, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
    )->execute([
        'Office des postes et télécommunications de Nouvelle-Calédonie', 'opt-nc', codeInvitation(), 'Service public', '200+',
        'https://www.opt.nc',
        'Établissement public : postes, services financiers et télécommunications. Environ 1 000 agents, 12 familles de métiers.',
        'opt', maintenant(),
    ]);
    return (int) $pdo->lastInsertId();
}

/* ----------------------------------------------------------------- import */

/** Un enregistrement JobPosting → une ligne de jobs. Rend [id, cree]. */
function importeAvp(PDO $pdo, array $j, int $orgId): array
{
    $ext = (string) ($j['id_avp'] ?? $j['identifier'] ?? '');
    if ($ext === '') {
        return [0, false];
    }
    $adr = $j['jobLocation']['address'] ?? [];
    $ville = $adr['addressLocality'] ?? null;
    $province = $adr['province'] ?? $adr['addressRegion'] ?? null;
    $add = $j['additionalType'] ?? [];
    $comp = competencesTexteAvp($j);
    $familles = array_values(array_map('strval', (array) ($j['occupationalCategory'] ?? [])));
    $codeMetier = $j['relevantOccupation']['code_metier'] ?? null;
    $codeRome = $j['relevantOccupation']['occupationalCategory']['codeValue'] ?? null;

    // texte de recherche : tout ce qu'un candidat pourrait taper
    $texte = implode("\n", array_filter([
        $j['title'] ?? $j['name'] ?? '', $j['description'] ?? '', $j['disambiguatingDescription'] ?? '',
        $j['relevantOccupation']['name'] ?? '', $add['direction'] ?? '', $j['employmentUnit']['name'] ?? '',
        $ville, implode(' ', $familles),
        implode("\n", array_map('strval', (array) ($j['responsibilities'] ?? []))),
        implode("\n", array_column($comp, 'texte')),
    ]));

    $vals = [
        'company_id'     => $orgId,
        'titre'          => mb_substr((string) ($j['title'] ?? $j['name'] ?? $j['titre'] ?? 'Sans titre'), 0, 160),
        'contrat'        => contratDepuisAvp($j['employmentType'] ?? null),
        'zone'           => zoneDepuisAvp($ville, $province),
        'teletravail'    => preg_match('/t[ée]l[ée]travail/iu', json_encode($add, JSON_UNESCAPED_UNICODE) . ($j['workHours'] ?? '')) ? 'hybride' : 'non',
        'experience_min' => experienceDepuisTexte($j['experienceRequirements'] ?? null),
        'formation_min'  => formationDepuisTexte(($j['qualifications'] ?? '') . ' ' . ($j['educationRequirements']['credentialCategory'] ?? '')),
        'permis_requis'  => preg_match('/permis/iu', ($j['qualifications'] ?? '') . json_encode($add['informationsLibres'] ?? [], JSON_UNESCAPED_UNICODE)) ? 1 : 0,
        'debut'          => preg_match('/^(\d{4}-\d{2})/', (string) ($j['jobStartDate'] ?? ''), $m) ? $m[1] : null,
        'description'    => mb_substr((string) ($j['description'] ?? ''), 0, 6000),
        'statut'         => 'publiee',
        'published_at'   => dateSql($j['datePosted'] ?? null) ?? maintenant(),
        'expires_at'     => dateSql($j['validThrough'] ?? null),
        'source'         => 'opt',
        'external_id'    => mb_substr($ext, 0, 40),
        'code_metier'    => $codeMetier ? mb_substr((string) $codeMetier, 0, 10) : null,
        'code_rome'      => $codeRome ? mb_substr((string) $codeRome, 0, 6) : null,
        'ville'          => $ville ? mb_substr((string) $ville, 0, 60) : null,
        'province'       => $province ? mb_substr((string) $province, 0, 40) : null,
        'direction'      => isset($add['direction']) ? mb_substr((string) $add['direction'], 0, 120) : null,
        'familles'       => json_encode($familles, JSON_UNESCAPED_UNICODE),
        'employment_type' => isset($j['employmentType']) ? mb_substr((string) $j['employmentType'], 0, 20) : null,
        'nb_agents_encadres' => isset($add['nbAgentsEncadres']) ? (int) $add['nbAgentsEncadres'] : null,
        'json_data'      => json_encode($j, JSON_UNESCAPED_UNICODE),
        'url'            => isset($j['url']) ? mb_substr((string) $j['url'], 0, 255) : null,
        'contact_email'  => isset($j['applicationContact']['email']) ? mb_substr((string) $j['applicationContact']['email'], 0, 190) : null,
        'synced_at'      => maintenant(),
        'texte_recherche' => mb_substr($texte, 0, 60000),
        'competences_texte' => json_encode(array_map(static fn ($c) => ['texte' => $c['texte'], 'type' => $c['type'], 'mots' => $c['mots']], $comp), JSON_UNESCAPED_UNICODE),
        'updated_at'     => maintenant(),
    ];

    $st = $pdo->prepare('SELECT id FROM jobs WHERE source = "opt" AND external_id = ?');
    $st->execute([$vals['external_id']]);
    $id = $st->fetchColumn();
    if ($id !== false) {
        $set = implode(', ', array_map(static fn ($k) => "`$k` = :$k", array_keys($vals)));
        $pdo->prepare("UPDATE jobs SET $set WHERE id = :id")->execute($vals + ['id' => (int) $id]);
        return [(int) $id, false];
    }
    $vals['created_at'] = maintenant();
    $cols = implode(', ', array_map(static fn ($k) => "`$k`", array_keys($vals)));
    $ph = implode(', ', array_map(static fn ($k) => ":$k", array_keys($vals)));
    $pdo->prepare("INSERT INTO jobs ($cols) VALUES ($ph)")->execute($vals);
    return [(int) $pdo->lastInsertId(), true];
}

/**
 * Synchronise depuis le dataset Hugging Face. Ce qui n'est plus dans le flux
 * est ferme, pas supprime : l'historique nourrit le deck d'entrainement et
 * les statistiques.
 */
function synchroniseAvp(PDO $pdo): array
{
    $brut = httpGet(HF_AVPS_URL, 60);
    if ($brut === null || $brut === '') {
        erreur('source_indisponible', 'Le dataset des AVP n’a pas pu être lu.', 502);
    }
    $orgId = organisationOpt($pdo);
    $vus = [];
    $n = 0;
    $crees = 0;
    foreach (explode("\n", $brut) as $ligne) {
        $ligne = trim($ligne);
        if ($ligne === '') {
            continue;
        }
        $j = json_decode($ligne, true);
        if (!is_array($j)) {
            continue;
        }
        [$id, $cree] = importeAvp($pdo, $j, $orgId);
        if ($id) {
            $vus[] = $id;
            $n++;
            $crees += $cree ? 1 : 0;
        }
    }
    $fermes = 0;
    if ($vus) {
        $in = implode(',', array_fill(0, count($vus), '?'));
        $st = $pdo->prepare("UPDATE jobs SET statut = 'fermee', updated_at = ? WHERE source = 'opt' AND statut = 'publiee' AND id NOT IN ($in)");
        $st->execute(array_merge([maintenant()], $vus));
        $fermes = $st->rowCount();
        // les scores des AVP mis a jour ne valent plus : ils seront recalcules
        $pdo->prepare("DELETE FROM match_scores WHERE job_id IN ($in)")->execute($vus);
    }
    // Ceux qui ont depasse leur date de validite se ferment aussi.
    $pdo->prepare('UPDATE jobs SET statut = "fermee", updated_at = ? WHERE statut = "publiee" AND expires_at IS NOT NULL AND expires_at < ?')
        ->execute([maintenant(), maintenant()]);
    return ['lus' => $n, 'crees' => $crees, 'mis_a_jour' => $n - $crees, 'fermes' => $fermes];
}

/* ---------------------------------------------------------------- HTTP */

/** GET sortant : curl si present (redirections, delais, CA du systeme), flux sinon. */
function httpGet(string $url, int $timeout = 30, array $entetes = []): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 15, CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => array_merge(['User-Agent: adopte-un-job/1.0', 'Accept: */*'], $entetes),
            CURLOPT_SSL_VERIFYPEER => !SSL_INSECURE,
        ]);
        $r = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return ($r === false || $code >= 400) ? null : (string) $r;
    }
    $ctx = stream_context_create(['http' => ['timeout' => $timeout, 'follow_location' => 1,
        'header' => "User-Agent: adopte-un-job/1.0\r\n" . implode("\r\n", $entetes)]]);
    $r = @file_get_contents($url, false, $ctx);
    return $r === false ? null : $r;
}

/** POST JSON sortant, memes regles. Rend [code, corps]. */
function httpPostJson(string $url, array $corps, array $entetes = [], int $timeout = 15): array
{
    $json = json_encode($corps, JSON_UNESCAPED_UNICODE);
    $entetes = array_merge(['Content-Type: application/json', 'Accept: application/json', 'User-Agent: adopte-un-job/1.0'], $entetes);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json,
            CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => $timeout, CURLOPT_HTTPHEADER => $entetes,
            CURLOPT_SSL_VERIFYPEER => !SSL_INSECURE,
        ]);
        $r = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return [$r === false ? 0 : $code, $r === false ? '' : (string) $r];
    }
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => $timeout, 'ignore_errors' => true,
        'header' => implode("\r\n", $entetes) . "\r\n", 'content' => $json]]);
    $r = @file_get_contents($url, false, $ctx);
    $code = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
            $code = (int) $m[1];
        }
    }
    return [$code, $r === false ? '' : $r];
}

/* ------------------------------------------------------------- API Apigee */

/**
 * Recherche semantique de l'OPT. Rend null si la cle n'est pas configuree ou
 * si l'appel echoue : le score se passe de ce signal, il ne s'arrete pas.
 */
function optRecherche(string $prompt, array $filtres = [], int $topK = 20, float $distanceMax = 0.8): ?array
{
    if (OPT_API_KEY === '') {
        return null;
    }
    $prompt = mb_substr(trim($prompt), 0, 500);
    $corps = ['options' => ['top_k' => max(1, min(50, $topK)), 'distance_max' => $distanceMax]];
    if (mb_strlen($prompt) >= 3) {
        $corps['prompt'] = $prompt;
    }
    if ($filtres) {
        $corps['filters'] = $filtres;
    }
    [$code, $r] = httpPostJson(OPT_API_BASE . '/avps/search', $corps, ['x-apikey: ' . OPT_API_KEY]);
    if ($code !== 200 || $r === '') {
        return null;
    }
    $d = json_decode($r, true);
    if (!is_array($d) || !isset($d['results'])) {
        return null;                        // 422 prompt_bloque, 401, 500 : on s'en passe
    }
    $out = [];
    foreach ($d['results'] as $x) {
        $out[(string) ($x['id_avp'] ?? '')] = (float) ($x['distance'] ?? 1.0);
    }
    return $out;
}

/** Le prompt de recherche construit depuis le profil : jamais de nom ni de contact. */
function promptDepuisProfil(array $p): string
{
    $parts = [];
    foreach (array_slice($p['metiersOpt'] ?? [], 0, 2) as $m) {
        $parts[] = $m['nom'];
    }
    $parts = array_merge($parts, array_slice($p['competences'] ?? [], 0, 6));
    if (!empty($p['formations'][0]['domaine'])) {
        $parts[] = $p['formations'][0]['domaine'];
    }
    return mb_substr(implode(' · ', array_filter($parts)), 0, 500);
}

/** Detail d'un metier via l'API metiers-opt (si cle), sinon depuis la base. */
function metierOptDetail(PDO $pdo, string $code): ?array
{
    $m = metierOpt($pdo, $code);
    if (!$m) {
        return null;
    }
    $m['competences'] = competencesDuMetier($pdo, $code, 40);
    return $m;
}

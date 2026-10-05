<?php
/**
 * Adopte un Job — candidatures, dossier, match.
 *
 * Le « oui » d'un candidat sur une offre EST une candidature. L'organisation
 * la voit anonyme, classee par score, et la traite : preselection (= match :
 * le contact s'ouvre et le dossier — CV genere + CV d'origine — est remis),
 * entretien, acceptee, refusee. Le candidat peut la retirer. Chaque
 * changement est un evenement journalise, et une notification (plus un
 * e-mail mis en file, jamais envoye pour l'instant).
 */

declare(strict_types=1);

require_once __DIR__ . '/documents.php';

const STATUTS_CANDIDATURE = ['envoyee', 'vue', 'preselection', 'entretien', 'acceptee', 'refusee', 'retiree'];
/** A partir de la, le contact et le dossier sont ouverts a l'organisation. */
const STATUTS_OUVERTS = ['preselection', 'entretien', 'acceptee'];

function candidatureParId(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare(
        'SELECT a.*, j.company_id, j.titre, j.statut AS offre_statut FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?'
    );
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

/** La candidature de celui qui la demande. Sinon 403. */
function accesCandidature(PDO $pdo, array $u, int $id): array
{
    $a = candidatureParId($pdo, $id);
    if (!$a) {
        erreur('introuvable', 'Cette candidature n’existe pas.', 404);
    }
    if ((int) $a['candidate_id'] !== (int) $u['id']) {
        erreur('interdit', 'Cette candidature ne te concerne pas.', 403);
    }
    return $a;
}

function evenement(PDO $pdo, int $appId, ?int $acteur, string $type, array $payload = []): void
{
    $pdo->prepare('INSERT INTO application_events (application_id, acteur_id, type, payload, created_at) VALUES (?,?,?,?,?)')
        ->execute([$appId, $acteur, $type, json_encode($payload, JSON_UNESCAPED_UNICODE), maintenant()]);
}

/**
 * Cree (ou reactive) la candidature d'un candidat sur une offre. Rend la
 * ligne. Appele par POST candidatures et par le swipe « oui ».
 */
function candidate(PDO $pdo, int $candId, array $o, string $message = ''): array
{
    if ($o['statut'] !== 'publiee' || ($o['expires_at'] !== null && $o['expires_at'] <= maintenant())) {
        erreur('offre_close', 'Cette offre est close : on peut s’entraîner dessus, pas y candidater.', 409);
    }
    $st = $pdo->prepare('SELECT * FROM applications WHERE job_id = ? AND candidate_id = ?');
    $st->execute([(int) $o['id'], $candId]);
    $exist = $st->fetch();
    $cv = cvActif($pdo, $candId);
    $c = candidatPourScore($pdo, $candId);
    $e = $c ? evalue($pdo, $c, garnisOffre($pdo, $o)) : null;
    if ($e) {
        memoriseScore($pdo, (int) $o['id'], $candId, $e);
    }
    if ($exist && $exist['statut'] !== 'retiree') {
        return $exist;
    }
    // Photographie du score au moment du geste : le tableau de bord la lit,
    // meme apres que le cache des scores a ete efface.
    $detail = $e ? json_encode($e['detail'], JSON_UNESCAPED_UNICODE) : null;
    if ($exist) {
        $pdo->prepare('UPDATE applications SET statut = "envoyee", message = ?, resume_id = ?, qualite = ?, detail = ?, updated_at = ?, decided_at = NULL, decided_by = NULL WHERE id = ?')
            ->execute([mb_substr($message, 0, 2000) ?: null, $cv['id'] ?? null, $e['qualite'] ?? null, $detail, maintenant(), (int) $exist['id']]);
        $appId = (int) $exist['id'];
    } else {
        $pdo->prepare(
            'INSERT INTO applications (job_id, candidate_id, statut, resume_id, message, qualite, detail, created_at, updated_at)
             VALUES (?,?,"envoyee",?,?,?,?,?,?)'
        )->execute([(int) $o['id'], $candId, $cv['id'] ?? null, mb_substr($message, 0, 2000) ?: null, $e['qualite'] ?? null, $detail, maintenant(), maintenant()]);
        $appId = (int) $pdo->lastInsertId();
    }
    // le swipe suit : le deck ne doit plus proposer cette offre
    $pdo->prepare(
        'INSERT INTO swipes (sens, job_id, candidate_id, acteur_id, decision, created_at) VALUES ("candidat",?,?,?,"oui",?)
         ON DUPLICATE KEY UPDATE decision = "oui", created_at = VALUES(created_at)'
    )->execute([(int) $o['id'], $candId, $candId, maintenant()]);
    evenement($pdo, $appId, $candId, 'envoyee', ['qualite' => $e['qualite'] ?? null]);
    trace($candId, 'candidature', 'job', (int) $o['id']);
    return candidatureParId($pdo, $appId);
}

/** La candidature telle que le candidat la voit. */
function candidaturePublique(PDO $pdo, array $a): array
{
    $o = offrePublique(garnisOffre($pdo, offreParId($pdo, (int) $a['job_id'])));
    $ouvert = in_array($a['statut'], STATUTS_OUVERTS, true);
    $out = [
        'id' => (int) $a['id'], 'statut' => $a['statut'], 'message' => $a['message'],
        'qualite' => $a['qualite'] === null ? null : (int) $a['qualite'],
        'creee' => $a['created_at'], 'maj' => $a['updated_at'], 'decidee' => $a['decided_at'],
        'match' => $a['match_id'] === null ? null : (int) $a['match_id'],
        'offre' => $o,
        'dossier' => [
            'cvGenere' => true,
            'cvOriginal' => (bool) ($a['resume_id'] ?? null) && cvAFichier($pdo, (int) $a['resume_id']),
            'ouvertPourOrganisation' => $ouvert,
        ],
    ];
    return $out;
}

function cvAFichier(PDO $pdo, int $resumeId): bool
{
    $st = $pdo->prepare('SELECT storage_key FROM resumes WHERE id = ?');
    $st->execute([$resumeId]);
    $k = $st->fetchColumn();
    return is_string($k) && $k !== '';
}

/* ----------------------------------------------------------------- routes */

if (route('POST', 'candidatures', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];
    limite('candidature:' . $id, 40, 3600);
    $manques = manquesProfil($pdo, $id);
    if ($manques) {
        envoie(['erreur' => 'profil_incomplet', 'message' => 'Complète ton profil avant de candidater.', 'manques' => $manques], 409);
    }
    $o = offreParId($pdo, (int) champ('offre', 0));
    if (!$o) {
        erreur('introuvable', 'Cette offre n’existe pas.', 404);
    }
    $a = candidate($pdo, $id, $o, (string) champ('message', ''));
    envoie(['candidature' => candidaturePublique($pdo, $a)], 201);
}

if (route('GET', 'candidatures', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $statut = in_array($_GET['statut'] ?? '', STATUTS_CANDIDATURE, true) ? $_GET['statut'] : '';
    $st = $pdo->prepare('SELECT a.*, j.company_id, j.titre FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.candidate_id = ?'
        . ($statut ? ' AND a.statut = ?' : '') . ' ORDER BY a.updated_at DESC');
    $st->execute($statut ? [(int) $u['id'], $statut] : [(int) $u['id']]);
    envoie(['candidatures' => array_map(static fn ($a) => candidaturePublique($pdo, $a), $st->fetchAll())]);
}

if (($a = route('GET', 'candidatures/*', $seg, $methode)) !== false && ctype_digit($a[0])) {
    $u = exigeConnexion();
    $cand = accesCandidature($pdo, $u, (int) $a[0]);
    $out = ['candidature' => candidaturePublique($pdo, $cand)];
    $st = $pdo->prepare('SELECT type, payload, created_at, acteur_id FROM application_events WHERE application_id = ? ORDER BY id');
    $st->execute([(int) $cand['id']]);
    $out['evenements'] = array_map(static fn ($e) => ['type' => $e['type'], 'quand' => $e['created_at'], 'moi' => (int) $e['acteur_id'] === (int) $u['id'], 'donnees' => json_decode((string) $e['payload'], true)], $st->fetchAll());
    envoie($out);
}

/* Retirer sa candidature. C'est le seul changement de statut qui vienne du
   candidat : les autres (vue, preselection, entretien) sont des decisions de
   l'employeur, prises hors de l'application. */
if (($a = route('PUT', 'candidatures/*/statut', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $cand = accesCandidature($pdo, $u, (int) $a[0]);
    if ((string) champ('statut', '') !== 'retiree') {
        erreur('statut_invalide', 'Statut attendu : retiree.', 422);
    }
    $pdo->prepare('UPDATE applications SET statut = "retiree", updated_at = ? WHERE id = ?')
        ->execute([maintenant(), (int) $cand['id']]);
    evenement($pdo, (int) $cand['id'], (int) $u['id'], 'retiree', ['motif' => mb_substr((string) champ('motif', ''), 0, 500) ?: null]);
    trace((int) $u['id'], 'statut_candidature_retiree', 'application', (int) $cand['id']);
    synchroniseEquipe($pdo, (int) $u['id'], false);
    envoie(['candidature' => candidaturePublique($pdo, candidatureParId($pdo, (int) $cand['id']))]);
}

/* Le CV genere, recentre sur le poste. */
if (($a = route('GET', 'candidatures/*/cv.pdf', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $cand = accesCandidature($pdo, $u, (int) $a[0]);
    $p = profilComplet($pdo, (int) $cand['candidate_id']);
    $garni = garnisOffre($pdo, offreParId($pdo, (int) $cand['job_id']));
    $c = candidatPourScore($pdo, (int) $cand['candidate_id']);
    $e = $c ? evalue($pdo, $c, $garni) : null;
    $st = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $st->execute([(int) $cand['candidate_id']]);
    $pdfBin = cvPdf($p, offrePublique($garni), $e, true, (string) $st->fetchColumn());
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="cv-' . (int) $cand['id'] . '.pdf"');
    header('Cache-Control: no-store');
    entetesSecurite();
    echo $pdfBin;
    exit;
}

/* Le CV d'origine, tel que depose (dechiffre a la volee). */
if (($a = route('GET', 'candidatures/*/cv-original', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $cand = accesCandidature($pdo, $u, (int) $a[0]);
    $r = null;
    if ($cand['resume_id']) {
        $st = $pdo->prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?');
        $st->execute([(int) $cand['resume_id'], (int) $cand['candidate_id']]);
        $r = $st->fetch() ?: null;
    }
    if (!$r || !$r['storage_key']) {
        erreur('introuvable', 'Aucun fichier de CV n’est joint à cette candidature.', 404);
    }
    $clair = litFichier($r['storage_key'], (string) $r['enc_iv'], (string) $r['enc_tag']);
    if ($clair === null) {
        erreur('introuvable', 'Le fichier n’est plus disponible.', 404);
    }
    header('Content-Type: ' . ($r['mime'] ?: 'application/pdf'));
    header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $r['filename']) . '"');
    header('Cache-Control: no-store');
    entetesSecurite();
    echo $clair;
    exit;
}

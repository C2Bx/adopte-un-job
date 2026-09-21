<?php
/**
 * Adopte un Job — l'agenda des entretiens.
 *
 * L'organisation propose des creneaux sur une candidature ouverte ; le candidat
 * en confirme un (les autres s'annulent) ou refuse ; chacun voit son agenda,
 * et un fichier .ics par entretien pour l'ajouter a son calendrier. Les
 * heures sont stockees en UTC et rendues telles quelles : l'affichage local
 * est le travail du client.
 */

declare(strict_types=1);

require_once __DIR__ . '/candidatures.php';

function entretienParId(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare('SELECT e.*, j.titre, j.company_id, c.name AS organisation FROM entretiens e JOIN jobs j ON j.id = e.job_id JOIN companies c ON c.id = j.company_id WHERE e.id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

function entretienPublic(PDO $pdo, array $e, string $cote): array
{
    $out = [
        'id' => (int) $e['id'], 'candidature' => (int) $e['application_id'], 'offre' => (int) $e['job_id'],
        'titre' => $e['titre'], 'organisation' => $e['organisation'],
        'debut' => $e['debut_utc'], 'duree' => (int) $e['duree_min'], 'mode' => $e['mode'], 'lieu' => $e['lieu'],
        'notes' => $e['notes'], 'statut' => $e['statut'], 'proposeParMoi' => false,
    ];
    if ($cote === 'organisation') {
        $p = profilComplet($pdo, (int) $e['candidate_id']);
        $out['candidat'] = ['id' => (int) $e['candidate_id'], 'prenom' => $p['prenom'], 'nom' => $p['nom'], 'telephone' => $p['telephone']];
    }
    return $out;
}

/* ----------------------------------------------------------------- routes */

/* Mon agenda : a venir d'abord, puis le passe. Le candidat voit ses entretiens ;
   l'organisation voit tous ceux de ses offres, quel que soit le collegue qui
   les a proposes — c'est le point de la vue par groupe. */
if (route('GET', 'agenda', $seg, $methode) !== false) {
    $u = exigeConnexion();
    $depuis = gmdate('Y-m-d H:i:s', time() - 90 * 86400);
    if ($u['role'] === 'candidat') {
        $st = $pdo->prepare('SELECT e.*, j.titre, j.company_id, c.name AS organisation FROM entretiens e JOIN jobs j ON j.id = e.job_id JOIN companies c ON c.id = j.company_id WHERE e.candidate_id = ? AND e.debut_utc > ? ORDER BY e.debut_utc');
        $st->execute([(int) $u['id'], $depuis]);
        $cote = 'candidat';
    } else {
        $org = organisationDe($pdo, $u);
        $st = $pdo->prepare('SELECT e.*, j.titre, j.company_id, c.name AS organisation FROM entretiens e JOIN jobs j ON j.id = e.job_id JOIN companies c ON c.id = j.company_id WHERE j.company_id = ? AND e.debut_utc > ? ORDER BY e.debut_utc');
        $st->execute([(int) $org['id'], $depuis]);
        $cote = 'organisation';
    }
    $liste = array_map(static function ($e) use ($pdo, $cote, $u) {
        $x = entretienPublic($pdo, $e, $cote);
        $x['proposeParMoi'] = (int) $e['propose_par'] === (int) $u['id'];
        return $x;
    }, $st->fetchAll());
    envoie(['entretiens' => $liste, 'maintenant' => maintenant()]);
}

/* Proposer un ou plusieurs creneaux sur une candidature ouverte. */
if (($a = route('POST', 'candidatures/*/entretiens', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    [$cand, $cote] = accesCandidature($pdo, $u, (int) $a[0]);
    if ($cote !== 'organisation') {
        erreur('interdit', 'Seule l’organisation propose des créneaux.', 403);
    }
    if (!in_array($cand['statut'], STATUTS_OUVERTS, true)) {
        erreur('candidature_fermee', 'Présélectionne d’abord la candidature.', 409);
    }
    $creneaux = (array) champ('creneaux', []);
    if (!$creneaux && champ('debut')) {
        $creneaux = [['debut' => champ('debut')]];
    }
    if (!$creneaux || count($creneaux) > 6) {
        erreur('creneaux_invalides', 'Entre un et six créneaux.', 422);
    }
    $duree = max(15, min(240, (int) champ('duree', 45)));
    $mode = in_array(champ('mode'), ['sur place', 'visio', 'telephone'], true) ? champ('mode') : 'sur place';
    $lieu = mb_substr((string) champ('lieu', ''), 0, 190);
    $notes = mb_substr((string) champ('notes', ''), 0, 1000);
    $ins = $pdo->prepare(
        'INSERT INTO entretiens (application_id, job_id, candidate_id, propose_par, debut_utc, duree_min, mode, lieu, notes, statut, uid_ics, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,"propose",?,?,?)'
    );
    $ids = [];
    foreach ($creneaux as $c) {
        $d = (string) ($c['debut'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/', $d)) {
            erreur('date_invalide', 'Chaque créneau doit être au format AAAA-MM-JJ HH:MM (UTC).', 422);
        }
        $utc = gmdate('Y-m-d H:i:s', strtotime(str_replace('T', ' ', substr($d, 0, 16)) . ' UTC'));
        if ($utc < maintenant()) {
            erreur('date_passee', 'Un créneau ne peut pas être dans le passé.', 422);
        }
        $ins->execute([(int) $cand['id'], (int) $cand['job_id'], (int) $cand['candidate_id'], (int) $u['id'], $utc, $duree, $mode, $lieu ?: null, $notes ?: null,
            sprintf('%s@adopte-un-job', bin2hex(random_bytes(16))), maintenant(), maintenant()]);
        $ids[] = (int) $pdo->lastInsertId();
    }
    if ($cand['statut'] === 'preselection') {
        $pdo->prepare('UPDATE applications SET statut = "entretien", updated_at = ? WHERE id = ?')->execute([maintenant(), (int) $cand['id']]);
    }
    evenement($pdo, (int) $cand['id'], (int) $u['id'], 'creneaux_proposes', ['n' => count($ids)]);
    notifie((int) $cand['candidate_id'], 'entretien_propose', ['candidature' => (int) $cand['id'], 'titre' => $cand['titre'], 'n' => count($ids)]);
    $st = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $st->execute([(int) $cand['candidate_id']]);
    enfileMail((int) $cand['candidate_id'], (string) $st->fetchColumn(), 'Proposition d’entretien — ' . $cand['titre'],
        count($ids) . ' créneau(x) vous sont proposés pour un entretien. Choisissez-en un dans l’application.', 'entretien', $ids[0]);
    trace((int) $u['id'], 'creneaux_proposes', 'application', (int) $cand['id']);
    envoie(['entretiens' => array_map(static fn ($i) => entretienPublic($pdo, entretienParId($pdo, $i), 'organisation'), $ids)], 201);
}

/* Le candidat repond : confirme (les autres propositions de la meme
   candidature s'annulent) ou refuse. L'organisation annule ou termine. */
if (($a = route('PUT', 'entretiens/*', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $e = entretienParId($pdo, (int) $a[0]);
    if (!$e) {
        erreur('introuvable', 'Cet entretien n’existe pas.', 404);
    }
    [$cand, $cote] = accesCandidature($pdo, $u, (int) $e['application_id']);
    $s = (string) champ('statut', '');
    $permis = $cote === 'candidat' ? ['confirme', 'refuse'] : ['annule', 'termine', 'confirme'];
    if (!in_array($s, $permis, true)) {
        erreur('statut_invalide', 'Statut attendu : ' . implode(', ', $permis) . '.', 422);
    }
    $pdo->prepare('UPDATE entretiens SET statut = ?, updated_at = ? WHERE id = ?')->execute([$s, maintenant(), (int) $e['id']]);
    if ($s === 'confirme') {
        $pdo->prepare('UPDATE entretiens SET statut = "annule", updated_at = ? WHERE application_id = ? AND id <> ? AND statut = "propose"')
            ->execute([maintenant(), (int) $e['application_id'], (int) $e['id']]);
    }
    evenement($pdo, (int) $cand['id'], (int) $u['id'], 'entretien_' . $s, ['entretien' => (int) $e['id'], 'debut' => $e['debut_utc']]);
    if ($cote === 'candidat') {
        foreach (membresIds($pdo, (int) $e['company_id']) as $m) {
            notifie($m, 'entretien_' . $s, ['entretien' => (int) $e['id'], 'candidature' => (int) $cand['id'], 'titre' => $e['titre']]);
        }
    } else {
        notifie((int) $e['candidate_id'], 'entretien_' . $s, ['entretien' => (int) $e['id'], 'candidature' => (int) $cand['id'], 'titre' => $e['titre']]);
    }
    trace((int) $u['id'], 'entretien_' . $s, 'entretien', (int) $e['id']);
    envoie(['entretien' => entretienPublic($pdo, entretienParId($pdo, (int) $e['id']), $cote)]);
}

if (($a = route('GET', 'entretiens/*/ics', $seg, $methode)) !== false) {
    $u = exigeConnexion();
    $e = entretienParId($pdo, (int) $a[0]);
    if (!$e) {
        erreur('introuvable', 'Cet entretien n’existe pas.', 404);
    }
    accesCandidature($pdo, $u, (int) $e['application_id']);
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="entretien-' . (int) $e['id'] . '.ics"');
    header('Cache-Control: no-store');
    entetesSecurite();
    echo ics($e, $e['titre'], $e['organisation']);
    exit;
}

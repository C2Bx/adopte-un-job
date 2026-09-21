<?php
/**
 * Adopte un Job — le tableau de bord de l'organisation.
 *
 * Tous les chiffres sont calcules par le serveur, sur TOUTES les lignes de
 * l'organisation, jamais sur un echantillon. Une periode (7, 30, 90, 365
 * jours) borne les series ; les totaux sont ceux de la periode. Chaque
 * indicateur est nomme par ce qu'il compte, et la definition est renvoyee avec
 * lui : un chiffre qu'on ne sait pas lire n'est pas un indicateur.
 */

declare(strict_types=1);

require_once __DIR__ . '/organisation.php';

function periode(): int
{
    $p = (int) ($_GET['periode'] ?? 30);
    return in_array($p, [7, 30, 90, 365], true) ? $p : 30;
}

/** Une requete scalaire sur l'organisation. */
function nombre(PDO $pdo, string $sql, array $p): int
{
    $st = $pdo->prepare($sql);
    $st->execute($p);
    return (int) $st->fetchColumn();
}

function serieParJour(PDO $pdo, string $sql, array $p, int $jours): array
{
    $st = $pdo->prepare($sql);
    $st->execute($p);
    $m = [];
    foreach ($st->fetchAll() as $r) {
        $m[$r['jour']] = (int) $r['n'];
    }
    $out = [];
    for ($i = $jours - 1; $i >= 0; $i--) {
        $j = gmdate('Y-m-d', time() - $i * 86400);
        $out[] = ['jour' => $j, 'n' => $m[$j] ?? 0];
    }
    return $out;
}

/**
 * Le tableau de bord d'une organisation, ou d'une seule offre si $jobId.
 * La clause $ou restreint toutes les requetes ; c'est la meme pour toutes.
 */
function tableauDeBord(PDO $pdo, int $orgId, ?int $jobId, int $jours): array
{
    $depuis = gmdate('Y-m-d H:i:s', time() - $jours * 86400);
    $ou = 'j.company_id = ?' . ($jobId ? ' AND j.id = ?' : '');
    $pj = $jobId ? [$orgId, $jobId] : [$orgId];

    // ---- volumes de la periode
    $vues = nombre($pdo, "SELECT COUNT(*) FROM job_views v JOIN jobs j ON j.id = v.job_id WHERE $ou AND v.created_at >= ?", [...$pj, $depuis]);
    $vuesUniques = nombre($pdo, "SELECT COUNT(DISTINCT COALESCE(v.viewer_id, v.ip_hash)) FROM job_views v JOIN jobs j ON j.id = v.job_id WHERE $ou AND v.created_at >= ?", [...$pj, $depuis]);
    $candidatures = nombre($pdo, "SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou AND a.created_at >= ?", [...$pj, $depuis]);
    $candidatsUniques = nombre($pdo, "SELECT COUNT(DISTINCT a.candidate_id) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou AND a.created_at >= ?", [...$pj, $depuis]);
    $swipesNon = nombre($pdo, "SELECT COUNT(*) FROM swipes s JOIN jobs j ON j.id = s.job_id WHERE $ou AND s.sens = 'candidat' AND s.decision = 'non' AND s.created_at >= ?", [...$pj, $depuis]);
    $swipesPlusTard = nombre($pdo, "SELECT COUNT(*) FROM swipes s JOIN jobs j ON j.id = s.job_id WHERE $ou AND s.sens = 'candidat' AND s.decision = 'plus_tard' AND s.created_at >= ?", [...$pj, $depuis]);
    $matchs = nombre($pdo, "SELECT COUNT(*) FROM matches m JOIN jobs j ON j.id = m.job_id WHERE $ou AND m.created_at >= ?", [...$pj, $depuis]);
    $entretiens = nombre($pdo, "SELECT COUNT(*) FROM entretiens e JOIN jobs j ON j.id = e.job_id WHERE $ou AND e.statut IN ('propose','confirme','termine') AND e.created_at >= ?", [...$pj, $depuis]);
    $entretiensAVenir = nombre($pdo, "SELECT COUNT(*) FROM entretiens e JOIN jobs j ON j.id = e.job_id WHERE $ou AND e.statut = 'confirme' AND e.debut_utc >= ?", [...$pj, maintenant()]);
    $messages = nombre($pdo, "SELECT COUNT(*) FROM messages x JOIN matches m ON m.id = x.match_id JOIN jobs j ON j.id = m.job_id WHERE $ou AND x.created_at >= ?", [...$pj, $depuis]);

    // ---- par statut (etat courant, toutes periodes : une file se lit maintenant)
    $st = $pdo->prepare("SELECT a.statut, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou GROUP BY a.statut");
    $st->execute($pj);
    $parStatut = array_fill_keys(STATUTS_CANDIDATURE, 0);
    foreach ($st->fetchAll() as $r) {
        $parStatut[$r['statut']] = (int) $r['n'];
    }
    $refus = $parStatut['refusee'];
    $decidees = $parStatut['preselection'] + $parStatut['entretien'] + $parStatut['acceptee'] + $parStatut['refusee'];
    $enAttente = $parStatut['envoyee'] + $parStatut['vue'];

    // ---- delais (heures) : publication -> 1re candidature, candidature -> decision
    $st = $pdo->prepare("SELECT AVG(TIMESTAMPDIFF(HOUR, j.published_at, a.created_at)) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou AND a.created_at >= ? AND j.published_at IS NOT NULL");
    $st->execute([...$pj, $depuis]);
    $delaiPremiere = $st->fetchColumn();
    $st = $pdo->prepare("SELECT AVG(TIMESTAMPDIFF(HOUR, a.created_at, a.decided_at)) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou AND a.decided_at IS NOT NULL AND a.decided_at >= ?");
    $st->execute([...$pj, $depuis]);
    $delaiDecision = $st->fetchColumn();
    $st = $pdo->prepare("SELECT AVG(TIMESTAMPDIFF(HOUR, a.created_at, a.vue_at)) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou AND a.vue_at IS NOT NULL AND a.created_at >= ?");
    $st->execute([...$pj, $depuis]);
    $delaiVue = $st->fetchColumn();

    // ---- qualite : score moyen des candidatures, part >= 70
    $st = $pdo->prepare("SELECT AVG(a.qualite), SUM(a.qualite >= 70), COUNT(a.qualite) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou AND a.created_at >= ? AND a.qualite IS NOT NULL");
    $st->execute([...$pj, $depuis]);
    [$scoreMoyen, $scoreBons, $scoreN] = $st->fetch(PDO::FETCH_NUM);

    // ---- series par jour
    $sVues = serieParJour($pdo, "SELECT DATE(v.created_at) AS jour, COUNT(*) AS n FROM job_views v JOIN jobs j ON j.id = v.job_id WHERE $ou AND v.created_at >= ? GROUP BY jour", [...$pj, $depuis], $jours);
    $sCand = serieParJour($pdo, "SELECT DATE(a.created_at) AS jour, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou AND a.created_at >= ? GROUP BY jour", [...$pj, $depuis], $jours);
    $sMatch = serieParJour($pdo, "SELECT DATE(m.created_at) AS jour, COUNT(*) AS n FROM matches m JOIN jobs j ON j.id = m.job_id WHERE $ou AND m.created_at >= ? GROUP BY jour", [...$pj, $depuis], $jours);
    $sRefus = serieParJour($pdo, "SELECT DATE(a.decided_at) AS jour, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE $ou AND a.statut = 'refusee' AND a.decided_at >= ? GROUP BY jour", [...$pj, $depuis], $jours);

    // ---- repartitions des candidats de la periode
    $rep = static function (string $sql) use ($pdo, $pj, $depuis, $ou): array {
        $st = $pdo->prepare(str_replace('{OU}', $ou, $sql));
        $st->execute([...$pj, $depuis]);
        return array_map(static fn ($r) => ['valeur' => (string) $r['v'], 'n' => (int) $r['n']], $st->fetchAll());
    };
    $parZone = $rep("SELECT z.zone AS v, COUNT(DISTINCT a.candidate_id) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN candidate_zones z ON z.user_id = a.candidate_id WHERE {OU} AND a.created_at >= ? GROUP BY z.zone ORDER BY n DESC");
    $parNiveau = $rep("SELECT COALESCE(c.formation_max, 0) AS v, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN candidates c ON c.user_id = a.candidate_id WHERE {OU} AND a.created_at >= ? GROUP BY c.formation_max ORDER BY v");
    $parMetier = $rep("SELECT m.nom AS v, COUNT(DISTINCT a.candidate_id) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN candidate_opt_metiers cm ON cm.user_id = a.candidate_id JOIN opt_metiers m ON m.code_metier = cm.code_metier WHERE {OU} AND a.created_at >= ? GROUP BY m.nom ORDER BY n DESC LIMIT 10");
    $parExperience = $rep("SELECT CASE WHEN c.experience_ans IS NULL THEN 'non renseigné' WHEN c.experience_ans = 0 THEN 'débutant' WHEN c.experience_ans < 3 THEN '1-2 ans' WHEN c.experience_ans < 6 THEN '3-5 ans' ELSE '6 ans et plus' END AS v, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN candidates c ON c.user_id = a.candidate_id WHERE {OU} AND a.created_at >= ? GROUP BY v ORDER BY n DESC");
    $parSource = $rep("SELECT v.source AS v, COUNT(*) AS n FROM job_views v JOIN jobs j ON j.id = v.job_id WHERE {OU} AND v.created_at >= ? GROUP BY v.source ORDER BY n DESC");

    // ---- competences les plus souvent manquantes chez les candidats (depuis le detail des scores)
    // La photographie prise a la candidature d'abord ; le cache des scores
    // (efface a chaque synchronisation ou modification de profil) en secours.
    $st = $pdo->prepare("SELECT COALESCE(a.detail, ms.detail) AS detail FROM applications a JOIN jobs j ON j.id = a.job_id LEFT JOIN match_scores ms ON ms.job_id = a.job_id AND ms.candidate_id = a.candidate_id WHERE $ou AND a.created_at >= ? AND a.statut <> 'retiree' LIMIT 500");
    $st->execute([...$pj, $depuis]);
    $manques = [];
    $forces = [];
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $d) {
        $d = json_decode((string) $d, true) ?: [];
        foreach ((array) ($d['structurel']['manque'] ?? []) as $x) {
            $manques[$x['nom']] = ($manques[$x['nom']] ?? 0) + 1;
        }
        foreach ((array) ($d['structurel']['ok'] ?? []) as $x) {
            $forces[$x['nom']] = ($forces[$x['nom']] ?? 0) + 1;
        }
    }
    arsort($manques);
    arsort($forces);
    $top = static fn (array $m) => array_map(static fn ($k, $n) => ['valeur' => $k, 'n' => $n], array_keys(array_slice($m, 0, 8, true)), array_slice($m, 0, 8, true));

    // ---- par offre : le classement
    $st = $pdo->prepare(
        "SELECT j.id, j.titre, j.statut, j.published_at, j.expires_at, j.code_metier, j.ville, j.source,
                (SELECT COUNT(*) FROM job_views v WHERE v.job_id = j.id AND v.created_at >= ?) AS vues,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS candidatures,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.statut IN ('envoyee','vue')) AS en_attente,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.statut = 'refusee') AS refus,
                (SELECT COUNT(*) FROM matches m WHERE m.job_id = j.id) AS matchs,
                (SELECT COUNT(*) FROM entretiens e WHERE e.job_id = j.id AND e.statut IN ('confirme','termine')) AS entretiens,
                (SELECT AVG(a.qualite) FROM applications a WHERE a.job_id = j.id) AS score_moyen,
                (SELECT COUNT(*) FROM swipes s WHERE s.job_id = j.id AND s.sens = 'candidat' AND s.decision = 'non') AS ecartee
           FROM jobs j WHERE $ou ORDER BY j.statut = 'publiee' DESC, candidatures DESC, vues DESC LIMIT 100"
    );
    $st->execute([$depuis, ...$pj]);
    $offres = array_map(static fn ($r) => [
        'id' => (int) $r['id'], 'titre' => $r['titre'], 'statut' => $r['statut'], 'source' => $r['source'], 'ville' => $r['ville'],
        'publiee' => $r['published_at'], 'expire' => $r['expires_at'],
        'joursRestants' => $r['expires_at'] ? (int) floor((strtotime($r['expires_at'] . ' UTC') - time()) / 86400) : null,
        'vues' => (int) $r['vues'], 'candidatures' => (int) $r['candidatures'], 'enAttente' => (int) $r['en_attente'],
        'refus' => (int) $r['refus'], 'matchs' => (int) $r['matchs'], 'entretiens' => (int) $r['entretiens'],
        'ecartee' => (int) $r['ecartee'],
        'scoreMoyen' => $r['score_moyen'] === null ? null : (int) round((float) $r['score_moyen']),
        'tauxConversion' => (int) $r['vues'] > 0 ? round((int) $r['candidatures'] / (int) $r['vues'] * 100, 1) : null,
    ], $st->fetchAll());

    // ---- activite de l'equipe
    $st = $pdo->prepare("SELECT u.email, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.decided_by WHERE $ou AND a.decided_at >= ? GROUP BY u.email ORDER BY n DESC");
    $st->execute([...$pj, $depuis]);
    $equipe = array_map(static fn ($r) => ['valeur' => $r['email'], 'n' => (int) $r['n']], $st->fetchAll());

    $pct = static fn (int $a, int $b) => $b > 0 ? round($a / $b * 100, 1) : null;

    return [
        'periode' => $jours,
        'offre' => $jobId,
        'indicateurs' => [
            ['cle' => 'vues', 'libelle' => 'Vues', 'valeur' => $vues, 'detail' => "$vuesUniques personnes distinctes", 'definition' => 'Ouvertures d’une offre (deck, fiche, recherche, lien), au plus une par personne, par offre et par jour.'],
            ['cle' => 'candidatures', 'libelle' => 'Candidatures reçues', 'valeur' => $candidatures, 'detail' => "$candidatsUniques candidats", 'definition' => 'Un « oui » d’un candidat sur une offre, sur la période.'],
            ['cle' => 'conversion', 'libelle' => 'Taux de conversion', 'valeur' => $pct($candidatures, $vues), 'unite' => '%', 'definition' => 'Candidatures rapportées aux vues, sur la période.'],
            ['cle' => 'en_attente', 'libelle' => 'À traiter', 'valeur' => $enAttente, 'definition' => 'Candidatures envoyées ou vues, sans décision. État courant, toutes périodes.'],
            ['cle' => 'matchs', 'libelle' => 'Présélections (matchs)', 'valeur' => $matchs, 'definition' => 'Candidatures présélectionnées : le contact et le dossier sont ouverts.'],
            ['cle' => 'refus', 'libelle' => 'Refus', 'valeur' => $refus, 'detail' => $pct($refus, max(1, $decidees)) . ' % des décisions', 'definition' => 'Candidatures refusées (état courant) et leur part parmi les décisions prises.'],
            ['cle' => 'ecartees', 'libelle' => 'Écartées par les candidats', 'valeur' => $swipesNon, 'detail' => "$swipesPlusTard mises de côté", 'definition' => 'Offres passées (« non ») par les candidats dans le deck sur la période — ce que vos offres n’attirent pas.'],
            ['cle' => 'entretiens', 'libelle' => 'Entretiens', 'valeur' => $entretiens, 'detail' => "$entretiensAVenir confirmés à venir", 'definition' => 'Créneaux proposés, confirmés ou tenus sur la période.'],
            ['cle' => 'delai_vue', 'libelle' => 'Délai de prise en compte', 'valeur' => $delaiVue === null ? null : round((float) $delaiVue, 1), 'unite' => 'h', 'definition' => 'Temps moyen entre une candidature et sa première ouverture par l’équipe.'],
            ['cle' => 'delai_decision', 'libelle' => 'Délai de décision', 'valeur' => $delaiDecision === null ? null : round((float) $delaiDecision / 24, 1), 'unite' => 'j', 'definition' => 'Temps moyen entre une candidature et la décision (présélection ou refus).'],
            ['cle' => 'delai_premiere', 'libelle' => 'Première candidature', 'valeur' => $delaiPremiere === null ? null : round((float) $delaiPremiere / 24, 1), 'unite' => 'j', 'definition' => 'Temps moyen entre la publication d’une offre et sa première candidature.'],
            ['cle' => 'score', 'libelle' => 'Score moyen des candidatures', 'valeur' => $scoreMoyen === null ? null : (int) round((float) $scoreMoyen), 'unite' => '%', 'detail' => $scoreN ? "$scoreBons sur $scoreN à 70 % ou plus" : null, 'definition' => 'Compatibilité calculée au moment de la candidature, moyenne sur la période.'],
            ['cle' => 'messages', 'libelle' => 'Messages échangés', 'valeur' => $messages, 'definition' => 'Messages envoyés dans les conversations ouvertes par un match, sur la période.'],
        ],
        'entonnoir' => [
            ['etape' => 'Vues', 'n' => $vues],
            ['etape' => 'Candidatures', 'n' => $candidatures],
            ['etape' => 'Présélections', 'n' => $matchs],
            ['etape' => 'Entretiens', 'n' => $entretiens],
            ['etape' => 'Acceptées', 'n' => $parStatut['acceptee']],
        ],
        'parStatut' => $parStatut,
        'series' => ['vues' => $sVues, 'candidatures' => $sCand, 'matchs' => $sMatch, 'refus' => $sRefus],
        'repartitions' => ['zones' => $parZone, 'niveaux' => $parNiveau, 'metiers' => $parMetier, 'experience' => $parExperience, 'sourcesVues' => $parSource],
        'competences' => ['manquantes' => $top($manques), 'presentes' => $top($forces)],
        'offres' => $offres,
        'equipe' => $equipe,
        'genere' => maintenant(),
    ];
}

/* ----------------------------------------------------------------- routes */

if (route('GET', 'organisation/tableau', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    trace((int) $u['id'], 'tableau_de_bord', 'company', (int) $org['id']);
    envoie(['tableau' => tableauDeBord($pdo, (int) $org['id'], null, periode())]);
}

if (($a = route('GET', 'organisation/tableau/*', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    exigeOffreDeOrganisation($pdo, $org, (int) $a[0]);
    envoie(['tableau' => tableauDeBord($pdo, (int) $org['id'], (int) $a[0], periode())]);
}

/* Export CSV du tableau par offre : ce qu'un tableur ou Power BI ingere. */
if (route('GET', 'organisation/tableau.csv', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    $t = tableauDeBord($pdo, (int) $org['id'], null, periode());
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="tableau-de-bord.csv"');
    entetesSecurite();
    $f = fopen('php://output', 'w');
    fwrite($f, "\xEF\xBB\xBF");
    fputcsv($f, ['id', 'titre', 'statut', 'source', 'ville', 'publiee', 'expire', 'vues', 'candidatures', 'en_attente', 'refus', 'matchs', 'entretiens', 'ecartee', 'score_moyen', 'taux_conversion'], ';');
    foreach ($t['offres'] as $o) {
        fputcsv($f, [$o['id'], $o['titre'], $o['statut'], $o['source'], $o['ville'], $o['publiee'], $o['expire'], $o['vues'], $o['candidatures'], $o['enAttente'], $o['refus'], $o['matchs'], $o['entretiens'], $o['ecartee'], $o['scoreMoyen'], $o['tauxConversion']], ';');
    }
    exit;
}

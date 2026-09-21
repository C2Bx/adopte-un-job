<?php
/**
 * Adopte un Job — le catalogue des AVP, le deck, les vues, le referentiel.
 *
 * Les memes filtres partout (catalogue, deck, tableau de bord), calques sur
 * ceux de l'API OPT (/avps/search) : ville, province, familles, direction,
 * employment_type, encadrement — plus les notres : contrat, teletravail,
 * recherche plein texte. Le deck n'ELIMINE plus rien : tout profil peut
 * postuler a tout poste ; « Ouverture » trie et explique, il ne cache pas.
 */

declare(strict_types=1);

require_once __DIR__ . '/opt.php';
require_once __DIR__ . '/organisation.php';

/* ----------------------------------------------------------------- filtres */

/** Les filtres lus dans la query string, normalises. */
function filtresDemandes(): array
{
    $g = static fn (string $k) => trim((string) ($_GET[$k] ?? ''));
    return [
        'q'          => mb_substr($g('q'), 0, 120),
        'ville'      => mb_substr($g('ville'), 0, 60),
        'province'   => mb_substr($g('province'), 0, 40),
        'famille'    => mb_substr($g('famille'), 0, 60),
        'direction'  => mb_substr($g('direction'), 0, 120),
        'contrat'    => in_array($g('contrat'), CONTRATS, true) ? $g('contrat') : '',
        'zone'       => in_array($g('zone'), ZONES, true) ? $g('zone') : '',
        'teletravail' => $g('teletravail') === '1',
        'encadrement' => $g('encadrement') === '1',
        'debutant'   => $g('debutant') === '1',
        'salaire'    => $g('salaire') === '1',
        'metier'     => mb_substr($g('metier'), 0, 10),
        'source'     => in_array($g('source'), ['app', 'opt'], true) ? $g('source') : '',
        'statut'     => in_array($g('statut'), ['ouvert', 'clos', 'tous'], true) ? $g('statut') : 'ouvert',
    ];
}

/** Traduit les filtres en clause SQL sur l'alias j. Rend [sql, params]. */
function clauseFiltres(array $f, string $alias = 'j'): array
{
    $w = [];
    $p = [];
    if ($f['statut'] === 'ouvert') {
        $w[] = "$alias.statut = 'publiee' AND ($alias.expires_at IS NULL OR $alias.expires_at > ?)";
        $p[] = maintenant();
    } elseif ($f['statut'] === 'clos') {
        $w[] = "($alias.statut = 'fermee' OR ($alias.expires_at IS NOT NULL AND $alias.expires_at <= ?))";
        $p[] = maintenant();
    } else {
        $w[] = "$alias.statut IN ('publiee','fermee')";
    }
    foreach (['ville', 'province', 'direction', 'contrat', 'zone', 'source'] as $k) {
        if ($f[$k] !== '') {
            $w[] = "$alias.$k = ?";
            $p[] = $f[$k];
        }
    }
    if ($f['metier'] !== '') {
        $w[] = "$alias.code_metier = ?";
        $p[] = $f['metier'];
    }
    if ($f['famille'] !== '') {
        $w[] = "JSON_SEARCH($alias.familles, 'one', ?) IS NOT NULL";
        $p[] = $f['famille'];
    }
    if ($f['teletravail']) {
        $w[] = "$alias.teletravail <> 'non'";
    }
    if ($f['encadrement']) {
        $w[] = "$alias.nb_agents_encadres > 0";
    }
    if ($f['debutant']) {
        $w[] = "$alias.experience_min = 0";
    }
    if ($f['salaire']) {
        $w[] = "($alias.salaire_min IS NOT NULL OR $alias.salaire_max IS NOT NULL)";
    }
    if ($f['q'] !== '') {
        // plein texte si possible, LIKE en repli : un mot de deux lettres ne
        // passe pas en FULLTEXT, « SI » ou « RH » doivent quand meme marcher
        if (mb_strlen($f['q']) >= 3 && !preg_match('/[+\-><()~*"@]/', $f['q'])) {
            $w[] = "(MATCH($alias.titre, $alias.texte_recherche) AGAINST (? IN NATURAL LANGUAGE MODE) OR $alias.titre LIKE ?)";
            $p[] = $f['q'];
            $p[] = '%' . $f['q'] . '%';
        } else {
            $w[] = "($alias.titre LIKE ? OR $alias.texte_recherche LIKE ?)";
            $p[] = '%' . $f['q'] . '%';
            $p[] = '%' . $f['q'] . '%';
        }
    }
    return [implode(' AND ', $w), $p];
}

/** Les valeurs disponibles pour chaque filtre, avec leur compte, sur les AVP ouverts. */
function facettes(PDO $pdo, array $f): array
{
    $base = $f;
    $base['statut'] = $f['statut'];
    [$sql, $p] = clauseFiltres(['q' => $f['q'], 'ville' => '', 'province' => '', 'famille' => '', 'direction' => '',
        'contrat' => '', 'zone' => '', 'teletravail' => false, 'encadrement' => false, 'debutant' => false,
        'salaire' => false, 'metier' => '', 'source' => $f['source'], 'statut' => $f['statut']]);
    $out = [];
    foreach (['ville', 'province', 'direction', 'contrat', 'zone', 'source'] as $k) {
        $st = $pdo->prepare("SELECT j.$k AS v, COUNT(*) AS n FROM jobs j WHERE $sql AND j.$k IS NOT NULL AND j.$k <> '' GROUP BY j.$k ORDER BY n DESC, v");
        $st->execute($p);
        $out[$k] = array_map(static fn ($r) => ['valeur' => $r['v'], 'n' => (int) $r['n']], $st->fetchAll());
    }
    $st = $pdo->prepare("SELECT j.familles FROM jobs j WHERE $sql AND j.familles IS NOT NULL");
    $st->execute($p);
    $fam = [];
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $js) {
        foreach ((array) json_decode((string) $js, true) as $x) {
            $fam[$x] = ($fam[$x] ?? 0) + 1;
        }
    }
    arsort($fam);
    $out['famille'] = array_map(static fn ($k, $n) => ['valeur' => $k, 'n' => $n], array_keys($fam), $fam);
    $st = $pdo->prepare("SELECT j.code_metier AS v, m.nom, COUNT(*) AS n FROM jobs j LEFT JOIN opt_metiers m ON m.code_metier = j.code_metier WHERE $sql AND j.code_metier IS NOT NULL GROUP BY j.code_metier, m.nom ORDER BY n DESC");
    $st->execute($p);
    $out['metier'] = array_map(static fn ($r) => ['valeur' => $r['v'], 'nom' => $r['nom'], 'n' => (int) $r['n']], $st->fetchAll());
    foreach ([['teletravail', "j.teletravail <> 'non'"], ['encadrement', 'j.nb_agents_encadres > 0'],
              ['debutant', 'j.experience_min = 0'], ['salaire', '(j.salaire_min IS NOT NULL OR j.salaire_max IS NOT NULL)']] as [$k, $cond]) {
        $st = $pdo->prepare("SELECT COUNT(*) FROM jobs j WHERE $sql AND $cond");
        $st->execute($p);
        $out[$k] = (int) $st->fetchColumn();
    }
    return $out;
}

/** Enregistre une vue, au plus une par personne, par offre et par jour. */
function enregistreVue(PDO $pdo, int $jobId, ?int $viewer, string $source): void
{
    $src = in_array($source, ['deck', 'detail', 'recherche', 'lien'], true) ? $source : 'deck';
    try {
        if ($viewer) {
            $st = $pdo->prepare('SELECT 1 FROM job_views WHERE job_id = ? AND viewer_id = ? AND source = ? AND created_at > ? LIMIT 1');
            $st->execute([$jobId, $viewer, $src, gmdate('Y-m-d H:i:s', time() - 86400)]);
            if ($st->fetch()) {
                return;
            }
        }
        $pdo->prepare('INSERT INTO job_views (job_id, viewer_id, source, created_at, ip_hash) VALUES (?,?,?,?,?)')
            ->execute([$jobId, $viewer, $src, maintenant(), empreinteIp()]);
    } catch (PDOException) {
        // une vue perdue ne casse rien
    }
}

/** L'offre avec son score pour ce candidat (calcule et memorise si absent). */
function offreScoree(PDO $pdo, array $c, array $ligne, ?array $distances = null): array
{
    $garni = garnisOffre($pdo, $ligne);
    $e = evalue($pdo, $c, $garni);
    // signal semantique de l'OPT, en appoint : rapproche la qualite de ce que
    // l'embedding dit, sans jamais dominer
    if ($distances !== null && !empty($garni['external_id']) && isset($distances[$garni['external_id']])) {
        $sem = max(0.0, 1 - $distances[$garni['external_id']]);
        $e['qualite'] = (int) round($e['qualite'] * 0.8 + $sem * 100 * 0.2);
        $e['detail']['semantique'] = round($sem, 2);
    }
    memoriseScore($pdo, (int) $garni['id'], (int) $c['user_id'], $e);
    return offrePublique($garni) + ['score' => scorePublic($e)];
}

/* ------------------------------------------------------------- catalogue */

/* Le catalogue est public : les AVP sont des donnees ouvertes. Sans compte,
   pas de score ; avec un compte candidat, chaque offre porte le sien. */
if (route('GET', 'avp', $seg, $methode) !== false) {
    $f = filtresDemandes();
    [$sql, $p] = clauseFiltres($f);
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $par = 30;
    $st = $pdo->prepare(
        "SELECT j.*, c.name AS entreprise, c.sector AS secteur, c.size AS taille, c.pitch
           FROM jobs j JOIN companies c ON c.id = j.company_id
          WHERE $sql ORDER BY j.published_at DESC LIMIT " . $par . ' OFFSET ' . (($page - 1) * $par)
    );
    $st->execute($p);
    $u = utilisateur();
    $c = ($u && $u['role'] === 'candidat') ? candidatPourScore($pdo, (int) $u['id']) : null;
    $out = [];
    foreach ($st->fetchAll() as $ligne) {
        $out[] = $c && $c['competences'] ? offreScoree($pdo, $c, $ligne) : offrePublique(garnisOffre($pdo, $ligne));
    }
    $st = $pdo->prepare("SELECT COUNT(*) FROM jobs j WHERE $sql");
    $st->execute($p);
    envoie(['offres' => $out, 'total' => (int) $st->fetchColumn(), 'page' => $page, 'filtres' => $f, 'facettes' => facettes($pdo, $f)]);
}

if (route('GET', 'avp/filtres', $seg, $methode) !== false) {
    $f = filtresDemandes();
    envoie(['facettes' => facettes($pdo, $f), 'filtres' => $f]);
}

if (($a = route('GET', 'avp/*', $seg, $methode)) !== false && ctype_digit($a[0])) {
    $o = offreParId($pdo, (int) $a[0]);
    if (!$o || $o['statut'] === 'brouillon') {
        erreur('introuvable', 'Cette offre n’existe pas.', 404);
    }
    $u = utilisateur();
    enregistreVue($pdo, (int) $o['id'], $u ? (int) $u['id'] : null, 'detail');
    $garni = garnisOffre($pdo, $o);
    $out = ['offre' => offrePublique($garni)];
    if ($u && $u['role'] === 'candidat') {
        $c = candidatPourScore($pdo, (int) $u['id']);
        if ($c && $c['competences']) {
            $e = evalue($pdo, $c, $garni);
            memoriseScore($pdo, (int) $o['id'], (int) $u['id'], $e);
            $out['offre']['score'] = scorePublic($e);
        }
        $st = $pdo->prepare('SELECT id, statut FROM applications WHERE job_id = ? AND candidate_id = ?');
        $st->execute([(int) $o['id'], (int) $u['id']]);
        $out['candidature'] = $st->fetch() ?: null;
    }
    // le metier OPT et ses competences attendues, pour lire l'offre au-dela du texte
    if (!empty($o['code_metier'])) {
        $out['metier'] = metierOptDetail($pdo, $o['code_metier']);
    }
    envoie($out);
}

if (($a = route('POST', 'avp/*/vue', $seg, $methode)) !== false) {
    $u = utilisateur();
    enregistreVue($pdo, (int) $a[0], $u ? (int) $u['id'] : null, (string) champ('source', 'deck'));
    envoie(['ok' => true]);
}

/* ------------------------------------------------------------------- deck */

/* Le deck : les offres ouvertes non encore decidees, scorees, triees. Les
   memes filtres que le catalogue, plus la recherche. Rien n'est cache pour
   cause de zone, de contrat ou de metier : ca s'affiche comme un ecart. */
if (route('GET', 'deck', $seg, $methode) !== false) {
    $u = exigeConnexion('candidat');
    $id = (int) $u['id'];
    $manques = manquesProfil($pdo, $id);
    if ($manques) {
        envoie(['erreur' => 'profil_incomplet', 'message' => 'Complète ton profil pour ouvrir le deck.', 'manques' => $manques], 409);
    }
    $c = candidatPourScore($pdo, $id);
    $f = filtresDemandes();
    if (($_GET['clos'] ?? '') === '1') {
        $f['statut'] = 'tous';         // le mode entrainement : les AVP clos aussi
    }
    [$sql, $p] = clauseFiltres($f);
    $st = $pdo->prepare(
        "SELECT j.*, c.name AS entreprise, c.sector AS secteur, c.size AS taille, c.pitch
           FROM jobs j JOIN companies c ON c.id = j.company_id
          WHERE $sql
            AND j.id NOT IN (SELECT job_id FROM swipes WHERE sens = 'candidat' AND candidate_id = ?)
          ORDER BY j.statut = 'publiee' DESC, j.published_at DESC LIMIT 200"
    );
    $st->execute(array_merge($p, [$id]));

    // signal semantique OPT si la cle est la : un appel pour tout le deck
    $distances = null;
    if (OPT_API_KEY !== '') {
        $distances = optRecherche(promptDepuisProfil(profilComplet($pdo, $id)), [], 50, 1.2);
    }
    $out = [];
    foreach ($st->fetchAll() as $ligne) {
        $out[] = offreScoree($pdo, $c, $ligne, $distances);
    }
    /* Ouverture « strict » : les offres du metier vise d'abord, puis les
       passerelles — mais toutes sont la. « ouvert » : par qualite seule. */
    usort($out, static function ($x, $y) use ($c) {
        if ($c['ouverture'] === 'strict') {
            $dx = $x['score']['passerelle'] ? 1 : 0;
            $dy = $y['score']['passerelle'] ? 1 : 0;
            if ($dx !== $dy) {
                return $dx <=> $dy;
            }
        }
        return $y['score']['qualite'] <=> $x['score']['qualite'];
    });
    trace($id, 'deck', 'candidate', $id);
    envoie(['offres' => array_slice($out, 0, 60), 'facettes' => facettes($pdo, $f), 'filtres' => $f]);
}

/* -------------------------------------------------- candidats d'une offre */

/* Cote organisation : les candidats classes pour une offre, anonymes tant que
   la candidature n'est pas preselectionnee. Sont listes ceux qui ont
   candidate (la file) ET, si demande, les profils qui n'ont rien fait (le
   vivier) : un AVP frais rapproche d'une base de profils. */
if (($a = route('GET', 'avp/*/candidats', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    $o = garnisOffre($pdo, exigeOffreDeOrganisation($pdo, $org, (int) $a[0]));
    $vivier = ($_GET['vivier'] ?? '') === '1';

    $st = $pdo->prepare(
        'SELECT c.user_id, a.id AS application_id, a.statut, a.created_at AS candidature_le
           FROM candidates c JOIN users u ON u.id = c.user_id
           LEFT JOIN applications a ON a.job_id = ? AND a.candidate_id = c.user_id
          WHERE c.visible = 1 AND u.status = "actif" ' . ($vivier ? '' : 'AND a.id IS NOT NULL') . '
          LIMIT 300'
    );
    $st->execute([(int) $o['id']]);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $c = candidatPourScore($pdo, (int) $r['user_id']);
        if (!$c || !$c['competences']) {
            continue;
        }
        $e = evalue($pdo, $c, $o);
        memoriseScore($pdo, (int) $o['id'], (int) $r['user_id'], $e);
        $apres = in_array($r['statut'], ['preselection', 'entretien', 'acceptee'], true);
        $out[] = candidatVuParEntreprise($pdo, (int) $r['user_id'], $apres) + [
            'candidature' => $r['application_id'] ? ['id' => (int) $r['application_id'], 'statut' => $r['statut'], 'le' => $r['candidature_le']] : null,
            'score' => scorePublic($e),
        ];
    }
    usort($out, static fn ($x, $y) => $y['score']['qualite'] <=> $x['score']['qualite']);
    trace((int) $u['id'], 'deck_candidats', 'job', (int) $o['id']);
    envoie(['candidats' => array_slice($out, 0, 60), 'offre' => offrePublique($o)]);
}

/* ------------------------------------------------------------ referentiel */

if (route('GET', 'metiers', $seg, $methode) !== false) {
    $st = $pdo->query(
        'SELECT m.code_metier AS code, m.nom, m.famille_id AS famille, f.libelle AS familleLibelle, f.couleur,
                (SELECT COUNT(*) FROM jobs j WHERE j.code_metier = m.code_metier AND j.statut = "publiee") AS avpOuverts
           FROM opt_metiers m LEFT JOIN opt_familles f ON f.id = m.famille_id
          WHERE m.actif = 1 ORDER BY f.libelle, m.nom'
    );
    $fam = $pdo->query('SELECT id, libelle, couleur FROM opt_familles ORDER BY libelle')->fetchAll();
    envoie(['metiers' => array_map(static fn ($r) => $r + ['avpOuverts' => (int) $r['avpOuverts']], $st->fetchAll()), 'familles' => $fam]);
}

if (($a = route('GET', 'metiers/*', $seg, $methode)) !== false) {
    $m = metierOptDetail($pdo, strtoupper($a[0]));
    if (!$m) {
        erreur('introuvable', 'Ce métier n’est pas dans le référentiel.', 404);
    }
    envoie(['metier' => $m]);
}

if (route('GET', 'competences', $seg, $methode) !== false) {
    $q = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 80);
    if ($q === '') {
        envoie(['competences' => []]);
    }
    $st = $pdo->prepare('SELECT code, nom, groupe FROM opt_competences WHERE nom LIKE ? ORDER BY nom LIMIT 30');
    $st->execute(['%' . $q . '%']);
    envoie(['competences' => $st->fetchAll()]);
}

/* ---------------------------------------------------------- synchronisation */

/* Appelee par un cron (curl -H "X-Sync-Token: …"), ou par un admin connecte.
   Le jeton vit dans la configuration, la route est fermee s'il est vide. */
if (route('POST', 'admin/sync/avp', $seg, $methode) !== false) {
    $tok = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? '';
    $u = utilisateur();
    if (!(($u && $u['role'] === 'admin') || (SYNC_TOKEN !== '' && hash_equals(SYNC_TOKEN, $tok)))) {
        erreur('interdit', 'Synchronisation réservée.', 403);
    }
    limite('sync', 12, 3600);
    $r = synchroniseAvp($pdo);
    trace($u ? (int) $u['id'] : null, 'sync_avp', 'job');
    envoie(['synchronisation' => $r, 'quand' => maintenant()]);
}

if (route('GET', 'admin/sync/avp', $seg, $methode) !== false) {
    $st = $pdo->query('SELECT COUNT(*) AS n, MAX(synced_at) AS derniere, SUM(statut = "publiee") AS ouverts FROM jobs WHERE source = "opt"');
    $r = $st->fetch();
    envoie(['avpOpt' => (int) $r['n'], 'ouverts' => (int) $r['ouverts'], 'derniereSynchro' => $r['derniere'], 'cleApiOpt' => OPT_API_KEY !== '']);
}

<?php
/**
 * Adopte un Job — acces aux donnees et regles de visibilite.
 *
 * Toutes les fonctions qui rendent un objet au client passent par ici, et c'est
 * ici que le masquage avant match est applique. Une seule porte de sortie : si
 * la regle change, elle change a un seul endroit.
 */

declare(strict_types=1);

/* ------------------------------------------------------------- le candidat */

/** Le candidat tel que le moteur de score en a besoin. Rien de plus. */
function candidatPourScore(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare('SELECT * FROM candidates WHERE user_id = ?');
    $st->execute([$id]);
    $c = $st->fetch();
    if (!$c) {
        return null;
    }
    return [
        'user_id'        => $id,
        'zones'          => colonne($pdo, 'SELECT zone FROM candidate_zones WHERE user_id = ?', $id),
        'contrats'       => colonne($pdo, 'SELECT contract FROM candidate_contracts WHERE user_id = ?', $id),
        'occupations'    => array_map('intval', colonne($pdo, 'SELECT occupation_id FROM candidate_occupations WHERE user_id = ?', $id)),
        'competences'    => array_map('intval', colonne($pdo, 'SELECT skill_id FROM candidate_skills WHERE user_id = ?', $id)),
        'experience_ans' => $c['experience_ans'] === null ? null : (int) $c['experience_ans'],
        'formation_max'  => $c['formation_max'] === null ? null : (int) $c['formation_max'],
        'dispo'          => $c['dispo'],
        'salaire_min'    => $c['salaire_min'] === null ? null : (int) $c['salaire_min'],
        'permis'         => $c['permis'] === null ? null : (int) $c['permis'],
        'teletravail'    => $c['teletravail'],
        'ouverture'      => $c['ouverture'],
        // referentiel OPT : metiers vises (codes) et competences rattachees
        'metiers_opt'    => colonne($pdo, 'SELECT code_metier FROM candidate_opt_metiers WHERE user_id = ?', $id),
        'competences_opt' => competencesOptDuCandidat($pdo, $id),
        'mots'           => motsDuCandidat($pdo, $id),
    ];
}

function colonne(PDO $pdo, string $sql, mixed ...$args): array
{
    $st = $pdo->prepare($sql);
    $st->execute($args);
    return array_map(static fn ($r) => array_values($r)[0], $st->fetchAll());
}

/** Le profil complet, pour son proprietaire uniquement. */
function profilComplet(PDO $pdo, int $id): array
{
    $st = $pdo->prepare('SELECT * FROM candidates WHERE user_id = ?');
    $st->execute([$id]);
    $c = $st->fetch() ?: [];

    $exp = $pdo->prepare('SELECT poste, secteur, debut, fin FROM candidate_experiences WHERE user_id = ? ORDER BY rang, id');
    $exp->execute([$id]);
    $for = $pdo->prepare('SELECT niveau, domaine FROM candidate_educations WHERE user_id = ? ORDER BY rang, id');
    $for->execute([$id]);
    $lng = $pdo->prepare('SELECT langue, niveau FROM candidate_languages WHERE user_id = ?');
    $lng->execute([$id]);
    $cmp = $pdo->prepare('SELECT s.label FROM candidate_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.user_id = ? ORDER BY s.label');
    $cmp->execute([$id]);
    $met = $pdo->prepare('SELECT o.slug FROM candidate_occupations co JOIN occupations o ON o.id = co.occupation_id WHERE co.user_id = ?');
    $met->execute([$id]);
    $mo = $pdo->prepare('SELECT m.code_metier AS code, m.nom, f.libelle AS famille FROM candidate_opt_metiers cm JOIN opt_metiers m ON m.code_metier = cm.code_metier LEFT JOIN opt_familles f ON f.id = m.famille_id WHERE cm.user_id = ? ORDER BY m.nom');
    $mo->execute([$id]);
    $co = $pdo->prepare('SELECT co.code_competence AS code, c.nom, co.source, co.libelle_source AS depuis FROM candidate_opt_competences co JOIN opt_competences c ON c.code = co.code_competence WHERE co.user_id = ? ORDER BY c.nom');
    $co->execute([$id]);

    return [
        'prenom'      => $c['prenom'] ?? '',
        'initiale'    => $c['initiale'] ?? '',
        'nom'         => $c['nom'] ?? '',
        'telephone'   => $c['telephone'] ?? '',
        'dispo'       => $c['dispo'] ?? null,
        'teletravail' => $c['teletravail'] ?? 'peu importe',
        'ouverture'   => $c['ouverture'] ?? 'strict',
        'salaireMin'  => isset($c['salaire_min']) && $c['salaire_min'] !== null ? (int) $c['salaire_min'] : null,
        'permis'      => isset($c['permis']) && $c['permis'] !== null ? (bool) $c['permis'] : null,
        'formation'   => isset($c['formation_max']) && $c['formation_max'] !== null ? (int) $c['formation_max'] : null,
        'zones'       => colonne($pdo, 'SELECT zone FROM candidate_zones WHERE user_id = ?', $id),
        'contrats'    => colonne($pdo, 'SELECT contract FROM candidate_contracts WHERE user_id = ?', $id),
        'metiers'     => $met->fetchAll(PDO::FETCH_COLUMN),
        'metiersOpt'  => $mo->fetchAll(),
        'competences' => $cmp->fetchAll(PDO::FETCH_COLUMN),
        'competencesOpt' => $co->fetchAll(),
        'langues'     => $lng->fetchAll(),
        'experiences' => $exp->fetchAll(),
        'formations'  => $for->fetchAll(),
    ];
}

/**
 * Le candidat vu par une entreprise. Avant match : ni nom, ni prenom, ni
 * contact. Ce n'est pas de la pudeur, c'est ce qui empeche de trier sur autre
 * chose que les competences.
 */
function candidatVuParEntreprise(PDO $pdo, int $id, bool $apresMatch): array
{
    $p = profilComplet($pdo, $id);
    $public = [
        'id'          => $id,
        'metiers'     => $p['metiers'],
        'metiersOpt'  => $p['metiersOpt'],
        'competences' => $p['competences'],
        'competencesOpt' => array_map(static fn ($x) => ['code' => $x['code'], 'nom' => $x['nom']], $p['competencesOpt']),
        'experiences' => array_map(static fn ($e) => [
            'poste'   => $e['poste'],
            'secteur' => $e['secteur'],
            'debut'   => $e['debut'],
            'fin'     => $e['fin'],
        ], $p['experiences']),
        // Le niveau, jamais l'annee d'obtention : elle revele l'age.
        'formations'  => array_map(static fn ($f) => ['niveau' => (int) $f['niveau'], 'domaine' => $f['domaine']], $p['formations']),
        'langues'     => $p['langues'],
        'zones'       => $p['zones'],
        'contrats'    => $p['contrats'],
        'dispo'       => $p['dispo'],
        'teletravail' => $p['teletravail'],
        'formation'   => $p['formation'],
    ];
    if (!$apresMatch) {
        return $public;
    }
    // Le contact s'ouvre : prenom, nom, telephone et l'e-mail du compte.
    $st = $pdo->prepare('SELECT email FROM users WHERE id = ? AND status = "actif"');
    $st->execute([$id]);
    return $public + [
        'prenom'    => $p['prenom'],
        'nom'       => $p['nom'],
        'initiale'  => $p['initiale'],
        'telephone' => $p['telephone'],
        'email'     => ($st->fetchColumn() ?: null),
    ];
}

/* ---------------------------------------------------------------- l'offre */

function offreParId(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare(
        'SELECT j.*, c.name AS entreprise, c.sector AS secteur, c.size AS taille, c.pitch
           FROM jobs j JOIN companies c ON c.id = j.company_id
          WHERE j.id = ?'
    );
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

/** Complete une ligne d'offre avec ses competences, pour le score et l'affichage. */
function garnisOffre(PDO $pdo, array $o): array
{
    $st = $pdo->prepare(
        'SELECT s.id, s.label, js.niveau FROM job_skills js
           JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ?'
    );
    $st->execute([$o['id']]);
    $o['requis'] = [];
    $o['souhaite'] = [];
    $o['requis_libelles'] = [];
    $o['souhaite_libelles'] = [];
    foreach ($st->fetchAll() as $r) {
        if ($r['niveau'] === 'exige') {
            $o['requis'][] = (int) $r['id'];
            $o['requis_libelles'][] = $r['label'];
        } else {
            $o['souhaite'][] = (int) $r['id'];
            $o['souhaite_libelles'][] = $r['label'];
        }
    }
    $o['occupation_id'] = $o['occupation_id'] === null ? null : (int) $o['occupation_id'];
    // Les phrases de competences de l'AVP : colonne JSON si elle est la,
    // sinon relues depuis la fiche JobPosting.
    if (isset($o['competences_texte']) && is_string($o['competences_texte'])) {
        $o['competences_texte'] = json_decode($o['competences_texte'], true) ?: [];
    }
    $o['competences_texte'] = is_array($o['competences_texte'] ?? null) ? $o['competences_texte'] : [];
    if (!$o['competences_texte'] && !empty($o['json_data'])) {
        $j = is_string($o['json_data']) ? (json_decode($o['json_data'], true) ?: []) : $o['json_data'];
        $o['competences_texte'] = competencesTexteAvp($j);
    }
    $o['familles'] = isset($o['familles']) && is_string($o['familles']) ? (json_decode($o['familles'], true) ?: []) : ($o['familles'] ?? []);
    $o['nb_agents_encadres'] = isset($o['nb_agents_encadres']) && $o['nb_agents_encadres'] !== null ? (int) $o['nb_agents_encadres'] : null;
    $o['salaire_min'] = $o['salaire_min'] === null ? null : (int) $o['salaire_min'];
    $o['salaire_max'] = $o['salaire_max'] === null ? null : (int) $o['salaire_max'];
    $o['formation_min'] = $o['formation_min'] === null ? null : (int) $o['formation_min'];
    return $o;
}

/** L'offre telle qu'on la montre : pas de colonnes internes, pas d'identifiants d'auteur. */
function offrePublique(array $o): array
{
    $j = [];
    if (!empty($o['json_data'])) {
        $j = is_string($o['json_data']) ? (json_decode($o['json_data'], true) ?: []) : $o['json_data'];
    }
    $expire = $o['expires_at'] ?? null;
    $jours = null;
    if ($expire) {
        $jours = (int) floor((strtotime($expire . ' UTC') - time()) / 86400);
    }
    $ct = $o['competences_texte'] ?? [];
    if (is_string($ct)) {
        $ct = json_decode($ct, true) ?: [];
    }
    return [
        'id'          => (int) $o['id'],
        'source'      => $o['source'] ?? 'app',
        'reference'   => $o['external_id'] ?? null,
        'url'         => $o['url'] ?? null,
        'titre'       => $o['titre'],
        'ville'       => $o['ville'] ?? null,
        'province'    => $o['province'] ?? null,
        'direction'   => $o['direction'] ?? null,
        'familles'    => is_string($o['familles'] ?? null) ? (json_decode($o['familles'], true) ?: []) : ($o['familles'] ?? []),
        'codeMetier'  => $o['code_metier'] ?? null,
        'metierOpt'   => $j['relevantOccupation']['name'] ?? null,
        'codeRome'    => $o['code_rome'] ?? null,
        'employmentType' => $o['employment_type'] ?? null,
        'nbAgentsEncadres' => isset($o['nb_agents_encadres']) && $o['nb_agents_encadres'] !== null ? (int) $o['nb_agents_encadres'] : null,
        'competencesTexte' => array_map(static fn ($x) => ['texte' => $x['texte'], 'type' => $x['type']], $ct),
        'responsabilites' => array_values(array_map('strval', (array) ($j['responsibilities'] ?? []))),
        'conditions'  => $j['workHours'] ?? null,
        'avantages'   => $j['jobBenefits'] ?? null,
        'exigencesPhysiques' => $j['physicalRequirement'] ?? null,
        'qualifications' => $j['qualifications'] ?? null,
        'experienceTexte' => $j['experienceRequirements'] ?? null,
        'unite'       => $j['employmentUnit']['name'] ?? null,
        'lieu'        => $j['jobLocation']['name'] ?? null,
        'adresse'     => $j['jobLocation']['address']['streetAddress'] ?? null,
        'datePublication' => $j['datePosted'] ?? ($o['published_at'] ?? null),
        'expire'      => $expire,
        'joursRestants' => $jours,
        'statut'      => $o['statut'] ?? null,
        'entreprise'  => $o['entreprise'] ?? null,
        'secteur'     => $o['secteur'] ?? null,
        'taille'      => $o['taille'] ?? null,
        'pitch'       => $o['pitch'] ?? null,
        'contrat'     => $o['contrat'],
        'zone'        => $o['zone'],
        'teletravail' => $o['teletravail'],
        'salaire'     => ($o['salaire_min'] === null && $o['salaire_max'] === null)
            ? null : [$o['salaire_min'], $o['salaire_max']],
        'experienceMin' => (int) $o['experience_min'],
        'formationMin'  => $o['formation_min'],
        'permis'      => (bool) $o['permis_requis'],
        'debut'       => $o['debut'],
        'description' => $o['description'],
        'requis'      => $o['requis_libelles'] ?? [],
        'souhaite'    => $o['souhaite_libelles'] ?? [],
        'publiee'     => $o['published_at'],
    ];
}

/* -------------------------------------------------------------- les matchs */

function matchExiste(PDO $pdo, int $jobId, int $candId): ?array
{
    $st = $pdo->prepare('SELECT * FROM matches WHERE job_id = ? AND candidate_id = ?');
    $st->execute([$jobId, $candId]);
    return $st->fetch() ?: null;
}

/** L'utilisateur a-t-il le droit de lire ce match ? Le candidat, ou l'entreprise. */
function accesAuMatch(PDO $pdo, array $u, int $matchId): array
{
    $st = $pdo->prepare(
        'SELECT m.*, j.company_id, j.titre FROM matches m JOIN jobs j ON j.id = m.job_id WHERE m.id = ?'
    );
    $st->execute([$matchId]);
    $m = $st->fetch();
    if (!$m) {
        erreur('introuvable', 'Ce match n’existe pas.', 404);
    }
    if ((int) $m['candidate_id'] === (int) $u['id']) {
        return $m;
    }
    $st = $pdo->prepare('SELECT 1 FROM company_members WHERE company_id = ? AND user_id = ?');
    $st->execute([$m['company_id'], $u['id']]);
    if ($st->fetch() || $u['role'] === 'admin') {
        return $m;
    }
    erreur('interdit', 'Ce match ne vous concerne pas.', 403);
}

/** L'entreprise de l'utilisateur connecte, creee au besoin lors de la premiere offre. */
function entrepriseDe(PDO $pdo, int $userId): ?int
{
    $st = $pdo->prepare('SELECT company_id FROM company_members WHERE user_id = ? ORDER BY created_at LIMIT 1');
    $st->execute([$userId]);
    $id = $st->fetchColumn();
    return $id === false ? null : (int) $id;
}

/**
 * Ce qui manque encore au profil pour qu'un score veuille dire quelque chose.
 * La meme liste que cote navigateur, mais c'est celle-ci qui fait foi : un
 * verrou pose uniquement dans l'interface s'ouvre avec les outils de
 * developpement.
 */
function manquesProfil(PDO $pdo, int $id): array
{
    $p = profilComplet($pdo, $id);
    $m = [];
    if (($p['prenom'] ?? '') === '') {
        $m[] = 'Ton prénom';
    }
    if (!$p['zones']) {
        $m[] = 'Les zones où tu acceptes de travailler';
    }
    if (!$p['dispo']) {
        $m[] = 'Ta date de disponibilité';
    }
    if (!$p['metiers'] && !$p['metiersOpt']) {
        $m[] = 'Le ou les métiers que tu vises';
    }
    if (!$p['contrats']) {
        $m[] = 'Le type de contrat recherché';
    }
    if (count($p['competences']) < 3) {
        $m[] = 'Au moins trois compétences';
    }
    if (!$p['experiences'] && !$p['formations']) {
        $m[] = 'Au moins une expérience ou une formation';
    }
    if (!$p['formations'] && $p['formation'] === null) {
        $m[] = 'Ton niveau de formation';
    }
    return $m;
}

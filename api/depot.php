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
        // colonne SET : MySQL la rend en chaine separee par des virgules
        'refus'          => $c['refus'] ? explode(',', (string) $c['refus']) : [],
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
        'refus'       => !empty($c['refus']) ? explode(',', (string) $c['refus']) : [],
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
 * Les formats de CV acceptes, et l'extension sous laquelle le fichier repart
 * vers la passerelle. Un CV arrive dans ce que la personne a sous la main :
 * refuser un .docx parce qu'on ne sait pas le lire nous-memes n'avait plus de
 * sens des lors que l'analyse se fait ailleurs.
 *
 * Ce qui reste refuse, et pourquoi : HTML et SVG (ils portent du script, et un
 * fichier servi depuis notre domaine devient une faille), les archives autres
 * que les formats bureautiques (un .zip n'est pas un CV), et tout executable.
 * Le type est lu dans les OCTETS, jamais dans ce que le client declare.
 */
const CV_FORMATS = [
    'application/pdf'                                                         => 'pdf',
    'image/jpeg'                                                              => 'jpg',
    'image/png'                                                               => 'png',
    'image/webp'                                                              => 'webp',
    'image/heic'                                                              => 'heic',
    'image/tiff'                                                              => 'tif',
    'application/msword'                                                      => 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
    'application/vnd.oasis.opendocument.text'                                 => 'odt',
    'application/rtf'                                                         => 'rtf',
    'text/rtf'                                                                => 'rtf',
    'text/plain'                                                              => 'txt',
];

/**
 * L'extension d'un CV depuis son type, pour le nom qu'il portera dans la
 * passerelle. `finfo` rend `application/zip` pour un .docx et `.odt` quand le
 * fichier n'annonce pas son sous-type : on tranche alors sur le nom d'origine,
 * seul cas ou on lui accorde du credit — et seulement pour choisir entre deux
 * formats bureautiques, jamais pour accepter un fichier refuse.
 */
function extensionCv(string $mime, string $nomOrigine): ?string
{
    if (isset(CV_FORMATS[$mime])) {
        return CV_FORMATS[$mime];
    }
    if ($mime === 'application/zip' || $mime === 'application/octet-stream') {
        $ext = strtolower(pathinfo($nomOrigine, PATHINFO_EXTENSION));
        if (in_array($ext, ['docx', 'odt'], true)) {
            return $ext;
        }
    }
    return null;
}

function cvPublic(array $r, ?array $x = null): array
{
    return [
        'id' => (int) $r['id'], 'nom' => $r['filename'], 'mime' => $r['mime'], 'octets' => (int) $r['bytes'],
        'actif' => (bool) $r['is_active'], 'depose' => $r['created_at'],
        'fichier' => $r['storage_key'] !== '',
        'lecture' => $x ? [
            'moteur' => $x['engine'], 'version' => $x['version'],
            'lu' => json_decode((string) $x['payload'], true),
            'retenu' => $x['accepted'] === null ? null : json_decode((string) $x['accepted'], true),
            'quand' => $x['created_at'],
        ] : null,
    ];
}

function derniereLecture(PDO $pdo, int $resumeId): ?array
{
    $st = $pdo->prepare('SELECT * FROM resume_extractions WHERE resume_id = ? ORDER BY id DESC LIMIT 1');
    $st->execute([$resumeId]);
    return $st->fetch() ?: null;
}

/** Le CV actif du candidat (ligne de resumes), s'il y en a un. Ici et non
    dans cv.php : celui-la porte des routes, et la passerelle d'echange, qui
    a besoin de cette fonction, ne peut pas les executer en le chargeant. */
function cvActif(PDO $pdo, int $userId): ?array
{
    $st = $pdo->prepare('SELECT * FROM resumes WHERE user_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1');
    $st->execute([$userId]);
    return $st->fetch() ?: null;
}

function cvDuCandidat(PDO $pdo, int $userId, int $id): array
{
    $st = $pdo->prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?');
    $st->execute([$id, $userId]);
    $r = $st->fetch();
    if (!$r) {
        erreur('introuvable', 'Ce CV n’existe pas.', 404);
    }
    return $r;
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

/* ------------------------------------------------- ecriture du profil

   Ces deux aides vivaient dans le routeur ; la passerelle d'echange en a
   besoin et ne peut pas charger un routeur, qui executerait toutes les
   routes. Elles sont ici, avec le reste de l'acces aux donnees. */

/** Vide puis reecrit une table de liaison a une colonne. */
function remplace(PDO $pdo, string $table, string $colonne, int $userId, array $valeurs): void
{
    $pdo->prepare("DELETE FROM `$table` WHERE user_id = ?")->execute([$userId]);
    if (!$valeurs) {
        return;
    }
    $ins = $pdo->prepare("INSERT IGNORE INTO `$table` (user_id, `$colonne`) VALUES (?,?)");
    foreach ($valeurs as $v) {
        $ins->execute([$userId, $v]);
    }
}

/**
 * Resout des libelles en identifiants de competences.
 * Trois passes dans l'ordre : le slug canonique, puis les alias connus, puis la
 * creation. Comparer par slug apres coup recreerait chaque alias en double —
 * « dev web » deviendrait une competence distincte de « Developpement web ».
 */
function idsOuCree(PDO $pdo, array $libelles): array
{
    $ids = [];
    $parSlug  = $pdo->prepare('SELECT id FROM skills WHERE slug = ?');
    $parAlias = $pdo->prepare('SELECT skill_id FROM skill_aliases WHERE alias = ?');
    $ins      = $pdo->prepare('INSERT IGNORE INTO skills (slug, label, family) VALUES (?,?,?)');

    foreach ($libelles as $brut) {
        $lab = trim((string) $brut);
        $s = slugue($lab);
        if ($s === '') {
            continue;
        }
        $parSlug->execute([$s]);
        $id = $parSlug->fetchColumn();
        if ($id === false) {
            $parAlias->execute([mb_strtolower($lab, 'UTF-8')]);
            $id = $parAlias->fetchColumn();
        }
        if ($id === false) {
            // Inconnue du referentiel : elle y entre plutot que d'etre perdue.
            $ins->execute([$s, mb_substr($lab, 0, 80), 'libre']);
            $parSlug->execute([$s]);
            $id = $parSlug->fetchColumn();
        }
        if ($id !== false && !in_array((int) $id, $ids, true)) {
            $ids[] = (int) $id;
        }
    }
    return $ids;
}

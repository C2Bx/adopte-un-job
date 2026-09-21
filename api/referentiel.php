<?php
/**
 * Adopte un Job — le referentiel metiers de l'OPT-NC, et le rattachement des
 * competences libres a ce referentiel.
 *
 * Un candidat ecrit « administration Linux » ; l'AVP demande « Connaissance des
 * systemes d'exploitation Linux (RHEL), Unix (AIX) » ; le referentiel dit
 * « Systemes d'exploitation ». Trois formulations, une competence. Le
 * rattachement est LEXICAL et EXPLICABLE : des mots en commun, comptes, et
 * montres au candidat pour qu'il corrige. Aucun modele de langage.
 */

declare(strict_types=1);

/* --------------------------------------------------------------- texte */

const MOTS_VIDES = [
    'les', 'des', 'une', 'aux', 'dans', 'pour', 'avec', 'sur', 'par', 'sans', 'sous', 'entre',
    'mise', 'oeuvre', 'ainsi', 'que', 'qui', 'dont', 'tout', 'tous', 'toute', 'toutes', 'leur', 'leurs',
    'ses', 'son', 'ces', 'cette', 'cet', 'est', 'etre', 'avoir', 'faire', 'savoir', 'connaitre',
    'connaissance', 'connaissances', 'maitrise', 'maitriser', 'notions', 'notion', 'bonne', 'bon',
    'capacite', 'capacites', 'aptitude', 'sens', 'esprit', 'qualite', 'qualites', 'niveau',
    'techniques', 'technique', 'outils', 'outil', 'gestion', 'relation', 'relations', 'application',
    'applications', 'regles', 'regle', 'procedures', 'procedure', 'opt', 'nc', 'organisation',
    'fonctionnement', 'notamment', 'type', 'lie', 'lies', 'liee', 'liees', 'autres', 'autre',
];

/** Les mots porteurs d'un libelle : minuscules, sans accents, sans mots vides,
    dessuffixes grossierement (pluriels, feminins, -tion/-ment gardes). */
function motsPorteurs(string $t): array
{
    $t = slugue($t);
    $out = [];
    foreach (explode('-', $t) as $m) {
        if (strlen($m) < 3 || ctype_digit($m)) {
            continue;
        }
        // un dessuffixage leger suffit : « reseaux »/« reseau », « clientele »/« client »
        $m = preg_replace('/(eaux|aux)$/', 'au', $m) ?? $m;
        $m = preg_replace('/(s|x)$/', '', $m) ?? $m;
        $m = preg_replace('/(ele|elle)$/', 'el', $m) ?? $m;
        if (strlen($m) < 3 || in_array($m, MOTS_VIDES, true)) {
            continue;
        }
        $out[$m] = true;
    }
    return array_keys($out);
}

/** Part des mots de $cible retrouves dans $source (0..1). */
function recouvrement(array $source, array $cible): float
{
    if (!$cible) {
        return 0.0;
    }
    $n = count(array_intersect($cible, $source));
    return $n / count($cible);
}

/* ------------------------------------------------------- referentiel OPT */

/** Les 409 competences OPT avec leurs mots porteurs, en memoire pour la requete. */
function competencesOpt(PDO $pdo): array
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach ($pdo->query('SELECT code, nom, groupe FROM opt_competences') as $r) {
            $cache[$r['code']] = ['code' => $r['code'], 'nom' => $r['nom'], 'groupe' => $r['groupe'], 'mots' => motsPorteurs($r['nom'])];
        }
    }
    return $cache;
}

/** Competences attendues pour un metier OPT, avec poids et niveau requis, les plus lourdes d'abord. */
function competencesDuMetier(PDO $pdo, ?string $codeMetier, int $max = 20): array
{
    if (!$codeMetier) {
        return [];
    }
    $st = $pdo->prepare(
        'SELECT mc.code_competence AS code, c.nom, c.groupe, mc.poids, mc.niveau_requis
           FROM opt_metier_competences mc JOIN opt_competences c ON c.code = mc.code_competence
          WHERE mc.code_metier = ? ORDER BY mc.poids DESC, c.nom LIMIT ' . $max
    );
    $st->execute([$codeMetier]);
    return $st->fetchAll();
}

function metierOpt(PDO $pdo, ?string $code): ?array
{
    if (!$code) {
        return null;
    }
    $st = $pdo->prepare('SELECT m.code_metier, m.nom, m.famille_id, f.libelle AS famille FROM opt_metiers m LEFT JOIN opt_familles f ON f.id = m.famille_id WHERE m.code_metier = ?');
    $st->execute([$code]);
    return $st->fetch() ?: null;
}

/**
 * Rattache les competences libres du candidat au referentiel OPT.
 * Trois sources, dans l'ordre : alias explicite, recouvrement de mots >= 60 %
 * (ou >= 2 mots communs), sinon rien — une competence qui ne se rattache pas
 * reste une competence libre, elle n'est pas perdue pour le score lexical.
 * Rend la liste [{code, nom, source, libelle_source, part}].
 */
function rattacheCompetences(PDO $pdo, int $userId, array $libelles): array
{
    $ref = competencesOpt($pdo);
    $alias = [];
    foreach ($pdo->query('SELECT alias, code_competence FROM opt_competence_alias') as $r) {
        $alias[$r['alias']] = $r['code_competence'];
    }
    $trouve = [];
    foreach ($libelles as $lib) {
        $lib = trim((string) $lib);
        if ($lib === '') {
            continue;
        }
        $k = mb_strtolower($lib, 'UTF-8');
        if (isset($alias[$k]) && isset($ref[$alias[$k]])) {
            $c = $ref[$alias[$k]];
            $trouve[$c['code']] = ['code' => $c['code'], 'nom' => $c['nom'], 'source' => 'alias', 'libelle_source' => $lib, 'part' => 1.0];
            continue;
        }
        $mots = motsPorteurs($lib);
        if (!$mots) {
            continue;
        }
        $meilleur = null;
        $slugLib = slugue($lib);
        foreach ($ref as $c) {
            if (!$c['mots']) {
                continue;
            }
            // le meme libelle, aux accents et a la casse pres : c'est elle, sans discussion
            if (slugue($c['nom']) === $slugLib) {
                $meilleur = ['c' => $c, 'part' => 1.0, 'score' => 10.0];
                break;
            }
            $communs = count(array_intersect($c['mots'], $mots));
            if ($communs === 0) {
                continue;
            }
            /* Deux mesures : la part du plus court couverte (« SQL » contre
               « Langage SQL et bases de donnees » doit passer), et la
               similarite de Jaccard, qui departage « Techniques de vente » de
               « Techniques de vente et de negociation » — la plus proche en
               longueur gagne, pas la plus longue. */
            $part = $communs / min(count($c['mots']), count($mots));
            $jaccard = $communs / (count($c['mots']) + count($mots) - $communs);
            if ($part >= 0.6 || $communs >= 2) {
                $score = $jaccard + $part * 0.5 + $communs * 0.05;
                if ($meilleur === null || $score > $meilleur['score']) {
                    $meilleur = ['c' => $c, 'part' => round($jaccard, 2), 'score' => $score];
                }
            }
        }
        if ($meilleur && (!isset($trouve[$meilleur['c']['code']]) || $trouve[$meilleur['c']['code']]['part'] < $meilleur['part'])) {
            $trouve[$meilleur['c']['code']] = [
                'code' => $meilleur['c']['code'], 'nom' => $meilleur['c']['nom'],
                'source' => 'mots', 'libelle_source' => $lib, 'part' => round($meilleur['part'], 2),
            ];
        }
    }

    $pdo->prepare('DELETE FROM candidate_opt_competences WHERE user_id = ? AND source <> "saisie"')->execute([$userId]);
    $ins = $pdo->prepare(
        'INSERT INTO candidate_opt_competences (user_id, code_competence, niveau, source, libelle_source)
         VALUES (?,?,NULL,?,?) ON DUPLICATE KEY UPDATE libelle_source = VALUES(libelle_source)'
    );
    foreach ($trouve as $t) {
        $ins->execute([$userId, $t['code'], $t['source'], mb_substr($t['libelle_source'], 0, 120)]);
    }
    return array_values($trouve);
}

/** Les codes de competences OPT du candidat (rattachees ou saisies). */
function competencesOptDuCandidat(PDO $pdo, int $userId): array
{
    $st = $pdo->prepare('SELECT code_competence FROM candidate_opt_competences WHERE user_id = ?');
    $st->execute([$userId]);
    return $st->fetchAll(PDO::FETCH_COLUMN);
}

/* ------------------------------------------------ l'AVP, cote competences */

/**
 * Les competences d'un AVP telles qu'ecrites : phrases de `skills` et de
 * `educationRequirements.competencyRequired`. On les garde en phrases (pour
 * l'affichage et l'explication) avec leurs mots porteurs (pour le score).
 */
function competencesTexteAvp(array $json): array
{
    $phrases = [];
    foreach ((array) ($json['skills'] ?? []) as $s) {
        $phrases[] = ['texte' => (string) $s, 'type' => 'savoir-faire'];
    }
    foreach ((array) ($json['educationRequirements']['competencyRequired'] ?? []) as $s) {
        $phrases[] = ['texte' => (string) $s, 'type' => 'connaissance'];
    }
    $out = [];
    foreach ($phrases as $p) {
        $t = trim($p['texte']);
        if ($t === '') {
            continue;
        }
        $out[] = ['texte' => mb_substr($t, 0, 240), 'type' => $p['type'], 'mots' => motsPorteurs($t)];
    }
    return $out;
}

/**
 * Couverture lexicale : quelles phrases de l'AVP le candidat couvre avec ses
 * propres mots (competences declarees + intitules d'experiences + formations).
 * Une phrase est couverte si au moins 50 % de ses mots porteurs — ou deux
 * mots — se retrouvent chez le candidat. Les savoir-etre (« Rigueur ») ont un
 * seul mot : ils passent ou non, sans demi-mesure.
 */
function couvertureLexicale(array $motsCandidat, array $phrases): array
{
    $ok = [];
    $manque = [];
    foreach ($phrases as $p) {
        if (!$p['mots']) {
            continue;
        }
        $communs = array_values(array_intersect($p['mots'], $motsCandidat));
        $part = count($communs) / count($p['mots']);
        if ($part >= 0.5 || count($communs) >= 2) {
            $ok[] = ['texte' => $p['texte'], 'type' => $p['type'], 'mots' => $communs];
        } else {
            $manque[] = ['texte' => $p['texte'], 'type' => $p['type']];
        }
    }
    $total = count($ok) + count($manque);
    return ['v' => $total ? count($ok) / $total : null, 'ok' => $ok, 'manque' => $manque, 'total' => $total];
}

/** Tous les mots que le candidat a ecrits de lui-meme, pour la couverture lexicale. */
function motsDuCandidat(PDO $pdo, int $userId): array
{
    $textes = [];
    $st = $pdo->prepare('SELECT s.label FROM candidate_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.user_id = ?');
    $st->execute([$userId]);
    $textes = array_merge($textes, $st->fetchAll(PDO::FETCH_COLUMN));
    $st = $pdo->prepare('SELECT poste, secteur FROM candidate_experiences WHERE user_id = ?');
    $st->execute([$userId]);
    foreach ($st->fetchAll() as $e) {
        $textes[] = $e['poste'];
        $textes[] = $e['secteur'];
    }
    $st = $pdo->prepare('SELECT domaine FROM candidate_educations WHERE user_id = ?');
    $st->execute([$userId]);
    $textes = array_merge($textes, $st->fetchAll(PDO::FETCH_COLUMN));
    $st = $pdo->prepare('SELECT c.nom FROM candidate_opt_competences co JOIN opt_competences c ON c.code = co.code_competence WHERE co.user_id = ?');
    $st->execute([$userId]);
    $textes = array_merge($textes, $st->fetchAll(PDO::FETCH_COLUMN));
    $mots = [];
    foreach ($textes as $t) {
        foreach (motsPorteurs((string) $t) as $m) {
            $mots[$m] = true;
        }
    }
    return array_keys($mots);
}

/**
 * Proximite entre les metiers vises par le candidat (codes OPT) et le metier
 * de l'AVP : meme code = direct ; meme famille = passerelle ; sinon eloigne.
 */
function proximiteMetierOpt(PDO $pdo, array $mesCodes, ?string $codeAvp): array
{
    if ($codeAvp === null || !$mesCodes) {
        return ['direct' => false, 'p' => null, 'raison' => null];
    }
    if (in_array($codeAvp, $mesCodes, true)) {
        return ['direct' => true, 'p' => 1.0, 'raison' => null];
    }
    $m = metierOpt($pdo, $codeAvp);
    if (!$m) {
        return ['direct' => false, 'p' => null, 'raison' => null];
    }
    $in = implode(',', array_fill(0, count($mesCodes), '?'));
    $st = $pdo->prepare("SELECT nom, famille_id FROM opt_metiers WHERE code_metier IN ($in)");
    $st->execute($mesCodes);
    foreach ($st->fetchAll() as $mien) {
        if ($mien['famille_id'] === $m['famille_id']) {
            return ['direct' => false, 'p' => 0.6, 'raison' => 'même famille de métiers (' . $m['famille'] . ') que ' . $mien['nom']];
        }
    }
    return ['direct' => false, 'p' => 0.15, 'raison' => 'métier ' . $m['nom'] . ', hors de ta famille de métiers'];
}

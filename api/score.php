<?php
/**
 * Adopte un Job — le moteur de correspondance, version 2 (referentiel OPT).
 *
 * Trois signaux pour les competences, fusionnes selon ce qui existe :
 *   - STRUCTUREL : le metier de l'AVP (code OPT) attend des competences
 *     ponderees dans le referentiel ; le candidat en a rattache. Couverture
 *     ponderee par le poids.
 *   - LEXICAL : les phrases de competences ecrites dans l'AVP, contre les mots
 *     que le candidat a ecrits lui-meme. Une phrase est couverte ou non.
 *   - EXPLICITE : pour une offre saisie dans l'application, ses competences
 *     « exigees / souhaitees » du referentiel maison (comme en v1).
 *
 * Trois principes, inchanges depuis la v1 :
 *   1. Deux scores directionnels ; la qualite est le MINIMUM des deux.
 *   2. La confiance est separee du score.
 *   3. Inconnu n'est pas non : un critere absent sort du calcul.
 *
 * Et un changement de doctrine : RIEN N'ELIMINE. Une contrainte non satisfaite
 * (zone, contrat, permis, salaire) devient un ECART : elle pese sur le score,
 * elle est affichee, mais tout profil peut candidater a tout poste. La
 * decision appartient au candidat, pas au filtre.
 */

declare(strict_types=1);

require_once __DIR__ . '/referentiel.php';

/** Agrege des criteres ponderes en ignorant les inconnus, puis renormalise. */
function agrege(array $parts): array
{
    $num = 0.0;
    $den = 0.0;
    $tot = 0.0;
    foreach ($parts as $p) {
        $tot += $p['poids'];
        if ($p['v'] === null) {
            continue;                       // inconnu : ni bonus, ni penalite
        }
        $num += $p['v'] * $p['poids'];
        $den += $p['poids'];
    }
    return [
        'score'     => $den > 0 ? $num / $den : 0.0,
        'confiance' => $tot > 0 ? $den / $tot : 0.0,
        'parts'     => $parts,
    ];
}

/**
 * Les ecarts : ce qui, dans l'offre, ne correspond pas a ce que le candidat a
 * dit vouloir ou pouvoir. Chaque ecart coute 20 % de la qualite (plancher 30 %)
 * et s'affiche en clair. Un critere non renseigne est une vigilance, jamais un
 * ecart.
 */
function ecarts(array $c, array $o): array
{
    $ec = [];
    $vg = [];

    if ($c['zones'] && !in_array($o['zone'], $c['zones'], true)) {
        $ec[] = 'Poste en zone ' . $o['zone'] . ($o['ville'] ? ' (' . $o['ville'] . ')' : '') . ', hors de tes zones';
    }
    if ($c['contrats'] && !in_array($o['contrat'], $c['contrats'], true)) {
        $ec[] = 'Contrat ' . $o['contrat'] . ', tu cherches ' . implode(' ou ', $c['contrats']);
    }
    if ($o['permis_requis']) {
        if ($c['permis'] === 0) {
            $ec[] = 'Permis B exigé, non détenu';
        } elseif ($c['permis'] === null) {
            $vg[] = 'Permis B exigé — non renseigné dans ton profil';
        }
    }
    if ($o['salaire_max'] !== null && $c['salaire_min'] !== null) {
        if ($c['salaire_min'] > $o['salaire_max']) {
            $ec[] = 'Salaire plafonné à ' . number_format((float) $o['salaire_max'], 0, ',', ' ') . ' XPF, sous ton minimum';
        }
    } elseif ($o['salaire_max'] === null && $o['salaire_min'] === null) {
        $vg[] = 'Salaire non annoncé';
    }
    if (!empty($o['nb_agents_encadres']) && $c['experience_ans'] !== null && $c['experience_ans'] < 2) {
        $vg[] = 'Poste avec encadrement (' . $o['nb_agents_encadres'] . ' agents) — peu d’expérience déclarée';
    }
    return ['ok' => true, 'ecarts' => $ec, 'bloquants' => $ec, 'vigilance' => $vg];
}

/** Couverture explicite (offre saisie dans l'app) : l'exige pese trois fois le souhaite. */
function couvertureExplicite(array $mes, array $requis, array $souhaite): ?array
{
    if (!$requis && !$souhaite) {
        return null;
    }
    $ok = array_values(array_intersect($requis, $mes));
    $bonus = array_values(array_intersect($souhaite, $mes));
    $v = ($requis ? count($ok) / count($requis) : 1.0) * 0.75
       + ($souhaite ? count($bonus) / count($souhaite) : 1.0) * 0.25;
    return ['v' => $v, 'ok' => $ok, 'manque' => array_values(array_diff($requis, $ok)), 'bonus' => $bonus];
}

/** Couverture structurelle : competences du metier OPT, ponderees. */
function couvertureStructurelle(array $attendues, array $codesCandidat): ?array
{
    if (!$attendues) {
        return null;
    }
    $tot = 0.0;
    $acq = 0.0;
    $ok = [];
    $manque = [];
    foreach ($attendues as $a) {
        $p = (float) $a['poids'];
        $tot += $p;
        if (in_array($a['code'], $codesCandidat, true)) {
            $acq += $p;
            $ok[] = ['code' => $a['code'], 'nom' => $a['nom'], 'poids' => $p];
        } else {
            $manque[] = ['code' => $a['code'], 'nom' => $a['nom'], 'poids' => $p, 'niveau' => $a['niveau_requis']];
        }
    }
    return ['v' => $tot > 0 ? $acq / $tot : null, 'ok' => $ok, 'manque' => $manque];
}

/** Ancienne proximite (referentiel maison), gardee pour les offres saisies dans l'app. */
function proximiteMetier(PDO $pdo, array $mesOccupations, ?int $occOffre): array
{
    if ($occOffre === null || !$mesOccupations) {
        return ['direct' => false, 'p' => null, 'raison' => null];
    }
    if (in_array($occOffre, $mesOccupations, true)) {
        return ['direct' => true, 'p' => 1.0, 'raison' => null];
    }
    $in = implode(',', array_fill(0, count($mesOccupations), '?'));
    $st = $pdo->prepare("SELECT proximity, reason FROM occupation_links WHERE b_id = ? AND a_id IN ($in) ORDER BY proximity DESC LIMIT 1");
    $st->execute(array_merge([$occOffre], $mesOccupations));
    $r = $st->fetch();
    return $r ? ['direct' => false, 'p' => (float) $r['proximity'], 'raison' => $r['reason']]
              : ['direct' => false, 'p' => 0.0, 'raison' => null];
}

/**
 * Evalue une paire (candidat, offre). Rend les deux scores, la qualite, la
 * confiance, les ecarts, et de quoi expliquer chaque point.
 */
function evalue(PDO $pdo, array $c, array $o): array
{
    // ---- competences : trois signaux, chacun peut manquer
    $struct = couvertureStructurelle(competencesDuMetier($pdo, $o['code_metier'] ?? null), $c['competences_opt'] ?? []);
    $lex = null;
    if (!empty($o['competences_texte'])) {
        $lex = couvertureLexicale($c['mots'] ?? [], $o['competences_texte']);
        if ($lex['v'] === null) {
            $lex = null;
        }
    }
    $expl = couvertureExplicite($c['competences'], $o['requis'], $o['souhaite']);

    $signaux = [];
    if ($struct && $struct['v'] !== null) {
        $signaux[] = ['v' => $struct['v'], 'poids' => 0.5];
    }
    if ($lex) {
        $signaux[] = ['v' => $lex['v'], 'poids' => 0.4];
    }
    if ($expl) {
        $signaux[] = ['v' => $expl['v'], 'poids' => 0.6];
    }
    $vComp = null;
    if ($signaux) {
        $n = 0.0;
        $d = 0.0;
        foreach ($signaux as $s) {
            $n += $s['v'] * $s['poids'];
            $d += $s['poids'];
        }
        $vComp = $n / $d;
    }

    // ---- cote entreprise : est-ce que ce candidat sait faire le travail ?
    $expMin = (int) $o['experience_min'];
    $fr = agrege([
        ['cle' => 'Compétences', 'poids' => 45, 'v' => $vComp],
        ['cle' => 'Expérience', 'poids' => 30, 'v' => $expMin === 0
            ? ($c['experience_ans'] === null ? null : min(1.0, 0.7 + $c['experience_ans'] * 0.1))
            : ($c['experience_ans'] === null ? null : min(1.0, $c['experience_ans'] / $expMin))],
        ['cle' => 'Formation', 'poids' => 15, 'v' => $o['formation_min'] === null
            ? 1.0
            : ($c['formation_max'] === null ? null
                : ($c['formation_max'] >= $o['formation_min'] ? 1.0
                    : max(0.0, 1 - ($o['formation_min'] - $c['formation_max']) * 0.35)))],
        ['cle' => 'Disponibilité', 'poids' => 10, 'v' => ($c['dispo'] === null || $o['debut'] === null)
            ? null : ($c['dispo'] <= $o['debut'] ? 1.0 : 0.5)],
    ]);

    // ---- metier : referentiel OPT d'abord, referentiel maison en repli
    if (!empty($o['code_metier']) && !empty($c['metiers_opt'])) {
        $prox = proximiteMetierOpt($pdo, $c['metiers_opt'], $o['code_metier']);
    } else {
        $prox = proximiteMetier($pdo, $c['occupations'], $o['occupation_id']);
    }
    $direct = $prox['direct'];
    $vMetier = $prox['p'] === null ? null : ($direct ? 1.0 : 0.35 + 0.55 * $prox['p']);

    $sal = null;
    if ($c['salaire_min'] !== null && $o['salaire_min'] !== null) {
        $sal = $c['salaire_min'] <= $o['salaire_min'] ? 1.0
            : (($o['salaire_max'] !== null && $c['salaire_min'] <= $o['salaire_max']) ? 0.6 : 0.0);
    }

    // ---- cote candidat : est-ce que ce poste ressemble a ce qu'il cherche ?
    $fc = agrege([
        ['cle' => 'Métier visé', 'poids' => 40, 'v' => $vMetier],
        ['cle' => 'Contrat', 'poids' => 25, 'v' => $c['contrats'] ? (in_array($o['contrat'], $c['contrats'], true) ? 1.0 : 0.0) : null],
        ['cle' => 'Salaire', 'poids' => 20, 'v' => $sal],
        ['cle' => 'Conditions', 'poids' => 15, 'v' => ($c['teletravail'] === 'peu importe') ? null
            : ($c['teletravail'] === 'hybride' && $o['teletravail'] === 'non' ? 0.4 : 1.0)],
    ]);

    $ec = ecarts($c, $o);
    // Chaque ecart coute 20 %, plancher 30 % : l'offre reste visible et classee.
    $penalite = max(0.3, 1 - 0.2 * count($ec['ecarts']));
    $qualite = min($fr['score'], $fc['score']) * ($direct ? 1.0 : 0.85) * $penalite;

    return [
        'fit_recruteur' => (int) round($fr['score'] * 100),
        'fit_candidat'  => (int) round($fc['score'] * 100),
        'qualite'       => (int) round($qualite * 100),
        'confiance'     => (int) round(($fr['confiance'] + $fc['confiance']) / 2 * 100),
        'passerelle'    => !$direct,
        'passerelle_raison' => $direct ? null : $prox['raison'],
        'contraintes'   => $ec,
        'detail'        => [
            'recruteur'   => $fr['parts'],
            'candidat'    => $fc['parts'],
            'couverture'  => $expl ?? ['v' => $vComp, 'ok' => [], 'manque' => [], 'bonus' => []],
            'structurel'  => $struct,
            'lexical'     => $lex ? ['v' => $lex['v'], 'ok' => array_slice($lex['ok'], 0, 12), 'manque' => array_slice($lex['manque'], 0, 12), 'total' => $lex['total']] : null,
            'ecarts'      => $ec['ecarts'],
        ],
    ];
}

/** Enregistre le score pour ne pas le recalculer a chaque ouverture du deck. */
function memoriseScore(PDO $pdo, int $jobId, int $candId, array $e): void
{
    $pdo->prepare(
        'INSERT INTO match_scores
            (job_id, candidate_id, fit_recruteur, fit_candidat, qualite, confiance, detail, algo, computed_at)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
            fit_recruteur = VALUES(fit_recruteur), fit_candidat = VALUES(fit_candidat),
            qualite = VALUES(qualite), confiance = VALUES(confiance),
            detail = VALUES(detail), algo = VALUES(algo), computed_at = VALUES(computed_at)'
    )->execute([
        $jobId, $candId, $e['fit_recruteur'], $e['fit_candidat'], $e['qualite'], $e['confiance'],
        json_encode($e['detail'], JSON_UNESCAPED_UNICODE), ALGO, maintenant(),
    ]);
}

/** Le bloc « score » tel que le client le recoit. */
function scorePublic(array $e): array
{
    return [
        'qualite'    => $e['qualite'],
        'recruteur'  => $e['fit_recruteur'],
        'candidat'   => $e['fit_candidat'],
        'confiance'  => $e['confiance'],
        'passerelle' => $e['passerelle'],
        'passerelleRaison' => $e['passerelle_raison'],
        'vigilance'  => $e['contraintes']['vigilance'],
        'ecarts'     => $e['contraintes']['ecarts'],
        'detail'     => $e['detail'],
    ];
}

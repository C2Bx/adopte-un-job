<?php
/**
 * Adopte un Job — le moteur de correspondance, cote serveur.
 *
 * Il reprend exactement les regles de la demonstration, avec deux differences
 * qui viennent du fait qu'on est desormais en production :
 *   - la proximite entre metiers vient de la table occupation_links, ecrite et
 *     discutable, plutot que d'une constante dans le code ;
 *   - le score est calcule ici et nulle part ailleurs. Un score calcule dans le
 *     navigateur se modifie dans le navigateur.
 *
 * Trois principes, inchanges :
 *   1. Deux scores directionnels. La qualite d'un match est le MINIMUM des deux,
 *      jamais la moyenne : une offre parfaite pour l'entreprise et mediocre pour
 *      le candidat n'est pas un demi-bon match.
 *   2. La confiance est separee du score. Un score de 80 % sur trois criteres
 *      renseignes ne vaut pas un score de 80 % sur dix.
 *   3. Inconnu n'est pas non. Un critere non renseigne sort du calcul et le
 *      poids restant est renormalise, au lieu de compter zero.
 */

declare(strict_types=1);

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
 * Filtres durs. Un blocage retire l'offre du deck ; une vigilance la laisse
 * passer avec une reserve affichee. La difference est essentielle : un critere
 * non renseigne ne doit jamais eliminer.
 */
function contraintes(array $c, array $o): array
{
    $bl = [];
    $vg = [];

    if (!in_array($o['zone'], $c['zones'], true)) {
        $bl[] = 'Poste en zone ' . $o['zone'] . ', hors de tes zones';
    }
    if ($c['contrats'] && !in_array($o['contrat'], $c['contrats'], true)) {
        $bl[] = 'Contrat ' . $o['contrat'] . ', tu cherches ' . implode(' ou ', $c['contrats']);
    }
    if ($o['permis_requis']) {
        if ($c['permis'] === 0) {
            $bl[] = 'Permis B exigé, non détenu';
        } elseif ($c['permis'] === null) {
            $vg[] = 'Permis B exigé — non renseigné';
        }
    }
    if ($o['salaire_max'] !== null && $c['salaire_min'] !== null) {
        if ($c['salaire_min'] > $o['salaire_max']) {
            $bl[] = 'Salaire plafonné à ' . number_format((float) $o['salaire_max'], 0, ',', ' ')
                . ' XPF, sous ton minimum';
        }
    } elseif ($o['salaire_max'] === null) {
        $vg[] = 'Salaire non annoncé';
    }

    return ['ok' => !$bl, 'bloquants' => $bl, 'vigilance' => $vg];
}

/** Couverture des competences : l'exige pese trois fois plus que le souhaite. */
function couverture(array $mes, array $requis, array $souhaite): array
{
    $ok = array_values(array_intersect($requis, $mes));
    $bonus = array_values(array_intersect($souhaite, $mes));
    $v = ($requis ? count($ok) / count($requis) : 1.0) * 0.75
       + ($souhaite ? count($bonus) / count($souhaite) : 1.0) * 0.25;
    return [
        'v'      => $v,
        'ok'     => $ok,
        'manque' => array_values(array_diff($requis, $ok)),
        'bonus'  => $bonus,
    ];
}

/**
 * Proximite entre le metier de l'offre et ceux vises par le candidat.
 * Retourne 1.0 en visee directe, sinon la meilleure passerelle connue.
 */
function proximiteMetier(PDO $pdo, array $mesOccupations, ?int $occOffre): array
{
    if ($occOffre === null || !$mesOccupations) {
        return ['direct' => false, 'p' => null, 'raison' => null];
    }
    if (in_array($occOffre, $mesOccupations, true)) {
        return ['direct' => true, 'p' => 1.0, 'raison' => null];
    }
    $in = implode(',', array_fill(0, count($mesOccupations), '?'));
    $st = $pdo->prepare(
        "SELECT proximity, reason FROM occupation_links
          WHERE b_id = ? AND a_id IN ($in) ORDER BY proximity DESC LIMIT 1"
    );
    $st->execute(array_merge([$occOffre], $mesOccupations));
    $r = $st->fetch();
    return $r
        ? ['direct' => false, 'p' => (float) $r['proximity'], 'raison' => $r['reason']]
        : ['direct' => false, 'p' => 0.0, 'raison' => null];
}

/**
 * Evalue une paire (candidat, offre). Rend les deux scores, la qualite, la
 * confiance et de quoi expliquer chaque point — un score sans explication n'est
 * pas utilisable par la personne qui le recoit.
 */
function evalue(PDO $pdo, array $c, array $o): array
{
    $cov = couverture($c['competences'], $o['requis'], $o['souhaite']);

    // Cote entreprise : est-ce que ce candidat sait faire le travail ?
    $expMin = (int) $o['experience_min'];
    $fr = agrege([
        ['cle' => 'Compétences', 'poids' => 45, 'v' => $cov['v']],
        ['cle' => 'Expérience', 'poids' => 30, 'v' => $expMin === 0
            ? 1.0
            : ($c['experience_ans'] === null ? null : min(1.0, $c['experience_ans'] / $expMin))],
        ['cle' => 'Formation', 'poids' => 15, 'v' => $o['formation_min'] === null
            ? 1.0
            : ($c['formation_max'] === null
                ? null
                : ($c['formation_max'] >= $o['formation_min']
                    ? 1.0
                    : max(0.0, 1 - ($o['formation_min'] - $c['formation_max']) * 0.35)))],
        ['cle' => 'Disponibilité', 'poids' => 10, 'v' => ($c['dispo'] === null || $o['debut'] === null)
            ? null
            : ($c['dispo'] <= $o['debut'] ? 1.0 : 0.5)],
    ]);

    $prox = proximiteMetier($pdo, $c['occupations'], $o['occupation_id']);
    $direct = $prox['direct'];
    // Hors visee directe, la passerelle vaut ce que dit le referentiel.
    $vMetier = $prox['p'] === null ? null : ($direct ? 1.0 : 0.35 + 0.55 * $prox['p']);

    $sal = null;
    if ($c['salaire_min'] !== null && $o['salaire_min'] !== null) {
        $sal = $c['salaire_min'] <= $o['salaire_min']
            ? 1.0
            : (($o['salaire_max'] !== null && $c['salaire_min'] <= $o['salaire_max']) ? 0.6 : 0.0);
    }

    // Cote candidat : est-ce que ce poste ressemble a ce qu'il cherche ?
    $fc = agrege([
        ['cle' => 'Métier visé', 'poids' => 40, 'v' => $vMetier],
        ['cle' => 'Contrat', 'poids' => 25, 'v' => $c['contrats']
            ? (in_array($o['contrat'], $c['contrats'], true) ? 1.0 : 0.0) : null],
        ['cle' => 'Salaire', 'poids' => 20, 'v' => $sal],
        ['cle' => 'Conditions', 'poids' => 15, 'v' => ($c['teletravail'] === 'peu importe')
            ? null
            : ($c['teletravail'] === 'hybride' && $o['teletravail'] === 'non' ? 0.4 : 1.0)],
    ]);

    $ctr = contraintes($c, $o);
    $qualite = min($fr['score'], $fc['score']) * ($direct ? 1.0 : 0.85);

    return [
        'fit_recruteur' => (int) round($fr['score'] * 100),
        'fit_candidat'  => (int) round($fc['score'] * 100),
        'qualite'       => (int) round($qualite * 100),
        'confiance'     => (int) round(($fr['confiance'] + $fc['confiance']) / 2 * 100),
        'passerelle'    => !$direct,
        'passerelle_raison' => $direct ? null : $prox['raison'],
        'contraintes'   => $ctr,
        'detail'        => [
            'recruteur'  => $fr['parts'],
            'candidat'   => $fc['parts'],
            'couverture' => $cov,
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

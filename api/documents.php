<?php
/**
 * Adopte un Job — les documents produits par le serveur : le CV genere depuis
 * le profil, recentre sur un poste, et les propositions de premiers messages.
 *
 * Tout est produit par des regles, sans modele de langage : ce qui est ecrit
 * vient du profil ou de l'AVP, jamais d'une invention. Le PDF est fait avec
 * FPDF (api/lib/fpdf, licence permissive), police Helvetica de base.
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/fpdf/fpdf.php';

/** FPDF ne connait que le latin-1 : on convertit, sans perdre les accents. */
function l1(string $t): string
{
    $t = str_replace(['’', '‘', '“', '”', '–', '—', '…', '€', '•', '·'], ["'", "'", '"', '"', '-', '-', '...', 'EUR', '-', '-'], $t);
    return (string) mb_convert_encoding($t, 'Windows-1252', 'UTF-8');
}

const NIVEAUX_FORMATION = [1 => 'Bac', 2 => 'Bac+2', 3 => 'Bac+3', 4 => 'Bac+5'];

/**
 * Le CV genere. $p = profilComplet(), $o = offre publique, $e = evaluation
 * (peut etre null : CV generique). Rend les octets du PDF.
 */
function cvPdf(array $p, ?array $o, ?array $e, bool $avecContact, string $email = ''): string
{
    $pdf = new FPDF('P', 'mm', 'A4');
    $pdf->SetMargins(18, 16, 18);
    $pdf->SetAutoPageBreak(true, 18);
    $pdf->AddPage();
    $pdf->SetTitle(l1('CV — ' . trim($p['prenom'] . ' ' . ($avecContact ? $p['nom'] : $p['initiale'] . '.'))), true);
    $pdf->SetAuthor('Adopte un Job');

    // ---- en-tete : identite, contact si le match l'autorise
    $pdf->SetFont('Helvetica', 'B', 20);
    $nom = trim($p['prenom'] . ' ' . ($avecContact ? mb_strtoupper($p['nom']) : mb_strtoupper($p['initiale']) . '.'));
    $pdf->Cell(0, 10, l1($nom ?: 'Candidat'), 0, 1);
    $pdf->SetFont('Helvetica', '', 10);
    $pdf->SetTextColor(90, 90, 90);
    $ligne = [];
    if ($avecContact) {
        if ($email) {
            $ligne[] = $email;
        }
        if ($p['telephone']) {
            $ligne[] = $p['telephone'];
        }
    } else {
        $ligne[] = 'Coordonnées transmises après match';
    }
    if ($p['zones']) {
        $ligne[] = implode(' · ', $p['zones']);
    }
    if ($p['dispo']) {
        $ligne[] = 'Disponible ' . $p['dispo'];
    }
    $pdf->Cell(0, 6, l1(implode('   |   ', $ligne)), 0, 1);
    $pdf->SetTextColor(0);

    // ---- cible : le poste vise, en tete, c'est un CV recentre
    if ($o) {
        $pdf->Ln(3);
        $pdf->SetFillColor(236, 240, 247);
        $pdf->SetFont('Helvetica', 'B', 11);
        $pdf->Cell(0, 7, l1('Candidature : ' . $o['titre']), 0, 1, 'L', true);
        $pdf->SetFont('Helvetica', '', 9);
        $sous = array_filter([$o['entreprise'] ?? null, $o['ville'] ?? $o['zone'] ?? null, $o['contrat'] ?? null, $o['reference'] ? 'réf. ' . $o['reference'] : null]);
        $pdf->Cell(0, 5, l1(implode(' · ', $sous)), 0, 1, 'L', true);
    }

    $section = static function (FPDF $pdf, string $titre): void {
        $pdf->Ln(4);
        $pdf->SetFont('Helvetica', 'B', 12);
        $pdf->SetTextColor(30, 60, 120);
        $pdf->Cell(0, 7, l1(mb_strtoupper($titre)), 'B', 1);
        $pdf->SetTextColor(0);
        $pdf->Ln(1.5);
    };

    // ---- adequation au poste (si evaluation) : ce qui colle, en premier
    if ($o && $e) {
        $section($pdf, 'Adéquation au poste');
        $pdf->SetFont('Helvetica', '', 10);
        $ok = [];
        foreach (($e['detail']['lexical']['ok'] ?? []) as $x) {
            $ok[] = $x['texte'];
        }
        foreach (($e['detail']['structurel']['ok'] ?? []) as $x) {
            $ok[] = $x['nom'];
        }
        $ok = array_slice(array_values(array_unique($ok)), 0, 8);
        if ($ok) {
            $pdf->SetFont('Helvetica', 'B', 10);
            $pdf->Cell(0, 5, l1('Ce que ce profil apporte au poste'), 0, 1);
            $pdf->SetFont('Helvetica', '', 10);
            foreach ($ok as $x) {
                $pdf->MultiCell(0, 5, l1('- ' . $x));
            }
        }
        $pdf->SetFont('Helvetica', 'I', 9);
        $pdf->SetTextColor(90, 90, 90);
        $pdf->Cell(0, 5, l1('Compatibilité calculée : ' . $e['qualite'] . ' % (confiance ' . $e['confiance'] . ' %). Le détail du calcul est consultable dans l’application.'), 0, 1);
        $pdf->SetTextColor(0);
    }

    // ---- competences : celles du poste d'abord
    $section($pdf, 'Compétences');
    $pdf->SetFont('Helvetica', '', 10);
    $comps = $p['competences'];
    if ($o && $e) {
        $avant = [];
        foreach (($e['detail']['lexical']['ok'] ?? []) as $x) {
            foreach ($comps as $c) {
                if (array_intersect(motsPorteurs($c), $x['mots'] ?? [])) {
                    $avant[] = $c;
                }
            }
        }
        $comps = array_values(array_unique(array_merge($avant, $comps)));
    }
    $pdf->MultiCell(0, 5, l1(implode('  ·  ', $comps ?: ['—'])));
    if (!empty($p['competencesOpt'])) {
        $pdf->SetFont('Helvetica', 'I', 9);
        $pdf->SetTextColor(90, 90, 90);
        $pdf->MultiCell(0, 4.5, l1('Référentiel OPT-NC : ' . implode(' · ', array_slice(array_column($p['competencesOpt'], 'nom'), 0, 10))));
        $pdf->SetTextColor(0);
    }

    // ---- experiences
    if ($p['experiences']) {
        $section($pdf, 'Expériences');
        foreach ($p['experiences'] as $x) {
            $pdf->SetFont('Helvetica', 'B', 10);
            $periode = trim($x['debut'] . ($x['fin'] && $x['fin'] !== $x['debut'] ? ' – ' . $x['fin'] : ($x['debut'] && !$x['fin'] ? ' – aujourd’hui' : '')));
            $pdf->Cell(0, 5.5, l1($x['poste'] ?: 'Poste'), 0, 1);
            $pdf->SetFont('Helvetica', '', 9.5);
            $pdf->SetTextColor(90, 90, 90);
            $pdf->Cell(0, 5, l1(implode(' · ', array_filter([$x['secteur'], $periode]))), 0, 1);
            $pdf->SetTextColor(0);
            $pdf->Ln(1);
        }
    }

    // ---- formations : niveau et domaine, jamais l'annee
    if ($p['formations']) {
        $section($pdf, 'Formation');
        $pdf->SetFont('Helvetica', '', 10);
        foreach ($p['formations'] as $f) {
            $pdf->Cell(0, 5.5, l1((NIVEAUX_FORMATION[(int) $f['niveau']] ?? '') . '  —  ' . $f['domaine']), 0, 1);
        }
    } elseif ($p['formation']) {
        $section($pdf, 'Formation');
        $pdf->SetFont('Helvetica', '', 10);
        $pdf->Cell(0, 5.5, l1('Niveau ' . (NIVEAUX_FORMATION[(int) $p['formation']] ?? '')), 0, 1);
    }

    // ---- langues, mobilite
    $divers = [];
    foreach ($p['langues'] as $l) {
        $divers[] = $l['langue'] . ' (' . $l['niveau'] . ')';
    }
    if ($p['permis'] === true) {
        $divers[] = 'Permis B';
    }
    if ($p['contrats']) {
        $divers[] = 'Recherche : ' . implode(', ', $p['contrats']);
    }
    if ($divers) {
        $section($pdf, 'Langues et mobilité');
        $pdf->SetFont('Helvetica', '', 10);
        $pdf->MultiCell(0, 5, l1(implode('  ·  ', $divers)));
    }

    // ---- pied
    $pdf->SetY(-14);
    $pdf->SetFont('Helvetica', 'I', 8);
    $pdf->SetTextColor(120, 120, 120);
    $pdf->Cell(0, 5, l1('Généré par Adopte un Job le ' . gmdate('d/m/Y') . ' à partir du profil déclaré par le candidat. Aucune donnée inventée ; aucune date de diplôme, par choix.'), 0, 0, 'C');

    return $pdf->Output('S');
}



/* JSON Resume (jsonresume.org) : le schema norme cite par le HackAVP, pour
   emporter son profil ailleurs. Pas d'annee de diplome, par choix.

   La fabrication est une fonction et non du code dans la route : la passerelle
   d'echange sert exactement le meme document, et deux facons de produire un
   JSON Resume finiraient par diverger. */
function jsonResume(array $p, string $email): array
{
    $niv = ['Bac', 'Bac+2', 'Bac+3', 'Bac+5'];
    return [
        '$schema' => 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
        'basics' => [
            'name' => trim($p['prenom'] . ' ' . $p['nom']),
            'email' => $email,
            'phone' => $p['telephone'] ?: null,
            'summary' => $p['metiersOpt'] ? 'Métiers visés : ' . implode(', ', array_column($p['metiersOpt'], 'nom')) : null,
            'location' => ['region' => implode(', ', $p['zones']), 'countryCode' => 'NC'],
        ],
        'work' => array_map(static fn ($x) => ['position' => $x['poste'], 'name' => $x['secteur'], 'startDate' => $x['debut'] ?: null, 'endDate' => $x['fin'] ?: null], $p['experiences']),
        'education' => array_map(static fn ($f) => ['studyType' => $niv[max(0, min(3, (int) $f['niveau'] - 1))], 'area' => $f['domaine']], $p['formations']),
        'skills' => array_merge(
            array_map(static fn ($s) => ['name' => $s], $p['competences']),
            array_map(static fn ($s) => ['name' => $s['nom'], 'keywords' => ['OPT-NC:' . $s['code']]], $p['competencesOpt'])
        ),
        'languages' => array_map(static fn ($l) => ['language' => $l['langue'], 'fluency' => $l['niveau']], $p['langues']),
        'meta' => ['generator' => 'Adopte un Job', 'version' => 'v1.0.0', 'lastModified' => maintenant()],
    ];
}

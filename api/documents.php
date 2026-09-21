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

/**
 * Propositions de premiers messages, par regles. Un texte court, personnalise
 * par ce qu'on sait — le poste, le prenom, une competence commune — et jamais
 * plus. L'utilisateur le modifie avant d'envoyer, c'est le principe.
 */
function suggestionsMessages(string $role, array $p, array $o, ?array $e): array
{
    $prenom = $p['prenom'] ?: 'Bonjour';
    $poste = $o['titre'];
    $commune = null;
    foreach (($e['detail']['lexical']['ok'] ?? []) as $x) {
        $commune = $x['texte'];
        break;
    }
    if ($commune === null && !empty($e['detail']['structurel']['ok'][0]['nom'])) {
        $commune = $e['detail']['structurel']['ok'][0]['nom'];
    }
    $manque = $e['detail']['lexical']['manque'][0]['texte'] ?? ($e['detail']['structurel']['manque'][0]['nom'] ?? null);

    if ($role === 'candidat') {
        $s = [
            "Bonjour, merci d’avoir retenu ma candidature pour le poste de $poste. Je suis disponible pour un échange quand vous le souhaitez.",
            $commune
                ? "Bonjour, ravi(e) de ce match. Mon expérience en « $commune » correspond directement à ce que demande le poste de $poste — je serais heureux(se) d’en parler."
                : "Bonjour, ravi(e) de ce match sur le poste de $poste. Qu’est-ce qui, dans mon profil, a retenu votre attention ?",
            $manque
                ? "Bonjour, je vois que le poste demande « $manque ». Je n’en ai pas encore fait l’expérience, mais je suis prêt(e) à me former : peut-on en discuter ?"
                : "Bonjour, quelles seraient les prochaines étapes pour le poste de $poste ? Je peux me rendre disponible pour un entretien dès cette semaine.",
        ];
    } else {
        $s = [
            "Bonjour $prenom, votre profil a retenu notre attention pour le poste de $poste. Seriez-vous disponible pour un premier échange ?",
            $commune
                ? "Bonjour $prenom, votre expérience en « $commune » nous intéresse pour le poste de $poste. Pouvez-vous nous en dire plus ?"
                : "Bonjour $prenom, merci pour votre candidature au poste de $poste. Pouvez-vous nous parler de ce qui vous attire dans ce poste ?",
            "Bonjour $prenom, nous souhaitons vous proposer un entretien pour le poste de $poste. Je vous envoie des créneaux dans l’agenda de l’application.",
        ];
    }
    return array_map(static fn ($x) => mb_substr($x, 0, 400), $s);
}

/** Un fichier iCalendar pour un entretien : le candidat le met dans son agenda. */
function ics(array $ent, string $titre, string $organisation): string
{
    $debut = gmdate('Ymd\THis\Z', strtotime($ent['debut_utc'] . ' UTC'));
    $fin = gmdate('Ymd\THis\Z', strtotime($ent['debut_utc'] . ' UTC') + (int) $ent['duree_min'] * 60);
    $esc = static fn (string $t) => addcslashes($t, ",;\\");
    $lieu = $ent['mode'] === 'sur place' ? ($ent['lieu'] ?: $organisation) : ucfirst($ent['mode']) . ($ent['lieu'] ? ' — ' . $ent['lieu'] : '');
    return implode("\r\n", [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adopte un Job//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' . $ent['uid_ics'],
        'DTSTAMP:' . gmdate('Ymd\THis\Z'),
        'DTSTART:' . $debut,
        'DTEND:' . $fin,
        'SUMMARY:' . $esc('Entretien — ' . $titre),
        'LOCATION:' . $esc($lieu),
        'DESCRIPTION:' . $esc(($ent['notes'] ?? '') ?: 'Entretien organisé via Adopte un Job.'),
        'STATUS:' . ($ent['statut'] === 'confirme' ? 'CONFIRMED' : ($ent['statut'] === 'annule' ? 'CANCELLED' : 'TENTATIVE')),
        'END:VEVENT', 'END:VCALENDAR', '',
    ]);
}

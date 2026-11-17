# Comparaison lisible et critères mis en évidence — 0.4.8 — 17 novembre 2026

Amélioration après V1 demandée par Bastian : mieux présenter le menu Comparaison et faire ressortir
ce qui peut être comparé entre les offres, à partir des seules données existantes.

## Interface et repères

- Bilan : offres sélectionnées, nombre de critères comparables et nombre de critères avec des écarts.
- Douze critères, en trois rubriques : Pratique (lieu, contrat, clôture, prise de poste, postes à pourvoir),
  Contenu du poste (métier, missions, conditions), Profil attendu (compétences, qualifications, expérience, adéquation disponible).
- Filtres Tout voir, Les écarts et Comparables, combinables avec une rubrique.
- Repères Identique, Identique · partiel, Valeurs différentes, À compléter et Non renseigné.
- Valeurs partagées par au moins deux offres mises en évidence, y compris si une troisième diffère.
- Colonnes identifiées, titres fixes sur ordinateur, lecture par critère sans défilement horizontal sur mobile.
- Listes longues dépliables après trois éléments, détail consultable et sélection modifiable/conservée.
- États vides utiles et reprise après erreur ; guide de comparaison mis à jour.

## Sens des repères

Un critère est comparable si au moins deux offres le renseignent. Une absence ne devient ni une
égalité connue ni un écart. Les listes sont comparées sans tenir compte de leur ordre, casse ou doublons.
Deux textes différents ne sont pas une évaluation de leur sens ni de la meilleure offre.
Aucun classement ou score nouveau : le pourcentage disponible vient toujours de CV-Matching.
Aucune nouvelle API ou demande aux autres groupes.

## Vérifications

Compilation TypeScript/Vite, 31 tests applicatifs et 8 contrôles PHP réussis (39 contrôles au total).
Trois tests de régression ajoutés sur les inconnues, égalités/écarts/listes et score existant à zéro.
Recette Chrome locale avec services simulés sur sept formats : 320×568, 390×844, 768×1024,
1280×720, 1440×900, 1920×1080 et 844×390. Filtres, mise en évidence, lecture/retrait et conservation
après rechargement vérifiés ; thèmes jour/nuit et texte très grand vérifiés sur les formats de capture.
États vide, une seule offre, offre indisponible, filtre sans résultat et reprise réseau vérifiés séparément.
Preuves : `verification-comparaison-0.4.8.json`, `verification-comparaison-etats-0.4.8.json` et captures `comparaison-048-*.png`.
Aucun compte ni candidature réels utilisés. La V1 et ses supports restent inchangés.

# Menu Profil réagencé — 0.4.9 — 17 novembre 2026

**En production depuis le 17 novembre 2026**, commit applicatif `0113d77`.
[Contrôles de publication](DEPLOIEMENT-0.4.9-2026-11-17.md).

Amélioration après V1 demandée par Bastian : hiérarchiser le dossier, les étapes, les conseils et les outils.

- En-tête de dossier, état de sauvegarde lisible et progression des informations requises.
- Action prioritaire vers le premier champ manquant, ou vers Relecture si l’essentiel est renseigné.
- Accès distincts au fichier CV et aux neuf questions ; état du document indiqué.
- Cinq étapes avec état réel des champs requis, étape active et consigne courte ; navigation au clavier et focus du titre.
- Formulaire dans un bloc de lecture ; sauvegarde automatique et validation propre aux rubriques détaillées expliquées.
- Conseils de rédaction à droite sur ordinateur, repliés avant le formulaire sur petit écran ; Corriger cible le champ exact.
- Richesse de rédaction distinguée des informations requises et de l’adéquation à une offre.
- Outils du compte/import/export séparés ; réinitialisation nommée explicitement comme portant sur les informations du profil.
- Guide mis à jour, thèmes et texte agrandi pris en compte.

Compilation TypeScript/Vite, 31 tests applicatifs et 8 contrôles PHP réussis.
Recette locale sur sept formats : 320×568, 390×844, 768×1024, 1280×720, 1440×900, 1920×1080 et 844×390.
Vérifiés : cinq étapes sans débordement, focus des conseils sur le champ exact, CV et outils accessibles,
saisie sauvegardée et relue après rechargement, questions et profil vierge.
Guide en neuf étapes et aperçu d’import annulé sans écriture vérifiés sur 390×844 et 1440×900 ;
thème nuit et texte très grand également contrôlés sur ces deux formats.
Preuves : `verification-profil-0.4.9.json`, `verification-profil-guide-import-0.4.9.json`, captures `profil-049-*.png`.
Aucun compte ni candidature réels utilisés, aucune nouvelle API ni demande aux autres groupes.
La V1 du rendu et ses supports restent inchangés.

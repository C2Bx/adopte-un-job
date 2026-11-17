# Confirmation d’envoi compacte — 0.4.6 — 17 novembre 2026

**État historique intermédiaire** : publié le 17 novembre à 16 h 57 (`1aa1ae5`), puis remplacé par
la [confirmation intégrée de cinq secondes](CONFIRMATION-0.4.7.md), à la demande de Bastian.

Amélioration après V1, à partir de la capture de Bastian : la confirmation utilisait la largeur
prévue pour les grands détails, mais le texte restait limité à une colonne étroite.

La confirmation dispose désormais d’un format compact (540 px maximum), d’un titre explicite,
d’un repère de réussite, d’un texte occupant la largeur utile et d’un encadré pour le poste.
Le bouton Continuer reste visible en pied de fenêtre, ajusté au contenu sur ordinateur et pleine largeur
sur mobile. Le message confirme l’enregistrement sans prétendre que le recruteur a déjà lu le dossier.
Les autres fenêtres, notamment la relecture avant envoi, gardent leurs dimensions existantes.

Compilation TypeScript/Vite réussie. Recette locale avec services simulés sur sept formats :
320×568, 390×844, 768×1024, 1280×720, 1440×900, 1920×1080 et 844×390.
Vérifiés : intitulé long, largeur compacte, texte utilisant l’espace disponible, bouton accessible,
thème sombre avec texte très grand et Continuer sans deuxième envoi.
Preuves : `verification-confirmation-0.4.6.json` et captures `confirmation-046-*.png`.
Aucun compte ni candidature réels ; aucune nouvelle API ni demande aux autres groupes.
La V1 du rendu et ses supports restent inchangés.

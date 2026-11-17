# Défilement indépendant des candidatures — 0.4.5 — 17 novembre 2026

Correction après V1 signalée par Bastian : dans Mes candidatures, faire défiler le détail de droite
entraînait aussi la liste de gauche. Le conteneur commun défilait et le détail restait sans hauteur bornée.

Lorsque les deux colonnes sont affichées (à partir de 1440 px), la grille occupe la hauteur disponible,
et la liste et le détail disposent chacun de leur zone défilante. Le défilement est contenu dans la colonne,
y compris en fin de contenu. Les deux zones peuvent recevoir le focus clavier et portent un nom accessible.
En dessous de ce seuil, la liste et le détail en fenêtre gardent leur fonctionnement existant.

Compilation TypeScript/Vite réussie. Recette Chrome locale avec 35 offres et longs détails simulés :
1440×900, 1920×1080, 2560×1440, 1440×600, 1280×720, 390×844 et 844×390.
Vérifiés : molette droite sans mouvement à gauche, inversement, absence d’entraînement à la fin des deux
colonnes, Page suivante au clavier dans le détail, sélection d’une autre offre et détail mobile défilable.
Aucun débordement horizontal observé. Preuves : `verification-scroll-0.4.5.json` et
`candidatures-scroll-045-desktop.png`. Aucun compte ni candidature réels ; aucune API ajoutée.
V1 et supports du rendu inchangés.

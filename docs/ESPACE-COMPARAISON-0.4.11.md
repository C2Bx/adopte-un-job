# Comparaison : davantage de place pour lire — 0.4.11 — 17 novembre 2026

Ajustement après V1 demandé par Bastian : les commandes, compteurs et titres occupaient trop de hauteur,
au détriment des informations comparées.

- En-tête de page et actions compacts, compteurs sur une ligne, filtres regroupés.
- Deux listes de choix sur mobile pour conserver les filtres sans empiler les boutons.
- En-têtes de colonnes réduits : titre cliquable pour ouvrir le détail et croix pour retirer l’offre.
- Explications et limites dans une rubrique repliée, accessible en bas de la page ; guide adapté.
- Tableau défilant dans la hauteur restante, y compris sur petit écran et écran bas.
- Critères, points communs, écarts, données absentes et sélection conservés ; aucun score ni API ajoutés.

## Gain mesuré localement

Même sélection de trois offres simulées, mêmes formats avant/après. Sur ordinateur, la lecture utile
correspond à la partie visible du tableau sous les titres fixes ; sur mobile, au tableau visible par critère.

| Format | Avant | Après |
|---|---:|---:|
| 1440×900 | 359 px | 597 px |
| 1280×720 | 179 px | 417 px |
| 390×844 | 275 px | 506 px |
| 844×390 | 0 px | 81 px |

Ces valeurs décrivent la recette locale avec les intitulés testés ; le texte agrandi et les titres
peuvent modifier la hauteur exacte.

Compilation TypeScript/Vite réussie. Recette sur sept formats : 320×568, 390×844, 768×1024,
1280×720, 1440×900, 1920×1080 et 844×390. Filtres, repères, lecture/retrait, sélection conservée,
thème nuit et texte agrandi vérifiés. Aide repliable, accès au dernier critère et guide de quatre étapes
vérifiés sur mobile et ordinateur. Aucune candidature ni compte réels utilisés.
Preuves : `comparaison-espace-avant.json`, `comparaison-espace-apres.json`,
`verification-comparaison-0.4.11.json`, `verification-comparaison-lecture-0.4.11.json`, captures `comparaison-0411-*.png`.
La V1 du rendu reste intacte ; aucune nouvelle API ni demande aux autres groupes.

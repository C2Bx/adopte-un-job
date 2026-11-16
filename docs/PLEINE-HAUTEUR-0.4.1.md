# Offre pleine hauteur — 0.4.1 — 17 novembre 2026

Amélioration après rendu, à la demande de Bastian : la carte utilise toute la hauteur disponible sous
l’en-tête et jusqu’en bas de la zone de contenu, avec une marge de 8 à 10 px.

- Ordinateur (1100 px et plus) : titre, commandes, recherche et filtres restent dans la colonne gauche ;
  la carte de droite traverse toutes les lignes et n’est plus repoussée par ces commandes.
- Mobile et tablette : la carte remplit la zone entre l’en-tête et la navigation. Recherche/filtres restent
  accessibles avec le bouton **Filtres** dans la carte. La fenêtre propose également Affichage et tri.
- Les vues liste/tableau gardent leur barre de commandes. Une liste vide garde les outils pour élargir la recherche.
- Retour, Passer, Favori et Candidater restent dans la carte ; comparaison, guide et gestes conservés.
- Les cibles du guide tiennent compte des commandes réellement visibles selon la taille de l’écran.

## Vérifications

Compilation TypeScript/Vite réussie, 28 tests applicatifs et 8 contrôles PHP réussis (36 au total).
Recette Chrome locale sur sept formats : hauteur de carte égale à la hauteur utile moins 16 à 20 px,
aucun débordement horizontal et actions accessibles. Recherche/effacement, accès aux filtres, passage
cartes/liste/cartes et guide des offres vérifiés. Mesures :

| Écran | Carte | Lecture |
|---|---:|---:|
| 320×568 | 440 px | 353 px |
| 390×844 | 701 px | 610 px |
| 768×1024 | 936 px | 859 px |
| 1280×720 | 628 px | 551 px |
| 1440×900 | 808 px | 731 px |
| 1920×1080 | 988 px | 911 px |
| 844×390 | 323 px | 250 px |

Les parcours authentifiés utilisent le serveur local simulé, sans compte ni candidature réels.
Aucune API serveur ni demande à un autre groupe. Le rendu initial reste une référence distincte.

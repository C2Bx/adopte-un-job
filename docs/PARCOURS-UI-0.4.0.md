# Parcours et interface MS3 — version 0.4.0 — 16 novembre 2026

Amélioration après rendu : la référence du 20 octobre (`b823f58`) et les publications précédentes restent conservées.
Ce lot reprend les parcours complets plutôt que d’ajouter des commandes dans les zones de lecture.

## Quatre destinations visibles

**Offres → Comparaison → Candidatures → Profil** dans la navigation principale, sur ordinateur et mobile.
La comparaison a une vraie page, avec une pastille indiquant la sélection. Elle n’est plus enfermée dans
une fenêtre ou affichée au-dessus des offres.

### Offres et filtres

- En-tête compact ; affichage, tri, recherches mémorisées et option de relecture dans une fenêtre dédiée.
- Recherche de poste et filtres directs **Lieu / Contrat** immédiatement accessibles.
- Le bouton Filtres présente les autres choix, tous visibles sans catégories à déplier ; la recherche de critères reste disponible.
- Les critères actifs utilisent une seule rangée défilante, avec Tout effacer toujours accessible.
- Le détail et la carte récupèrent l’espace pris par les commandes. Mesure Chrome à 1440×900 :
  **610 px de hauteur de lecture dans la carte** après réduction finale des actions.
- Retour, Passer, Favori et Candidater restent intégrés à la carte de droite. Petits boutons et libellés
  compacts ; taille de toucher conservée sur les écrans tactiles. Étoile remplie jaune, adaptée au mode nuit.
- Souris gauche/droite/haut et favori tactile depuis la poignée conservés.

### Comparaison

- Le bouton **Comparer** existe directement sur la carte et dans les vues liste/tableau.
- Sélection de deux ou trois offres ; accès depuis le menu Comparaison ou le bouton de l’en-tête.
- Sur ordinateur, tableau sur toute la largeur disponible, titres visibles et colonnes lisibles.
- Sur mobile, informations regroupées par critère avec le titre de chaque offre : aucun défilement horizontal nécessaire.
- Lire l’offre, retirer et vider la sélection ; en mobile, « Gérer les offres sélectionnées » regroupe ces actions.
- La sélection est conservée par compte dans ce navigateur, y compris après rechargement. Si le stockage
  n’est pas disponible, la session garde une sélection en mémoire sans garantir sa conservation après fermeture.
- Seules les données et scores existants sont affichés. Les informations absentes restent signalées.

### Profil

Le formulaire dispose de davantage de largeur ; les conseils secondaires occupent une colonne compacte.
Sur mobile, les conseils sont repliables. Les outils CV, questions et compte/import/export restent identifiés.

Chaque bouton **Corriger** ouvre l’étape, fait défiler au champ exact, place le focus et le met en évidence :
compétences, ajout d’expérience, formation, langues, salaire et permis. Le cas de deux conseils sur la même
étape, et le retour au même champ, sont pris en charge.

### Candidatures

Recherche, réponse reçue et ordre sont alignés. La liste n’est plus comprimée par une colonne vide.
Le détail n’occupe une colonne qu’à partir de 1440 px et lorsqu’une offre existe ; en dessous, une fenêtre
lisible s’ouvre. Mise à jour automatique existante conservée, sans bouton Actualiser.

## Guide : couverture fonctionnelle

Pop-up, reste de l’interface grisé, zone expliquée mise en évidence, navigation Précédent/Suivant/Arrêter/Terminer.
Les consignes sont maintenant structurées en actions nommées et explications courtes, plutôt qu’un paragraphe.
Le lancement initial automatique reste limité à la première connexion du compte dans ce navigateur.

| Page | Étapes | Outils présentés |
|---|---:|---|
| Offres | 12 | Affichage/tri, recherche, filtres, détail et archives, adéquation, comparaison, gestes/actions/favoris, relecture, notes/étiquettes, partage, recherches mémorisées, confort de lecture. |
| Comparaison | 4 | Sélection, lecture côte à côte ou par critère au mobile, retrait/détail, données manquantes et stockage local. |
| Candidatures | 7 | Trois onglets, recherche/tri/statuts, détail, réponses, modification d’une décision, notes, mise à jour automatique. |
| Profil | 9 | Progression/sauvegarde, CV/extraction, formulaire, correction précise, profil enrichi, questions, import/export, restauration/effacement, compte/confort. |

**32 étapes réparties par page**, accessibles depuis Guide. Une visite n’exécute aucune action métier.
Le guide aide à découvrir les outils ; il ne prétend pas qu’un score, une réponse ou une donnée absente existe.

## Recette obtenue

- 28 tests applicatifs et 8 contrôles PHP réussis (**36**), compilation TypeScript/Vite réussie, audit npm sans vulnérabilité signalée.
- Parcours complet dans Chrome sur 320×568, 390×844, 768×1024, 1280×720, 1440×900, 1920×1080 et 844×390.
- Filtres directs et complets, sélection depuis cartes puis liste, menu Comparaison, rechargement avec sélection
  conservée, retrait, détail et retour aux offres ; navigation des quatre menus vérifiée.
- Toutes les étapes des quatre guides vérifiées sur ordinateur et mobile, avec précédent/suivant/fin.
- Les six conseils de profil vérifiés jusqu’au focus du champ et sa visibilité, sur ordinateur **et** mobile.
- Candidatures remplies vérifiées à 844/1280/1440 px pour le passage fenêtre/colonne de détail.
- Glissés souris trois directions, favori tactile, annulation de relecture, mise à jour automatique,
  erreur réseau avec conservation de la liste et reprise, guide initial depuis connexion : contrôlés.

Les parcours authentifiés utilisent exclusivement des réponses simulées locales, sans compte ni candidature
réels. Les données de recette ne sont pas intégrées au produit. Ces contrôles ne constituent pas une certification
d’accessibilité ni une recette de tous les navigateurs et appareils.

## Périmètre et historique

Aucune API serveur, calcul de matching ni demande à un autre groupe. Les contrats existants sont utilisés.
La consultation sans compte et le mode fictif restent retirés. Les documents 0.3.0/0.3.1 décrivent leurs états
historiques ; cette version remplace notamment la comparaison en fenêtre et les catégories repliables des filtres.

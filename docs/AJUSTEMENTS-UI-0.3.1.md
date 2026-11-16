# Ajustements UI — 0.3.1 — 16 novembre 2026

**En production depuis le 16 novembre 2026**, commit applicatif `199fe42`.
[Contrôles de publication](DEPLOIEMENT-0.3.1-2026-11-16.md).

Évolution après rendu de la refonte 0.3.0. Le rendu du 20 octobre et les versions précédentes restent des références historiques.

## Disposition et gestes

Les boutons Retour, Passer, Favori et Candidater sont **dans la carte de l’offre**, à droite sur ordinateur,
avec le contenu de la carte défilant au-dessus. Ils ne forment plus une barre sur toute la page.
Sur mobile, « Affichage et recherches » se replie pour laisser la place à l’offre.

À la souris : maintenir le bouton gauche sur une zone non interactive de la carte, déplacer puis relâcher.
Gauche = passer ; droite = récapitulatif de candidature ; haut = favori. Le glissement vers le haut est possible
depuis le corps de la carte à la souris. Les liens et boutons ne commencent pas un geste.
Au tactile, la poignée reste la zone du glissement vers le haut ; le texte garde son défilement vertical.
Les favoris restent locaux au navigateur et les archives ne permettent toujours pas de candidater.

## Filtres

- Fenêtre structurée avec bilan du nombre d’offres et des critères actifs.
- Choix Offres ouvertes / Archives clairement séparé des critères.
- Recherche dans les choix, indépendante de la recherche des postes.
- Catégories repliables, compte des choix, critères sélectionnés retirables et effacement par catégorie.
- Boutons Tout effacer / Voir les offres dans un pied fixe, toujours accessible pendant le défilement.
- Application immédiate dans le navigateur ; aucune nouvelle API.

## Tutoriel

Le guide est un **petit pop-up**, avec le reste de l’application grisé et bloqué pendant la visite.
Un projecteur laisse la zone expliquée lisible. Précédent, Suivant, Arrêter, Terminer et Échap sont disponibles.
Le focus reste dans le guide ; l’interface redevient utilisable après fermeture.

Il se lance automatiquement lorsque le profil est chargé après la **première connexion de ce compte
sur ce navigateur**. Le repère est conservé localement par identifiant de compte ; un autre navigateur
ou l’effacement du stockage peut déclencher une nouvelle visite. Il n’existe pas de suivi global entre appareils.
Le bouton Guide permet de le relancer à tout moment. Le guide n’effectue aucune modification métier.

## Candidatures automatiques

Le bouton Actualiser est retiré. La page recharge les informations existantes à son ouverture,
au retour dans la fenêtre et toutes les **30 secondes lorsqu’elle est visible**.
Les requêtes ne se superposent pas ; le minuteur est supprimé en quittant la page.
Une erreur conserve la liste déjà affichée et une tentative réussie retire l’erreur.
Une réponse commencée avant une modification locale ne remplace pas la décision plus récente.
Une date absente est affichable sans faire planter l’écran.

## Vérifications

- 28 tests applicatifs et 8 contrôles PHP réussis (**36 au total**), compilation TypeScript/Vite réussie.
- Audit des dépendances : zéro vulnérabilité signalée.
- Recette Chrome locale sur 320×568, 390×844, 768×1024, 1280×720, 1440×900, 1920×1080 et 844×390.
- Boutons dans la carte et visibles ; filtres recherchables, sélection et effacement ; pied des filtres accessible.
- Guide pop-up, arrière-plan inerte, progression et arrêt ; lancement après soumission du formulaire de connexion
  et absence de répétition au rechargement du même navigateur.
- Glissés à la souris depuis le titre : haut/gauche/droite ; annulation de relecture ; favori tactile.
- Horloge de recette pilotée pour vérifier les 30 secondes sans attendre : retour de fenêtre, pause si onglet
  caché, arrêt hors page, erreur réseau conservant les candidatures et reprise automatique.

Les parcours authentifiés utilisent un serveur simulé local, sans compte ni candidature réels.
Les données de recette ne sont pas publiées dans le produit. Les vérifications ne constituent pas une
certification d’accessibilité ni une validation de tous les navigateurs et appareils.
Aucune API serveur, aucun calcul de matching et aucun travail des autres groupes ajoutés.

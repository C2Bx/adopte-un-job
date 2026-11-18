# Guide dynamique — consignes et prompt pour une autre application

Référence documentaire du **18 novembre 2026**, à la demande de Bastian.

## Périmètre et statut réel

Le prompt ci-dessous est destiné à une **autre application web, dans une autre conversation**.
Cette application n’est pas identifiée ici et son code n’a pas été examiné dans ce dépôt.
Le prompt est prêt à réutiliser ; aucune implémentation ni publication dans cette autre application n’est attestée.
Sa rédaction ne commande pas une refonte du guide MS3 dans cette conversation.

Adopte un Job reste documenté en **0.4.12**, commit applicatif publié `8c00760`.
La V1 du rendu, les améliorations livrées et les [pistes non livrées](PISTES-AMELIORATION.md) restent distinctes.
Cette mise à jour documentaire n’ajoute pas de version applicative et ne nécessite pas de déploiement.

## Guide livré et exigences de réutilisation

Le guide MS3 existant possède des parcours par page, une visite initiale mémorisée par compte/navigateur,
une mise en évidence et des ajustements lors des changements de taille ou de défilement.
Ces constats sont vérifiables dans `beta/src/App.tsx` et `beta/src/Guide.tsx`.
Ils ne constituent pas une réalisation de toutes les exigences ci-dessous : les parcours actuels utilisent
notamment des sélecteurs CSS et un repli sur l’écran lorsqu’une cible manque.
Le versionnement des nouveautés, les cibles stables dédiées, la distinction terminé/arrêté et la vérification
de couverture des nouvelles fonctionnalités sont ici des exigences du prompt, pas des capacités nouvellement livrées.

Un guide dynamique adapte son parcours aux fonctions réellement présentes. Il ne découvre pas seul
les fonctionnalités à expliquer : toute évolution importante de l’interface doit inclure une revue du guide.

## Prompt complet à transmettre

Le texte suivant s’adresse à la conversation de l’application cible. Les instructions d’implémentation
et de publication qu’il contient s’appliqueront à ce projet une fois transmises, avec ses autorisations propres.

```text
Je veux mettre en place un guide interactif, dynamique et évolutif dans cette application web.

Commence par examiner le projet, son architecture, les pages et les parcours existants. Mets ensuite en place un guide adapté à l’interface réelle.

Cette application évolue rapidement : des fonctionnalités apparaissent, changent de place ou disparaissent régulièrement. Le guide doit accompagner ces évolutions sans présenter d’éléments obsolètes ni oublier les nouveautés importantes.

EXPÉRIENCE ATTENDUE

- Ouvrir automatiquement la visite initiale à la première connexion, une fois par compte et navigateur.
- Ajouter un bouton « Guide » pour relancer le parcours de la page courante.
- Présenter les fonctionnalités dans un ordre logique, adapté à chaque page.
- Utiliser un petit bloc flottant, positionné sans cacher l’élément expliqué ni ses commandes utiles.
- Griser le reste de la page et mettre précisément en évidence l’élément présenté.
- Faire défiler la page si nécessaire pour montrer cet élément.
- Proposer Précédent, Suivant, Arrêter et Terminer.
- Afficher le numéro d’étape et une progression cohérente.
- Rédiger des textes courts et structurés : titre clair, action à effectuer et explication utile. Éviter les gros blocs de texte.
- Fonctionner sur ordinateur, tablette et mobile, y compris après redimensionnement.
- Être utilisable au clavier, gérer correctement le focus et se fermer avec Échap.
- Respecter la préférence de réduction des animations.
- Ne déclencher aucune action métier pendant la visite : aucun envoi, suppression ou modification automatique.

COMPORTEMENT DYNAMIQUE

- Construire les étapes selon la page, le rôle, les permissions, les fonctionnalités activées et l’état réel de l’interface.
- Présenter uniquement les fonctions disponibles pour l’utilisateur.
- Rattacher les étapes aux composants avec des identifiants stables dédiés au guide, plutôt qu’à leur texte, leur position ou des sélecteurs CSS fragiles.
- Vérifier qu’une cible existe et qu’elle est visible au moment de la présenter.
- Recalculer la position du bloc et de la mise en évidence lors du défilement, du redimensionnement ou d’un changement de mise en page.
- Si une cible disparaît ou devient inaccessible pendant la visite, adapter le parcours et recalculer la progression. Ne jamais pointer vers une zone vide ou un élément de remplacement sans rapport.
- Distinguer un chargement temporaire d’une fonction supprimée : attendre raisonnablement les données, sans bloquer indéfiniment.
- Pour une cible située dans un panneau ou un onglet fermé, prévoir explicitement comment la présenter. Seuls des changements réversibles de navigation ou d’affichage sont permis ; aucune donnée ne doit être modifiée.
- Si l’utilisateur change de page pendant la visite, adapter ou arrêter proprement le parcours.
- Si aucune étape pertinente n’est disponible, fermer proprement le guide avec une explication claire.
- Le guide ne doit jamais masquer durablement une fonctionnalité, modifier les permissions ou empêcher l’utilisation normale après sa fermeture.

MAINTENANCE ET ÉVOLUTIONS

- Centraliser la définition des parcours et prévoir des conditions d’affichage explicites pour faciliter leur maintenance.
- Toute fonctionnalité importante ajoutée, modifiée, déplacée ou supprimée doit entraîner une revue du guide concerné.
- Intégrer cette vérification au processus habituel de modification de l’interface et la documenter dans les consignes du projet.
- Ajouter des contrôles adaptés pour détecter les cibles cassées, les étapes incohérentes et les problèmes de positionnement.
- Vérifier explicitement que les fonctionnalités importantes sont couvertes.

Attention : ignorer automatiquement les cibles absentes ne suffit pas. Cela évite un blocage, mais ne détecte pas les nouvelles fonctionnalités oubliées. Ne prétends pas que le guide saura découvrir et expliquer tout seul une nouvelle fonction : sa présentation doit être intégrée lors du développement.

Le guide doit accompagner l’évolution de l’application sans imposer de contraintes inutiles à son développement. Adapte la solution à l’architecture existante et garde sa maintenance simple.

VERSIONS ET PROGRESSION

- Distinguer une visite terminée d’une visite arrêtée.
- Ne pas rouvrir automatiquement la visite initiale à chaque connexion après son premier affichage ; elle reste relançable volontairement.
- Versionner les parcours pour gérer leurs évolutions.
- Une correction mineure ne doit pas relancer toute la visite.
- Après une évolution importante, proposer aux utilisateurs existants une courte présentation des nouveautés, avec possibilité de la refuser.
- Conserver séparément l’état de la visite initiale et celui des nouveautés, par compte et navigateur lorsque le stockage existant le permet.
- Prévoir un fonctionnement propre si le stockage local est indisponible, sans bloquer l’application ni promettre une synchronisation inexistante.

PÉRIMÈTRE

- Réutiliser les composants, les conventions et le style du projet.
- Utiliser uniquement les fonctionnalités et API déjà disponibles.
- Ne créer aucune nouvelle API et ne demander à aucune autre équipe de développer une dépendance.
- Écarter les propositions qui exigeraient ces dépendances et expliquer brièvement la limite.

RÉALISATION ET VÉRIFICATIONS

Ne t’arrête pas à une proposition : examine le projet, implémente le guide et vérifie son fonctionnement.

Contrôle notamment :
- Les parcours sur plusieurs tailles d’écran.
- La navigation au clavier et la restitution du focus après fermeture.
- Les éléments absents, masqués, en chargement ou interdits.
- Une cible retirée pendant la visite.
- Les changements de page et de mise en page.
- Les états de première visite, visite arrêtée, visite terminée et nouveautés.
- L’absence d’action métier déclenchée par le guide.

DOCUMENTATION ET GIT

Actualise la documentation et le contexte du projet, notamment les règles pour maintenir le guide lors des prochaines évolutions.

Distingue ce qui est réellement livré des pistes non réalisées. Présente le guide comme une amélioration après la version initiale, sans réécrire son historique.

Respecte les règles Git du projet : aucune attribution ni signature de co-auteur IA. Pour la publication, suis les autorisations déjà établies dans cette conversation.

À la fin, indique clairement ce qui a été réalisé, vérifié et publié, ainsi que les éventuelles limites restantes.
```

## Références

- [V1 et évolutions livrées](V1-ET-EVOLUTIONS.md).
- [Catalogue après rendu](UPGRADES-APRES-RENDU.md).
- [Dernière publication applicative](DEPLOIEMENT-0.4.12-2026-11-17.md).

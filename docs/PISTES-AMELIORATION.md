# Pistes d’amélioration — après V1

**Statut : registre de réflexion, au 17 novembre 2026.** Une entrée ici n’est pas une fonctionnalité livrée,
une promesse de développement ou une tâche déjà approuvée.
La [V1, les corrections et les améliorations livrées](V1-ET-EVOLUTIONS.md) sont documentées séparément.

## Ce qui est déjà livré

Les demandes acceptées et réalisées jusqu’à **0.4.9** sont dans le [catalogue livré](UPGRADES-APRES-RENDU.md)
et le [journal des versions](../CHANGELOG.md). Comparaison, guides, favoris, carte pleine hauteur et boutons
agrandis, ainsi que la correction de confirmation, ne doivent plus être listés comme « à faire ».
Aucune fonctionnalité acceptée de ces lots n’est ici déclarée en cours de développement.

## Pistes à étudier — non engagées, non livrées

| Piste | Statut | Limite de responsabilité |
|---|---|---|
| Recueillir des retours d’usage sur les parcours actuels, puis prioriser les irritants observés | À étudier | Ajustements MS3 uniquement ; aucune nouvelle API. |
| Approfondir la recette clavier, zoom, lecteurs d’écran et navigateurs/appareils complémentaires | À étudier | Contrôles et corrections d’interface ; aucune certification d’accessibilité revendiquée à ce jour. |
| Mesurer les performances sur des appareils moins puissants et des listes d’offres plus longues | À étudier | Optimisations du client à partir des données et contrats existants. |
| Compléter la recette authentifiée de bout en bout avec des données et un compte de test maîtrisés | Validation non réalisée en production | Aucun envoi réel n’est autorisé par cette inscription au registre. Les recettes actuelles authentifiées sont simulées localement. |

Ces entrées sont des axes de validation, pas une réouverture automatique du lot déjà livré.
Tout ajout doit préciser besoin, faisabilité MS3, critères de réussite et état réel.

## Points à confirmer, distincts des fonctionnalités

- Le contexte historique mentionne une ancienne clé dev.to montrée en capture et une rotation à vérifier.
  La clôture de ce point n’est pas établie dans la présente vérification documentaire ; cela ne prouve pas
  que la clé soit encore active. Ne pas recopier sa valeur dans un rapport.
- La référence Git du rendu ne constitue pas une preuve d’envoi du formulaire de participation.

## Hors périmètre — à écarter si une nouvelle API est nécessaire

Nouvelles API, synchronisation serveur des notes/favoris/recherches, messagerie, notifications serveur,
renouvellement des jetons, génération de documents, nouveaux scores, fonctions recruteur ou tableaux de bord
des autres modules : ces travaux ne sont pas commandés à MS3 ni aux autres groupes.
Une piste reposant sur une telle dépendance est écartée, conformément à la consigne de Bastian.

La consultation sans compte et le mode fictif ont été retirés volontairement en 0.2.1.
Ils ne sont ni des tâches inachevées ni des pistes à réintroduire.

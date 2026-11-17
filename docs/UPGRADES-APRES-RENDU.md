# Upgrades et améliorations après V1 — MS3

**Ce catalogue concerne les évolutions déjà livrées après la V1.**
La [V1 de référence](V1-ET-EVOLUTIONS.md) et les [pistes non livrées](PISTES-AMELIORATION.md) sont séparées.

Version applicative actuelle : **0.4.4**, évolution du **17 novembre 2026**, après la fin du rendu.

La [0.4.4](AIDE-0.4.4.md) réorganise Aide et affichage en fiches et rubriques dépliables, avec raccourcis visuels et exemples.

La [0.4.3](RELECTURE-0.4.3.md) corrige la relecture : Confirmer et Annuler restent toujours visibles ; seul le dossier défile.

La [0.4.2](ACTIONS-0.4.2.md) agrandit les quatre boutons d’action et leurs icônes dans la carte pleine hauteur.

La [0.4.1](PLEINE-HAUTEUR-0.4.1.md) donne toute la hauteur utile à la carte, avec les commandes à gauche ou accessibles depuis la carte.

La [0.4.0](PARCOURS-UI-0.4.0.md) organise quatre menus dont une comparaison pleine page, compacte les commandes, réagence Profil/Candidatures et complète les guides.

La [0.3.1](AJUSTEMENTS-UI-0.3.1.md) intègre les actions à la carte, refait les filtres, présente un guide pop-up automatique au premier usage et actualise les candidatures automatiquement.

La 0.3.0 ajoute la [refonte UI, le tutoriel par page et le swipe haut pour les favoris](REFONTE-UI-0.3.0.md).
Les limites de stockage et la séparation avec le rendu restent applicables.

**0.2.1 publiée en production le 16 novembre 2026**, commit applicatif `bdb4ebc`.
Voir [les contrôles de publication](DEPLOIEMENT-2026-11-16.md).

La consultation sans compte et le mode fictif intégré de la 0.2.0 sont retirés à la demande de Bastian.
L’accueil et l’aide ne les proposent plus. Un lien d’offre nécessite une connexion ;
`?demo=1` n’active plus aucun scénario fictif. Le prototype historique `demo/` reste une archive locale,
exclue du déploiement. Les documents du 2 novembre décrivent l’état historique de la 0.2.0.

**Version 0.2.0 publiée en production le 2 novembre 2026**, commit applicatif `8abffd7`.
Voir [les contrôles de publication](DEPLOIEMENT-2026-11-02.md).

## Repères de version

| Phase | Référence | Statut |
|---|---|---|
| V1 — référence du rendu | `b823f58`, 20 octobre, package `0.1.0` | Figée par `reference-rendu-2026-10-20`. |
| Corrections après V1 | `16c3bb0`, 27 octobre | Fiabilité et sécurité corrigées après rendu. |
| Améliorations après V1 | Lots `0.2.0` à `0.4.4` | Développés après rendu ; dernier code publié : `8d89af8`. |
| Pistes | Registre séparé | Non livrées, non engagées par défaut. |

La référence du rendu n'est ni réécrite ni remplacée par la version améliorée.

## Règle de périmètre

Ce lot ne crée aucune API serveur et ne demande aucun travail à un autre groupe.
Les nouvelles méthodes de `api.ts` sont des fonctions clientes utilisant les routes existantes.
La liste de routes du relais PHP et le calcul de score de MS5 sont inchangés.
Les documents ne sont ni générés ni extraits par MS3 ; MS3 présente et édite les données déjà reçues.

## Catalogue livré

| Amélioration approuvée | Mise en œuvre MS3 |
|---|---|
| Vue liste | Liste d'offres avec accès au détail, en complément des cartes. |
| Vue tableau | Tableau défilable et lisible au clavier. |
| Tris | Clôture, publication, titre et pourcentage déjà fourni par MS5 ; valeurs inconnues conservées. |
| Comparateur | Menu dédié, deux ou trois offres, sélection locale conservée ; tableau large ou regroupement mobile par critère. |
| Recherches mémorisées | Jusqu'à 12 recherches nommées ; filtres et tri restaurables et supprimables localement. |
| Filtres conservés | Recherche et filtres mémorisés par compte dans ce navigateur. |
| Repères d'offre | Publication récente, clôture proche/aujourd'hui, consultation et présence d'une note. |
| Recherche pratique | Accents ignorés, mots combinés, expression entre guillemets et exclusion `-mot`. |
| Résultats vides | Filtres actifs retirables, effacement global et distinction entre liste vide et erreur de chargement. |
| Consultation des offres | Connexion obligatoire depuis la 0.2.1, y compris pour les liens partagés. |
| Détail organisé | Sommaire local, section missions/compétences dépliable, conditions et contact accessibles. |
| Partage | Lien direct avec identifiant d'offre, sans note ni autre paramètre confidentiel de l'adresse courante. |
| Adéquation lisible | Explication du score de compétences, des écarts, des prérequis et des avertissements disponibles. |
| Aucun recalcul du matching | Tri et présentation des résultats existants uniquement. |
| Profil enrichi | Titre, résumé, réalisations des expériences, projets, certifications, bénévolat et liens professionnels. |
| Relecture d'extraction | Comparaison des champs actuels/extraits, cases de sélection et validation avant intégration ; les champs déjà renseignés restent prioritaires. |
| Aperçu d'import | Comparaison des champs actuels/proposés avant le remplacement et restauration existante. |
| Relecture de candidature | Offre, profil enregistré et nom du CV déclaré avant confirmation ; activée par défaut et désactivable localement. |
| Protection contre le swipe accidentel | Le geste vers « oui » ouvre le récapitulatif lorsque la relecture est activée. |
| Candidatures organisées | Recherche dans titre/référence/notes/étiquettes, filtre sur statut réellement reçu et tri par date/titre/statut/étiquettes. |
| Notes personnelles | Texte par offre, limité à 3 000 caractères, non transmis au serveur. |
| Offres mises de côté | Étiquettes personnelles, recherche et classement dans l'écran des candidatures. |
| Guide par page | Pop-up structuré avec projecteur, visite initiale et 32 étapes réparties sur les quatre menus depuis la 0.4.0. |
| Favoris et gestes | Étoile ou glissement haut (corps de la carte à la souris, poignée au tactile) ; actions dans la carte et archives désactivées (0.3.1). |
| Mobile | Carte pleine hauteur et outils accessibles depuis la carte ; comparaison par critère sans défilement horizontal. |
| Accessibilité | Boutons explicites, labels, lien d'évitement, focus visible et dialogues accessibles conservés. |
| Confort de lecture | Trois tailles de texte et densité confortable/compacte, conservées localement. |
| Aide | Parcours, sens des statuts, fonctionnement du score, raccourcis et limites de stockage. |
| Démonstration intégrée | Retirée en 0.2.1 : aucun scénario fictif activable dans l’application. |
| Chargements et erreurs | Reprises de chargement et protection contre un écran blanc en cas d'erreur d'affichage. |
| Performance | Cache de détail de matching pendant cinq minutes, limité à 50 entrées et vidé au changement de compte. |
| Tests et documentation | Régressions complétées, pipeline de vérification conservé et séparation explicite rendu/stabilisation/upgrades. |

## Données et comportements à connaître

- Notes, étiquettes, recherches, filtres et réglages sont dans le stockage local du navigateur,
  séparés par identifiant de compte. Ils ne suivent pas la personne sur un autre appareil.
- Brouillons du profil, des rubriques détaillées et copie avant import restent dans l'onglet.
  Les rubriques détaillées possèdent un bouton d'enregistrement explicite.
- En cas de stockage indisponible, l'interface garde les valeurs en mémoire et avertit lorsque
  nécessaire ; une conservation après fermeture n'est pas garantie.
- La sélection de comparaison persiste dans ce navigateur par compte depuis la 0.4.0 ; elle ne suit pas l’utilisateur sur un autre appareil.
- Le lien partagé recherche l'offre dans les données actuelles. Une offre retirée du hub peut
  devenir indisponible. Les archives restent en lecture seule.
- Les repères de publication reposent sur la date publiée, pas sur un historique de modifications.
- Le récapitulatif de candidature lit le profil actuel. Il ne promet pas un dossier immuable,
  une copie du CV chez le recruteur ou une protection atomique entre appareils.
- L'extraction comble les absences après sélection. Une extraction modifiée entre aperçu et
  validation est refusée : elle doit être relue. Le moteur CVForge et ses formats ne changent pas. L’aperçu peut aussi rouvrir la dernière extraction enregistrée ; l’écran demande de vérifier qu’elle correspond au document actuel.
- Les fonctions de compte, notifications, messagerie, calendrier, nouveaux statuts, génération
  de documents, nouveaux scores et tableaux de bord des autres groupes ne sont pas ajoutées.

## Vérifications et exploitation

**Vérification locale : 28 tests applicatifs et 8 contrôles PHP réussis (36 au total), compilation TypeScript/Vite réussie, zéro vulnérabilité signalée par npm.**

Les tests sont locaux et utilisent des réponses simulées. Ils couvrent les tris, la sélection
du comparateur, le stockage par compte, les liens sans paramètres confidentiels, la recherche,
la sélection de l'extraction et le refus d'une extraction changée, la conservation des champs
du profil, le cache du matching et la connexion normale avec un ancien lien de démonstration. Les contrôles PHP précédents
restent inchangés. Exécution depuis `beta/` :

```sh
npm ci --ignore-scripts
npm test
npm run test:php
npm run build
npm audit
```

Lors de la livraison 0.2.0, les vérifications dans le navigateur ont porté sur les parcours fictifs locaux : liste persistée, comparateur, récapitulatif et annulation, lien public sans compte, mise en page de bureau et cadre mobile de 390 pixels. Aucun appel métier n’a été observé pendant la navigation dans la démo (compteur du serveur de test à zéro). Elles ne sont
pas une certification RGAA, une validation de tous les appareils ou une recette des autres modules.
Les nouveaux écrans utilisent les champs réellement disponibles ; aucune évolution de leur API
n'est attendue pour activer ce lot.

La mise en ligne du site demeure distincte du commit et du push. Les outils de déploiement doivent
être lancés depuis un dépôt propre et synchronisé, puis une vérification du site doit confirmer
la version effectivement servie. Ne pas republier l'article du rendu comme si ces upgrades y
avaient déjà figuré.

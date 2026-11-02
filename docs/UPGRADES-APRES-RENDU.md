# Upgrades et améliorations après rendu — MS3

Version applicative : **0.2.0**, développée le **27 octobre 2026**, après la fin du rendu.

## Repères de version

| Période | Référence | Signification |
|---|---|---|
| Avant l'échéance du rendu | `b823f58`, 20 octobre | Dernier code versionné avant le 21 octobre ; les ajouts ci-dessous n'y figurent pas. |
| Stabilisation après audit | `16c3bb0`, 27 octobre | Corrections de fiabilité et de sécurité, déjà postérieures au rendu. |
| Upgrades MS3 | Version `0.2.0`, historique Git à partir de `16c3bb0` | Améliorations de consultation et de relecture décrites ici. |

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
| Comparateur | Deux ou trois offres : lieu, contrat, clôture, missions, compétences, qualifications et score disponible. |
| Recherches mémorisées | Jusqu'à 12 recherches nommées ; filtres et tri restaurables et supprimables localement. |
| Filtres conservés | Recherche et filtres mémorisés par compte dans ce navigateur. |
| Repères d'offre | Publication récente, clôture proche/aujourd'hui, consultation et présence d'une note. |
| Recherche pratique | Accents ignorés, mots combinés, expression entre guillemets et exclusion `-mot`. |
| Résultats vides | Filtres actifs retirables, effacement global et distinction entre liste vide et erreur de chargement. |
| Consultation sans compte | Liste publique existante des offres ; connexion nécessaire pour candidater. |
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
| Mobile | Commandes qui se replient, alternatives aux gestes et tableaux à défilement horizontal. |
| Accessibilité | Boutons explicites, labels, lien d'évitement, focus visible et dialogues accessibles conservés. |
| Confort de lecture | Trois tailles de texte et densité confortable/compacte, conservées localement. |
| Aide | Parcours, sens des statuts, fonctionnement du score, raccourcis et limites de stockage. |
| Démonstration | `?demo=1` : cinq offres fictives, profil fictif modifiable et décisions simulées, avec blocage des appels métier. |
| Chargements et erreurs | Reprises de chargement et protection contre un écran blanc en cas d'erreur d'affichage. |
| Performance | Catalogue public et démo chargés à la demande ; cache de détail de matching pendant cinq minutes, limité à 50 entrées et vidé au changement de compte. |
| Tests et documentation | Régressions complétées, pipeline de vérification conservé et séparation explicite rendu/stabilisation/upgrades. |

## Données et comportements à connaître

- Notes, étiquettes, recherches, filtres et réglages sont dans le stockage local du navigateur,
  séparés par identifiant de compte. Ils ne suivent pas la personne sur un autre appareil.
- Brouillons du profil, des rubriques détaillées et copie avant import restent dans l'onglet.
  Les rubriques détaillées possèdent un bouton d'enregistrement explicite.
- En cas de stockage indisponible, l'interface garde les valeurs en mémoire et avertit lorsque
  nécessaire ; une conservation après fermeture n'est pas garantie.
- Le comparateur et la sélection d'offres ne persistent pas au rechargement.
- Le lien partagé recherche l'offre dans les données actuelles. Une offre retirée du hub peut
  devenir indisponible. Les archives restent en lecture seule.
- Les repères de publication reposent sur la date publiée, pas sur un historique de modifications.
- Le récapitulatif de candidature lit le profil actuel. Il ne promet pas un dossier immuable,
  une copie du CV chez le recruteur ou une protection atomique entre appareils.
- L'extraction comble les absences après sélection. Une extraction modifiée entre aperçu et
  validation est refusée : elle doit être relue. Le moteur CVForge et ses formats ne changent pas. L’aperçu peut aussi rouvrir la dernière extraction enregistrée ; l’écran demande de vérifier qu’elle correspond au document actuel.
- Le mode démo n'a pas de score MS5 fictivement présenté comme réel. Les décisions y sont en
  mémoire et repartent au chargement ; son profil fictif reste dans l'onglet de démonstration.
- Les fonctions de compte, notifications, messagerie, calendrier, nouveaux statuts, génération
  de documents, nouveaux scores et tableaux de bord des autres groupes ne sont pas ajoutées.

## Vérifications et exploitation

**Vérification locale : 27 tests applicatifs et 8 contrôles PHP réussis (35 au total), compilation TypeScript/Vite réussie, zéro vulnérabilité signalée par npm.**

Les tests sont locaux et utilisent des réponses simulées. Ils couvrent les tris, la sélection
du comparateur, le stockage par compte, les liens sans paramètres confidentiels, la recherche,
la sélection de l'extraction et le refus d'une extraction changée, la conservation des champs
du profil, le cache du matching et l'isolation réseau de la démo. Les contrôles PHP précédents
restent inchangés. Exécution depuis `beta/` :

```sh
npm ci --ignore-scripts
npm test
npm run test:php
npm run build
npm audit
```

Les vérifications dans le navigateur portent sur les parcours fictifs locaux : liste persistée, comparateur, récapitulatif et annulation, lien public sans compte, mise en page de bureau et cadre mobile de 390 pixels. Aucun appel métier n’a été observé pendant la navigation dans la démo (compteur du serveur de test à zéro). Elles ne sont
pas une certification RGAA, une validation de tous les appareils ou une recette des autres modules.
Les nouveaux écrans utilisent les champs réellement disponibles ; aucune évolution de leur API
n'est attendue pour activer ce lot.

La mise en ligne du site demeure distincte du commit et du push. Les outils de déploiement doivent
être lancés depuis un dépôt propre et synchronisé, puis une vérification du site doit confirmer
la version effectivement servie. Ne pas republier l'article du rendu comme si ces upgrades y
avaient déjà figuré.

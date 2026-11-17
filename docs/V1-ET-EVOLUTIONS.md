# V1 du rendu et évolutions après rendu

Référence documentaire au **17 novembre 2026**. Ce document sépare le périmètre initial,
les corrections, les améliorations livrées et les idées non livrées.

## Les quatre états à distinguer

| État | Référence | Ce que cela signifie |
|---|---|---|
| **V1 — référence du rendu** | `b823f58`, 20 octobre 2026 ; tag `reference-rendu-2026-10-20` | Périmètre initial figé, avant l’échéance du 21 octobre. |
| **Corrections après V1** | `16c3bb0`, 27 octobre ; tag `stabilisation-2026-10-27` | Fiabilité, sécurité et régressions corrigées après le rendu. Elles ne font pas partie de la V1 archivée. |
| **Améliorations après V1, livrées** | Lots `0.2.0` à `0.4.12` ; application publiée `8c00760` | Ajouts et évolutions déjà réalisés après le rendu. La 0.4.12 est publiée le 17 novembre. |
| **Pistes d’amélioration, non livrées** | [Registre des pistes](PISTES-AMELIORATION.md) | Idées ou validations à étudier. Elles ne deviennent ni réalisées ni commandées par leur seule présence dans la documentation. |

**« V1 » désigne ici la première version fonctionnelle de référence pour le rendu.**
Son `package.json` portait `0.1.0` : cela ne veut pas dire qu’une version technique `1.0.0` a été publiée.
Le commit conservé est le dernier code versionné avant l’échéance ; il ne prouve pas à lui seul l’envoi du formulaire de participation.
Les corrections et upgrades ultérieurs ne réécrivent pas ce repère, l’article ni les visuels du rendu.

## Ce qui existait dans la V1 et ce qui a changé ensuite

| Domaine | Présent dans la V1 de référence | Corrections ou améliorations après V1 |
|---|---|---|
| Compte | Connexion/inscription et parcours de compte via les services existants | Présentation et navigation ajustées ; aucune nouvelle API de compte. |
| Profil | Formulaire guidé et neuf questions, données JSON Resume | Sauvegarde fiabilisée, brouillons, profil enrichi, conseils ciblant le champ exact. Les neuf questions ne sont pas une nouveauté après rendu. |
| CV | Dépôt et lancement de la lecture du CV via CVForge | Préservation de la saisie, aperçu de l’extraction, sélection et validation des champs ; le moteur d’extraction appartient toujours à MS1. |
| Import/export | Import/export JSON Resume | Validation, aperçu avant remplacement et restauration de la copie précédente. |
| Offres | Cartes, filtres et swipe ; détail et contact employeur | Vues liste/tableau, recherche avancée, recherches mémorisées, refonte de l’agencement et carte pleine hauteur ; confirmation toujours accessible. |
| Offres gardées | Mise de côté « plus tard » dans le navigateur | Présentation Favoris, étoile jaune et glissement vers le haut. La mise de côté elle-même existait déjà. |
| Adéquation | Affichage du résultat fourni par CV-Matching | Explications et présentation enrichies, comparaison et tri du score existant ; aucun nouveau calcul MS3. |
| Candidatures | Envoi/suivi et affichage des réponses disponibles | Relecture avant confirmation, recherche/tri/statuts, actualisation automatique et agencement revu. |
| Comparaison | Absente | Comparateur ajouté en 0.2.0, puis menu et page dédiés en 0.4.0 ; sélection locale conservée. |
| Repères personnels | Pas les outils ajoutés dans le lot 0.2.0 | Notes, étiquettes, repères de consultation et partage direct d’offre. |
| Aide | Informations et parcours de l’interface initiale | Guide interactif avec pop-up, projecteur, première visite et consignes structurées par page. |
| Apparence | Thèmes jour/nuit et adaptation mobile | Nouveaux réglages de lecture et agencement ; le thème jour/nuit n’est pas une nouveauté après rendu. |

## Lots après V1 déjà livrés

| Lot | Développement / publication | Résultat et statut actuel |
|---|---|---|
| Stabilisation | 27 octobre ; incluse dans la publication suivante | Corrections de sauvegarde/import/extraction, relais, dépendances et déploiement. |
| `0.2.0` | Développée le 27 octobre ; publiée le 2 novembre, `8abffd7` | Lot d’outils de consultation, comparaison, relecture et profil enrichi. |
| `0.2.1` | Publiée le 16 novembre, `bdb4ebc` | Consultation sans compte et mode fictif **retirés**. Ce ne sont pas des pistes en attente. |
| `0.3.0` | Publiée le 16 novembre, `36731ef` | Première refonte UI, gestes et tutoriel par page. |
| `0.3.1` | Publiée le 16 novembre, `199fe42` | Actions dans la carte, filtres, guide pop-up initial et actualisation automatique. |
| `0.4.0` | Publiée le 16 novembre, `bb88254` | Quatre menus, comparaison dédiée, agencement et guides complétés ; conseils vers les champs précis. |
| `0.4.1` | Publiée le 17 novembre, `fc6faa2` | Offre pleine hauteur. |
| `0.4.2` | Publiée le 17 novembre, `42130ee` | Actions agrandies dans la carte pleine hauteur. |
| `0.4.3` | Publiée le 17 novembre, `2938404` | Correction de la relecture : actions de confirmation toujours visibles. |
| `0.4.4` | Publiée le 17 novembre, `8d89af8` | Aide et affichage structurés. |
| `0.4.5` | Publiée le 17 novembre, `16c1bd8` | Défilement indépendant des colonnes de candidatures. |
| `0.4.6` | Publiée le 17 novembre à 16 h 57, `1aa1ae5` | Popup de confirmation compacte, état intermédiaire remplacé par la 0.4.7. |
| `0.4.7` | Publiée le 17 novembre à 17 h 02, `1f3559f` | Confirmation animée dans la page pendant cinq secondes. |
| `0.4.8` | Publiée le 17 novembre à 17 h 12, `e74c119` | Comparaison réagencée, douze critères, valeurs partagées et écarts repérés. |
| `0.4.9` | Publiée le 17 novembre à 17 h 24, `0113d77` | Profil réagencé, progression, étapes et conseils ciblés. |
| `0.4.10` | Publiée le 17 novembre à 17 h 28, `a3fa9c0` | Popup compacte après candidature rétablie ; message temporaire retiré. |
| `0.4.11` | Publiée le 17 novembre à 17 h 36, `84cfb1b` | Lecture des informations comparées agrandie. |
| `0.4.12` | Publiée le 17 novembre à 18 h 07, `8c00760` | Animations de swipe depuis les boutons de la carte. **Version applicative actuellement publiée.** |

Les présentations intermédiaires (barre d’actions sur toute la page, comparaison en fenêtre,
accordéons de filtres, petits boutons) sont des états historiques, remplacés par les ajustements suivants.
Ils ne décrivent pas plusieurs variantes simultanément actives.

## Règles pour la suite

1. Décrire une nouvelle idée dans les pistes avec son statut ; ne pas la présenter comme une fonction disponible.
2. Une fois réalisée et vérifiée, déplacer la piste dans les améliorations livrées, avec sa version et ses preuves.
3. Distinguer « développé », « testé », « poussé sur GitHub » et « publié en production ».
4. Garder la V1 et son tag inchangés. Ne pas attribuer les améliorations ultérieures au rendu d’octobre.
5. Rester dans MS3 et les contrats existants. Si une fonction exige une API nouvelle ou le travail d’un autre groupe, l’écarter ; ne pas la demander à ce groupe.

Le compte rendu du dernier déploiement est [ici](DEPLOIEMENT-0.4.12-2026-11-17.md).
Un commit documentaire peut suivre `8c00760` sans changer le code servi par le site.
L’historique technique détaillé reste dans [CHANGELOG](../CHANGELOG.md) et le [catalogue après rendu](UPGRADES-APRES-RENDU.md).

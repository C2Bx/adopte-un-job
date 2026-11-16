# Historique des versions

## 0.4.1 — Offre pleine hauteur — 17 novembre 2026

- Carte sur toute la hauteur utile : commandes à gauche sur ordinateur, accès Filtres depuis la carte sur petit écran.
- Actions conservées dans la carte ; vues liste/tableau et cibles du guide adaptées.
- 36 contrôles applicatifs/PHP et recette sur sept formats. [Détails](docs/PLEINE-HAUTEUR-0.4.1.md).


## 0.4.0 — Parcours et interface après rendu — 16 novembre 2026

- Menu Comparaison permanent et page dédiée, sélection conservée par compte dans le navigateur.
- Comparer directement depuis une carte ; tableau pleine largeur et présentation mobile par critère.
- Commandes et actions compactes, filtres directs Lieu/Contrat et choix avancés visibles sans accordéons.
- Étoile Favori jaune, davantage de place pour la lecture.
- Profil et Candidatures réagencés ; Corriger amène au champ exact avec focus et mise en évidence.
- Guides structurés : 12 étapes Offres, 4 Comparaison, 7 Candidatures et 9 Profil.
- 36 contrôles applicatifs/PHP et recette de parcours sur sept formats. [Détails](docs/PARCOURS-UI-0.4.0.md).


## 0.3.1 — Ajustements UI après rendu — 16 novembre 2026

- Actions intégrées à la carte de droite, sans barre occupant toute la page.
- Glissé souris gauche/droite/haut depuis la carte, sans sélection de texte ni glissé natif parasite.
- Filtres : recherche des choix, catégories repliables, sélection lisible et pied fixe.
- Guide en pop-up avec projecteur, reste de l’interface grisé, lancement initial automatique par compte et navigateur.
- Candidatures actualisées automatiquement : ouverture, retour de fenêtre et intervalle visible de 30 secondes ; bouton Actualiser retiré.
- Données affichées conservées lors d’une erreur ; date absente tolérée.
- 36 tests applicatifs/PHP réussis et recette sur sept formats. [Détails](docs/AJUSTEMENTS-UI-0.3.1.md).


## 0.3.0 — Refonte UI après rendu — 16 novembre 2026

- Navigation simplifiée, en-tête stable, contenu défilant et barre d’actions toujours accessible.
- Agencement des offres, du profil et des candidatures ; fenêtres natives au premier plan.
- Correction du retour de carte après annulation du récapitulatif et des gestes tactiles.
- Favoris par étoile ou glissement de la poignée vers le haut ; ancien classement « Plus tard » conservé.
- Tutoriel par page : progression, Précédent, Suivant, Arrêter et Terminer, sans masquer les commandes.
- Suppression du rendu complet de la carte d’arrière-plan.
- 35 contrôles applicatifs/PHP, recette sur sept formats et tutoriels sur six formats.
- Périmètre MS3 et API existantes inchangés. [Détails et limites de la recette](docs/REFONTE-UI-0.3.0.md).


## 0.2.1 — Retrait de deux accès après rendu — 16 novembre 2026

- Suppression de la consultation des offres sans compte et de son écran.
- Suppression du mode fictif intégré, de ses données et de ses liens dans l’accueil et l’aide.
- Les anciens liens `?demo=1` suivent la connexion normale ; les offres partagées demandent une connexion.
- Les autres améliorations MS3 et les références historiques du rendu sont conservées.
- 27 tests applicatifs et 8 contrôles PHP réussis ; compilation TypeScript/Vite validée.


## Référence avant la fin du rendu — 20 octobre 2026

Référence Git : `b823f58` — dernier état versionné du dépôt avant l'échéance du 21 octobre.
Ce repère conserve le code et les visuels de cette période ; il ne constitue pas une preuve
d'envoi du formulaire de participation.

Fonctions alors présentes : connexion/inscription, profil guidé, dépôt et lecture du CV,
deck de cartes, filtres, candidatures, contact employeur, affichage du matching de MS5,
import/export JSON Resume, thème jour/nuit et supports de présentation.

## Stabilisation après rendu — 27 octobre 2026

Référence Git : `16c3bb0`.

Corrections issues de l'audit : sauvegarde indépendante des écrans, sérialisation et brouillons,
validation de l'import avec restauration, fusion protectrice de l'extraction, matching authentifié
et limité, TLS vérifié au déploiement, dépendances corrigées, compétences OPT, dates, archives en
lecture seule, reprise sur profil indisponible et premières améliorations des dialogues accessibles.
17 tests applicatifs et 8 contrôles PHP validés. Cette étape est postérieure au rendu.

## 0.2.0 — Upgrades et améliorations MS3 après rendu — 27 octobre 2026

Ces ajouts ne faisaient pas partie de la version de référence du rendu.

- Vues cartes/liste/tableau, tris, comparaison de trois offres et recherches mémorisées.
- Consultation publique sans compte, liens directs, repères et notes personnelles locales.
- Recherche avec expressions exactes et exclusions ; filtres et présentation conservés.
- Relecture du profil et du document CV déclaré avant candidature, activée par défaut.
- Extraction du CV présentée champ par champ, à intégrer uniquement après validation.
- Comparaison avant import, profil enrichi, brouillon des rubriques détaillées.
- Recherche, filtres de statut et classement des candidatures et offres mises de côté.
- Sommaire d'offre, sections dépliables, aide, confort de lecture et reprise sur erreur d'affichage.
- Démonstration fictive intégrée, isolée des appels métier réels.
- Réutilisation temporaire des résultats de détail du matching, sans nouveau calcul MS3.

Périmètre : interface MS3 et contrats existants uniquement. Aucune route serveur ajoutée,
aucun changement demandé à MS1/MS2/MS4/MS5/MS6/MS7. Détail et limites :
[Upgrades après rendu](docs/UPGRADES-APRES-RENDU.md).

La disponibilité de ces changements dans Git ne signifie pas que le site de production
a été redéployé. La publication du site est une opération distincte.


## Publication 0.2.0 — 2 novembre 2026

La version applicative `8abffd7` est publiée sur https://zako.nc/avp/. Les références du rendu et
de la stabilisation sont conservées. Les [contrôles après publication](docs/DEPLOIEMENT-2026-11-02.md)
confirment le commit servi, les fichiers statiques et les protections testées.

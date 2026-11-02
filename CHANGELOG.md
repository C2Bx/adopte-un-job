# Historique des versions

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

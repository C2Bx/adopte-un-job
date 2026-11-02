# Mise en production — Adopte un Job 0.2.0

Publication effectuée le **2 novembre 2026**, vers **17 h 31 à Nouméa**.

- Application : https://zako.nc/avp/
- Démonstration fictive : https://zako.nc/avp/?demo=1
- Commit applicatif réellement servi : `8abffd7fc597b5f6827f0574bf22cfea605a2d14`.
- Version Git : `upgrade-ms3-0.2.0` ; références conservées : `reference-rendu-2026-10-20` et `stabilisation-2026-10-27`.
- Auteur et committer du code : Bastian Cazaux, sans co-auteur IA.

## Vérifications obtenues

Les 27 tests applicatifs et les 8 contrôles PHP ont réussi avant publication. Le contrôle npm
ne signale aucune vulnérabilité. Les vérifications automatiques GitHub ont réussi pour le commit
applicatif : https://github.com/C2Bx/adopte-un-job/actions/runs/41400412658.

Le déploiement FTPS a transféré 26 fichiers, puis posé la seule clé serveur nécessaire au matching.
Le compte de transfert temporaire a été supprimé. Aucun nettoyage des anciennes données ou assets
n'a été exécuté.

Contrôles publics après transfert :

| Contrôle | Résultat |
|---|---|
| Accueil | HTTP 200, affichage correct |
| `version.json` | Commit `8abffd7…`, `modifie: false` |
| JS principal, CSS, deux modules différés, référentiel et manifeste | HTTP 200, empreintes identiques aux fichiers construits |
| Fichier de secrets et aide PHP appelés directement | HTTP 404 |
| Route non autorisée `/users` via relais | HTTP 404 |
| Matching sans connexion | HTTP 401, aucun calcul lancé |
| Compteur public via relais | 25 avis, dont 1 ouvert et 24 expirés au contrôle |
| Catalogue sans compte | Offre ouverte affichée correctement |
| Démonstration | Démarrage et affichage des scénarios fictifs corrects |

Les en-têtes CSP, X-Frame-Options, Referrer-Policy et Permissions-Policy sont présents.
Aucun compte créé, aucun CV réel transmis et aucune candidature réelle envoyée pendant ces contrôles.
Les parcours authentifiés réels et la réception côté recruteur ne sont pas revendiqués comme testés
par cette vérification de publication.

## Séparation du rendu et des évolutions

La version précédant l'échéance du rendu reste `b823f58` (20 octobre), conservée par son repère.
La stabilisation `16c3bb0` et les upgrades `8abffd7` sont des évolutions postérieures au rendu.
La documentation de suivi peut recevoir ses propres commits sans changer le commit applicatif
identifié par `version.json` sur le site.

Un onglet ouvert avant la publication doit être rechargé pour récupérer la nouvelle interface.
Les limites de stockage local et le périmètre MS3 restent ceux décrits dans UPGRADES-APRES-RENDU.md.

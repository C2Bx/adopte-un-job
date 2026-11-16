# Publication 0.4.0 — 16 novembre 2026

**0.4.0 en production sur https://zako.nc/avp/**, publiée vers **18 h 58 à Nouméa**.
Commit applicatif servi : `bb88254c39bc7d766eff54ead929a8473926333e` ; `modifie: false`.
[Parcours, couverture des guides et recette](PARCOURS-UI-0.4.0.md).

La publication comprend toutes les demandes du lot :

- Quatre menus dont **Comparaison**, sélection partagée et conservée, page sur toute la largeur ;
  tableau lisible sur ordinateur et présentation par critère sans défilement horizontal sur mobile.
- Accès Comparer sur les cartes, listes et tableaux, plus accès dans l’en-tête et la navigation.
- Commandes d’affichage déplacées, filtres directs Lieu/Contrat et choix complets sans accordéons.
- Plus d’espace de lecture, actions réduites dans la carte, étoile Favori jaune jour/nuit.
- Profil/Candidatures réagencés ; conseils vers les six champs exacts avec défilement, focus et repère.
- Guides structurés couvrant les outils des quatre pages (12/4/7/9 étapes), dont comparaison,
  adéquation, partage, notes, profil enrichi, import/export et questions.

## Contrôles

- Compilation réussie ; 28 tests applicatifs et 8 contrôles PHP réussis ; audit npm sans vulnérabilité signalée.
- Recette de parcours sur sept formats ; tous les guides contrôlés en 390 et 1440 px ; conseils vers
  les six champs vérifiés en 390 et 1440 px ; candidatures remplies en 844/1280/1440 px.
- Rechargement avec sélection de comparaison conservée, retrait/détail/retour, souris/tactile et actualisation automatique validés.
- Mesure finale à 1440×900 : 610 px de lecture dans la carte ; 147 px en paysage 844×390.
- Vérifications GitHub du code réussies : https://github.com/C2Bx/adopte-un-job/actions/runs/43827502477.
- 24 fichiers transférés ; compte FTPS temporaire supprimé après dépôt.
- Accueil HTTP 200, version propre, JS/CSS identiques au build ; composants du menu de comparaison,
  des filtres directs, des consignes du guide et du ciblage des champs présents dans le JS publié.
- Secrets/aide PHP en accès direct : 404 ; route non autorisée `/users` : 404 ; matching anonyme : 401.
- Compteur public au contrôle : 51 AVP, 25 ouverts et 26 expirés.

Les parcours authentifiés sont vérifiés sur serveur local simulé, sans compte ni candidature réels.
Le guide initial par compte/navigateur et les mises à jour automatiques existantes restent actifs.
Aucune API serveur, demande aux autres groupes ni modification de score. Consultation sans compte
et mode fictif toujours retirés. Les données de recette ne sont pas publiées dans le produit.

Auteur et committer : Bastian uniquement, sans co-auteur IA. La documentation peut avancer après le
commit applicatif identifié par `version.json` ; un commit documentaire n’exige pas de nouveau déploiement.

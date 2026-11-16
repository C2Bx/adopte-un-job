# Publication 0.3.1 — 16 novembre 2026

Version **0.3.1 publiée vers 18 h 12 à Nouméa** sur https://zako.nc/avp/.
Commit applicatif réellement servi : `199fe42862069c5f613ab9f089ef832223c73678` ; `modifie: false`.

Cette publication comprend : boutons intégrés à la carte de droite, glissés à la souris gauche/droite/haut,
filtres réorganisés, tutoriel pop-up avec projecteur et lancement initial automatique par compte/navigateur,
actualisation automatique des candidatures et protection contre une date manquante.
[Description et recette](AJUSTEMENTS-UI-0.3.1.md).

- 28 tests applicatifs + 8 contrôles PHP réussis, compilation réussie, audit npm sans vulnérabilité signalée.
- Recette sur sept formats ; souris trois directions et tactile ; ouverture du guide depuis le formulaire de
  connexion simulé ; actualisation automatique avec horloge de test pilotée et panne réseau simulée.
- CI du code réussie : https://github.com/C2Bx/adopte-un-job/actions/runs/43822145965.
- 24 fichiers déployés ; compte FTPS temporaire supprimé après transfert.
- Accueil HTTP 200, version propre et empreintes du JS/CSS identiques au build local.
- Présence des composants filtres, guide initial/projecteur et actualisation automatique dans le JS servi.
- Accès directs aux secrets et à l’aide PHP : 404 ; route interdite `/users` : 404 ; matching anonyme : 401.
- **Compteur public après publication : 51 AVP, dont 25 ouverts et 26 expirés.** Le service a évolué depuis
  le contrôle précédent de 17 h 29 qui annonçait zéro offre ouverte ; cette évolution n’est pas une création de données par MS3.

Les parcours authentifiés sont testés uniquement avec le serveur local simulé : aucun compte ni candidature réels.
Aucune nouvelle API ni demande aux autres groupes. Consultation sans compte et mode fictif toujours retirés.
Auteur et committer : Bastian uniquement, sans co-auteur IA. La documentation de suivi peut avoir un commit
ultérieur au commit applicatif servi ; elle ne nécessite pas de nouveau déploiement.

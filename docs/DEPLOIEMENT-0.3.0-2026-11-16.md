# Publication 0.3.0 — 16 novembre 2026

Version **0.3.0 en production** sur https://zako.nc/avp/, publiée vers **17 h 29 à Nouméa**.
Commit applicatif servi : `36731efe7e0b09c7986ae0b125c38033c814b120` ; `modifie: false`.

Cette publication inclut toute la refonte, le guide par page et les favoris par glissement de la poignée vers le haut.
Voir [la description et la recette](REFONTE-UI-0.3.0.md). Les accès sans compte et le mode fictif restent retirés.

- 35 tests et contrôles applicatifs/PHP réussis ; compilation réussie ; audit npm sans vulnérabilité signalée.
- Recette locale de l’agencement sur sept formats, du guide sur six formats, nuit/grands textes sur trois largeurs.
- Gestes gauche/droite, annulation de relecture, favori tactile vers le haut sans candidature,
  texte défilant sans décision et retour après dernière carte vérifiés sur serveur simulé.
- Vérifications GitHub réussies : https://github.com/C2Bx/adopte-un-job/actions/runs/43817091067.
- Déploiement : 24 fichiers transférés ; compte FTPS temporaire supprimé après publication.
- Après transfert : accueil HTTP 200, JS et CSS identiques au build propre. Composants du guide et
  de la poignée présents dans le JS servi ; anciens accès sans compte/démo absents.
- Secrets et aide PHP en accès direct : HTTP 404 ; route non autorisée `/users` : 404 ; matching anonyme : 401.
- Compteur public au contrôle : 25 AVP, **0 ouvert, 25 expirés**. Les archives restent en lecture seule.
- Accueil réel vérifié dans Chrome en 390 px, sans débordement horizontal, sans accès aux offres sans compte.

Aucun compte réel ni candidature réelle utilisé pour les vérifications. Les données fictives de recette
sont uniquement locales et ne font pas partie du produit publié. Aucun contrat API des autres groupes modifié.

Documentation, contexte et code versionnés séparément du rendu d’octobre. Auteur et committer :
Bastian Cazaux uniquement, sans co-auteur IA. Un commit de suivi documentaire peut avancer après le commit
applicatif identifié sur le serveur ; il n’exige pas de redéployer l’application.

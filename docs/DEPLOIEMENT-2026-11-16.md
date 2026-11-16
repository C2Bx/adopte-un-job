# Mise en production — Adopte un Job 0.2.1

Publication le **16 novembre 2026**, vers **16 h 52 à Nouméa**.

- Site : https://zako.nc/avp/
- Commit applicatif servi : `bdb4ebc285a76183be10e5e124aee8a78b0df6a5` ; `modifie: false`.
- Consultation sans compte et démonstration fictive intégrée retirées, code et accès compris.
- Les liens d’offres passent par la connexion ; l’ancien paramètre `?demo=1` n’active plus de scénario.
- Aucune évolution des API des autres groupes.

## Vérifications

27 tests applicatifs et 8 contrôles PHP réussis ; compilation TypeScript/Vite validée.
Vérifications GitHub réussies : https://github.com/C2Bx/adopte-un-job/actions/runs/43813015833.

Après publication : accueil et anciennes adresses avec `demo`/`offre` en HTTP 200,
toutes servent le nouveau point d’entrée. Les empreintes du JS et du CSS servis sont identiques
au build local propre. Aucun module de catalogue public ou de démonstration dans le nouveau build,
aucun bouton ni donnée de scénario fictif dans le JS publié.
Ces contrôles portent sur les fichiers servis et les tests automatisés ; aucun parcours
avec compte réel ni candidature réelle n’a été exécuté.

24 fichiers transférés avec l’outil existant ; compte FTPS temporaire supprimé.
Le dépôt et le contexte conservent les étapes historiques du rendu, de stabilisation et des upgrades.
Auteur et committer : Bastian Cazaux uniquement, sans co-auteur IA.
Un commit de documentation ultérieur peut différer du commit applicatif affiché par `version.json`.

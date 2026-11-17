# Confirmation de candidature — 0.4.3 — 17 novembre 2026

**Publiée en production le 17 novembre 2026**, commit applicatif `2938404`.
[Contrôles de publication](DEPLOIEMENT-0.4.3-2026-11-17.md).

Correction après V1, signalée par Bastian : le récapitulatif pouvait présenter uniquement
la relecture et la fermeture, les boutons de confirmation étant placés plus bas dans le contenu défilant.
Sur un écran bas, ils étaient hors de la partie visible et donnaient l’impression d’un parcours bloqué.

## Comportement corrigé

- Dans Offres et depuis les favoris/candidatures, Annuler et Confirmer ma candidature restent visibles en pied de fenêtre.
- Seul le dossier défile ; son aperçu n’a plus de seconde zone de défilement imbriquée.
- Le titre de fenêtre décrit la relecture ; un message précise qu’aucun envoi ne part avant confirmation.
- Fermer ou Annuler conserve l’offre sans envoyer de décision. Confirmer utilise les routes existantes.
- La gestion existante des erreurs conserve l’offre et permet de réessayer.

## Vérification

Compilation TypeScript/Vite, 28 tests applicatifs et 8 contrôles PHP réussis.
Recette Chrome locale avec services simulés et dossier long sur sept formats : 320×568, 390×844,
768×1024, 1280×720, 1440×900, 1920×1080 et 844×390.
Confirmation visible dès l’ouverture et après défilement, annulation sans envoi, envoi unique puis présence
dans Candidatures. Vérifiés également : candidature depuis Favoris et reprise après un échec simulé.
Aucun compte ni candidature réels utilisés, aucune API ajoutée ou travail demandé à un autre groupe.
Preuves : `verification-relecture-0.4.3.json`, captures `relecture-043-390.png` et `relecture-043-844.png`.

Il s’agit d’une correction après rendu ; la V1 et ses supports restent inchangés.

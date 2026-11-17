# Confirmation animée dans la page — 0.4.7 — 17 novembre 2026

**En production depuis le 17 novembre 2026**, commit applicatif `1f3559f`.
[Contrôles de publication](DEPLOIEMENT-0.4.7-2026-11-17.md).

Amélioration après V1 demandée par Bastian : après l’envoi, afficher une confirmation animée
directement sur la page pendant cinq secondes, puis la retirer automatiquement.

- Bandeau intégré au-dessus des offres, sans fenêtre modale ni bouton Continuer.
- Coche dessinée à l’arrivée, entrée douce et barre de durée de cinq secondes.
- Intitulé de l’offre et rappel du suivi dans Candidatures.
- L’offre suivante, les gestes et les raccourcis restent disponibles pendant le message.
- Chaque nouvel envoi relance les cinq secondes ; Retour retire le message de l’envoi annulé.
- Annonce de statut pour les lecteurs d’écran ; animations désactivées si les mouvements sont réduits.
- Le message s’affiche uniquement après succès de l’enregistrement. La relecture avant envoi reste disponible.

Compilation TypeScript/Vite réussie ; recette locale sur sept formats, 320×568, 390×844, 768×1024,
1280×720, 1440×900, 1920×1080 et 844×390. Présence sans dialogue, actions accessibles,
absence de débordement, disparition réelle autour de cinq secondes (sur un format ; minuteur piloté sur
les autres), envois successifs, clavier, Retour et réduction des mouvements vérifiés.
Preuves : `verification-confirmation-0.4.7.json`, captures `confirmation-page-047-390.png` et `confirmation-page-047-1440.png`.
Aucun compte ni candidature réels utilisés, aucune nouvelle API ni travail demandé aux autres groupes.
La popup compacte 0.4.6 est un état intermédiaire remplacé ; la V1 du rendu reste inchangée.

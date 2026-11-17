# Swipe animé depuis les boutons — 0.4.12 — 17 novembre 2026

**En production depuis le 17 novembre 2026**, commit applicatif `8c00760`.
[Contrôles de publication](DEPLOIEMENT-0.4.12-2026-11-17.md).

Amélioration après V1 demandée par Bastian : dans la vue Cartes, les boutons déclenchent une animation
de swipe avant la décision. Passer : gauche ; Candidater : droite ; Favori : haut.

Animation de 300 ms avec le repère correspondant. Les actions et raccourcis sont bloqués pendant
le mouvement pour éviter plusieurs décisions. Le glissé manuel conserve son fonctionnement existant.
Candidater prépare ensuite la relecture, sans envoyer avant confirmation ; Annuler restitue la carte.
Si les informations requises manquent, le parcours vers Profil est conservé sans animation de départ.
La préférence de réduction des mouvements évite l’animation. Une navigation pendant le délai de sortie
annule l’action différée ; une erreur d’enregistrement restitue l’offre et permet de réessayer.

Compilation TypeScript/Vite réussie. Recette Chrome locale sur sept formats : 320×568, 390×844,
768×1024, 1280×720, 1440×900, 1920×1080 et 844×390. Directions et durée d’animation observées,
absence de double décision, favori local, Retour, annulation de relecture et confirmation unique vérifiés.
Navigation avant fin d’animation, mouvements réduits et nouvel essai après échec vérifiés séparément.
Preuve : `verification-swipe-boutons-0.4.12.json`.
Aucun compte ni candidature réels utilisés ; aucune nouvelle API ni demande aux autres groupes.
La V1 et les supports du rendu restent inchangés.

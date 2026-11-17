# Retour à la popup après candidature — 0.4.10 — 17 novembre 2026

**En production depuis le 17 novembre 2026**, commit applicatif `a3fa9c0`.
[Contrôles de publication](DEPLOIEMENT-0.4.10-2026-11-17.md).

Ajustement après V1 demandé par Bastian : rétablir la popup de confirmation après l’envoi.
Le bandeau animé de cinq secondes de la 0.4.7 est retiré.

La popup compacte (540 px maximum) reprend le repère de réussite, l’intitulé du poste mis en valeur
et le bouton Continuer en pied de fenêtre. Elle reste ouverte jusqu’à Continuer, Fermer ou Échap.
La relecture avant envoi, avec Confirmer/Annuler toujours accessibles, est conservée.
Le message apparaît uniquement après succès de l’enregistrement ; Continuer ne renvoie pas la candidature.
Les améliorations des menus Profil et Comparaison sont conservées.

Compilation TypeScript/Vite réussie. Recette locale sur sept formats, titre long, bouton accessible,
texte très grand/thème sombre et absence de deuxième envoi vérifiés avec des services simulés.
Preuves : `verification-confirmation-0.4.10.json`, captures `confirmation-0410-*.png`.
Aucun compte ni candidature réels utilisés ; aucune nouvelle API ni demande aux autres groupes.
La V1 du rendu reste inchangée.

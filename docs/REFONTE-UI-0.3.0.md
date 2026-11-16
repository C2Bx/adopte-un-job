# Refonte de l’interface MS3 — version 0.3.0 — 16 novembre 2026

**En production depuis le 16 novembre 2026**, commit applicatif `36731ef`.
[Contrôles de publication](DEPLOIEMENT-0.3.0-2026-11-16.md).

Cette version est une amélioration **après rendu**. La référence `b823f58` du 20 octobre reste inchangée.
Elle prolonge les upgrades 0.2.0 et le retrait des accès sans compte et du mode fictif en 0.2.1.

## Agencement

- Une coquille commune : en-tête dans sa propre ligne, navigation Offres/Candidatures/Profil,
  rail sur ordinateur et trois onglets en bas du téléphone. Guide, thème et déconnexion dans l’en-tête.
- Suppression des anciennes règles d’en-tête flottant et des hauteurs fixes de la zone de cartes.
- Défilement du contenu séparé de la barre d’actions : cœur, croix, étoile et retour ne sont plus
  enfouis sous la carte. Une fin de liste conserve le retour sur la dernière décision.
- Recherche, filtres, affichage et tri regroupés ; recherches mémorisées et options secondaires repliables.
- Profil : formulaire prioritaire, CV et assistant repliables, compte/import/export dans un bloc dédié,
  étapes qui reviennent à la ligne, champs et boutons adaptés aux petites largeurs.
- Candidatures : commandes alignées, colonnes de liste/détail corrigées, tableau et comparateur
  défilants sans élargir toute la page.
- Fenêtres natives au premier plan, indépendantes des conteneurs défilants : fermeture toujours
  accessible, focus conservé dans la fenêtre, Échap et retour du focus, aucun swipe clavier derrière une fenêtre.
- La carte suivante est représentée par un simple fond ; elle ne reconstruit plus un deuxième
  contenu complet avec ses observateurs.

## Gestes et favoris

- Gauche : passer ; droite : candidater, avec récapitulatif par défaut avant confirmation.
- Annuler le récapitulatif replace la carte, au lieu de la laisser décalée hors de l’écran.
- **Glisser la poignée indiquée en haut de la carte vers le haut : mettre en favori.** L’étoile fait
  la même chose. Cette zone dédiée évite de transformer la lecture verticale du texte en décision.
- Le texte reste défilable. Une annulation du pointeur ne provoque aucune décision.
- Clavier : gauche/droite pour les décisions, haut ou bas pour les favoris ; les boutons restent disponibles.
- « Favoris » correspond au précédent classement « Plus tard » : les données déjà gardées sont reprises.
  Ce classement reste dans ce navigateur, séparé par compte, sans synchronisation ni nouvelle écriture API.
- Une offre expirée conserve les repères visibles mais désactivés, avec une explication. Sans offre à traiter,
  les actions sont également désactivées ; le retour reste possible après la dernière décision.

Le 16 novembre, le compteur public annonçait **0 AVP ouvert et 25 expirés** : cette absence d’offres
ouvertes explique l’indisponibilité des décisions réelles à cette date. Les archives ne sont pas rendues candidates.

## Guide par page

Depuis **Guide** dans l’en-tête, choisir **Démarrer le tutoriel de cette page**.

- Offres : 6 étapes ; Candidatures : 4 ; Profil : 5.
- Progression, Précédent, Suivant, Arrêter et Terminer.
- La commande expliquée est mise en évidence et amenée dans la zone visible.
- Le guide réserve une ligne dans la page : il ne recouvre ni les boutons ni le menu.
- Il peut être arrêté et relancé ; changer de page pendant le guide commence le guide de cette page.
- Aucun lancement automatique, aucune candidature ni modification des données par le guide.

## Recette obtenue

- Compilation TypeScript/Vite réussie ; 27 tests applicatifs + 8 contrôles PHP réussis.
- Audit npm : zéro vulnérabilité signalée lors de cette vérification.
- Chrome automatisé : 320×568, 390×844, 768×1024, 1280×720, 1440×900, 1920×1080 et 844×390.
  Actions cliquables dans la fenêtre, absence de débordement de page, cartes/liste/tableau,
  comparaison, filtres, profil, candidatures et gestion du focus contrôlés.
- Guide : toutes les étapes et commandes testées sur six de ces formats (hors 1920×1080).
- Contrôles supplémentaires : très grands textes et nuit en 320/390/768 px, anciens liens sans mode fictif,
  gestes tactiles via Chrome DevTools, favori retrouvé dans son onglet sans écriture serveur,
  défilement vertical sans décision, retour après la dernière carte.

Les parcours authentifiés utilisent **uniquement un serveur local simulé**, jamais un compte ni une
candidature réels. Ces données de recette ne sont pas intégrées au site publié. Il ne s’agit ni d’une
certification d’accessibilité ni d’une validation sur tous les téléphones et navigateurs.

## Périmètre

Aucune API serveur, route du relais, génération de document ni calcul de matching ajouté ou modifié.
Aucun travail demandé aux autres groupes. Les contrats existants et leurs limites restent applicables.
La consultation sans compte et la démonstration fictive restent retirées.

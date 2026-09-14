<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prompt LLM — Adopte un Job</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/wiki.css">
<style>
  .promptbox{position:relative}
  .promptbox pre{max-height:620px;overflow:auto;white-space:pre-wrap;word-break:break-word}
  #copyPrompt{position:sticky;top:70px;float:right;margin:0 0 -34px 0;z-index:5;background:var(--brand);color:var(--paper);border:none;border-radius:8px;padding:8px 14px;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer}
  :root[data-theme="dark"] #copyPrompt,:root:not([data-theme="light"]) #copyPrompt{color:#0D1218}
  @media (prefers-color-scheme:light){#copyPrompt{color:#fff}}
</style>
</head>
<body>

<button class="navToggle" id="navToggle" type="button" aria-label="Ouvrir le menu" aria-expanded="false">
  <span></span><span></span><span></span>
</button>
<div class="navScrim" id="navScrim" hidden></div>
<nav class="sidenav" id="topbar" aria-label="Navigation du projet">
  <a class="brand" href="index.html"><b>Adopte un Job</b><span>projet</span></a>
  <div class="links">
      <a href="index.html"><b>Tableau</b><span>Kanban, idées, votes</span></a>
      <a href="app.php"><b>Prototype</b><span>Démo cliquable</span></a>
      <a href="app/index.php"><b>App mobile</b><span>Écran principal, PWA</span></a>
      <a href="design.php"><b>Design</b><span>Direction et règles</span></a>
      <a href="produit.php"><b>Produit</b><span>Vision et parcours</span></a>
      <a href="profil.php"><b>Profil &amp; CV</b><span>Pôle 1</span></a>
      <a href="matching.php"><b>Swipe &amp; matching</b><span>Pôles 2 et 3</span></a>
      <a href="techno.php"><b>Techno</b><span>Web, mobile, données</span></a>
      <a href="beta.php"><b>La bêta</b><span>L'app réelle, en ligne</span></a>
      <a href="extraction.php"><b>Lecture de CV</b><span>Audit et règles</span></a>
      <a href="api.php"><b>API &amp; base</b><span>Routes, schéma, sécurité</span></a>
      <a href="opensource.php"><b>Open source</b><span>Audit de l'existant</span></a>
      <a href="equipe.php"><b>Équipe</b><span>Neuf sièges, planning</span></a>
      <a href="arbitrages.php"><b>Arbitrages</b><span>Contre-expertise</span></a>
      <a href="questions.php"><b>Questions</b><span>À trancher</span></a>
      <a href="prompt.php" aria-current="page"><b>Prompt LLM</b><span>Le texte à envoyer</span></a>
  </div>
  <p class="sidenote">Wiki interne du projet. Chaque page évolue à mesure que les décisions sont prises.</p>
</nav>

<div class="page">
<main class="col">

  <div class="eyebrow">08 — Contre-expertise</div>
  <h1 class="title">Faire critiquer le projet</h1>
  <p class="chapo">Ce texte est autonome : collé tel quel dans n'importe quel assistant, il contient tout le contexte nécessaire pour obtenir une critique utile plutôt qu'un résumé poli.</p>

  <h3>Mode d'emploi</h3>
  <ul>
    <li>Envoyez-le à <strong>deux ou trois modèles différents</strong> : leurs angles morts ne sont pas les mêmes.</li>
    <li>Ne dites pas que le projet est le vôtre — la critique sera plus franche.</li>
    <li>Rassemblez les retours et gardez <strong>uniquement ce que trois d'entre eux disent ensemble</strong>. Un point soulevé une seule fois est souvent une préférence, pas un défaut.</li>
    <li>Une réponse qui commence par « excellent projet » et n'identifie aucun risque n'a aucune valeur : relancez en demandant les trois raisons pour lesquelles ça échouerait.</li>
  </ul>

  <div class="promptbox">
    <button id="copyPrompt" type="button">Copier le prompt</button>
    <pre id="promptText">Tu es consultant en conception de produits numériques. Tu interviens en contre-expertise
sur un projet en phase de conception. On ne te demande ni encouragement ni résumé : on te
demande d'identifier ce qui est faux, fragile, sous-estimé ou absent. Sois direct, technique
et concret. Si une idée est mauvaise, dis-le et explique pourquoi.

============================================================
1. CONTEXTE
============================================================
Projet étudiant, 9 personnes, environ 11 semaines, aucun budget d'hébergement significatif.
L'objectif est un produit démontrable de bout en bout, pas un prototype jetable.
Nom : "Adopte un Job". Signature : "Swipe. Match. Travaille."
Marché visé : une zone géographique restreinte (marché de l'emploi local, faible volume
d'offres et de candidats), francophone.

============================================================
2. LE PRODUIT
============================================================
Plateforme de mise en relation candidats / recruteurs, avec une mécanique de swipe
inspirée des applications de rencontre.

- Un candidat obtient une fiche structurée, soit en important son CV PDF (extraction
  automatique), soit en remplissant un formulaire guidé. Un assistant l'aide à corriger
  et améliorer ses informations.
- Un recruteur publie une offre, créée à la main ou importée (texte collé ou PDF), traitée
  par la même chaîne de normalisation.
- Chacun fait défiler des cartes : des offres pour le candidat, des profils pour le
  recruteur. Chaque carte porte un score de compatibilité et son explication.
- Quand les deux se sont acceptés, il y a match. Le match ouvre : un CV régénéré et
  recentré sur l'offre, un choix de créneaux de rendez-vous, et une conversation.

============================================================
3. DÉCISIONS DÉJÀ PRISES (à challenger)
============================================================
FORMAT
- Un seul format de vérité par candidat : un document JSON dérivé du schéma public
  JSON Resume, plus un bloc d'extension propriétaire pour ce qui relève de la recherche
  d'emploi (métiers visés, contrats, disponibilité, mobilité, salaire, permis, ouverture
  à la reconversion). Le CV PDF n'est qu'une pièce jointe.

FORMULAIRE UNIVERSEL
- Un seul formulaire pour tous les métiers, en trois couches : un noyau commun, des blocs
  répétables communs (expériences, formations, compétences, langues, permis), et une
  extension par secteur décrite sous forme de fragment de schéma JSON stocké en base et
  rendu automatiquement. Ajouter un secteur doit être une donnée à saisir, pas du code.

EXTRACTION
- Chaîne en 5 étapes : contrôles du fichier, extraction du texte et de la mise en page,
  OCR seulement si la page ne rend aucun texte, extraction structurée par modèle de
  langage contrainte par un schéma JSON, puis normalisation (compétences, métiers, dates,
  communes). La sortie brute du modèle est conservée pour permettre un retraitement.

ASSISTANT DE RÉDACTION
- Quatre niveaux : validation structurelle, contrôles de cohérence (dates, chevauchements),
  correction orthographique et grammaticale par un correcteur classique auto-hébergé,
  puis suggestions de reformulation par modèle de langage.
- Deux règles : l'assistant propose et n'écrase jamais ; il n'invente aucun fait
  (pas de compétence, de date ou d'employeur qui ne soit déjà dans les données saisies).

MATCHING
- Deux étages. D'abord des filtres éliminatoires (hors zone de mobilité, contrat
  incompatible, permis obligatoire manquant) : la carte ne remonte pas. Ensuite un score
  pondéré : compétences 30, expérience 20, localisation 15, contrat et disponibilité 15,
  formation 10, salaire 5, langues et permis 5.
- L'explication est générée par du code à partir des sous-scores, jamais rédigée par un
  modèle. Deux listes : "pourquoi ça colle" et "points à vérifier".
- Les poids sont versionnés ; chaque score stocké garde le numéro de version de l'algorithme.
- Le score n'utilise jamais l'âge, le genre, l'origine, l'adresse précise ni la photo.

RECONVERSION (point important du projet)
- Le candidat déclare des métiers visés indépendamment de son historique. Le score compare
  l'offre au projet, pas au passé.
- Deux scores : un score direct (compétences demandées) et un score de transfert
  (compétences transversales + proximité entre métiers issue d'un référentiel public).
- Un curseur d'ouverture à trois positions (strict / ouvert / reconversion) pilote la
  composition du deck : 100/0/0, 70/30/0, ou 40/30/30 entre cœur de cible, métiers proches
  et passerelles. Les cartes issues d'une passerelle sont étiquetées comme telles des deux
  côtés.

CONFIDENTIALITÉ
- Avant match, le candidat est pseudonyme : prénom et initiale, commune, aucune coordonnée,
  CV d'origine masqué, employeur actuel masquable, âge jamais affiché.
- Décision assumée : AUCUNE PHOTO avant le match, facultative après. Motif : la photo
  n'entre dans aucun critère et réintroduit des biais.
- Le masquage est appliqué côté serveur : l'API ne renvoie jamais un champ interdit.

APRÈS LE MATCH
- Un "CV ciblé" est régénéré depuis le JSON : expériences réordonnées par pertinence,
  compétences filtrées sur celles demandées, accroche construite à partir des seules
  informations existantes. Règle stricte : le générateur sélectionne et réordonne,
  il n'écrit aucun fait nouveau. Le candidat le voit avant envoi ; le CV original reste
  accessible au recruteur.
- Chacun pose ses disponibilités, l'application propose les intersections.
- Une conversation par match, développée par nous plutôt que branchée sur un serveur de
  discussion existant (le coût étant la gestion des comptes, pas l'affichage des messages).

TECHNIQUE
- Une seule base de code pour le web et le mobile : React Native via Expo, avec rendu web.
- API en Python (FastAPI), PostgreSQL avec extension vectorielle, stockage objet privé avec
  liens signés, file de tâches de fond pour l'extraction et le calcul des scores.
- Aucun appel direct à un modèle depuis l'application : dépôt d'un travail, suivi d'état.
- Référentiels envisagés : ROME (France Travail) pour les métiers, compétences et
  passerelles ; ESCO pour les libellés multilingues ; table d'alias maison par-dessus.

ORGANISATION
- 9 personnes en 3 pôles de 3 (profil et CV / offres et swipe / matching et relation),
  chaque pôle avec un référent, un front et un back. Contrats d'API figés en fin de
  cadrage avec des réponses factices pour que front et back avancent en parallèle.

============================================================
3 bis. CE QUI A DÉJÀ ÉTÉ CORRIGÉ APRÈS UNE PREMIÈRE RELECTURE
============================================================
Trois relectures indépendantes ont déjà eu lieu. Les points suivants ont été
corrigés — ne les rejoue pas, cherche ce qui reste :

- Web seul, application installable. Plus de React Native, plus de magasins.
- Le recruteur ne swipe plus : liste classée et bouton "inviter". Swipe candidat only.
- Un seul secteur pilote, formulaire écrit en dur. Plus de moteur de schémas en base.
- Deux scores directionnels (fit_candidat, fit_recruteur), qualité du match = minimum
  des deux, jamais la moyenne.
- Indice de confiance affiché à côté du score ; une donnée absente ne coûte pas de
  points, on renormalise sur les critères renseignés.
- Logique à trois valeurs : oui / non / inconnu. Inconnu n'élimine jamais.
- Aucune offre ne disparaît en silence : section "hors de vos critères" avec motif,
  tri algorithmique désactivable, correction possible de la donnée qui exclut.
- Plus de quotas de deck pour la reconversion : un seul classement avec pénalité,
  réglage à deux positions, et opt-in du recruteur par offre.
- Plus de base vectorielle, plus d'OCR, plus d'ESCO en v1 (ROME seul).
- Sortie brute du modèle conservée 30 jours puis purgée.
- Le lieu de résidence n'est plus collecté : uniquement les zones de travail acceptées.
  L'année d'obtention des diplômes n'est plus exposée. Aucune photo, jamais.
- La candidature ciblée conserve la provenance de chaque fait (fait + contexte + source)
  et n'a pas d'accroche rédigée par un modèle.
- Fraîcheur : date de fin et date de dernière confirmation sur les offres et les
  recherches.
- Contrats d'API versionnés et non figés ; propriétaire nommé du modèle transversal ;
  tranche verticale de bout en bout dès la semaine 2.

============================================================
4. CE QUI N'EST PAS TRANCHÉ
============================================================
- La zone géographique exacte n'est pas encore nommée, donc le droit du travail
  applicable et les éventuelles règles de priorité à l'emploi local non plus.
- Le secteur pilote n'est pas choisi.
- Le salaire est-il obligatoire sur une offre ?
- Une offre expire-t-elle automatiquement, et au bout de combien de temps ?
- Le recruteur doit-il motiver un refus ?
- Qui modère les offres et les signalements ?
- Modèle économique : aucun pour la version 1.

============================================================
5. CE QU'ON ATTEND DE TOI
============================================================
Traite les huit points suivants, dans cet ordre, sans en sauter.

1. FAILLES DE CONCEPTION
   Qu'est-ce qui ne marchera pas comme prévu ? Sois précis sur le mécanisme de l'échec,
   pas seulement sur le risque.

2. LE DÉMARRAGE À VIDE
   Sans candidats il n'y a rien à montrer aux recruteurs, et réciproquement. Sur un marché
   local à faible volume, comment amorce-t-on ? Quelles conséquences sur le produit
   lui-même, pas seulement sur la communication ?

3. LE SCORE
   Critique la pondération. Quels critères manquent ? Lesquels sont mal placés ? Comment
   gérer proprement les données absentes, les échelles hétérogènes, et le fait qu'un
   recruteur et un candidat n'ont pas la même notion de "compatible" ? Comment éviter que
   des variables interdites (âge, genre, origine) rentrent indirectement par des variables
   corrélées ?

4. LA RECONVERSION
   Le mécanisme des trois modes et du score de transfert tient-il ? Quelles alternatives ?
   Comment mesurer que ça fonctionne plutôt que ça pollue le deck ?

5. EXTRACTION DE CV
   Quel taux de réussite réaliste attendre sur des CV francophones réels ? Quels cas vont
   casser en priorité ? Quelle stratégie de repli recommandes-tu ? Le passage par un modèle
   de langage est-il le bon choix, ou existe-t-il plus fiable et moins cher ?

6. JURIDIQUE ET ÉTHIQUE
   RGPD, données sensibles présentes par accident dans un CV, discrimination à l'embauche,
   obligations liées à une décision automatisée, conservation des données, droit à
   l'explication. Qu'est-ce qui est obligatoire et qu'on aurait oublié ? La position
   "pas de photo" tient-elle juridiquement et commercialement ?

7. TECHNIQUE
   Le choix React Native / Expo est-il le bon pour cette application, ou y a-t-il mieux ?
   Points de douleur connus. Quelle est la partie la plus susceptible de faire dérailler
   le planning ? Que ferais-tu différemment sur l'architecture ?

8. PÉRIMÈTRE
   Si tu devais retirer 30 % du périmètre pour sécuriser la démonstration finale, tu
   retirerais quoi exactement, et pourquoi ces éléments-là ?

============================================================
6. FORMAT DE RÉPONSE
============================================================
- Une section par point, titrée, dans l'ordre.
- Chaque affirmation doit être actionnable : dis quoi faire, pas seulement ce qui ne va pas.
- Termine par exactement trois listes :
    * LES 5 CHOSES À CHANGER EN PRIORITÉ, classées
    * LES 5 CHOSES QU'ON N'A MANIFESTEMENT PAS VUES
    * LES 3 RAISONS POUR LESQUELLES CE PROJET ÉCHOUERAIT
- Ne répète pas les points listés en section 3 bis : ils sont déjà corrigés. Si tu penses
  qu'une de ces corrections est mauvaise, dis-le, mais argumente.
- Si tu manques d'information pour trancher un point, dis-le explicitement plutôt que de
  supposer. N'invente aucune référence, aucun chiffre de marché et aucun nom de projet
  open source dont tu ne serais pas certain : si tu cites un outil, précise ton degré de
  certitude.</pre>
  </div>

  <h2 id="apres">Après les retours</h2>
  <p>Ce qui remonte n'est pas une vérité : c'est une liste de points à instruire. Reportez ici, dans le wiki, uniquement ce que vous décidez de changer — et la raison. Une critique qu'on a lue puis écartée sciemment vaut mieux qu'une critique qu'on a oubliée.</p>

  <div class="nextprev">
    <a href="questions.php"><span>Précédent</span><b>← Questions</b></a>
    <a href="index.html"><span>Retour</span><b>Accueil →</b></a>
  </div>

</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>La bêta — Adopte un Job</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/wiki.css">
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
      <a href="prompt.php"><b>Prompt LLM</b><span>Le texte à envoyer</span></a>
  </div>
  <p class="sidenote">Wiki interne du projet. Chaque page évolue à mesure que les décisions sont prises.</p>
</nav>

<div class="page">
<main class="col">

  <div class="eyebrow">04 ter — Technique</div>
  <h1 class="title">La bêta</h1>
  <p class="chapo">L'application réelle, en ligne sur <a href="beta/">zako.nc/avp/beta/</a>. Deux côtés : le candidat qui swipe les AVP réels de l'OPT-NC et candidate, l'organisation qui reçoit, présélectionne, propose des entretiens et lit son tableau de bord. Même produit que le prototype, avec des comptes, une base, un score calculé par le serveur.</p>

  <h2 id="pile">Ce que c'est</h2>
  <dl class="kv">
    <dt>Front</dt><dd>React 19 + TypeScript strict, construit par Vite. Sortie 100 % statique : aucune page PHP, ce qui la rend empaquetable telle quelle pour les magasins d'applications</dd>
    <dt>Données</dt><dd>Plus rien dans le navigateur. Tout passe par l'<a href="api.php">API</a> et la base de production ; les offres sont les AVP réels du dataset public de l'OPT-NC, le référentiel est le sien (84 métiers, 409 compétences)</dd>
    <dt>Poids</dt><dd>313 ko de code (94 ko compressés). pdf.js est dans un morceau séparé de 455 ko, téléchargé <b>uniquement</b> quand quelqu'un dépose un CV ; l'OCR (moteur, cœur WebAssembly de 4 Mo, modèle de 1,1 Mo) uniquement quand ce CV est une image ou un scan</dd>
    <dt>Code source</dt><dd><a href="https://github.com/C2Bx/adopte-un-job">github.com/C2Bx/adopte-un-job</a> — public depuis le 14 septembre, version 2 (deux rôles) le 21. Bêta, API, prototype, ce site et les bancs d'essai. Aucune configuration réelle : des <code>config.example.php</code> à copier</dd>
    <dt>Prototype</dt><dd><a href="app/index.php">Toujours en place</a>, en <code>localStorage</code>, avec ses données inventées. Il reste la référence de mise en forme et le mode démonstration sans compte</dd>
  </dl>

  <h2 id="ecrans">Les écrans du candidat</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Écran</th><th>Ce qu'il fait</th></tr></thead>
    <tbody>
      <tr><td><b>Accueil</b></td><td>Création de compte et connexion, candidat ou recruteur (avec un code d'invitation, ou en créant son organisation). Douze caractères minimum, sans autre règle. Mot de passe oublié : le code est mis en file, l'envoi d'e-mails n'est pas encore branché et l'écran le dit.</td></tr>
      <tr><td><b>Swipe</b></td><td>Le deck des AVP ouverts, scorés et triés. Une barre de recherche et <b>les mêmes filtres que la recherche de l'OPT</b> (villes, provinces, familles, directions, télétravail, encadrement, débutant), avec le nombre d'offres derrière chaque puce. Un bouton pour s'entraîner sur les offres closes. Glissé gauche/droite, quatre actions dans les coins, carte en pages, feuille de détail avec les écarts nommés. <b>Un oui est une candidature</b> : une feuille le confirme et dit ce que l'employeur verra.</td></tr>
      <tr><td><b>Candidatures</b></td><td>Envoyée, vue, présélectionnée, entretien proposé, acceptée, refusée. Le nombre d'écarts avec ses critères, le CV envoyé, le retrait. Plus tard et écartés restent là, révocables.</td></tr>
      <tr><td><b>Messages</b></td><td>Une conversation par présélection, jamais avant. Trois débuts de message proposés, par règles, à adapter.</td></tr>
      <tr><td><b>Agenda</b></td><td>Les créneaux proposés — on en confirme un, les autres s'annulent —, ceux à venir, le passé. Heures locales, fichier <code>.ics</code> pour son propre calendrier.</td></tr>
      <tr><td><b>Profil</b></td><td>Import de CV — PDF, scan ou photo, lus dans l'appareil, puis déposés chiffrés si on le veut —, formulaire en cinq étapes, métier visé et compétences dans les mots du référentiel OPT-NC (rattachement automatique, à vérifier), guide chiffré, relecture, Mes CV (fichier, CV généré, JSON Resume). Enregistrement différé, sans bouton.</td></tr>
    </tbody>
  </table></div>

  <h2 id="ecrans-rh">Les écrans de l'organisation</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Écran</th><th>Ce qu'il fait</th></tr></thead>
    <tbody>
      <tr><td><b>Tableau</b></td><td>Le tableau de bord de l'organisation — tous ses membres, tous ses AVP — sur 7, 30, 90 ou 365 jours. Treize indicateurs avec leur définition au survol, courbes par jour, entonnoir de la vue à l'embauche, candidatures par état, compétences qui manquent le plus, répartitions, classement des offres, activité de l'équipe, export CSV.</td></tr>
      <tr><td><b>Offres</b></td><td>Les AVP synchronisés (ouverts et clos) avec leurs compteurs, triés par ce qu'il y a à traiter ; publier une offre à soi.</td></tr>
      <tr><td><b>Candidatures</b></td><td>Classées par compatibilité, <b>anonymes</b> — métiers, compétences, parcours sans employeur, zones, contrats — jusqu'à la présélection. Ouvrir une candidature la marque vue. Présélectionner ouvre le contact (prénom, nom, e-mail, téléphone), le CV recentré sur le poste (PDF généré) et le CV d'origine (déchiffré à la demande), et propose trois premiers messages. Puis : proposer un entretien, accepter, refuser.</td></tr>
      <tr><td><b>Messages</b>, <b>Agenda</b></td><td>Les mêmes que côté candidat, à l'échelle de l'organisation : l'agenda montre les entretiens proposés par n'importe quel membre.</td></tr>
      <tr><td><b>Organisation</b></td><td>Le nom, le code d'invitation à partager (renouvelable), les membres et leurs rôles.</td></tr>
    </tbody>
  </table></div>

  <h2 id="gestes">Les gestes, et ce qu'ils ont coûté</h2>
  <p>Trois d'entre eux ont demandé plusieurs reprises. Ils sont notés ici parce que l'erreur se refait sans ça.</p>

  <ol class="steps">
    <li><b>La capture du pointeur ne se prend qu'après un vrai mouvement.</b> Prise dès le contact, elle détourne le clic suivant vers l'élément qui capture : les boutons de la carte cessent de répondre, sans erreur ni message. L'erreur a été commise deux fois sur le prototype, une troisième fois évitée sur la bêta.</li>
    <li><b>Un geste plus vertical qu'horizontal n'est pas un swipe</b>, c'est un défilement. Sans ce test, la carte part de travers dès qu'on veut lire la suite du texte.</li>
    <li><b>La carte du dessous est un décor.</b> Elle doit être <code>inert</code> : sinon elle reçoit les clics et prend le focus au clavier, avec des boutons branchés à rien.</li>
  </ol>

  <div class="callout">
    <p style="margin-bottom:0"><b>Le piège des classes inventées.</b> Deux modales de la bêta ne se sont jamais affichées : je leur avais donné des noms de classe qui n'existaient nulle part. Elles se rendaient sans style, hors écran, sans la moindre erreur en console. La leçon est simple : <b>une classe qu'on écrit dans le composant doit exister dans la feuille de style</b>, et la vérification tient en une recherche. Même famille de bug pour la typographie du détail, qui est portée par un conteneur <code>.panneau</code> qu'il faut penser à mettre.</p>
  </div>

  <h2 id="reste">Ce qui n'est pas fait</h2>
  <ul>
    <li>Sur les <b>quatre documents de la fonction ③</b>, deux existent — le CV recentré sur le poste et la restitution du matching (l'explication du score, dans la feuille de détail et dans la fiche RH) — et deux manquent : la lettre de motivation et la préparation d'entretien. La <b>candidature transmissible (④)</b> existe sous sa forme applicative : elle arrive chez l'organisation avec le dossier ; elle n'est pas encore un fichier unique qu'on envoie ailleurs.</li>
    <li><b>Aucun e-mail ne part</b> : vérification, réinitialisation, notifications sont en file. Les notifications sont à l'écran, pas poussées.</li>
    <li>Pas de <b>clé OPT-NC</b> : les AVP viennent du dataset public, le signal sémantique de la recherche officielle est inactif.</li>
    <li>L'<b>empaquetage Capacitor</b>. Rien ne s'y oppose techniquement : la bêta est déjà statique et installable, et le jeton sait vivre sans cookie.</li>
    <li>Un parcours <b>à deux comptes sur la même machine</b> n'est pas prévu : une session à la fois par navigateur.</li>
  </ul>

</main>
</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

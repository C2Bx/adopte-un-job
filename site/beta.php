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
  <p class="chapo">L'application réelle, en ligne sur <a href="beta/">zako.nc/avp/beta/</a>. Elle remplace progressivement le prototype : même produit, mais avec des comptes, une base et un score calculé par le serveur.</p>

  <h2 id="pile">Ce que c'est</h2>
  <dl class="kv">
    <dt>Front</dt><dd>React 19 + TypeScript strict, construit par Vite. Sortie 100 % statique : aucune page PHP, ce qui la rend empaquetable telle quelle pour les magasins d'applications</dd>
    <dt>Données</dt><dd>Plus rien dans le navigateur. Tout passe par l'<a href="api.php">API</a> et la base de production</dd>
    <dt>Poids</dt><dd>250 ko de code (78 ko compressés). pdf.js est dans un morceau séparé de 455 ko, téléchargé <b>uniquement</b> quand quelqu'un dépose un CV ; l'OCR (moteur, cœur WebAssembly de 4 Mo, modèle de 1,1 Mo) uniquement quand ce CV est une image ou un scan</dd>
    <dt>Code source</dt><dd><a href="https://github.com/C2Bx/adopte-un-job">github.com/C2Bx/adopte-un-job</a> — public depuis le 14 septembre. Bêta, API, prototype, ce site et les bancs d'essai. Aucune configuration réelle : des <code>config.example.php</code> à copier</dd>
    <dt>Prototype</dt><dd><a href="app/index.php">Toujours en place</a>, en <code>localStorage</code>, avec ses données inventées. Il reste la référence de mise en forme et le mode démonstration sans compte</dd>
  </dl>

  <h2 id="ecrans">Les écrans</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Écran</th><th>Ce qu'il fait</th></tr></thead>
    <tbody>
      <tr><td><b>Accueil</b></td><td>Création de compte et connexion. Douze caractères minimum, sans autre règle : la longueur protège mieux qu'une majuscule imposée, et se retient.</td></tr>
      <tr><td><b>Swipe</b></td><td>Le deck. Glissé gauche/droite, quatre actions dans les coins (retour, non, plus tard, oui), carte en pages qu'on tourne au doigt, filtres, feuille de détail.</td></tr>
      <tr><td><b>Intérêts</b></td><td>Tout ce qui a été décidé, en trois onglets. Sur grand écran, la liste à gauche et le détail à droite ; en dessous, une feuille.</td></tr>
      <tr><td><b>Messages</b></td><td>Une conversation par match. Elle s'ouvre après le match, jamais avant.</td></tr>
      <tr><td><b>Profil</b></td><td>Import de CV — PDF, scan ou photo, lus dans l'appareil —, formulaire en cinq étapes, guide chiffré, fiche de relecture. Enregistrement différé, sans bouton « enregistrer ».</td></tr>
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
    <li>Les <b>fonctions ③ et ④ du HackAVP</b> — les quatre documents (lettre, CV recentré, restitution du matching, préparation d'entretien) et la candidature transmissible. Elles valent 15 points sur 100 et n'existent pas. C'est le chantier prioritaire, avant tout polish. Voir <a href="arbitrages.php#hackavp">le recadrage</a>.</li>
    <li>Les <b>données réelles</b> : le deck tourne encore sur 22 offres inventées. Les AVP ouverts à l'OPT-NC et le référentiel de 84 métiers les remplacent.</li>
    <li>Le <b>côté entreprise</b> : l'API sait créer une offre, lister les candidats et répondre, mais aucun écran ne le fait — et c'est désormais <b>gelé</b> : le jury du HackAVP joue l'employeur, il n'y a pas de second « oui » à obtenir.</li>
    <li>Le <b>fichier</b> du CV n'est pas stocké : seuls les métadonnées et le résultat de la lecture remontent.</li>
    <li>Les <b>notifications</b> sont en base mais ne sont pas poussées.</li>
    <li>L'<b>empaquetage Capacitor</b>. Rien ne s'y oppose techniquement : la bêta est déjà statique et installable.</li>
    <li>Quelques champs d'offre que le prototype affiche <b>n'existent pas en base</b> — horaires, avantages, processus de recrutement, nombre de vues, ville et distance. Les ajouter est une migration, pas du texte à écrire dans le front.</li>
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

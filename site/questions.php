<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Questions — Adopte un Job</title>
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
      <a href="questions.php" aria-current="page"><b>Questions</b><span>À trancher</span></a>
      <a href="prompt.php"><b>Prompt LLM</b><span>Le texte à envoyer</span></a>
  </div>
  <p class="sidenote">Wiki interne du projet. Chaque page évolue à mesure que les décisions sont prises.</p>
</nav>

<div class="page">
<main class="col">

  <div class="eyebrow">07 — À trancher</div>
  <h1 class="title">Ce qui n'est pas décidé</h1>
  <p class="chapo">Vingt questions, pas cinquante. Celles marquées <span class="badge no">bloquant</span> doivent être réglées pendant le sprint 0 : tout le reste du wiki repose dessus.</p>

    <h2 id="bloquant">Les trois questions qui bloquent tout</h2>
  <p>Elles ne sont pas techniques. Tant qu'elles ne sont pas tranchées, le reste du wiki est une hypothèse.</p>
  <ol class="steps">
    <li><b>Quelle zone géographique ?</b> Elle n'est nommée nulle part, et le droit applicable en dépend entièrement : code du travail applicable, éventuelles règles de priorité à l'emploi local que les offres devront respecter, autorité compétente, durées de conservation. À trancher avant même la stack.</li>
    <li><b>Quel secteur pilote ?</b> Une piste évidente : votre propre campus — stages, alternance, premiers emplois. Vous avez accès aux deux côtés du marché, ce qui règle en partie le démarrage à vide.</li>
    <li><b>Qui paie et détient la clé du fournisseur de modèle ?</b> C'est votre seul point de défaillance externe, et personne n'en est responsable aujourd'hui. Prévoyez aussi le mode dégradé si elle est coupée le jour de la soutenance.</li>
  </ol>

  <h2 id="tranchees">Ce qui a été tranché par la contre-expertise</h2>
  <p>Ces questions étaient ouvertes en version 0.2. Les réponses sont sur la page <a href="arbitrages.php">Arbitrages</a>.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Question</th><th>Réponse retenue</th></tr></thead>
    <tbody>
      <tr><td>Application native ou site installable ?</td><td>Site installable, pas de magasins d'applications</td></tr>
      <tr><td>Tous métiers ou un secteur pilote ?</td><td>Un seul secteur</td></tr>
      <tr><td>Photo avant ou après match ?</td><td>Jamais, ni avant ni après</td></tr>
      <tr><td>Le recruteur swipe-t-il ?</td><td>Non — liste classée et invitation</td></tr>
      <tr><td>Score minimum pour qu'une carte remonte ?</td><td>Aucun — rien ne disparaît en silence</td></tr>
      <tr><td>Limite quotidienne de cartes ?</td><td>Aucune</td></tr>
      <tr><td>Une donnée absente coûte-t-elle des points ?</td><td>Non — renormalisation et indice de confiance</td></tr>
      <tr><td>Un seul score ou deux ?</td><td>Deux, directionnels, jamais moyennés</td></tr>
    </tbody>
  </table></div>

  <h2 id="restantes">Ce qui reste ouvert</h2>
  <ol>
    <li><b>Quelle est la date de rendu, et combien d'heures par semaine chacun peut y consacrer ?</b> Le planning en six sprints reste une hypothèse. <span class="badge no">bloquant</span></li>
    <li><b>Qui arbitre en cas de désaccord technique ?</b> <span class="badge no">bloquant</span></li>
    <li><b>Qui possède le modèle de données transversal et le contrat de matching ?</b> Deux noms à écrire. <span class="badge no">bloquant</span></li>
    <li><b>Où héberge-t-on ?</b> « Sans budget » doit quand même faire tourner une base, un stockage, un correcteur et un worker. <span class="badge no">bloquant</span></li>
    <li><b>Le salaire est-il obligatoire sur une offre ?</b> L'exiger améliore le score et réduit le nombre d'offres publiées.</li>
    <li><b>Une offre expire-t-elle automatiquement, et au bout de combien de temps ?</b></li>
    <li><b>Un profil refusé peut-il réapparaître, et après combien de temps ?</b></li>
    <li><b>Qui modère les offres et les signalements ?</b></li>
    <li><b>Le recruteur doit-il motiver un refus ?</b> Ce n'est pas obligatoire, mais c'est le premier reproche adressé aux plateformes d'emploi.</li>
    <li><b>Le projet est-il noté sur le produit fini, sur la démarche, ou les deux ?</b> Ça change l'arbitrage entre profondeur et couverture.</li>
  </ol>

  <h2 id="conformite">La liste de conformité à ouvrir</h2>
  <p>Absente de la version 0.2, et signalée par deux relecteurs comme le plus gros manque après le démarrage à vide. Pour un projet d'école, une analyse d'impact sérieuse même simplifiée est un excellent livrable de conception — et probablement attendue, s'agissant de profilage appliqué au recrutement.</p>
  <ul>
    <li>Responsable du traitement désigné, registre des traitements, mentions d'information</li>
    <li>Durées de conservation, par catégorie de donnée, écrites</li>
    <li>Procédure d'accès, de rectification et d'effacement — avec purge en cascade : base, fichiers, calculs</li>
    <li>Traitement des données sensibles arrivées par accident dans un CV</li>
    <li>Registre des variables du matching : pour chacune, sa justification professionnelle et ses indicateurs indirects connus</li>
    <li>Encadrement du transfert des CV hors Union européenne</li>
    <li>Conditions d'utilisation côté recruteur : ce qu'il peut faire des données, et ce qui se passe quand un candidat supprime son compte</li>
  </ul>

  <div class="callout">
    <h3 style="margin-top:0">Comment s'en servir</h3>
    <p style="margin-bottom:0">Prenez une heure à neuf, en sprint 0. Une question, un tour de table, une décision écrite ici même. Une question qui reste ouverte à la fin de la séance devient une tâche avec un responsable et une date — pas un sujet qu'on reverra « plus tard ».</p>
  </div>

<div class="nextprev">
    <a href="equipe.php"><span>Précédent</span><b>← Équipe</b></a>
    <a href="prompt.php"><span>Suivant</span><b>Prompt LLM →</b></a>
  </div>

</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Équipe — Adopte un Job</title>
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
      <a href="equipe.php" aria-current="page"><b>Équipe</b><span>Neuf sièges, planning</span></a>
      <a href="arbitrages.php"><b>Arbitrages</b><span>Contre-expertise</span></a>
      <a href="questions.php"><b>Questions</b><span>À trancher</span></a>
      <a href="prompt.php"><b>Prompt LLM</b><span>Le texte à envoyer</span></a>
  </div>
  <p class="sidenote">Wiki interne du projet. Chaque page évolue à mesure que les décisions sont prises.</p>
</nav>

<div class="page">
<main class="col">

  <div class="eyebrow">06 — Organisation</div>
  <h1 class="title">Neuf personnes, trois pôles</h1>
  <p class="chapo">Trois équipes de trois, alignées sur les trois moments du parcours. Chaque équipe peut livrer une démonstration sans attendre les deux autres — c'est la seule règle qui compte à cette taille.</p>

  <h2 id="sieges">Les neuf sièges</h2>
  <p>Trois rôles identiques dans chaque pôle : un <strong>référent</strong> qui tranche et écrit les spécifications, un <strong>front</strong>, un <strong>back</strong>. Les compétences se recoupent, les responsabilités non.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Pôle</th><th>Siège</th><th>Ce qu'il porte</th></tr></thead>
    <tbody>
      <tr><td rowspan="3"><b>1</b><br>Profil &amp; CV</td><td class="mono">P1 · référent</td><td>Schéma <code>resume.json</code>, fragments par secteur, règles de l'assistant, recette du pôle</td></tr>
      <tr><td class="mono">P1 · front</td><td>Formulaire multi-étapes, écran de vérification, affichage des suggestions, aperçu du CV</td></tr>
      <tr><td class="mono">P1 · back</td><td>Dépôt des fichiers, chaîne d'extraction, appels au modèle, correcteur, score de complétude</td></tr>

      <tr><td rowspan="3"><b>2</b><br>Offres &amp; swipe</td><td class="mono">P2 · référent</td><td>Champs d'une offre, contenu de la carte, règles d'historique, back-office</td></tr>
      <tr><td class="mono">P2 · front</td><td>Création et import d'offre, composant carte, gestes, détail plein écran, historique</td></tr>
      <tr><td class="mono">P2 · back</td><td>Modèle des offres, import d'annonce, files de cartes, enregistrement des décisions</td></tr>

      <tr><td rowspan="3"><b>3</b><br>Matching &amp; relation</td><td class="mono">P3 · référent</td><td>Critères, poids, explication, modes d'ouverture, réglage d'après la recette</td></tr>
      <tr><td class="mono">P3 · front</td><td>Écran de match, CV ciblé, choix des créneaux, conversation</td></tr>
      <tr><td class="mono">P3 · back</td><td>Filtres, moteur de score, référentiels, génération du CV ciblé, temps réel</td></tr>
    </tbody>
  </table></div>

  <h3>Trois casquettes en plus, portées par des sièges précis</h3>
  <p>Personne n'est « la personne DevOps » à plein temps — mais quelqu'un doit être responsable de chacun de ces trois sujets, sinon ils n'existent pas.</p>
  <dl class="kv">
    <dt>Socle</dt><dd>Dépôt, intégration continue, environnements, déploiement — porté par <b>P3 · back</b></dd>
    <dt>Interface</dt><dd>Système de design, cohérence visuelle, accessibilité — porté par <b>P1 · front</b></dd>
    <dt>Produit</dt><dd>Backlog global, arbitrage du périmètre, recette de bout en bout, soutenance — porté par <b>P2 · référent</b></dd>
  </dl>

  <div class="note">
    <p><b>Si l'un de vous est nettement plus à l'aise en design</b>, il prend le siège P1 · front et devient référent de l'interface pour les trois pôles. C'est le seul rééquilibrage à faire avant de démarrer.</p>
  </div>

    <h2 id="regles">Six règles de fonctionnement</h2>
  <ol class="steps">
    <li><b>Les trois pôles ne sont pas indépendants — quelqu'un possède le modèle partagé.</b> C'est la correction la plus importante apportée par la contre-expertise. Le matching dépend du schéma candidat <em>et</em> du schéma offre ; la candidature ciblée dépend des trois. Sans propriétaire nommé du <b>modèle de données transversal</b> et du <b>contrat de matching</b>, le pôle 3 devient un goulot qui bloque les deux autres. Ces modèles n'appartiennent à aucune équipe en particulier.</li>
    <li><b>Une tranche verticale qui tourne dès la semaine 2.</b> Un CV et une offre qui traversent toute la chaîne : import, correction, normalisation, score, explication, appariement. Même moche, même sur un seul cas. C'est infiniment plus utile que neuf morceaux impeccables assemblés en semaine 9.</li>
    <li><b>Les contrats d'API sont versionnés, pas figés.</b> « Figés » était une mauvaise formulation : en semaine 3 vous découvrirez forcément un champ manquant. La spécification générée par l'API sert de contrat exécutable, avec des bouchons publiés et des revues de changement.</li>
    <li><b>Un seul dépôt.</b> Front et back côte à côte. Synchroniser deux dépôts coûte plus cher que ce que la séparation rapporte.</li>
    <li><b>Chaque modification est relue par quelqu'un d'un autre pôle.</b> Seule façon d'éviter trois projets qui ne se parlent plus.</li>
    <li><b>Fin de sprint = démonstration jouable.</b> Si ça déborde, on coupe dans le contenu du sprint, jamais dans la recette.</li>
  </ol>

  <div class="note">
    <p><b>La partie qui fera dérailler le planning n'est pas le swipe.</b> C'est la chaîne <em>PDF → extraction → normalisation → référentiel → score explicable</em> : elle cumule des données sales, un modèle non déterministe, une taxonomie, une interface de correction et de la logique métier. C'est là qu'il faut la tranche verticale de la semaine 2, et c'est là que les surprises coûteront le plus cher.</p>
  </div>

<h2 id="planning">Le planning</h2>
  <p>Un cadrage d'une semaine puis cinq sprints de deux semaines. Ces durées sont une proposition : elles dépendent de votre date de rendu et du temps réellement disponible.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Sprint</th><th>Pôle 1 — Profil</th><th>Pôle 2 — Offres</th><th>Pôle 3 — Matching</th></tr></thead>
    <tbody>
      <tr>
        <td><b>S0</b><br><span class="badge">1 sem.</span></td>
        <td>Schéma <code>resume.json</code>. Essai d'extraction sur 5 vrais CV.</td>
        <td>Dépouillement de 10 annonces réelles. Champs d'une offre.</td>
        <td>Socle, dépôt, contrats d'API. Import du référentiel de métiers.</td>
      </tr>
      <tr>
        <td><b>S1</b><br><span class="badge">2 sem.</span></td>
        <td>Formulaire couches 1 et 2. Dépôt de CV sans analyse.</td>
        <td>Création d'offre à la main. Entreprise et recruteur.</td>
        <td>Comptes et connexion. Composants d'interface partagés.</td>
      </tr>
      <tr>
        <td><b>S2</b></td>
        <td>Extraction complète, écran de vérification, niveaux 1 à 3 de l'assistant.</td>
        <td>Import d'annonce, vérification de l'offre, liste des offres.</td>
        <td>Normalisation des compétences. Squelette du score et ses tests.</td>
      </tr>
      <tr>
        <td><b>S3</b></td>
        <td>Niveau 4 de l'assistant. Complétude et force. Extensions de secteur.</td>
        <td>Carte, gestes, détail plein écran, enregistrement des décisions.</td>
        <td>Filtres, score, explication, modes d'ouverture, files de cartes.</td>
      </tr>
      <tr>
        <td><b>S4</b></td>
        <td>Aperçu et export PDF. Détection des données sensibles.</td>
        <td>Historique des trois listes. Tableau de bord recruteur.</td>
        <td>Match, CV ciblé, créneaux, conversation, notifications.</td>
      </tr>
      <tr>
        <td><b>S5</b></td>
        <td colspan="3" style="text-align:center">Recette croisée, corrections, jeu de données de démonstration, documentation, soutenance</td>
      </tr>
    </tbody>
  </table></div>

  <h2 id="jalons">Ce qui doit marcher, et quand</h2>
  <p>Quatre jalons visibles. Si l'un glisse, c'est le signal qu'il faut réduire le périmètre plutôt que rattraper.</p>
  <dl class="kv">
    <dt>fin S1</dt><dd>Je crée un compte, je dépose un CV, je vois une offre saisie à la main.</dd>
    <dt>fin S2</dt><dd>Mon PDF devient une fiche que je peux corriger, et l'application me signale mes fautes.</dd>
    <dt>fin S3</dt><dd>Je swipe de vraies offres, classées par un vrai score, avec son explication.</dd>
    <dt>fin S4</dt><dd>Un match ouvre un CV ciblé, un choix de créneaux et une conversation.</dd>
  </dl>

  <h2 id="risques">Les quatre risques</h2>
  <div class="grid g2">
    <div class="card">
      <h3 style="margin-top:0">L'extraction de CV déçoit</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">C'est le risque numéro un, et il se mesure dès le sprint 0 sur cinq vrais CV. Repli : la saisie guidée devient la voie principale, l'import un bonus.</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Le deck est vide</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Sans offres, pas de démonstration. Il faut un jeu de données réaliste dès le sprint 2, et quelqu'un qui en est responsable.</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Trois projets au lieu d'un</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Trois pôles autonomes dérivent naturellement. Les relectures croisées et la démonstration commune de fin de sprint sont là pour ça.</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Le score ne convainc pas</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Un pourcentage qu'on ne comprend pas est pire que pas de pourcentage. L'explication n'est pas une option de fin de projet, elle est livrée avec le score.</p>
    </div>
  </div>

  <div class="nextprev">
    <a href="opensource.php"><span>Précédent</span><b>← Open source</b></a>
    <a href="questions.php"><span>Suivant</span><b>Questions →</b></a>
  </div>

</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

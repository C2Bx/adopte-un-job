<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profil &amp; CV — Adopte un Job</title>
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
      <a href="profil.php" aria-current="page"><b>Profil &amp; CV</b><span>Pôle 1</span></a>
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

  <div class="eyebrow">02 — Pôle 1</div>
  <h1 class="title">Profil &amp; CV</h1>
  <p class="chapo">Un seul formulaire doit servir à un développeur, une aide-soignante, un chef de chantier et un serveur. C'est la contrainte la plus difficile du projet, et elle se résout par le format, pas par l'interface.</p>

  <h2 id="format">Le format de vérité</h2>
  <p>Tout part de <code>resume.json</code>. Le CV PDF n'est qu'une pièce jointe ; ce que l'application compare, affiche, score et régénère vient uniquement du JSON.</p>
  <p>On n'invente pas ce format : on part de <strong>JSON Resume</strong>, un schéma public déjà utilisé, déjà outillé, et dont l'usage habituel est justement de vivre dans un gist. Ce qu'il ne couvre pas — ce qui relève de la recherche d'emploi plutôt que du CV — va dans un bloc d'extension à part, clairement identifié.</p>

  <pre><code>{
  "basics":   { "name", "label", "email", "phone", "location", "summary" },
  "work":     [ { "name", "position", "startDate", "endDate", "summary", "highlights" } ],
  "education":[ { "institution", "studyType", "area", "startDate", "endDate" } ],
  "skills":   [ { "name", "level", "keywords" } ],
  "languages":[ { "language", "fluency" } ],
  "certificates": [ ... ],

  "x_adopteunjob": {
    "targets":      [ "Développeur web", "Technicien support" ],
    "openness":     "reconversion",        // strict | ouvert | reconversion
    "contracts":    [ "CDI", "CDD" ],
    "availability": "2026-11-01",
    "mobility":     { "base": "Nouméa", "radiusKm": 30, "remote": "hybride" },
    "salary":       { "min": 280000, "currency": "XPF", "period": "month" },
    "licences":     [ "B" ],
    "hidden":       { "currentEmployer": true }
  }
}</code></pre>

  <div class="note">
    <p><b>Pourquoi séparer.</b> Ce qui décrit le passé de la personne (<code>work</code>, <code>education</code>) sert à générer un CV. Ce qui décrit son projet (<code>x_adopteunjob</code>) sert à matcher. Les mélanger, c'est se condamner à ne plus pouvoir exporter un CV propre ni faire évoluer les critères de recherche sans casser le CV.</p>
  </div>

    <h2 id="formulaire">Un seul formulaire, un seul secteur</h2>
  <p>La version 0.2 prévoyait un moteur : des fragments de schéma stockés en base, rendus automatiquement, pour qu'ajouter un secteur soit « une donnée à saisir, pas du code ». Les relecteurs ont démonté l'idée, et ils ont raison.</p>

  <div class="note">
    <p><b>Pourquoi c'était faux.</b> Même avec un formulaire rendu automatiquement, les poids de matching, la normalisation des champs sectoriels et les validations croisées restent du code. On construisait donc un moteur de formulaires <em>en plus</em> du produit — plus une interface d'administration, un versionnage de schémas, et des migrations quand un schéma change. Une plateforme dans la plateforme, pour onze semaines.</p>
  </div>

  <p>Le formulaire de la version 1 est <strong>écrit en dur</strong>, pour <strong>un seul secteur pilote</strong>. Il garde la structure en trois blocs, mais les trois sont du code :</p>

  <ol class="steps">
    <li><b>Le noyau</b> — identité, contact, <b>zones de travail acceptées</b>, métier visé, disponibilité, contrat recherché. Une dizaine de champs.</li>
    <li><b>Les blocs répétables</b> — expériences, formations, compétences, langues, permis, certifications.</li>
    <li><b>Les champs du secteur pilote</b> — écrits en dur eux aussi. Habilitations pour le BTP, environnement technique pour l'informatique, selon le secteur retenu.</li>
  </ol>

  <p>Généraliser à d'autres secteurs viendra après, quand vous saurez à quoi ressemble un bon appariement dans un seul. Et alors la bonne abstraction sera évidente — elle ne l'est pas aujourd'hui.</p>

  <div class="callout">
    <p style="margin-bottom:0"><b>Le lieu de résidence a disparu du formulaire.</b> On ne demande plus « où habitez-vous » mais « dans quelles zones acceptez-vous de travailler ». C'est la seule information utile au score, et c'est aussi la seule qui ne soit pas un critère de discrimination.</p>
  </div>

<h2 id="entrees">Trois façons d'entrer</h2>

  <div class="grid g3">
    <div class="card">
      <div class="eyebrow">Voie A</div>
      <h3 style="margin-top:6px">J'ai un CV</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Dépôt du PDF, extraction, formulaire pré-rempli. Chaque champ deviné est marqué comme tel et attend une confirmation.</p>
    </div>
    <div class="card">
      <div class="eyebrow">Voie B</div>
      <h3 style="margin-top:6px">Je pars de zéro</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Le formulaire guidé, étape par étape, avec l'assistant qui suggère au fur et à mesure. C'est la voie qui produit les meilleures fiches.</p>
    </div>
    <div class="card">
      <div class="eyebrow">Voie C</div>
      <h3 style="margin-top:6px">J'ai déjà un JSON</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Import direct d'un <code>resume.json</code> ou d'un gist. Gratuit à implémenter puisque c'est le format natif, et très utile en démonstration.</p>
    </div>
  </div>

  <h2 id="extraction">La chaîne d'extraction</h2>
  <p class="note">Cette page décrit l'intention. Ce qui tourne réellement, l'audit sur huit CV et les huit causes racines corrigées sont sur <a href="extraction.php">Lecture de CV</a>.</p>
  <p>Cinq étapes, du moins cher au plus cher. Chacune peut échouer proprement et laisser la main à la suivante.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Étape</th><th>Ce qu'elle fait</th><th>Si elle échoue</th></tr></thead>
    <tbody>
      <tr><td class="mono">1</td><td>Contrôles d'entrée : type réel du fichier, taille, nombre de pages, absence de mot de passe</td><td>Message clair, dépôt refusé</td></tr>
      <tr><td class="mono">2</td><td>Extraction du texte et de la mise en page (blocs, colonnes, ordre de lecture)</td><td>Bascule sur le formulaire guidé</td></tr>
      <tr><td class="mono">3</td><td>Extraction structurée par modèle, réponse contrainte par le schéma JSON</td><td>On garde le texte brut, l'utilisateur remplit</td></tr>
      <tr><td class="mono">4</td><td>Normalisation : compétences, langues, dates, zones, intitulés de métier</td><td>Valeur conservée telle quelle, marquée « à rattacher »</td></tr>
    </tbody>
  </table></div>

  <h3>Les cas qui vont casser</h3>
  <p>Autant les prévoir tout de suite, ce sont eux qui feront la différence entre une démonstration et un produit.</p>
  <ul>
    <li><strong>Le CV sur deux colonnes</strong> : sans détection de mise en page, le texte s'entrelace et l'extraction devient absurde. C'est le cas le plus fréquent.</li>
    <li><strong>Le CV exporté depuis un outil graphique</strong> : chaque mot est un bloc séparé, l'ordre de lecture n'a plus rien à voir avec l'affichage.</li>
    <li><strong>Le CV scanné ou photographié</strong> : aucun texte, uniquement de l'image. <b>Pas d'OCR en version 1</b> — qualité non bornée, une semaine de travail, du bruit ingérable en sortie. On bascule sur le formulaire, qui est de toute façon le meilleur chemin.</li>
    <li><strong>Les dates approximatives</strong> : « depuis 2019 », « 3 ans », « été 2021 ». Il faut une règle explicite, sinon les calculs d'expérience sont faux.</li>
    <li><strong>Le CV en anglais</strong>, ou moitié-moitié.</li>
    <li><strong>Les données sensibles présentes par accident</strong> : situation familiale, santé, numéro de sécurité sociale. On les détecte et on propose de les retirer, on ne les stocke pas en silence.</li>
  </ul>

  <div class="note">
    <p><b>La sortie brute ne se garde pas indéfiniment.</b> La version 0.2 la conservait « au cas où ». Or elle contient précisément ce que la normalisation avait décidé d'écarter : situation familiale, santé, nationalité. On la garde <b>30 jours</b>, avec un accès restreint, puis on la purge. Au-delà, on conserve le résultat structuré et les métadonnées techniques, pas le texte.</p>
  </div>

  <div class="note">
    <p><b>Le formulaire est le chemin principal, l'extraction n'est qu'un accélérateur.</b> Rien n'est publié automatiquement : l'écran de relecture est obligatoire, chaque champ porte son niveau de confiance et l'extrait du CV dont il vient, et on peut relancer l'analyse. Un parseur n'a pas besoin d'être parfait — il a besoin de savoir dire où il doute.</p>
  </div>

  <div class="callout">
    <p style="margin-bottom:0"><b>Construisez votre jeu de test dès la première semaine.</b> Trente à cinquante CV volontairement variés, anonymisés ou fabriqués, avec la bonne réponse écrite à la main à côté. Mesurez champ par champ : employeurs, intitulés, dates, formations, et surtout le <em>rattachement</em> entre eux. Deux des trois relecteurs ont avancé un taux d'échec chiffré ; le troisième a refusé, faute de corpus. C'est lui qui a raison : le seul chiffre qui vaudra quelque chose est le vôtre. Et un JSON parfaitement valide contenant les mauvaises dates est un échec, pas un succès.</p>
  </div>

  <h2 id="assistant">L'assistant de rédaction</h2>
  <p>C'est la partie qui donne sa valeur au produit côté candidat. Quatre niveaux, du plus mécanique au plus intelligent — et surtout, du gratuit au coûteux.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Niveau</th><th>Détecte</th><th>Exemple de message</th></tr></thead>
    <tbody>
      <tr>
        <td><b>1</b><br><span class="badge">structure</span></td>
        <td>Champ obligatoire vide, format invalide, incohérence de type</td>
        <td>« Il manque ta commune : sans elle, aucune offre ne peut t'être proposée. »</td>
      </tr>
      <tr>
        <td><b>2</b><br><span class="badge">cohérence</span></td>
        <td>Dates qui se chevauchent, trou de deux ans, expérience antérieure au diplôme, salaire hors échelle</td>
        <td>« Deux expériences se chevauchent en 2023. C'est normal ? »</td>
      </tr>
      <tr>
        <td><b>3</b><br><span class="badge">langue</span></td>
        <td>Orthographe, grammaire, accords, ponctuation</td>
        <td>« <em>gestionaire</em> → <em>gestionnaire</em> »</td>
      </tr>
      <tr>
        <td><b>4</b><br><span class="badge no">v2</span></td>
        <td>Reformulation par modèle : formulation faible, absence de résultat concret, contenu hors sujet</td>
        <td><b>Coupé de la version 1.</b> C'est l'endroit où un modèle risque le plus d'enjoliver, pour un gain de démonstration faible. Les niveaux 1 à 3 suffisent, et le niveau 3 ne coûte rien.</td>
      </tr>
    </tbody>
  </table></div>

  <h3>Deux règles non négociables</h3>
  <p><strong>L'assistant propose, il n'écrase jamais.</strong> Chaque suggestion s'affiche en comparaison avant/après, avec deux boutons. Un texte réécrit sans accord est un texte que la personne ne saura pas défendre en entretien — c'est pire que la faute d'origine.</p>
  <p><strong>L'assistant n'invente aucun fait.</strong> Il reformule, il structure, il demande des précisions. Il n'ajoute jamais une compétence, une date ou un employeur que la personne n'a pas donnés. Un CV embelli par une machine est un faux CV, et c'est nous qui en serions responsables.</p>

  <h2 id="completude">Complétude et force du profil</h2>
  <p>Deux indicateurs distincts, affichés côte à côte, parce qu'ils ne disent pas la même chose.</p>
  <dl class="kv">
    <dt>Complétude</dt><dd>Pourcentage des champs utiles renseignés. Mécanique, sans jugement. Sert à débloquer l'accès au swipe — proposition : 70 % minimum.</dd>
    <dt>Force</dt><dd>Qualité de ce qui est écrit : résultats chiffrés, verbes d'action, compétences reconnues dans le référentiel, absence de fautes. Sert à conseiller, jamais à filtrer.</dd>
  </dl>
  <p>Un profil incomplet ne doit pas être puni dans le score de matching : ce serait pénaliser deux fois la même personne. Il est simplement moins bien classé <em>parce qu'on en sait moins</em>, ce qui est une conséquence, pas une sanction.</p>

  <h2 id="livrables">Ce que le pôle 1 doit livrer</h2>
  <ul>
    <li>Le schéma <code>resume.json</code> et ses fragments de secteur</li>
    <li>Le formulaire multi-étapes, avec sauvegarde automatique du brouillon</li>
    <li>Le dépôt de CV et la chaîne d'extraction complète</li>
    <li>L'écran de vérification, avec les champs devinés distingués visuellement</li>
    <li>Les quatre niveaux d'assistance</li>
    <li>L'aperçu du CV rendu depuis le JSON, et l'export PDF</li>
  </ul>

  <div class="nextprev">
    <a href="produit.php"><span>Précédent</span><b>← Produit</b></a>
    <a href="matching.php"><span>Suivant</span><b>Swipe &amp; matching →</b></a>
  </div>

</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

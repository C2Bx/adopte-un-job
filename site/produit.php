<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Produit — Adopte un Job</title>
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
      <a href="produit.php" aria-current="page"><b>Produit</b><span>Vision et parcours</span></a>
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

  <div class="eyebrow">01 — Produit</div>
  <h1 class="title">Ce qu'on construit</h1>
  <p class="chapo">Le problème n'est pas qu'il manque des offres ou des candidats. C'est que les deux se parlent à travers un format — le CV — que personne ne peut comparer.</p>

  <h2 id="probleme">Le problème, des deux côtés</h2>
  <p>Un candidat envoie trente CV, n'obtient aucun retour, et ne sait jamais si son profil correspondait vraiment. Un recruteur reçoit deux cents candidatures dans deux cents mises en page différentes, et passe son temps à chercher la même information au même endroit sans jamais la trouver.</p>
  <p>Les deux subissent le même défaut : <strong>la donnée n'est pas structurée</strong>. Tant qu'un CV reste un document, on ne peut ni le comparer, ni l'expliquer, ni donner un retour.</p>

  <div class="note">
    <p><b>Notre réponse tient en une phrase :</b> on normalise les deux côtés dans le même format, on calcule une pertinence explicable, et on rend la décision réciproque.</p>
  </div>

  <h2 id="personas">Pour qui</h2>

  <div class="grid g3">
    <div class="card">
      <div class="eyebrow">Candidat</div>
      <h3 style="margin-top:6px">Le pressé</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">A un CV à jour, cherche vite, veut voir en dix secondes si une offre vaut le coup. Il vient pour le swipe.</p>
    </div>
    <div class="card">
      <div class="eyebrow">Candidat</div>
      <h3 style="margin-top:6px">Celui qui change</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Dix ans dans un métier, envie d'un autre. Il ne veut surtout pas qu'on lui propose son passé en boucle. C'est notre cas le plus intéressant.</p>
    </div>
    <div class="card">
      <div class="eyebrow">Recruteur</div>
      <h3 style="margin-top:6px">Le débordé</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Une PME, pas de service RH. Il veut cinq bons profils, pas deux cents candidatures. Il paie en temps, pas en argent.</p>
    </div>
  </div>

  <h2 id="parcours-candidat">Parcours candidat</h2>
  <ol class="steps">
    <li><b>Il arrive</b> — inscription, et un choix immédiat : « j'ai un CV » ou « je pars de zéro ».</li>
    <li><b>Il obtient une fiche</b> — soit par extraction de son PDF, soit par le formulaire guidé. Dans les deux cas il finit sur le même écran de vérification.</li>
    <li><b>On l'aide à l'améliorer</b> — champs manquants signalés, fautes corrigées, formulations proposées. Il accepte ou refuse chaque suggestion.</li>
    <li><b>Il dit ce qu'il cherche</b> — métier visé, contrat, zone, disponibilité, et surtout son degré d'ouverture à un autre domaine.</li>
    <li><b>Il swipe</b> — des offres, classées par pertinence, avec le pourcentage et sa justification visibles sur la carte.</li>
    <li><b>Il retrouve tout</b> — historique de ce qu'il a aimé, de ce qu'il a écarté, et ses matchs.</li>
  </ol>

  <h2 id="parcours-recruteur">Parcours recruteur</h2>
  <ol class="steps">
    <li><b>Il crée son entreprise</b> — nom, secteur, taille, une description courte.</li>
    <li><b>Il publie une offre</b> — en collant son annonce, en déposant un PDF, ou en remplissant le formulaire. Même chaîne de traitement que pour un CV.</li>
    <li><b>Il vérifie la fiche extraite</b> — et complète ce qui manque, en particulier ce qui est réellement exigé et ce qui est seulement souhaité.</li>
    <li><b>Il swipe des profils</b> — pour une offre donnée, pseudonymisés, classés par pertinence.</li>
    <li><b>Il reçoit les matchs</b> — avec un CV recentré sur son offre, et le CV d'origine à côté.</li>
  </ol>

    <h2 id="visibilite">Ce qui est visible, et quand</h2>
  <p>La version 0.2 affichait avant match : prénom, initiale, commune, parcours, employeurs. Un relecteur a fait la démonstration que ça ne pseudonymise rien : <em>« Julie C., Dumbéa, 4 ans chez X, BTS 2021 »</em> identifie quelqu'un en trois secondes sur un petit marché. La révélation devient donc <strong>graduelle, en trois paliers</strong>.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Donnée candidat</th><th>Dans le deck</th><th>Intérêt manifesté</th><th>Après match</th></tr></thead>
    <tbody>
      <tr><td>Métier et compétences</td><td><span class="badge ok">visible</span></td><td><span class="badge ok">visible</span></td><td><span class="badge ok">visible</span></td></tr>
      <tr><td>Années d'expérience</td><td>agrégées</td><td>détaillées</td><td>détaillées</td></tr>
      <tr><td>Zone de travail acceptée</td><td>large</td><td>précise</td><td>précise</td></tr>
      <tr><td>Prénom</td><td><span class="badge no">masqué</span></td><td>prénom seul</td><td><span class="badge ok">visible</span></td></tr>
      <tr><td>Nom complet</td><td><span class="badge no">masqué</span></td><td><span class="badge no">masqué</span></td><td><span class="badge ok">visible</span></td></tr>
      <tr><td>Employeurs précédents</td><td>secteur seul</td><td>secteur seul</td><td><span class="badge ok">nommés</span></td></tr>
      <tr><td>Établissement de formation</td><td>niveau seul</td><td>niveau seul</td><td><span class="badge ok">nommé</span></td></tr>
      <tr><td>Année d'obtention du diplôme</td><td><span class="badge no">jamais</span></td><td><span class="badge no">jamais</span></td><td>si le candidat l'affiche</td></tr>
      <tr><td>E-mail, téléphone</td><td><span class="badge no">masqués</span></td><td><span class="badge no">masqués</span></td><td><span class="badge ok">visibles</span></td></tr>
      <tr><td>CV PDF d'origine</td><td><span class="badge no">masqué</span></td><td><span class="badge no">masqué</span></td><td><span class="badge ok">consultable</span></td></tr>
      <tr><td>Lieu de résidence</td><td colspan="3" style="text-align:center"><span class="badge no">jamais collecté</span></td></tr>
      <tr><td>Âge, date de naissance</td><td colspan="3" style="text-align:center"><span class="badge no">jamais collectés</span></td></tr>
      <tr><td>Photo</td><td colspan="3" style="text-align:center"><span class="badge no">jamais, y compris après match</span></td></tr>
    </tbody>
  </table></div>

  <p>Deux changements méritent d'être expliqués. <strong>L'année du diplôme disparaît</strong> : elle donne l'âge à deux ans près, et l'âge est un critère interdit. On garde le niveau, qui est l'information de travail. Et <strong>le lieu de résidence n'est plus collecté du tout</strong> : le score n'a besoin que des zones que le candidat accepte, et la résidence est un critère de discrimination.</p>

  <div class="callout">
    <h3 style="margin-top:0">La photo, tranchée définitivement</h3>
    <p>Les trois relecteurs confirment la position, l'un d'eux allant plus loin : que apporte une photo <em>après</em> le match, avant un entretien qui aura lieu de toute façon ? Rien, sinon du stockage, de la modération et du risque.</p>
    <p style="margin-bottom:0">Donc : <strong>pas de photo, nulle part</strong>. Attendez-vous à ce que des recruteurs le regrettent. C'est un choix assumé, pas un oubli — et c'est le meilleur argument de communication du produit.</p>
  </div>

  <h2 id="perimetre">Périmètre de la version 1</h2>
  <p>Révisé après la <a href="arbitrages.php">contre-expertise</a>. Ce qu'on retire n'est pas ce qui est difficile : c'est ce dont la qualité n'a pas de borne, ou qui fabrique de l'outillage au lieu du produit.</p>
  <div class="grid g2">
    <div class="card">
      <div class="eyebrow">Dedans</div>
      <ul style="margin:10px 0 0;font-size:.93rem;color:var(--ink-2)">
        <li>Compte candidat et compte recruteur</li>
        <li>Import de CV ou saisie guidée, sur un secteur pilote</li>
        <li>Écran de relecture avec confiance par champ</li>
        <li>Offres créées ou collées en texte</li>
        <li>Deck de cartes côté candidat</li>
        <li>Liste classée et invitation côté recruteur</li>
        <li>Deux scores expliqués, avec leur confiance</li>
        <li>Match, vue de candidature ciblée, créneaux, discussion</li>
      </ul>
    </div>
    <div class="card">
      <div class="eyebrow">Dehors, assumé</div>
      <ul style="margin:10px 0 0;font-size:.93rem;color:var(--ink-2)">
        <li>Applications natives et magasins d'applications</li>
        <li>Tous métiers — un seul secteur en v1</li>
        <li>OCR et import d'offre en PDF</li>
        <li>Reformulation par modèle</li>
        <li>Photo, avant comme après match</li>
        <li>Paiement, tests de compétences, visioconférence</li>
        <li>Multilingue, aspiration d'offres tierces</li>
      </ul>
    </div>
  </div>

  <div class="note">
    <p><b>Le produit doit valoir quelque chose sans match.</b> C'est le correctif le plus important côté produit : dans la version 0.2, presque toute la valeur arrivait après l'appariement mutuel. Un candidat sans match doit repartir avec un profil structuré, un diagnostic de son CV et l'explication de ses écarts. Un recruteur sans candidat doit recevoir une offre structurée et le diagnostic de ses critères trop stricts. Sinon la rétention dépend entièrement de la densité du marché — et elle sera faible.</p>
  </div>

<div class="nextprev">
    <a href="index.html"><span>Précédent</span><b>← Accueil</b></a>
    <a href="profil.php"><span>Suivant</span><b>Profil &amp; CV →</b></a>
  </div>

</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

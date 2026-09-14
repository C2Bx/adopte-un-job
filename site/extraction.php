<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lecture de CV — Adopte un Job</title>
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

  <div class="eyebrow">02 bis — Pôle 1</div>
  <h1 class="title">Lire un CV sans modèle de langage</h1>
  <p class="chapo">La lecture se fait entièrement dans l'appareil, avec pdf.js. Le CV ne part jamais sur le réseau. Aucun modèle de langage n'intervient : ce qui n'est pas trouvé reste vide, et l'utilisateur relit tout avant que quoi que ce soit ne soit appliqué.</p>

  <h2 id="chaine">Deux étapes</h2>
  <ol class="steps">
    <li><b>Le texte avec sa mise en page.</b> La gouttière entre colonnes est cherchée là où le moins de fragments la traversent, pas au milieu de la page : la colonne de droite d'un CV commence rarement à 50 %. Sans ça, un CV sur deux colonnes s'entrelace et tout le reste devient faux.</li>
    <li><b>Les rubriques donnent le sens.</b> « EXPÉRIENCE », « SCOLARITÉ » : suivre les titres est bien plus fiable que de deviner ligne par ligne. Hors rubrique, une date isolée est ignorée — « prix Pépites 2024 » n'est ni un emploi ni un diplôme.</li>
  </ol>

  <h2 id="regles">Trois règles qui viennent d'erreurs réelles</h2>
  <ul>
    <li><b>On n'invente jamais de mois.</b> Une année seule reste une année. « 2019 » ne devient pas « janvier 2019 ».</li>
    <li><b>Aucune date n'est conservée sur une formation.</b> L'année d'obtention révèle l'âge, qui est un critère de discrimination interdit. Le niveau suffit à comparer.</li>
    <li><b>Mieux vaut une information manquante qu'une information fausse.</b> La première se corrige à la main, la seconde ne se voit pas.</li>
  </ul>

  <h2 id="corpus">L'audit sur huit CV réels</h2>
  <p>Le moteur avait été réglé sur deux CV. Passé sur un corpus de huit — huit mises en page différentes — il en sortait <b>deux justes</b>. C'est le symptôme classique : un moteur ajusté sur ses cas de test, pas sur la variété réelle.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Cause</th><th>Ce qu'elle produisait</th></tr></thead>
    <tbody>
      <tr><td>Rubrique en casse normale non reconnue</td><td><b>Toutes</b> les expériences d'un CV perdues, en silence — parce qu'il écrit « Experience » et pas « EXPÉRIENCE »</td></tr>
      <tr><td>Identité cherchée dans une bande géométrique</td><td>Prénom « Permis » (lu dans « 27 ans - Permis de conduire »), prénom « Université », initiale « H » (lue dans « &amp;HACKING »)</td></tr>
      <tr><td>Un nombre à quatre chiffres pris pour une date</td><td>« Windows server 2012 » devenait une expérience professionnelle</td></tr>
      <tr><td>Niveau lu par mots-clés sans priorité</td><td>« L3 MIAGE » classé Bac+5, parce que « MIAGE » est associé au master</td></tr>
      <tr><td>Repli trop permissif sur les diplômes</td><td>« Reflexe Pacifique » et « Lycée du Grand Nouméa » comptés comme des diplômes</td></tr>
      <tr><td>Intitulé de poste avalé comme rubrique</td><td>« TECHNICIEN EXPLOITATION – STAGE » pris pour un en-tête : le poste disparaît, l'employeur prend sa place</td></tr>
      <tr><td>Lettres espacées, pictogrammes, colonnes fusionnées</td><td>« E X P E R I E N C E », « ⧉ EXPÉRIENCES », « EXPÉRIENCES LANGUES » : aucune rubrique reconnue</td></tr>
      <tr><td>Niveau global lu dans une phrase d'intention</td><td>« je recherche un contrat pour mon <b>Master</b> » faisait d'une L3 une Bac+5</td></tr>
    </tbody>
  </table></div>

  <p class="note">Deux défauts sont restés, et sont documentés comme tels. <b>L'ordre prénom/nom en capitales est indécidable</b> : « DUPONT CAMILLE » met le nom d’abord, « CAMILLE DUPONT » le prénom. L'adresse e-mail comme départage se trompe une fois sur deux. Et <b>le titre du poste est souvent en gras</b>, une information que l'extraction du texte ne conserve pas — d'où des intitulés qui valent l'employeur.</p>

  <h2 id="banc">Le banc d'essai</h2>
  <p>Le dossier de CV sert de corpus permanent : un script passe les huit documents dans le fichier <b>réellement servi</b> et sort un tableau champ par champ. À relancer après chaque modification. C'est lui qui a attrapé les régressions introduites en cours de route — un motif trop large qui mangeait « Fév. 2023 », un seuil resserré qui perdait un bandeau de nom.</p>

  <h2 id="ocr">Scans et photos : la même chaîne, une source de plus</h2>
  <p>Ce qui rend la lecture possible n'est pas le PDF : c'est une liste de <b>fragments de texte avec leur position et leur taille</b>. Un moteur de reconnaissance optique produit exactement ça — des mots avec leur boîte — et la suite de la chaîne (colonnes, bandeau d'identité, rubriques) ne voit pas la différence. Depuis le 14 septembre, la bêta accepte donc une image (JPG, PNG, WebP) et bascule d'elle-même sur l'OCR quand un PDF n'a pas de couche texte.</p>
  <dl class="kv">
    <dt>Moteur</dt><dd>Tesseract en WebAssembly (tesseract.js 6), modèle français « fast » de 1,1 Mo. Tout est servi par l'application — moteur, cœur, modèle — pas par un CDN : la promesse « rien ne sort » vaut aussi pour la trace de qui utilise l'app. Chargé à la demande, jamais à l'ouverture.</dd>
    <dt>Aucun modèle de langage</dt><dd>Lire des pixels et comprendre du texte sont deux tâches. La première est de la reconnaissance de formes, résolue depuis vingt ans ; la seconde, ce sont nos règles. Un modèle multimodal lirait mieux une photo de travers, mais il inventerait une année qui n'est pas sur le document, dans une phrase parfaitement formée — et le CV partirait chez un tiers.</dd>
    <dt>Confiance</dt><dd>Tesseract donne un score par mot. La relecture l'affiche ; sous 70 %, <b>rien n'est coché d'office</b>. Un mot lu avec peine ne devient pas un prénom.</dd>
    <dt>Temps</dt><dd>5 à 7 secondes par page sur un ordinateur, le double ou le triple sur un téléphone. C'est l'utilisateur qui paie, en batterie — c'est ce qui rend le zéro coût possible.</dd>
  </dl>

  <p>Tesseract seul ne suffisait pas. Quatre corrections, toutes issues d'un échec observé :</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Ce qui se passait</th><th>Ce qui a été fait</th></tr></thead>
    <tbody>
      <tr><td>Les titres de rubrique en <b>blanc sur bandeau de couleur</b> (« EXPÉRIENCE », « SCOLARITÉ ») étaient lus « OLARITÉ », ou pas du tout. Sans la rubrique, tous les diplômes devenaient des expériences.</td><td>Les zones sombres en forme de bandeau sont détectées (tuiles de 24 px, composantes connexes), <b>inversées</b> et relues — empilées dans une seule image, parce qu'un appel au moteur coûte une seconde d'amorçage quelle que soit la taille. Et une fin de mot de cinq lettres seule sur sa ligne (« OLARITÉ ») est remise d'aplomb.</td></tr>
      <tr><td>Le <b>nom en très gros</b> était pris pour un dessin par la segmentation automatique, et le moteur lit mal des lettres de 70 px — il est fait pour du texte de corps.</td><td>Seconde passe en « texte épars » sur le tiers haut, à échelle réduite puis réelle. Une relecture sûre <b>remplace</b> le bruit lu au même endroit : « DARKAM » à 92 % prend la place du « 1} » de la première passe.</td></tr>
      <tr><td>Une icône ou un cercle décoratif devenait un mot d'un demi-écran de haut — le seul candidat au bandeau d'identité.</td><td>Un signe deux fois plus haut que le texte doit avoir deux lettres ; cinq fois plus haut, c'est un dessin. Et en mode optique, le bandeau d'identité ne se cherche que dans la moitié haute de la page.</td></tr>
      <tr><td>Un onglet passé en arrière-plan <b>figeait</b> la lecture d'un PDF scanné : le rendu de pdf.js attend <code>requestAnimationFrame</code>, qui ne tourne pas dans un onglet caché.</td><td>Rendu avec l'intention « impression », qui n'attend rien.</td></tr>
    </tbody>
  </table></div>

  <p>Résultat, sur un CV à deux colonnes avec bandeaux colorés, comparé à sa lecture par la couche texte : <b>scan, PDF scanné et photo simulée</b> (penchée de 2,5°, floue, contraste réduit, posée sur une table) donnent exactement les mêmes champs — identité, téléphone, trois expériences, quatre formations, niveau. Sur le corpus de huit CV en mode scan, quatre sont au niveau du texte ; les autres montrent les limites réelles : une police <b>filaire</b> ou <b>extra-grasse</b> pour le nom, un pictogramme qui devient une initiale. Là, la confiance tombe, rien n'est coché, et l'utilisateur relit.</p>

  <div class="note">
    <p><b>Ce qu'elle ne saura pas faire, et qu'on ne cherchera pas :</b> une photo avec une ombre portée ou un reflet, un CV manuscrit, un HEIC d'iPhone (le navigateur ne le décode pas — exporter en JPG). Le PDF reste le chemin recommandé ; l'OCR est un filet, pas la porte d'entrée. Sur téléphone natif, la reconnaissance du système (ML Kit, Vision) sera meilleure et gratuite — elle produit les mêmes fragments.</p>
  </div>

  <div class="callout">
    <p style="margin-bottom:0"><b>La lecture se vérifie à l'écran, pas dans le code.</b> Chaque information proposée affiche l'extrait du CV d'où elle vient, et se décoche. Le justificatif doit être lisible : une fenêtre de quatre-vingts caractères qui traverse deux rubriques et se coupe en plein mot ne justifie rien. Et « lu dans » ne s'affiche que devant un vrai extrait — devant une explication, c'est un mensonge de libellé.</p>
  </div>

</main>
</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Techno — Adopte un Job</title>
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
      <a href="techno.php" aria-current="page"><b>Techno</b><span>Web, mobile, données</span></a>
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

  <div class="eyebrow">04 — Technique</div>
  <h1 class="title">Une seule base de code</h1>
  <p class="chapo">L'application doit exister sur le web et sur mobile. À neuf personnes et sur un semestre, écrire deux fois la même chose n'est pas une option — le choix du socle est donc la décision la plus structurante du projet.</p>

    <h2 id="cross">Web ou natif : tranché</h2>

  <p>La version 0.2 partait sur React Native via Expo, pour couvrir le web et le mobile d'un seul code. Les trois relecteurs ont écarté ce choix, pour la même raison de fond : <strong>ce produit n'a presque aucun besoin natif</strong>. Formulaires longs, dépôt de fichiers, lecture de documents, listes, tableau de bord — c'est une application web.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Approche</th><th>Ce qu'on y gagne</th><th>Ce qu'on y perd</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Site installable</b><br>React + PWA <span class="badge ok">retenu</span></td>
        <td>Un seul code, un seul déploiement continu. Le DOM est de loin le meilleur terrain pour des formulaires métier et un tableau de bord. Le swipe au doigt fonctionne très bien dans un navigateur mobile. S'installe sur l'écran d'accueil.</td>
        <td>Pas de présence dans les magasins d'applications. Notifications limitées selon la plateforme.</td>
      </tr>
      <tr>
        <td><b>Expo / React Native</b></td>
        <td>Gestes natifs, publication sur les magasins.</td>
        <td>On achète la complexité mobile avant d'en avoir le besoin. Le rendu web est faible exactement là où on passe le plus de temps : formulaires, PDF, ergonomie de bureau du recruteur.</td>
      </tr>
      <tr>
        <td><b>Flutter</b></td>
        <td>Animations excellentes, rendu identique partout.</td>
        <td>Dart : personne ne l'écrira le premier jour. Sortie web lourde.</td>
      </tr>
    </tbody>
  </table></div>

  <div class="note">
    <p><b>Décision (révisée le 8 septembre 2026).</b> Une application web responsive et installable, écrite en <b>React&nbsp;+&nbsp;TypeScript</b>, empaquetée avec <b>Capacitor</b> pour les magasins d'applications. La version 0.3 excluait les magasins ; cet arbitrage a été rouvert et inversé, parce que publier n'est pas un choix de langage mais un choix d'emballage : Capacitor prend le même code et le pose dans un projet Xcode et un projet Android Studio, sans rien réécrire. Le coût est réel mais tardif et facultatif — si on ne fait jamais l'étape, on n'a rien perdu ; l'inverse n'est pas vrai.</p>
  </div>

  <div class="callout">
    <p style="margin-bottom:0"><b>Un argument à ne pas reprendre.</b> On lit souvent que le rendu web de React Native « pose des problèmes de référencement ». C'est vrai en général, et sans objet ici : l'application est derrière un mot de passe, aucune page n'a vocation à être indexée. Ce qui condamne ce choix, ce sont les formulaires et l'ergonomie de bureau — pas le référencement.</p>
  </div>

<h2 id="stack">La pile complète</h2>
  <dl class="kv">
    <dt>Application</dt><dd>React 19 + TypeScript, construit par Vite, site installable et responsive. Une seule base de code pour le web, iOS et Android. <b>La bêta tourne</b> : <a href="beta.php">description</a>, en ligne sur <a href="beta/">zako.nc/avp/beta/</a></dd>
    <dt>Swipe</dt><dd>Gestes tactiles du navigateur, avec repli en boutons sur toutes les actions — côté candidat uniquement</dd>
    <dt>API</dt><dd><b>PHP 8 + PDO</b>, un seul point d'entrée. Le choix FastAPI reposait sur un seul argument — « la lecture de documents vit en Python » — et cet argument est tombé : l'extraction de CV se fait <b>dans le navigateur</b> avec pdf.js, le serveur n'a plus de PDF à lire. Restait la contrainte qui décide vraiment : sur le vhost mutualisé du projet, PHP se déploie aujourd'hui, un service Python demande un hébergement qu'on n'a pas</dd>
    <dt>Base</dt><dd><b>MySQL 8 seul</b>, 29 tables, en production. <b>Pas de recherche vectorielle</b> : aucun usage de la version 1 ne l'exige, et un plongement ne sait pas gérer une contrainte dure — il rapprocherait « permis B » et « permis poids lourd ». Le détail est sur la page <a href="api.php">API &amp; base</a></dd>
    <dt>Fichiers</dt><dd>Stockage objet compatible S3, jamais servi en direct, accès par lien signé de courte durée</dd>
    <dt>Tâches de fond</dt><dd>Une table <code>jobs</code> en base et un worker, rien de plus. Uniquement pour l'extraction et les e-mails : à ce volume, les scores se calculent à la demande et se mettent en cache</dd>
    <dt>Comptes</dt><dd>Bibliothèque d'authentification éprouvée plutôt qu'un code maison, mots de passe hachés en Argon2</dd>
    <dt>Local</dt><dd>Un fichier de composition de conteneurs : base, stockage, API, file. Une commande, tout le monde a le même environnement</dd>
  </dl>

  <h2 id="archi">Comment ça s'articule</h2>
  <pre><code>   Application web  ───────────►  API FastAPI  ──────►  PostgreSQL
   (navigateur, installable)          │
                                      ├──►  Stockage objet     (CV, pièces jointes)
                                      │
                                      ├──►  Scores, à la demande
                                      │        filtres → deux sous-scores → explication
                                      │        (quelques dizaines de paires, mis en cache)
                                      │
                                      └──►  Table jobs + worker
                                              │
                                              ├──►  Extraction de documents
                                              │        texte → modèle (pas d'OCR en v1)
                                              │
                                              └──►  Normalisation
                                                       compétences, métiers, zones</code></pre>

  <p>Ce découpage a une conséquence pratique importante : <strong>l'application n'appelle jamais un modèle de langage directement</strong>. Elle dépose un travail, reçoit un identifiant, et suit son avancement. C'est ce qui permet de survivre à une lenteur, à une panne du fournisseur, ou à une limite de débit atteinte.</p>

  <div class="note">
    <p><b>Une limite qu'on découvre toujours trop tard :</b> les fournisseurs de modèles ne facturent pas seulement au volume, ils plafonnent le <b>nombre de jetons par minute</b>. Un plafond bas suffit à rendre une démonstration impossible alors que la facture affiche zéro. À vérifier avant de choisir, et à surveiller dans les en-têtes de réponse.</p>
  </div>

  <h2 id="donnees">Le modèle de données</h2>
  <p>Quatre familles. Le détail des colonnes n'a pas sa place ici — ce qui compte, c'est pourquoi ces tables existent séparément.</p>

  <h3>Comptes et identités</h3>
  <p><code>users</code> ne contient que l'authentification : adresse, mot de passe, rôle, état. Tout le métier vit ailleurs. <code>candidates</code> et <code>recruiters</code> portent les profils ; <code>companies</code> et <code>company_members</code> permettent qu'une entreprise ait plusieurs recruteurs et qu'un recruteur change d'entreprise.</p>

  <h3>Documents et profils</h3>
  <p><code>resumes</code> garde les fichiers déposés, versionnés, un seul actif. <code>resume_extractions</code> conserve la <strong>sortie brute du modèle</strong> avec la version utilisée : c'est ce qui permet de retraiter un CV plus tard sans redemander le fichier. Le <code>resume.json</code> validé est stocké tel quel, en JSON, plutôt qu'éclaté en vingt tables — on n'en fait pas de requêtes complexes, on le lit en entier.</p>

  <h3>Référentiels</h3>
  <p><code>skills</code> ne contient que des compétences canoniques ; <code>skill_aliases</code> contient toutes les orthographes rencontrées. <code>occupations</code> et <code>occupation_links</code> décrivent les métiers et leur proximité — c'est la table qui rend la reconversion calculable. Plus <code>languages</code>, <code>locations</code>, et les listes fermées (contrats, niveaux de diplôme, permis).</p>

  <h3>Interactions</h3>
  <p><code>jobs</code> et <code>job_skills</code> pour les offres, avec la distinction exigé / souhaité. <code>match_scores</code> met en cache le score, son détail par critère et la version de l'algorithme. <code>swipes</code> enregistre chaque décision (acteur, cible, offre, sens) avec une contrainte d'unicité. Puis <code>matches</code>, <code>conversations</code>, <code>messages</code>, <code>appointments</code>, <code>notifications</code>.</p>

  <h3>Conformité</h3>
  <p>Deux tables qu'on oublie systématiquement et qu'on ne peut pas rajouter après coup : <code>consents</code>, qui trace le consentement, sa version et sa finalité, et <code>audit_logs</code>, qui enregistre qui a consulté quelle donnée personnelle et quand.</p>

  <h2 id="securite">Sécurité et données personnelles</h2>
  <ul>
    <li><strong>Le masquage avant match se fait côté serveur.</strong> L'API ne renvoie jamais un champ que le destinataire n'a pas le droit de voir. Masquer dans l'interface est une faille, pas une règle : il suffit d'ouvrir les outils de développement.</li>
    <li><strong>Les CV ne sont jamais servis en direct.</strong> Lien signé, durée courte, vérification du droit d'accès à chaque demande.</li>
    <li><strong>Un CV contient des données sensibles par accident</strong> — santé, situation familiale, parfois un numéro de sécurité sociale. On les détecte et on propose de les retirer plutôt que de les stocker sans le dire.</li>
    <li><strong>Export et suppression du compte livrés en version 1.</strong> Ajoutés après, ils obligent à repasser sur tout le schéma.</li>
    <li><strong>Durée de conservation écrite</strong> : proposition de 24 mois sans connexion, puis anonymisation plutôt que suppression, pour ne pas casser les statistiques.</li>
    <li><strong>Envoyer un CV à un fournisseur de modèle hors Union européenne est un transfert international de données.</strong> Point absent de la version 0.2, à régler avant le premier appel réel : fournisseur européen, ou encadrement contractuel explicite.</li>
    <li><strong>La clé du fournisseur de modèle est le seul point de défaillance externe du projet.</strong> Décidez qui la paie et qui la détient, et prévoyez un mode dégradé sans modèle — sinon une coupure le jour de la soutenance emporte la démonstration.</li>
    <li><strong>Le score ne doit jamais utiliser</strong> l'âge, le genre, l'origine, l'adresse précise ni la photo. Ce n'est pas seulement une question légale : ces variables entrent par la porte de derrière si personne ne l'interdit explicitement dans le code.</li>
  </ul>

  <div class="nextprev">
    <a href="matching.php"><span>Précédent</span><b>← Swipe &amp; matching</b></a>
    <a href="opensource.php"><span>Suivant</span><b>Open source →</b></a>
  </div>

</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

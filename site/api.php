<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API &amp; base — Adopte un Job</title>
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
      <a href="api.php" aria-current="page"><b>API &amp; base</b><span>Routes, schéma, sécurité</span></a>
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

  <div class="eyebrow">04 bis — Technique</div>
  <h1 class="title">L'API et la base</h1>
  <p class="chapo">La bêta ne stocke plus rien dans le navigateur. Tout passe par une API PHP et une base MySQL en production. Cette page dit ce qui existe, et pourquoi chaque choix a été fait plutôt qu'un autre.</p>

  <h2 id="ou">Où ça tourne</h2>
  <dl class="kv">
    <dt>Bêta</dt><dd><a href="beta/">zako.nc/avp/beta/</a> — React 19 + TypeScript, construit par Vite, servi en fichiers statiques</dd>
    <dt>API</dt><dd><code>zako.nc/avp/app/api/index.php/&lt;route&gt;</code> — PHP 8, un seul point d'entrée</dd>
    <dt>Base</dt><dd><code>avp_prod</code>, MySQL 8.4 sur un hébergement mutualisé, 29 tables</dd>
    <dt>Prototype</dt><dd><a href="app/index.php">zako.nc/avp/app/</a> — conservé tel quel, en <code>localStorage</code>, jusqu'à ce que la bêta atteigne la parité</dd>
  </dl>

  <h2 id="schema">Le schéma, et ce qu'il refuse de stocker</h2>
  <p>Trois principes expliquent la forme des tables. Ils ne sont pas décoratifs : chacun a écarté une colonne que le schéma « naturel » aurait contenue.</p>

  <ol class="steps">
    <li><b>Ce qui est interdit au score n'est pas stocké.</b> Ni date de naissance, ni photo, ni adresse. La table <code>candidate_educations</code> n'a <b>aucune colonne de date</b> : l'année d'obtention d'un diplôme révèle l'âge, qui est un critère de discrimination interdit. Le niveau suffit à comparer.</li>
    <li><b>Le masquage avant match est une règle serveur.</b> Le nom, le téléphone et le nom complet vivent dans <code>candidates</code> mais ne sortent jamais de l'API tant qu'il n'y a pas de match. Masquer dans l'interface serait une faille : il suffit d'ouvrir les outils de développement.</li>
    <li><b>Les tables de conformité existent depuis le premier jour.</b> <code>consents</code> trace le consentement, sa finalité et sa version ; <code>audit_logs</code> enregistre qui a consulté quelle donnée personnelle. Ajoutées après coup, elles obligent à reprendre tout le schéma — et il n'existe alors aucune trace des mois précédents.</li>
  </ol>

  <div class="tablewrap">
  <table>
    <thead><tr><th>Famille</th><th>Tables</th><th>Ce qu'elle porte</th></tr></thead>
    <tbody>
      <tr><td>Comptes</td><td><code>users</code>, <code>sessions</code>, <code>companies</code>, <code>company_members</code></td><td>L'authentification seule. Le métier vit ailleurs. Une entreprise peut avoir plusieurs recruteurs, et un recruteur peut changer d'entreprise.</td></tr>
      <tr><td>Référentiels</td><td><code>occupations</code>, <code>occupation_links</code>, <code>skills</code>, <code>skill_aliases</code></td><td>18 métiers, 46 liens de proximité, 83 compétences canoniques et leurs orthographes. <code>occupation_links</code> est la table qui rend la reconversion calculable.</td></tr>
      <tr><td>Candidats</td><td><code>candidates</code> + 7 tables de liaison</td><td>Zones, contrats, métiers visés, compétences, langues, expériences, formations. Le <code>resume.json</code> validé est stocké tel quel, en JSON : on le lit en entier, on n'y fait pas de requêtes.</td></tr>
      <tr><td>Documents</td><td><code>resumes</code>, <code>resume_extractions</code></td><td>La sortie brute de l'extraction est conservée avec la version du moteur : c'est ce qui permet de retraiter un CV plus tard sans redemander le fichier.</td></tr>
      <tr><td>Offres</td><td><code>jobs</code>, <code>job_skills</code>, <code>job_languages</code></td><td>La distinction <b>exigé / souhaité</b> est structurante : un « exigé » manquant écarte, un « souhaité » manquant coûte des points. Les confondre fausse tout le classement.</td></tr>
      <tr><td>Interactions</td><td><code>swipes</code>, <code>match_scores</code>, <code>matches</code>, <code>messages</code>, <code>appointments</code>, <code>notifications</code></td><td>Une décision par sens, avec une contrainte d'unicité pour que le réseau ne double pas un vote. Un match n'existe que si les deux ont dit oui.</td></tr>
      <tr><td>Conformité</td><td><code>consents</code>, <code>audit_logs</code></td><td>Consentement daté et versionné ; journal des accès aux données personnelles.</td></tr>
    </tbody>
  </table>
  </div>

  <h2 id="score">Le score est calculé par le serveur, et nulle part ailleurs</h2>
  <p>Le moteur a été porté de la maquette vers <code>api/score.php</code>, à l'identique sur le fond. Un score calculé dans le navigateur se modifie dans le navigateur — la démonstration pouvait se le permettre, la bêta non.</p>
  <ul>
    <li><b>Deux scores directionnels</b>, jamais moyennés. La qualité d'un match est le <b>minimum</b> des deux : une offre parfaite pour l'entreprise et médiocre pour le candidat n'est pas un demi-bon match.</li>
    <li><b>La confiance est séparée du score.</b> 80&nbsp;% sur trois critères renseignés ne vaut pas 80&nbsp;% sur dix, et l'écran le dit.</li>
    <li><b>Inconnu n'est pas non.</b> Un critère non renseigné sort du calcul et le poids restant est renormalisé, au lieu de compter zéro.</li>
    <li><b>La proximité entre métiers vient de la base</b>, pas d'une constante dans le code : elle est écrite, justifiée, et donc discutable. Une distance devinée par un modèle ne se discute pas.</li>
    <li>Les scores sont mis en cache dans <code>match_scores</code> avec la version de l'algorithme, et <b>invalidés</b> dès qu'un profil ou une offre change.</li>
  </ul>

  <h2 id="routes">Les routes</h2>
  <div class="tablewrap">
  <table>
    <thead><tr><th>Route</th><th>Ce qu'elle fait</th></tr></thead>
    <tbody>
      <tr><td><code>POST auth/inscription</code><br><code>POST auth/connexion</code><br><code>POST auth/deconnexion</code><br><code>GET auth/moi</code></td><td>Argon2id, jeton opaque révocable en base plutôt qu'un jeton auto-porté. Même message et même temps de réponse pour « compte inconnu » et « mot de passe faux » : les distinguer revient à publier la liste des comptes.</td></tr>
      <tr><td><code>GET auth/export</code><br><code>DELETE auth/compte</code></td><td>Livrés avec la version 1, pas après. La suppression <b>anonymise</b> plutôt qu'elle n'efface : les statistiques du projet survivent, plus aucune donnée personnelle ne subsiste. Apple exige d'ailleurs la suppression depuis l'application dès qu'on permet d'en créer un compte.</td></tr>
      <tr><td><code>GET referentiels</code></td><td>Zones, contrats, métiers, compétences, niveaux de diplôme et de langue.</td></tr>
      <tr><td><code>GET profil</code><br><code>PUT profil</code><br><code>POST profil/cv</code></td><td>Le profil complet, pour son propriétaire uniquement. Une compétence inconnue du référentiel n'est pas perdue : elle y entre. Le référentiel se construit avec l'usage.</td></tr>
      <tr><td><code>GET entreprise</code> · <code>PUT entreprise</code><br><code>GET/POST/PUT/DELETE offres</code></td><td>Côté recruteur. Fermer une offre ne la supprime pas : des matchs et des conversations en dépendent.</td></tr>
      <tr><td><code>GET deck</code><br><code>GET deck/{offre}</code></td><td>Le deck du candidat, et celui du recruteur pour une offre. <b>Répond 409 <code>profil_incomplet</code></b> avec la liste des manques tant que le profil ne permet pas de calculer un score.</td></tr>
      <tr><td><code>POST swipes</code><br><code>DELETE swipes/{offre}</code></td><td>Une décision, parmi <b>trois</b> : oui, non, plus tard. Forcer « plus tard » dans l'un des deux autres fausse l'historique. Le match n'est créé — et les deux parties notifiées — que si l'autre sens a déjà dit oui. La suppression permet de revenir sur une décision : la réécrire ne suffirait pas, la carte reviendrait au deck en restant décidée. Refusée si un match existe déjà.</td></tr>
      <tr><td><code>GET interets</code></td><td>Tout ce que le candidat a décidé, avec l'offre et son score. Sans cette route, l'écran ne pouvait montrer que les matchs — donc presque toujours rien, puisqu'un match demande aussi le oui de l'entreprise. Un score absent du cache est <b>recalculé à la volée</b> : le cache est vidé à chaque modification du profil, et c'est voulu — un score périmé ment.</td></tr>
      <tr><td><code>GET matchs</code> · <code>GET matchs/{id}</code><br><code>GET/POST matchs/{id}/messages</code><br><code>POST matchs/{id}/rdv</code> · <code>POST rdv/{id}</code></td><td>Messagerie et rendez-vous, ouverts après le match et jamais avant.</td></tr>
      <tr><td><code>GET notifications</code><br><code>POST notifications/lu</code></td><td>File de notifications par utilisateur.</td></tr>
    </tbody>
  </table>
  </div>

  <div class="callout">
    <p style="margin-bottom:0"><b>Le jeton est doublé, volontairement.</b> Cookie <code>httpOnly</code> pour le navigateur, en-tête <code>Authorization: Bearer</code> pour l'application empaquetée — une application native n'a pas de cookie de session. Les deux sont acceptés par le serveur, donc le même code client fonctionne dans les deux mondes.</p>
  </div>

  <h2 id="verrou">Le verrou du deck</h2>
  <p>Tant que le profil ne permet pas de calculer un score, le deck reste fermé. Le verrou est posé <b>aux deux bouts</b> : l'écran liste ce qui manque et mène au champ à corriger, l'API refuse <code>deck</code> et <code>swipes</code> avec un 409 et la même liste. Un verrou posé uniquement dans l'interface s'ouvre avec les outils de développement.</p>
  <p class="note">Ce qu'on afficherait sans profil ne serait pas « moins précis » : ce serait un ordre au hasard présenté comme une pertinence. C'est la raison du verrou, pas la complétude pour elle-même.</p>

  <h2 id="recette">La recette, et ce qu'elle a trouvé</h2>
  <p>Un script rejoue un parcours complet — inscription candidat et recruteur, verrou, profil, entreprise, offre, deck des deux côtés, swipes croisés, match, message, rendez-vous, droits, export, suppression : <b>28 appels, 0 écart</b>. Il vérifie notamment que le deck du recruteur n'expose <b>aucun</b> champ personnel avant le match, et qu'il les expose après.</p>
  <p>Deux défauts réels sont sortis de cette recette, et aucun n'aurait été visible à l'œil :</p>
  <ul>
    <li><b><code>iconv('//TRANSLIT')</code> mange les accents</b> selon la bibliothèque C du serveur. « Développement web » y devenait la clé <code>d-veloppement-web</code>, une compétence fantôme distincte de la vraie. Le référentiel se serait fragmenté en silence, et le score avec. Remplacé par une table de translittération explicite.</li>
    <li><b>Un alias résolu était recréé en double</b> : « dev web » devenait une compétence séparée de « Développement web ». La résolution se fait maintenant en trois passes ordonnées — slug canonique, alias connu, création.</li>
  </ul>

  <h2 id="cv">La lecture de CV</h2>
  <p class="note">Le détail, l'audit sur huit CV réels et le banc d'essai sont sur la page <a href="extraction.php">Lecture de CV</a>.</p>
  <p>Elle vit entièrement côté client, et c'est un choix de conception, pas une facilité : le CV ne quitte jamais l'appareil. Deux étapes, et aucun modèle de langage — ce qui n'est pas trouvé reste vide.</p>
  <ol class="steps">
    <li><b>Le texte avec sa mise en page.</b> La gouttière entre colonnes est cherchée là où le moins de fragments la traversent, pas au milieu de la page : la colonne de droite d'un CV commence rarement à 50&nbsp;%. Sans ça, un CV sur deux colonnes s'entrelace et tout le reste devient faux.</li>
    <li><b>Les rubriques donnent le sens.</b> « EXPÉRIENCE », « SCOLARITÉ » : suivre les titres est bien plus fiable que de deviner ligne par ligne. Hors rubrique, une date isolée est ignorée — « prix Pépites 2024 » n'est ni un emploi ni un diplôme.</li>
  </ol>
  <p class="note">Deux règles qui viennent d'erreurs réelles : <b>on n'invente jamais de mois</b> (une année seule reste une année, pas « janvier 2019 »), et <b>aucune date n'est conservée sur une formation</b> (l'année d'obtention révèle l'âge). L'extraction ne remplit rien toute seule : elle propose, avec l'extrait du CV d'où vient chaque information, et l'utilisateur décoche ce qui est faux.</p>

  <h2 id="pieges">Deux pièges de mise en production</h2>
  <ul>
    <li><b>Le serveur ne connaît pas <code>.mjs</code></b> et le sert en <code>text/plain</code>. Un module chargé avec ce type est refusé par le navigateur, sans message exploitable : le lecteur de PDF marchait en local et pas en ligne. Un <code>.htaccess</code> d'une ligne dans <code>/avp/beta/</code> le corrige.</li>
    <li><b><code>iconv('//TRANSLIT')</code> dépend de la bibliothèque C du serveur.</b> « Développement web » y devenait la clé <code>d-veloppement-web</code> : une compétence fantôme, distincte de la vraie. Le référentiel se serait fragmenté en silence, et le score avec. Toute normalisation de texte passe désormais par une table de translittération explicite.</li>
  </ul>

  <h2 id="reste">Ce qui n'est pas fait</h2>
  <ul>
    <li>Le <b>fichier</b> du CV n'est pas stocké. La lecture se fait dans l'appareil, avec pdf.js empaqueté dans l'application — pas chargé d'un CDN, pour que ça marche hors ligne et sans dépendre d'une politique de sécurité de contenu. Seuls les métadonnées et le résultat de l'extraction remontent, pour pouvoir retraiter plus tard. Stocker le fichier demandera un stockage objet et des liens signés de courte durée, jamais un accès direct.</li>
    <li>Le <b>côté recruteur</b> existe dans l'API mais pas encore dans <a href="beta.php">la bêta</a> : création d'offre, deck des candidats, réponse aux matchs.</li>
    <li>Plusieurs <b>champs d'offre</b> que le prototype affiche n'existent pas en base : horaires, avantages, processus de recrutement, nombre de vues, ville et distance. Les ajouter demande une migration, un formulaire de dépôt côté entreprise, et une table à part pour les vues.</li>
    <li>Les <b>notifications</b> sont en base mais ne sont pas encore poussées. C'est l'une des raisons d'empaqueter avec Capacitor : le web les gère mal sur iOS.</li>
    <li>L'<b>empaquetage</b> lui-même. La bêta est déjà statique et installable, donc rien ne s'y oppose techniquement.</li>
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

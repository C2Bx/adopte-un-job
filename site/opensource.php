<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open source — Adopte un Job</title>
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
      <a href="opensource.php" aria-current="page"><b>Open source</b><span>Audit de l'existant</span></a>
      <a href="equipe.php"><b>Équipe</b><span>Neuf sièges, planning</span></a>
      <a href="arbitrages.php"><b>Arbitrages</b><span>Contre-expertise</span></a>
      <a href="questions.php"><b>Questions</b><span>À trancher</span></a>
      <a href="prompt.php"><b>Prompt LLM</b><span>Le texte à envoyer</span></a>
  </div>
  <p class="sidenote">Wiki interne du projet. Chaque page évolue à mesure que les décisions sont prises.</p>
</nav>

<div class="page">
<main class="col">

  <div class="eyebrow">05 — Audit</div>
  <h1 class="title">Ce qu'on ne réécrit pas</h1>
  <p class="chapo">Une bonne partie de ce projet a déjà été résolue par d'autres. L'enjeu n'est pas de tout prendre, mais de savoir précisément où l'existant nous fait gagner des semaines et où il nous coûterait plus cher que de l'écrire.</p>

  <div class="note">
    <p><b>Avertissement sur les licences.</b> Les licences indiquées sont celles connues au moment d'écrire, et plusieurs de ces projets en ont déjà changé. <b>Vérifiez la licence au moment d'intégrer</b>, pas au moment de lire. Deux pièges classiques : une licence de type AGPL contamine ce qu'on distribue, et certaines bibliothèques Python très courantes sont en double licence libre ou commerciale.</p>
  </div>

  <h2 id="format">Format de CV</h2>
  <p>C'est le gain le plus évident du projet : le format qu'on allait inventer existe déjà, avec des outils autour.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Projet</th><th>Ce que ça apporte</th><th>Verdict</th></tr></thead>
    <tbody>
      <tr>
        <td><b>JSON Resume</b><br><span class="badge">schéma ouvert</span></td>
        <td>Le schéma <code>resume.json</code>, ses validateurs, et un écosystème de thèmes qui transforment un JSON en CV présentable. Son usage habituel passe par un gist — exactement l'idée de départ.</td>
        <td><span class="badge ok">Adopter</span><br>base du format</td>
      </tr>
      <tr>
        <td><b>Reactive Resume</b></td>
        <td>Éditeur de CV complet et auto-hébergeable. Trop gros pour être intégré, mais c'est la meilleure référence d'ergonomie pour notre formulaire.</td>
        <td><span class="badge">Étudier</span><br>source d'inspiration</td>
      </tr>
      <tr>
        <td><b>OpenResume</b></td>
        <td>Éditeur de CV <em>et</em> analyseur de CV fonctionnant dans le navigateur. Sa partie analyse montre comment reconstituer des sections à partir de la position du texte.</td>
        <td><span class="badge">Étudier</span><br>lire le code de l'analyseur</td>
      </tr>
    </tbody>
  </table></div>

  <h2 id="pdf">Lecture des documents</h2>

  <div class="tablewrap"><table>
    <thead><tr><th>Projet</th><th>Ce que ça apporte</th><th>Verdict</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Docling</b></td>
        <td>Convertit un PDF en structure exploitable : titres, sections, tableaux, ordre de lecture. C'est précisément l'outil qui règle le CV sur deux colonnes.</td>
        <td><span class="badge ok">Adopter</span><br>premier essai</td>
      </tr>
      <tr>
        <td><b>Unstructured</b></td>
        <td>Même famille, très large couverture de formats (PDF, Word, images). Bonne solution de repli.</td>
        <td><span class="badge">Évaluer</span></td>
      </tr>
      <tr>
        <td><b>pdfplumber</b></td>
        <td>Extraction de texte avec les coordonnées de chaque mot. Léger, prévisible, sans surprise de licence.</td>
        <td><span class="badge ok">Adopter</span><br>socle simple</td>
      </tr>
      <tr>
        <td><b>PyMuPDF</b></td>
        <td>La plus rapide et la plus complète des bibliothèques PDF Python.</td>
        <td><span class="badge no">Attention</span><br>licence contaminante ou commerciale</td>
      </tr>
      <tr>
        <td><b>Tesseract</b> (tesseract.js), <b>PaddleOCR</b>, <b>docTR</b></td>
        <td>Reconnaissance de texte pour les CV scannés ou photographiés. Tesseract tourne en WebAssembly dans le navigateur, donc sans que le document sorte ; les deux autres sont meilleurs sur les mises en page complexes mais demandent un serveur.</td>
        <td><span class="badge ok">Adopté</span><br>tesseract.js 6, auto-hébergé, Apache 2.0 — voir <a href="extraction.php#ocr">la lecture de CV</a></td>
      </tr>
    </tbody>
  </table></div>

  <h2 id="referentiels">Référentiels métiers et compétences</h2>
  <p>Ne jamais écrire cette liste à la main : elle sera fausse en deux semaines, et c'est elle qui rend la reconversion calculable.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Source</th><th>Ce que ça apporte</th><th>Verdict</th></tr></thead>
    <tbody>
      <tr>
        <td><b>ESCO</b><br><span class="badge">Union européenne</span></td>
        <td>Environ 3 000 métiers et 14 000 compétences, en 27 langues, avec les libellés alternatifs et les liens métier ↔ compétence. Téléchargeable en entier.</td>
        <td><span class="badge no">Reporté en v2</span><br>ROME seul suffit en français</td>
      </tr>
      <tr>
        <td><b>ROME 4.0</b><br><span class="badge">France Travail</span></td>
        <td>Référentiel français des métiers, avec les compétences associées et les <b>proximités entre métiers</b>. C'est la donnée qui permet de dire « depuis ce métier, ces métiers-là sont accessibles ».</td>
        <td><span class="badge ok">Adopter</span><br>moteur des passerelles</td>
      </tr>
      <tr>
        <td><b>Lightcast Open Skills</b></td>
        <td>Grande taxonomie de compétences, orientée marché du travail, avec des synonymes riches — surtout en anglais.</td>
        <td><span class="badge">Évaluer</span><br>complément technique</td>
      </tr>
      <tr>
        <td><b>O*NET</b><br><span class="badge">États-Unis</span></td>
        <td>Très riche sur les aptitudes et les tâches, mais anglophone et calibré sur un autre marché du travail.</td>
        <td><span class="badge no">Écarter</span><br>hors périmètre</td>
      </tr>
    </tbody>
  </table></div>

  <div class="note">
    <p><b>Le plan concret, revu :</b> <b>ROME seul</b> pour les métiers, leurs compétences et leurs passerelles, plus une table d'alias maison alimentée par ce que les utilisateurs saisissent. ESCO passe en version 2 : deux référentiels créent plus de problèmes d'alignement qu'ils n'apportent de valeur sur un marché francophone.</p>
    <p style="margin-bottom:0">Une réserve à vérifier avant de bâtir dessus : les passerelles entre métiers de ROME sont des proximités théoriques. Elles ne disent pas qu'une personne est employable immédiatement, et il faudra sans doute les retravailler.</p>
  </div>

  <h2 id="normalisation">Normalisation et similarité</h2>

  <div class="tablewrap"><table>
    <thead><tr><th>Projet</th><th>Ce que ça apporte</th><th>Verdict</th></tr></thead>
    <tbody>
      <tr><td><b>RapidFuzz</b></td><td>Comparaison approximative de chaînes, très rapide. La passe 3 de notre normalisation, en quelques lignes.</td><td><span class="badge ok">Adopter</span></td></tr>
      <tr><td><b>sentence-transformers</b></td><td>Plongements multilingues exécutables en local. Séduisant, mais un plongement ne sait pas gérer une contrainte dure : il rapprochera « permis B » et « permis poids lourd ».</td><td><span class="badge no">Écarté en v1</span></td></tr>
      <tr><td><b>pgvector</b></td><td>Stockerait ces vecteurs dans PostgreSQL. Aucun usage de la version 1 ne l'exige.</td><td><span class="badge no">Écarté en v1</span></td></tr>
      <tr><td><b>spaCy</b></td><td>Découpage, lemmatisation, entités nommées en français. Utile au nettoyage avant normalisation.</td><td><span class="badge">Évaluer</span></td></tr>
      <tr><td><b>SkillNER</b></td><td>Extraction de compétences depuis du texte libre, adossée à une taxonomie.</td><td><span class="badge">Évaluer</span><br>vérifier l'activité du projet</td></tr>
    </tbody>
  </table></div>

  <h2 id="interface">Formulaire et swipe</h2>

  <div class="tablewrap"><table>
    <thead><tr><th>Projet</th><th>Ce que ça apporte</th><th>Verdict</th></tr></thead>
    <tbody>
      <tr>
        <td><b>react-jsonschema-form</b></td>
        <td>Génère un formulaire complet à partir d'un schéma JSON. C'est ce qui rend notre « couche 3 par secteur » réalisable sans écrire un formulaire par métier.</td>
        <td><span class="badge no">Écarté</span><br>le formulaire est écrit en dur en v1</td>
      </tr>
      <tr>
        <td><b>Zod</b> + <b>react-hook-form</b></td>
        <td>Validation et gestion d'état de formulaire côté application, avec des messages d'erreur exploitables.</td>
        <td><span class="badge ok">Adopter</span></td>
      </tr>
      <tr>
        <td><b>react-native-reanimated</b> + <b>gesture-handler</b></td>
        <td>Le socle réel des animations et des gestes. Tout composant de swipe correct est construit dessus.</td>
        <td><span class="badge ok">Adopter</span></td>
      </tr>
      <tr>
        <td>Composants de deck<br>(<b>react-tinder-card</b> et équivalents)</td>
        <td>Pile de cartes prête à l'emploi. Fait gagner deux jours, mais s'adapte mal dès qu'on veut un comportement précis.</td>
        <td><span class="badge">Évaluer</span><br>partir de là, prévoir de s'en séparer</td>
      </tr>
    </tbody>
  </table></div>

  <h2 id="assistant">Assistance à la rédaction</h2>

  <div class="tablewrap"><table>
    <thead><tr><th>Projet</th><th>Ce que ça apporte</th><th>Verdict</th></tr></thead>
    <tbody>
      <tr>
        <td><b>LanguageTool</b></td>
        <td>Correcteur orthographique et grammatical français, auto-hébergeable, appelable en HTTP. Couvre gratuitement le niveau 3 de l'assistant, sans jamais appeler un modèle payant.</td>
        <td><span class="badge ok">Adopter</span><br>gain immédiat</td>
      </tr>
      <tr>
        <td><b>Grammalecte</b></td>
        <td>Correcteur français exigeant, très bon sur les accords.</td>
        <td><span class="badge">Évaluer</span><br>alternative</td>
      </tr>
      <tr>
        <td><b>Presidio</b></td>
        <td>Détecte et masque les données personnelles dans un texte : téléphone, e-mail, adresse, identifiants. Exactement ce qu'il faut pour pseudonymiser un CV avant match, et pour repérer les données sensibles qui traînent.</td>
        <td><span class="badge ok">Adopter</span><br>double usage</td>
      </tr>
    </tbody>
  </table></div>

  <h2 id="chat">Conversation — faut-il brancher Mattermost ?</h2>
  <p>La question mérite d'être posée sérieusement, parce que la réponse intuitive est fausse.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Solution</th><th>Le pour</th><th>Le contre</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Mattermost</b></td>
        <td>Serveur complet, API et temps réel documentés, canaux, pièces jointes, applications mobiles existantes.</td>
        <td>Il faut <b>créer un compte Mattermost pour chaque candidat et chaque recruteur</b>, gérer leur cycle de vie, et intégrer une interface pensée pour des équipes, pas pour deux inconnus. Serveur et base supplémentaires à exploiter.</td>
      </tr>
      <tr>
        <td><b>Rocket.Chat</b></td>
        <td>Même famille, intégration web plus souple.</td>
        <td>Même problème de comptes, même poids d'exploitation.</td>
      </tr>
      <tr>
        <td><b>Matrix / Synapse</b></td>
        <td>Protocole ouvert, fédéré, très propre conceptuellement.</td>
        <td>Le plus lourd des trois à exploiter, et sa licence demande une vraie lecture avant de construire dessus.</td>
      </tr>
      <tr>
        <td><b>Un fil écrit par nous</b><br><span class="badge ok">recommandé</span></td>
        <td>Deux tables, une connexion temps réel, un écran. Les comptes existent déjà, les droits aussi, l'interface reste cohérente avec le reste. Compter deux à trois jours.</td>
        <td>Pas de pièces jointes ni de recherche sans travail supplémentaire — dont on n'a pas besoin en version 1.</td>
      </tr>
    </tbody>
  </table></div>

  <div class="note">
    <p><b>Le point à retenir :</b> dans un chat, le coût n'est pas l'affichage des messages, c'est la <b>gestion des comptes et des droits</b>. Or nous les avons déjà. Brancher un serveur externe reviendrait à maintenir un deuxième annuaire d'utilisateurs pour afficher des bulles de texte.</p>
  </div>

  <h2 id="reste">Rendez-vous, comptes, génération de PDF</h2>

  <div class="tablewrap"><table>
    <thead><tr><th>Besoin</th><th>Projets</th><th>Verdict</th></tr></thead>
    <tbody>
      <tr>
        <td>Créneaux et rendez-vous</td>
        <td><b>Cal.com</b> — gestion complète de disponibilités et de réservation, auto-hébergeable.</td>
        <td><span class="badge">Évaluer</span><br>puissant, mais licence contaminante et intégration lourde pour un besoin de deux écrans</td>
      </tr>
      <tr>
        <td>Comptes et connexion</td>
        <td><b>fastapi-users</b> pour rester léger ; <b>Keycloak</b> ou <b>Authentik</b> si on veut un vrai serveur d'identité.</td>
        <td><span class="badge ok">Adopter</span><br>la bibliothèque légère suffit</td>
      </tr>
      <tr>
        <td>CV en PDF</td>
        <td><b>Thèmes JSON Resume</b> pour le rendu, <b>WeasyPrint</b> ou <b>Typst</b> pour la sortie imprimable.</td>
        <td><span class="badge ok">Adopter</span><br>évite d'écrire une mise en page</td>
      </tr>
      <tr>
        <td>Recherche et filtres</td>
        <td><b>Meilisearch</b> (léger, permissif) ou <b>Typesense</b> (excellent, licence à vérifier).</td>
        <td><span class="badge">Plus tard</span><br>PostgreSQL suffit largement à cette échelle</td>
      </tr>
      <tr>
        <td>Suivi du projet</td>
        <td>Les tickets et le tableau de votre forge, ou <b>Vikunja</b> / <b>Plane</b> en auto-hébergé.</td>
        <td><span class="badge ok">Adopter</span><br>les tickets de la forge, rien de plus</td>
      </tr>
    </tbody>
  </table></div>

  <h2 id="gain">Ce que ça change concrètement</h2>
  <p>En reprenant ce qui existe plutôt qu'en l'écrivant, on évite à peu près ceci :</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Ce qu'on n'écrit pas</th><th class="num">Économie estimée</th></tr></thead>
    <tbody>
      <tr><td>Le schéma de CV et ses validateurs</td><td class="num">4 j</td></tr>
      <tr><td>La lecture de PDF multi-colonnes</td><td class="num">7 j</td></tr>
      <tr><td>Le référentiel métiers, compétences et passerelles</td><td class="num">15 j</td></tr>
      <tr><td>Le correcteur orthographique et grammatical</td><td class="num">8 j</td></tr>
      <tr><td>La détection de données personnelles</td><td class="num">5 j</td></tr>
      <tr><td>Le rendu et l'export PDF du CV</td><td class="num">5 j</td></tr>
      <tr><td>Les gestes et animations du deck</td><td class="num">4 j</td></tr>
      <tr><td>Le rendu et l'export du CV depuis le JSON</td><td class="num">4 j</td></tr>
    </tbody>
    <tfoot><tr><th>Total</th><th class="num">≈ 48 jours-homme</th></tr></tfoot>
  </table></div>

  <p>Estimation revue à la baisse après la coupe du périmètre — on ne compte plus ce qu'on ne construit pas. L'ordre de grandeur reste : environ un quart du projet. En échange, il faut accepter d'apprendre ces outils plutôt que d'écrire du code — ce qui est un travail réel, à mettre au planning du sprint 0.</p>

  <div class="callout">
    <h3 style="margin-top:0">La règle qu'on se donne</h3>
    <p style="margin-bottom:0">On reprend une brique existante quand elle résout un problème <strong>que personne dans l'équipe n'a envie de résoudre deux fois</strong> — lire un PDF, corriger une faute, construire une taxonomie. On l'écrit nous-mêmes quand elle porte <strong>ce qui fait le produit</strong> : le score, l'explication, la carte, la reconversion. Ces quatre-là ne se sous-traitent pas.</p>
  </div>

  <div class="nextprev">
    <a href="techno.php"><span>Précédent</span><b>← Techno</b></a>
    <a href="equipe.php"><span>Suivant</span><b>Équipe →</b></a>
  </div>

</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

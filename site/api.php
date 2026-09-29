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
      <a href="../app/index.php"><b>App mobile</b><span>Écran principal, PWA</span></a>
      <a href="design.php"><b>Design</b><span>Direction et règles</span></a>
      <a href="produit.php"><b>Produit</b><span>Vision et parcours</span></a>
      <a href="profil.php"><b>Profil &amp; CV</b><span>Pôle 1</span></a>
      <a href="matching.php"><b>Swipe &amp; matching</b><span>Pôles 2 et 3</span></a>
      <a href="techno.php"><b>Techno</b><span>Web, mobile, données</span></a>
      <a href="beta.php"><b>L’application</b><span>En ligne, réelle</span></a>
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
  <p class="chapo">Une API REST en PHP, une base MySQL, deux rôles. Tout ce que l'application fait, elle le fait par cette API — et n'importe qui d'autre peut le faire aussi, avec une clé. Cette page dit ce qui existe au 21 septembre, et pourquoi chaque choix a été fait plutôt qu'un autre.</p>

  <h2 id="ou">Où ça tourne</h2>
  <dl class="kv">
    <dt>Application</dt><dd><a href="../">zako.nc/avp/</a> — React 19 + TypeScript, construit par Vite, servi en fichiers statiques.</dd>
    <dt>API</dt><dd><code>zako.nc/avp/app/api/index.php/&lt;route&gt;</code> — PHP 8, un point d'entrée, un fichier par domaine. Documentation vivante : <a href="app/api/index.php?r=openapi.json">openapi.json</a> (OpenAPI 3.1).</dd>
    <dt>Base</dt><dd>MySQL 8.4 sur un hébergement mutualisé, 41 tables. Les secrets vivent hors du code et hors du docroot.</dd>
    <dt>Données</dt><dd>Les <b>AVP réels de l'OPT-NC</b>, par <a href="#sources">deux sources interchangeables</a> : l'API du microservice de l'équipe, et le dataset public (<a href="https://huggingface.co/datasets/opt-nc/odata-avps">opt-nc/odata-avps</a>, schema.org JobPosting) en secours. Synchronisation toutes les six heures. Plus le référentiel officiel des métiers : 12 familles, 84 métiers, 409 compétences, 1 988 liens pondérés.</dd>
    <dt>Prototype</dt><dd><a href="../app/index.php">zako.nc/avp/app/</a> — conservé tel quel, en <code>localStorage</code>, comme démonstration sans compte.</dd>
  </dl>

  <h2 id="roles">Un seul côté : le candidat</h2>
  <p>Un compte est un candidat, et il n'y en a pas d'autre sorte. L'employeur, c'est l'OPT-NC : il publie ses AVP dans son propre système et reçoit les candidatures par le contact indiqué sur l'avis. Lui demander d'ouvrir un compte ici pour trier des candidatures qu'il reçoit déjà ailleurs aurait été une promesse que personne n'aurait tenue.</p>
  <p class="note">Les tables de l'employeur (<code>companies</code>, <code>matches</code>, <code>messages</code>, <code>entretiens</code>) restent dans le schéma : la première porte l'organisation émettrice de chaque AVP, les autres gardent l'historique. Elles ne sont plus écrites par aucune route.</p>

  <h2 id="schema">Le schéma, et ce qu'il refuse de stocker</h2>
  <ol class="steps">
    <li><b>Ce qui est interdit au score n'est pas stocké.</b> Ni date de naissance, ni photo, ni adresse. La table <code>candidate_educations</code> n'a <b>aucune colonne de date</b> : l'année d'obtention d'un diplôme révèle l'âge, critère de discrimination interdit. Le niveau suffit à comparer.</li>
    <li><b>Le masquage avant présélection est une règle serveur.</b> Prénom, nom, e-mail, téléphone et dossier vivent en base mais ne sortent de l'API qu'à la présélection. Masquer dans l'interface serait une faille : il suffit d'ouvrir les outils de développement.</li>
    <li><b>Le fichier de CV est chiffré.</b> AES-256-GCM, clé dans l'environnement, un vecteur et une étiquette par fichier, stockage hors du docroot. Une fuite du disque ne livre rien ; une fuite de la base non plus.</li>
    <li><b>Les tables de conformité existent depuis le premier jour.</b> <code>consents</code> trace le consentement et sa version ; <code>audit_logs</code> enregistre qui a consulté quelle donnée personnelle, avec une empreinte salée de l'adresse plutôt que l'adresse.</li>
  </ol>

  <div class="tablewrap">
  <table>
    <thead><tr><th>Famille</th><th>Tables</th><th>Ce qu'elle porte</th></tr></thead>
    <tbody>
      <tr><td>Comptes</td><td><code>users</code>, <code>sessions</code>, <code>api_keys</code>, <code>rate_limits</code></td><td>La session seule. <code>users</code> ne porte plus de mot de passe depuis le 29/09 : il est chez l'équipe. Sessions opaques renouvelées à la connexion ; clés d'API à secret haché ; compteurs de débit par route.</td></tr>
      <tr><td>Organisations</td><td><code>companies</code>, <code>company_members</code></td><td>L'organisation émettrice d'un AVP — l'OPT-NC, créée par la synchronisation. Plus aucun compte n'y est rattaché.</td></tr>
      <tr><td>Référentiel OPT-NC</td><td><code>opt_familles</code>, <code>opt_metiers</code>, <code>opt_competences</code>, <code>opt_metier_competences</code>, <code>opt_niveaux</code>, <code>opt_competence_alias</code></td><td>Le référentiel officiel, chargé depuis sa release SQLite. <code>opt_metier_competences</code> porte le poids et le niveau requis : c'est ce qui rend le score structurel calculable.</td></tr>
      <tr><td>Candidats</td><td><code>candidates</code> + 9 tables de liaison dont <code>candidate_opt_metiers</code>, <code>candidate_opt_competences</code></td><td>Zones, contrats, métiers visés (maison et OPT), compétences (libres et rattachées au référentiel, avec la source du rattachement), langues, expériences, formations.</td></tr>
      <tr><td>Documents</td><td><code>resumes</code>, <code>resume_extractions</code></td><td>Le fichier chiffré et sa lecture : ce que le moteur a lu (<code>payload</code>) et ce que l'utilisateur a gardé (<code>accepted</code>) — la mesure de qualité du moteur.</td></tr>
      <tr><td>Offres</td><td><code>jobs</code>, <code>job_skills</code>, <code>job_languages</code>, <code>job_views</code></td><td>Les AVP avec leur identité OPT (référence, code métier, code ROME, direction, familles, ville, province, type d'emploi, texte de recherche plein texte, JSON d'origine) et les offres publiées dans l'application. Les vues sont comptées une fois par personne, par offre et par jour.</td></tr>
      <tr><td>Candidatures</td><td><code>applications</code>, <code>application_events</code>, <code>swipes</code>, <code>match_scores</code>, <code>matches</code>, <code>messages</code>, <code>entretiens</code>, <code>notifications</code>, <code>email_queue</code></td><td>Une candidature et son histoire (qui a fait quoi, quand), la photographie du score au moment du geste, et les e-mails en file (jamais envoyés pour l'instant). Les trois dernières tables gardent l'historique du côté employeur, qui n'est plus écrit.</td></tr>
      <tr><td>Conformité</td><td><code>consents</code>, <code>audit_logs</code></td><td>Consentement daté et versionné ; journal des accès aux données personnelles.</td></tr>
    </tbody>
  </table>
  </div>

  <h2 id="score">Le score est calculé par le serveur, et nulle part ailleurs</h2>
  <p>Le moteur vit dans <code>api/score.php</code>, version <code>v2</code>. Un score calculé dans le navigateur se modifie dans le navigateur.</p>
  <ul>
    <li><b>Deux regards, jamais moyennés.</b> Ce que l'employeur regarde (compétences, expérience, formation, disponibilité) et ce que le candidat regarde (métier visé, contrat, salaire, conditions). La compatibilité est le <b>minimum</b> des deux.</li>
    <li><b>Les compétences combinent trois signaux.</b> Le <b>référentiel OPT</b> pondéré via le code métier de l'AVP (ce que ce métier attend, officiellement), le <b>lexique de l'AVP</b> lui-même (les mots porteurs de ses phrases, face aux mots du candidat), et les compétences explicites de l'offre quand il y en a. Un candidat qui n'a pas rattaché ses compétences au référentiel n'est pas pénalisé : la couverture lexicale prend le relais.</li>
    <li><b>Rien n'élimine.</b> Un contrat, une zone, un télétravail qui ne collent pas sont des <b>écarts</b> : chacun retire 20 %, plancher 30 %, et l'écran les nomme. N'importe quel profil peut candidater à n'importe quel poste ; l'employeur décide avec le score et les écarts sous les yeux.</li>
    <li><b>La confiance est séparée du score.</b> 80 % sur trois critères renseignés ne vaut pas 80 % sur dix, et l'écran le dit.</li>
    <li><b>Inconnu n'est pas non.</b> Un critère non renseigné sort du calcul et le poids restant est renormalisé.</li>
    <li>Avec une clé OPT-NC, la recherche sémantique officielle (<code>POST /avps/search</code>) ajoute un signal ; sans, rien ne manque au calcul. Le cache (<code>match_scores</code>) est invalidé dès qu'un profil ou un AVP change ; la <b>photographie du score au moment de la candidature</b> est conservée à part.</li>
  </ul>

  <h2 id="routes">Les routes</h2>
  <p>Toutes en JSON, deux formes d'URL (<code>index.php/route</code> ou <code>?r=route</code>), trois façons de s'authentifier : cookie <code>HttpOnly</code> pour le navigateur, <code>Bearer</code> pour l'application native, clé <code>aj_…</code> pour une intégration. Le détail — paramètres, réponses, codes — est dans <a href="app/api/index.php?r=openapi.json">openapi.json</a>. Voici la carte.</p>
  <div class="tablewrap">
  <table>
    <thead><tr><th>Domaine</th><th>Routes</th><th>Ce qu'elles font</th></tr></thead>
    <tbody>
      <tr><td>Compte</td><td><code>auth/inscription</code> · <code>auth/connexion</code> · <code>auth/moi</code> · <code>auth/sessions</code> · <code>auth/export</code> · <code>DELETE auth/compte</code> · <code>cles</code></td><td><b>Les identifiants sont vérifiés par l'API de l'équipe</b> (<code>/auth/register</code>, <code>/auth/login</code>) : rien n'est haché ni conservé ici. Restent à nous la session (rotation à la connexion, empreinte du navigateur), les limites de débit, l'export et l'anonymisation. Changement et réinitialisation de mot de passe n'existent plus : leur API ne les expose pas.</td></tr>
      <tr><td>Référentiel</td><td><code>referentiels</code> · <code>metiers</code> · <code>metiers/{code}</code> · <code>competences?q=</code></td><td>Les 84 métiers par famille avec le nombre d'AVP ouverts, les compétences attendues d'un métier avec leur poids, la recherche dans les 409.</td></tr>
      <tr><td>Profil et CV</td><td><code>profil</code> · <code>profil/cv</code> · <code>profil/cv/fichier</code> · <code>profil/cv/{id}</code> · <code>profil/cv.pdf</code> · <code>profil/jsonresume</code></td><td>Le profil, avec le rattachement automatique des compétences libres au référentiel. La lecture faite dans l'appareil est journalisée ; le fichier est déposé à part (multipart, 10 Mo, type lu dans les octets), chiffré. Le CV généré depuis le profil, et <b>le profil en JSON Resume</b> — le CV en résumé JSON, première des API utilitaires demandées.</td></tr>
      <tr><td>AVP</td><td><code>avp</code> · <code>avp/filtres</code> · <code>avp/{id}</code> · <code>avp/{id}/vue</code> · <code>admin/sync/avp</code></td><td>Le catalogue public avec recherche plein texte et <b>les mêmes filtres que la recherche de l'OPT</b> (ville, province, famille, direction, contrat, encadrement, télétravail, débutant), les facettes avec leur compte, la synchronisation par jeton.</td></tr>
      <tr><td>Deck et candidatures</td><td><code>deck</code> · <code>swipes</code> · <code>interets</code> · <code>candidatures</code> · <code>candidatures/{id}/statut</code> · <code>candidatures/{id}/cv.pdf</code> · <code>candidatures/{id}/cv-original</code></td><td>Le deck scoré, avec les mêmes filtres et un mode « offres closes » pour s'entraîner. <b>Un oui est une candidature.</b> On suit son état, on télécharge son dossier — CV recentré sur le poste et fichier d'origine — et on peut la retirer. Les états suivants viennent de l'employeur, hors de l'application.</td></tr>
    </tbody>
  </table>
  </div>

  <div class="callout">
    <p style="margin-bottom:0"><b>Le jeton est triplé, volontairement.</b> Cookie <code>HttpOnly</code> pour le navigateur, en-tête <code>Authorization: Bearer</code> pour l'application empaquetée, clé d'API révocable pour un tableur, un robot ou un partenaire. Les trois passent par le même code serveur, donc les mêmes contrôles.</p>
  </div>

  <h2 id="sources">Deux sources pour les mêmes AVP</h2>
  <p>Le hackathon découpe le produit en microservices : une autre équipe publie les AVP de l'OPT-NC derrière sa propre API. La consommer, c'est faire marcher la chaîne prévue — et c'est ce que la grille appelle l'intégrabilité.</p>
  <p>Plutôt que d'écrire une seconde correspondance champ à champ, un <b>adaptateur</b> reconstruit la structure <code>schema.org/JobPosting</code> que l'import sait déjà lire. Il n'y a donc qu'un seul chemin d'import, et surtout <b>une seule clé de déduplication</b> : la référence de l'AVP, identique des deux côtés.</p>

  <div class="tablewrap"><table>
    <thead><tr><th><code>POST admin/sync/avp</code></th><th>Ce qu'elle lit</th></tr></thead>
    <tbody>
      <tr><td><code>{"source":"equipe"}</code></td><td>L'API du microservice AVP de l'équipe</td></tr>
      <tr><td><code>{"source":"dataset"}</code></td><td>Le dataset public Hugging Face, sans clé</td></tr>
      <tr><td><code>{}</code> (défaut)</td><td>L'équipe d'abord, le dataset en secours si elle ne répond pas</td></tr>
    </tbody>
  </table></div>

  <p class="note">Le secours n'est pas de la coquetterie : une API de camarade peut être arrêtée le jour du jury, et un deck vide ne s'explique pas. Preuve que la déduplication tient : la première synchronisation depuis l'API de l'équipe a rendu <code>{"lus":24,"crees":0,"mis_a_jour":24}</code> — les mêmes AVP, reconnus, pas redoublés.</p>

  <p>La synchronisation elle-même est rejouée <b>toutes les six heures par GitHub Actions</b> plutôt que par une tâche sur le serveur : rien à maintenir, elle survit à un poste éteint, et chaque exécution est lisible par toute l'équipe. Sans rappel régulier le deck se fige — le dataset comptait 21 AVP ouverts quand la production en servait encore 19.</p>

  <h2 id="securite">La sécurité, point par point</h2>
  <p>L'audit du 14 septembre listait treize manques. Tous sont traités au 21 :</p>
  <ul>
    <li><b>Limites de débit</b> par route (connexion, inscription, réinitialisation, dépôt de fichier, messages, synchronisation) et globale (240 requêtes par minute et par adresse), en base, avec <code>Retry-After</code>.</li>
    <li><b>Vérification d'origine</b> (<code>Origin</code>, <code>Sec-Fetch-Site</code>) sur toute écriture ; liste blanche CORS, y compris <code>capacitor://localhost</code> pour le natif.</li>
    <li><b>En-têtes de sécurité</b> sur chaque réponse : <code>X-Content-Type-Options</code>, <code>X-Frame-Options</code>, <code>Referrer-Policy</code>, <code>Permissions-Policy</code>, CSP, <code>Cache-Control: no-store</code>.</li>
    <li><b>Secrets hors du code et hors du docroot</b> ; le <code>config.php</code> de production ne contient aucune valeur.</li>
    <li><b>Rotation de session</b> à la connexion, empreinte du navigateur vérifiée.</li>
    <li><b>Fichiers chiffrés</b>, type lu dans les octets, taille bornée, supprimés avec le compte. Le jeton n'est plus dans <code>localStorage</code> côté navigateur (mémoire seulement ; <code>localStorage</code> sous Capacitor, faute de cookie).</li>
    <li><b>Corps borné</b> à 1 Mo pour le JSON, 10 Mo pour un fichier ; requêtes préparées partout ; contrôle d'appartenance sur chaque identifiant.</li>
  </ul>
  <p>Ce qui reste, par ordre d'importance : l'envoi d'e-mails (file prête, fournisseur à choisir) ; deux utilisateurs MySQL (lecture-écriture et DDL) ; la clé OPT-NC ; une limite de débit par compte en plus de l'adresse ; un journal applicatif centralisé.</p>

  <h2 id="recette">La recette, et ce qu'elle a trouvé</h2>
  <p>Un script rejoue le parcours complet — catalogue public, inscription, profil et rattachement OPT, deck verrouillé puis ouvert, filtres, candidature, dossier avec dépôt réel du fichier, retrait, clés, garde-fous, export, suppression — en local sans serveur web et contre la production. Puis l’application a été parcourue à la main dans un navigateur, sur la production, avec deux comptes de test supprimés à la fin.</p>
  <p>Ce que cette recette a attrapé, et que l'œil n'aurait pas vu :</p>
  <ul>
    <li><b>Une fonction au mauvais endroit.</b> Chaque fichier de domaine exécute ses routes au chargement ; <code>cvActif()</code> vivait dans un fichier chargé après celui qui l'appelait. Le dépôt de fichier tombait en 500 sur la production seulement — la recette en ligne de commande ne sait pas fabriquer un envoi multipart. Elle le fait maintenant, en HTTPS.</li>
    <li><b>Une course dans l'enregistrement du profil.</b> La réponse du serveur à une première modification écrasait la seconde, faite pendant l'attente. Deux zones cochées vite, une seule enregistrée. Corrigé en fusionnant la réponse dans l'état courant.</li>
    <li><b>Un chiffre qui s'effaçait.</b> Les compétences manquantes se lisaient dans le cache des scores, vidé à chaque synchronisation et à chaque modification de profil. Le score est maintenant photographié au moment de la candidature.</li>
        <li>Un pare-feu applicatif refuse un <code>POST</code> sans corps : la commande de synchronisation envoie <code>{}</code>.</li>
  </ul>

  <h2 id="cv">La lecture de CV</h2>
  <p class="note">Le détail, l'audit sur huit CV réels et le banc d'essai sont sur la page <a href="extraction.php">Lecture de CV</a>.</p>
  <p>Elle vit côté client, et c'est un choix de conception : le CV est lu dans l'appareil, sans modèle de langage — ce qui n'est pas trouvé reste vide, et tout est relu champ par champ. Le fichier lui-même n'est envoyé qu'ensuite, si l'utilisateur le veut, chiffré, pour accompagner le CV recentré sur le poste dans le dossier de candidature.</p>

  <h2 id="pieges">Pièges de mise en production</h2>
  <ul>
    <li><b>L'en-tête <code>Authorization</code> n'atteint pas PHP.</b> Apache le retire avant de passer la main. Une ligne de <code>.htaccess</code> (<code>SetEnvIf Authorization</code>) le corrige ; <code>CGIPassAuth</code>, la directive officielle, fait tomber le serveur en 500 ici.</li>
    <li><b>Le serveur ne connaît pas <code>.mjs</code></b> et le sert en <code>text/plain</code> : le lecteur de PDF marchait en local et pas en ligne. Un <code>.htaccess</code> d'une ligne à côté de l'application.</li>
    <li><b><code>iconv('//TRANSLIT')</code> dépend de la bibliothèque C du serveur.</b> « Développement web » y devenait <code>d-veloppement-web</code>. Table de translittération explicite.</li>
    <li><b>L'ordre des <code>require</code> compte</b> et <b>la garde du corps JSON ne doit pas voir un multipart</b> — voir la recette ci-dessus.</li>
    <li><b>Changer le chemin d'un cookie sans effacer l'ancien laisse une mine.</b> La v1 posait le cookie de session sur <code>/avp/app/</code>, la v2 sur <code>/avp/</code>. Les deux chemins couvrent les appels d'API : un navigateur qui a connu les deux versions envoie <b>deux cookies du même nom</b>, le plus spécifique en tête — et <code>$_COOKIE</code> n'en garde qu'un, le périmé. Résultat : déconnecté à chaque rechargement, avec une session parfaitement valide en base. L'API lit désormais <b>tous</b> les cookies de ce nom dans l'en-tête brut et essaie chacun ; la connexion fait expirer ceux des anciens chemins. Diagnostic par la base, pas par le raisonnement : 21 sessions vivantes pour un seul compte, une nouvelle toutes les deux minutes, aucune jamais remplacée.</li>
    <li><b>Une empreinte de navigateur trop précise déconnecte tout le monde.</b> Elle incluait les numéros de version : chaque mise à jour de Chrome fermait les sessions. Elle les ignore maintenant, et accepte encore celles ouvertes sous l'ancienne règle.</li>
    <li><b>Un serveur qui ne répond pas n'est pas une déconnexion.</b> <code>auth/moi</code> rend <code>200</code> avec <code>utilisateur: null</code> quand personne n'est connecté : une exception ne peut donc jamais vouloir dire « pas connecté ». Les confondre renvoyait à l'écran de connexion au moindre hoquet.</li>
  </ul>

  <h2 id="reste">Ce qui n'est pas fait</h2>
  <p>La référence complète est dans le dépôt : <a href="https://github.com/C2Bx/adopte-un-job/blob/main/api/README.md">api/README.md</a>.</p>
  <ul>
    <li><b>Aucun e-mail n'est envoyé.</b> Vérification, réinitialisation, notifications : tout est en file. Choisir un fournisseur et un domaine est une décision, pas un patch.</li>
    <li><b>Pas de clé OPT-NC.</b> Les AVP viennent du dataset public, à jour à chaque synchronisation ; le signal sémantique de la recherche officielle est branché mais inactif sans clé.</li>
    <li>Les <b>notifications</b> sont en base et à l'écran, pas poussées. C'est l'une des raisons d'empaqueter avec Capacitor.</li>
    <li>L'<b>empaquetage</b> lui-même. L’application est déjà statique et installable, rien ne s'y oppose.</li>
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

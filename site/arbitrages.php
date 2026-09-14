<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arbitrages — Adopte un Job</title>
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
      <a href="arbitrages.php" aria-current="page"><b>Arbitrages</b><span>Contre-expertise</span></a>
      <a href="questions.php"><b>Questions</b><span>À trancher</span></a>
      <a href="prompt.php"><b>Prompt LLM</b><span>Le texte à envoyer</span></a>
  </div>
  <p class="sidenote">Wiki interne du projet. Chaque page évolue à mesure que les décisions sont prises.</p>
</nav>

<div class="page">
<main class="col">

  <div class="eyebrow">09 — Journal de décision</div>
  <h1 class="title">Ce que la critique a changé</h1>
  <p class="chapo">Trois modèles ont relu le projet séparément. Cette page ne recopie pas leurs réponses : elle garde ce sur quoi ils tombent d'accord, écarte le reste avec un motif, et transforme le tout en décisions datées.</p>

  <div class="note">
    <p><b>Règle appliquée.</b> Un point soulevé par un seul relecteur est une préférence : on le note, on ne l'applique pas. Un point soulevé par deux ou trois devient une décision. Vingt-deux points ont convergé — c'est beaucoup, et ça veut dire que la version 0.2 avait un défaut de fond : <b>elle construisait une plateforme avant d'avoir prouvé un seul bon appariement</b>.</p>
  </div>

  <h2 id="retenu">Ce qu'on change</h2>
  <p>Douze décisions. La colonne de droite indique combien de relecteurs indépendants ont soulevé le point.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Décision</th><th>Pourquoi</th><th class="num">Voix</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Web seul, en PWA React</b><br>plus de React Native ni de stores <span class="badge warn">⚑ à valider</span></td>
        <td>Le produit n'a presque aucun besoin natif : formulaires, dépôt de fichiers, listes, tableau de bord. Le rendu web de React Native est faible exactement là où on passe le plus de temps. Un site installable gère très bien le swipe au doigt.</td>
        <td class="num">3/3</td>
      </tr>
      <tr>
        <td><b>Le recruteur ne swipe plus</b><br>liste classée + bouton « inviter » <span class="badge warn">⚑ à valider</span></td>
        <td>Le swipe suppose un deck qui ne se vide jamais. Un recruteur local épuise six cartes en quarante secondes. Et il veut comparer, pas décider une carte à la fois. Le swipe reste côté candidat, où il a du sens.</td>
        <td class="num">3/3</td>
      </tr>
      <tr>
        <td><b>Un seul secteur pilote</b><br>plus « tous métiers » <span class="badge warn">⚑ à valider</span></td>
        <td>Étaler quelques dizaines d'offres sur vingt-cinq métiers fabrique vingt-cinq micro-marchés vides. Un secteur unique rend le formulaire, la normalisation et les poids enfin cohérents.</td>
        <td class="num">3/3</td>
      </tr>
      <tr>
        <td><b>Deux scores, pas un</b><br><code>fit_candidat</code> et <code>fit_recruteur</code></td>
        <td>Le candidat demande « ce poste me convient-il ? », le recruteur « cette personne peut-elle faire le travail ? ». Ce ne sont pas les mêmes fonctions. Chacun voit la sienne ; la qualité du match est le <b>minimum</b> des deux, jamais la moyenne — une moyenne masque un désaccord total.</td>
        <td class="num">3/3</td>
      </tr>
      <tr>
        <td><b>Une confiance à côté du score</b></td>
        <td>Un 80 % calculé avec toutes les données n'est pas un 80 % calculé avec la moitié des champs vides. Une donnée absente ne coûte plus de points : on renormalise sur les critères renseignés et on affiche « confiance moyenne — 3 critères non vérifiés ».</td>
        <td class="num">3/3</td>
      </tr>
      <tr>
        <td><b>Inconnu n'est pas non</b></td>
        <td>« Permis non renseigné » et « pas de permis » étaient traités pareil. Logique à trois valeurs partout : <code>oui</code> / <code>non</code> / <code>inconnu</code>. L'inconnu passe en « point à vérifier », il n'élimine pas.</td>
        <td class="num">2/3</td>
      </tr>
      <tr>
        <td><b>Aucune offre ne disparaît en silence</b></td>
        <td>Un filtre qui fait disparaître une offre sans qu'un humain intervienne ressemble beaucoup à une décision automatisée au sens du RGPD. Les exclusions deviennent une section « hors de vos critères », visible, motivée, et le tri algorithmique peut être désactivé au profit du plus récent.</td>
        <td class="num">3/3</td>
      </tr>
      <tr>
        <td><b>Plus de moteur de formulaire par schéma</b></td>
        <td>« Ajouter un secteur devient une donnée » était faux : les poids, la normalisation et les validations restent du code de toute façon. On écrivait un moteur de formulaires au lieu d'un produit. Un seul formulaire, écrit en dur, très bien fait.</td>
        <td class="num">2/3</td>
      </tr>
      <tr>
        <td><b>Plus de quotas de reconversion</b></td>
        <td>Le 40/30/30 est un quota, pas un tri : avec deux bonnes passerelles disponibles, il remplit le deck de mauvaises. Un seul classement, les passerelles éligibles avec une pénalité, un réglage à deux positions. Et une offre s'ouvre aux reconversions <b>sur décision du recruteur</b>.</td>
        <td class="num">3/3</td>
      </tr>
      <tr>
        <td><b>Pas de base vectorielle</b></td>
        <td>Aucun usage de la version 1 ne l'exige, et un plongement ne sait pas gérer une contrainte dure : il rapprochera « permis B » et « permis poids lourd ». PostgreSQL et ses index texte suffisent.</td>
        <td class="num">3/3</td>
      </tr>
      <tr>
        <td><b>Pas d'OCR en version 1</b></td>
        <td>Qualité non bornée, une semaine de travail, du bruit ingérable en sortie. Si la page ne rend aucun texte, on bascule sur le formulaire guidé — ce qui est de toute façon le meilleur chemin.</td>
        <td class="num">2/3</td>
      </tr>
      <tr>
        <td><b>La sortie brute du modèle ne se garde plus indéfiniment</b></td>
        <td>Elle contient précisément les données que la normalisation avait décidé d'écarter. Conservation courte (30 jours), accès restreint, puis purge.</td>
        <td class="num">3/3</td>
      </tr>
    </tbody>
  </table></div>

  <h2 id="revisions">Deux décisions rouvertes, et inversées</h2>
  <p>Une décision d'arbitrage n'est pas un dogme : elle vaut tant que ses prémisses tiennent. Celles-ci sont tombées, l'une par un besoin nouveau, l'autre par un fait technique. Les deux sont datées du <b>8 septembre 2026</b>.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Ce qui avait été décidé</th><th>Ce qui a changé</th><th>Ce qu'on fait</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Pas de publication sur les magasins</b><br><span class="badge">v0.3</span></td>
        <td>La prémisse était : « publier coûterait une autre technologie ». Elle est fausse. Publier n'est pas un choix de langage mais d'emballage : <b>Capacitor</b> prend le code React existant et le pose dans un projet Xcode et un projet Android Studio, sans réécriture.</td>
        <td>Les magasins redeviennent possibles, en fin de projet et sans engagement. Le coût réel est ailleurs : compte Apple à 99&nbsp;USD/an et un Mac pour signer, 12 testeurs pendant 14 jours pour un compte Play personnel, et la règle Apple 4.2 qui refuse un simple navigateur déguisé — d'où les notifications, la caméra et la biométrie, qui sont le dossier de recevabilité autant que des fonctions.</td>
      </tr>
      <tr>
        <td><b>API en Python + FastAPI, base PostgreSQL</b><br><span class="badge">v0.3</span></td>
        <td>Le choix reposait sur un seul argument : « toute la lecture de documents vit en Python ». Il est tombé — l'extraction de CV se fait <b>dans le navigateur</b> avec pdf.js, le serveur n'a plus de PDF à lire. Restait la contrainte qui décide vraiment : le vhost mutualisé du projet sert du PHP aujourd'hui, un service Python demande un hébergement qu'on n'a pas.</td>
        <td><b>PHP 8 + MySQL 8</b>, en production. Le schéma et les contrats d'API restent portables : si le projet continue et gagne un hébergement, la réécriture en Python ne touche pas la base. Détail sur la page <a href="api.php">API &amp; base</a>.</td>
      </tr>
    </tbody>
  </table></div>

  <p class="note">La leçon vaut plus que les deux décisions : la ligne « pas de stores » et la ligne « FastAPI » étaient toutes deux justifiées par un argument unique. Une décision qui ne tient qu'à un fil doit être écrite comme telle, pour qu'on sache quoi vérifier quand on la rouvre.</p>

  <h2 id="ecarte">Ce qu'on n'applique pas</h2>
  <p>Quatre conseils sont écartés. Trois parce qu'un seul relecteur les portait, un parce qu'il repose sur un argument faux.</p>

  <ol class="steps">
    <li><b>« Branchez un service de messagerie managé plutôt que de l'écrire »</b> — écarté. Les deux autres relecteurs disent l'inverse : réduire la messagerie, pas la sous-traiter. Un fil de texte par match, en interrogation périodique toutes les cinq secondes, sans présence ni accusé de lecture, est indiscernable d'un vrai temps réel en démonstration. Brancher un serveur externe imposerait un second annuaire d'utilisateurs — un coût bien réel, lui.</li>
    <li><b>« Supprimez le CV ciblé »</b> — écarté, mais durci. Un seul relecteur le coupe ; un autre le garde explicitement comme l'élément le plus démontrable. Il reste, avec la correction majeure du point suivant.</li>
    <li><b>« Pondérez dynamiquement selon la catégorie socio-professionnelle »</b> — sans objet. Avec un seul secteur pilote, il n'y a qu'un jeu de poids à régler. La complexité disparaît d'elle-même.</li>
    <li><b>« Le rendu web de React Native pose d'immenses problèmes de référencement »</b> — argument faux, conclusion juste. Une application derrière un mot de passe n'a aucun enjeu de référencement. Ce qui condamne ce choix, ce sont les formulaires métier, la lecture de PDF et l'ergonomie de bureau du recruteur. Ne reprenez pas l'argument du référencement en soutenance : il ne tiendra pas trente secondes.</li>
  </ol>

  <div class="callout">
    <h3 style="margin-top:0">Un désaccord à signaler</h3>
    <p style="margin-bottom:0">Deux relecteurs avancent un taux d'échec d'extraction chiffré (« 30 à 40 % », « environ la moitié »). Le troisième refuse explicitement de donner un chiffre sans corpus ni définition de la réussite. <b>C'est lui qui a raison</b>, et c'est la bonne leçon de méthode : ces deux nombres sont des impressions présentées comme des mesures. Le seul chiffre qui vaudra quelque chose est celui que vous mesurerez sur vos propres CV.</p>
  </div>

  <h2 id="manque">Ce qu'on avait manqué</h2>
  <p>Sept angles morts réels. Aucun n'était dans la version 0.2, et deux d'entre eux auraient été des problèmes graves.</p>

  <dl class="kv">
    <dt>provenance</dt><dd><b>Le CV ciblé peut mentir sans rien inventer.</b> Si l'expérience A contenait « Java » et la B « Python », réordonner et filtrer peut laisser croire que Python appartenait à A. Correction : chaque fait garde son rattachement d'origine, et le générateur ne peut déplacer qu'un triplet <em>fait + contexte + source</em>. Aucune accroche rédigée par un modèle : un gabarit factuel, ou rien.</dd>
    <dt>fraîcheur</dt><dd><b>Un score parfait sur une offre déjà pourvue est un mauvais résultat.</b> Chaque offre et chaque recherche reçoivent une date de fin et une date de dernière confirmation. Une carte trop ancienne sort du deck.</dd>
    <dt>pseudonymat</dt><dd><b>« Julie C., Dumbéa, 4 ans chez X, BTS 2021 » identifie quelqu'un en trois secondes sur un petit marché.</b> La pseudonymisation devient graduelle : avant intérêt, métier, zone large et compétences agrégées ; l'employeur et le détail du parcours n'apparaissent qu'après.</dd>
    <dt>résidence</dt><dd><b>Le lieu de résidence est un critère de discrimination en droit français.</b> On ne collecte plus « où habitez-vous » mais « dans quelles zones acceptez-vous de travailler », et c'est cette réponse-là qui est scorée.</dd>
    <dt>transfert</dt><dd><b>Envoyer un CV à une interface de modèle hors Union européenne est un transfert international de données.</b> Point totalement absent de la version 0.2. À traiter avant le premier appel réel : fournisseur européen, ou encadrement contractuel.</dd>
    <dt>dépendance</dt><dd><b>La clé du fournisseur de modèle est le seul point de défaillance externe, et personne ne la finance.</b> Qui paie, qui la détient, et que se passe-t-il si elle est coupée le jour de la soutenance ? Il faut un mode dégradé sans modèle.</dd>
    <dt>dépendances</dt><dd><b>Les trois pôles ne sont pas indépendants.</b> Le matching dépend du schéma candidat <em>et</em> du schéma offre ; le CV ciblé dépend des trois. Le pôle 3 allait devenir un goulot. Correction sur la page Équipe : un propriétaire nommé du modèle transversal, et une tranche verticale qui tourne de bout en bout dès la semaine 2.</dd>
  </dl>

  <h2 id="perimetre">Le périmètre après coupe</h2>
  <p>Ce qu'on retire n'est pas ce qui est difficile : c'est ce dont la qualité n'a pas de borne, ou qui construit de l'outillage au lieu du produit.</p>

  <div class="grid g2">
    <div class="card">
      <div class="eyebrow" style="color:var(--ok)">On garde</div>
      <ul style="margin:10px 0 0;font-size:.93rem;color:var(--ink-2)">
        <li>CV importé ou saisi → fiche structurée</li>
        <li>Écran de relecture avec confiance par champ</li>
        <li>Offre créée ou collée → fiche structurée</li>
        <li>Deux scores expliqués, avec confiance</li>
        <li>Deck de cartes côté candidat</li>
        <li>Liste classée et invitation côté recruteur</li>
        <li>Vue de candidature ciblée, avec provenance</li>
        <li>Fil de discussion texte par match</li>
        <li>Trois créneaux proposés, un choisi</li>
      </ul>
    </div>
    <div class="card">
      <div class="eyebrow" style="color:var(--no)">On coupe</div>
      <ul style="margin:10px 0 0;font-size:.93rem;color:var(--ink-2)">
        <li>Applications natives et magasins d'applications</li>
        <li>Moteur d'extensions sectorielles par schéma</li>
        <li>OCR</li>
        <li>Import d'offre en PDF (texte collé seulement)</li>
        <li>ESCO et multilingue (ROME seul)</li>
        <li>Base vectorielle et file de calcul des scores</li>
        <li>Reformulation par modèle (niveau 4 de l'assistant)</li>
        <li>Quotas de deck et limite quotidienne de cartes</li>
        <li>Photo, y compris après match</li>
      </ul>
    </div>
  </div>

  <h2 id="hackavp">Le recadrage HackAVP (11–14 septembre)</h2>
  <p>Le brief du hackathon n'était pas sur la table quand le deck, le swipe recruteur et les offres fictives ont été construits. Sa lecture, puis la revue contradictoire qui a suivi, changent l'ordre de tout :</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Ce que le brief impose</th><th>Où on en est</th><th>Décision</th></tr></thead>
    <tbody>
      <tr><td>① Un profil entre (CV, formulaire)</td><td>Solide : import PDF audité sur huit CV, OCR pour scans et photos, guide, JSON Resume</td><td>Rien à ajouter</td></tr>
      <tr><td>② Matching explicable sur les <b>AVP réellement ouverts</b></td><td>Le moteur est bon, il tourne sur 22 offres inventées</td><td>Embarquer le corpus (<code>all_avps.jsonl</code>, sans clé, plus l'historique) et le référentiel de 84 métiers / 409 compétences ; matching lexical + structurel d'abord, <code>/search</code> de l'OPT en signal optionnel</td></tr>
      <tr><td>③ Quatre documents générés</td><td>Rien</td><td><b>Le produit.</b> Quatre requêtes séquentielles avec barre de progression, pas de file ni de worker ; un modèle de langage rédige, il ne décide pas des compétences manquantes</td></tr>
      <tr><td>④ Candidature transmissible</td><td>Rien</td><td>PDF côté serveur, envoi par Brevo (le port 25 sortant est fermé chez l'hébergeur), archive</td></tr>
      <tr><td>Le jury joue l'employeur</td><td>Côté recruteur construit (deck entreprise, match à deux oui)</td><td><b>Gelé.</b> Un candidat choisit, une candidature part</td></tr>
      <tr><td>Track SaaS ou onPrem souverain (20 pts)</td><td>Hébergé à Sydney</td><td>Non tranché : demander le 16 comment les 20 points de <i>chaque</i> track sont notés avant de décider. Un tunnel Cloudflare n'est pas souverain</td></tr>
      <tr><td>Équipes de 1 à 5</td><td>Neuf</td><td>À trancher le 16</td></tr>
    </tbody>
  </table></div>
  <div class="note">
    <p><b>Neuf AVP ouverts, c'est un deck qui se vide en quarante secondes.</b> Le deck se nourrit donc de l'historique, étiqueté sans ambiguïté (« clos le … — pour t'entraîner », candidature désactivée), et le pitch se retourne : <i>choisir vite, candidater bien</i>. Le swipe est l'entonnoir ; le dossier de candidature est le produit. La vidéo passera trente secondes sur le premier et trois minutes sur le second.</p>
  </div>

  <h2 id="valider">Trois décisions qui vous appartiennent</h2>
  <p>Les points marqués <span class="badge warn">⚑</span> plus haut changent le travail de tout le monde. Ils sont écrits dans le wiki parce que la recommandation est nette et unanime, mais ils doivent être validés en réunion avant le sprint 1 :</p>
  <ol>
    <li><b>Abandonner React Native pour du web seul.</b> Si l'un de vous tenait au mobile natif comme objectif d'apprentissage, c'est le moment de le dire.</li>
    <li><b>Retirer le swipe au recruteur.</b> C'est la moitié du concept affiché. Assumez-le : le slogan reste vrai côté candidat, et le produit devient utilisable côté entreprise.</li>
    <li><b>Choisir un secteur pilote.</b> Une piste évidente : votre propre campus — stages, alternance, premiers emplois. Vous avez accès aux deux côtés du marché.</li>
  </ol>

  <div class="note">
    <p><b>La question qui reste sans réponse et qui conditionne le juridique :</b> la zone géographique n'est nommée nulle part. Droit du travail applicable, règles de priorité à l'emploi local, autorité compétente, durées de conservation — tout en dépend. À trancher en premier, avant même la stack.</p>
  </div>

  <div class="nextprev">
    <a href="equipe.php"><span>Précédent</span><b>← Équipe</b></a>
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

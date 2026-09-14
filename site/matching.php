<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Swipe &amp; matching — Adopte un Job</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/wiki.css">
</head>
<body>

<svg style="display:none" aria-hidden="true">
  <symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/></symbol>
  <symbol id="i-case" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
  <symbol id="i-coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2c-1.3 0-2.5-.5-3-1.5"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></symbol>
  <symbol id="i-cap" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8l10-4 10 4-10 4z"/><path d="M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></symbol>
</svg>

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
      <a href="matching.php" aria-current="page"><b>Swipe &amp; matching</b><span>Pôles 2 et 3</span></a>
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

  <div class="eyebrow">03 — Pôles 2 et 3</div>
  <h1 class="title">Swipe &amp; matching</h1>
  <p class="chapo">Le swipe n'est pas un gadget d'interface : c'est ce qui oblige à ne montrer que l'essentiel, et donc à savoir ce qui est essentiel. La carte et le score se conçoivent ensemble.</p>

  <h2 id="carte">La carte</h2>
  <p>Même structure des deux côtés, seul le contenu change. Le grand bloc central que Tinder consacre à la photo, on le consacre au <strong>métier</strong> : c'est notre équivalent du visage.</p>

  <div class="deck">
    <div>
      <div class="phone"><div class="screen">
        <div class="chips"><span class="sel">Pour toi</span><span>Reconversion</span><span>Alternance</span><span>Télétravail</span></div>
        <div class="body">
          <div class="score">
            <span class="gauge"><b style="width:87%"></b></span>
            <i>87 %</i> compatible
          </div>
          <div class="role">Technicien support informatique</div>
          <div class="org">Pacific Systems · Nouméa</div>
          <div class="keys">
            <span>Windows Server</span><span>Réseau</span><span>Helpdesk N1</span>
            <span>Débutant accepté</span><span>Équipe de 4</span>
          </div>
        </div>
        <div class="foot">
          <div class="line"><svg width="13" height="13"><use href="#i-pin"/></svg> 12 km <span class="dot"></span> <em>Nouméa</em></div>
          <div class="line"><svg width="13" height="13"><use href="#i-case"/></svg> <em>CDI</em> <span class="dot"></span> <svg width="13" height="13"><use href="#i-clock"/></svg> dès novembre</div>
          <div class="line"><svg width="13" height="13"><use href="#i-coin"/></svg> <em>280–320 k XPF</em> <span class="dot"></span> <svg width="13" height="13"><use href="#i-home"/></svg> hybride 2 j</div>
        </div>
        <div class="actions"><i>↺</i><i class="no">✕</i><i>☆</i><i class="yes">♥</i><i>➤</i></div>
      </div></div>
      <p class="caption">Vue candidat — une offre</p>
    </div>

    <div>
      <div class="phone"><div class="screen">
        <div class="chips"><span class="sel">Technicien support</span><span>Comptable</span><span>+ 2 offres</span></div>
        <div class="body">
          <div class="score">
            <span class="gauge"><b style="width:92%"></b></span>
            <i>92 %</i> compatible
          </div>
          <div class="role">Support &amp; réseau</div>
          <div class="org">Julie C. · 4 ans d'expérience</div>
          <div class="keys">
            <span>Windows Server</span><span>Active Directory</span><span>GLPI</span>
            <span>Anglais B2</span><span>Permis B</span>
          </div>
        </div>
        <div class="foot">
          <div class="line"><svg width="13" height="13"><use href="#i-pin"/></svg> 8 km <span class="dot"></span> <em>Dumbéa</em></div>
          <div class="line"><svg width="13" height="13"><use href="#i-case"/></svg> cherche un <em>CDI</em> <span class="dot"></span> <svg width="13" height="13"><use href="#i-clock"/></svg> libre en octobre</div>
          <div class="line"><svg width="13" height="13"><use href="#i-cap"/></svg> <em>BTS SIO</em> <span class="dot"></span> 2021</div>
        </div>
        <div class="actions"><i>↺</i><i class="no">✕</i><i>☆</i><i class="yes">♥</i><i>➤</i></div>
      </div></div>
      <p class="caption">Vue recruteur — la fiche d'un candidat, ouverte depuis la liste</p>
    </div>
  </div>

  <h3>Ce qui est posé sur la carte, et pourquoi</h3>
  <dl class="kv">
    <dt>en haut</dt><dd>Les filtres de deck. Côté candidat ce sont des univers (pour toi, reconversion, alternance, télétravail) ; côté recruteur, ses offres publiées.</dd>
    <dt>le score</dt><dd>En haut à gauche, avec une jauge. Petit mais toujours au même endroit : c'est ce qu'on cherche des yeux en premier après trois cartes.</dd>
    <dt>le grand titre</dt><dd>Le métier. Côté recruteur c'est le métier du candidat, pas son nom — le nom passe en sous-titre.</dd>
    <dt>les étiquettes</dt><dd>Cinq maximum, choisies par le score : celles qui correspondent d'abord, puis celles qui manquent. Jamais une liste alphabétique.</dd>
    <dt>en bas</dt><dd>Trois lignes de faits durs : distance, contrat, disponibilité, salaire, diplôme. Ce sont les critères éliminatoires, donc ce qui décide vraiment.</dd>
    <dt>les cinq boutons</dt><dd>Revenir en arrière, refuser, mettre de côté, accepter, envoyer un mot. Le « mot » n'est disponible qu'après match — avant, c'est un bouton qui explique pourquoi il est verrouillé.</dd>
  </dl>

  <div class="note">
    <p><b>Côté recruteur, ce n'est plus un deck.</b> Le swipe suppose une file qui ne se vide jamais : un recruteur local épuise six cartes en quarante secondes, et de toute façon il veut <em>comparer</em>, pas décider une carte à la fois. Il voit donc une <b>liste classée</b> de candidats, filtrable, avec un bouton <b>Inviter</b>. La fiche ci-dessus est ce qu'il ouvre depuis cette liste. Le swipe reste côté candidat, où il a du sens.</p>
  </div>

  <div class="note">
    <p><b>Un clic sur la carte ouvre le détail</b>, en plein écran : l'offre complète ou le profil complet, le détail du score critère par critère, et les mêmes boutons en bas. On revient au deck exactement là où on l'avait laissé. C'est la boucle : carte → détail → décision → carte suivante.</p>
  </div>

    <h2 id="score">Le score : deux mesures, pas une</h2>
  <p>La version 0.2 calculait un pourcentage unique. C'était une erreur de fond, relevée par les trois relecteurs : le candidat et le recruteur ne posent pas la même question.</p>

  <div class="grid g2">
    <div class="card">
      <div class="eyebrow">fit_recruteur</div>
      <p style="font-size:.92rem;color:var(--ink-2);margin:.4rem 0 0"><em>Cette personne peut-elle faire le travail ?</em> Compétences exigées couvertes, expérience, formation, disponibilité, habilitations.</p>
    </div>
    <div class="card">
      <div class="eyebrow">fit_candidat</div>
      <p style="font-size:.92rem;color:var(--ink-2);margin:.4rem 0 0"><em>Ce poste me convient-il ?</em> Métier visé, contrat, salaire, zone acceptée, horaires, télétravail.</p>
    </div>
  </div>

  <p style="margin-top:18px">Chacun voit <strong>sa</strong> mesure. La qualité du match est le <strong>minimum des deux</strong>, jamais la moyenne : une moyenne à 70 peut masquer un 95 d'un côté et un 45 de l'autre, c'est-à-dire un désaccord total.</p>

  <h3>Trois règles qui rendent le score honnête</h3>
  <ol class="steps">
    <li><b>Inconnu n'est pas non.</b> « Permis non renseigné » et « pas de permis » sont deux informations différentes. Logique à trois valeurs partout : <code>oui</code> / <code>non</code> / <code>inconnu</code>. L'inconnu ne fait jamais échouer un filtre, il passe en point à vérifier.</li>
    <li><b>Une donnée absente ne coûte pas de points.</b> On retire son critère du dénominateur et on renormalise sur ce qui est renseigné. Pénaliser l'absence pousse à mentir ; l'ignorer pousse à cacher.</li>
    <li><b>Une confiance s'affiche à côté du score.</b> Un 80 % calculé avec toutes les données n'a rien à voir avec un 80 % calculé sur la moitié des champs. « Compatibilité élevée — confiance moyenne, 3 critères non vérifiés » est bien plus utile qu'un nombre seul.</li>
  </ol>

  <h3>Les critères et leur ordre</h3>
  <p>D'abord les <strong>contraintes</strong> — celles qui sont explicitement incompatibles, jamais celles qui sont inconnues. Ensuite l'<strong>adéquation</strong>. Enfin les <strong>préférences</strong>. Mélanger les trois dans une seule pondération était l'autre défaut de la version 0.2.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Nature</th><th>Critères</th><th>Traitement</th></tr></thead>
    <tbody>
      <tr><td><b>Contrainte</b></td><td>Habilitation ou diplôme réglementaire, permis exigé, zone acceptée, type de contrat, chevauchement des fourchettes de salaire</td><td>Incompatible seulement si l'information existe et contredit. Sinon : point à vérifier.</td></tr>
      <tr><td><b>Adéquation</b></td><td>Compétences exigées puis souhaitées, années d'expérience, récence, niveau de formation</td><td>Chaque sous-score dans [0,1], avec une fonction écrite et testée <em>avant</em> de régler les poids.</td></tr>
      <tr><td><b>Préférence</b></td><td>Télétravail, horaires, temps plein ou partiel, date de prise de poste</td><td>Fait monter ou descendre le classement, n'exclut jamais.</td></tr>
    </tbody>
  </table></div>

  <p>Les compétences ne se comptent pas en fractions naïves : trois sur quatre ne vaut pas mécaniquement 75 %. La normalisation doit distinguer au minimum <code>exact</code>, <code>parent/enfant</code>, <code>proche</code> et <code>absent</code> — Python n'est pas Django, Excel n'est pas l'analyse financière.</p>

  <h3>Aucune offre ne disparaît en silence</h3>
  <p>Un filtre qui retire une offre du deck sans qu'aucun humain n'intervienne ressemble beaucoup à une décision automatisée au sens du RGPD, et le refus d'accès à une candidature en est l'exemple type. Trois garanties, à considérer comme obligatoires :</p>
  <ul>
    <li>Les offres exclues restent accessibles dans une section <strong>« hors de vos critères »</strong>, avec le motif de l'exclusion.</li>
    <li>Le tri algorithmique peut être <strong>désactivé</strong> au profit d'un simple ordre chronologique.</li>
    <li>Le candidat peut <strong>corriger la donnée</strong> qui l'exclut, directement depuis l'explication.</li>
  </ul>

  <h3>Les biais entrent par la porte de derrière</h3>
  <p>Retirer l'âge, le genre et l'origine ne suffit pas. L'année du bac donne l'âge ; le prénom donne souvent le genre et l'origine ; la commune de résidence est un indicateur social très fort sur un petit territoire ; une interruption de carrière peut signaler une maternité ou une maladie.</p>
  <div class="note">
    <p><b>Deux mesures concrètes.</b> On ne collecte plus le lieu de résidence mais les <b>zones acceptées</b> — c'est la seule chose utile au score, et le lieu de résidence est par ailleurs un critère de discrimination en droit français. Et on ajoute un <b>test de profils jumeaux</b> automatisé : deux profils qui ne diffèrent que par le prénom, la commune ou l'année de naissance doivent produire exactement le même score. Peu coûteux, et il tourne en intégration continue.</p>
  </div>

  <h3>L'explication, générée par le code</h3>
  <p>Deux listes construites à partir des sous-scores, jamais rédigées par un modèle de langage.</p>

  <div class="grid g2">
    <div class="card">
      <div class="eyebrow" style="color:var(--ok)">Pourquoi ça colle</div>
      <ul style="margin:10px 0 0;font-size:.92rem;color:var(--ink-2)">
        <li>8 compétences exigées sur 10 sont dans ton profil</li>
        <li>4 ans d'expérience pour 2 demandés</li>
        <li>Le poste est dans une zone que tu acceptes</li>
        <li>Tu cherches un CDI, l'offre en propose un</li>
      </ul>
    </div>
    <div class="card">
      <div class="eyebrow" style="color:var(--accent)">Points à vérifier</div>
      <ul style="margin:10px 0 0;font-size:.92rem;color:var(--ink-2)">
        <li>Anglais C1 demandé, tu as déclaré B2</li>
        <li>Permis B requis — information non renseignée</li>
        <li>Le salaire annoncé démarre sous ton minimum</li>
      </ul>
    </div>
  </div>

  <h2 id="reconversion">La reconversion, sans quotas</h2>
  <p>Le principe reste : <strong>le score compare l'offre au projet, pas au passé</strong>. Le candidat déclare jusqu'à trois métiers visés, qui n'ont aucune obligation de ressembler à ses expériences.</p>
  <p>En revanche le mécanisme de la version 0.2 — un deck composé à 40/30/30 — a été écarté par les trois relecteurs, et l'argument est imparable : <strong>un quota n'est pas un tri</strong>. S'il n'existe que deux bonnes passerelles, le quota remplit le reste avec des mauvaises ; et une excellente reconversion peut être masquée parce que son compartiment est plein. Sur un marché peu dense, la fonctionnalité censée être différenciante produirait surtout du bruit.</p>

  <ol class="steps">
    <li><b>Un seul classement.</b> Les offres passerelles entrent dans le même deck, avec une pénalité. Le réglage du candidat change la pénalité, pas la composition.</li>
    <li><b>Deux positions, pas trois.</b> <em>Mon métier uniquement</em> ou <em>ouvert aux métiers proches</em>. Trois curseurs, c'était trop de variables pour un signal qu'on n'a pas encore.</li>
    <li><b>Le recruteur ouvre son offre aux reconversions, ou non.</b> Sans cela il refusera systématiquement les cartes ainsi étiquetées. C'est aussi un signal utile au candidat, et une donnée de vérité gratuite.</li>
    <li><b>Les compétences transférables se déduisent</b> des métiers exercés via le référentiel, plutôt que d'être auto-déclarées : une compétence transversale cochée par l'intéressé est du bruit.</li>
  </ol>

  <p>Une carte de reconversion n'affiche pas un pourcentage de transfert, qui ne veut rien dire. Elle affiche ce qui est vrai : <em>6 compétences transférables · 2 compétences du métier non démontrées · 1 habilitation obligatoire manquante</em>.</p>

  <div class="note">
    <p><b>Comment savoir si ça marche.</b> Comparer le taux d'acceptation des cartes passerelles à celui des cartes cœur de cible. En dessous de la moitié, la fonctionnalité crée de la curiosité et pas de la pertinence : sa pénalité doit augmenter. Vous n'aurez pas le volume en onze semaines, alors faites l'évaluation hors ligne, sur trente à cinquante paires offre/candidat notées à la main.</p>
  </div>

  <h2 id="fraicheur">La fraîcheur, un critère à part entière</h2>
  <p>Angle mort de la version 0.2, relevé deux fois : <strong>un score parfait sur une offre déjà pourvue est un mauvais résultat.</strong> Un excellent algorithme sur des données périmées ne produit rien d'autre qu'une mauvaise expérience.</p>
  <ul>
    <li>Chaque offre porte une <strong>date de fin</strong> et une <strong>date de dernière confirmation</strong>. Au-delà, elle sort du deck.</li>
    <li>Chaque recherche candidat porte la même chose : quelqu'un qui a trouvé un poste et n'est jamais revenu ne doit plus remonter.</li>
    <li>Une relance simple — « cette offre est-elle toujours ouverte ? » — vaut mieux que n'importe quel réglage de pondération.</li>
  </ul>

<h2 id="deck">Le deck et les gestes</h2>
  <ul>
    <li><strong>Aucune limite quotidienne de cartes.</strong> Créer artificiellement de la rareté est une mécanique d'application sociale : sur un marché peu dense elle n'a aucun sens. Le deck est fini, et on le dit — « vous avez vu les 18 opportunités actuellement pertinentes ».</li>
    <li><strong>Quatre états d'écran vide, pas un.</strong> Beaucoup de résultats, peu de résultats, aucun résultat <em>à cause d'une contrainte précise</em>, aucune donnée disponible. Ce sont quatre problèmes différents, et l'utilisateur doit savoir lequel est le sien.</li>
    <li><strong>Trois cartes préchargées</strong>, pas plus : au-delà, on calcule des scores pour des cartes que personne ne verra.</li>
    <li><strong>Glisser à droite</strong> pour accepter, <strong>à gauche</strong> pour refuser, <strong>vers le haut</strong> pour mettre de côté. Les mêmes actions existent en boutons — le geste n'est jamais la seule façon de faire, sinon l'application est inutilisable au clavier et pour une partie des utilisateurs.</li>
    <li><strong>Un retour en arrière</strong>, limité au dernier swipe. Au-delà, on retrouve tout dans l'historique.</li>
    <li><strong>Une décision n'est jamais perdue en cas de coupure réseau</strong> : elle part en file locale et se synchronise ensuite. Un swipe perdu, c'est une offre qu'on ne reverra jamais.</li>
    <li><strong>Une limite quotidienne</strong> reste à trancher. Elle crée de la rareté et améliore la qualité des décisions, mais frustre. À tester, pas à décider maintenant.</li>
  </ul>

  <h2 id="historique">L'historique, des deux côtés</h2>
  <p>Trois listes, symétriques pour le candidat et le recruteur : <strong>acceptés</strong> (en attente de réciprocité), <strong>mis de côté</strong>, <strong>refusés</strong>. On peut revenir sur un refus depuis l'historique — c'est indispensable pour un geste aussi rapide qu'un swipe.</p>
  <p>Chaque ligne rappelle le score au moment de la décision et sa date. Une offre close ou un profil retiré apparaît grisé plutôt que supprimé : voir disparaître ses propres décisions donne l'impression d'un bug.</p>

  <h2 id="match">Le match, et ce qu'il ouvre</h2>
  <p>Un match existe quand le candidat a accepté l'offre <em>et</em> que le recruteur a accepté ce candidat <em>pour cette offre</em>. C'est un triplet, pas une paire : le même candidat peut matcher sur deux offres de la même entreprise, ce sont deux relations distinctes.</p>

  <div class="grid g3">
    <div class="card">
      <div class="eyebrow">Aussitôt</div>
      <h3 style="margin-top:6px">Le CV ciblé</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Un CV régénéré depuis le <code>resume.json</code>, recentré sur l'offre. Le CV d'origine reste consultable à côté.</p>
    </div>
    <div class="card">
      <div class="eyebrow">Aussitôt</div>
      <h3 style="margin-top:6px">Les créneaux</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Chacun pose ses disponibilités, l'application propose les intersections, un clic confirme.</p>
    </div>
    <div class="card">
      <div class="eyebrow">Aussitôt</div>
      <h3 style="margin-top:6px">La conversation</h3>
      <p style="font-size:.92rem;color:var(--ink-2);margin:0">Un fil par match, ouvert aux deux, avec les coordonnées enfin visibles.</p>
    </div>
  </div>

  <h3 id="cv-cible">Le CV ciblé — l'idée forte, et sa limite</h3>
  <p>Le recruteur ne reçoit pas un CV de plus dans une mise en page de plus : il reçoit une fiche au <strong>format unique de la plateforme</strong>, réorganisée pour son offre. Concrètement, le générateur :</p>
  <ul>
    <li>remonte en premier les expériences les plus proches du poste ;</li>
    <li>ne conserve, parmi les compétences, que celles demandées — et signale les manquantes plutôt que de les taire ;</li>
    <li>met en avant les réalisations chiffrées liées au poste ;</li>
    <li>écrit une accroche construite à partir des seules informations du profil.</li>
  </ul>

  <div class="note">
    <p><b>« Ne rien inventer » ne suffit pas.</b> Supposons une expérience A où le candidat faisait du Java, une expérience B où il faisait du Python, et une offre Python. En réordonnant et en filtrant, on peut donner l'impression que Python appartenait à l'expérience A. Tous les mots existaient dans le CV, et pourtant c'est une <b>fausse attribution</b>.</p>
    <p style="margin-bottom:0">La règle devient donc : <b>chaque fait garde sa provenance</b>. Une compétence, une réalisation, une responsabilité restent attachées à l'expérience ou à la formation dont elles viennent, et le générateur ne peut déplacer qu'un triplet <em>fait + contexte + source</em>. Aucune accroche rédigée par un modèle : un gabarit factuel, ou pas d'accroche du tout.</p>
  </div>

  <p>Deux conséquences à assumer : le candidat doit <strong>voir le CV ciblé avant qu'il parte</strong>, et le recruteur doit savoir qu'il lit une version réordonnée, avec l'original à un clic.</p>

  <h3 id="rdv">Les disponibilités et le rendez-vous</h3>
  <p>Le parcours minimal tient en quatre temps : le recruteur propose deux ou trois créneaux, le candidat en choisit un ou en propose d'autres, l'application confirme et envoie un fichier d'agenda aux deux. Pas de synchronisation avec les agendas externes en version 1 : c'est une source de complexité sans rapport avec la valeur du produit.</p>

  <h3 id="chat">La conversation</h3>
  <p>Un fil par match, texte simple, indicateur de lecture. La question « faut-il brancher un serveur de discussion existant plutôt que l'écrire » est traitée en détail dans <a href="opensource.php#chat">l'audit open source</a> — la réponse courte est que le coût se trouve dans la création des comptes, pas dans l'affichage des messages.</p>

  <h2 id="livrables">Ce que les pôles 2 et 3 doivent livrer</h2>
  <ul>
    <li>Création et import d'offre, cycle de vie, tableau de bord recruteur</li>
    <li>Le composant carte, les gestes, le détail plein écran</li>
    <li>Les files de cartes des deux côtés, et l'enregistrement des décisions</li>
    <li>Filtres éliminatoires, score, explication, versions de poids</li>
    <li>Les trois modes d'ouverture et le score de transfert</li>
    <li>Historique, match, CV ciblé, créneaux, conversation</li>
  </ul>

  <div class="nextprev">
    <a href="profil.php"><span>Précédent</span><b>← Profil &amp; CV</b></a>
    <a href="techno.php"><span>Suivant</span><b>Techno →</b></a>
  </div>

</main>
<aside class="rail"><div class="eyebrow">Sur cette page</div><ol></ol></aside>
</div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/wiki.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>

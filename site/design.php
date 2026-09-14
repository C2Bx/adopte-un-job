<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design — Adopte un Job</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/wiki.css">
<style>
  .pal { display: flex; gap: 6px; margin: 10px 0 4px; }
  .pal i { flex: 1; height: 30px; border-radius: 7px; border: 1px solid rgba(0,0,0,.1); }
</style>
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
      <a href="design.php" aria-current="page"><b>Design</b><span>Direction et règles</span></a>
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

  <div class="eyebrow">10 — Système de design</div>
  <h1 class="title">La direction, et les règles qui tiennent</h1>
  <p class="chapo">Le choix de direction artistique se fait dans l'app, sur le vrai écran : <a href="app/da.php">trois pistes à comparer</a>. Cette page porte le raisonnement et les règles — c'est-à-dire ce qui reste vrai quelle que soit la piste retenue.</p>

  <h2 id="pistes">Les trois pistes</h2>

  <div class="grid g3">
    <div class="card">
      <div class="eyebrow">Piste A</div>
      <h3 style="margin-top:6px">Encre &amp; Ambre</h3>
      <div class="pal">
        <i style="background:#17356B"></i><i style="background:#E8912B"></i><i style="background:#14171F"></i><i style="background:#F4F6F8"></i>
      </div>
      <p style="font-size:.9rem;color:var(--ink-2);margin:.5rem 0 0">Chrome clair et sobre, deck sur fond charbon : la carte devient une scène. L'ambre ne sert qu'à ce qui mérite l'œil. <b>Plus Jakarta Sans.</b></p>
    </div>
    <div class="card">
      <div class="eyebrow">Piste B</div>
      <h3 style="margin-top:6px">Nuit &amp; Lagon</h3>
      <div class="pal">
        <i style="background:#2ED3B7"></i><i style="background:#F2C14E"></i><i style="background:#141A1F"></i><i style="background:#0C1013"></i>
      </div>
      <p style="font-size:.9rem;color:var(--ink-2);margin:.5rem 0 0">Sombre de bout en bout. Économe en batterie sur écran OLED, et l'app ne change pas de registre entre le deck et le reste. <b>Sora.</b></p>
    </div>
    <div class="card">
      <div class="eyebrow">Piste C</div>
      <h3 style="margin-top:6px">Papier &amp; Encre</h3>
      <div class="pal">
        <i style="background:#1B1815"></i><i style="background:#B2422C"></i><i style="background:#F2EFE9"></i><i style="background:#E9E4DA"></i>
      </div>
      <p style="font-size:.9rem;color:var(--ink-2);margin:.5rem 0 0">Registre éditorial. Un CV est un document : cette piste l'assume. <b>Fraunces + DM Sans.</b></p>
    </div>
  </div>

  <div class="note">
    <p><b>Ma recommandation, pour lancer la discussion.</b> La <b>A</b> pour la version 1 : elle laisse la carte être la vedette, reste lisible en plein soleil — un candidat consulte souvent dehors — et ne vieillira pas. La <b>B</b> est la plus séduisante en démonstration, mais un fond sombre dessert les formulaires longs, or le profil et le CV sont la moitié du produit. La <b>C</b> est la plus mémorable et la plus risquée : à garder en tête si vous voulez qu'on se souvienne du projet.</p>
  </div>

  <h2 id="regles">Ce qui est décidé, quelle que soit la piste</h2>
  <p>Ces six règles ne dépendent pas de la couleur retenue. Elles sont écrites dans la feuille de style de l'app, et s'en écarter demande une raison.</p>

  <div class="tablewrap"><table>
    <thead><tr><th>Règle</th><th>Pourquoi</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Une échelle d'espace de 4</b><br><code>4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56</code></td>
        <td>Aucune valeur en dehors. C'est ce qui rend une interface régulière sans avoir à y penser, et ce qui évite les discussions sur « deux pixels de plus ».</td>
      </tr>
      <tr>
        <td><b>Sept tailles de texte</b><br><code>11 · 13 · 15 · 18 · 22 · 28 · 36</code></td>
        <td>Une taille qui semble manquer est le signe qu'on hiérarchise mal, pas qu'il en faut une huitième.</td>
      </tr>
      <tr>
        <td><b>44 px de zone tactile minimum</b></td>
        <td>Sur toute cible cliquable, y compris les petites icônes. Non négociable sur mobile : en dessous, on rate sa cible une fois sur cinq.</td>
      </tr>
      <tr>
        <td><b>Vert et rouge sont réservés</b></td>
        <td>Ils veulent dire oui et non. Aucune couleur de marque ne peut être verte ou rouge, sinon la sémantique du swipe se brouille. C'est ce qui a écarté le vert lagon comme couleur principale.</td>
      </tr>
      <tr>
        <td><b>La navigation est en bas</b></td>
        <td>Elle vit sous le pouce. Le haut est réservé à l'identité et au filtrage.</td>
      </tr>
      <tr>
        <td><b>Le score n'est jamais seul</b></td>
        <td>Toujours accompagné de son indice de confiance et de son explication — dans les trois pistes. C'est une règle produit autant que graphique.</td>
      </tr>
    </tbody>
  </table></div>

  <h2 id="mobile">Les contraintes mobiles, décidées avant d'écrire le code</h2>
  <p>Celles-là ne se rattrapent pas après coup : elles décident de la structure des écrans.</p>

  <dl class="kv">
    <dt>hauteur</dt><dd><code>100dvh</code>, jamais <code>100vh</code> — la barre d'URL mobile se rétracte au défilement, et <code>vh</code> fait sauter la mise en page à chaque fois.</dd>
    <dt>encoche</dt><dd><code>viewport-fit=cover</code> et <code>env(safe-area-inset-*)</code> : l'encoche et la barre gestuelle sont gérées dès la coquille, pas rattrapées à coups de marges.</dd>
    <dt>rafraîchir</dt><dd><code>overscroll-behavior: none</code> — sans ça, un glissement vers le bas déclenche le « tirer pour rafraîchir » du navigateur et la carte en cours est perdue.</dd>
    <dt>toucher</dt><dd><code>-webkit-tap-highlight-color: transparent</code>, et aucune interaction qui dépende du survol : il n'existe pas sur mobile.</dd>
    <dt>largeur</dt><dd>Au-delà de 480 px, l'app reste une colonne. Une application ne devient pas un site en s'élargissant.</dd>
    <dt>installable</dt><dd>Manifeste, icône, <code>theme-color</code> clair et sombre, service worker réseau-d'abord. Pas de magasin d'applications — <a href="arbitrages.php">décision v0.3</a>.</dd>
  </dl>

  <h2 id="carte">La carte ne défile pas</h2>
  <p>C'est la règle d'interface la plus structurante de l'app, et elle a demandé une vraie mécanique.</p>
  <p>Une barre de défilement dans une carte est un aveu : elle dit qu'on n'a pas su choisir ce qui tient à l'écran. Plutôt que de la masquer — ce qui cache le problème sans le résoudre — l'app <strong>pagine automatiquement</strong> : le contenu d'une offre est découpé en blocs, la hauteur réelle de la carte est mesurée sur l'écran du visiteur, et les blocs sont répartis sur autant de pages qu'il en faut.</p>
  <p>Le nombre de segments en haut de la carte varie donc d'une offre à l'autre, et d'un téléphone à l'autre. La pagination se recalcule à la rotation de l'appareil.</p>
  <div class="note">
    <p><b>Le filet de sécurité.</b> Si un seul bloc est plus haut qu'une page entière — un paragraphe interminable, ou une taille de police fortement augmentée pour raison d'accessibilité — la page redevient défilable, mais sans barre : le bas s'estompe en dégradé et <b>une flèche apparaît</b>, qui disparaît une fois le bas atteint.</p>
  </div>

  <h2 id="ordinateur">Et sur ordinateur ?</h2>
  <p>L'app est aujourd'hui une interface mobile posée au milieu d'un grand écran. La question est de savoir si on lui donne une vraie mise en page d'ordinateur — et la réponse est oui, mais <strong>pas sous forme de deux interfaces</strong>.</p>

  <h3>Ce que dit le code aujourd'hui</h3>
  <p>Toute la feuille de style ne contient qu'<strong>un seul point de rupture</strong> : <code>min-width: 520px</code>, et il se contente d'arrondir les coins de la colonne et de la centrer. Il n'existe aucune mise en page d'ordinateur.</p>
  <ul>
    <li><code>.app</code> est plafonnée à <strong>480 px de large</strong> : sur un écran de 1920, <strong>trois quarts de la surface sont perdus</strong>.</li>
    <li>La hauteur est plafonnée à <strong>880 px</strong> : la carte n'utilise pas non plus la hauteur disponible.</li>
    <li>La navigation est une barre du bas en <code>repeat(5, 1fr)</code> — un geste de pouce, sur une machine qui n'en a pas.</li>
  </ul>

  <h3>Le piège à éviter</h3>
  <div class="note">
    <p><b>La place gagnée ne doit pas servir à agrandir, mais à révéler.</b> Une carte de 900 px de large est illisible et le geste de swipe y perd son sens. Le deck garde <b>420 à 480 px</b>, sur tous les écrans.</p>
    <p style="margin-bottom:0">Ce qui doit remplir l'espace, c'est ce qui est aujourd'hui <b>enfoui dans les six pages de la carte</b> : le détail du score, l'explication, l'entreprise. Autrement dit, sur ordinateur, ce n'est pas « la même chose en plus grand » — c'est <b>la même chose sans pagination</b>.</p>
  </div>

  <h3>Trois régimes, une seule base de code</h3>
  <div class="tablewrap"><table>
    <thead><tr><th>Écran</th><th>Jusqu'à 720 px</th><th>720 à 1100 px</th><th>Au-delà de 1100 px</th></tr></thead>
    <tbody>
      <tr><td><b>Navigation</b></td><td>Barre du bas</td><td>Rail à gauche, icônes</td><td>Rail à gauche, icônes et libellés</td></tr>
      <tr><td><b>Deck</b></td><td>Pleine largeur</td><td colspan="2" style="text-align:center">Colonne de 440 px, jamais étirée</td></tr>
      <tr><td><b>Détail du score</b></td><td>Page 6 de la carte</td><td colspan="2" style="text-align:center">Panneau permanent à droite</td></tr>
      <tr><td><b>Mes intérêts</b></td><td>Liste, puis fiche plein écran</td><td colspan="2" style="text-align:center">Liste à gauche, fiche à droite</td></tr>
      <tr><td><b>Profil et CV</b></td><td>Une colonne</td><td>Deux colonnes</td><td>Formulaire, extrait du CV, aperçu</td></tr>
      <tr><td><b>Côté recruteur</b></td><td>Liste, puis détail</td><td colspan="2" style="text-align:center">Tableau, détail et filtres — son usage réel</td></tr>
    </tbody>
  </table></div>

  <h3>Ce qui ne bouge pas</h3>
  <p>Les jetons — échelle d'espace, tailles de texte, 44 px de zone tactile, couleurs réservées — sont indépendants de la largeur. Aucun n'a besoin d'être touché. C'est précisément à ça qu'ils servent.</p>

  <h3>Ce que ça coûte, honnêtement</h3>
  <dl class="kv">
    <dt>3 à 4 j</dt><dd>Le rail de navigation et le panneau latéral sur les deux écrans qui existent déjà.</dd>
    <dt>+20 %</dt><dd>Sur la conception de chaque écran suivant : il faut le penser dans deux régimes au lieu d'un.</dd>
    <dt>risque</dt><dd>Deux mises en page qui divergent avec le temps. La parade est simple et non négociable : <b>aucun composant dupliqué</b>. Seules les grilles changent, les blocs sont les mêmes. Si un composant doit être écrit deux fois, c'est le découpage qui est mauvais.</dd>
  </dl>

  <h3>Dans quel ordre</h3>
  <ol class="steps">
    <li><b>Maintenant : le rail et le panneau latéral.</b> Peu de travail, et ça règle l'essentiel de l'effet « application mobile perdue au milieu de l'écran ». Ça ne bloque aucun pôle.</li>
    <li><b>Quand le pôle 1 attaque le profil.</b> Le formulaire long est le pire cas dans 480 px, et le meilleur gain en deux colonnes. À concevoir d'emblée dans les deux régimes.</li>
    <li><b>Quand le pôle 2 attaque le recruteur.</b> Celui-là se conçoit <em>ordinateur d'abord</em> : comparer des profils et inviter est un usage de bureau, comme <a href="arbitrages.php">acté en v0.3</a>.</li>
    <li><b>Jamais :</b> une base de code séparée, un sous-domaine mobile, ou une détection d'appareil. Un seul code, des points de rupture, et c'est le navigateur qui décide.</li>
  </ol>

  <div class="note">
    <p><b>Une réserve à garder en tête.</b> Les trois relectures ont désigné l'éparpillement fonctionnel comme la première cause d'échec du projet. Élargir la mise en page est utile, mais ce n'est pas ce qui fera exister le produit : ça se fait par petites touches, entre deux fonctionnalités, jamais comme une refonte.</p>
  </div>

  <div class="nextprev">
    <a href="app/da.php"><span>Comparer sur le vrai écran</span><b>Les trois pistes →</b></a>
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

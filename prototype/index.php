<?php
// Page publique. On reconnait l'equipe uniquement pour lui montrer le lien
// vers la direction artistique, qui reste interne.
require __DIR__ . '/session.php';
$equipe = estEquipe();
?>
<!DOCTYPE html>
<html lang="fr" data-da="a">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5">
<title>Adopte un Job</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F4F6F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0C1013" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Adopte un Job">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/app.css">
</head>
<body>

<svg style="display:none" aria-hidden="true">
  <symbol id="i-swipe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="12" height="15" rx="3"/><path d="M17 8l3 2.5v6a3 3 0 01-3 3"/></symbol>
  <symbol id="i-explore" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.6-7-9.4A4.1 4.1 0 0112 8a4.1 4.1 0 017 2.6C19 15.4 12 20 12 20z"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 15a3 3 0 01-3 3H9l-4 3V7a3 3 0 013-3h9a3 3 0 013 3z"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20a7.5 7.5 0 0115 0"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 018 0V10"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z"/></symbol>
  <symbol id="i-undo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h9a5 5 0 010 10H9"/><path d="M4 9l4-4M4 9l4 4"/></symbol>
  <symbol id="i-sliders" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="2" fill="currentColor" stroke="none"/></symbol>
</svg>

<div class="app">

  <header class="topbar">
    <span class="mark">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="7" width="16" height="21" rx="5" fill="var(--brand)" opacity=".28" transform="rotate(-8 12 17)"/>
        <rect x="9" y="4" width="16" height="21" rx="5" fill="var(--brand)"/>
        <circle cx="17" cy="14.5" r="3.2" fill="var(--accent)"/>
      </svg>
      <b>Adopte un Job</b>
      <button class="tag-demo" id="demo-info" aria-label="Ce que contient cette démonstration">démo</button>
    </span>
    <span class="spacer"></span>
<?php if ($equipe): ?>
    <a class="iconbtn" href="da.php" title="Direction artistique" aria-label="Direction artistique">
      <svg><use href="#i-sliders"/></svg>
    </a>
<?php endif; ?>
  </header>

  <div class="screen" id="ec-swipe">
    <div class="stack">
      <div class="filters" id="filters">
        <button class="chip" data-f="tout" aria-pressed="true">Pour toi</button>
        <button class="chip" data-f="ouvert" id="f-ouvert" aria-pressed="false">Métiers proches</button>
        <button class="chip" data-f="teletravail" aria-pressed="false">Télétravail</button>
        <button class="chip" data-f="debutant" aria-pressed="false">Débutant accepté</button>
        <button class="chip" data-f="cdi" aria-pressed="false">CDI</button>
        <button class="chip" data-f="salaire" aria-pressed="false">Salaire annoncé</button>
        <button class="chip" data-f="proche" aria-pressed="false">Moins de 20 km</button>
      </div>
      <div class="zone-deck" style="position:relative">
        <div class="deck" id="deck"></div>
      </div>
      <aside class="side panneau" id="side" aria-label="Détail de l’offre affichée"></aside>
    </div>
  </div>

  <div class="screen" id="ec-explorer" hidden>
    <div class="pad">
      <span class="soon">Écran suivant</span>
      <h2>Explorer</h2>
      <p class="lead">La recherche classique, pour ceux qui veulent filtrer eux-mêmes plutôt que se laisser guider. Le tri algorithmique s’y désactive : c’est notre garantie que rien ne disparaît en silence.</p>
      <div class="tile"><b>Recherche par métier et zone</b><span>Avec le nombre de résultats avant de valider.</span></div>
      <div class="tile"><b>Hors de mes critères</b><span>Les offres écartées, avec le motif exact de l’exclusion.</span></div>
      <div class="tile"><b>Tri chronologique</b><span>Les plus récentes d’abord, sans score.</span></div>
    </div>
  </div>

  <div class="screen" id="ec-interets" hidden>
    <div class="pad pad-i">
      <div class="col-liste">
      <h2>Mes intérêts</h2>
      <p class="lead">Ce que tu as décidé, et de quoi revenir dessus. Un geste aussi rapide qu’un swipe doit être réversible.</p>
      <div class="seg" role="tablist" id="seg-interets">
        <button role="tab" data-l="oui" aria-selected="true">Intéressé <span class="n" data-n="oui"></span></button>
        <button role="tab" data-l="plus_tard" aria-selected="false">Plus tard <span class="n" data-n="plus_tard"></span></button>
        <button role="tab" data-l="non" aria-selected="false">Écartés <span class="n" data-n="non"></span></button>
      </div>
      <div id="liste-interets"></div>
      </div>
      <aside class="side panneau" id="side-i" aria-label="Détail de l’offre sélectionnée"></aside>
    </div>
  </div>

  <div class="screen" id="ec-messages" hidden>
    <div class="pad">
      <span class="soon">Écran suivant</span>
      <h2>Messages</h2>
      <p class="lead">Un fil par match. Texte simple, sans pièce jointe ni indicateur de présence : c’est ce qui rend la fonctionnalité tenable en onze semaines.</p>
      <div class="tile"><b>Candidature ciblée</b><span>Mon profil recentré sur l’offre, que je valide avant envoi.</span></div>
      <div class="tile"><b>Créneaux</b><span>Trois propositions de l’entreprise, j’en choisis une.</span></div>
    </div>
  </div>

  <div class="screen" id="ec-profil" hidden>
    <div class="pad" id="profil-hote"></div>
  </div>

  <div class="sheet" id="match" hidden><div class="sheet-box" id="match-box"></div></div>

  <div class="fiche" id="fiche" hidden>
    <div class="fiche-top">
      <button class="iconbtn" id="fiche-x" aria-label="Fermer"><svg><use href="#i-x"/></svg></button>
      <span class="t"><b id="fiche-titre"></b><span id="fiche-sous"></span></span>
    </div>
    <div class="fiche-deck" id="fiche-deck"></div>
    <div class="fiche-acts" id="fiche-acts"></div>
  </div>

  <div class="sheet" id="detail" hidden><div class="sheet-box">
    <div class="poignee"></div>
    <div id="detail-corps" class="panneau"></div>
    <div class="btns" style="margin-top:var(--s5)"><button class="btn primaire" id="detail-ok">Fermer</button></div>
  </div></div>

  <div class="sheet" id="apropos" hidden><div class="sheet-box">
    <div class="poignee"></div>
    <div class="eyebrow">Maquette d’étude</div>
    <h2 style="font-size:var(--t-xl)">Rien de tout ceci n’est réel</h2>
    <p class="qui">Ces entreprises, ces offres et ce profil sont <b>inventés</b>. Aucune candidature ne part, aucune donnée n’est enregistrée ailleurs que dans ce navigateur.</p>
    <div class="ouvre">
      <div><span class="n">01</span><span><b>Le score, lui, est vrai</b><span>Il est calculé par le code de la page : deux scores directionnels, un indice de confiance, et une information absente qui ne coûte jamais de points.</span></span></div>
      <div><span class="n">02</span><span><b>Un projet d’étudiants</b><span>Neuf personnes, un semestre. Cet écran sert à décider de la direction avant de construire.</span></span></div>
    </div>
    <div class="btns"><button class="btn primaire" id="apropos-ok">Compris</button></div>
  </div></div>

  <nav class="nav">
    <button data-tab="swipe" aria-current="page"><svg><use href="#i-swipe"/></svg>Swipe</button>
    <button data-tab="explorer"><svg><use href="#i-explore"/></svg>Explorer</button>
    <button data-tab="interets"><svg><use href="#i-heart"/></svg><span class="badge" id="nb-likes" hidden></span>Intérêts</button>
    <button data-tab="messages"><svg><use href="#i-chat"/></svg>Messages</button>
    <button data-tab="profil"><svg><use href="#i-user"/></svg>Profil</button>
  </nav>

</div>

<script src="assets/data.js"></script>
<script src="assets/profil.js"></script>
<script src="assets/extraction.js"></script>
<script src="assets/questions.js"></script>
<script src="assets/app.js"></script>
</body>
</html>

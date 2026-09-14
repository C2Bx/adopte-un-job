<?php require __DIR__ . "/guard.php"; ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prototype — Adopte un Job</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/wiki.css">
<style>
.proto{max-width:1180px;margin:0 auto;padding:26px 22px 90px}
.fake{display:flex;align-items:center;gap:10px;background:var(--accent-soft);border:1px solid var(--accent);
  border-radius:12px;padding:11px 15px;margin-bottom:22px;font-size:.88rem;color:var(--ink)}
.fake b{font-family:var(--display)}
.fake .dot{width:9px;height:9px;border-radius:99px;background:var(--accent);flex:none}

.protohead{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin-bottom:20px}
.protohead h1{font-size:clamp(1.7rem,4vw,2.3rem)}
.roles{display:flex;gap:4px;background:var(--sunk);padding:4px;border-radius:11px;margin-left:auto}
.roles button{font:inherit;font-size:.86rem;font-weight:600;border:none;background:none;color:var(--muted);
  padding:7px 15px;border-radius:8px;cursor:pointer}
.roles button.on{background:var(--paper);color:var(--ink);box-shadow:var(--shadow)}
.reset{font:inherit;font-size:.78rem;font-weight:600;border:1px solid var(--line);background:var(--paper);
  color:var(--muted);border-radius:8px;padding:6px 12px;cursor:pointer}

.split{display:grid;grid-template-columns:430px 1fr;gap:28px;align-items:start}
@media (max-width:900px){.split{grid-template-columns:1fr}}

/* ---------------- deck candidat ---------------- */
.deckwrap{position:relative;height:648px;user-select:none;touch-action:none}
.tcard{position:absolute;inset:0;background:#16161A;border-radius:26px;overflow:hidden;color:#F2F2F4;
  border:1px solid #2A2A30;box-shadow:0 18px 40px -26px rgba(0,0,0,.85);display:flex;flex-direction:column;
  font-size:13.5px;line-height:1.45;cursor:grab}
.tcard.drag{cursor:grabbing}
.tcard .segs{display:flex;gap:4px;padding:9px 15px 0}
.tcard .segs i{flex:1;height:3px;border-radius:99px;background:rgba(255,255,255,.2);transition:background .2s}
.tcard .segs i.on{background:#fff}
.tcard .chips{display:flex;gap:12px;padding:11px 19px 6px;font-size:12px;color:#8A8A93}
.tcard .pagebox{flex:1;display:flex;flex-direction:column;min-height:0;padding-top:14px}
.tcard[data-page="0"] .pagebox{justify-content:flex-end;padding-top:0}
.tcard .plead{font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:#8A8A93;font-weight:600;
  margin:0 0 9px;display:flex;align-items:center;gap:8px}
.tcard .plead::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.12)}
.tcard .p{font-size:13.5px;color:#CACAD3;line-height:1.62;overflow:auto;flex:1;min-height:0;
  scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent}
.tcard .p::-webkit-scrollbar{width:4px}
.tcard .p::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:9px}
.tcard .p p{margin:0 0 12px}
.tcard .p ul,.tcard .p ol{margin:0;padding-left:17px}
.tcard .p li{margin-bottom:8px}
.tcard .p b{color:#E9E9EF}
.tcard .kvp{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:12.5px;margin-top:14px}
.tcard .kvp dt{color:#8A8A93}
.tcard .kvp dd{margin:0;color:#E6E6EB}
.tcard .sk{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.tcard .sk span{font-size:11.5px;padding:3px 8px;border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:2px 7px;color:#D6D6DD}
.tcard .sk span.miss{border-color:rgba(255,120,90,.55);color:#FFA88F}
.tcard .sk span.has{border-color:rgba(92,224,168,.45);color:#8DEBC4}
.tcard .two{display:grid;gap:16px}
.tcard .two h5{margin:0 0 5px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600}
.tcard .chips .sel{color:#fff;background:#2A2A30;border-radius:99px;padding:3px 11px;margin:-3px 0}
.tcard .stage{padding:15px 19px 12px;flex:1;display:flex;flex-direction:column;min-height:0;background:
  radial-gradient(120% 80% at 100% 0%, rgba(224,78,46,.2), transparent 60%),
  radial-gradient(100% 70% at 0% 100%, rgba(27,46,79,.5), transparent 65%)}
.tcard .hero{flex:none}
.tcard .score{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.14);border-radius:99px;padding:4px 12px 4px 7px;font-size:11.5px}
.tcard .score i{font-style:normal;font-family:var(--mono);font-weight:600;font-size:13px}
.gauge{width:40px;height:4px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden}
.gauge b{display:block;height:100%}
.tcard .conf{font-size:10.5px;color:#8A8A93;margin-top:6px;font-family:var(--mono)}
.tcard .role{font-family:var(--display);font-size:26px;line-height:1.1;font-weight:600;margin:13px 0 4px;
  transition:font-size .2s ease}
.tcard .org{color:#B9B9C2}
.tcard.pg .role{font-size:18px;margin:11px 0 3px}
.tcard.pg .org{font-size:12px}
.tcard.pg .conf{display:none}
.tcard.pg .hero{padding-bottom:2px}
.tcard .keys{display:flex;flex-wrap:wrap;gap:5px}
.tcard .keys span{font-size:11px;border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:2px 7px;color:#D6D6DD}
.tcard .keys span.miss{border-color:rgba(255,120,90,.5);color:#FFA88F}
.tcard .foot{flex:none;padding:12px 19px 6px}
.tcard .line{display:flex;align-items:center;gap:7px;color:#A7A7B1;font-size:12px;margin-top:5px}
.tcard .line em{font-style:normal;color:#E6E6EB}
.tcard .sep{width:4px;height:4px;border-radius:99px;background:#55555E;flex:none}
.tcard .pass{position:absolute;top:16px;right:15px;background:rgba(224,78,46,.9);color:#fff;font-size:10.5px;
  font-weight:600;padding:3px 9px;border-radius:99px;letter-spacing:.03em;z-index:4}
.stamp{position:absolute;top:78px;font-family:var(--display);font-size:30px;font-weight:600;padding:6px 16px;
  border:3px solid;border-radius:12px;opacity:0;pointer-events:none;z-index:5}
.stamp.yes{left:22px;color:#5CE0A8;border-color:#5CE0A8;transform:rotate(-14deg)}
.stamp.no{right:22px;color:#FF6B6B;border-color:#FF6B6B;transform:rotate(14deg)}
.acts{display:flex;justify-content:center;gap:14px;margin-top:18px}
.acts button{width:52px;height:52px;border-radius:99px;border:1px solid var(--line);background:var(--paper);
  font-size:19px;cursor:pointer;color:var(--ink-2);display:grid;place-items:center}
.acts button:hover{border-color:var(--brand)}
.acts button.no{color:var(--no)}
.acts button.yes{color:var(--ok);width:60px;height:60px;font-size:23px}
.acts button:disabled{opacity:.35;cursor:not-allowed}
.deckdone{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:30px;
  background:var(--paper);border:1px dashed var(--line);border-radius:26px}
.deckdone h3{font-family:var(--display);font-size:1.15rem;margin-bottom:8px}
.deckdone p{font-size:.9rem;color:var(--ink-2);max-width:34ch;margin:0 auto}

/* ---------------- panneau detail ---------------- */
.panel{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:22px}
.panel h2{font-size:1.25rem;margin:0 0 2px}
.panel .sub{color:var(--muted);font-size:.9rem;margin-bottom:16px}
.why{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin:16px 0}
.why ul{margin:8px 0 0;padding-left:18px;font-size:.89rem;color:var(--ink-2)}
.why li{margin-bottom:4px}
.bars{display:grid;gap:9px;margin:16px 0}
.bars .row{display:grid;grid-template-columns:150px 1fr 48px;gap:12px;align-items:center;font-size:.85rem}
.bars .track{height:7px;border-radius:99px;background:var(--sunk);overflow:hidden}
.bars .track i{display:block;height:100%;background:var(--brand)}
.bars .v{font-family:var(--mono);text-align:right;color:var(--muted);font-size:.8rem}
.bars .row.unk .v{color:var(--accent)}
.blockers{background:var(--no-soft);border-radius:11px;padding:12px 15px;margin:14px 0;font-size:.88rem;color:var(--ink-2)}
.blockers b{color:var(--no)}

/* ---------------- liste recruteur ---------------- */
.pick{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px}
.pick select{font:inherit;font-size:.9rem;background:var(--paper);border:1px solid var(--line);border-radius:9px;padding:8px 11px;color:var(--ink)}
.opt{display:flex;align-items:center;gap:7px;font-size:.86rem;color:var(--ink-2);cursor:pointer}
.rows{border:1px solid var(--line);border-radius:14px;background:var(--paper);overflow:hidden}
.row2{display:grid;grid-template-columns:52px 1fr auto;gap:14px;align-items:center;padding:13px 16px;
  border-bottom:1px solid var(--line);cursor:pointer}
.row2:last-child{border-bottom:none}
.row2:hover{background:var(--sunk)}
.rank{font-family:var(--mono);font-weight:600;font-size:1.05rem;text-align:center}
.rank small{display:block;font-size:.62rem;color:var(--muted);font-weight:400;letter-spacing:.06em}
.who2 b{font-weight:600;font-size:.96rem}
.who2 .l{font-size:.82rem;color:var(--muted);margin-top:2px}
.tg{display:inline-block;font-family:var(--mono);font-size:.66rem;font-weight:600;padding:2px 7px;border-radius:5px;
  background:var(--sunk);color:var(--ink-2);margin:3px 3px 0 0}
.tg.rec{background:var(--accent-soft);color:var(--accent)}
.tg.inv{background:var(--ok-soft);color:var(--ok)}
.inviteb{font:inherit;font-size:.82rem;font-weight:600;border:1px solid var(--brand);background:var(--brand);
  color:var(--paper);border-radius:9px;padding:7px 14px;cursor:pointer;white-space:nowrap}
:root[data-theme="dark"] .inviteb,:root:not([data-theme="light"]) .inviteb{color:#0D1218}
@media (prefers-color-scheme:light){.inviteb{color:#fff}}
.inviteb:disabled{background:var(--sunk);border-color:var(--line);color:var(--muted);cursor:default}

/* ---------------- historique ---------------- */
.tabs2{display:flex;gap:18px;border-bottom:1px solid var(--line);margin:26px 0 16px}
.tabs2 button{font:inherit;font-size:.88rem;font-weight:600;background:none;border:none;color:var(--muted);
  padding:9px 0;border-bottom:2px solid transparent;cursor:pointer}
.tabs2 button.on{color:var(--ink);border-bottom-color:var(--accent)}
.hist{display:grid;gap:9px}
.hitem{display:flex;align-items:center;gap:12px;background:var(--paper);border:1px solid var(--line);
  border-radius:11px;padding:11px 14px;font-size:.9rem}
.hitem .g{flex:1;min-width:0}
.hitem .g b{font-weight:600}
.hitem .g div{font-size:.8rem;color:var(--muted)}
.hitem button{font:inherit;font-size:.78rem;font-weight:600;border:1px solid var(--line);background:var(--paper);
  color:var(--ink-2);border-radius:8px;padding:5px 11px;cursor:pointer}
.none{color:var(--muted);font-size:.88rem;padding:14px 2px}

/* ---------------- match ---------------- */
.ov2{position:fixed;inset:0;background:rgba(8,12,18,.62);z-index:60;display:grid;place-items:center;padding:20px}
.mbox{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:28px;width:min(560px,100%);
  box-shadow:var(--shadow);max-height:88vh;overflow:auto;text-align:center}
.mbox h2{font-family:var(--display);font-size:1.9rem;margin-bottom:6px}
.mbox .lead{color:var(--ink-2);margin-bottom:20px}
.three{display:grid;gap:11px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));text-align:left;margin-bottom:18px}
.three div{border:1px solid var(--line);border-radius:12px;padding:13px}
.three b{display:block;font-family:var(--display);font-weight:600;font-size:.98rem;margin-bottom:3px}
.three span{font-size:.83rem;color:var(--ink-2)}
.prov{text-align:left;background:var(--sunk);border-radius:12px;padding:15px;font-size:.87rem;margin-bottom:18px}
.prov h4{margin:0 0 8px;font-family:var(--body);font-size:.74rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}
.prov li{margin-bottom:7px;color:var(--ink-2)}
.prov cite{display:block;font-style:normal;font-size:.76rem;color:var(--muted);font-family:var(--mono)}
.mbox .close{font:inherit;font-size:.9rem;font-weight:600;border:1px solid var(--line);background:var(--paper);
  color:var(--ink);border-radius:10px;padding:9px 20px;cursor:pointer}
.stats2{display:flex;gap:20px;flex-wrap:wrap;font-size:.85rem;color:var(--muted);margin-bottom:14px}
.stats2 b{color:var(--ink);font-family:var(--mono)}

/* ---------------- pages dans la carte ---------------- */
.hint{text-align:center;font-size:.8rem;color:var(--muted);margin-top:12px}
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
      <a href="app.php" aria-current="page"><b>Prototype</b><span>Démo cliquable</span></a>
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

<div class="proto">

  <div class="fake">
    <span class="dot"></span>
    <span><b>Prototype — toutes les données sont inventées.</b> Ces entreprises, ces offres et ces candidats n'existent pas. Le score est réellement calculé par le code de la page, avec les règles arrêtées en version 0.3.</span>
  </div>

  <div class="protohead">
    <div>
      <div class="eyebrow">Démo cliquable</div>
      <h1 class="title" style="margin:6px 0 0">Premier prototype</h1>
    </div>
    <div class="roles">
      <button type="button" data-role="candidat" class="on">Côté candidat</button>
      <button type="button" data-role="recruteur">Côté recruteur</button>
    </div>
    <button class="reset" id="reset" type="button">Recommencer</button>
  </div>

  <!-- ================= CANDIDAT ================= -->
  <section id="vue-candidat">
    <div class="stats2" id="cstats"></div>
    <div class="split">
      <div>
        <div class="pick" style="margin-bottom:12px">
          <label class="opt"><input type="checkbox" id="ouverture"> Ouvert aux métiers proches</label>
        </div>
        <div class="deckwrap" id="deck"></div>
        <div class="acts">
          <button type="button" id="a-back" title="Revenir sur le dernier">↺</button>
          <button type="button" id="a-no" class="no" title="Pas intéressé">✕</button>
          <button type="button" id="a-later" title="Plus tard">☆</button>
          <button type="button" id="a-yes" class="yes" title="Intéressé">♥</button>
        </div>
        <p class="hint">Clique la carte pour faire défiler ses pages · glisse-la ou utilise les boutons pour décider</p>
      </div>
      <div class="panel" id="cdetail"></div>
    </div>

    <div class="tabs2" id="ctabs">
      <button type="button" data-h="aimees" class="on">Intéressé</button>
      <button type="button" data-h="plus_tard">Plus tard</button>
      <button type="button" data-h="refusees">Pas pertinent</button>
      <button type="button" data-h="hors">Hors de mes critères</button>
    </div>
    <div class="hist" id="chist"></div>
  </section>

  <!-- ================= RECRUTEUR ================= -->
  <section id="vue-recruteur" hidden>
    <div class="pick">
      <select id="offreSel"></select>
      <label class="opt"><input type="checkbox" id="recOpt"> Cette offre est ouverte aux reconversions</label>
    </div>
    <div class="split">
      <div>
        <div class="stats2" id="rstats"></div>
        <div class="rows" id="rrows"></div>
      </div>
      <div class="panel" id="rdetail"></div>
    </div>
  </section>

</div>

<div class="ov2" id="matchOv" hidden><div class="mbox" id="matchBox"></div></div>

<button class="themeToggle" id="tt" type="button">Thème</button>
<script src="assets/nav.js"></script>
<script>
(function () {
  'use strict';

  /* =====================================================================
     DONNÉES FICTIVES — secteur pilote : numérique et support informatique
     ===================================================================== */
  var AUJ = new Date('2026-09-08');

  var MOI = {
    prenom: 'Julie', initiale: 'C.',
    metiers: ['support informatique', 'administration systeme'],
    zones: ['Grand Nouméa'],
    contrats: ['CDI'],
    salaireMin: 300000,
    experience: 4,
    formation: 3,            // 1=bac  2=bac+2  3=bac+3  4=bac+5
    dispo: new Date('2026-10-01'),
    teletravail: 'hybride',
    permis: true,
    competences: ['Windows Server', 'Active Directory', 'Réseau', 'GLPI', 'Helpdesk', 'Sauvegarde']
  };

  var OFFRES = [
    { id: 1, titre: 'Technicien support informatique', org: 'Pacific Systems', famille: 'support informatique',
      contrat: 'CDI', zone: 'Grand Nouméa', ville: 'Nouméa', km: 12, salaire: [280000, 320000],
      expMin: 1, formation: 2, permis: true, teletravail: 'hybride', dispo: new Date('2026-11-01'),
      requis: ['Windows Server', 'Réseau', 'Helpdesk'], souhaite: ['GLPI', 'Active Directory'],
      reconversion: true, fin: new Date('2026-11-30'), aDejaInvite: true,
      resume: 'Poste au sein d’une équipe de quatre techniciens, sur un parc de 400 postes réparti sur trois sites.',
      missions: ['Assistance de niveau 1 et 2', 'Gestion du parc et des tickets', 'Préparation des postes', 'Astreinte une semaine sur quatre'],
      avantages: ['Véhicule de service', 'Titres restaurant', 'Formation certifiante la première année'] },

    { id: 2, titre: 'Administrateur systèmes et réseaux', org: 'Sud Réseaux', famille: 'administration systeme',
      contrat: 'CDI', zone: 'Grand Nouméa', ville: 'Dumbéa', km: 9, salaire: [420000, 480000],
      expMin: 4, formation: 3, permis: true, teletravail: 'hybride', dispo: new Date('2026-10-15'),
      requis: ['Linux', 'Réseau', 'Sauvegarde', 'Active Directory'], souhaite: ['Docker', 'Supervision'],
      reconversion: false, fin: new Date('2026-12-15'), aDejaInvite: true,
      resume: 'Reprise et modernisation d’une infrastructure hybride, avec une vraie latitude sur les choix techniques.',
      missions: ['Administration des serveurs Linux et Windows', 'Sécurisation et sauvegardes', 'Supervision', 'Documentation'],
      avantages: ['Treizième mois', 'Deux jours de télétravail', 'Budget formation annuel'] },

    { id: 3, titre: 'Technicien de maintenance informatique', org: 'Koné Services', famille: 'support informatique',
      contrat: 'CDI', zone: 'Nord', ville: 'Koné', km: 240, salaire: [300000, 340000],
      expMin: 2, formation: 2, permis: true, teletravail: 'non', dispo: new Date('2026-10-01'),
      requis: ['Helpdesk', 'Matériel', 'Windows Server'], souhaite: ['Réseau'],
      reconversion: true, fin: new Date('2027-01-10'), aDejaInvite: false,
      resume: 'Poste itinérant sur la province Nord, avec beaucoup d’autonomie et de déplacements.',
      missions: ['Interventions sur site', 'Maintenance préventive', 'Gestion des stocks de pièces'],
      avantages: ['Logement de fonction', 'Prime de déplacement'] },

    { id: 4, titre: 'Développeur web junior', org: 'Lagon Digital', famille: 'developpement',
      contrat: 'CDI', zone: 'Grand Nouméa', ville: 'Nouméa', km: 6, salaire: [320000, 380000],
      expMin: 2, formation: 2, permis: false, teletravail: 'hybride', dispo: new Date('2026-11-15'),
      requis: ['JavaScript', 'HTML/CSS', 'Git'], souhaite: ['React', 'PHP'],
      reconversion: true, fin: new Date('2026-12-01'), aDejaInvite: false,
      resume: 'Agence de six personnes, sites vitrines et applications métier pour des clients locaux.',
      missions: ['Intégration et développement front', 'Maintenance de sites existants', 'Relation client directe'],
      avantages: ['Horaires souples', 'Matériel au choix'] },

    { id: 5, titre: 'Chargé de clientèle numérique', org: 'Océane Télécom', famille: 'relation client',
      contrat: 'CDD', zone: 'Grand Nouméa', ville: 'Nouméa', km: 8, salaire: [260000, 290000],
      expMin: 0, formation: 1, permis: false, teletravail: 'non', dispo: new Date('2026-10-01'),
      requis: ['Relation client', 'Bureautique'], souhaite: ['CRM'],
      reconversion: true, fin: new Date('2026-11-20'), aDejaInvite: false,
      resume: 'Accompagnement des clients particuliers sur les offres internet et mobile.',
      missions: ['Accueil et conseil', 'Diagnostic de premier niveau', 'Suivi des dossiers'],
      avantages: ['Prime sur objectifs', 'Formation interne de trois semaines'] },

    { id: 6, titre: 'Data analyst junior', org: 'Institut Corail', famille: 'donnees',
      contrat: 'CDD', zone: 'Grand Nouméa', ville: 'Nouméa', km: 11, salaire: [350000, 400000],
      expMin: 1, formation: 3, permis: false, teletravail: 'hybride', dispo: new Date('2026-12-01'),
      requis: ['SQL', 'Excel', 'Python'], souhaite: ['Power BI'],
      reconversion: true, fin: new Date('2026-12-20'), aDejaInvite: false,
      resume: 'Analyse de données environnementales pour un institut de recherche appliquée.',
      missions: ['Nettoyage et consolidation des jeux de données', 'Tableaux de bord', 'Restitution aux équipes terrain'],
      avantages: ['Deux jours de télétravail', 'Cadre de travail exceptionnel'] },

    { id: 7, titre: 'Développeur mobile', org: 'Lagon Digital', famille: 'developpement',
      contrat: 'CDI', zone: 'Grand Nouméa', ville: 'Nouméa', km: 6, salaire: null,
      expMin: 3, formation: 2, permis: false, teletravail: 'total', dispo: new Date('2026-11-01'),
      requis: ['React Native', 'Git'], souhaite: ['TypeScript'],
      reconversion: false, fin: new Date('2026-12-31'), aDejaInvite: false,
      resume: 'Applications mobiles pour des acteurs du tourisme et de la logistique.',
      missions: ['Développement iOS et Android', 'Publication sur les magasins', 'Suivi des retours utilisateurs'],
      avantages: ['Télétravail complet possible'] },

    { id: 8, titre: 'Assistant administratif', org: 'Groupe Vallée', famille: 'administratif',
      contrat: 'CDI', zone: 'Grand Nouméa', ville: 'Païta', km: 26, salaire: [240000, 270000],
      expMin: 0, formation: 1, permis: true, teletravail: 'non', dispo: new Date('2026-10-01'),
      requis: ['Bureautique', 'Organisation'], souhaite: [],
      reconversion: true, fin: new Date('2026-12-05'), aDejaInvite: false,
      resume: 'Gestion administrative courante pour une entreprise de négoce.',
      missions: ['Traitement du courrier et des factures', 'Suivi des commandes', 'Accueil téléphonique'],
      avantages: ['Horaires fixes'] },

    { id: 9, titre: 'Technicien réseaux', org: 'Nord Telecom', famille: 'administration systeme',
      contrat: 'CDI', zone: 'Grand Nouméa', ville: 'Nouméa', km: 10, salaire: [380000, 420000],
      expMin: 3, formation: 2, permis: true, teletravail: 'non', dispo: new Date('2026-09-01'),
      requis: ['Réseau', 'Supervision'], souhaite: [],
      reconversion: false, fin: new Date('2026-08-31'), aDejaInvite: false,
      resume: 'Offre volontairement expirée dans le jeu de données, pour montrer le filtre de fraîcheur.',
      missions: [], avantages: [] }
  ];

  // Informations qui n'apparaissent ni sur la carte ni dans le panneau : elles
  // ne se découvrent qu'en ouvrant la fiche complète.
  var DETAILS = {
    1: { taille: '42 salariés', secteurEnt: 'Infogérance et services informatiques', creee: 2009,
         apropos: 'Prestataire historique du secteur privé calédonien, Pacific Systems gère l’informatique d’une trentaine de PME. L’équipe support est stable, avec une ancienneté moyenne de six ans.',
         profil: ['À l’aise à l’oral, le poste est en contact direct avec les utilisateurs', 'Méthodique dans la traçabilité des interventions', 'Curieux : le parc évolue vite'],
         processus: ['Échange téléphonique de 20 minutes', 'Entretien technique sur site avec le responsable', 'Mise en situation sur un cas réel', 'Réponse sous une semaine'],
         horaires: 'Temps plein, 7h30–16h00, astreinte une semaine sur quatre',
         limite: new Date('2026-11-30'), interesses: 7, vues: 64 },
    2: { taille: '18 salariés', secteurEnt: 'Infrastructure et réseaux', creee: 2015,
         apropos: 'Sud Réseaux conçoit et exploite des infrastructures pour des clients industriels. Le poste est ouvert dans le cadre d’une refonte complète du système d’information interne.',
         profil: ['Autonome sur les choix techniques', 'Sensible à la sécurité et à la sauvegarde', 'Capable de documenter ce qu’il met en place'],
         processus: ['Entretien avec le responsable technique', 'Étude de cas à rendre sous 48 h', 'Rencontre de l’équipe', 'Décision sous dix jours'],
         horaires: 'Temps plein, horaires flexibles, deux jours de télétravail',
         limite: new Date('2026-12-15'), interesses: 3, vues: 41 },
    3: { taille: '11 salariés', secteurEnt: 'Maintenance informatique', creee: 2018,
         apropos: 'Koné Services couvre toute la province Nord. Le poste est itinérant, avec un véhicule et une large autonomie d’organisation.',
         profil: ['Permis B indispensable, déplacements quotidiens', 'Débrouillard : souvent seul sur site', 'Bon relationnel avec des publics variés'],
         processus: ['Entretien en visioconférence', 'Journée d’immersion sur le terrain', 'Réponse immédiate'],
         horaires: 'Temps plein, du lundi au vendredi, déplacements province Nord',
         limite: new Date('2027-01-10'), interesses: 2, vues: 19 },
    4: { taille: '6 salariés', secteurEnt: 'Agence web', creee: 2020,
         apropos: 'Lagon Digital réalise des sites et des applications métier pour des clients locaux. Petite structure, chacun touche à tout, du cadrage au déploiement.',
         profil: ['Sensible au détail visuel', 'Capable de parler à un client sans jargon', 'Envie d’apprendre plus que d’avoir déjà tout vu'],
         processus: ['Café informel à l’agence', 'Petit exercice de code à la maison', 'Retour sous cinq jours'],
         horaires: 'Temps plein, horaires souples, deux jours de télétravail',
         limite: new Date('2026-12-01'), interesses: 12, vues: 130 },
    5: { taille: '150 salariés', secteurEnt: 'Télécommunications', creee: 1998,
         apropos: 'Océane Télécom accompagne les particuliers sur ses offres internet et mobile. Le poste ouvre sur une formation interne de trois semaines, sans prérequis technique.',
         profil: ['Patient et clair au téléphone', 'À l’aise avec l’outil informatique', 'Aucune expérience exigée'],
         processus: ['Session collective de découverte', 'Entretien individuel', 'Formation à l’embauche'],
         horaires: 'Temps plein, amplitude 8h–18h par roulement, un samedi sur trois',
         limite: new Date('2026-11-20'), interesses: 24, vues: 210 },
    6: { taille: '35 salariés', secteurEnt: 'Recherche appliquée', creee: 1994,
         apropos: 'L’Institut Corail produit des analyses environnementales pour les collectivités. Le poste appuie les équipes terrain sur le traitement de leurs relevés.',
         profil: ['Rigueur sur la qualité des données', 'Capable de restituer un résultat à un non-spécialiste', 'Intérêt pour l’environnement'],
         processus: ['Entretien avec la responsable données', 'Test pratique sur un jeu de données réel', 'Rencontre de l’équipe terrain'],
         horaires: 'Temps plein, deux jours de télétravail, quelques sorties terrain',
         limite: new Date('2026-12-20'), interesses: 9, vues: 88 },
    7: { taille: '6 salariés', secteurEnt: 'Agence web', creee: 2020,
         apropos: 'Deuxième poste ouvert chez Lagon Digital, cette fois sur le mobile, pour des acteurs du tourisme et de la logistique.',
         profil: ['Expérience réelle de publication sur les magasins', 'Autonome, le poste peut être en télétravail complet', 'Attentif aux retours des utilisateurs'],
         processus: ['Échange visio', 'Revue d’une application déjà publiée', 'Proposition sous une semaine'],
         horaires: 'Temps plein, télétravail complet possible',
         limite: new Date('2026-12-31'), interesses: 5, vues: 52 },
    8: { taille: '80 salariés', secteurEnt: 'Négoce', creee: 1987,
         apropos: 'Groupe Vallée distribue du matériel professionnel. Le poste soutient le service administratif sur la gestion courante.',
         profil: ['Organisé et fiable', 'À l’aise avec un tableur', 'Aucune expérience exigée'],
         processus: ['Entretien avec la responsable administrative', 'Essai d’une demi-journée'],
         horaires: 'Temps plein, 7h30–15h30, sur site',
         limite: new Date('2026-12-05'), interesses: 16, vues: 140 },
    9: { taille: '60 salariés', secteurEnt: 'Télécommunications', creee: 2004,
         apropos: 'Offre volontairement expirée dans le jeu de données, pour montrer le filtre de fraîcheur.',
         profil: [], processus: [], horaires: '—',
         limite: new Date('2026-08-31'), interesses: 0, vues: 0 }
  };

  var CANDIDATS = [
    { id: 1, prenom: 'Julie', initiale: 'C.', famille: 'support informatique', metiers: ['support informatique', 'administration systeme'],
      experience: 4, formation: 3, zones: ['Grand Nouméa'], contrats: ['CDI'], salaireMin: 300000,
      dispo: new Date('2026-10-01'), permis: true, reconversion: false,
      competences: ['Windows Server', 'Active Directory', 'Réseau', 'GLPI', 'Helpdesk', 'Sauvegarde'],
      parcours: 'Quatre ans en support et administration dans une PME de services' },
    { id: 2, prenom: 'Mehdi', initiale: 'T.', famille: 'developpement', metiers: ['developpement'],
      experience: 2, formation: 2, zones: ['Grand Nouméa'], contrats: ['CDI', 'CDD'], salaireMin: null,
      dispo: new Date('2026-09-15'), permis: null, reconversion: false,
      competences: ['JavaScript', 'React', 'Git', 'HTML/CSS'],
      parcours: 'Deux ans en agence web, alternance comprise' },
    { id: 3, prenom: 'Sarah', initiale: 'L.', famille: 'administratif', metiers: ['support informatique'],
      experience: 6, formation: 2, zones: ['Grand Nouméa'], contrats: ['CDI', 'CDD'], salaireMin: 280000,
      dispo: new Date('2026-10-15'), permis: true, reconversion: true,
      competences: ['Bureautique', 'Organisation', 'Relation client', 'Excel'],
      parcours: 'Six ans en comptabilité, en reconversion vers le support informatique' },
    { id: 4, prenom: 'Tom', initiale: 'B.', famille: 'support informatique', metiers: ['support informatique'],
      experience: 1, formation: 2, zones: ['Nord', 'Grand Nouméa'], contrats: ['CDI'], salaireMin: null,
      dispo: new Date('2026-09-20'), permis: true, reconversion: false,
      competences: ['Helpdesk', 'Matériel', 'Windows Server'],
      parcours: 'Un an en maintenance itinérante sur la province Nord' },
    { id: 5, prenom: 'Anaïs', initiale: 'R.', famille: 'donnees', metiers: ['donnees'],
      experience: 1, formation: 3, zones: ['Grand Nouméa'], contrats: ['CDD', 'CDI'], salaireMin: 330000,
      dispo: new Date('2026-12-01'), permis: null, reconversion: false,
      competences: ['SQL', 'Python', 'Excel'],
      parcours: 'Un an d’alternance en analyse de données' },
    { id: 6, prenom: 'Kevin', initiale: 'P.', famille: 'developpement', metiers: ['developpement'],
      experience: 3, formation: 2, zones: ['Grand Nouméa'], contrats: ['CDI'], salaireMin: 400000,
      dispo: new Date('2026-11-01'), permis: false, reconversion: false,
      competences: ['React Native', 'TypeScript', 'Git'],
      parcours: 'Trois ans en développement mobile' }
  ];

  var NIVEAU = { 1: 'Bac', 2: 'Bac+2', 3: 'Bac+3', 4: 'Bac+5' };

  /* =====================================================================
     MOTEUR DE SCORE — règles v0.3
     ===================================================================== */

  // Renvoie {ok, blocages[], vigilances[]}. Une information inconnue ne bloque jamais.
  function contraintes(c, o) {
    var bl = [], vg = [];
    if (c.zones.indexOf(o.zone) === -1) bl.push('Le poste est en zone ' + o.zone + ', hors des zones acceptées');
    if (c.contrats.indexOf(o.contrat) === -1) bl.push('Contrat ' + o.contrat + ', alors que ' + c.contrats.join(' ou ') + ' est recherché');
    if (o.permis) {
      if (c.permis === false) bl.push('Permis B exigé, non détenu');
      else if (c.permis === null || c.permis === undefined) vg.push('Permis B exigé — information non renseignée');
    }
    if (o.salaire && c.salaireMin != null) {
      if (c.salaireMin > o.salaire[1]) bl.push('Le salaire plafonne à ' + fmt(o.salaire[1]) + ', sous le minimum de ' + fmt(c.salaireMin));
    } else if (!o.salaire) {
      vg.push('Salaire non annoncé par l’entreprise');
    }
    return { ok: bl.length === 0, blocages: bl, vigilances: vg };
  }

  function couverture(c, o) {
    var req = o.requis, sou = o.souhaite;
    var a = req.filter(function (s) { return c.competences.indexOf(s) !== -1; });
    var b = sou.filter(function (s) { return c.competences.indexOf(s) !== -1; });
    var nr = req.length ? a.length / req.length : 1;
    var ns = sou.length ? b.length / sou.length : 1;
    return { v: nr * 0.75 + ns * 0.25, req: a, manquantes: req.filter(function (s) { return a.indexOf(s) === -1; }), sou: b };
  }

  // Moyenne pondérée qui ignore les critères sans donnée, et renvoie la confiance.
  function agrege(parts) {
    var num = 0, den = 0, tot = 0, connus = 0;
    parts.forEach(function (p) {
      tot += p.poids;
      if (p.v === null) return;
      num += p.v * p.poids; den += p.poids; connus += p.poids;
    });
    return { score: den ? num / den : 0, confiance: tot ? connus / tot : 0, parts: parts };
  }

  function fitRecruteur(c, o) {
    var cov = couverture(c, o);
    var exp = o.expMin === 0 ? 1 : Math.min(1, c.experience / o.expMin);
    var form = c.formation >= o.formation ? 1 : Math.max(0, 1 - (o.formation - c.formation) * 0.35);
    var dispo = c.dispo <= o.dispo ? 1 : 0.5;
    var r = agrege([
      { cle: 'Compétences', v: cov.v, poids: 45 },
      { cle: 'Expérience', v: exp, poids: 30 },
      { cle: 'Formation', v: form, poids: 15 },
      { cle: 'Disponibilité', v: dispo, poids: 10 }
    ]);
    r.cov = cov;
    return r;
  }

  function fitCandidat(c, o) {
    var direct = c.metiers.indexOf(o.famille) !== -1;
    var metier = direct ? 1 : 0.45;
    var contrat = c.contrats.indexOf(o.contrat) !== -1 ? 1 : 0;
    var salaire = null;
    if (o.salaire && c.salaireMin != null) {
      salaire = c.salaireMin <= o.salaire[0] ? 1 : (c.salaireMin <= o.salaire[1] ? 0.6 : 0);
    }
    var tt = c.teletravail === 'hybride' ? (o.teletravail === 'non' ? 0.4 : 1) : 1;
    var r = agrege([
      { cle: 'Métier visé', v: metier, poids: 40 },
      { cle: 'Contrat', v: contrat, poids: 25 },
      { cle: 'Salaire', v: salaire, poids: 20 },
      { cle: 'Conditions', v: tt, poids: 15 }
    ]);
    r.passerelle = !direct;
    return r;
  }

  function evalue(c, o) {
    var ctr = contraintes(c, o);
    var fr = fitRecruteur(c, o);
    var fc = fitCandidat(c, o);
    return {
      offre: o, candidat: c, contraintes: ctr, fr: fr, fc: fc,
      passerelle: fc.passerelle,
      qualite: Math.min(fr.score, fc.score) * (fc.passerelle ? 0.85 : 1),
      confiance: (fr.confiance + fc.confiance) / 2,
      perime: o.fin < AUJ
    };
  }

  function pourquoi(e) {
    var oui = [], att = [];
    var o = e.offre, c = e.candidat, cov = e.fr.cov;
    if (cov.req.length) oui.push(cov.req.length + ' compétence' + (cov.req.length > 1 ? 's' : '') + ' exigée' + (cov.req.length > 1 ? 's' : '') + ' sur ' + o.requis.length + ' : ' + cov.req.join(', '));
    if (cov.manquantes.length) att.push('Compétence' + (cov.manquantes.length > 1 ? 's' : '') + ' exigée' + (cov.manquantes.length > 1 ? 's' : '') + ' absente' + (cov.manquantes.length > 1 ? 's' : '') + ' : ' + cov.manquantes.join(', '));
    if (o.expMin === 0) oui.push('Aucune expérience exigée');
    else if (c.experience >= o.expMin) oui.push(c.experience + ' ans d’expérience pour ' + o.expMin + ' demandé' + (o.expMin > 1 ? 's' : ''));
    else att.push(o.expMin + ' ans demandés, ' + c.experience + ' déclaré' + (c.experience > 1 ? 's' : ''));
    if (c.formation >= o.formation) oui.push('Niveau ' + NIVEAU[c.formation] + ' pour ' + NIVEAU[o.formation] + ' demandé');
    else att.push('Niveau ' + NIVEAU[o.formation] + ' demandé, ' + NIVEAU[c.formation] + ' déclaré');
    if (c.zones.indexOf(o.zone) !== -1) oui.push('Poste à ' + o.ville + ', dans une zone acceptée');
    if (c.contrats.indexOf(o.contrat) !== -1) oui.push('Contrat ' + o.contrat + ', conforme à la recherche');
    if (o.salaire && c.salaireMin != null) {
      if (c.salaireMin <= o.salaire[0]) oui.push('Salaire annoncé au-dessus du minimum souhaité');
      else if (c.salaireMin <= o.salaire[1]) att.push('Le salaire démarre à ' + fmt(o.salaire[0]) + ', sous le minimum souhaité de ' + fmt(c.salaireMin));
    }
    if (c.dispo <= o.dispo) oui.push('Disponible avant la prise de poste');
    else att.push('Prise de poste le ' + dt(o.dispo) + ', disponibilité annoncée le ' + dt(c.dispo));
    e.contraintes.vigilances.forEach(function (v) { att.push(v); });
    if (e.passerelle) att.push('Métier différent de ceux visés — accessible depuis le parcours');
    return { oui: oui, att: att };
  }

  /* =====================================================================
     ÉTAT
     ===================================================================== */
  var CLE = 'avp.proto.v1';
  var S = { decisions: {}, invites: {}, ouvert: false, recOpt: {}, offreCourante: 1, hist: 'aimees', role: 'candidat' };
  try { var raw = localStorage.getItem(CLE); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
  function save() { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) {} }

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  function fmt(n) { return (n / 1000).toFixed(0) + ' k XPF'; }
  function dt(d) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }
  function pc(v) { return Math.round(v * 100); }
  function couleur(v) { return v >= 0.75 ? '#5CE0A8' : v >= 0.5 ? '#E0A254' : '#FF7B6B'; }
  function niveauConf(v) { return v >= 0.9 ? 'élevée' : v >= 0.6 ? 'moyenne' : 'faible'; }

  /* =====================================================================
     VUE CANDIDAT
     ===================================================================== */
  function evaluations() {
    return OFFRES.map(function (o) { return evalue(MOI, o); });
  }
  function deckOffres() {
    return evaluations()
      .filter(function (e) {
        if (e.perime) return false;
        if (!e.contraintes.ok) return false;
        if (e.passerelle && !S.ouvert) return false;
        return !S.decisions[e.offre.id];
      })
      .sort(function (a, b) { return b.qualite - a.qualite; });
  }

  var drag = null, dernierGlissement = 0;

  // ---- pages internes de la carte, parcourues en boucle ----
  function pages(e) {
    var o = e.offre, d = DETAILS[o.id], w = pourquoi(e);
    var jours = Math.max(0, Math.round((d.limite - AUJ) / 86400000));

    function skills(liste, marque) {
      return '<div class="sk">' + liste.map(function (c) {
        var ok = MOI.competences.indexOf(c) !== -1;
        return '<span class="' + (ok ? 'has' : (marque ? 'miss' : '')) + '">' + esc(c) + (ok || !marque ? '' : ' \u2014 absente') + '</span>';
      }).join('') + '</div>';
    }

    return [
      { n: 'Résumé', html:
        '<div class="keys">' +
          e.fr.cov.req.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') +
          e.fr.cov.manquantes.slice(0, 2).map(function (x) { return '<span class="miss">' + esc(x) + ' ?</span>'; }).join('') +
        '</div>' },

      { n: 'Entreprise', html:
        '<div class="plead">L’entreprise</div><div class="p"><p>' + esc(d.apropos) + '</p>' +
        '<dl class="kvp"><dt>Effectif</dt><dd>' + esc(d.taille) + '</dd>' +
        '<dt>Secteur</dt><dd>' + esc(d.secteurEnt) + '</dd>' +
        '<dt>Créée en</dt><dd>' + d.creee + '</dd></dl></div>' },

      { n: 'Poste', html:
        '<div class="plead">Le poste</div><div class="p"><p>' + esc(o.resume) + '</p>' +
        (o.missions.length ? '<p><b>Missions</b></p><ul>' + o.missions.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
        '<p style="margin-top:10px"><b>Horaires</b> — ' + esc(d.horaires) + '</p></div>' },

      { n: 'Profil', html:
        '<div class="plead">Profil · ' + (o.expMin ? o.expMin + ' ans mini' : 'débutant accepté') + ' · ' + NIVEAU[o.formation] + '</div>' +
        '<div class="p">' +
        (d.profil.length ? '<ul>' + d.profil.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
        '<p style="margin-top:11px"><b>Exigées</b></p>' + skills(o.requis, true) +
        (o.souhaite.length ? '<p style="margin-top:9px"><b>Souhaitées</b></p>' + skills(o.souhaite, false) : '') +
        '</div>' },

      { n: 'Recrutement', html:
        '<div class="plead">Conditions et recrutement</div><div class="p">' +
        (o.avantages.length ? '<p><b>Avantages</b></p><ul>' + o.avantages.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
        (d.processus.length ? '<p style="margin-top:10px"><b>Le recrutement</b></p><ol>' + d.processus.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ol>' : '') +
        '<p style="margin-top:10px;color:#8A8A93">Ouverte encore ' + jours + ' jours · ' + d.vues + ' vues, ' + d.interesses + ' intéressés</p>' +
        '</div>' },

      { n: 'Score', html:
        '<div class="plead">Pourquoi ce score</div><div class="p two">' +
        '<div><h5 style="color:#5CE0A8">Ce qui colle</h5><ul>' + w.oui.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><h5 style="color:#E0A254">À vérifier</h5><ul>' + (w.att.length ? w.att.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li>Rien à signaler</li>') + '</ul></div>' +
        (e.contraintes.blocages.length ? '<div><h5 style="color:#FF7B6B">Hors de tes critères</h5><ul>' +
          e.contraintes.blocages.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
          '</ul><p style="margin-top:6px;color:#8A8A93">L’offre reste visible avec son motif : rien ne disparaît en silence.</p></div>' : '') +
        '</div>' }
    ];
  }

  function vaPage(el, e, dir) {
    var ps = pages(e);
    var i = (parseInt(el.dataset.page, 10) || 0);
    i = (i + dir + ps.length) % ps.length;          // boucle dans les deux sens
    el.dataset.page = String(i);
    el.classList.toggle('pg', i !== 0);
    var box = el.querySelector('.pagebox');
    box.style.transition = 'none';
    box.style.transform = 'translateX(' + (dir > 0 ? 34 : -34) + 'px)';
    box.style.opacity = '0';
    box.innerHTML = ps[i].html;
    Array.prototype.forEach.call(el.querySelectorAll('.segs i'), function (sg, k) {
      sg.classList.toggle('on', k === i);
    });
    requestAnimationFrame(function () {
      box.style.transition = 'transform .22s ease, opacity .22s ease';
      box.style.transform = 'none';
      box.style.opacity = '1';
    });
  }
  function renderDeck() {
    var host = $('#deck');
    var list = deckOffres();
    host.innerHTML = '';
    if (!list.length) {
      var vus = Object.keys(S.decisions).length;
      var hors = evaluations().filter(function (e) { return !e.perime && !e.contraintes.ok; }).length;
      var pass = evaluations().filter(function (e) { return !e.perime && e.contraintes.ok && e.passerelle && !S.ouvert; }).length;
      host.innerHTML = '<div class="deckdone"><div><h3>Tu as vu les ' + vus + ' opportunités pertinentes</h3>' +
        '<p>Il n’y a pas d’autre offre ouverte qui corresponde à tes critères aujourd’hui. ' +
        (pass ? pass + ' offre' + (pass > 1 ? 's' : '') + ' accessible' + (pass > 1 ? 's' : '') + ' depuis ton parcours ' + (pass > 1 ? 'attendent' : 'attend') + ' que tu ouvres aux métiers proches. ' : '') +
        (hors ? hors + ' autre' + (hors > 1 ? 's' : '') + ' sont hors de tes critères, avec le motif, dans l’onglet du bas.' : '') +
        '</p></div></div>';
      maj();
      return;
    }
    list.slice(0, 3).reverse().forEach(function (e, i, arr) {
      var top = (i === arr.length - 1);
      var o = e.offre, q = e.qualite;
      var el = document.createElement('article');
      el.className = 'tcard';
      el.dataset.page = '0';
      var ps = pages(e);
      var d = arr.length - 1 - i;
      el.style.transform = 'translateY(' + (d * 9) + 'px) scale(' + (1 - d * 0.03) + ')';
      el.style.zIndex = String(10 + i);
      el.innerHTML =
        (e.passerelle ? '<span class="pass">accessible depuis ton parcours</span>' : '') +
        '<div class="stamp yes">OUI</div><div class="stamp no">NON</div>' +
        '<div class="segs">' + ps.map(function (_, k) { return '<i class="' + (k ? '' : 'on') + '"></i>'; }).join('') + '</div>' +
        '<div class="chips"><span class="sel">Pour toi</span><span>Proches</span><span>Télétravail</span></div>' +
        '<div class="stage">' +
          '<div class="hero">' +
            '<div class="score"><span class="gauge"><b style="width:' + pc(q) + '%;background:' + couleur(q) + '"></b></span>' +
            '<i style="color:' + couleur(q) + '">' + pc(q) + ' %</i> compatible</div>' +
            '<div class="conf">confiance ' + niveauConf(e.confiance) + ' · ' + pc(e.confiance) + ' % des critères renseignés</div>' +
            '<div class="role">' + esc(o.titre) + '</div>' +
            '<div class="org">' + esc(o.org) + ' · ' + esc(o.ville) + '</div>' +
          '</div>' +
          '<div class="pagebox">' + ps[0].html + '</div>' +
        '</div>' +
        '<div class="foot">' +
          '<div class="line">' + o.km + ' km <span class="sep"></span> <em>' + esc(o.ville) + '</em> <span class="sep"></span> ' + (o.teletravail === 'non' ? 'sur site' : 'télétravail ' + o.teletravail) + '</div>' +
          '<div class="line"><em>' + o.contrat + '</em> <span class="sep"></span> dès le ' + dt(o.dispo) + '</div>' +
          '<div class="line">' + (o.salaire ? '<em>' + fmt(o.salaire[0]) + ' – ' + fmt(o.salaire[1]) + '</em>' : '<em>salaire non annoncé</em>') + '</div>' +
        '</div>';
      el.addEventListener('click', function (ev) {
        if (Date.now() - dernierGlissement < 300) return;   // on sort d'un glissement
        var r = el.getBoundingClientRect();
        vaPage(el, e, (ev.clientX - r.left) < r.width * 0.34 ? -1 : 1);
      });
      if (top) armeGeste(el, e);
      host.appendChild(el);
    });
    montreOffre(list[0]);
    maj();
  }

  function armeGeste(el, e) {
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button) return;
      drag = { x0: ev.clientX, y0: ev.clientY, moved: false };
      el.setPointerCapture(ev.pointerId);
      el.classList.add('drag');
    });
    el.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      if (Math.abs(dx) > 5) drag.moved = true;
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx / 22) + 'deg)';
      el.querySelector('.stamp.yes').style.opacity = String(Math.max(0, Math.min(1, dx / 90)));
      el.querySelector('.stamp.no').style.opacity = String(Math.max(0, Math.min(1, -dx / 90)));
    });
    function fin(ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x0;
      el.classList.remove('drag');
      if (drag.moved) dernierGlissement = Date.now();
      if (dx > 95) { decide(e.offre.id, 'aimees'); }
      else if (dx < -95) { decide(e.offre.id, 'refusees'); }
      else {
        el.style.transition = 'transform .18s ease';
        el.style.transform = 'translateY(0) scale(1)';
        el.querySelector('.stamp.yes').style.opacity = '0';
        el.querySelector('.stamp.no').style.opacity = '0';
        setTimeout(function () { el.style.transition = ''; }, 200);
      }
      drag = null;
    }
    el.addEventListener('pointerup', fin);
    el.addEventListener('pointercancel', function () { drag = null; });
  }

  function decide(id, quoi) {
    S.decisions[id] = { etat: quoi, quand: Date.now() };
    S.dernier = id;
    save();
    var o = OFFRES.filter(function (x) { return x.id === id; })[0];
    if (quoi === 'aimees' && o.aDejaInvite) {
      renderDeck(); renderHist();
      montreMatch(evalue(MOI, o));
      return;
    }
    renderDeck(); renderHist();
  }

  function montreOffre(e) {
    if (!e) { $('#cdetail').innerHTML = '<p class="none">Aucune offre à afficher.</p>'; return; }
    var o = e.offre, p = pourquoi(e);
    $('#cdetail').innerHTML =
      '<h2>' + esc(o.titre) + '</h2>' +
      '<div class="sub">' + esc(o.org) + ' · ' + esc(o.ville) + ' · ' + o.contrat + (o.salaire ? ' · ' + fmt(o.salaire[0]) + ' – ' + fmt(o.salaire[1]) : ' · salaire non annoncé') + '</div>' +
      (e.contraintes.blocages.length ? '<div class="blockers"><b>Hors de tes critères</b><ul style="margin:6px 0 0;padding-left:18px">' +
        e.contraintes.blocages.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') +
        '</ul><p style="margin:8px 0 0;font-size:.83rem">L’offre reste consultable : rien ne disparaît sans motif.</p></div>' : '') +
      '<p style="font-size:.92rem;color:var(--ink-2)">' + esc(o.resume) + '</p>' +
      '<div class="bars">' + barres(e) + '</div>' +
      '<div class="why">' +
        '<div><div class="eyebrow" style="color:var(--ok)">Pourquoi ça colle</div><ul>' +
          p.oui.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><div class="eyebrow" style="color:var(--accent)">Points à vérifier</div><ul>' +
          (p.att.length ? p.att.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li>Rien à signaler</li>') + '</ul></div>' +
      '</div>' +
      (o.missions.length ? '<h3 style="font-size:.95rem;margin:18px 0 6px">Missions</h3><ul style="font-size:.9rem;color:var(--ink-2)">' +
        o.missions.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
      (o.avantages.length ? '<h3 style="font-size:.95rem;margin:16px 0 6px">Avantages</h3><ul style="font-size:.9rem;color:var(--ink-2)">' +
        o.avantages.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
      '<p style="font-size:.8rem;color:var(--muted);margin-top:16px">Offre ouverte jusqu’au ' + dt(o.fin) + ' · confirmée récemment par l’entreprise</p>';
  }

  function barres(e) {
    var rows = [];
    function pousse(titre, parts) {
      parts.forEach(function (p) {
        var inconnu = p.v === null;
        rows.push('<div class="row' + (inconnu ? ' unk' : '') + '"><span>' + p.cle + '</span>' +
          '<span class="track"><i style="width:' + (inconnu ? 0 : pc(p.v)) + '%;background:' + (inconnu ? 'var(--line)' : couleur(p.v)) + '"></i></span>' +
          '<span class="v">' + (inconnu ? 'inconnu' : pc(p.v) + ' %') + '</span></div>');
      });
    }
    pousse('r', e.fr.parts);
    pousse('c', e.fc.parts);
    return '<div class="eyebrow" style="margin-bottom:4px">Ce que l’entreprise regarde &nbsp;·&nbsp; ce que tu regardes</div>' + rows.join('');
  }

  function renderHist() {
    var host = $('#chist');
    var items = [];
    if (S.hist === 'hors') {
      items = evaluations().filter(function (e) { return !e.perime && !e.contraintes.ok; }).map(function (e) {
        return { e: e, motif: e.contraintes.blocages[0] };
      });
    } else {
      items = Object.keys(S.decisions)
        .filter(function (id) { return S.decisions[id].etat === S.hist; })
        .map(function (id) {
          var o = OFFRES.filter(function (x) { return x.id === +id; })[0];
          return { e: evalue(MOI, o) };
        });
    }
    if (!items.length) { host.innerHTML = '<p class="none">Rien dans cette liste pour l’instant.</p>'; return; }
    host.innerHTML = items.map(function (it) {
      var o = it.e.offre;
      return '<div class="hitem"><span class="tg">' + pc(it.e.qualite) + ' %</span>' +
        '<span class="g"><b>' + esc(o.titre) + '</b><div>' + esc(o.org) + ' · ' + esc(o.ville) +
        (it.motif ? ' — ' + esc(it.motif) : '') + '</div></span>' +
        (S.hist === 'hors' ? '' : '<button type="button" data-r="' + o.id + '">Remettre dans le deck</button>') +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(host.querySelectorAll('button[data-r]'), function (b) {
      b.onclick = function () { delete S.decisions[b.dataset.r]; save(); renderDeck(); renderHist(); };
    });
  }

  function maj() {
    var evs = evaluations();
    var actives = evs.filter(function (e) { return !e.perime; });
    var vues = Object.keys(S.decisions).length;
    var aimees = Object.keys(S.decisions).filter(function (k) { return S.decisions[k].etat === 'aimees'; }).length;
    $('#cstats').innerHTML =
      '<span><b>' + actives.length + '</b> offres ouvertes</span>' +
      '<span><b>' + (evs.length - actives.length) + '</b> écartée par la date de fin</span>' +
      '<span><b>' + vues + '</b> décidées</span>' +
      '<span><b>' + aimees + '</b> qui t’intéressent</span>';
    $('#a-back').disabled = !S.dernier || !S.decisions[S.dernier];
    var reste = deckOffres().length;
    ['a-no', 'a-later', 'a-yes'].forEach(function (i) { $('#' + i).disabled = !reste; });
  }

  /* =====================================================================
     VUE RECRUTEUR — liste classée, pas de deck
     ===================================================================== */
  function renderRecruteur() {
    var o = OFFRES.filter(function (x) { return x.id === S.offreCourante; })[0];
    $('#recOpt').checked = !!S.recOpt[o.id];
    var ouvert = !!S.recOpt[o.id];

    var evs = CANDIDATS.map(function (c) {
      var e = evalue(c, o);
      e.reconv = c.metiers.indexOf(o.famille) !== -1 && c.famille !== o.famille;
      return e;
    }).filter(function (e) {
      if (!e.contraintes.ok) return false;
      if (e.reconv && !ouvert) return false;
      return true;
    }).sort(function (a, b) { return b.fr.score - a.fr.score; });

    var exclus = CANDIDATS.length - evs.length;
    $('#rstats').innerHTML =
      '<span><b>' + evs.length + '</b> profils proposés</span>' +
      '<span><b>' + exclus + '</b> écartés par les contraintes ou la reconversion</span>' +
      '<span>offre <b>' + esc(o.titre) + '</b></span>';

    $('#rrows').innerHTML = evs.length ? evs.map(function (e, i) {
      var c = e.candidat;
      var inv = S.invites[o.id + '-' + c.id];
      return '<div class="row2" data-c="' + c.id + '">' +
        '<span class="rank" style="color:' + couleur(e.fr.score) + '">' + pc(e.fr.score) + '<small>SUR 100</small></span>' +
        '<span class="who2"><b>' + esc(c.prenom + ' ' + c.initiale) + '</b>' +
        '<div class="l">' + esc(c.parcours) + '</div>' +
        '<span class="tg">' + c.experience + ' ans</span>' +
        '<span class="tg">' + NIVEAU[c.formation] + '</span>' +
        '<span class="tg">confiance ' + niveauConf(e.confiance) + '</span>' +
        (e.reconv ? '<span class="tg rec">reconversion</span>' : '') +
        (inv ? '<span class="tg inv">invité</span>' : '') +
        '</span>' +
        '<button class="inviteb" data-i="' + c.id + '"' + (inv ? ' disabled' : '') + '>' + (inv ? 'Invité' : 'Inviter') + '</button>' +
        '</div>';
    }).join('') : '<p class="none" style="padding:22px">Aucun profil ne passe les contraintes de cette offre. ' +
      (ouvert ? '' : 'Ouvre-la aux reconversions pour élargir.') + '</p>';

    Array.prototype.forEach.call($('#rrows').querySelectorAll('.row2'), function (r) {
      r.addEventListener('click', function (ev) {
        if (ev.target.classList.contains('inviteb')) return;
        var c = CANDIDATS.filter(function (x) { return x.id === +r.dataset.c; })[0];
        montreCandidat(evalue(c, o));
        if ($('#rdetail').scrollIntoView) $('#rdetail').scrollIntoView({ block: 'nearest' });
      });
    });
    Array.prototype.forEach.call($('#rrows').querySelectorAll('.inviteb'), function (b) {
      b.addEventListener('click', function () {
        var c = CANDIDATS.filter(function (x) { return x.id === +b.dataset.i; })[0];
        S.invites[o.id + '-' + c.id] = true; save();
        renderRecruteur();
        if (c.id === 1 && S.decisions[o.id] && S.decisions[o.id].etat === 'aimees') montreMatch(evalue(MOI, o));
        else montreCandidat(evalue(c, o), true);
      });
    });

    if (evs.length) montreCandidat(evs[0]); else $('#rdetail').innerHTML = '<p class="none">Sélectionne un profil.</p>';
  }

  function montreCandidat(e, invite) {
    var c = e.candidat, o = e.offre, p = pourquoi(e);
    $('#rdetail').innerHTML =
      '<h2>' + esc(c.prenom + ' ' + c.initiale) + '</h2>' +
      '<div class="sub">' + esc(c.parcours) + '</div>' +
      (invite ? '<div class="blockers" style="background:var(--ok-soft)"><b style="color:var(--ok)">Invitation envoyée.</b> Le match sera créé si la personne accepte.</div>' : '') +
      '<div class="bars">' + barres(e) + '</div>' +
      '<div class="why">' +
        '<div><div class="eyebrow" style="color:var(--ok)">Ce qui correspond</div><ul>' +
          p.oui.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><div class="eyebrow" style="color:var(--accent)">Points à vérifier</div><ul>' +
          (p.att.length ? p.att.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li>Rien à signaler</li>') + '</ul></div>' +
      '</div>' +
      '<h3 style="font-size:.95rem;margin:18px 0 6px">Compétences déclarées</h3>' +
      '<div>' + c.competences.map(function (s) {
        var d = o.requis.indexOf(s) !== -1;
        return '<span class="tg' + (d ? ' inv' : '') + '">' + esc(s) + '</span>';
      }).join('') + '</div>' +
      '<div class="blockers" style="background:var(--sunk);margin-top:18px"><b style="color:var(--ink)">Ce qui reste masqué</b>' +
      '<p style="margin:6px 0 0">Nom complet, coordonnées, employeurs nommés, établissement de formation et CV d’origine ne seront visibles qu’après le match. Le lieu de résidence n’est jamais collecté, seulement les zones acceptées. Aucune photo, ni avant ni après.</p></div>';
  }

  /* =====================================================================
     MATCH
     ===================================================================== */
  function montreMatch(e) {
    var o = e.offre, p = pourquoi(e);
    $('#matchBox').innerHTML =
      '<h2>C’est un match</h2>' +
      '<p class="lead">' + esc(o.org) + ' et toi êtes intéressés par le poste de ' + esc(o.titre) + '.</p>' +
      '<div class="three">' +
        '<div><b>Candidature ciblée</b><span>Ton profil recentré sur cette offre, que tu valides avant envoi.</span></div>' +
        '<div><b>Créneaux</b><span>Trois propositions de l’entreprise, tu en choisis une.</span></div>' +
        '<div><b>Conversation</b><span>Un fil de discussion, et les coordonnées enfin visibles.</span></div>' +
      '</div>' +
      '<div class="prov"><h4>Candidature ciblée — chaque fait garde sa source</h4><ul style="margin:0;padding-left:18px">' +
        e.fr.cov.req.map(function (s) {
          return '<li>' + esc(s) + '<cite>déclarée dans : Technicien support, PME de services, 2022–2026</cite></li>';
        }).join('') +
        '<li>' + MOI.experience + ' ans d’expérience en support et administration<cite>calculé depuis les dates du parcours</cite></li>' +
      '</ul><p style="margin:10px 0 0;font-size:.8rem;color:var(--muted)">Rien n’est reformulé ni ajouté : le générateur sélectionne et réordonne, il n’écrit aucun fait nouveau.</p></div>' +
      '<button class="close" type="button" id="mclose">Fermer</button>';
    $('#matchOv').hidden = false;
    $('#mclose').onclick = function () { $('#matchOv').hidden = true; };
  }
  $('#matchOv').addEventListener('click', function (ev) { if (ev.target === $('#matchOv')) $('#matchOv').hidden = true; });

  /* =====================================================================
     BRANCHEMENTS
     ===================================================================== */
  $('#a-yes').onclick = function () { var l = deckOffres(); if (l.length) decide(l[0].offre.id, 'aimees'); };
  $('#a-no').onclick = function () { var l = deckOffres(); if (l.length) decide(l[0].offre.id, 'refusees'); };
  $('#a-later').onclick = function () { var l = deckOffres(); if (l.length) decide(l[0].offre.id, 'plus_tard'); };
  $('#a-back').onclick = function () {
    if (S.dernier && S.decisions[S.dernier]) { delete S.decisions[S.dernier]; S.dernier = null; save(); renderDeck(); renderHist(); }
  };
  $('#ouverture').onchange = function () { S.ouvert = this.checked; save(); renderDeck(); renderHist(); };

  Array.prototype.forEach.call(document.querySelectorAll('#ctabs button'), function (b) {
    b.onclick = function () {
      S.hist = b.dataset.h; save();
      Array.prototype.forEach.call(document.querySelectorAll('#ctabs button'), function (x) { x.classList.toggle('on', x === b); });
      renderHist();
    };
  });

  Array.prototype.forEach.call(document.querySelectorAll('.roles button'), function (b) {
    b.onclick = function () {
      S.role = b.dataset.role; save();
      Array.prototype.forEach.call(document.querySelectorAll('.roles button'), function (x) { x.classList.toggle('on', x === b); });
      $('#vue-candidat').hidden = S.role !== 'candidat';
      $('#vue-recruteur').hidden = S.role !== 'recruteur';
      if (S.role === 'recruteur') renderRecruteur(); else renderDeck();
    };
  });

  $('#offreSel').innerHTML = OFFRES.filter(function (o) { return o.fin >= AUJ; }).map(function (o) {
    return '<option value="' + o.id + '">' + esc(o.titre) + ' — ' + esc(o.org) + '</option>';
  }).join('');
  $('#offreSel').value = String(S.offreCourante);
  $('#offreSel').onchange = function () { S.offreCourante = +this.value; save(); renderRecruteur(); };
  $('#recOpt').onchange = function () { S.recOpt[S.offreCourante] = this.checked; save(); renderRecruteur(); };

  $('#reset').onclick = function () {
    if (!confirm('Effacer toutes tes décisions et repartir de zéro ?')) return;
    S = { decisions: {}, invites: {}, ouvert: false, recOpt: {}, offreCourante: 1, hist: 'aimees', role: S.role };
    save(); location.reload();
  };

  try { var th = localStorage.getItem('aj.theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) {}
  $('#tt').onclick = function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : cur === 'light' ? 'dark' : (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('aj.theme', next); } catch (e) {}
  };

  // démarrage
  $('#ouverture').checked = S.ouvert;
  Array.prototype.forEach.call(document.querySelectorAll('#ctabs button'), function (x) { x.classList.toggle('on', x.dataset.h === S.hist); });
  Array.prototype.forEach.call(document.querySelectorAll('.roles button'), function (x) { x.classList.toggle('on', x.dataset.role === S.role); });
  $('#vue-candidat').hidden = S.role !== 'candidat';
  $('#vue-recruteur').hidden = S.role !== 'recruteur';
  renderDeck();
  renderHist();
  renderRecruteur();
})();
</script>
</body>
</html>

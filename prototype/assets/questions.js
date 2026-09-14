/* Adopte un Job — questionnaires guidés.
   Une question à la fois : sur mobile, un formulaire long est abandonné, une
   suite de questions courtes est terminée. Chaque réponse alimente le score. */
(function () {
  'use strict';

  var D = window.AJ_DATA;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  var ZONES = ['Grand Nouméa', 'Sud', 'Nord', 'Îles'];
  var CONTRATS = ['CDI', 'CDD', 'Alternance', 'Intérim'];
  var METIERS = ['support informatique', 'administration systeme', 'developpement', 'donnees',
    'relation client', 'commerce', 'comptabilite', 'rh', 'logistique', 'btp', 'sante',
    'restauration', 'hotellerie', 'securite', 'telecom', 'industrie', 'formation', 'environnement'];
  var GENES = [
    ['nuit', 'Le travail de nuit'],
    ['weekend', 'Le travail le week-end'],
    ['deplacements', 'Les déplacements fréquents'],
    ['coupures', 'Les horaires coupés'],
    ['astreinte', 'Les astreintes']
  ];

  /* Les offres existantes n'ont pas de champ « contraintes » : on le déduit de
     leurs horaires. Une vraie offre le déclarerait, comme celles créées ici. */
  function contraintesDe(o) {
    if (o.contraintes) return o.contraintes;
    var t = ((o.horaires || '') + ' ' + (o.resume || '')).toLowerCase();
    var l = [];
    if (/nuit/.test(t)) l.push('nuit');
    if (/samedi|week-?end/.test(t)) l.push('weekend');
    if (/déplacement|itinérant|province|terrain/.test(t)) l.push('deplacements');
    if (/coupure/.test(t)) l.push('coupures');
    if (/astreinte/.test(t)) l.push('astreinte');
    o.contraintes = l;
    return l;
  }
  D.offres.forEach(contraintesDe);

  /* --------------------------------------------------- les deux jeux ------ */
  var CANDIDAT = [
    { cle: 'ouverture', type: 'choix', titre: 'Qu’est-ce que tu cherches ?',
      aide: 'Ça décide de ce qui entre dans ton deck. Tu pourras le changer à tout moment.',
      options: [
        ['strict', 'Un poste dans mon métier', 'Uniquement les offres du ou des métiers que je vise.'],
        ['ouvert', 'Mon métier, ou juste à côté', 'Les métiers proches entrent aussi, avec une étiquette.']
      ] },
    { cle: 'metiers', type: 'multi', max: 3, titre: 'Quels métiers vises-tu ?',
      aide: 'Trois au maximum. C’est ton projet qui compte, pas ton passé : le score compare l’offre à ce que tu vises.',
      options: METIERS.map(function (m) { return [m, m]; }) },
    { cle: 'zones', type: 'multi', titre: 'Où acceptes-tu de travailler ?',
      aide: 'On ne te demande pas où tu habites : le lieu de résidence est un critère de discrimination et n’a aucune utilité pour le score.',
      options: ZONES.map(function (z) { return [z, z]; }) },
    { cle: 'contrats', type: 'multi', titre: 'Quels types de contrat ?',
      options: CONTRATS.map(function (c) { return [c, c]; }) },
    { cle: 'dispoChoix', type: 'choix', titre: 'À partir de quand es-tu disponible ?',
      options: [
        ['now', 'Tout de suite', ''],
        ['1', 'Dans un mois', 'Préavis court.'],
        ['3', 'Dans trois mois', 'Préavis classique.'],
        ['6', 'Dans six mois ou plus', '']
      ] },
    { cle: 'salaireMin', type: 'choix', titre: 'En dessous de quel salaire mensuel n’irais-tu pas ?',
      aide: 'Répondre « je préfère ne pas le dire » n’enlève aucun point : le critère est simplement ignoré, et la confiance du score baisse un peu.',
      options: [
        [null, 'Je préfère ne pas le dire', 'Le critère salaire sera neutralisé.'],
        [250000, '250 000 XPF', ''], [300000, '300 000 XPF', ''],
        [350000, '350 000 XPF', ''], [400000, '400 000 XPF', ''], [500000, '500 000 XPF et plus', '']
      ] },
    { cle: 'teletravail', type: 'choix', titre: 'Le télétravail, pour toi ?',
      options: [
        ['peu importe', 'Peu importe', ''],
        ['hybride', 'J’aimerais quelques jours', ''],
        ['total', 'Je le veux complet', ''],
        ['non', 'Je préfère être sur site', '']
      ] },
    { cle: 'refus', type: 'multi', titre: 'Y a-t-il des choses que tu refuses ?',
      aide: 'Ce sont des critères éliminatoires : une offre qui les contient ne remontera pas, et on te dira pourquoi. Rien de coché est une réponse valable.',
      options: GENES },
    { cle: 'permis', type: 'choix', titre: 'As-tu le permis B ?',
      aide: 'Non renseigné n’élimine jamais une offre : ça devient un point à vérifier.',
      options: [[true, 'Oui', ''], [false, 'Non', ''], [null, 'Je préfère ne pas répondre', '']] }
  ];

  var OFFRE = [
    { cle: 'titre', type: 'texte', titre: 'Quel est l’intitulé du poste ?',
      aide: 'Celui que le candidat lira en gros sur la carte.', placeholder: 'ex. Technicien support informatique' },
    { cle: 'org', type: 'texte', titre: 'Quelle entreprise recrute ?', placeholder: 'Nom de l’entreprise' },
    { cle: 'famille', type: 'choix', titre: 'De quel métier s’agit-il ?',
      aide: 'Sert à savoir quels profils sont dans le métier, et lesquels y accèdent par passerelle.',
      options: METIERS.map(function (m) { return [m, m]; }) },
    { cle: 'contrat', type: 'choix', titre: 'Quel type de contrat ?',
      options: CONTRATS.map(function (c) { return [c, c]; }) },
    { cle: 'zone', type: 'choix', titre: 'Dans quelle zone ?', options: ZONES.map(function (z) { return [z, z]; }) },
    { cle: 'ville', type: 'texte', titre: 'Dans quelle commune ?', placeholder: 'ex. Nouméa' },
    { cle: 'salaire', type: 'choix', titre: 'Quelle fourchette de salaire annonces-tu ?',
      aide: 'C’est le critère le plus décisif côté candidat, et le plus souvent absent des annonces. Ne pas l’annoncer réduit la confiance du score, sans pénaliser personne.',
      options: [
        [null, 'Je préfère ne pas l’annoncer', 'Le critère sera neutralisé des deux côtés.'],
        ['250000-300000', '250 à 300 k XPF', ''], ['300000-350000', '300 à 350 k XPF', ''],
        ['350000-420000', '350 à 420 k XPF', ''], ['420000-500000', '420 à 500 k XPF', ''],
        ['500000-650000', '500 à 650 k XPF', '']
      ] },
    { cle: 'expMin', type: 'choix', titre: 'Combien d’expérience exiges-tu ?',
      options: [[0, 'Aucune, débutant accepté', ''], [1, 'Un an', ''], [2, 'Deux ans', ''],
        [3, 'Trois ans', ''], [5, 'Cinq ans et plus', '']] },
    { cle: 'formation', type: 'choix', titre: 'Quel niveau de formation attends-tu ?',
      options: [[1, 'Bac ou sans diplôme', ''], [2, 'Bac+2', ''], [3, 'Bac+3', ''], [4, 'Bac+5', '']] },
    { cle: 'requis', type: 'liste', titre: 'Quelles compétences sont exigées ?',
      aide: 'Exigées veut dire : sans elles, la personne ne peut pas tenir le poste. Sois avare — chacune pèse lourd et écarte des profils.' },
    { cle: 'souhaite', type: 'liste', titre: 'Et lesquelles seraient un plus ?',
      aide: 'Souhaitées : appréciables, mais pas bloquantes. Elles comptent quatre fois moins que les exigées.' },
    { cle: 'permis', type: 'choix', titre: 'Le permis B est-il obligatoire ?',
      options: [[false, 'Non', ''], [true, 'Oui, il est exigé', 'Les profils sans permis déclaré seront écartés.']] },
    { cle: 'contraintes', type: 'multi', titre: 'Le poste comporte-t-il ces contraintes ?',
      aide: 'Les candidats qui les ont exclues ne verront pas l’offre. Le dire évite des rendez-vous inutiles des deux côtés.',
      options: GENES },
    { cle: 'reconversion', type: 'choix', titre: 'Acceptes-tu les profils en reconversion ?',
      aide: 'Sans ce choix, aucun profil venant d’un autre métier ne vous sera proposé.',
      options: [[true, 'Oui, si les compétences transférables suivent', ''], [false, 'Non, métier obligatoire', '']] },
    { cle: 'teletravail', type: 'choix', titre: 'Télétravail possible ?',
      options: [['non', 'Non, sur site', ''], ['hybride', 'Quelques jours', ''], ['total', 'Complet', '']] },
    { cle: 'resume', type: 'texte', titre: 'Décris le poste en une phrase',
      placeholder: 'ex. Équipe de quatre techniciens, parc de 400 postes.' }
  ];

  /* ------------------------------------------------------------ moteur ---- */
  var jeu = null, i = 0, rep = {}, fini = null, hote = null;

  function ouvre(quel, surFin, cible) {
    jeu = quel === 'offre' ? OFFRE : CANDIDAT;
    fini = surFin;
    hote = cible;
    i = 0;
    rep = {};
    if (quel !== 'offre' && window.AJ_PROFIL) {
      var p = window.AJ_PROFIL.profil();
      ['metiers', 'zones', 'contrats', 'ouverture', 'teletravail', 'permis', 'salaireMin', 'refus']
        .forEach(function (k) { if (p[k] !== undefined) rep[k] = p[k]; });
    }
    rend();
  }

  function valeurCourante(q) {
    var v = rep[q.cle];
    if (q.type === 'multi') return Array.isArray(v) ? v : [];
    return v;
  }

  function rend() {
    var q = jeu[i];
    var v = valeurCourante(q);
    var corps = '';

    if (q.type === 'choix') {
      corps = '<div class="qopts">' + q.options.map(function (o, k) {
        var on = String(v) === String(o[0]);
        return '<button type="button" class="qopt' + (on ? ' on' : '') + '" data-k="' + k + '">' +
          '<b>' + esc(o[1]) + '</b>' + (o[2] ? '<span>' + esc(o[2]) + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    }
    if (q.type === 'multi') {
      corps = '<div class="qchips">' + q.options.map(function (o, k) {
        var on = v.indexOf(o[0]) !== -1;
        return '<button type="button" class="qchip' + (on ? ' on' : '') + '" data-k="' + k + '">' + esc(o[1]) + '</button>';
      }).join('') + '</div>';
    }
    if (q.type === 'texte') {
      corps = '<input type="text" class="qtexte" id="q-txt" value="' + esc(v || '') +
        '" placeholder="' + esc(q.placeholder || '') + '">';
    }
    if (q.type === 'liste') {
      var l = Array.isArray(v) ? v : [];
      corps = '<div class="psaisie"><input type="text" id="q-comp" placeholder="une compétence, puis Entrée">' +
        '<button type="button" class="btn-mini" id="q-comp-add">Ajouter</button></div>' +
        '<div class="qchips">' + (l.length ? l.map(function (c) {
          return '<span class="qchip on lib">' + esc(c) + '<button type="button" data-sup="' + esc(c) + '">✕</button></span>';
        }).join('') : '<span class="pvide">Aucune pour l’instant.</span>') + '</div>';
    }

    hote.innerHTML =
      '<div class="quest">' +
        '<div class="qbar"><b style="width:' + Math.round((i + 1) / jeu.length * 100) + '%"></b></div>' +
        '<div class="qcompte">Question ' + (i + 1) + ' sur ' + jeu.length + '</div>' +
        '<h2 class="qtitre">' + esc(q.titre) + '</h2>' +
        (q.aide ? '<p class="qaide">' + q.aide + '</p>' : '') +
        corps +
        '<div class="qnav">' +
          (i > 0 ? '<button type="button" class="btn-mini" id="q-prec">← Précédent</button>' : '<span></span>') +
          '<span class="qd">' +
            '<button type="button" class="btn-mini" id="q-passe">Passer</button>' +
            '<button type="button" class="btn-fort" id="q-suiv">' + (i === jeu.length - 1 ? 'Terminer' : 'Suivant →') + '</button>' +
          '</span>' +
        '</div>' +
      '</div>';

    branche(q);
  }

  function branche(q) {
    Array.prototype.forEach.call(hote.querySelectorAll('.qopt'), function (b) {
      b.onclick = function () {
        rep[q.cle] = q.options[+b.dataset.k][0];
        suivant();
      };
    });
    Array.prototype.forEach.call(hote.querySelectorAll('.qchip[data-k]'), function (b) {
      b.onclick = function () {
        var val = q.options[+b.dataset.k][0];
        var l = valeurCourante(q).slice();
        var k = l.indexOf(val);
        if (k === -1) { if (q.max && l.length >= q.max) return; l.push(val); } else l.splice(k, 1);
        rep[q.cle] = l;
        rend();
      };
    });
    if ($('#q-txt')) $('#q-txt').oninput = function () { rep[q.cle] = this.value; };
    if ($('#q-comp')) {
      var ajoute = function () {
        var val = $('#q-comp').value.trim();
        if (!val) return;
        var l = valeurCourante(q).slice();
        if (l.indexOf(val) === -1) l.push(val);
        rep[q.cle] = l;
        rend();
        if ($('#q-comp')) $('#q-comp').focus();
      };
      $('#q-comp').onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ajoute(); } };
      $('#q-comp-add').onclick = ajoute;
      Array.prototype.forEach.call(hote.querySelectorAll('[data-sup]'), function (b) {
        b.onclick = function () {
          var l = valeurCourante(q).filter(function (x) { return x !== b.dataset.sup; });
          rep[q.cle] = l;
          rend();
        };
      });
    }
    if ($('#q-prec')) $('#q-prec').onclick = function () { i--; rend(); };
    if ($('#q-passe')) $('#q-passe').onclick = suivant;
    if ($('#q-suiv')) $('#q-suiv').onclick = suivant;
  }

  function suivant() {
    if (i < jeu.length - 1) { i++; rend(); }
    else if (fini) fini(rep);
  }

  /* ------------------------------------------------- création d'une offre - */
  function creeOffre(r) {
    var sal = null;
    if (r.salaire) { var p = String(r.salaire).split('-'); sal = [parseInt(p[0], 10), parseInt(p[1], 10)]; }
    var id = 1000 + Math.floor(Math.random() * 9000);
    var km = { 'Grand Nouméa': 10, 'Sud': 45, 'Nord': 230, 'Îles': 120 }[r.zone] || 15;
    var o = {
      id: id, titre: r.titre || 'Poste sans intitulé', org: r.org || 'Entreprise', famille: r.famille || 'commerce',
      contrat: r.contrat || 'CDI', zone: r.zone || 'Grand Nouméa', ville: r.ville || 'Nouméa', km: km,
      salaire: sal, expMin: r.expMin == null ? 0 : r.expMin, formation: r.formation == null ? 1 : r.formation,
      permis: !!r.permis, teletravail: r.teletravail || 'non',
      dispo: new Date(D.aujourdhui.getTime() + 30 * 86400000),
      requis: r.requis || [], souhaite: r.souhaite || [],
      contraintes: r.contraintes || [], reconversion: r.reconversion !== false,
      fin: new Date(D.aujourdhui.getTime() + 60 * 86400000), aInvite: false,
      resume: r.resume || 'Offre créée depuis le questionnaire.',
      missions: [], avantages: [],
      entreprise: { taille: 'non précisé', secteur: r.famille || '—', creee: new Date().getFullYear(),
        apropos: 'Offre déposée par ' + (r.org || 'une entreprise') + ' via le questionnaire guidé.' },
      profil: [], processus: [], horaires: 'non précisé', vues: 0, interesses: 0, mienne: true
    };
    D.offres.push(o);
    var l = [];
    try { l = JSON.parse(localStorage.getItem('aj.offres') || '[]'); } catch (e) {}
    l.push(o);
    try { localStorage.setItem('aj.offres', JSON.stringify(l)); } catch (e) {}
    return o;
  }

  // offres déjà créées lors d'une visite précédente
  try {
    JSON.parse(localStorage.getItem('aj.offres') || '[]').forEach(function (o) {
      o.dispo = new Date(o.dispo); o.fin = new Date(o.fin);
      D.offres.push(o);
    });
  } catch (e) {}

  window.AJ_QUESTIONS = { ouvre: ouvre, creeOffre: creeOffre, contraintesDe: contraintesDe };
})();

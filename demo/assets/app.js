/* Adopte un Job — écran principal. Aucune dépendance, ES5 volontairement :
   ça tourne sur tous les navigateurs mobiles sans étape de compilation. */
(function () {
  'use strict';

  var D = window.AJ_DATA, MOI = D.moi, AUJ = D.aujourdhui;

  // Le profil saisi remplace celui de la demonstration : quand il change,
  // le deck et les panneaux sont recalcules.
  if (window.AJ_PROFIL) {
    window.AJ_PROFIL.onChange = function () {
      MOI = D.moi;
      if (S.onglet === 'swipe') rendDeck();
      if (S.onglet === 'interets') rendInterets();
    };
  }
  var NIVEAU = { 1: 'Bac', 2: 'Bac+2', 3: 'Bac+3', 4: 'Bac+5' };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var pc = function (v) { return Math.round(v * 100); };
  var fmt = function (n) { return (n / 1000).toFixed(0) + ' k'; };
  var dtf = function (d) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  var teinte = function (v) { return v >= .75 ? 'var(--yes)' : v >= .5 ? 'var(--accent)' : 'var(--no)'; };
  var conf = function (v) { return v >= .9 ? 'élevée' : v >= .6 ? 'moyenne' : 'faible'; };

  /* ------------------------------------------------------------ état local */
  var CLE = 'aj.app.v1';
  var S = { vues: {}, ouvert: false, onglet: 'swipe', dernier: null, filtres: [], demo: false };
  try { var r = localStorage.getItem(CLE); if (r) S = Object.assign(S, JSON.parse(r)); } catch (e) {}
  // ancien format : la décision était une simple chaîne, sans date ni score
  Object.keys(S.vues).forEach(function (k) {
    if (typeof S.vues[k] === 'string') S.vues[k] = { etat: S.vues[k], quand: null, score: null };
  });
  function etatDe(id) { var v = S.vues[id]; return v ? v.etat : null; }
  function save() { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) {} }

  /* ---------------------------------------------------------- le moteur ---
     Deux scores directionnels, confiance séparée, inconnu qui n'élimine pas. */
  function contraintes(c, o) {
    var bl = [], vg = [];
    if (c.zones.indexOf(o.zone) === -1) bl.push('Poste en zone ' + o.zone + ', hors de tes zones');
    if (c.contrats.indexOf(o.contrat) === -1) bl.push('Contrat ' + o.contrat + ', tu cherches ' + c.contrats.join(' ou '));
    if (o.permis) {
      if (c.permis === false) bl.push('Permis B exigé, non détenu');
      else if (c.permis == null) vg.push('Permis B exigé — non renseigné');
    }
    if (o.salaire && c.salaireMin != null) {
      if (c.salaireMin > o.salaire[1]) bl.push('Salaire plafonné à ' + fmt(o.salaire[1]) + ', sous ton minimum');
    } else if (!o.salaire) vg.push('Salaire non annoncé');

    // criteres declares redhibitoires par le candidat
    var refus = (window.AJ_PROFIL && window.AJ_PROFIL.profil().refus) || [];
    var noms = { nuit: 'du travail de nuit', weekend: 'du travail le week-end',
                 deplacements: 'des déplacements fréquents', coupures: 'des horaires coupés',
                 astreinte: 'des astreintes' };
    (o.contraintes || []).forEach(function (k) {
      if (refus.indexOf(k) !== -1) bl.push('Le poste comporte ' + (noms[k] || k) + ', que tu as exclu');
    });

    // une offre fermee aux reconversions n'est pas proposee hors metier
    if (o.reconversion === false && c.metiers.indexOf(o.famille) === -1) {
      bl.push('Offre fermée aux reconversions par l’entreprise');
    }
    return { ok: !bl.length, bl: bl, vg: vg };
  }
  function couverture(c, o) {
    var a = o.requis.filter(function (s) { return c.competences.indexOf(s) !== -1; });
    var b = o.souhaite.filter(function (s) { return c.competences.indexOf(s) !== -1; });
    return {
      v: (o.requis.length ? a.length / o.requis.length : 1) * .75 + (o.souhaite.length ? b.length / o.souhaite.length : 1) * .25,
      ok: a, manque: o.requis.filter(function (s) { return a.indexOf(s) === -1; })
    };
  }
  function agrege(parts) {
    var num = 0, den = 0, tot = 0;
    parts.forEach(function (p) { tot += p.poids; if (p.v === null) return; num += p.v * p.poids; den += p.poids; });
    return { score: den ? num / den : 0, confiance: tot ? den / tot : 0, parts: parts };
  }
  function evalue(c, o) {
    var cov = couverture(c, o);
    var fr = agrege([
      { cle: 'Compétences', v: cov.v, poids: 45 },
      { cle: 'Expérience', v: o.expMin === 0 ? 1 : Math.min(1, c.experience / o.expMin), poids: 30 },
      { cle: 'Formation', v: c.formation >= o.formation ? 1 : Math.max(0, 1 - (o.formation - c.formation) * .35), poids: 15 },
      { cle: 'Disponibilité', v: c.dispo <= o.dispo ? 1 : .5, poids: 10 }
    ]);
    fr.cov = cov;
    var direct = c.metiers.indexOf(o.famille) !== -1;
    var sal = null;
    if (o.salaire && c.salaireMin != null) sal = c.salaireMin <= o.salaire[0] ? 1 : (c.salaireMin <= o.salaire[1] ? .6 : 0);
    var fc = agrege([
      { cle: 'Métier visé', v: direct ? 1 : .45, poids: 40 },
      { cle: 'Contrat', v: c.contrats.indexOf(o.contrat) !== -1 ? 1 : 0, poids: 25 },
      { cle: 'Salaire', v: sal, poids: 20 },
      { cle: 'Conditions', v: c.teletravail === 'hybride' && o.teletravail === 'non' ? .4 : 1, poids: 15 }
    ]);
    var ctr = contraintes(c, o);
    return {
      offre: o, ctr: ctr, fr: fr, fc: fc, passerelle: !direct,
      qualite: Math.min(fr.score, fc.score) * (direct ? 1 : .85),
      confiance: (fr.confiance + fc.confiance) / 2,
      perime: o.fin < AUJ
    };
  }
  function explique(e) {
    var o = e.offre, c = MOI, cov = e.fr.cov, oui = [], att = [];
    if (cov.ok.length) oui.push(cov.ok.length + ' compétence' + (cov.ok.length > 1 ? 's' : '') + ' exigée' +
      (cov.ok.length > 1 ? 's' : '') + ' sur ' + o.requis.length + ' : ' + cov.ok.join(', '));
    if (cov.manque.length) att.push('Manque : ' + cov.manque.join(', '));
    if (o.expMin === 0) oui.push('Aucune expérience exigée');
    else if (c.experience >= o.expMin) oui.push(c.experience + ' ans d’expérience pour ' + o.expMin + ' demandé' + (o.expMin > 1 ? 's' : ''));
    else att.push(o.expMin + ' ans demandés, ' + c.experience + ' déclarés');
    if (c.formation >= o.formation) oui.push('Niveau ' + NIVEAU[c.formation] + ' pour ' + NIVEAU[o.formation] + ' demandé');
    else att.push('Niveau ' + NIVEAU[o.formation] + ' demandé');
    if (c.zones.indexOf(o.zone) !== -1) oui.push('Dans une zone que tu acceptes');
    if (c.contrats.indexOf(o.contrat) !== -1) oui.push('Contrat ' + o.contrat + ', conforme');
    if (o.salaire && c.salaireMin != null) {
      if (c.salaireMin <= o.salaire[0]) oui.push('Salaire au-dessus de ton minimum');
      else if (c.salaireMin <= o.salaire[1]) att.push('Le salaire démarre à ' + fmt(o.salaire[0]) + ', sous ton minimum de ' + fmt(c.salaireMin));
    }
    if (c.dispo <= o.dispo) oui.push('Disponible avant la prise de poste');
    e.ctr.vg.forEach(function (v) { att.push(v); });
    if (e.passerelle) att.push('Métier différent de ceux visés — accessible depuis ton parcours');
    return { oui: oui, att: att };
  }

  /* ------------------------------------------------------------- le deck */
  var FILTRES = {
    teletravail: function (o) { return o.teletravail !== 'non'; },
    debutant: function (o) { return o.expMin === 0; },
    cdi: function (o) { return o.contrat === 'CDI'; },
    salaire: function (o) { return !!o.salaire; },
    proche: function (o) { return o.km <= 20; }
  };

  function paquet() {
    return D.offres.map(function (o) { return evalue(MOI, o); })
      .filter(function (e) {
        if (e.perime || !e.ctr.ok) return false;
        if (e.passerelle && !S.ouvert) return false;
        if (etatDe(e.offre.id)) return false;
        for (var i = 0; i < S.filtres.length; i++) {
          var f = FILTRES[S.filtres[i]];
          if (f && !f(e.offre)) return false;
        }
        return true;
      })
      .sort(function (a, b) { return b.qualite - a.qualite; });
  }

  /* ---- le contenu est decoupe en blocs ; la pagination les repartit ensuite
     sur autant de pages qu'il en faut pour qu'aucune ne deborde. ---- */
  function blocs(e) {
    var o = e.offre, en = o.entreprise, w = explique(e);
    var jours = Math.max(0, Math.round((o.fin - AUJ) / 86400000));
    var b = [];
    function p(sec, html) { b.push({ sec: sec, t: 'p', h: html }); }
    function li(sec, html) { b.push({ sec: sec, t: 'li', h: html }); }
    function bloc(sec, html) { b.push({ sec: sec, t: 'b', h: html }); }

    // La carte est un apercu : trois pages apres le resume, pas davantage.
    // Le detail complet vit dans le panneau lateral sur grand ecran.
    var S1 = 'Le poste';
    p(S1, '<p>' + esc(o.resume) + '</p>');
    o.missions.slice(0, 3).forEach(function (m) { li(S1, esc(m)); });

    var S2 = 'Profil · ' + (o.expMin ? o.expMin + ' ans mini' : 'débutant accepté') + ' · ' + NIVEAU[o.formation];
    o.profil.slice(0, 2).forEach(function (m) { li(S2, esc(m)); });
    bloc(S2, tags(o.requis, true));

    var S3 = 'L’entreprise';
    p(S3, '<p>' + esc(en.apropos) + '</p>');
    bloc(S3, '<dl class="kv"><dt>Effectif</dt><dd>' + esc(en.taille) + '</dd>' +
      '<dt>Secteur</dt><dd>' + esc(en.secteur) + '</dd>' +
      '<dt>Horaires</dt><dd>' + esc(o.horaires) + '</dd>' +
      (o.avantages.length ? '<dt>Avantages</dt><dd>' + esc(o.avantages.slice(0, 2).join(' · ')) + '</dd>' : '') +
      '<dt>Ouverte</dt><dd>encore ' + jours + ' jours</dd></dl>');

    var S4 = 'Pourquoi ce score';
    p(S4, '<p><b style="color:var(--yes)">Ce qui colle</b></p>');
    w.oui.slice(0, 3).forEach(function (x) { li(S4, esc(x)); });
    p(S4, '<p><b style="color:var(--accent)">À vérifier</b></p>');
    (w.att.length ? w.att.slice(0, 3) : ['Rien à signaler']).forEach(function (x) { li(S4, esc(x)); });

    return b;
  }

  function tags(liste, marque) {
    return '<div class="tags">' + liste.map(function (c) {
      var ok = MOI.competences.indexOf(c) !== -1;
      return '<span class="' + (ok ? 'has' : (marque ? 'miss' : '')) + '">' + esc(c) + '</span>';
    }).join('') + '</div>';
  }

  // Ajoute un bloc dans le conteneur de mesure et renvoie de quoi l'enlever.
  function pose(hote, bl) {
    if (bl.t === 'li') {
      var dernier = hote.lastElementChild;
      if (dernier && dernier.tagName === 'UL') {
        var li = document.createElement('li');
        li.innerHTML = bl.h;
        dernier.appendChild(li);
        return function () { dernier.removeChild(li); if (!dernier.children.length) hote.removeChild(dernier); };
      }
      var ul = document.createElement('ul');
      ul.innerHTML = '<li>' + bl.h + '</li>';
      hote.appendChild(ul);
      return function () { hote.removeChild(ul); };
    }
    var d = document.createElement('div');
    d.style.display = 'contents';
    d.innerHTML = bl.h;
    hote.appendChild(d);
    return function () { hote.removeChild(d); };
  }

  // Mesure dans la carte reelle, donc a la hauteur reelle de l'ecran du visiteur.
  function paginer(el, e) {
    var box = el.querySelector('.pagebox');
    var avant = el.classList.contains('turned');
    el.classList.add('turned');                 // les pages d'info ont un en-tete compact

    var lead = document.createElement('div');
    lead.className = 'page-lead';
    var corps = document.createElement('div');
    corps.className = 'page-body';
    box.innerHTML = '';
    box.appendChild(lead);
    box.appendChild(corps);

    if (corps.clientHeight < 120) {         // pas affichee, ou trop etroite : rien de mesurable
      el.classList.toggle('turned', avant);
      box.innerHTML = '';
      return null;
    }

    var pages = [], sec = null;
    function ferme() {
      if (sec !== null && corps.innerHTML.trim()) pages.push({ lead: sec, html: corps.innerHTML });
      corps.innerHTML = '';
    }

    blocs(e).forEach(function (bl) {
      if (bl.sec !== sec) { ferme(); sec = bl.sec; lead.textContent = sec; }
      var retire = pose(corps, bl);
      if (corps.scrollHeight > corps.clientHeight + 1) {   // vrai debordement, et rien d'autre
        if (corps.children.length > 1 || (corps.firstElementChild && corps.firstElementChild.children.length > 1)) {
          retire();                              // ce bloc ne tient pas : page suivante
          ferme();
          pose(corps, bl);
        }
        // sinon : un bloc seul plus haut que la page, on le garde tel quel
      }
    });
    ferme();

    el.classList.toggle('turned', avant);
    // Filet : une carte qui produirait une avalanche de pages est le signe d'une
    // mesure fausse. On retombe alors sur une page par section — quatre, pas quatorze.
    if (pages.length > 6) return null;
    return pages;
  }
  var glisse = null, finGlisse = 0;

  function carte(e, profondeur, sansGestes) {
    var o = e.offre, q = e.qualite;
    var el = document.createElement('article');
    el.className = 'card';
    el.dataset.page = '0';
    el.style.transform = 'translateY(' + (profondeur * 8) + 'px) scale(' + (1 - profondeur * .03) + ')';
    el.style.zIndex = String(10 - profondeur);
    el.innerHTML =
      '<span class="stamp yes">OUI</span><span class="stamp no">NON</span>' +
      '<div class="segs"></div>' +
      '<div class="stage">' +
        '<div class="hero">' +
          '<div class="hero-top">' +
            '<button type="button" class="score score-btn" data-detail aria-label="Voir le détail du score">' +
            '<span class="gauge"><b style="width:' + pc(q) + '%;background:' + teinte(q) + '"></b></span>' +
            '<span class="v" style="color:' + teinte(q) + '">' + pc(q) + ' %</span> compatible</button>' +
            (e.passerelle ? '<span class="badge-pass">accessible depuis ton parcours</span>' : '') +
          '</div>' +
          '<div class="conf">confiance ' + conf(e.confiance) + ' · ' + pc(e.confiance) + ' % des critères renseignés</div>' +
          '<h2 class="role">' + esc(o.titre) + '</h2>' +
          '<div class="org">' + esc(o.org) + ' · ' + esc(o.ville) + '</div>' +
        '</div>' +
        '<div class="pagebox"></div>' +
      '</div>' +
      '<div class="facts">' +
        '<div class="line">' + o.km + ' km <span class="dot"></span> <em>' + esc(o.ville) + '</em> <span class="dot"></span> ' +
          (o.teletravail === 'non' ? 'sur site' : 'télétravail ' + o.teletravail) + '</div>' +
        '<div class="line"><em>' + o.contrat + '</em> <span class="dot"></span> dès le ' + dtf(o.dispo) + '</div>' +
        '<div class="line">' + (o.salaire ? '<em>' + fmt(o.salaire[0]) + ' – ' + fmt(o.salaire[1]) + ' XPF</em>' : '<em>salaire non annoncé</em>') + '</div>' +
      '</div>' +
      '<div class="coins">' +
        '<button type="button" class="retour" data-c="retour" aria-label="Revenir sur la dernière décision"><svg><use href="#i-undo"/></svg></button>' +
        '<button type="button" class="non" data-c="non" aria-label="Pas intéressé"><svg><use href="#i-x"/></svg></button>' +
        '<button type="button" class="fav" data-c="fav" aria-label="Mettre de côté"><svg><use href="#i-star"/></svg></button>' +
        '<button type="button" class="oui" data-c="oui" aria-label="Ça m’intéresse"><svg><use href="#i-heart"/></svg></button>' +
      '</div>';

    var bs = el.querySelector('[data-detail]');
    if (bs) {
      bs.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      bs.addEventListener('click', function (ev) { ev.stopPropagation(); montreDetail(e); });
    }

    Array.prototype.forEach.call(el.querySelectorAll('.coins button'), function (b) {
      b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();                       // ni glissement, ni changement de page
        var quoi = b.dataset.c;
        if (quoi === 'retour') {
          if (S.dernier) { delete S.vues[S.dernier]; S.dernier = null; save(); rendDeck(); }
        } else {
          decide(e, quoi === 'fav' ? 'plus_tard' : quoi);
        }
      });
      if (b.dataset.c === 'retour') b.disabled = !S.dernier;
    });

    el.addEventListener('click', function (ev) {
      if (Date.now() - finGlisse < 300) return;
      var b = el.getBoundingClientRect();
      tourne(el, e, (ev.clientX - b.left) < b.width * .34 ? -1 : 1);
    });
    if (profondeur === 0 && !sansGestes) gestes(el, e);
    return el;
  }

  // A appeler une fois la carte dans le document : c'est la qu'on peut mesurer.
  function prepare(el, e) {
    var resume = { lead: null, html: '<div class="tags">' +
      e.fr.cov.ok.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') +
      e.fr.cov.manque.slice(0, 2).map(function (x) { return '<span class="miss">' + esc(x) + ' ?</span>'; }).join('') +
      '</div>' };
    var decoupe = paginer(el, e);
    if (!decoupe) {                          // mesure impossible : tout sur une page,
      decoupe = [];                          // le filet de securite prendra le relais
      var t = null, acc = '';
      blocs(e).forEach(function (bl) {
        if (bl.sec !== t) { if (t !== null) decoupe.push({ lead: t, html: acc }); t = bl.sec; acc = ''; }
        acc += bl.t === 'li' ? '<ul><li>' + bl.h + '</li></ul>' : bl.h;
      });
      if (t !== null) decoupe.push({ lead: t, html: acc });
      el._aMesurer = true;                   // a repaginer des que la carte sera visible
    }
    el._pages = [resume].concat(decoupe);
    el.querySelector('.segs').innerHTML = el._pages.map(function (_, k) {
      return '<i class="' + (k ? '' : 'on') + '"></i>';
    }).join('');
    montrePage(el, 0, 0);
  }

  function montrePage(el, i, sens) {
    var ps = el._pages || [];
    if (!ps.length) return;
    el.dataset.page = String(i);
    el.classList.toggle('turned', i !== 0);
    var box = el.querySelector('.pagebox');
    var pg = ps[i];
    box.innerHTML = pg.lead
      ? '<div class="page-lead">' + esc(pg.lead) + '</div><div class="page-body">' + pg.html + '</div>'
      : pg.html;                                  // le resume n'a pas de corps defilant
    var corps = box.querySelector('.page-body');
    if (corps && corps.scrollHeight > corps.clientHeight + 2) {
      corps.classList.add('deborde');
      indiqueLaSuite(box, corps);
    }
    var segs = el.querySelectorAll('.segs i');
    for (var k = 0; k < segs.length; k++) segs[k].classList.toggle('on', k === i);
    if (!sens) return;
    box.style.transition = 'none';
    box.style.transform = 'translateX(' + (sens > 0 ? 30 : -30) + 'px)';
    box.style.opacity = '0';
    requestAnimationFrame(function () {
      box.style.transition = 'transform .2s var(--ease), opacity .2s var(--ease)';
      box.style.transform = 'none';
      box.style.opacity = '1';
    });
  }

  // Une fleche qui s'efface des qu'on a atteint le bas.
  function indiqueLaSuite(box, corps) {
    var f = document.createElement('button');
    f.className = 'plus-bas';
    f.type = 'button';
    f.setAttribute('aria-label', 'Afficher la suite');
    f.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    box.appendChild(f);

    function maj() {
      var reste = corps.scrollHeight - corps.scrollTop - corps.clientHeight;
      f.classList.toggle('on', reste > 6);
    }
    corps.addEventListener('scroll', maj);
    f.addEventListener('click', function (ev) {
      ev.stopPropagation();                       // ne pas tourner la page
      corps.scrollBy({ top: Math.round(corps.clientHeight * 0.8), behavior: 'smooth' });
    });
    maj();
  }

  function tourne(el, e, sens) {
    var n = (el._pages || []).length;
    if (!n) return;
    var i = ((parseInt(el.dataset.page, 10) || 0) + sens + n) % n;   // boucle dans les deux sens
    montrePage(el, i, sens);
  }

  function gestes(el, e) {
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button) return;
      // Pas de capture ici : elle redirigerait le clic qui suit vers la carte,
      // et les elements interactifs poses dessus (la fleche) ne recevraient rien.
      glisse = { x: ev.clientX, y: ev.clientY, bouge: false, id: ev.pointerId, pris: false };
    });
    el.addEventListener('pointermove', function (ev) {
      if (!glisse) return;
      var dx = ev.clientX - glisse.x, dy = ev.clientY - glisse.y;
      if (Math.abs(dx) > 6) {
        glisse.bouge = true;
        if (!glisse.pris) {                       // capture seulement quand c'est vraiment un glissement
          try { el.setPointerCapture(glisse.id); } catch (x) {}
          glisse.pris = true;
        }
      }
      if (!glisse.bouge) return;
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx / 20) + 'deg)';
      el.querySelector('.stamp.yes').style.opacity = String(Math.max(0, Math.min(1, dx / 90)));
      el.querySelector('.stamp.no').style.opacity = String(Math.max(0, Math.min(1, -dx / 90)));
    });
    function relache(ev) {
      if (!glisse) return;
      var dx = (ev.clientX || 0) - glisse.x;
      if (glisse.bouge) finGlisse = Date.now();
      glisse = null;
      if (dx > 95) return decide(e, 'oui');
      if (dx < -95) return decide(e, 'non');
      el.style.transition = 'transform .18s var(--ease)';
      el.style.transform = 'translateY(0) scale(1)';
      el.querySelector('.stamp.yes').style.opacity = '0';
      el.querySelector('.stamp.no').style.opacity = '0';
      setTimeout(function () { el.style.transition = ''; }, 190);
    }
    el.addEventListener('pointerup', relache);
    el.addEventListener('pointercancel', function () { glisse = null; });
  }

  function decide(e, quoi) {
    // Deuxième verrou : une carte affichée au moment où le profil se vide ne
    // doit pas pouvoir être décidée.
    if (verrou().length) { rendDeck(); return; }
    S.vues[e.offre.id] = { etat: quoi, quand: Date.now(), score: e.qualite };
    S.dernier = e.offre.id;
    save();
    if (navigator.vibrate) { try { navigator.vibrate(quoi === 'oui' ? 18 : 8); } catch (x) {} }
    rendDeck();
    if (quoi === 'oui' && e.offre.aInvite) montreMatch(e);
  }

  /* ------------------------------------------------------ feuille de match */
  function initiales(t) {
    return t.split(/\s+/).slice(0, 2).map(function (m) { return m.charAt(0); }).join('').toUpperCase();
  }

  function montreMatch(e) {
    var o = e.offre;
    $('#match-box').innerHTML =
      '<div class="poignee"></div>' +
      '<div class="eyebrow">Intérêt réciproque</div>' +
      '<h2>C’est un match</h2>' +
      '<div class="duo">' +
        '<span class="pastille moi">' + esc(MOI.prenom.charAt(0)) + '</span>' +
        '<span class="lien"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
          'stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></span>' +
        '<span class="pastille eux">' + esc(initiales(o.org)) + '</span>' +
      '</div>' +
      '<p class="qui"><b>' + esc(o.org) + '</b> souhaite aussi échanger avec toi sur le poste de <b>' +
        esc(o.titre) + '</b>.</p>' +
      '<div class="ouvre">' +
        '<div><span class="n">01</span><span><b>Candidature ciblée</b><span>Ton profil recentré sur cette offre. Tu la relis avant qu’elle parte.</span></span></div>' +
        '<div><span class="n">02</span><span><b>Créneaux de rendez-vous</b><span>' + esc(o.org) + ' propose trois horaires, tu en choisis un.</span></span></div>' +
        '<div><span class="n">03</span><span><b>Conversation</b><span>Un fil de discussion, et vos coordonnées enfin visibles des deux côtés.</span></span></div>' +
      '</div>' +
      '<div class="prov"><h3>Ce que ta candidature reprendra</h3><ul style="margin:0;padding-left:18px">' +
        e.fr.cov.ok.slice(0, 3).map(function (c) {
          return '<li>' + esc(c) + '<cite>déclarée dans ton expérience de support, 2022–2026</cite></li>';
        }).join('') +
        '<li>' + MOI.experience + ' ans d’expérience<cite>calculés depuis les dates de ton parcours</cite></li>' +
      '</ul><p>Chaque élément reste rattaché à sa source. Rien n’est reformulé, rien n’est ajouté.</p></div>' +
      '<div class="btns">' +
        '<button class="btn primaire" id="m-suite">Continuer à swiper</button>' +
        '<button class="btn" id="m-mess">Voir mes messages</button>' +
      '</div>';

    $('#match').hidden = false;
    $('#m-suite').onclick = fermeMatch;
    $('#m-mess').onclick = function () {
      fermeMatch();
      var b = document.querySelector('.nav button[data-tab="messages"]');
      if (b) b.click();
    };
  }
  function fermeMatch() { $('#match').hidden = true; }

  /* ------------------------------------- detail complet, dans une feuille */
  function montreDetail(e) {
    rendPanneau(e, '#detail-corps');
    $('#detail').hidden = false;
  }
  function fermeDetail() { $('#detail').hidden = true; }
  $('#detail-ok').onclick = fermeDetail;
  $('#detail').addEventListener('click', function (ev) { if (ev.target === $('#detail')) fermeDetail(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fermeDetail(); });

  /* -------------------------------------------------- feuille « démo » */
  (function () {
    var f = $('#apropos');
    function ferme() { f.hidden = true; }
    $('#demo-info').onclick = function () { f.hidden = false; };
    $('#apropos-ok').onclick = ferme;
    f.addEventListener('click', function (ev) { if (ev.target === f) ferme(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') ferme(); });
  })();
  $('#match').addEventListener('click', function (ev) { if (ev.target === $('#match')) fermeMatch(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fermeMatch(); });

  /* Le panneau d'ordinateur ne montre rien de neuf : il sort de la carte ce qui
     y est enfoui, pour qu'on n'ait plus a tourner les pages sur un grand ecran. */
  function rendPanneau(e, ou, vide) {
    var host = $(ou || '#side');
    if (!host) return;
    if (!e) {
      host.innerHTML = '<p class="vide-p">' + (vide ||
        'Aucune offre affichée. Ajuste tes filtres ou ouvre aux métiers proches pour relancer le deck.') + '</p>';
      return;
    }
    var o = e.offre, en = o.entreprise, w = explique(e);
    var jours = Math.max(0, Math.round((o.fin - AUJ) / 86400000));

    function jauges(parts) {
      return parts.map(function (p) {
        var inc = p.v === null;
        return '<div class="jauge' + (inc ? ' inconnu' : '') + '"><span>' + esc(p.cle) + '</span>' +
          '<span class="piste"><b style="width:' + (inc ? 0 : pc(p.v)) + '%;background:' +
          (inc ? 'var(--line)' : teinte(p.v)) + '"></b></span>' +
          '<span class="v">' + (inc ? 'inconnu' : pc(p.v) + ' %') + '</span></div>';
      }).join('');
    }

    host.innerHTML =
      '<div class="col-p">' +
      '<div class="titre">' + esc(o.titre) + '</div>' +
      '<div class="org">' + esc(o.org) + ' · ' + esc(o.ville) + ' · ' + o.contrat +
        (o.salaire ? ' · ' + fmt(o.salaire[0]) + ' – ' + fmt(o.salaire[1]) + ' XPF' : ' · salaire non annoncé') + '</div>' +

      '<h3>Ce que l’entreprise regarde</h3><div class="jauges">' + jauges(e.fr.parts) + '</div>' +
      '<h3>Ce que tu regardes</h3><div class="jauges">' + jauges(e.fc.parts) + '</div>' +
      '<p style="font-size:var(--t-xs);color:var(--ink-3);margin:var(--s3) 0 0">' +
        'Compatibilité ' + pc(e.qualite) + ' % — le plus faible des deux, jamais la moyenne. ' +
        'Confiance ' + conf(e.confiance) + ', ' + pc(e.confiance) + ' % des critères renseignés.</p>' +

      '</div><div class="col-p">' +

      '<h3>Pourquoi ce score</h3>' +
      '<div class="deux">' +
        '<div><b style="color:var(--yes);font-size:var(--t-sm)">Ce qui colle</b><ul>' +
          w.oui.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><b style="color:var(--accent);font-size:var(--t-sm)">À vérifier</b><ul>' +
          (w.att.length ? w.att.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li>Rien à signaler</li>') +
        '</ul></div>' +
      '</div>' +

      '<h3>Le poste</h3><p style="font-size:var(--t-sm);color:var(--ink-2);margin:0 0 var(--s3)">' + esc(o.resume) + '</p>' +
      (o.missions.length ? '<ul style="margin:0;padding-left:var(--s5);font-size:var(--t-sm);color:var(--ink-2)">' +
        o.missions.map(function (m) { return '<li style="margin-bottom:var(--s2)">' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +

      '<h3>L’entreprise</h3>' +
      '<p style="font-size:var(--t-sm);color:var(--ink-2);margin:0 0 var(--s3)">' + esc(en.apropos) + '</p>' +
      '<dl class="kv2"><dt>Effectif</dt><dd>' + esc(en.taille) + '</dd>' +
      '<dt>Secteur</dt><dd>' + esc(en.secteur) + '</dd>' +
      '<dt>Créée en</dt><dd>' + en.creee + '</dd>' +
      '<dt>Horaires</dt><dd>' + esc(o.horaires) + '</dd>' +
      (o.avantages.length ? '<dt>Avantages</dt><dd>' + esc(o.avantages.join(' · ')) + '</dd>' : '') +
      (o.processus.length ? '<dt>Recrutement</dt><dd>' + esc(o.processus.join(' · ')) + '</dd>' : '') +
      '<dt>Fraîcheur</dt><dd>ouverte encore ' + jours + ' jours · ' + o.vues + ' vues, ' + o.interesses + ' intéressés</dd>' +
      '</dl></div>';
  }

  /* Le deck reste ferme tant que le profil ne permet pas de calculer un score.
     Ce n'est pas une politesse : sans zones ni compétences, tout ce que le deck
     afficherait serait un classement au hasard présenté comme une pertinence. */
  function verrou() {
    if (S.demo) return [];          // aperçu assumé : profil de démonstration
    return (window.AJ_PROFIL && window.AJ_PROFIL.manques) ? window.AJ_PROFIL.manques() : [];
  }

  /* L'aperçu doit rester visible : sans repère, on croit lire son propre deck.
     La pastille vit dans la barre de filtres, et sert de sortie. */
  function majPastilleDemo() {
    var f = $('#filters');
    if (!f) return;
    var ex = $('#f-demo');
    if (S.demo && !ex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.id = 'f-demo';
      b.className = 'chip demo';
      b.textContent = 'Aperçu · profil fictif ✕';
      b.title = 'Quitter l’aperçu et utiliser mon profil';
      b.onclick = function () {
        S.demo = false;
        save();
        majPastilleDemo();
        rendDeck();
      };
      f.insertBefore(b, f.firstChild);
    } else if (!S.demo && ex) {
      ex.remove();
    }
  }

  function rendVerrou(host, m) {
    var ec = $('#ec-swipe');
    if (ec) ec.classList.add('verrouille');
    host.innerHTML =
      '<div class="empty verrou"><div>' +
        '<svg class="v-cadenas" aria-hidden="true"><use href="#i-lock"/></svg>' +
        '<h2>Le deck s’ouvre avec ton profil</h2>' +
        '<p>Il reste ' + m.length + ' information' + (m.length > 1 ? 's' : '') +
        ' à renseigner. Sans elles, aucun score n’est calculable : ce qu’on afficherait ' +
        'serait un ordre au hasard présenté comme une pertinence.</p>' +
        '<ul class="v-liste">' + m.map(function (x) {
          return '<li><button type="button" data-manque="' + x.etape + '">' + esc(x.libelle) + '</button></li>';
        }).join('') + '</ul>' +
        '<div class="v-actions">' +
          '<button class="btn primaire" id="v-profil">Compléter mon profil</button>' +
          '<button type="button" class="btn-mini" id="v-demo">Voir un aperçu sans profil</button>' +
        '</div>' +
        '<p class="v-note">L’aperçu utilise un profil de démonstration. Il ne remplit rien et ne swipe rien pour toi.</p>' +
      '</div></div>';

    function va(etape) {
      var b = document.querySelector('.nav button[data-tab="profil"]');
      if (b) b.click();
      if (window.AJ_PROFIL && window.AJ_PROFIL.versEtape) window.AJ_PROFIL.versEtape(etape);
    }
    $('#v-profil').onclick = function () { va(m[0].etape); };
    $('#v-demo').onclick = function () {
      S.demo = true;
      save();
      majPastilleDemo();
      rendDeck();
    };
    Array.prototype.forEach.call(host.querySelectorAll('[data-manque]'), function (b) {
      b.onclick = function () { va(+b.dataset.manque); };
    });
    // Pas de panneau ici : « ajuste tes filtres » contredirait le verrou.
    majCompteurs();
  }

  function rendDeck() {
    var host = $('#deck');
    host.innerHTML = '';

    majPastilleDemo();
    var m = verrou();
    if (m.length) { rendVerrou(host, m); return; }
    var ec = $('#ec-swipe');
    if (ec) ec.classList.remove('verrouille');

    var l = paquet();
    if (!l.length) {
      var vus = Object.keys(S.vues).length;
      var aFiltres = S.filtres.length > 0;
      host.innerHTML = aFiltres
        ? '<div class="empty"><div><h2>Aucune offre avec ces filtres</h2>' +
          '<p>Tes filtres sont trop stricts pour ce qui reste. Retire-en un, ou touche « Pour toi » pour tout réafficher.</p>' +
          '<button class="btn primaire" id="vider" style="margin-top:var(--s5);padding:0 var(--s5)">Tout réafficher</button></div></div>'
        : '<div class="empty"><div><h2>Tu as vu les ' + vus + ' offres pertinentes</h2>' +
          '<p>Aucune autre offre ouverte ne correspond à tes critères aujourd’hui. Ouvre aux métiers proches pour élargir.</p></div></div>';
      var v = $('#vider');
      if (v) v.onclick = function () { S.filtres = []; S.ouvert = false; save(); majChips(); rendDeck(); };
    } else {
      l.slice(0, 3).reverse().forEach(function (e, i, arr) {
        var el = carte(e, arr.length - 1 - i);
        host.appendChild(el);
        prepare(el, e);          // mesure possible seulement une fois dans le document
      });
    }
    rendPanneau(l.length ? l[0] : null);
    majCompteurs();
    rendInterets();
  }

  /* --------------------------------------------------------- mes intérêts */
  function parEtat(etat) {
    return Object.keys(S.vues)
      .filter(function (id) { return S.vues[id].etat === etat; })
      .map(function (id) {
        var o = null;
        D.offres.forEach(function (x) { if (String(x.id) === String(id)) o = x; });
        return o ? { o: o, v: S.vues[id] } : null;
      })
      .filter(Boolean)
      .sort(function (a, b) { return (b.v.quand || 0) - (a.v.quand || 0); });
  }

  function majCompteurs() {
    ['oui', 'plus_tard', 'non'].forEach(function (k) {
      var n = parEtat(k).length;
      var el = document.querySelector('[data-n="' + k + '"]');
      if (el) el.textContent = n ? n : '';
    });
    var enAttente = parEtat('oui').filter(function (x) { return !x.o.aInvite; }).length;
    var matchs = parEtat('oui').filter(function (x) { return x.o.aInvite; }).length;
    var b = $('#nb-likes');
    b.textContent = String(matchs || enAttente || '');
    b.hidden = !(matchs || enAttente);
    b.style.background = matchs ? 'var(--yes)' : 'var(--no)';
  }

  function depuis(ts) {
    if (!ts) return 'date inconnue';
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'à l’instant';
    if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
    if (s < 172800) return 'hier';
    var dd = new Date(ts);
    return 'le ' + dd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  var listeActive = 'oui', selection = null;
  var large = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : { matches: false };

  /* ------------------------------------------------ la carte, en entier */
  function offreDe(id) {
    var o = null;
    D.offres.forEach(function (x) { if (String(x.id) === String(id)) o = x; });
    return o;
  }

  function montreFiche(id) {
    var o = offreDe(id);
    if (!o) return;
    var e = evalue(MOI, o);
    var f = $('#fiche');
    $('#fiche-titre').textContent = o.titre;
    $('#fiche-sous').textContent = o.org + ' · ' + o.ville;
    f.hidden = false;                              // visible d'abord : la mesure en depend

    var hote = $('#fiche-deck');
    hote.innerHTML = '';
    var el = carte(e, 0, true);                    // meme carte, sans les gestes
    hote.appendChild(el);
    prepare(el, e);

    var etat = etatDe(id);
    var boutons = [
      { a: 'deck', l: 'Remettre dans le deck', fort: true },
      { a: 'oui', l: 'Ça m’intéresse' },
      { a: 'plus_tard', l: 'Plus tard' },
      { a: 'non', l: 'Écarter' }
    ].filter(function (b) { return b.a !== etat; });

    $('#fiche-acts').innerHTML = boutons.map(function (b) {
      return '<button data-a="' + b.a + '"' + (b.fort ? ' class="fort"' : '') + '>' + b.l + '</button>';
    }).join('');
    Array.prototype.forEach.call($('#fiche-acts').children, function (btn) {
      btn.onclick = function () {
        var a = btn.dataset.a;
        if (a === 'deck') { delete S.vues[id]; if (String(S.dernier) === String(id)) S.dernier = null; }
        else S.vues[id] = { etat: a, quand: Date.now(), score: S.vues[id] ? S.vues[id].score : e.qualite };
        save(); fermeFiche(); rendDeck(); rendInterets();
      };
    });
  }
  function fermeFiche() { $('#fiche').hidden = true; $('#fiche-deck').innerHTML = ''; }
  $('#fiche-x').onclick = fermeFiche;
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fermeFiche(); });

  function rendInterets() {
    var host = $('#liste-interets');
    if (!host) return;
    majCompteurs();
    var l = parEtat(listeActive);

    if (!l.length) {
      if (large.matches) rendPanneau(null, '#side-i', 'Rien à afficher dans cette liste.');
      var vides = {
        oui: ['Rien pour l’instant', 'Les offres qui t’intéressent atterrissent ici, avec la date de ta décision et le score d’alors.'],
        plus_tard: ['Aucune offre mise de côté', 'Le bouton étoile met une offre ici sans la refuser. Tu la remets dans le deck quand tu veux.'],
        non: ['Aucune offre écartée', 'Ce que tu refuses reste consultable : un swipe est trop rapide pour être définitif.']
      }[listeActive];
      host.innerHTML = '<div class="vide"><b>' + vides[0] + '</b>' + vides[1] + '</div>';
      return;
    }

    host.innerHTML = l.map(function (x) {
      var o = x.o, ferme = o.fin < AUJ;
      var sc = x.v.score == null ? null : pc(x.v.score);
      var etat = '';
      if (ferme) etat = '<span class="etat ferme">Offre fermée</span>';
      else if (listeActive === 'oui') etat = o.aInvite
        ? '<span class="etat match">C’est un match — l’entreprise t’a aussi retenu</span>'
        : '<span class="etat attente">En attente de réponse de l’entreprise</span>';
      return '<article class="item' + (ferme ? ' closed' : '') + '" data-id="' + o.id + '">' +
        '<span class="sc" style="color:' + (sc == null ? 'var(--ink-3)' : teinte(x.v.score)) + '">' +
          (sc == null ? '—' : sc) + '<small>' + (sc == null ? 'SANS SCORE' : 'SUR 100') + '</small></span>' +
        '<div><h3>' + esc(o.titre) + '</h3>' +
        '<div class="meta">' + esc(o.org) + ' · ' + esc(o.ville) + ' · ' + o.contrat + '</div>' +
        '<div class="quand">Décidé ' + depuis(x.v.quand) + (sc == null ? '' : ' · score d’alors ' + sc + ' %') + '</div>' +
        etat +
        '<div class="actes">' +
          '<button data-a="deck" class="fort">Remettre dans le deck</button>' +
          (listeActive !== 'non' ? '<button data-a="non">Écarter</button>' : '') +
          (listeActive !== 'plus_tard' ? '<button data-a="plus_tard">Plus tard</button>' : '') +
          (listeActive !== 'oui' ? '<button data-a="oui">Ça m’intéresse</button>' : '') +
        '</div></div>' +
        '<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>' +
        '</article>';
    }).join('');

    // sur grand ecran, une ligne est toujours selectionnee : le panneau n'est jamais vide
    if (large.matches) {
      var ids = l.map(function (x) { return String(x.o.id); });
      if (ids.indexOf(String(selection)) === -1) selection = ids[0];
      var choisi = null;
      l.forEach(function (x) { if (String(x.o.id) === String(selection)) choisi = x.o; });
      rendPanneau(choisi ? evalue(MOI, choisi) : null, '#side-i',
        'Choisis une offre à gauche pour revoir son détail.');
      Array.prototype.forEach.call(host.querySelectorAll('.item'), function (it) {
        it.classList.toggle('actif', String(it.dataset.id) === String(selection));
      });
    }

    Array.prototype.forEach.call(host.querySelectorAll('.item'), function (it) {
      var id = it.dataset.id;
      it.onclick = function (ev) {
        if (ev.target.closest && ev.target.closest('[data-a]')) return;   // un bouton a la priorite
        if (large.matches) { selection = id; rendInterets(); }            // fiche dans le panneau
        else montreFiche(id);                                            // plein ecran sur mobile
      };
      Array.prototype.forEach.call(it.querySelectorAll('[data-a]'), function (b) {
        b.onclick = function (ev) {
          ev.stopPropagation();
          var a = b.dataset.a;
          if (a === 'deck') { delete S.vues[id]; if (String(S.dernier) === String(id)) S.dernier = null; }
          else S.vues[id] = { etat: a, quand: Date.now(), score: S.vues[id] ? S.vues[id].score : null };
          save(); rendDeck(); rendInterets();
        };
      });
    });
  }

  /* --------------------------------------------------------- branchements */
  function haut() { var l = paquet(); return l.length ? l[0] : null; }

  // Les quatre actions sont dans la carte : rien a brancher ici.
  /* ------------------------------------------------------ barre de filtres */
  var barre = $('#filters');

  // Combien d'offres resteraient si on activait cette puce, les autres restant en l'etat.
  function combien(f) {
    var actifs = S.filtres.slice();
    var ouvert = S.ouvert;
    if (f === 'tout') { actifs = []; ouvert = false; }
    else if (f === 'ouvert') { ouvert = !S.ouvert; }
    else if (actifs.indexOf(f) === -1) actifs.push(f);
    else actifs.splice(actifs.indexOf(f), 1);

    return D.offres.filter(function (o) {
      if (etatDe(o.id)) return false;
      var e = evalue(MOI, o);
      if (e.perime || !e.ctr.ok) return false;
      if (e.passerelle && !ouvert) return false;
      for (var i = 0; i < actifs.length; i++) {
        var fn = FILTRES[actifs[i]];
        if (fn && !fn(o)) return false;
      }
      return true;
    }).length;
  }

  function majChips() {
    var cs = barre.querySelectorAll('.chip');
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], f = c.dataset.f;
      var on = f === 'tout' ? (!S.ouvert && !S.filtres.length)
             : f === 'ouvert' ? S.ouvert
             : S.filtres.indexOf(f) !== -1;
      c.setAttribute('aria-pressed', String(on));

      if (!c.dataset.libelle) c.dataset.libelle = c.textContent.trim();
      var n = combien(f);
      // une puce qui ne donnerait aucun resultat n'a rien a faire la
      c.hidden = (f !== 'tout' && !on && n === 0);
      c.innerHTML = esc(c.dataset.libelle) +
        (f === 'tout' || on ? '' : ' <span class="cpt">' + n + '</span>');
    }
  }

  var finTire = 0;

  barre.addEventListener('click', function (ev) {
    if (Date.now() - finTire < 250) return;          // on sort d'un glissement
    var b = ev.target.closest ? ev.target.closest('.chip') : null;
    if (!b) return;
    var f = b.dataset.f;
    if (f === 'tout') { S.filtres = []; S.ouvert = false; }
    else if (f === 'ouvert') { S.ouvert = !S.ouvert; }
    else {
      var i = S.filtres.indexOf(f);
      if (i === -1) S.filtres.push(f); else S.filtres.splice(i, 1);
    }
    save(); majChips(); rendDeck();
  });

  // defilement a la souris : sur mobile le doigt suffit, sur ordinateur non
  (function () {
    var tire = null;
    barre.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'touch') return;          // on laisse faire le navigateur
      // Surtout pas de capture ici : elle redirigerait le clic vers la barre,
      // et la puce visee ne le recevrait jamais. Meme piege que sur la carte.
      tire = { x: ev.clientX, left: barre.scrollLeft, bouge: false, id: ev.pointerId, pris: false };
    });
    barre.addEventListener('pointermove', function (ev) {
      if (!tire) return;
      var dx = ev.clientX - tire.x;
      if (Math.abs(dx) > 5 && !tire.bouge) {
        tire.bouge = true;
        barre.classList.add('dragging');
        try { barre.setPointerCapture(tire.id); } catch (x) {}   // capture seulement si on glisse vraiment
        tire.pris = true;
      }
      if (tire.bouge) barre.scrollLeft = tire.left - dx;
    });
    function fin() {
      if (!tire) return;
      if (tire.bouge) finTire = Date.now();
      tire = null;
      barre.classList.remove('dragging');
    }
    barre.addEventListener('pointerup', fin);
    barre.addEventListener('pointercancel', fin);
    // molette verticale convertie en defilement horizontal
    barre.addEventListener('wheel', function (ev) {
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
      barre.scrollLeft += ev.deltaY;
      ev.preventDefault();
    }, { passive: false });
  })();

  Array.prototype.forEach.call(document.querySelectorAll('#seg-interets button'), function (b) {
    b.onclick = function () {
      listeActive = b.dataset.l;
      Array.prototype.forEach.call(document.querySelectorAll('#seg-interets button'), function (x) {
        x.setAttribute('aria-selected', String(x === b));
      });
      rendInterets();
    };
  });

  var onglets = document.querySelectorAll('.nav button');
  Array.prototype.forEach.call(onglets, function (b) {
    b.onclick = function () {
      S.onglet = b.dataset.tab; save();
      Array.prototype.forEach.call(onglets, function (x) {
        if (x === b) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
      });
      ['swipe', 'explorer', 'interets', 'messages', 'profil'].forEach(function (t) {
        $('#ec-' + t).hidden = t !== S.onglet;
      });
      if (S.onglet === 'interets') rendInterets();
      if (S.onglet === 'swipe') rendDeck();      // la mesure n'est possible qu'affichee
      if (S.onglet === 'profil' && window.AJ_PROFIL) window.AJ_PROFIL.rend();
    };
  });

  /* ------------------------------------------------------- direction artistique */
  var da = 'a';
  try { da = localStorage.getItem('aj.da') || 'a'; } catch (e) {}
  document.documentElement.setAttribute('data-da', da);

  /* --------------------------------------------------------------- départ */
  majChips();
  var actif = document.querySelector('.nav button[data-tab="' + S.onglet + '"]') || onglets[0];
  actif.click();
  rendDeck();

  // Les polices web arrivent apres le premier rendu et changent les metriques :
  // sans cette repagination, le dernier bloc deborde de quelques pixels.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (S.onglet === 'swipe') rendDeck();
    }).catch(function () {});
  }

  // rotation, clavier virtuel, changement de taille : on repagine
  var minuteur = null;
  addEventListener('resize', function () {
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { if (S.onglet === 'swipe') rendDeck(); }, 250);
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();

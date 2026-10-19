/* Adopte un Job — pôle 1 : profil, import de CV, formulaire guidé.
   Chargé AVANT app.js : le profil enregistré remplace le profil de démonstration,
   donc toute modification se répercute immédiatement sur le matching. */
(function () {
  'use strict';

  var CLE = 'aj.profil.v1';
  var D = window.AJ_DATA;
  var NIVEAU = { 1: 'Bac', 2: 'Bac+2', 3: 'Bac+3', 4: 'Bac+5' };
  var ZONES = ['Grand Nouméa', 'Sud', 'Nord', 'Îles'];
  var CONTRATS = ['CDI', 'CDD', 'Alternance', 'Intérim'];
  var METIERS = ['support informatique', 'administration systeme', 'developpement', 'donnees',
    'relation client', 'commerce', 'comptabilite', 'rh', 'logistique', 'btp', 'sante',
    'restauration', 'hotellerie', 'securite', 'telecom', 'industrie', 'formation', 'environnement'];
  var SUGG = ['Windows Server', 'Active Directory', 'Réseau', 'GLPI', 'Helpdesk', 'Sauvegarde',
    'Linux', 'SQL', 'Excel', 'Python', 'JavaScript', 'Relation client', 'Bureautique',
    'Organisation', 'Gestion de projet', 'Anglais', 'Encadrement'];

  /* ------------------------------------------------------------ le modèle */
  function vide() {
    return {
      prenom: '', initiale: '',
      zones: [], dispo: '', teletravail: 'peu importe',
      metiers: [], ouverture: 'strict', contrats: [], salaireMin: null,
      permis: null,                       // true / false / null = non renseigné
      formation: null,
      experiences: [],                    // { poste, secteur, debut, fin, competences[] }
      formations: [],                     // { niveau, domaine }
      competences: [], langues: [],       // { langue, niveau }
      cv: null,                           // { nom, taille, quand }
      devines: {}                         // champs issus de l'extraction, à confirmer
    };
  }

  function charge() {
    var p = vide();
    try {
      var brut = localStorage.getItem(CLE);
      if (brut) p = Object.assign(p, JSON.parse(brut));
    } catch (e) {}
    return p;
  }
  function sauve() {
    try { localStorage.setItem(CLE, JSON.stringify(P)); } catch (e) {}
    applique();
    if (API.onChange) API.onChange();
  }

  var P = charge();

  /* Le profil saisi remplace celui de la démonstration, champ par champ, et
     seulement s'il est renseigné : un profil incomplet ne casse pas le deck. */
  function applique() {
    var m = D.moi;
    if (P.prenom) m.prenom = P.prenom;
    if (P.zones.length) m.zones = P.zones.slice();
    if (P.contrats.length) m.contrats = P.contrats.slice();
    if (P.metiers.length) m.metiers = P.metiers.slice();
    if (P.competences.length) m.competences = P.competences.slice();
    if (P.salaireMin != null) m.salaireMin = P.salaireMin;
    if (P.formation != null) m.formation = P.formation;
    if (P.permis !== undefined) m.permis = P.permis;
    if (P.teletravail && P.teletravail !== 'peu importe') m.teletravail = P.teletravail;
    if (P.dispo) m.dispo = new Date(P.dispo);
    var ans = anneesExperience();
    if (ans != null) m.experience = ans;
  }

  function anneesExperience() {
    if (!P.experiences.length) return null;
    var mois = 0;
    P.experiences.forEach(function (x) {
      if (!x.debut) return;
      var a = new Date((x.debut.length === 4 ? x.debut + '-01' : x.debut) + '-01');
      var b = x.fin ? new Date((x.fin.length === 4 ? x.fin + '-12' : x.fin) + '-01') : D.aujourdhui;
      if (isNaN(a) || isNaN(b) || b < a) return;
      mois += (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    });
    return mois > 0 ? Math.round(mois / 12) : 0;
  }

  /* ------------------------------------------- complétude et points d'alerte */
  /* Chaque exigence connaît son étape et son champ : une alerte qui ne dit pas
     où corriger oblige l'utilisateur à chercher, et il abandonne. */
  var REQUIS = [
    ['prenom', 'Ton prénom', 0, '[data-p="prenom"]'],
    ['zones', 'Les zones où tu acceptes de travailler', 0, '[data-multi="zones"]'],
    ['dispo', 'Ta date de disponibilité', 0, '[data-p="dispo"]'],
    ['metiers', 'Le ou les métiers que tu vises', 1, '[data-multi="metiers"]'],
    ['contrats', 'Le type de contrat recherché', 1, '[data-multi="contrats"]'],
    ['experiences', 'Au moins une expérience ou une formation', 2, '[data-add="experiences"]'],
    ['formations', 'Ton niveau de formation', 2, '[data-add="formations"]'],
    ['competences', 'Au moins trois compétences', 3, '#p-comp']
  ];

  function manquesDe(e) {
    return REQUIS.filter(function (r) { return r[2] === e && !rempli(r[0]); });
  }

  function rempli(cle) {
    var v = P[cle];
    if (cle === 'competences') return v.length >= 3;
    if (cle === 'experiences') return v.length > 0 || P.formations.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return !!v;
  }

  function completude() {
    var n = REQUIS.filter(function (r) { return rempli(r[0]); }).length;
    return Math.round(n / REQUIS.length * 100);
  }

  function force() {
    var pts = 0;
    if (P.competences.length >= 6) pts += 25; else if (P.competences.length >= 3) pts += 12;
    if (P.experiences.length >= 2) pts += 25; else if (P.experiences.length === 1) pts += 15;
    if (P.experiences.some(function (x) { return x.competences && x.competences.length; })) pts += 15;
    if (P.langues.length) pts += 10;
    if (P.salaireMin != null) pts += 10;
    if (P.permis !== null) pts += 5;
    if (P.formations.length) pts += 10;
    return Math.min(100, pts);
  }

  // Niveaux 1 et 2 de l'assistant : structure et cohérence. Aucun modèle de langage.
  function alertes() {
    var a = [];
    REQUIS.forEach(function (r) {
      if (!rempli(r[0])) a.push({ t: 'manque', m: r[1] + ' n’est pas renseigné.' });
    });
    P.experiences.forEach(function (x, i) {
      if (x.debut && x.fin && x.fin < x.debut) {
        a.push({ t: 'incoherence', m: 'Expérience ' + (i + 1) + ' : la date de fin précède la date de début.' });
      }
      if (x.debut && !x.poste) {
        a.push({ t: 'manque', m: 'Expérience ' + (i + 1) + ' : l’intitulé du poste manque.' });
      }
    });
    for (var i = 0; i < P.experiences.length - 1; i++) {
      var x = P.experiences[i], y = P.experiences[i + 1];
      if (x.debut && y.fin && x.debut < y.fin) {
        a.push({ t: 'incoherence', m: 'Deux expériences se chevauchent. C’est normal ?' });
        break;
      }
    }
    if (P.salaireMin == null) a.push({ t: 'info', m: 'Sans salaire minimum, ce critère est ignoré dans le score — il ne te pénalise pas.' });
    if (P.permis === null) a.push({ t: 'info', m: 'Permis non renseigné : les offres qui l’exigent restent visibles, avec un point à vérifier.' });
    if (P.ouverture === 'strict' && P.metiers.length === 1) {
      a.push({ t: 'info', m: 'Un seul métier visé en mode strict : ton deck sera très étroit.' });
    }
    return a;
  }

  /* Le guide. Chaque conseil annonce ce qu'il rapporte : sans le gain chiffré,
     « complète ton profil » est un reproche, pas une aide. Les points sont ceux
     de force() — le guide ne peut donc pas mentir sur ce qu'il promet. */
  function conseils() {
    var c = [];
    function ajoute(gain, quoi, pourquoi, etape) {
      c.push({ gain: gain, quoi: quoi, pourquoi: pourquoi, etape: etape });
    }

    if (P.competences.length < 3) {
      ajoute(25, 'Ajoute au moins trois compétences',
        'C’est le critère le plus lourd du score : une offre qui demande trois compétences que tu n’as pas déclarées te classe bas, même si tu les as.', 3);
    } else if (P.competences.length < 6) {
      ajoute(13, 'Monte à six compétences',
        'Six, c’est le seuil où le score cesse de dépendre d’un seul mot bien placé.', 3);
    }

    if (!P.experiences.length) {
      ajoute(25, 'Décris au moins une expérience',
        'Sans expérience datée, l’ancienneté vaut zéro et toutes les offres qui demandent deux ans te filtrent.', 2);
    } else if (P.experiences.length === 1) {
      ajoute(10, 'Ajoute une deuxième expérience',
        'Deux périodes suffisent à montrer une progression — un stage, une alternance, un job d’été comptent.', 2);
    }

    if (P.experiences.length && !P.experiences.some(function (x) { return x.competences && x.competences.length; })) {
      ajoute(15, 'Rattache tes compétences à une expérience',
        'Une compétence rattachée à un poste est vérifiable ; seule dans une liste, elle ne prouve rien.', 2);
    }
    if (!P.formations.length) {
      ajoute(10, 'Renseigne ta formation',
        'Sans niveau, les offres qui exigent un diplôme te laissent en incertitude plutôt qu’en correspondance.', 2);
    }
    if (!P.langues.length) {
      ajoute(10, 'Déclare tes langues',
        'Au format européen : « B2 » se compare, « anglais courant » non.', 3);
    }
    if (P.salaireMin == null) {
      ajoute(10, 'Indique un salaire minimum',
        'Il ne te ferme aucune offre : il sert à ne pas te proposer ce que tu refuserais de toute façon.', 1);
    }
    if (P.permis === null) {
      ajoute(5, 'Réponds sur le permis B',
        'Beaucoup d’offres l’exigent. Non renseigné, l’offre reste visible mais le doute pèse sur le score.', 1);
    }

    c.sort(function (a, b) { return b.gain - a.gain; });

    // Conseils de ciblage : ils ne rapportent aucun point, ils changent le deck.
    if (P.ouverture === 'strict' && P.metiers.length === 1) {
      c.push({ gain: 0, etape: 1, quoi: 'Passe en « ouvert aux métiers proches »',
        pourquoi: 'Un seul métier en mode strict, c’est le deck le plus étroit possible. L’ouverture ajoute les métiers accessibles depuis ton parcours, étiquetés comme tels.' });
    }
    if (P.zones.length === 1) {
      c.push({ gain: 0, etape: 0, quoi: 'Accepte une zone de plus',
        pourquoi: 'La zone est un filtre dur : une offre hors zone n’apparaît jamais, quel que soit ton score.' });
    }
    if (!P.cv && P.experiences.length < 2) {
      c.push({ gain: 0, etape: 0, quoi: 'Dépose ton CV',
        pourquoi: 'Il pré-remplit le parcours et les compétences en une fois. Tu relis ensuite, ligne par ligne.' });
    }
    return c;
  }

  function rendGuide(ouvert) {
    var c = conseils();
    if (!c.length) {
      return '<div class="pal ok"><b>Profil solide</b>Rien à améliorer côté structure. ' +
        'Ce qui compte maintenant, c’est ce que tu swipes.</div>';
    }
    return '<details class="pguide"' + (ouvert ? ' open' : '') + '>' +
      '<summary>Améliorer mon profil <i>' + c.length + '</i></summary>' +
      '<p class="pa">La force du profil ne filtre rien : elle dit à quel point une entreprise peut te lire. ' +
      'Les points annoncés sont ceux qui manquent.</p>' +
      '<ol class="pconseils">' + c.map(function (x) {
        return '<li>' +
          (x.gain ? '<b class="g">+' + x.gain + '</b>' : '<b class="g z">deck</b>') +
          '<span><b>' + esc(x.quoi) + '</b>' + x.pourquoi + '</span>' +
          '<button type="button" class="btn-mini" data-e="' + x.etape + '">Corriger</button>' +
          '</li>';
      }).join('') + '</ol></details>';
  }

  /* ------------------------------------------------------------- rendu ---- */
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var etape = 0, role = 'candidat', vue = false;
  var ETAPES = ['Qui tu es', 'Ce que tu cherches', 'Ton parcours', 'Compétences', 'Relecture'];

  function puces(liste, valeurs, onToggle) {
    return liste.map(function (v) {
      var on = valeurs.indexOf(v) !== -1;
      return '<button type="button" class="pchip' + (on ? ' on' : '') + '" data-v="' + esc(v) + '">' + esc(v) + '</button>';
    }).join('');
  }

  function champ(label, html, aide) {
    return '<label class="pf"><span class="pl">' + esc(label) + '</span>' + html +
      (aide ? '<span class="pa">' + aide + '</span>' : '') + '</label>';
  }

  function marque(cle) {
    return P.devines[cle] ? '<span class="devine">extrait du CV — à confirmer</span>' : '';
  }

  function rendEtape() {
    var h = '';
    if (etape === 0) {
      h += '<div class="pgrid">' +
        champ('Prénom', '<input type="text" data-p="prenom" value="' + esc(P.prenom) + '" maxlength="30">') +
        champ('Initiale du nom', '<input type="text" data-p="initiale" value="' + esc(P.initiale) + '" maxlength="2">',
          'Ton nom complet ne sera visible qu’après un match.') +
        '</div>' + marque('prenom') +
        champ('Zones où tu acceptes de travailler',
          '<div class="pchips" data-multi="zones">' + puces(ZONES, P.zones) + '</div>',
          'On ne te demande pas où tu habites : le lieu de résidence est un critère de discrimination, et il n’a aucune utilité pour le score.') +
        '<div class="pgrid">' +
        champ('Disponible à partir du', '<input type="month" data-p="dispo" value="' + esc(P.dispo) + '">') +
        champ('Télétravail souhaité',
          '<select data-p="teletravail">' +
          ['peu importe', 'non', 'hybride', 'total'].map(function (v) {
            return '<option' + (P.teletravail === v ? ' selected' : '') + '>' + v + '</option>';
          }).join('') + '</select>') +
        '</div>';
    }

    if (etape === 1) {
      h += champ('Métiers visés — trois au maximum',
        '<div class="pchips" data-multi="metiers" data-max="3">' + puces(METIERS, P.metiers) + '</div>',
        'Ce que tu <b>vises</b>, pas ce que tu as fait. Le score compare l’offre à ton projet.') +
        champ('Ouverture',
          '<div class="pseg" data-p="ouverture">' +
          [['strict', 'Mon métier uniquement'], ['ouvert', 'Ouvert aux métiers proches']].map(function (o) {
            return '<button type="button" class="' + (P.ouverture === o[0] ? 'on' : '') + '" data-v="' + o[0] + '">' + o[1] + '</button>';
          }).join('') + '</div>',
          'En mode ouvert, des offres accessibles depuis ton parcours entrent dans le deck, avec une pénalité et une étiquette.') +
        champ('Contrats recherchés', '<div class="pchips" data-multi="contrats">' + puces(CONTRATS, P.contrats) + '</div>') +
        '<div class="pgrid">' +
        champ('Salaire mensuel minimum',
          '<input type="number" data-p="salaireMin" step="10000" min="0" value="' + (P.salaireMin == null ? '' : P.salaireMin) + '" placeholder="non renseigné">',
          'Laissé vide, ce critère est simplement ignoré — il ne te coûte aucun point.') +
        champ('Permis B',
          '<select data-p="permis">' +
          [['null', 'non renseigné'], ['true', 'oui'], ['false', 'non']].map(function (o) {
            return '<option value="' + o[0] + '"' + (String(P.permis) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select>') +
        '</div>';
    }

    if (etape === 2) {
      h += '<div class="prep">' +
        '<div class="prep-t"><h3>Expériences</h3><button type="button" class="btn-mini" data-add="experiences">+ Ajouter</button></div>' +
        (P.experiences.length ? P.experiences.map(function (x, i) {
          return '<div class="pbloc" data-i="' + i + '" data-l="experiences">' +
            '<div class="pgrid">' +
            champ('Poste occupé', '<input type="text" data-f="poste" value="' + esc(x.poste) + '">') +
            champ('Secteur de l’entreprise', '<input type="text" data-f="secteur" value="' + esc(x.secteur) + '" placeholder="ex. infogérance">') +
            '</div><div class="pgrid">' +
            champ('Début', '<input type="text" data-f="debut" value="' + esc(x.debut) + '" placeholder="2022 ou 2022-09" maxlength="7">') +
            champ('Fin', '<input type="text" data-f="fin" value="' + esc(x.fin) + '" placeholder="en cours" maxlength="7">') +
            '</div>' +
            '<button type="button" class="btn-sup" data-del>Supprimer</button></div>';
        }).join('') : '<p class="pvide">Aucune expérience. Le formulaire est le chemin principal : ajoute-les une par une.</p>') +
        '</div>' +
        '<div class="prep">' +
        '<div class="prep-t"><h3>Formations</h3><button type="button" class="btn-mini" data-add="formations">+ Ajouter</button></div>' +
        (P.formations.length ? P.formations.map(function (x, i) {
          return '<div class="pbloc" data-i="' + i + '" data-l="formations">' +
            '<div class="pgrid">' +
            champ('Niveau', '<select data-f="niveau">' +
              [1, 2, 3, 4].map(function (n) {
                return '<option value="' + n + '"' + (String(x.niveau) === String(n) ? ' selected' : '') + '>' + NIVEAU[n] + '</option>';
              }).join('') + '</select>') +
            champ('Domaine', '<input type="text" data-f="domaine" value="' + esc(x.domaine) + '">') +
            '</div>' +
            '<button type="button" class="btn-sup" data-del>Supprimer</button></div>';
        }).join('') : '<p class="pvide">Aucune formation renseignée.</p>') +
        '<p class="pa" style="margin-top:8px">L’année d’obtention n’est jamais demandée : elle donne l’âge, qui est un critère interdit.</p>' +
        '</div>';
    }

    if (etape === 3) {
      h += champ('Tes compétences',
        '<div class="psaisie"><input type="text" id="p-comp" list="p-sugg" placeholder="ajouter une compétence puis Entrée">' +
        '<datalist id="p-sugg">' + SUGG.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>' +
        '<button type="button" class="btn-mini" id="p-comp-add">Ajouter</button></div>' +
        '<div class="pchips lib">' + (P.competences.length
          ? P.competences.map(function (c) {
            return '<span class="pchip on lib">' + esc(c) + '<button type="button" data-del-comp="' + esc(c) + '" aria-label="Retirer">✕</button></span>';
          }).join('')
          : '<span class="pvide">Aucune compétence — c’est le critère le plus lourd du score.</span>') + '</div>' +
        marque('competences')) +
        '<div class="prep">' +
        '<div class="prep-t"><h3>Langues</h3><button type="button" class="btn-mini" data-add="langues">+ Ajouter</button></div>' +
        (P.langues.length ? P.langues.map(function (x, i) {
          return '<div class="pbloc" data-i="' + i + '" data-l="langues"><div class="pgrid">' +
            champ('Langue', '<input type="text" data-f="langue" value="' + esc(x.langue) + '">') +
            champ('Niveau', '<select data-f="niveau">' +
              ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(function (n) {
                return '<option' + (x.niveau === n ? ' selected' : '') + '>' + n + '</option>';
              }).join('') + '</select>') +
            '</div><button type="button" class="btn-sup" data-del>Supprimer</button></div>';
        }).join('') : '<p class="pvide">Aucune langue renseignée.</p>') +
        '<p class="pa" style="margin-top:8px">Niveaux au format européen : « B2 » se compare, « anglais courant » non.</p>' +
        '</div>';
    }

    if (etape === 4) {
      var al = alertes();
      h += '<div class="pjauges">' +
        '<div><span class="pj-l">Complétude</span><span class="pj-b"><b style="width:' + completude() + '%"></b></span><span class="pj-v">' + completude() + ' %</span></div>' +
        '<div><span class="pj-l">Force du profil</span><span class="pj-b"><b class="f" style="width:' + force() + '%"></b></span><span class="pj-v">' + force() + ' %</span></div>' +
        '</div>' +
        '<p class="pa">La complétude débloque le deck. La force ne filtre rien : elle conseille.</p>' +
        (al.length
          ? '<div class="palertes">' + al.map(function (a) {
            return '<div class="pal ' + a.t + '"><b>' + (a.t === 'manque' ? 'Il manque' : a.t === 'incoherence' ? 'À vérifier' : 'Bon à savoir') + '</b>' + a.m + '</div>';
          }).join('') + '</div>'
          : '<div class="pal ok"><b>Rien à signaler</b>Ton profil est complet et cohérent.</div>') +
        '<h3 style="margin-top:var(--s6)">Ta fiche</h3>' +
        '<p class="pa">C’est ce qu’une entreprise voit après un match. Avant le match, elle ne voit ni ton nom, ni ton contact.</p>' +
        fiche() +
        '<details class="pjson-d"><summary>Voir les données brutes (resume.json)</summary>' +
        '<p class="pa">Le format de vérité de l’application : tout ce qui est comparé, affiché ou régénéré vient de ce document. ' +
        'Rien à y faire si tu ne développes pas — la fiche du dessus dit la même chose.</p>' +
        '<pre class="pjson">' + esc(JSON.stringify(versResume(), null, 2)) + '</pre></details>' +
        '<div class="pmasque"><b>Ce qui n’est jamais collecté</b>' +
        'Ta photo, ton lieu de résidence, ta date de naissance et l’année de tes diplômes. ' +
        'Aucun de ces éléments n’entre dans le score, et chacun est un vecteur de discrimination connu.</div>';
    }
    return h;
  }

  /* La fiche, telle que l'entreprise la verra. Le JSON reste accessible,
     replié : il parle aux développeurs, pas aux candidats. */
  function fiche() {
    var ans = anneesExperience();
    var nom = (P.prenom || 'Prénom') + (P.initiale ? ' ' + P.initiale.toUpperCase() + '.' : '');
    var niv = P.formations.length
      ? Math.max.apply(null, P.formations.map(function (f) { return f.niveau || 1; }))
      : P.formation;

    function fait(icone, texte) {
      return texte ? '<div class="fl"><span>' + icone + '</span>' + esc(texte) + '</div>' : '';
    }
    function bloc(titre, corps) {
      return corps ? '<div class="fp-sec"><h4>' + titre + '</h4>' + corps + '</div>' : '';
    }
    function tags(liste) {
      return '<div class="fp-tags">' + liste.map(function (t) {
        return '<span>' + esc(t) + '</span>';
      }).join('') + '</div>';
    }

    return '<div class="fiche-p">' +
      '<div class="fp-tete">' +
        '<span class="fp-pastille">' + esc((P.prenom || '?').charAt(0).toUpperCase()) + '</span>' +
        '<div><b>' + esc(nom) + '</b><span>' +
          esc(P.metiers.length ? P.metiers.join(' · ') : 'métier visé à renseigner') +
        '</span></div>' +
        (ans != null ? '<span class="fp-ans">' + ans + '<small>AN' + (ans > 1 ? 'S' : '') + '</small></span>' : '') +
      '</div>' +

      '<div class="fp-faits">' +
        fait('◎', P.zones.join(' · ')) +
        fait('▤', P.contrats.join(' · ')) +
        fait('⬡', niv ? NIVEAU[niv] : '') +
        fait('◷', P.dispo ? 'disponible dès ' + P.dispo : '') +
        fait('◇', P.salaireMin != null ? 'à partir de ' + Math.round(P.salaireMin / 1000) + ' k XPF' : '') +
        fait('⌂', P.teletravail && P.teletravail !== 'peu importe' ? 'télétravail ' + P.teletravail : '') +
        fait('⬢', P.permis === true ? 'permis B' : (P.permis === false ? 'sans permis' : '')) +
      '</div>' +

      bloc('Parcours', P.experiences.map(function (x) {
        var d = (x.debut || '').slice(0, 4), f = (x.fin || '').slice(0, 4);
        var quand = d ? (f && f !== d ? d + '–' + f : (f ? d : d + '–…')) : '';
        return '<div class="fp-exp"><i>' + esc(quand) + '</i><span><b>' +
          esc(x.poste || 'poste non précisé') + '</b>' +
          (x.secteur ? '<em>' + esc(x.secteur) + '</em>' : '') + '</span></div>';
      }).join('')) +

      bloc('Formations', P.formations.map(function (f) {
        return '<div class="fp-exp"><i>' + esc(NIVEAU[f.niveau] || '—') + '</i>' +
          '<span><b>' + esc(f.domaine || 'formation') + '</b></span></div>';
      }).join('')) +

      bloc('Compétences', P.competences.length ? tags(P.competences) : '') +
      bloc('Langues', P.langues.length ? tags(P.langues.map(function (l) {
        return l.langue + ' ' + l.niveau;
      })) : '') +
    '</div>';
  }

  function versResume() {
    return {
      basics: {
        name: P.prenom + (P.initiale ? ' ' + P.initiale.toUpperCase() + '.' : ''),
        label: P.metiers[0] || null,
        location: { region: P.zones[0] || null }
      },
      work: P.experiences.map(function (x) {
        return { position: x.poste, industry: x.secteur, startDate: x.debut, endDate: x.fin || null };
      }),
      education: P.formations.map(function (x) {
        return { studyType: NIVEAU[x.niveau] || null, area: x.domaine };
      }),
      skills: P.competences.map(function (c) { return { name: c }; }),
      languages: P.langues.map(function (l) { return { language: l.langue, fluency: l.niveau }; }),
      x_adopteunjob: {
        targets: P.metiers, openness: P.ouverture, contracts: P.contrats,
        availability: P.dispo || null,
        mobility: { zones: P.zones, remote: P.teletravail },
        salary: P.salaireMin == null ? null : { min: P.salaireMin, currency: 'XPF', period: 'month' },
        licences: P.permis === true ? ['B'] : (P.permis === false ? [] : null)
      }
    };
  }

  /* ------------------------------------------------------- import de CV --- */
  var LIB = {
    prenom: 'Prénom', initiale: 'Initiale du nom', email: 'Adresse e-mail',
    telephone: 'Téléphone', formation: 'Niveau de formation', domaine: 'Diplôme',
    experiences: 'Expériences', formations: 'Formations', competences: 'Compétences', langues: 'Langues',
    permis: 'Permis B'
  };
  var NIVNOM = { 1: 'Bac', 2: 'Bac+2', 3: 'Bac+3', 4: 'Bac+5' };
  // Ces champs n'ont pas d'extrait : leur justificatif est une explication.
  var LISTES = ['experiences', 'formations', 'competences', 'langues'];
  var extrait = null;

  function joli(cle, v) {
    if (cle === 'formation') return NIVNOM[v] || v;
    if (cle === 'permis') return v ? 'oui' : 'non';
    if (cle === 'competences') return v.join(' · ');
    if (cle === 'langues') return v.map(function (l) { return l.langue + ' ' + l.niveau; }).join(' · ');
    if (cle === 'experiences') return v.map(function (e) {
      return (e.poste || 'poste non identifié') + ' (' + e.debut.slice(0, 4) + (e.fin ? '–' + e.fin.slice(0, 4) : '–…') + ')';
    }).join(' · ');
    if (cle === 'formations') return v.map(function (f) {
      return (f.domaine || 'formation') + ' — ' + (NIVNOM[f.niveau] || '?');
    }).join(' · ');
    return String(v);
  }

  function importe(fichier) {
    var hote = $('#p-import');
    P.cv = { nom: fichier.name, taille: fichier.size, quand: Date.now() };

    if (!/\.pdf$/i.test(fichier.name)) {
      hote.innerHTML = '<div class="pextract"><b>' + esc(fichier.name) + '</b>' +
        '<p class="pa">Seul le PDF est lu pour l’instant. Pour un fichier Word, exporte-le en PDF, ' +
        'ou remplis le formulaire — c’est de toute façon le chemin le plus fiable.</p></div>';
      return;
    }

    hote.innerHTML = '<div class="pextract"><b>Lecture de ' + esc(fichier.name) + '</b>' +
      '<ol id="p-steps"><li>Ouverture du document</li></ol></div>';
    var ol = $('#p-steps');
    var dit = function (t) { var li = document.createElement('li'); li.textContent = t; ol.appendChild(li); };

    window.AJ_EXTRACTION.lit(fichier).then(function (r) {
      dit('Texte et mise en page extraits');
      if (r.vide) {
        hote.innerHTML = '<div class="pextract"><b>' + esc(fichier.name) + '</b>' +
          '<p class="pa">Ce PDF ne contient aucun texte : c’est une image ou un document scanné. ' +
          'Il faudrait de la reconnaissance de caractères, écartée de la version 1. ' +
          'Remplis le formulaire, c’est plus rapide que de corriger une mauvaise lecture.</p></div>';
        return;
      }
      dit('Lecture structurée : ' + Object.keys(r.trouve).length + ' information(s) reconnue(s)');
      extrait = r;
      rendRelecture();
    }).catch(function (e) {
      hote.innerHTML = '<div class="pextract"><b>Lecture impossible</b>' +
        '<p class="pa">' + esc(e.message || 'erreur inconnue') + '. Le formulaire reste disponible.</p></div>';
    });
  }

  /* L'extraction ne remplit rien toute seule : on montre ce qui a ete lu,
     avec l'extrait du CV d'ou ca vient, et l'utilisateur decoche ce qui est faux. */
  function rendRelecture() {
    var hote = $('#profil-hote');
    var cles = Object.keys(extrait.trouve);
    hote.innerHTML =
      '<h2>Ce qu’on a lu dans ton CV</h2>' +
      '<p class="lead">Rien n’est enregistré tant que tu n’as pas validé. Décoche ce qui est faux : ' +
      'une lecture automatique se trompe, et c’est normal.</p>' +
      '<div class="prelu">' + cles.map(function (k) {
        return '<label class="plu"><input type="checkbox" checked data-k="' + k + '">' +
          '<span><b>' + esc(LIB[k] || k) + '</b>' + esc(joli(k, extrait.trouve[k])) +
          // « lu dans » ne vaut que devant un extrait du CV. Devant une
          // explication, c'est faux ; devant la valeur répétée, c'est du bruit.
          (extrait.sources[k] && extrait.sources[k] !== joli(k, extrait.trouve[k])
            ? '<cite>' + (LISTES.indexOf(k) === -1 ? 'lu dans : ' : '') +
              esc(extrait.sources[k]) + '</cite>' : '') +
          '</span></label>';
      }).join('') + '</div>' +
      '<div class="pal info" style="margin-top:var(--s4)"><b>Ce qui n’est pas déduit</b>' +
      'Les métiers que tu vises, tes zones acceptées et ton contrat souhaité ne sont pas dans un CV : ' +
      'il décrit ton passé, pas ton projet. Tu les renseignes juste après.</div>' +
      '<div class="pnav"><button type="button" class="btn-mini" id="r-annule">Annuler</button>' +
      '<button type="button" class="btn-fort" id="r-ok">Valider et continuer</button></div>';

    $('#r-annule').onclick = function () { extrait = null; rend(); };
    $('#r-ok').onclick = function () {
      var pris = {};
      Array.prototype.forEach.call(hote.querySelectorAll('[data-k]'), function (c) {
        if (c.checked) pris[c.dataset.k] = extrait.trouve[c.dataset.k];
      });
      Object.keys(pris).forEach(function (k) {
        if (k === 'formations') {
          P.formations = pris[k];
          P.formation = Math.max.apply(null, pris[k].map(function (f) { return f.niveau || 1; }));
        } else if (k === 'formation') {
          if (!P.formations.length) P.formation = pris[k];
        } else if (k === 'email' || k === 'telephone') {
          P[k] = pris[k];
        } else {
          P[k] = pris[k];
        }
        P.devines[k] = 1;
      });
      extrait = null;
      sauve();
      etape = 1;                       // on enchaine sur « ce que tu cherches »
      rend();
    };
  }

  /* --------------------------------------------------------------- écran -- */
  function rendRecruteur() {
    var hote = $('#profil-hote');
    var miennes = D.offres.filter(function (o) { return o.mienne; });
    hote.innerHTML =
      '<div class="prole">' +
        '<button type="button" data-role="candidat">Je cherche un emploi</button>' +
        '<button type="button" class="on" data-role="recruteur">Je recrute</button>' +
      '</div>' +
      '<h2>Déposer une offre</h2>' +
      '<p class="lead">Les mêmes questions que pour un candidat, dans l’autre sens. Ce sont elles qui décident quels profils vous seront proposés.</p>' +
      '<div class="pimport">' +
        '<div class="pvoie">' +
          '<b>J’ai déjà l’annonce</b><span>Dépose le PDF ou colle le texte : l’extraction pré-remplit les réponses, tu les corriges ensuite.</span>' +
          '<label class="btn-fichier">Déposer un PDF<input type="file" id="o-fichier" accept=".pdf,.doc,.docx" hidden></label>' +
          '<em>Lecture réelle du PDF, sur ton appareil.</em>' +
        '</div>' +
        '<div class="pvoie mise">' +
          '<b>Répondre aux questions</b><span>Quinze questions courtes. Elles font la différence entre « on verra bien » et un vrai ciblage.</span>' +
          '<button type="button" class="btn-fort" id="o-quest">Commencer</button>' +
        '</div>' +
      '</div>' +
      '<label class="pf" style="margin-bottom:var(--s5)"><span class="pl">Ou colle le texte de l’annonce</span>' +
        '<textarea id="o-texte" rows="5" placeholder="Colle ici l’annonce telle qu’elle est publiée ailleurs."></textarea>' +
        '<span class="pa">Même chaîne de traitement que pour un CV : extraction, puis relecture par toi.</span></label>' +
      '<button type="button" class="btn-mini" id="o-texte-go">Analyser ce texte</button>' +
      (miennes.length
        ? '<h3 style="margin-top:var(--s7)">Tes offres</h3>' + miennes.map(function (o) {
            return '<div class="tile"><b>' + esc(o.titre) + '</b><span>' + esc(o.org) + ' · ' + esc(o.ville) +
              ' · ' + o.contrat + ' · ' + (o.reconversion ? 'ouverte aux reconversions' : 'métier obligatoire') + '</span></div>';
          }).join('')
        : '<p class="pvide" style="margin-top:var(--s6)">Aucune offre déposée pour l’instant.</p>');

    Array.prototype.forEach.call(hote.querySelectorAll('[data-role]'), function (b) {
      b.onclick = function () { role = b.dataset.role; rend(); };
    });
    $('#o-quest').onclick = lanceOffre;
    var depuisTexte = function () { lanceOffre(); };
    $('#o-texte-go').onclick = depuisTexte;
    $('#o-fichier').onchange = function () { if (this.files && this.files[0]) depuisTexte(); };
  }

  function rend() {
    var hote = $('#profil-hote');
    if (!hote) return;
    var c = completude();

    if (role === 'recruteur') { rendRecruteur(); return; }
    if (vue) { rendVue(); return; }

    hote.innerHTML =
      '<div class="prole">' +
        '<button type="button" class="on" data-role="candidat">Je cherche un emploi</button>' +
        '<button type="button" data-role="recruteur">Je recrute</button>' +
      '</div>' +
      '<div class="pcols"><div class="pcol-a">' +
      '<h2>Mon profil</h2>' +
      '<p class="lead">Une fiche structurée, que tu vérifies et corriges. C’est elle qui décide de ce que le deck te propose.</p>' +

      '<div class="pentete">' +
        '<div class="pbar"><b style="width:' + c + '%"></b></div>' +
        '<span class="pc">' + c + ' % complété</span>' +
        (P.cv ? '<span class="pcv">CV : ' + esc(P.cv.nom) + '</span>' : '') +
      '</div>' +

      '<div id="p-import" class="pimport">' +
        '<div class="pvoie">' +
          '<b>J’ai un CV</b><span>Dépose ton PDF : il est lu dans ton navigateur, rien n’est envoyé. Tu relis ensuite ce qui a été trouvé, champ par champ.</span>' +
          '<label class="btn-fichier">Choisir un fichier<input type="file" id="p-fichier" accept=".pdf,.doc,.docx" hidden></label>' +
          '<em>Lecture réelle du PDF, sur ton téléphone ou ton ordinateur.</em>' +
        '</div>' +
        '<div class="pvoie">' +
          '<b>Je pars de zéro</b><span>Le formulaire guidé, étape par étape. C’est le chemin principal, pas la solution de repli.</span>' +
          '<button type="button" class="btn-mini" id="p-zero">Remplir à la main</button>' +
        '</div>' +
        '<div class="pvoie mise">' +
          '<b>Affiner par questions</b><span>Neuf questions courtes, une par écran, pour cibler ce que le deck doit te proposer. C’est le chemin le plus rapide sur téléphone.</span>' +
          '<button type="button" class="btn-fort" id="p-quest">Répondre aux questions</button>' +
        '</div>' +
      '</div>' +

      '<div class="petapes">' + ETAPES.map(function (t, i) {
        var m = manquesDe(i).length;
        return '<button type="button" class="' + (i === etape ? 'on' : '') + (i < etape ? ' fait' : '') + '" data-e="' + i + '">' +
          '<span class="n">' + (i + 1) + '</span>' + esc(t) +
          (m ? '<i class="pm" title="' + m + ' champ(s) à renseigner">' + m + '</i>' : '') + '</button>';
      }).join('') + '</div>' +

      (function () {
        var m = manquesDe(etape);
        if (!m.length) return '';
        return '<div class="pmanques"><b>Il manque ' + (m.length === 1 ? 'une chose' : m.length + ' choses') + ' sur cet écran</b><ul>' +
          m.map(function (r) {
            return '<li><button type="button" data-vers="' + esc(r[3]) + '">' + esc(r[1]) + '</button></li>';
          }).join('') + '</ul></div>';
      })() +

      '<div class="pform">' + rendEtape() + '</div>' +
      '</div><aside class="pcol-b">' + rendGuide(true) + '</aside></div>' +

      '<div class="pnav">' +
        (etape > 0 ? '<button type="button" class="btn-mini" id="p-prec">← Précédent</button>' : '<span></span>') +
        (etape < ETAPES.length - 1
          ? '<button type="button" class="btn-fort" id="p-suiv">Suivant →</button>'
          : '<span class="pnav-fin">' +
              '<button type="button" class="btn-mini" id="p-voir">Enregistrer et voir mon profil</button>' +
              '<button type="button" class="btn-fort" id="p-fin">Enregistrer et voir les offres</button>' +
            '</span>') +
      '</div>';

    branche();
  }

  /* Voir son profil sans le formulaire : la même fiche, en grand, avec
     les deux seules suites possibles — corriger, ou retourner au deck. */
  function rendVue() {
    var hote = $('#profil-hote');
    var al = alertes();
    hote.innerHTML =
      '<h2>Mon profil</h2>' +
      '<p class="lead">Enregistré. Voilà ce que l’application compare aux offres, et ce qu’une entreprise verra de toi après un match.</p>' +
      '<div class="pjauges">' +
        '<div><span class="pj-l">Complétude</span><span class="pj-b"><b style="width:' + completude() + '%"></b></span><span class="pj-v">' + completude() + ' %</span></div>' +
        '<div><span class="pj-l">Force du profil</span><span class="pj-b"><b class="f" style="width:' + force() + '%"></b></span><span class="pj-v">' + force() + ' %</span></div>' +
      '</div>' +
      rendGuide(false) +
      fiche() +
      (al.length
        ? '<div class="palertes">' + al.map(function (a) {
          return '<div class="pal ' + a.t + '"><b>' + (a.t === 'manque' ? 'Il manque' : a.t === 'incoherence' ? 'À vérifier' : 'Bon à savoir') + '</b>' + a.m + '</div>';
        }).join('') + '</div>'
        : '') +
      '<div class="pnav">' +
        '<button type="button" class="btn-mini" id="v-edit">← Modifier mon profil</button>' +
        '<button type="button" class="btn-fort" id="v-deck">Voir les offres</button>' +
      '</div>';

    $('#v-edit').onclick = function () { vue = false; rend(); };
    $('#v-deck').onclick = auDeck;
  }

  function auDeck() {
    var b = document.querySelector('.nav button[data-tab="swipe"], [data-tab="swipe"]');
    if (b) b.click();
  }

  function vers(selecteur) {
    var el = document.querySelector(selecteur);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var champ = el.closest ? (el.closest('.pf') || el.closest('.prep') || el) : el;
    champ.classList.add('vise');
    setTimeout(function () { champ.classList.remove('vise'); }, 1600);
    if (el.focus && /INPUT|SELECT|TEXTAREA/.test(el.tagName)) el.focus({ preventScroll: true });
  }

  function branche() {
    var hote = $('#profil-hote');

    Array.prototype.forEach.call(hote.querySelectorAll('[data-e]'), function (b) {
      b.onclick = function () { etape = +b.dataset.e; rend(); };
    });
    /* « Corriger » et les manques mènent au champ, pas seulement à l'écran :
       une alerte qui laisse chercher ne sert à rien. */
    Array.prototype.forEach.call(hote.querySelectorAll('[data-vers]'), function (b) {
      b.onclick = function () { vers(b.dataset.vers); };
    });
    if ($('#p-prec')) $('#p-prec').onclick = function () { etape--; rend(); };
    if ($('#p-suiv')) $('#p-suiv').onclick = function () { etape++; rend(); };
    if ($('#p-fin')) $('#p-fin').onclick = function () { sauve(); auDeck(); };
    if ($('#p-voir')) $('#p-voir').onclick = function () {
      sauve();
      vue = true;
      rend();
      window.scrollTo(0, 0);
    };
    if ($('#p-zero')) $('#p-zero').onclick = function () { etape = 0; rend(); };
    if ($('#p-quest')) $('#p-quest').onclick = lanceQuestionnaire;
    Array.prototype.forEach.call(hote.querySelectorAll('[data-role]'), function (b) {
      b.onclick = function () { role = b.dataset.role; rend(); };
    });
    if ($('#p-fichier')) $('#p-fichier').onchange = function () {
      if (this.files && this.files[0]) importe(this.files[0]);
    };

    // champs simples
    Array.prototype.forEach.call(hote.querySelectorAll('[data-p]'), function (el) {
      el.oninput = el.onchange = function () {
        var k = el.dataset.p, v = el.value;
        if (k === 'salaireMin') v = v === '' ? null : parseInt(v, 10);
        if (k === 'permis') v = v === 'null' ? null : v === 'true';
        P[k] = v;
        delete P.devines[k];
        sauve();
      };
    });

    // segments (ouverture)
    Array.prototype.forEach.call(hote.querySelectorAll('.pseg button'), function (b) {
      b.onclick = function () { P[b.parentNode.dataset.p] = b.dataset.v; sauve(); rend(); };
    });

    // listes à cocher
    Array.prototype.forEach.call(hote.querySelectorAll('.pchips[data-multi] .pchip'), function (b) {
      b.onclick = function () {
        var boite = b.parentNode, cle = boite.dataset.multi, max = +(boite.dataset.max || 0);
        var l = P[cle], v = b.dataset.v, i = l.indexOf(v);
        if (i === -1) { if (max && l.length >= max) return; l.push(v); } else l.splice(i, 1);
        sauve(); rend();
      };
    });

    // blocs répétables
    Array.prototype.forEach.call(hote.querySelectorAll('[data-add]'), function (b) {
      b.onclick = function () {
        var l = b.dataset.add;
        P[l].push(l === 'experiences' ? { poste: '', secteur: '', debut: '', fin: '', competences: [] }
          : l === 'formations' ? { niveau: 2, domaine: '' } : { langue: '', niveau: 'B1' });
        sauve(); rend();
      };
    });
    Array.prototype.forEach.call(hote.querySelectorAll('.pbloc'), function (bl) {
      var l = bl.dataset.l, i = +bl.dataset.i;
      Array.prototype.forEach.call(bl.querySelectorAll('[data-f]'), function (el) {
        el.oninput = el.onchange = function () {
          var v = el.value;
          if (el.dataset.f === 'niveau' && l === 'formations') v = parseInt(v, 10);
          P[l][i][el.dataset.f] = v;
          if (l === 'formations') P.formation = Math.max.apply(null, P.formations.map(function (f) { return f.niveau || 1; }));
          sauve();
        };
      });
      bl.querySelector('[data-del]').onclick = function () { P[l].splice(i, 1); sauve(); rend(); };
    });

    // compétences
    if ($('#p-comp')) {
      var ajoute = function () {
        var v = $('#p-comp').value.trim();
        if (!v) return;
        if (P.competences.indexOf(v) === -1) P.competences.push(v);
        $('#p-comp').value = '';
        sauve(); rend();
        var f = $('#p-comp'); if (f) f.focus();
      };
      $('#p-comp').onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ajoute(); } };
      $('#p-comp-add').onclick = ajoute;
      Array.prototype.forEach.call(hote.querySelectorAll('[data-del-comp]'), function (b) {
        b.onclick = function () {
          var i = P.competences.indexOf(b.dataset.delComp);
          if (i !== -1) P.competences.splice(i, 1);
          sauve(); rend();
        };
      });
    }
  }

  /* ------------------------------------------------- questionnaires ------ */
  function appliqueReponses(r) {
    ['metiers', 'zones', 'contrats', 'ouverture', 'teletravail', 'refus'].forEach(function (k) {
      if (r[k] !== undefined) P[k] = r[k];
    });
    if (r.salaireMin !== undefined) P.salaireMin = r.salaireMin;
    if (r.permis !== undefined) P.permis = r.permis;
    if (r.dispoChoix) {
      var m = { now: 0, '1': 1, '3': 3, '6': 6 }[r.dispoChoix] || 0;
      var d = new Date(D.aujourdhui.getTime());
      d.setMonth(d.getMonth() + m);
      P.dispo = d.toISOString().slice(0, 7);
    }
    sauve();
  }

  function lanceQuestionnaire() {
    var hote = $('#profil-hote');
    window.AJ_QUESTIONS.ouvre('candidat', function (r) {
      appliqueReponses(r);
      etape = 4;
      rend();
    }, hote);
  }

  function lanceOffre() {
    var hote = $('#profil-hote');
    window.AJ_QUESTIONS.ouvre('offre', function (r) {
      var o = window.AJ_QUESTIONS.creeOffre(r);
      hote.innerHTML =
        '<div class="quest"><div class="qcompte">Offre déposée</div>' +
        '<h2 class="qtitre">' + esc(o.titre) + '</h2>' +
        '<p class="qaide">Elle entre immédiatement dans le deck des candidats dont le profil passe ' +
        'ses contraintes. Va voir l’onglet Swipe : elle y est, avec son score calculé.</p>' +
        '<div class="pmasque"><b>Ce que ton questionnaire a produit</b>' +
        (o.requis.length ? o.requis.length + ' compétence(s) exigée(s), ' : 'aucune compétence exigée, ') +
        (o.souhaite.length ? o.souhaite.length + ' souhaitée(s), ' : 'aucune souhaitée, ') +
        (o.salaire ? 'salaire annoncé, ' : 'salaire non annoncé — la confiance du score en pâtit, ') +
        (o.reconversion ? 'ouverte aux reconversions.' : 'fermée aux reconversions.') +
        '</div>' +
        '<div class="qnav"><span></span><button type="button" class="btn-fort" id="q-retour">Revenir au profil</button></div></div>';
      $('#q-retour').onclick = function () { role = 'candidat'; rend(); };
    }, hote);
  }

  var API = {
    rend: rend, onChange: null, completude: completude, force: force,
    profil: function () { return P; },
    /* Ce que le deck a besoin de savoir : ce qui manque, et où le corriger. */
    manques: function () {
      return REQUIS.filter(function (r) { return !rempli(r[0]); })
        .map(function (r) { return { libelle: r[1], etape: r[2] }; });
    },
    versEtape: function (e) {
      vue = false;
      role = 'candidat';
      etape = Math.max(0, Math.min(ETAPES.length - 1, e | 0));
      rend();
      window.scrollTo(0, 0);
    }
  };
  window.AJ_PROFIL = API;
  applique();
})();

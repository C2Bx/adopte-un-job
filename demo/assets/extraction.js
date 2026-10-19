/* Adopte un Job — lecture réelle d'un CV PDF, dans le navigateur.
   Deux étapes, comme dans la doc : extraction du texte AVEC sa mise en page
   (sans quoi un CV sur deux colonnes s'entrelace), puis heuristiques.
   Aucun modèle de langage : ce qui n'est pas trouvé reste vide. */
(function () {
  'use strict';

  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var pret = null;

  function chargePdfJs() {
    if (pret) return pret;
    pret = new Promise(function (ok, non) {
      if (window.pdfjsLib) return ok(window.pdfjsLib);
      var s = document.createElement('script');
      s.src = CDN + 'pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + 'pdf.worker.min.js';
        ok(window.pdfjsLib);
      };
      s.onerror = function () { non(new Error('bibliothèque PDF inaccessible')); };
      document.head.appendChild(s);
    });
    return pret;
  }

  /* ------------------------------------------------------------------------
     Texte + mise en page. On regroupe les fragments en lignes par ordonnée,
     puis on sépare les colonnes : un CV sur deux colonnes lu de gauche à
     droite mélange les rubriques et rend tout le reste faux.
     ------------------------------------------------------------------------ */
  /* Où couper les colonnes ? Sûrement pas au milieu de la page : la colonne
     de droite d'un CV commence rarement à 50 %. On cherche l'abscisse que le
     moins de fragments traversent, en tolérant les quelques bandeaux qui
     courent sur toute la largeur — un titre pleine largeur ne doit pas
     masquer la gouttière. */
  function coupure(frags, largeur) {
    var best = null;
    for (var x = largeur * 0.2; x <= largeur * 0.8; x += 4) {
      var croise = 0, g = 0, d = 0;
      for (var i = 0; i < frags.length; i++) {
        var f = frags[i], fin = f.x + (f.w || 0);
        if (f.x < x && fin > x) croise++;
        else if (fin <= x) g++;
        else d++;
      }
      if (Math.min(g, d) < Math.max(6, frags.length * 0.2)) continue;
      if (!best || croise < best.croise) best = { x: x, croise: croise };
    }
    if (!best) return null;
    /* Une poignée de traversants est normale : bandeau du nom, paragraphe de
       bas de page. Une vraie page sur une seule colonne, elle, est traversée
       par presque toutes ses lignes — et l'équilibre ci-dessus l'écarte déjà. */
    return best.croise <= Math.max(2, frags.length * 0.15) ? best.x : null;
  }

  function assemble(liste) {
    var parY = {};
    liste.forEach(function (f) {
      var cle = Math.round(f.y / 3) * 3;            // tolérance de 3 points
      (parY[cle] = parY[cle] || []).push(f);
    });
    return Object.keys(parY)
      .map(Number)
      .sort(function (a, b) { return b - a; })      // haut vers bas
      .map(function (y) {
        return parY[y].sort(function (a, b) { return a.x - b.x; })
          .map(function (f) { return f.t; }).join(' ')
          .replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean);
  }

  function lignesDePage(contenu, largeur, hauteur) {
    var frags = contenu.items.map(function (it) {
      return {
        t: it.str, x: it.transform[4], y: Math.round(it.transform[5]), w: it.width,
        h: it.height || Math.abs(it.transform[3]) || 0
      };
    }).filter(function (f) { return f.t && f.t.trim(); });
    if (!frags.length) return { lignes: [], entete: [] };

    /* Le bandeau d'identité : le plus gros texte de la page, pas le plus haut.
       « 27 ans - Permis de conduire », « Formations » ou « &HACKING ETHIQUE »
       occupaient le haut de page sur trois CV du corpus, et devenaient le nom. */
    var maxH = 0, compte = {};
    frags.forEach(function (f) {
      if (f.h > maxH) maxH = f.h;
      var c = Math.round(f.h);
      compte[c] = (compte[c] || 0) + 1;
    });
    // La taille du corps de texte, c'est celle qu'on rencontre le plus souvent.
    var corps = 0, mieux = 0;
    Object.keys(compte).forEach(function (c) {
      if (compte[c] > mieux) { mieux = compte[c]; corps = +c; }
    });
    /* Deux garde-fous : une fraction de la plus grande taille, pour ne pas
       perdre un prénom écrit plus petit que le nom ; et un net écart au corps
       de texte, pour ne pas laisser entrer les intertitres. */
    var seuil = Math.max(maxH * 0.55, corps * 1.35);
    var gros = frags.filter(function (f) { return f.h >= seuil; });
    // On compte les LIGNES, pas les fragments : un nom peut être découpé en
    // huit morceaux et rester une seule ligne.
    var lignesGros = assemble(gros);
    var entete = (lignesGros.length && lignesGros.length <= 6) ? lignesGros
      : assemble(frags.filter(function (f) { return f.y > hauteur * 0.8; }));

    var x = coupure(frags, largeur);
    if (x == null) return { lignes: assemble(frags), entete: entete };

    return {
      lignes: assemble(frags.filter(function (f) { return f.x + (f.w || 0) / 2 < x; }))
        .concat(assemble(frags.filter(function (f) { return f.x + (f.w || 0) / 2 >= x; }))),
      entete: entete
    };
  }

  function lit(fichier) {
    return chargePdfJs().then(function (pdfjs) {
      return fichier.arrayBuffer();
    }).then(function (buf) {
      return window.pdfjsLib.getDocument({ data: buf }).promise;
    }).then(function (doc) {
      var pages = [];
      for (var i = 1; i <= doc.numPages; i++) pages.push(i);
      return Promise.all(pages.map(function (n) {
        return doc.getPage(n).then(function (page) {
          var vue = page.getViewport({ scale: 1 });
          return page.getTextContent().then(function (c) {
            return lignesDePage(c, vue.width, vue.height);
          });
        });
      })).then(function (parPage) {
        var l = [];
        parPage.forEach(function (p) { l = l.concat(p.lignes); });
        return { lignes: l, entete: parPage[0].entete, pages: doc.numPages };
      });
    });
  }

  /* ------------------------------------------------------------ heuristiques */
  var DICO = [
    // informatique
    'Windows Server', 'Active Directory', 'Réseau', 'Système', 'Linux', 'Docker', 'Virtualisation',
    'SQL', 'MySQL', 'PostgreSQL', 'Base de données', 'Python', 'JavaScript', 'TypeScript', 'PHP',
    'React', 'Vue', 'Angular', 'Node', 'HTML', 'CSS', 'Git', 'WordPress', 'Symfony', 'Laravel',
    'Java', 'API', 'Développement web', 'Développement', 'Intégration', 'Cybersécurité',
    'Support informatique', 'Helpdesk', 'GLPI', 'Sauvegarde', 'Maintenance', 'Automatisation',
    // outils et bureautique
    'Excel', 'Word', 'PowerPoint', 'Bureautique', 'Power BI', 'Figma', 'Photoshop', 'Illustrator',
    'Canva', 'SEO', 'CRM', 'ERP', 'Sage',
    // metiers et gestion
    'Gestion de projet', 'Management', 'Encadrement', 'Relation client', 'Vente', 'Accueil',
    'Comptabilité', 'Paie', 'Recrutement', 'Formation', 'Pédagogie', 'Communication',
    'Rédaction', 'Marketing', 'Analyse', 'Logistique', 'Achats', 'Qualité',
    // terrain et habilitations
    'CACES', 'HACCP', 'Habilitation électrique', 'Soudure', 'Lecture de plans', 'Sécurité chantier',
    'Électricité', 'Mécanique', 'Électrotechnique', 'Soins', 'Conduite',
    // langues et transverses
    'Anglais', 'Espagnol', 'Travail en équipe', 'Autonomie', 'Rigueur', 'Organisation',
    // termes vus dans le corpus et absents du référentiel
    'Cisco', 'DHCP', 'DNS', 'VLAN', 'Routage', 'NAS', 'Fibre optique', 'Supervision',
    'Trello', 'Slack', 'Next.js', 'Leaflet', 'Arduino', 'C++', 'Access', 'Office 365',
    'Déploiement', 'Inventaire', 'Ticketing', 'PRTG', 'Portfolio'
  ];

  var LANGUES = ['Anglais', 'Espagnol', 'Allemand', 'Italien', 'Japonais', 'Chinois', 'Portugais'];

  function sansAccent(s) {
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }

  var SEC_EXP = /exp[ée]rience|parcours pro|professionnel|emploi|stage|alternance/i;
  var SEC_FOR = /scolarit|scolaire|formation|[ée]tudes|dipl[ôo]me|cursus|[ée]cole|universit|parcours/i;
  /* Les rubriques qui ferment la section en cours. Un titre en capitales qui
     n'est dans aucune de ces listes n'est pas une rubrique : c'est un intitulé
     de poste, et le prendre pour une rubrique fait disparaître l'emploi. */
  var AUTRE_RUBRIQUE = /^(profil|à propos|a propos|contact|comp[ée]tences?|langues?|centres?|loisirs|savoir|int[ée]r[êe]ts?|motivations?|r[ée]f[ée]rences?|certifications?|distinctions?|b[ée]n[ée]volat|hobbies)/i;
  var DIPL = /(bts|dut|\bbut\b|licence|master|mast[eè]re|bachelor|ing[ée]nieur|miage|mba|bac\b|baccalaur|cap\b|bep\b)/i;
  var RUBRIQUE = /^(cv|curriculum|vitae|contact|profil|comp[ée]tences?|exp[ée]riences?|formations?|scolarit[ée]|langues?|centres?|loisirs|projets?|objectif|r[ée]f[ée]rences?|motivations?)$/i;
  var METIER = /d[ée]veloppeur|technicien|assistant|responsable|charg[ée]|ing[ée]nieur|consultant|manager|directeur|agent|conseiller|vendeur|serveur|cuisinier|op[ée]rateur|secr[ée]taire|comptable|infirmi|[ée]ducateur|animateur|chauffeur|m[ée]canicien|[ée]lectricien|plombier|ma[çc]on|menuisier|coiffeur|esth[ée]tic|juriste|architecte|designer|graphiste|commercial|apprenti|[ée]tudiant|alternant|polyvalent|junior|senior|freelance|stagiaire/i;

  /* Les libellés de rubrique, en toutes lettres. La liste est fermée et ancrée :
     « Stage chez Machin » ne doit pas devenir une rubrique, « Experience » si.
     Exiger les capitales faisait perdre TOUTES les expériences d'un CV qui
     écrit « Experience » en casse normale — sans un message. */
  var RUBRIQUE_LIB = /^(exp[ée]riences?( professionnelles?| scolaires?| pro)?|parcours( professionnel| scolaire)?|formations?|scolarit[ée]|[ée]tudes|dipl[ôo]mes?|comp[ée]tences?|langues?|profil|contacts?|centres? d[’']int[ée]r[êe]ts?|loisirs|savoir[- ][êe]tre|motivations?|projets?|certifications?|r[ée]f[ée]rences?|[àa] propos( de moi)?|hobbies|distinctions?|b[ée]n[ée]volat|informations?)$/i;

  /* « E X P E R I E N C E » : certains gabarits espacent chaque lettre. Sans
     recoller, aucune rubrique n'est reconnue et tout le CV part en vrac. */
  function normaliseTitre(l) {
    /* Beaucoup de gabarits collent un pictogramme devant le libellé. Il arrive
       dans le texte comme un caractère de la zone privée : invisible, et il
       empêchait toute rubrique d'être reconnue. */
    var t = l.trim().replace(/^[^A-Za-zÀ-ÿ]+/, '').replace(/[:•·|]+$/, '').trim();
    if (/^(?:[A-Za-zÀ-ÿ]\s+){3,}[A-Za-zÀ-ÿ]$/.test(t)) t = t.replace(/\s+/g, '');
    return t;
  }

  /* Deux colonnes à la même hauteur donnent « EXPÉRIENCES LANGUES » sur une
     seule ligne. On accepte donc une ligne entièrement composée de libellés de
     rubrique, et on retient le premier — mais « Formation continue à distance »
     n'en est pas une : la seconde moitié doit être un libellé, elle aussi. */
  function rubriqueDe(l) {
    var t = normaliseTitre(l);
    if (RUBRIQUE_LIB.test(t)) return t;
    var mots = t.split(/\s+/);
    for (var i = 1; i < mots.length; i++) {
      var a = mots.slice(0, i).join(' '), b = mots.slice(i).join(' ');
      if (RUBRIQUE_LIB.test(a) && RUBRIQUE_LIB.test(b)) return a;
    }
    return null;
  }

  function estTitre(l) {
    var t = normaliseTitre(l);
    if (t.length < 4 || t.length > 34 || /\d/.test(t)) return false;
    if (rubriqueDe(l)) return true;
    return t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
  }

  function analyse(lignes, entete) {
    var texte = lignes.join('\n');
    var plat = sansAccent(texte).toLowerCase();
    var trouve = {}, sources = {};

    function pose(cle, valeur, source) {
      if (valeur == null || (Array.isArray(valeur) && !valeur.length) || valeur === '') return;
      trouve[cle] = valeur;
      sources[cle] = (source || '').slice(0, 90);
    }

    // contact
    var m = texte.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
    if (m) pose('email', m[0], m[0]);
    /* Un numéro calédonien tient en six chiffres : exiger sept en perdait un.
       On garde le plus long candidat de la page, pour préférer un numéro avec
       indicatif à un fragment. */
    var tels = texte.match(/(?:\+\d{2,3}[ .]?)?(?:\d[ .]?){5,12}\d/g) || [];
    tels = tels.filter(function (x) { return /\d{6,}/.test(x.replace(/\D/g, '')); });
    // « 2022 2023 » a huit chiffres et n'est pas un numéro : c'est une période.
    tels = tels.filter(function (x) { return !/^(?:19|20)\d{2}(?:19|20)\d{2}$/.test(x.replace(/\D/g, '')); });
    if (tels.length) {
      tels.sort(function (a, b) { return b.replace(/\D/g, '').length - a.replace(/\D/g, '').length; });
      pose('telephone', tels[0].trim(), tels[0].trim());
    }

    /* Identité. Le nom est dans le bandeau du haut — pas forcément dans les
       premières lignes de la colonne de gauche. On écarte d'abord l'intitulé
       de poste, qui vit au même endroit et se lit comme un prénom. */
    var haut = (entete && entete.length ? entete : lignes.slice(0, 8));
    var jetons = [];
    haut.forEach(function (l) {
      // Ni un niveau d'études (« Master MIAGE M1 »), ni un intitulé de poste,
      // ni un titre de rubrique ne sont une identité.
      if (METIER.test(l) || DIPL.test(l) || RUBRIQUE_LIB.test(l.trim())) return;
      // « &HACKING ETHIQUE » : une ligne qui ne commence pas par une lettre est
      // la suite de la précédente, pas un nom.
      if (!/^[A-Za-zÀ-ÿ]/.test(l.trim())) return;
      l.split(/[\s,]+/).forEach(function (t) {
        t = t.replace(/^[^A-Za-zÀ-ÿ]+/, '').replace(/[^A-Za-zÀ-ÿ'-]+$/, '');
        if (t.length >= 2 && t.length <= 20 && /^[A-Za-zÀ-ÿ'-]+$/.test(t) && /[A-Za-z]/.test(t) && !RUBRIQUE.test(t)) {
          jetons.push(t);
        }
      });
    });
    var capitales = jetons.filter(function (t) { return t === t.toUpperCase(); });
    var capitalise = jetons.filter(function (t) {
      return t !== t.toUpperCase() && /^[A-ZÀ-Ý]/.test(t);
    });

    // Deux patronymes en capitales : le premier est le nom, l'ordre usuel.
    var nom = capitales[0] || capitalise[1] || null;
    var prenom = capitalise[0] || (capitales.length > 1 ? capitales[1] : null);
    if (nom) pose('initiale', nom.charAt(0).toUpperCase(), nom);
    if (prenom) {
      // « JEAN-PAUL » devient « Jean-Paul » : chaque partie prend sa majuscule.
      pose('prenom', prenom.toLowerCase().replace(/(^|[-' ])([a-zà-ÿ])/g, function (_, a, b) {
        return a + b.toUpperCase();
      }), prenom);
    }

    /* Passe 1 : à quelle rubrique appartient chaque ligne.
       Un titre en capitales qui n'est ni une rubrique connue ni un intitulé de
       rubrique est un intitulé de poste — le prendre pour une rubrique remet la
       section à zéro et fait disparaître l'emploi qui suit, sans un mot. */
    var sections = [], titres = [], estTitreLigne = [], section = null, titre = null;
    lignes.forEach(function (l, k) {
      if (estTitre(l)) {
        /* Seul un libellé de rubrique change de section. Se fier au simple mot
           « stage » ou « alternance » faisait passer « TECHNICIEN EXPLOITATION
           – STAGE » pour un en-tête : le poste disparaissait, et l'employeur
           prenait sa place. */
        var lib = rubriqueDe(l);
        if (lib && SEC_EXP.test(lib)) { section = 'experience'; titre = null; }
        else if (lib && SEC_FOR.test(lib)) { section = 'formation'; titre = null; }
        else if (lib) { section = null; titre = null; }
        else { titre = l.trim(); }
        sections[k] = null;
        titres[k] = null;
        estTitreLigne[k] = true;
        return;
      }
      sections[k] = section;
      titres[k] = titre;
    });
    var rubriques = sections.some(function (x) { return x; });

    /* Passe 2 : les périodes datées. */
    var exp = [], formations = [], titrePris = null;
    function formationConnue(d) {
      var a = d.toLowerCase();
      return formations.some(function (f) {
        var b = f.domaine.toLowerCase();
        // Inclusion, pas seulement début : « Obtention du Baccalauréat Général »
        // et « Baccalauréat Général » sont la même ligne du parcours.
        return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
      });
    }
    lignes.forEach(function (ligne, k) {
      if (estTitreLigne[k]) return;
      // Hors rubrique, une date isolée ne veut rien dire : « prix 2024 » n'est
      // ni un emploi ni un diplôme.
      if (rubriques && !sections[k]) return;

      var datee = estUnePeriode(ligne);
      if (!datee) return;
      var annees = datee.match(/(?:19|20)\d{2}/g);
      var ouvert = /aujourd|pr[ée]sent|en cours|actuel/i.test(datee);
      var mois = moisDates(datee);

      // L'intitulé est parfois sur la ligne de date : on l'en débarrasse.
      var reste = datee
        .replace(RE_MOIS, ' ')
        .replace(/\(?\s*(?:19|20)\d{2}(?:\s*[-–—\/àa]{1,3}\s*(?:(?:19|20)\d{2}|aujourd\S*|pr[ée]sent|en cours|actuel\S*))?\s*\)?/gi, ' ')
        .replace(new RegExp('\\b(' + MOIS.join('|') + ')[a-zà-ÿ]{0,6}\\.?', 'gi'), ' ')
        .replace(/\b(aujourd['’]?hui|pr[ée]sent|en cours|actuel\w*)\b/gi, ' ')
        /* « décembre 2024 à janvier 2025 » laissait un « à » orphelin collé à
           l'employeur : « SF2i Nouvelle-Calédonie, à ». */
        .replace(/\s+\b(à|a|au|de|du|depuis|jusqu['’]?au?|to|and)\b\s*$/i, '')
        .replace(/^\s*\b(à|a|au|de|du|depuis)\b\s+/i, '')
        .replace(/\s{2,}/g, ' ').replace(/^[\s\-–—:•·\/,]+|[\s\-–—:•·\/,]+$/g, '');

      var avant = [];
      for (var j = k - 1; j >= Math.max(0, k - 3); j--) {
        if (estTitreLigne[j]) break;                      // on ne franchit pas un titre
        avant.push(lignes[j].trim());
      }
      var autour = [reste].concat(avant).join(' ');
      var utile = [reste].concat(avant).filter(function (c) {
        return c.length >= 4 && c.length <= 70 && !/^\d/.test(c) && !/^option\b/i.test(c);
      });

      var scolaire = sections[k] === 'formation'
        || (sections[k] !== 'experience' && DIPL.test(autour));
      var intitule = '', brut = '';

      // Pour une formation, le diplôme prime sur tout le reste : l'établissement
      // en capitales (« IAE NC ») n'apprend rien sur le niveau.
      if (scolaire) {
        for (var d = 0; d < utile.length; d++) {
          if (DIPL.test(utile[d])) { intitule = utile[d]; brut = utile[d]; break; }
        }
      }
      // Sinon le titre en capitales retenu juste au-dessus,
      if (!intitule && titres[k] && titres[k] !== titrePris) {
        intitule = titres[k];
        titrePris = titres[k];
      }
      // sinon une ligne à dominante majuscule au-dessus : c'est le poste, pas
      // l'employeur collé aux dates,
      if (!intitule) {
        for (var e = 0; e < avant.length; e++) {
          if (estIntitule(avant[e])) { intitule = avant[e]; break; }
        }
      }
      // à défaut, ce qui reste de la ligne de dates.
      if (!intitule) intitule = utile[0] || '';

      var option = avant.filter(function (c) { return /^option\b/i.test(c); })[0];
      if (option && intitule.indexOf(option) < 0) intitule += ' ' + option;

      if (scolaire) {
        /* Le niveau se lit sur la ligne du diplôme, pas sur la fenêtre de trois
           lignes : celle-ci déborde sur la formation précédente et faisait
           passer un baccalauréat pour une licence.
           Aucune date conservée : l'année d'obtention révèle l'âge. */
        var dom = nettoie(intitule);
        // Sans mot de diplôme, un nom d'établissement seul n'apprend rien : le
        // diplôme est ailleurs, et cette ligne créerait un doublon muet.
        if (!brut && /universit|lyc[ée]e|[ée]cole|institut|\biae\b|\bcfa\b|centre de formation/i.test(dom)) {
          return;
        }
        if (dom.length >= 4 && !formationConnue(dom)) {
          formations.push({ niveau: niveauDe(brut || autour), domaine: dom });
        }
      } else {
        /* Un intitulé vide ou qui commence en minuscule est une phrase coupée,
           pas un poste : « orienter les choix fonctionnels. » n'est pas un
           emploi. Mieux vaut une expérience manquante qu'une expérience fausse
           — la première se corrige à la main, la seconde ne se voit pas. */
        var p = nettoie(intitule);
        if (p.length < 4 || /^[a-zà-ÿ]/.test(p)) return;
        // Une année seule reste une année : on n'invente pas de mois.
        exp.push({
          poste: p, secteur: '',
          debut: mois ? mois[0] : annees[0],
          fin: ouvert ? ''
            : (mois ? mois[mois.length - 1] : (annees.length > 1 ? annees[1] : annees[0]))
        });
      }
    });

    /* Passe 3 : les diplômes sans date. Une formation en cours n'a pas d'année
       de fin, et c'est justement la plus importante. On ne les cherche que dans
       la rubrique formation — ailleurs, « Master » est un mot comme un autre. */
    var connue = formationConnue;
    lignes.forEach(function (ligne, k) {
      if (sections[k] !== 'formation' || /\d{4}/.test(ligne)) return;
      if (!DIPL.test(ligne) || ligne.length > 60) return;
      var d = nettoie(ligne.trim());
      if (d.length >= 4 && !connue(d)) formations.push({ niveau: niveauDe(ligne), domaine: d });
    });
    // CV sans rubrique lisible : dernier recours, tout le texte.
    if (!formations.length) {
      lignes.forEach(function (ligne) {
        if (estTitre(ligne) || /\d{4}/.test(ligne)) return;
        if (!DIPL.test(ligne) || ligne.length > 60) return;
        var d = nettoie(ligne);
        if (d && !connue(d)) formations.push({ niveau: niveauDe(ligne), domaine: d });
      });
    }

    if (exp.length) pose('experiences', exp.slice(0, 6),
      rubriques ? 'rubrique « expérience » du CV' : 'périodes datées trouvées dans le texte');
    if (formations.length) pose('formations', formations.slice(0, 5),
      'années d’obtention volontairement ignorées : elles révèlent l’âge');

    /* Le niveau global est celui des formations trouvées. Le déduire du texte
       entier faisait lire « je cherche un contrat pour mon Master » comme un
       Bac+5 obtenu : c'est un projet, pas un diplôme. Le repli sur le texte ne
       sert que si aucune formation n'a été identifiée. */
    if (formations.length) {
      pose('formation', Math.max.apply(null, formations.map(function (f) { return f.niveau; })),
        formations.map(function (f) { return f.domaine; }).join(' · ').slice(0, 90));
    } else {
      var NIV = [
        [4, /(bac\s*\+\s*5|master|ing[ée]nieur|mast[eè]re)/i],
        [3, /(bac\s*\+\s*3|licence|bachelor|\bbut\b)/i],
        [2, /(bac\s*\+\s*2|\bbts\b|\bdut\b)/i],
        [1, /(baccalaur[ée]at|\bbac\b|\bcap\b|\bbep\b)/i]
      ];
      for (var n = 0; n < NIV.length; n++) {
        var ligneNiv = null;
        for (var q = 0; q < lignes.length; q++) {
          if (NIV[n][1].test(sansAccent(lignes[q]))) { ligneNiv = lignes[q]; break; }
        }
        if (ligneNiv) { pose('formation', NIV[n][0], ligneNiv.trim()); break; }
      }
    }

    // compétences du dictionnaire
    var comp = DICO.filter(function (c) {
      var motif = sansAccent(c).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(^|[^a-z0-9])' + motif + 's?([^a-z0-9]|$)').test(plat);
    });
    // « Developpement web » plutot que « Developpement » : on garde le plus precis
    /* « Développement » cède la place à « Développement web » ; « Java » ne cède
       pas à « JavaScript ». Le terme long doit être une extension par un mot,
       pas un mot différent qui commence pareil. */
    comp = comp.filter(function (c) {
      var court = sansAccent(c).toLowerCase();
      return !comp.some(function (d) {
        return d !== c && sansAccent(d).toLowerCase().indexOf(court + ' ') === 0;
      });
    });
    if (comp.length) pose('competences', comp, 'reconnues dans le référentiel des métiers');

    // langues et niveaux
    /* Le niveau se lit sur la LIGNE de la langue, pas dans une fenêtre de cent
       signes qui ramasse le voisinage. « Anglais : Intermédiaire » devenait C2
       parce qu'un « C2 » traînait ailleurs sur la page. */
    var MENTIONS = [
      [/bilingue|maternelle|natif|native/i, 'C2'],
      [/courant|avanc[ée]|fluent/i, 'C1'],
      [/interm[ée]diaire|bon niveau|professionnel/i, 'B1'],
      [/notions|d[ée]butant|scolaire|basique/i, 'A2']
    ];
    var lg = [];
    LANGUES.forEach(function (n) {
      var cle = sansAccent(n).toLowerCase();
      var ligneL = null;
      for (var q = 0; q < lignes.length; q++) {
        if (sansAccent(lignes[q]).toLowerCase().indexOf(cle) !== -1) { ligneL = lignes[q]; break; }
      }
      if (!ligneL) return;
      var niv = ligneL.match(/\b([ABC][12])\b/);
      var mot = null;
      for (var m2 = 0; m2 < MENTIONS.length && !mot; m2++) {
        if (MENTIONS[m2][0].test(ligneL)) mot = MENTIONS[m2][1];
      }
      lg.push({ langue: n, niveau: niv ? niv[1] : (mot || 'B1') });
    });
    if (lg.length) pose('langues', lg, 'niveaux au format européen, déduits du contexte');

    if (/permis\s*b/i.test(texte)) pose('permis', true, 'mention « permis B »');

    return { trouve: trouve, sources: sources, lignes: lignes.length, texte: texte };
  }

  /* Les mois ne sont lus que si le CV en donne DEUX : « Sep. - Nov. 2024 »
     n'annonce qu'une fin datée, et déduire le début reviendrait à l'inventer. */
  var MOIS = ['janv|jan', 'f[ée]vr|f[ée]v', 'mars|mar', 'avril|avr', 'mai', 'juin',
              'juil', 'ao[ûu]t|ao[ûu]', 'sept|sep', 'oct', 'nov', 'd[ée]c'];
  var RE_MOIS = new RegExp('\\b(' + MOIS.join('|') + ')[a-zà-ÿ]{0,6}\\.?\\s+((?:19|20)\\d{2})', 'gi');

  var RE_MOIS_SEUL = new RegExp('\b(' + MOIS.join('|') + ')[a-zà-ÿ]{0,6}\.?', 'gi');

  function moisDates(ligne) {
    RE_MOIS.lastIndex = 0;
    var out = [], m;
    while ((m = RE_MOIS.exec(ligne)) !== null) {
      var i = 0;
      for (var k = 0; k < MOIS.length; k++) {
        if (new RegExp('^(' + MOIS[k] + ')$', 'i').test(m[1])) { i = k + 1; break; }
      }
      if (i) out.push(m[2] + '-' + (i < 10 ? '0' + i : i));
    }
    /* Deux mois nommés : une vraie plage. Un seul, et c'est aussi le seul mois
       de la ligne : c'est la date de la période. Mais « Sep. - Nov. 2024 »
       contient deux mois pour une seule année — le mois daté y est la FIN, et
       le prendre pour un début serait une invention. */
    if (out.length >= 2) return out;
    RE_MOIS_SEUL.lastIndex = 0;
    var tous = ligne.match(RE_MOIS_SEUL) || [];
    return (out.length === 1 && tous.length === 1) ? out : null;
  }

  /* Un intitulé de poste est court et majoritairement en capitales. C'est le
     seul signal disponible : le gras ne survit pas à l'extraction du texte. */
  function estIntitule(l) {
    var lettres = l.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (lettres.length < 4 || l.length > 70) return false;
    var caps = lettres.replace(/[^A-ZÀ-Ý]/g, '').length;
    return caps / lettres.length >= 0.6;
  }

  /* Un nombre à quatre chiffres n'est pas une date. « Windows server 2012 »
     créait une expérience de toutes pièces. On retire d'abord les faux amis,
     puis on exige un vrai contexte de date. */
  var FAUX_ANNEE = /\b(windows|server|serveur|office|sql|exchange|excel|word|access|vista|iso|norme|version)\s*(?:server\s*)?((?:19|20)\d{2})/gi;

  function estUnePeriode(ligne) {
    var l = ligne.replace(FAUX_ANNEE, ' ');
    if (!/(?:19|20)\d{2}/.test(l)) return null;
    RE_MOIS.lastIndex = 0;
    var moisAnnee = RE_MOIS.test(l);
    var plage = /(?:19|20)\d{2}\s*[-–—\/àa]{1,3}\s*((?:19|20)\d{2}|aujourd|pr[ée]sent|en cours|actuel)/i.test(l);
    var parentheses = /\(\s*(?:19|20)\d{2}\s*\)/.test(l);
    var seule = /^\s*(?:19|20)\d{2}\s*$/.test(l.trim());
    var depuis = /\b(depuis|since|d[èe]s)\s+(?:19|20)\d{2}/i.test(l);
    return (moisAnnee || plage || parentheses || seule || depuis) ? l : null;
  }

  /* L'ordre compte : « L3 MIAGE » vaut Bac+3, pas Bac+5. Une mention explicite
     de niveau prime toujours sur le nom de la filière. */
  function niveauDe(t) {
    var s = sansAccent(t);
    if (/\bl3\b|bac\s*\+\s*3|licence|bachelor|\bbut\b/i.test(s)) return 3;
    if (/\bl2\b|bac\s*\+\s*2|\bbts\b|\bdut\b/i.test(s)) return 2;
    if (/\bm1\b|\bm2\b|bac\s*\+\s*5|master|mastere|ingenieur|miage|mba/i.test(s)) return 4;
    return 1;
  }

  var DIPL_FORT = /(bts|dut|\bbut\b|licence|master|mast[eè]re|bachelor|ing[ée]nieur|miage|mba|baccalaur)/i;

  function nettoie(t) {
    t = (t || '').replace(/[\s|•·]+$/, '').replace(/\s*[\/|·•]\s*bac\s*\+?\s*\d\s*$/i, '');
    /* « Année de lycée / Baccalauréat STMG », « Post-Bac / BTS SIO » : quand le
       diplôme est à droite de la barre, ce qui est à gauche est une mention
       administrative qui n'apprend rien. */
    var parts = t.split('/');
    if (parts.length === 2 && DIPL_FORT.test(parts[1]) && !DIPL_FORT.test(parts[0])) {
      t = parts[1];
    }
    return t.replace(/\s{2,}/g, ' ').trim().slice(0, 60);
  }


  window.AJ_EXTRACTION = {
    lit: function (fichier) {
      return lit(fichier).then(function (r) {
        if (!r.lignes.length) {
          return { vide: true, pages: r.pages };
        }
        var a = analyse(r.lignes, r.entete);
        a.pages = r.pages;
        return a;
      });
    }
  };
})();

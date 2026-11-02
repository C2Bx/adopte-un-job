import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import ts from 'typescript'

const racine = resolve(fileURLToPath(new URL('..', import.meta.url)))
const temporaire = mkdtempSync(join(tmpdir(), 'aj-regression-'))
let nombre = 0
const test = async (nom, action) => { await action(); console.log(`OK ${++nombre} — ${nom}`) }
try {
  for (const nom of ['types', 'regles', 'jsonResume', 'sauvegarde', 'api', 'filtres', 'dates', 'upgrade', 'modeDemo']) {
    let texte = readFileSync(join(racine, 'src', `${nom}.ts`), 'utf8').replace('import.meta.env.BASE_URL', "'/avp/'")

    const js = ts.transpileModule(texte, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
      .replace(/from '\.\/(\w+)'/g, "from './$1.mjs'")
    writeFileSync(join(temporaire, `${nom}.mjs`), js)
  }
  const charge = (nom) => import(pathToFileURL(join(temporaire, `${nom}.mjs`)).href)
  const valeurs = new Map()
  globalThis.sessionStorage = { getItem: (k) => valeurs.get(k) ?? null, setItem: (k, v) => valeurs.set(k, v), removeItem: (k) => valeurs.delete(k) }
  globalThis.localStorage = globalThis.sessionStorage
  globalThis.window = { dispatchEvent() {} }
  globalThis.location = { search: '', href: 'https://local/avp/' }
  const { SauvegardeProfil } = await charge('sauvegarde')
  const { valideJsonResume, completeDepuisExtraction, selectionneChamps } = await charge('jsonResume')
  const { profilVide, profilEnvoi, manques, force } = await charge('regles')
  const { api, documentDepuisProfil, offreDepuisAvp } = await charge('api')
  const { resultats } = await charge('filtres')
  const { dateApi } = await charge('dates')
  const profil = (prenom) => ({ ...structuredClone(profilVide), prenom })
  await test('la sauvegarde survit à la disparition de l’écran', async () => {
    const envois = []; const file = new SauvegardeProfil(1, async (p) => envois.push(p.prenom), () => {})
    file.modifie(profil('Alice')); await file.termine(); assert.deepEqual(envois, ['Alice']); assert.equal(file.reprend(), null); file.arrete()
  })
  await test('les sauvegardes sont sérialisées et la dernière saisie gagne', async () => {
    let libere; let nombreEnCours = 0; let maximum = 0; const envois = []
    const attente = new Promise((r) => { libere = r })
    const file = new SauvegardeProfil(1, async (p) => {
      maximum = Math.max(maximum, ++nombreEnCours); envois.push(p.prenom)
      if (p.prenom === 'A') await attente
      nombreEnCours--
    }, () => {})
    file.modifie(profil('A')); const fin = file.termine(); file.modifie(profil('B')); file.modifie(profil('C'))
    libere(); await fin; assert.deepEqual(envois, ['A', 'C']); assert.equal(maximum, 1); file.arrete()
  })
  await test('un échec conserve le brouillon et permet de réessayer', async () => {
    let panne = true; const etats = []
    const file = new SauvegardeProfil(2, async () => { if (panne) throw Error('réseau') }, (e) => etats.push(e))
    file.modifie(profil('Brouillon')); await assert.rejects(file.termine()); assert.equal(file.reprend().prenom, 'Brouillon')
    assert.equal(etats.at(-1), 'erreur'); panne = false; await file.termine(); assert.equal(file.reprend(), null); file.arrete()
  })
  await test('un brouillon est isolé par compte et récupérable après reconnexion', async () => {
    const a = new SauvegardeProfil(3, async () => {}, () => {}); a.modifie(profil('Privé')); a.arrete()
    const autre = new SauvegardeProfil(4, async () => {}, () => {}); assert.equal(autre.reprend(), null)
    const retour = new SauvegardeProfil(3, async () => {}, () => {}); assert.equal(retour.reprend().prenom, 'Privé'); autre.arrete(); retour.arrete()
  })
  await test('les objets arbitraires et les rubriques mal formées sont rejetés', () => {
    for (const d of [{ bonjour: 'invalide' }, [], { basics: { name: 12 } }, { work: ['texte'] }, { skills: [{ name: 'Vente', keywords: 'invalide' }] }, { basics: {} }]) assert.throws(() => valideJsonResume(d))
    assert.equal(valideJsonResume({ work: [{ position: 'Vendeur' }] }).work[0].position, 'Vendeur')
    assert.throws(() => valideJsonResume({ basics: { summary: 'x'.repeat(1_048_577) } }))
  })
  await test('l’extraction conserve identité, métadonnées et saisie concurrente', () => {
    const d = completeDepuisExtraction({ basics: { name: 'Saisi' }, meta: { agentOpt: true }, work: [{ position: 'Saisie récente' }] },
      { basics: { name: 'Extrait', summary: 'Résumé' }, skills: [{ name: 'Vente' }], work: [{ position: 'Ancien' }] })
    assert.equal(d.basics.name, 'Saisi'); assert.equal(d.basics.summary, 'Résumé'); assert.equal(d.meta.agentOpt, true); assert.equal(d.work[0].position, 'Saisie récente')
  })
  await test('les compétences OPT comptent sans doubler les mêmes libellés', () => {
    const p = profil('Test'); p.competencesOpt = ['Vente', 'Gestion', 'Conseil'].map((nom) => ({ code: nom, nom, source: 'saisie' }))
    assert(!manques(p).some((x) => x.cle === 'competences')); p.competencesOpt = p.competencesOpt.slice(0, 2); p.competences = ['vente']
    assert(manques(p).some((x) => x.cle === 'competences'))
  })
  await test('une date de fin effacée ne réapparaît pas', () => {
    const p = profil('Test'); p.experiences = [{ poste: 'Vendeur', secteur: 'Entreprise', debut: '2020', fin: '' }]
    const d = documentDepuisProfil(profilEnvoi(p), [], 'test@example.invalid', { work: [{ position: 'Vendeur', name: 'Entreprise', endDate: '2023-01', highlights: ['Preuve'] }] })
    assert.equal(d.work[0].endDate, undefined); assert.deepEqual(d.work[0].highlights, ['Preuve'])
  })
  await test('l’absence de données ne devient pas une promesse sur l’offre', () => {
    const o = offreDepuisAvp({ id: 1 }); assert.equal(o.contrat, 'Non renseigné'); assert.equal(o.experienceMin, null); assert.equal(o.teletravail, 'inconnu'); assert.equal(o.zone, 'Non renseigné')
    assert.equal(resultats([o], { debutant: true }).length, 0); assert.equal(resultats([o], { teletravail: true }).length, 0)
    assert.equal(offreDepuisAvp({ id: 2, typeContrat: 'FULL_TIME' }).contrat, 'Temps plein')
  })
  await test('les dates UTC, ISO et Nouméa désignent le même instant', () => {
    const attendu = Date.parse('2026-10-27T01:00:00Z')
    for (const d of ['2026-10-27T01:00:00Z', '2026-10-27T12:00:00+11:00', '2026-10-27 01:00:00']) assert.equal(dateApi(d), attendu)
    assert(Number.isNaN(dateApi('invalide')))
  })
  await test('le repère de rédaction atteint réellement 100', () => {
    assert.equal(force({ ...profil('Test'), competences: ['a', 'b', 'c', 'd', 'e', 'f'], experiences: [{}, {}], formations: [{}], langues: [{}], salaireMin: 1, permis: true }), 100)
  })
  let doc = {}; let genere = {}; let envois = []; let requetes = []; let utilisateur = 10; let extraction = () => {}
  const ref = JSON.parse(readFileSync(join(racine, 'public/referentiel.json'), 'utf8'))
  globalThis.fetch = async (url, o = {}) => {
    const p = new URL(url, 'https://local').searchParams.get('p'); const methode = o.method ?? 'GET'; requetes.push({ p, methode, o })
    if (String(url).endsWith('referentiel.json')) return Response.json(ref)
    if (p === '/auth/login') return Response.json({ accessToken: `a.${Buffer.from(JSON.stringify({ sub: utilisateur, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.z` })
    if (p === `/profils/${utilisateur}`) return Response.json({ cv: doc, cvJsonGenere: genere })
    if (p === '/profils/moi' && methode === 'PUT') { doc = JSON.parse(o.body); envois.push(doc); return Response.json({}) }
    if (p === '/profils/moi/cv/traitement') { extraction(); return Response.json({}) }
    if (p === '/matching/v1/match') return Response.json({ resultats: [] })
    if (p === '/matching/v1/score') return Response.json({ points_forts: [{ attendu: 'Vente', note: 80 }] })
    if (p === '/avp') return Response.json({ contenu: [{ id: 1, dateLimite: '2020-01-01' }], totalPages: 1 })
    throw Error(`Appel inattendu ${methode} ${p}`)
  }
  await api.connexion('test@example.invalid', 'fictif')
  await test('un prénom composé et une initiale modifiée survivent à l’enregistrement', async () => {
    doc = {}; const p = profil('Jean Pierre'); p.nom = 'Dupont'; p.initiale = 'D'
    await api.enregistreProfil(profilEnvoi(p)); const relu = await api.profil()
    assert.equal(relu.prenom, 'Jean Pierre'); assert.equal(relu.nom, 'Dupont'); assert.equal(relu.initiale, 'D')
  })
  await test('un import incorrect ne provoque aucune écriture API', async () => {
    doc = { work: [{ position: 'A garder' }] }; envois = []
    await assert.rejects(api.importeProfil({ bonjour: 'invalide' })); assert.equal(envois.length, 0); assert.equal(doc.work[0].position, 'A garder')
  })
  await test('l’import conserve les critères et peut être annulé après remplacement', async () => {
    doc = { basics: { name: 'Ancien' }, work: [{ position: 'A garder' }], meta: { agentOpt: true, criteres: { zones: ['Sud'] } } }
    await api.importeProfil({ basics: { name: 'Nouveau' }, skills: [{ name: 'Vente' }] })
    assert.equal(doc.basics.name, 'Nouveau'); assert.equal(doc.meta.agentOpt, true); assert.deepEqual(doc.meta.criteres.zones, ['Sud'])
    assert(api.copieAvantImportDisponible()); await api.restaureAvantImport(); assert.equal(doc.work[0].position, 'A garder'); assert(!api.copieAvantImportDisponible())
  })
  await test('la chaîne extraction réelle relit et conserve une écriture concurrente', async () => {
    doc = { basics: { name: 'Nom saisi' }, meta: { agentOpt: true } }; genere = { basics: { name: 'Nom extrait' }, skills: [{ name: 'Vente' }] }
    extraction = () => { doc.work = [{ position: 'Saisi pendant lecture' }] }
    envois = []; await api.lisCV(); assert.equal(envois.length, 0, 'aucune écriture avant validation');
    await api.valideLectureCV(['basics.name', 'skills.0.name'], genere); assert.equal(doc.basics.name, 'Nom saisi'); assert.equal(doc.work[0].position, 'Saisi pendant lecture'); assert.equal(doc.meta.agentOpt, true)
  })
  await test('le matching transporte le jeton seulement vers le relais', async () => {
    await api.adequations(); const r = requetes.findLast((r) => r.p === '/matching/v1/match')
    assert(r.o.headers.Authorization.startsWith('Bearer ')); assert(!JSON.parse(r.o.body).basics.name)
  })
  await test('le détail de matching identique est réutilisé sans nouvel appel', async () => {
    requetes = []; const a = await api.detailAdequation('TEST-1'); const b = await api.detailAdequation('TEST-1')
    assert.deepEqual(a, b); assert.equal(requetes.filter((r) => r.p === '/matching/v1/score').length, 1)
  })
  await test('une offre close ne déclenche pas de décision réelle', async () => {
    requetes = []; await assert.rejects(api.swipe(1, 'oui')); assert(!requetes.some((r) => r.p?.startsWith('/swipes/')))
  })
  const { trieOffres, limiteComparaison, choixPersistes, litLocal, ecritLocal, lienOffre, idOffrePartagee } = await charge('upgrade')
  await test('les tris ne mutent pas les offres et placent les données absentes en dernier', () => {
    const a = offreDepuisAvp({ id: 1, reference: 'r1', titre: 'Zèbre', dateLimite: '2099-01-01', datePublication: '2026-10-02' })
    const b = offreDepuisAvp({ id: 2, reference: 'r2', titre: 'Agent', dateLimite: null, datePublication: null })
    assert.deepEqual(trieOffres([a, b], 'titre').map((x) => x.id), [2, 1]); assert.deepEqual(trieOffres([b, a], 'cloture').map((x) => x.id), [1, 2])
    const l = [b, a]; trieOffres(l, 'publication'); assert.equal(l[0], b)
    assert.deepEqual(trieOffres([a, b], 'adequation', new Map([['r2', { pourcentage: 80 }]])).map((x) => x.id), [2, 1])
  })
  await test('le comparateur limite la sélection à trois offres et permet de retirer', () => {
    assert.deepEqual(limiteComparaison([1, 2, 3], 4), [1, 2, 3]); assert.deepEqual(limiteComparaison([1, 2, 3], 2), [1, 3]); assert.deepEqual(limiteComparaison([], 1), [1])
  })
  await test('recherches et notes locales sont isolées par compte', async () => {
    ecritLocal('notes-test', ['note privée']); assert.deepEqual(litLocal('notes-test', []), ['note privée'])
    utilisateur = 11; await api.connexion('autre@example.invalid', 'fictif'); assert.deepEqual(litLocal('notes-test', []), [])
    assert.deepEqual(choixPersistes({ vue: 'invalide', tri: 'invalide' }), { vue: 'cartes', tri: 'cloture' })
    assert.equal(litLocal('absent', 'défaut'), 'défaut')
  })
  await test('le lien partagé contient seulement l’identifiant de l’offre et conserve le mode démo', () => {
    location.href = 'https://local/avp/?demo=1&token=confidentiel&email=prive'; const url = new URL(lienOffre(42)); assert.equal(url.searchParams.get('offre'), '42'); assert.equal(url.searchParams.get('demo'), '1'); assert.equal(url.searchParams.get('token'), null); assert.equal(url.searchParams.get('email'), null)
    location.search = '?offre=42'; assert.equal(idOffrePartagee(), 42); location.search = '?offre=abc'; assert.equal(idOffrePartagee(), null); location.search = ''
  })
  await test('la recherche gère accents, expression exacte et exclusion', () => {
    const o = offreDepuisAvp({ id: 1, titre: 'Chargé de clientèle', description: 'Accueil à Nouméa' })
    assert.equal(resultats([o], { q: '"charge de clientele" noumea' }).length, 1)
    assert.equal(resultats([o], { q: 'clientele -accueil' }).length, 0)
  })
  await test('la sélection de l’extraction n’intègre aucun champ décoché ni métadonnée', () => {
    const extrait = { basics: { name: 'Fictif', phone: '123' }, skills: [{ name: 'Vente', keywords: ['A'] }, { name: 'Conseil' }], meta: { inconnu: true } }
    assert.deepEqual(selectionneChamps(extrait, ['basics.name', 'skills.1.name']), { basics: { name: 'Fictif' }, skills: [{ name: 'Conseil' }] })
  })
  await test('une extraction changée depuis son aperçu est refusée sans écrire', async () => {
    envois = []; genere = { skills: [{ name: 'Autre' }] }
    await assert.rejects(api.valideLectureCV(['skills.0.name'], { skills: [{ name: 'Ancien' }] })); assert.equal(envois.length, 0)
  })
  await test('les compléments enrichissent le profil sans changer l’identité ni les critères', async () => {
    doc = { basics: { name: 'Identité conservée' }, work: [{ name: 'Entreprise', position: 'Conseil', startDate: '2020' }], meta: { criteres: { zones: ['Nord'] } } }
    await api.enregistreComplements({ basics: { label: 'Titre', summary: 'Résumé' }, work: [{ name: 'Entreprise', position: 'Conseil', highlights: ['Résultat'] }], projects: [{ name: 'Projet' }] })
    assert.equal(doc.basics.name, 'Identité conservée'); assert.equal(doc.basics.label, 'Titre'); assert.equal(doc.work[0].startDate, '2020'); assert.deepEqual(doc.meta.criteres.zones, ['Nord'])
  })
  await test('la démonstration ne contacte aucun service métier et sépare ses données', async () => {
    location.search = '?demo=1'; location.href = 'https://local/avp/?demo=1'
    let appels = []
    globalThis.fetch = async (url) => { appels.push(url); if (String(url).endsWith('referentiel.json')) return Response.json(ref); throw Error('Appel métier interdit en démo') }
    const { activeDemo } = await charge('modeDemo'); activeDemo()
    assert.equal((await api.moi()).id, 9900); const l = await api.deck(); assert.equal(l.length, 4)
    await api.swipe(l[0].id, 'oui'); assert.equal((await api.interets()).length, 1); await api.profil()
    await assert.rejects(api.oubli('fictif@example.invalid')); assert(appels.every((x) => String(x).endsWith('referentiel.json')))
  })
  console.log(`${nombre} tests de régression réussis.`)
} finally { rmSync(temporaire, { recursive: true, force: true }) }

/* Le seul endroit qui parle à une API — et ce n'est plus la nôtre.

   Depuis le 05/10/2026, Adopte un Job ne fait que l'interface : il affiche ce
   que l'API de l'équipe (Dan et Timothée) lui donne, et lui transmet ce que la
   personne saisit. Plus de base, plus d'API à nous. Les écrans n'en savent
   rien : ces fonctions gardent les noms et les formes d'avant, et c'est ici
   que leurs réponses sont traduites.

   Ce qui vit dans le navigateur, et seulement là :
   - la session (leur jeton, 1 h, sans renouvellement), en sessionStorage :
     elle survit à un F5, pas à la fermeture de l'onglet ;
   - le « plus tard », que leur API ne connaît pas ;
   - le référentiel des métiers OPT, servi comme un fichier de l'interface.

   Leur serveur n'envoie pas encore d'en-têtes CORS : on passe par un relais
   sans état (`relais.php`). Le jour où il le fera, DIRECT = true. */

import { ErreurApi } from './types'
import type {
  CompetenceOpt, CvInfo, Facettes, Filtres, Interet, MetierOpt, Offre, Profil, ProfilEnvoi,
  Referentiels, StatutCandidature, StatutEquipe, Utilisateur,
} from './types'

const EQUIPE = 'https://hackavp-api.duckdns.org'
const DIRECT = false
const BASE = import.meta.env.BASE_URL          // « /avp/ »

/* ================================================================ session */

interface Session { jeton: string; exp: number; id: number; email: string }
const CLE_SESSION = 'aj.session'

function lisSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLE_SESSION) ?? 'null') as Session | null
    return s && s.exp * 1000 > Date.now() ? s : null
  } catch {
    return null
  }
}

function poseSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(CLE_SESSION, JSON.stringify(s))
    else sessionStorage.removeItem(CLE_SESSION)
  } catch {
    /* stockage indisponible : la session ne survivra pas au rechargement */
  }
}

/** Ce que porte leur jeton : `sub` (l'identifiant du compte) et `exp`. */
function litJeton(t: string): { sub: number; exp: number } {
  try {
    const b = t.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const d = JSON.parse(atob(b)) as { sub?: string | number; exp?: number }
    return { sub: Number(d.sub ?? 0), exp: Number(d.exp ?? Math.floor(Date.now() / 1000) + 3600) }
  } catch {
    return { sub: 0, exp: Math.floor(Date.now() / 1000) + 3600 }
  }
}

function moiSession(): Session {
  const s = lisSession()
  if (!s) throw expiree()
  return s
}

function expiree(): ErreurApi {
  poseSession(null)
  window.dispatchEvent(new Event('aj:session-expiree'))
  return new ErreurApi('session_expiree', 'Ta session a expiré : reconnecte-toi.', 401)
}

/* ============================================================ les appels */

function urlEquipe(chemin: string, query?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== '') q.set(k, String(v))
  if (DIRECT) return `${EQUIPE}${chemin}${q.size ? `?${q}` : ''}`
  q.set('p', chemin)
  return `${BASE}relais.php?${q}`
}

interface Options {
  corps?: unknown
  form?: FormData
  query?: Record<string, string | number | undefined>
  anonyme?: boolean
  /** Messages propres à cette route, par code HTTP. */
  messages?: Record<number, string>
}

async function brut(methode: string, chemin: string, o: Options = {}): Promise<Response> {
  const entetes: Record<string, string> = { Accept: 'application/json' }
  if (!o.anonyme) entetes['Authorization'] = `Bearer ${moiSession().jeton}`
  if (o.corps !== undefined) entetes['Content-Type'] = 'application/json'
  let r: Response
  try {
    r = await fetch(urlEquipe(chemin, o.query), {
      method: methode,
      headers: entetes,
      body: o.form ?? (o.corps === undefined ? undefined : JSON.stringify(o.corps)),
    })
  } catch {
    throw new ErreurApi('reseau', 'Pas de connexion au serveur. Réessaie dans un instant.', 0)
  }
  if (r.status === 401 && !o.anonyme) throw expiree()
  if (!r.ok) {
    let d: { message?: string } | null = null
    try { d = await r.json() as { message?: string } } catch { d = null }
    const m = o.messages?.[r.status] ?? d?.message ?? MESSAGES[r.status] ?? `Erreur ${r.status}`
    throw new ErreurApi(`http_${r.status}`, m, r.status)
  }
  return r
}

const MESSAGES: Record<number, string> = {
  400: 'La demande a été refusée : vérifie ce que tu as saisi.',
  403: 'Cette action n’est pas autorisée pour ton compte.',
  404: 'Introuvable.',
  413: 'Fichier de plus de 10 Mo.',
  502: 'L’API de l’équipe ne répond pas. Réessaie dans un instant.',
}

async function appel<T>(methode: string, chemin: string, o: Options = {}): Promise<T> {
  const r = await brut(methode, chemin, o)
  const t = await r.text()
  return (t ? JSON.parse(t) : null) as T
}

/** Une liste paginée de leur API, toutes pages lues (100 par page). */
async function toutesPages<T>(chemin: string, anonyme = false): Promise<T[]> {
  const tout: T[] = []
  for (let page = 1, pages = 1; page <= pages && page <= 50; page++) {
    const d = await appel<{ contenu: T[]; totalPages: number }>('GET', chemin, { query: { page, taille: 100 }, anonyme })
    tout.push(...(d.contenu ?? []))
    pages = Math.max(1, d.totalPages ?? 1)
  }
  return tout
}

/* =========================================================== référentiel */

type RefStatique = Referentiels & {
  competencesOpt: { code: string; nom: string; groupe: string }[]
  metierCompetences: Record<string, { code: string; poids: number; niveau: string | null }[]>
}
let refCache: Promise<RefStatique> | null = null

function referentiel(): Promise<RefStatique> {
  refCache ??= fetch(`${BASE}referentiel.json`).then((r) => {
    if (!r.ok) throw new ErreurApi('referentiel', 'Le référentiel des métiers n’a pas pu être chargé.', r.status)
    return r.json() as Promise<RefStatique>
  }).catch((e) => { refCache = null; throw e })
  return refCache
}

const plat = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* ================================================================ offres */

const GRAND_NOUMEA = ['Nouméa', 'Dumbéa', 'Mont-Dore', 'Païta']

interface AvpEquipe {
  id: number; reference?: string | null; titre?: string | null; intituleAlternatif?: string | null
  description?: string | null; descriptionComplement?: string | null; direction?: string | null
  uniteOrganisationnelle?: string | null; nbAgentsEncadres?: number | null
  metierCode?: string | null; metierLibelle?: string | null; metierFicheUrl?: string | null; codeRome?: string | null
  lieuNom?: string | null; lieuRue?: string | null; ville?: string | null; province?: string | null
  typeContrat?: string | null; secteur?: string | null; niveauDiplome?: string | null
  experienceRequise?: string | null; qualifications?: string | null; exigencesPhysiques?: string | null
  horaires?: string | null; avantages?: string | null; dateDebut?: string | null; dateDebutTexte?: string | null
  datePublication?: string | null; dateLimite?: string | null; familles?: string[] | null
  connaissances?: string[] | null; savoirFaire?: string[] | null; responsabilites?: string[] | null
  informationsLibres?: { cle?: string; valeur?: string }[] | null
}

const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [])

function zone(ville: string | null, province: string | null): string {
  if (ville && GRAND_NOUMEA.includes(ville)) return 'Grand Nouméa'
  const p = (province ?? '').toLowerCase()
  if (p.includes('nord')) return 'Nord'
  if (p.includes('îles') || p.includes('iles') || p.includes('loyaut')) return 'Îles'
  return 'Sud'
}

function formationDepuisTexte(t: string): number | null {
  const s = t.toLowerCase()
  if (/bac\s*\+\s*5|master|ingénieur|ingenieur/.test(s)) return 4
  if (/bac\s*\+\s*3|licence|bachelor/.test(s)) return 3
  if (/bac\s*\+\s*2|bts|dut/.test(s)) return 2
  if (/\bbac\b|baccalaur/.test(s)) return 1
  return null
}

/** La fin de la journée de la date limite, à Nouméa : l'offre reste ouverte ce jour-là. */
function joursAvant(date: string | null): number | null {
  if (!date) return null
  const t = Date.parse(`${date.slice(0, 10)}T23:59:59+11:00`)
  return Number.isNaN(t) ? null : Math.floor((t - Date.now()) / 86_400_000)
}

/** Une offre de leur API, dans la forme que les écrans connaissent. */
function offreDepuisAvp(a: AvpEquipe): Offre {
  const ville = texte(a.ville)
  const province = texte(a.province)
  const libres = (a.informationsLibres ?? []).map((i) => `${i.cle ?? ''} ${i.valeur ?? ''}`).join(' ')
  const qualif = texte(a.qualifications) ?? ''
  const jours = joursAvant(texte(a.dateLimite))
  const competencesTexte = [
    ...liste(a.savoirFaire).map((t) => ({ texte: t, type: 'savoir-faire' })),
    ...liste(a.connaissances).map((t) => ({ texte: t, type: 'connaissance' })),
  ]
  return {
    id: a.id,
    source: 'opt',
    reference: texte(a.reference),
    url: texte(a.metierFicheUrl),
    titre: texte(a.titre) ?? 'Sans titre',
    entreprise: 'Office des postes et télécommunications de Nouvelle-Calédonie',
    secteur: texte(a.secteur),
    taille: null,
    pitch: null,
    ville,
    province,
    direction: texte(a.direction),
    familles: liste(a.familles),
    codeMetier: texte(a.metierCode),
    metierOpt: texte(a.metierLibelle),
    codeRome: texte(a.codeRome),
    employmentType: texte(a.typeContrat),
    nbAgentsEncadres: typeof a.nbAgentsEncadres === 'number' ? a.nbAgentsEncadres : null,
    competencesTexte,
    responsabilites: liste(a.responsabilites),
    conditions: texte(a.horaires),
    avantages: texte(a.avantages),
    exigencesPhysiques: texte(a.exigencesPhysiques),
    qualifications: texte(a.qualifications),
    experienceTexte: texte(a.experienceRequise),
    unite: texte(a.uniteOrganisationnelle),
    lieu: texte(a.lieuNom),
    adresse: texte(a.lieuRue),
    datePublication: texte(a.datePublication),
    expire: texte(a.dateLimite),
    joursRestants: jours,
    statut: jours !== null && jours < 0 ? 'close' : 'publiee',
    contrat: a.typeContrat === 'TEMPORARY' || a.typeContrat === 'CONTRACTOR' ? 'CDD' : a.typeContrat === 'INTERN' ? 'Stage' : 'CDI',
    zone: zone(ville, province),
    teletravail: /t[ée]l[ée]travail/i.test(`${libres} ${a.horaires ?? ''}`) ? 'hybride' : 'non',
    salaire: null,
    experienceMin: Math.min(15, Number(/(\d+)\s*an/.exec(a.experienceRequise ?? '')?.[1] ?? 0)),
    formationMin: formationDepuisTexte(`${qualif} ${a.niveauDiplome ?? ''}`),
    permis: /permis/i.test(`${qualif} ${libres}`),
    debut: /^(\d{4}-\d{2})/.exec(a.dateDebut ?? '')?.[1] ?? texte(a.dateDebutTexte),
    description: texte(a.description),
    requis: [],
    souhaite: [],
    publiee: texte(a.datePublication),
  }
}

let offresCache: { quand: number; offres: Promise<Offre[]> } | null = null

/** Toutes les offres de leur API, gardées cinq minutes en mémoire. */
function offres(): Promise<Offre[]> {
  if (!offresCache || Date.now() - offresCache.quand > 5 * 60_000) {
    const p = toutesPages<AvpEquipe>('/avp', true).then((l) => l.map(offreDepuisAvp))
    p.catch(() => { offresCache = null })
    offresCache = { quand: Date.now(), offres: p }
  }
  return offresCache.offres
}

function texteRecherche(o: Offre): string {
  return plat([o.titre, o.description, o.metierOpt, o.direction, o.unite, o.ville, ...o.familles,
    ...o.responsabilites, ...o.competencesTexte.map((c) => c.texte)].filter(Boolean).join(' '))
}

function passeFiltres(o: Offre, f: Filtres): boolean {
  if (f.q && !plat(f.q).split(/\s+/).every((m) => texteRecherche(o).includes(m))) return false
  if (f.ville && o.ville !== f.ville) return false
  if (f.province && o.province !== f.province) return false
  if (f.famille && !o.familles.includes(f.famille)) return false
  if (f.direction && o.direction !== f.direction) return false
  if (f.contrat && o.contrat !== f.contrat) return false
  if (f.zone && o.zone !== f.zone) return false
  if (f.metier && o.codeMetier !== f.metier) return false
  if (f.teletravail && o.teletravail === 'non') return false
  if (f.encadrement && !(o.nbAgentsEncadres && o.nbAgentsEncadres > 0)) return false
  if (f.debutant && o.experienceMin > 0) return false
  if (f.salaire && !o.salaire) return false
  return true
}

function facettesDe(l: Offre[]): Facettes {
  const compte = (vals: (string | null)[]) => {
    const m = new Map<string, number>()
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([valeur, n]) => ({ valeur, n }))
  }
  const metiers = new Map<string, { nom: string | null; n: number }>()
  for (const o of l) {
    if (!o.codeMetier) continue
    const x = metiers.get(o.codeMetier) ?? { nom: o.metierOpt, n: 0 }
    x.n++
    metiers.set(o.codeMetier, x)
  }
  return {
    ville: compte(l.map((o) => o.ville)),
    province: compte(l.map((o) => o.province)),
    direction: compte(l.map((o) => o.direction)),
    contrat: compte(l.map((o) => o.contrat)),
    zone: compte(l.map((o) => o.zone)),
    source: [],
    famille: compte(l.flatMap((o) => o.familles)),
    metier: [...metiers.entries()].map(([valeur, x]) => ({ valeur, nom: x.nom, n: x.n })),
    teletravail: l.filter((o) => o.teletravail !== 'non').length,
    encadrement: l.filter((o) => (o.nbAgentsEncadres ?? 0) > 0).length,
    debutant: l.filter((o) => o.experienceMin === 0).length,
    salaire: l.filter((o) => o.salaire).length,
  }
}

/* ======================================== « plus tard » et retours arrière */

interface Local { plusTard: { id: number; quand: string }[]; rendus: number[] }

function local(): Local {
  try {
    const l = JSON.parse(localStorage.getItem(`aj.local.${lisSession()?.id ?? 0}`) ?? 'null') as Local | null
    return { plusTard: l?.plusTard ?? [], rendus: l?.rendus ?? [] }
  } catch {
    return { plusTard: [], rendus: [] }
  }
}

function poseLocal(l: Local): void {
  try { localStorage.setItem(`aj.local.${lisSession()?.id ?? 0}`, JSON.stringify(l)) } catch { /* sans effet */ }
}

/* ======================================================= swipes, candidatures */

interface SwipeEquipe { id: number; avpId: number; avpReference?: string; avpTitre?: string; estLike: boolean; createdAt: string; updatedAt: string }
interface CandidatureEquipe { id: number; avpId: number; avpReference?: string; avpTitre?: string; statut: StatutEquipe; createdAt: string; updatedAt: string }

const STATUT_LOCAL: Record<StatutEquipe, StatutCandidature> = {
  EN_ATTENTE: 'envoyee', VALIDEE: 'preselection', REJETEE: 'refusee', ANNULEE: 'retiree',
}

/** Candidature → offre : pour retirer une candidature, il faut l'offre (un dislike). */
const offreDeCandidature = new Map<number, number>()

async function envoieSwipe(avpId: number, estLike: boolean): Promise<void> {
  const messages = {
    409: 'Un recruteur a déjà répondu à cette candidature : elle ne peut plus changer.',
    400: 'La date limite de cette offre est passée.',
  }
  try {
    await brut('PUT', `/swipes/candidats/avp/${avpId}`, { corps: { estLike }, messages })
  } catch (e) {
    // 403 : pas encore de profil chez eux. On l'envoie, puis on réessaie.
    if (!(e instanceof ErreurApi) || e.http !== 403) throw e
    await envoieDocument(await documentCourant())
    await brut('PUT', `/swipes/candidats/avp/${avpId}`, { corps: { estLike }, messages })
  }
}

/* ================================================================= profil */

type Json = Record<string, unknown>
const objet = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const tableau = (v: unknown): Json[] => (Array.isArray(v) ? v.map(objet) : [])

/** Le dernier JSON lu chez eux : on écrit PAR-DESSUS lui, pour ne perdre aucun champ qu'on ne connaît pas. */
let dernierDoc: Json = {}
let derniereLecture: { cvDocument: string | null; maj: string | null } = { cvDocument: null, maj: null }

async function lisProfilEquipe(): Promise<Json> {
  const s = moiSession()
  try {
    const p = await appel<{ cv?: unknown; cvDocument?: string | null; updatedAt?: string | null }>('GET', `/profils/${s.id}`)
    let cv = p.cv
    if (typeof cv === 'string') {
      try { cv = JSON.parse(cv) } catch { cv = {} }
    }
    dernierDoc = objet(cv)
    derniereLecture = { cvDocument: p.cvDocument ?? null, maj: p.updatedAt ?? null }
  } catch (e) {
    if (!(e instanceof ErreurApi) || e.http !== 404) throw e
    dernierDoc = {}
    derniereLecture = { cvDocument: null, maj: null }
  }
  return dernierDoc
}

async function documentCourant(): Promise<Json> {
  return Object.keys(dernierDoc).length ? dernierDoc : lisProfilEquipe()
}

async function envoieDocument(doc: Json): Promise<void> {
  await brut('PUT', '/profils/moi', { corps: doc })
  dernierDoc = doc
}

function niveauDepuisStudyType(t: string): number {
  const s = t.toLowerCase()
  if (s.includes('+5') || s.includes('master') || s.includes('ingén')) return 4
  if (s.includes('+3') || s.includes('licence') || s.includes('bachelor')) return 3
  if (s.includes('+2') || s.includes('bts') || s.includes('dut')) return 2
  return 1
}

const anneeMois = (v: unknown) => /^(\d{4})(-\d{2})?/.exec(String(v ?? ''))?.slice(1).join('') ?? ''
const NIVEAUX_LIB = ['Bac', 'Bac+2', 'Bac+3', 'Bac+5']
const CECRL = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

/** Leur JSON (JSON Resume) → le profil des écrans. Tolérant : un champ absent reste vide. */
function profilDepuisDocument(doc: Json, ref: RefStatique): Profil {
  const b = objet(doc.basics)
  const c = objet(objet(doc.meta).criteres)
  const morceaux = String(b.name ?? '').trim().split(/\s+/).filter(Boolean)
  const prenom = morceaux[0] ?? ''
  const nom = morceaux.slice(1).join(' ')
  const metiersParCode = new Map(ref.metiersOpt.map((m) => [m.code, m]))
  const competencesParCode = new Map(ref.competencesOpt.map((x) => [x.code, x]))

  let codesMetiers = liste(c.metiersOpt)
  // ancien format : « Métiers visés : A, B » dans basics.summary
  if (!codesMetiers.length && typeof b.summary === 'string' && b.summary.startsWith('Métiers visés : ')) {
    const noms = b.summary.slice(16).split(',').map((x) => plat(x.trim()))
    codesMetiers = ref.metiersOpt.filter((m) => noms.includes(plat(m.nom))).map((m) => m.code)
  }
  const competences: string[] = []
  const competencesOpt: CompetenceOpt[] = []
  for (const s of tableau(doc.skills)) {
    const n = String(s.name ?? '').trim()
    if (!n) continue
    const code = liste(s.keywords).find((k) => k.startsWith('OPT-NC:'))?.slice(7)
    if (code) competencesOpt.push({ code, nom: competencesParCode.get(code)?.nom ?? n, source: 'saisie' })
    else competences.push(n)
  }
  const formations = tableau(doc.education)
    .map((e) => ({ niveau: niveauDepuisStudyType(String(e.studyType ?? '')), domaine: String(e.area ?? e.studyType ?? '').trim() }))
    .filter((f) => f.domaine)
  const teletravail = String(c.teletravail ?? 'peu importe')
  return {
    prenom,
    initiale: (nom || prenom).slice(0, 1),
    nom,
    telephone: String(b.phone ?? ''),
    dispo: texte(c.disponibilite),
    teletravail: (['peu importe', 'non', 'hybride', 'total'].includes(teletravail) ? teletravail : 'peu importe') as Profil['teletravail'],
    ouverture: c.ouverture === 'ouvert' ? 'ouvert' : 'strict',
    salaireMin: typeof c.salaireMinimumMensuelXPF === 'number' ? c.salaireMinimumMensuelXPF : null,
    permis: typeof c.permisB === 'boolean' ? c.permisB : null,
    refus: liste(c.refuse),
    formation: formations.length ? Math.max(...formations.map((f) => f.niveau)) : null,
    zones: liste(c.zones),
    contrats: liste(c.contrats),
    metiers: liste(c.metiers),
    metiersOpt: codesMetiers.map((code) => metiersParCode.get(code)).filter((m): m is MetierOpt => Boolean(m)),
    competences,
    competencesOpt,
    langues: tableau(doc.languages)
      .map((l) => ({ langue: String(l.language ?? '').trim(), niveau: String(l.fluency ?? '').toUpperCase() }))
      .filter((l): l is Profil['langues'][number] => Boolean(l.langue) && (CECRL as readonly string[]).includes(l.niveau)),
    experiences: tableau(doc.work)
      .map((w) => ({ poste: String(w.position ?? '').trim(), secteur: String(w.name ?? '').trim(), debut: anneeMois(w.startDate), fin: anneeMois(w.endDate) }))
      .filter((x) => x.poste),
    formations,
  }
}

/**
 * Reprend, pour chaque élément réécrit, les champs que l'écran ne connaît pas
 * (résumé et réalisations d'une expérience, établissement d'une formation,
 * mots-clés d'une compétence…), pris sur l'élément d'origine. Sans ça, le
 * premier enregistrement effaçait ce que la lecture du CV avait trouvé.
 * Rapprochement par clé (le poste, la formation, le nom), puis, à défaut, par
 * position : une ligne modifiée garde ses compléments.
 */
function fusionne(anciens: Json[], nouveaux: Json[], cle: (x: Json) => string): Json[] {
  const libres = anciens.map((a, i) => ({ a, i, pris: false }))
  const choisis = nouveaux.map((n) => {
    const x = libres.find((l) => !l.pris && cle(l.a) === cle(n))
    if (x) x.pris = true
    return x
  })
  return nouveaux.map((n, i) => {
    let x = choisis[i]
    if (!x) {
      x = libres.find((l) => !l.pris && l.i === i)
      if (x) x.pris = true
    }
    const out: Json = { ...(x?.a ?? {}) }
    for (const [k, v] of Object.entries(n)) {
      if (v === undefined) continue
      if (k === 'keywords' && Array.isArray(out.keywords)) {
        out.keywords = [...new Set([...liste(out.keywords), ...liste(v)])]
      } else {
        out[k] = v
      }
    }
    return out
  })
}

/** Le profil des écrans → leur JSON, écrit par-dessus le dernier lu (aucun champ inconnu perdu). */
function documentDepuisProfil(p: ProfilEnvoi, competencesOpt: CompetenceOpt[], email: string, base: Json): Json {
  const b = objet(base.basics)
  const meta = objet(base.meta)
  const resume = typeof b.summary === 'string' && !b.summary.startsWith('Métiers visés : ') ? b.summary : undefined
  const work = fusionne(tableau(base.work),
    p.experiences.map((x) => ({ position: x.poste, name: x.secteur, startDate: x.debut || undefined, endDate: x.fin || undefined })),
    (x) => plat(`${x.position ?? ''}|${x.name ?? ''}`))
  const education = fusionne(tableau(base.education),
    p.formations.map((f) => ({ studyType: NIVEAUX_LIB[Math.max(0, Math.min(3, f.niveau - 1))], area: f.domaine })),
    (x) => plat(String(x.area ?? '')))
  const skills = fusionne(tableau(base.skills), [
    ...p.competences.map((name) => ({ name })),
    ...competencesOpt.map((x) => ({ name: x.nom, keywords: [`OPT-NC:${x.code}`] })),
  ], (x) => plat(String(x.name ?? '')))
  const languages = fusionne(tableau(base.languages),
    p.langues.map((l) => ({ language: l.langue, fluency: l.niveau })),
    (x) => plat(String(x.language ?? '')))
  const provenance: Json = { ...objet(meta.provenance) }
  for (const [section, plein] of [['basics', Boolean(p.prenom || p.nom || p.telephone)], ['work', work.length > 0],
    ['education', education.length > 0], ['skills', skills.length > 0], ['languages', languages.length > 0]] as const) {
    if (plein) provenance[section] = 'saisie'
  }
  return {
    ...base,
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: { ...b, name: `${p.prenom} ${p.nom}`.trim() || b.name, email, phone: p.telephone || undefined, summary: resume },
    work,
    education,
    skills,
    languages,
    meta: {
      ...meta,
      generator: 'Adopte un Job',
      version: 'v1.0.0',
      lastModified: new Date().toISOString(),
      source: 'saisie',
      provenance,
      criteres: {
        ...objet(meta.criteres),
        metiersOpt: p.metiersOpt,
        metiers: p.metiers,
        ouverture: p.ouverture,
        zones: p.zones,
        contrats: p.contrats,
        disponibilite: p.dispo,
        salaireMinimumMensuelXPF: p.salaireMin,
        teletravail: p.teletravail,
        permisB: p.permis,
        refuse: p.refus,
      },
    },
  }
}

/** Le parcours est-il vide ? Seul cas où la lecture du CV peut remplir le profil sans rien écraser. */
function parcoursVide(doc: Json): boolean {
  const b = objet(doc.basics)
  return !tableau(doc.work).length && !tableau(doc.education).length && !tableau(doc.skills).length
    && !tableau(doc.languages).length && !String(b.phone ?? '').trim()
}

/* ==================================================================== api */

const NON_DISPONIBLE = (quoi: string) =>
  Promise.reject(new ErreurApi('non_disponible', `${quoi} n’existe pas dans l’API de l’équipe.`, 501))

export const api = {
  /* ------------------------------------------------------------- comptes */
  async inscription(email: string, motdepasse: string, prenom: string, nom: string): Promise<Utilisateur> {
    await appel('POST', '/auth/register', {
      anonyme: true,
      corps: { email, password: motdepasse, prenom, nom, role: 'CANDIDAT' },
      messages: { 409: 'Un compte existe déjà avec cette adresse.' },
    })
    return api.connexion(email, motdepasse)
  },
  async connexion(email: string, motdepasse: string): Promise<Utilisateur> {
    const d = await appel<{ accessToken: string }>('POST', '/auth/login', {
      anonyme: true,
      corps: { email, password: motdepasse },
      messages: { 401: 'Adresse ou mot de passe incorrect.', 400: 'Adresse ou mot de passe incorrect.' },
    })
    const j = litJeton(d.accessToken)
    poseSession({ jeton: d.accessToken, exp: j.exp - 30, id: j.sub, email: email.trim().toLowerCase() })
    dernierDoc = {}
    return { id: j.sub, email: email.trim().toLowerCase(), comptesModifiables: false }
  },
  async deconnexion() {
    poseSession(null)
    dernierDoc = {}
  },
  async moi(): Promise<Utilisateur | null> {
    const s = lisSession()
    return s ? { id: s.id, email: s.email, comptesModifiables: false } : null
  },
  /** Leur API traite le mot de passe oublié. */
  async capacites() { return true },
  async oubli(email: string) {
    await brut('POST', '/auth/forgot-password', { anonyme: true, corps: { email } }).catch((e) => {
      // un 404 dirait « adresse inconnue » : on ne le répète pas, sinon l'écran publie la liste des comptes
      if (!(e instanceof ErreurApi) || e.http >= 500 || e.http === 0) throw e
    })
    return { ok: true, message: 'Si cette adresse a un compte, un code lui est envoyé.' }
  },
  async oubliConfirme(code: string, motdepasse: string) {
    await brut('POST', '/auth/reset-password', {
      anonyme: true,
      corps: { token: code, password: motdepasse },
      messages: { 400: 'Ce code est inconnu, expiré ou déjà utilisé.', 404: 'Ce code est inconnu, expiré ou déjà utilisé.' },
    })
    return { ok: true, message: 'Mot de passe changé. Connecte-toi.' }
  },
  /** Après expiration du jeton : on se reconnecte avec l'adresse de la session. */
  async reconnexionEquipe(motdepasse: string) {
    const email = lisSession()?.email
    if (!email) throw expiree()
    await api.connexion(email, motdepasse)
    return { ok: true, equipeConnecte: true }
  },

  /* -------------------------------------------------------- référentiels */
  async referentiels(): Promise<Referentiels> {
    const [ref, l] = await Promise.all([referentiel(), offres().catch(() => [] as Offre[])])
    return { ...ref, villes: [...new Set(l.map((o) => o.ville).filter((v): v is string => Boolean(v)))].sort() }
  },
  async competencesOpt(q: string) {
    const ref = await referentiel()
    const mots = plat(q).split(/\s+/).filter(Boolean)
    return { competences: ref.competencesOpt.filter((c) => mots.every((m) => plat(c.nom).includes(m))).slice(0, 30) }
  },

  /* --------------------------------------------------------------- profil */
  async profil(): Promise<Profil> {
    const [doc, ref] = await Promise.all([lisProfilEquipe(), referentiel()])
    return profilDepuisDocument(doc, ref)
  },
  async enregistreProfil(p: ProfilEnvoi): Promise<Profil> {
    const s = moiSession()
    const ref = await referentiel()
    const parCode = new Map(ref.competencesOpt.map((c) => [c.code, c]))
    const competencesOpt = (p.competencesOptSaisies ?? [])
      .map((code) => ({ code, nom: parCode.get(code)?.nom ?? code, source: 'saisie' as const }))
    const doc = documentDepuisProfil(p, competencesOpt, s.email, await documentCourant())
    await envoieDocument(doc)
    return profilDepuisDocument(doc, ref)
  },

  /* -------------------------------------------------------------------- CV */
  /** Le CV document, tel que leur profil le décrit. Un seul par personne. */
  async cvs(): Promise<{ cv: CvInfo[]; actif: CvInfo | null }> {
    const doc = await lisProfilEquipe()
    const nom = derniereLecture.cvDocument
    if (!nom) return { cv: [], actif: null }
    const meta = objet(doc.meta)
    const depose = String(objet(meta.cvDepose).le ?? derniereLecture.maj ?? new Date().toISOString())
    const lu = String(objet(meta.lectureCv).le ?? '')
    const cv: CvInfo = {
      id: 1, nom, mime: nom.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', octets: 0, actif: true,
      depose, fichier: true,
      lecture: lu && lu >= depose ? { moteur: 'n8n', version: '', lu: {}, retenu: null, quand: lu } : null,
    }
    return { cv: [cv], actif: cv }
  },
  /** Dépose le CV chez eux (PDF, PNG, JPEG). Il remplace le précédent. */
  async deposeFichierCV(fichier: File) {
    const f = new FormData()
    f.append('fichier', fichier, fichier.name)
    await brut('PUT', '/profils/moi/cv', {
      form: f,
      messages: { 400: 'Ce fichier n’est pas accepté : PDF, PNG ou JPEG seulement (un PDF protégé par mot de passe est refusé).' },
    })
    const doc = await documentCourant()
    await envoieDocument({ ...doc, meta: { ...objet(doc.meta), cvDepose: { le: new Date().toISOString(), nom: fichier.name } } })
    return (await api.cvs()).actif
  },
  /**
   * Fait lire le CV par le traitement de Florian, SEULEMENT si le parcours est
   * vide : leur traitement remplace le profil, et la règle est de ne jamais
   * écraser ce que la personne a saisi. Rend false s'il n'a pas été lancé.
   * Leur route attend la fin du traitement : jusqu'à 3 minutes.
   */
  async lisCV(): Promise<boolean> {
    const avant = await lisProfilEquipe()
    if (!parcoursVide(avant)) return false
    await brut('POST', '/profils/moi/cv/traitement', {
      messages: { 404: 'Aucun CV déposé.', 502: 'La lecture du CV a échoué. Tu peux remplir ton profil à la main.' },
    })
    // Le traitement a remplacé le JSON : on lui rend nos critères et nos repères.
    const lu = await lisProfilEquipe()
    const metaAvant = objet(avant.meta)
    await envoieDocument({
      ...lu,
      meta: {
        ...objet(lu.meta),
        criteres: metaAvant.criteres ?? objet(lu.meta).criteres,
        cvDepose: metaAvant.cvDepose,
        lectureCv: { le: new Date().toISOString() },
        source: 'extraction',
      },
    })
    return true
  },
  /** Leur route de lecture exige le jeton : on récupère le fichier, puis une adresse locale. */
  async urlFichierCV(): Promise<string> {
    const r = await brut('GET', `/profils/${moiSession().id}/cv`)
    return URL.createObjectURL(await r.blob())
  },

  /* ----------------------------------------------------------------- deck */
  async deck(f: Filtres = {}) {
    const [toutes, swipes] = await Promise.all([offres(), toutesPages<SwipeEquipe>('/swipes/candidats')])
    const l = local()
    const decides = new Set(swipes.map((s) => s.avpId).filter((id) => !l.rendus.includes(id)))
    const plusTard = new Set(l.plusTard.map((x) => x.id))
    const base = toutes.filter((o) => (f.clos ? o.statut === 'close' : o.statut !== 'close')
      && !decides.has(o.id) && !plusTard.has(o.id))
    const filtrees = base.filter((o) => passeFiltres(o, f))
      .sort((a, b) => (a.joursRestants ?? 9999) - (b.joursRestants ?? 9999))
    return { offres: filtrees, facettes: facettesDe(base), filtres: f }
  },
  async vue(_id: number, _source: string) { return { ok: true } },
  async swipe(offre: number, decision: 'oui' | 'non' | 'plus_tard', _message?: string) {
    const l = local()
    l.plusTard = l.plusTard.filter((x) => x.id !== offre)
    l.rendus = l.rendus.filter((x) => x !== offre)
    if (decision === 'plus_tard') {
      l.plusTard.push({ id: offre, quand: new Date().toISOString() })
      poseLocal(l)
      return { ok: true, candidature: null }
    }
    await envoieSwipe(offre, decision === 'oui')
    poseLocal(l)
    return {
      ok: true,
      candidature: decision === 'oui' ? { id: 0, statut: 'envoyee' as StatutCandidature, equipe: 'EN_ATTENTE' as StatutEquipe } : null,
    }
  },
  /** Revenir sur une décision : leur API ne supprime pas un swipe, un like devient un dislike (candidature annulée). */
  async annuleSwipe(offre: number) {
    const l = local()
    if (l.plusTard.some((x) => x.id === offre)) {
      l.plusTard = l.plusTard.filter((x) => x.id !== offre)
    } else {
      const swipes = await toutesPages<SwipeEquipe>('/swipes/candidats')
      if (swipes.find((s) => s.avpId === offre)?.estLike) await envoieSwipe(offre, false)
      if (!l.rendus.includes(offre)) l.rendus.push(offre)
    }
    poseLocal(l)
    return { ok: true }
  },
  async interets(): Promise<Interet[]> {
    const [toutes, swipes, cands] = await Promise.all([
      offres().catch(() => [] as Offre[]),
      toutesPages<SwipeEquipe>('/swipes/candidats'),
      toutesPages<CandidatureEquipe>('/candidatures/moi'),
    ])
    const l = local()
    const parId = new Map(toutes.map((o) => [o.id, o]))
    const candParAvp = new Map(cands.map((c) => [c.avpId, c]))
    for (const c of cands) offreDeCandidature.set(c.id, c.avpId)
    const offreDe = (id: number, titre?: string, ref?: string): Offre =>
      parId.get(id) ?? offreDepuisAvp({ id, titre: titre ?? 'Offre', reference: ref ?? null })
    const out: Interet[] = []
    for (const s of swipes) {
      if (l.rendus.includes(s.avpId) || l.plusTard.some((x) => x.id === s.avpId)) continue
      const c = s.estLike ? candParAvp.get(s.avpId) : undefined
      out.push({
        ...offreDe(s.avpId, s.avpTitre, s.avpReference),
        decision: s.estLike ? 'oui' : 'non',
        quand: s.updatedAt ?? s.createdAt,
        match: null,
        candidature: c ? { id: c.id, statut: STATUT_LOCAL[c.statut], equipe: c.statut, equipeLe: c.updatedAt } : null,
      })
    }
    for (const x of l.plusTard) {
      out.push({ ...offreDe(x.id), decision: 'plus_tard', quand: x.quand, match: null, candidature: null })
    }
    return out.sort((a, b) => b.quand.localeCompare(a.quand))
  },
  async interetsSynchro() {
    return { interets: await api.interets(), equipeConnecte: true }
  },
  /** Retirer une candidature : un dislike sur l'offre, qu'ils passent en ANNULEE. */
  async statutCandidature(id: number, statut: StatutCandidature, _motif?: string) {
    const avp = offreDeCandidature.get(id)
    if (statut !== 'retiree' || avp === undefined) return NON_DISPONIBLE('Ce changement de statut')
    await envoieSwipe(avp, false)
    return { ok: true }
  },
}

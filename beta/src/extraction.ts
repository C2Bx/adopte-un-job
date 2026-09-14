/* Lecture d'un CV PDF, dans l'appareil. Rien ne part sur le réseau.
   pdf.js est empaqueté, pas chargé d'un CDN : une application en magasin doit
   fonctionner hors ligne, et une politique de sécurité de contenu bloquerait
   le script externe de toute façon.

   Deux étapes : le texte AVEC sa mise en page (sans quoi un CV sur deux colonnes
   s'entrelace et tout le reste devient faux), puis des heuristiques. Aucun modèle
   de langage : ce qui n'est pas trouvé reste vide. */

import * as pdfjs from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { Experience, Formation, Langue } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

export interface Fragment { t: string; x: number; y: number; w: number; h: number }

/** D'où vient le texte : de la couche texte du PDF, ou d'une reconnaissance
    optique (image, scan). La seconde se trompe autrement, et plus souvent. */
export type Mode = 'texte' | 'ocr'

export interface Trouvaille {
  prenom?: string
  initiale?: string
  email?: string
  telephone?: string
  formation?: number
  experiences?: Experience[]
  formations?: Formation[]
  competences?: string[]
  langues?: Langue[]
  permis?: boolean
}

export interface Extraction {
  vide: boolean
  pages: number
  trouve: Trouvaille
  sources: Record<string, string>
  lignes: number
  mode: Mode
  /** Confiance moyenne de la reconnaissance optique (0–100), null en mode texte. */
  confiance: number | null
}

/* ------------------------------------------------------------- mise en page */

/** Où couper les colonnes ? Sûrement pas au milieu de la page : la colonne de
 *  droite d'un CV commence rarement à 50 %. On cherche l'abscisse que le moins
 *  de fragments traversent, en tolérant les bandeaux qui courent sur toute la
 *  largeur — un titre pleine largeur ne doit pas masquer la gouttière. */
function coupure(frags: Fragment[], largeur: number): number | null {
  let best: { x: number; croise: number } | null = null
  for (let x = largeur * 0.2; x <= largeur * 0.8; x += 4) {
    let croise = 0, g = 0, d = 0
    for (const f of frags) {
      const fin = f.x + f.w
      if (f.x < x && fin > x) croise++
      else if (fin <= x) g++
      else d++
    }
    if (Math.min(g, d) < Math.max(6, frags.length * 0.2)) continue
    if (!best || croise < best.croise) best = { x, croise }
  }
  if (!best) return null
  // Une page sur une seule colonne est traversée par presque toutes ses lignes.
  return best.croise <= Math.max(2, frags.length * 0.15) ? best.x : null
}

function assemble(liste: Fragment[]): string[] {
  const parY = new Map<number, Fragment[]>()
  for (const f of liste) {
    const cle = Math.round(f.y / 3) * 3          // tolérance de 3 points
    const t = parY.get(cle)
    if (t) t.push(f)
    else parY.set(cle, [f])
  }
  return [...parY.keys()]
    .sort((a, b) => b - a)                       // haut vers bas
    .map((y) => (parY.get(y) ?? [])
      .sort((a, b) => a.x - b.x)
      .map((f) => f.t).join(' ')
      .replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export function lignesDePage(frags: Fragment[], largeur: number, hauteur: number, mode: Mode = 'texte') {
  if (!frags.length) return { lignes: [], entete: [] as string[] }

  /* Le bandeau d'identité : le plus gros texte de la page, pas le plus haut.
     « 27 ans - Permis de conduire », « Formations » ou « &HACKING ETHIQUE »
     occupaient le haut de page sur trois CV du corpus, et devenaient le nom. */
  let maxH = 0
  const compte = new Map<number, number>()
  for (const f of frags) {
    if (f.h > maxH) maxH = f.h
    const c = Math.round(f.h)
    compte.set(c, (compte.get(c) ?? 0) + 1)
  }
  // La taille du corps de texte, c'est celle qu'on rencontre le plus souvent.
  let corps = 0, mieux = 0
  for (const [taille, n] of compte) if (n > mieux) { mieux = n; corps = taille }
  /* Deux garde-fous : une fraction de la plus grande taille, pour ne pas perdre
     un prénom écrit plus petit que le nom ; et un net écart au corps de texte,
     pour ne pas laisser entrer les intertitres. */
  const seuil = Math.max(maxH * 0.55, corps * 1.35)
  // On compte les LIGNES, pas les fragments : un nom peut être découpé en huit
  // morceaux et rester une seule ligne.
  /* En lecture optique, une icône ou une puce prend facilement la hauteur d'un
     nom. Le nom, lui, est en haut : on ne cherche le bandeau que dans la
     moitié supérieure de la page. */
  const gros = frags.filter((f) => f.h >= seuil && (mode === 'texte' || f.y > hauteur * 0.5))
  const lignesGros = assemble(gros)
  const entete = (lignesGros.length && lignesGros.length <= 6)
    ? lignesGros
    : assemble(frags.filter((f) => f.y > hauteur * 0.8))
  const x = coupure(frags, largeur)
  if (x === null) return { lignes: assemble(frags), entete }
  return {
    lignes: assemble(frags.filter((f) => f.x + f.w / 2 < x))
      .concat(assemble(frags.filter((f) => f.x + f.w / 2 >= x))),
    entete,
  }
}

/* ------------------------------------------------------------ heuristiques */

const DICO = [
  'Windows Server', 'Active Directory', 'Réseau', 'Système', 'Linux', 'Docker', 'Virtualisation',
  'SQL', 'MySQL', 'PostgreSQL', 'Base de données', 'Python', 'JavaScript', 'TypeScript', 'PHP',
  'React', 'Vue', 'Angular', 'Node', 'HTML', 'CSS', 'Git', 'WordPress', 'Symfony', 'Laravel',
  'Java', 'API', 'Développement web', 'Développement', 'Intégration', 'Cybersécurité',
  'Support informatique', 'Helpdesk', 'GLPI', 'Sauvegarde', 'Maintenance', 'Automatisation',
  'Excel', 'Word', 'PowerPoint', 'Bureautique', 'Power BI', 'Figma', 'Photoshop', 'Illustrator',
  'Canva', 'SEO', 'CRM', 'ERP', 'Sage',
  'Gestion de projet', 'Management', 'Encadrement', 'Relation client', 'Vente', 'Accueil',
  'Comptabilité', 'Paie', 'Recrutement', 'Formation', 'Pédagogie', 'Communication',
  'Rédaction', 'Marketing', 'Analyse', 'Logistique', 'Achats', 'Qualité',
  'CACES', 'HACCP', 'Habilitation électrique', 'Soudure', 'Lecture de plans', 'Sécurité chantier',
  'Électricité', 'Mécanique', 'Électrotechnique', 'Soins', 'Conduite',
  'Anglais', 'Espagnol', 'Travail en équipe', 'Autonomie', 'Rigueur', 'Organisation',
  // termes vus dans le corpus de CV et absents du référentiel
  'Cisco', 'DHCP', 'DNS', 'VLAN', 'Routage', 'NAS', 'Fibre optique', 'Supervision',
  'Trello', 'Slack', 'Next.js', 'Leaflet', 'Arduino', 'C++', 'Access', 'Office 365',
  'Déploiement', 'Inventaire', 'Ticketing', 'PRTG', 'Portfolio',
]
const LANGUES = ['Anglais', 'Espagnol', 'Allemand', 'Italien', 'Japonais', 'Chinois', 'Portugais']

const SEC_EXP = /exp[ée]rience|parcours pro|professionnel|emploi|stage|alternance/i
const SEC_FOR = /scolarit|scolaire|formation|[ée]tudes|dipl[ôo]me|cursus|[ée]cole|universit|parcours/i
const DIPL = /(bts|dut|\bbut\b|licence|master|mast[eè]re|bachelor|ing[ée]nieur|miage|mba|bac\b|baccalaur|cap\b|bep\b)/i
const RUBRIQUE = /^(cv|curriculum|vitae|contact|profil|comp[ée]tences?|exp[ée]riences?|formations?|scolarit[ée]|langues?|centres?|loisirs|projets?|objectif|r[ée]f[ée]rences?|motivations?)$/i
const METIER = /d[ée]veloppeur|technicien|assistant|responsable|charg[ée]|ing[ée]nieur|consultant|manager|directeur|agent|conseiller|vendeur|serveur|cuisinier|op[ée]rateur|secr[ée]taire|comptable|infirmi|[ée]ducateur|animateur|chauffeur|m[ée]canicien|[ée]lectricien|plombier|ma[çc]on|menuisier|coiffeur|esth[ée]tic|juriste|architecte|designer|graphiste|commercial|apprenti|[ée]tudiant|alternant|polyvalent|junior|senior|freelance|stagiaire/i

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/* Les libellés de rubrique, en toutes lettres. La liste est fermée et ancrée :
   « Stage chez Machin » ne doit pas devenir une rubrique, « Experience » si.
   Exiger les capitales faisait perdre TOUTES les expériences d'un CV qui écrit
   « Experience » en casse normale — sans un message. */
const RUBRIQUE_LIB = /^(exp[ée]riences?( professionnelles?| scolaires?| pro)?|parcours( professionnel| scolaire)?|formations?|scolarit[ée]|[ée]tudes|dipl[ôo]mes?|comp[ée]tences?|langues?|profil|contacts?|centres? d[’']int[ée]r[êe]ts?|loisirs|savoir[- ][êe]tre|motivations?|projets?|certifications?|r[ée]f[ée]rences?|[àa] propos( de moi)?|hobbies|distinctions?|b[ée]n[ée]volat|informations?)$/i

/* « E X P E R I E N C E » : certains gabarits espacent chaque lettre. Et beaucoup
   collent un pictogramme devant le libellé, qui arrive dans le texte comme un
   caractère de zone privée — invisible, et il empêchait toute reconnaissance. */
function normaliseTitre(l: string): string {
  let t = l.trim().replace(/^[^A-Za-zÀ-ÿ]+/, '').replace(/[:•·|]+$/, '').trim()
  if (/^(?:[A-Za-zÀ-ÿ]\s+){3,}[A-Za-zÀ-ÿ]$/.test(t)) t = t.replace(/\s+/g, '')
  return t
}

/* Deux colonnes à la même hauteur donnent « EXPÉRIENCES LANGUES » sur une seule
   ligne. On accepte donc une ligne entièrement composée de libellés de rubrique,
   et on retient le premier — mais « Formation continue à distance » n'en est pas
   une : la seconde moitié doit être un libellé, elle aussi. */
function rubriqueDe(l: string): string | null {
  const t = normaliseTitre(l)
  if (RUBRIQUE_LIB.test(t)) return t
  const mots = t.split(/\s+/)
  for (let i = 1; i < mots.length; i++) {
    const a = mots.slice(0, i).join(' ')
    const b = mots.slice(i).join(' ')
    if (RUBRIQUE_LIB.test(a) && RUBRIQUE_LIB.test(b)) return a
  }
  return null
}

function estTitre(l: string): boolean {
  const t = normaliseTitre(l)
  if (t.length < 4 || t.length > 34 || /\d/.test(t)) return false
  if (rubriqueDe(l)) return true
  return t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t)
}

/* Les mois ne sont lus que si le CV en donne DEUX : « Sep. - Nov. 2024 »
   n'annonce qu'une fin datée, et déduire le début reviendrait à l'inventer. */
const MOIS = ['janv|jan', 'f[ée]vr|f[ée]v', 'mars|mar', 'avril|avr', 'mai', 'juin',
  'juil', 'ao[ûu]t|ao[ûu]', 'sept|sep', 'oct', 'nov', 'd[ée]c']
const RE_MOIS = new RegExp(`\\b(${MOIS.join('|')})[a-zà-ÿ]{0,6}\\.?\\s+((?:19|20)\\d{2})`, 'gi')
const RE_MOIS_SEUL = new RegExp(`\\b(${MOIS.join('|')})[a-zà-ÿ]{0,6}\\.?`, 'gi')

function moisDates(ligne: string): string[] | null {
  RE_MOIS.lastIndex = 0
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = RE_MOIS.exec(ligne)) !== null) {
    const i = MOIS.findIndex((mo) => new RegExp(`^(${mo})$`, 'i').test(m![1]!)) + 1
    if (i) out.push(`${m[2]}-${String(i).padStart(2, '0')}`)
  }
  /* Deux mois nommés : une vraie plage. Un seul, et c'est aussi le seul mois de
     la ligne : c'est la date de la période. Mais « Sep. - Nov. 2024 » contient
     deux mois pour une seule année — le mois daté y est la FIN, et le prendre
     pour un début serait une invention. */
  if (out.length >= 2) return out
  RE_MOIS_SEUL.lastIndex = 0
  const tous = ligne.match(RE_MOIS_SEUL) ?? []
  return (out.length === 1 && tous.length === 1) ? out : null
}

/** Un intitulé de poste est court et majoritairement en capitales. C'est le seul
 *  signal disponible : le gras ne survit pas à l'extraction du texte. */
function estIntitule(l: string): boolean {
  const lettres = l.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (lettres.length < 4 || l.length > 70) return false
  return lettres.replace(/[^A-ZÀ-Ý]/g, '').length / lettres.length >= 0.6
}

/* L'ordre compte : « L3 MIAGE » vaut Bac+3, pas Bac+5. Une mention explicite de
   niveau prime toujours sur le nom de la filière. */
function niveauDe(t: string): number {
  const s = sansAccent(t)
  if (/\bl3\b|bac\s*\+\s*3|licence|bachelor|\bbut\b/i.test(s)) return 3
  if (/\bl2\b|bac\s*\+\s*2|\bbts\b|\bdut\b/i.test(s)) return 2
  if (/\bm1\b|\bm2\b|bac\s*\+\s*5|master|mastere|ingenieur|miage|mba/i.test(s)) return 4
  return 1
}

/* Un nombre à quatre chiffres n'est pas une date. « Windows server 2012 » créait
   une expérience de toutes pièces. On retire d'abord les faux amis, puis on
   exige un vrai contexte de date. */
const FAUX_ANNEE = /\b(windows|server|serveur|office|sql|exchange|excel|word|access|vista|iso|norme|version)\s*(?:server\s*)?((?:19|20)\d{2})/gi

function estUnePeriode(ligne: string): string | null {
  const l = ligne.replace(FAUX_ANNEE, ' ')
  if (!/(?:19|20)\d{2}/.test(l)) return null
  RE_MOIS.lastIndex = 0
  const moisAnnee = RE_MOIS.test(l)
  const plage = /(?:19|20)\d{2}\s*[-–—/àa]{1,3}\s*((?:19|20)\d{2}|aujourd|pr[ée]sent|en cours|actuel)/i.test(l)
  const parentheses = /\(\s*(?:19|20)\d{2}\s*\)/.test(l)
  const seule = /^\s*(?:19|20)\d{2}\s*$/.test(l.trim())
  const depuis = /\b(depuis|since|d[èe]s)\s+(?:19|20)\d{2}/i.test(l)
  return (moisAnnee || plage || parentheses || seule || depuis) ? l : null
}

const DIPL_FORT = /(bts|dut|\bbut\b|licence|master|mast[eè]re|bachelor|ing[ée]nieur|miage|mba|baccalaur)/i

function nettoie(brut: string): string {
  let t = (brut || '').replace(/[\s|•·]+$/, '').replace(/\s*[/|·•]\s*bac\s*\+?\s*\d\s*$/i, '')
  /* « Année de lycée / Baccalauréat STMG », « Post-Bac / BTS SIO » : quand le
     diplôme est à droite de la barre, ce qui est à gauche est une mention
     administrative qui n'apprend rien. */
  const parts = t.split('/')
  if (parts.length === 2 && DIPL_FORT.test(parts[1]!) && !DIPL_FORT.test(parts[0]!)) {
    t = parts[1]!
  }
  return t.replace(/\s{2,}/g, ' ').trim().slice(0, 60)
}

function analyse(lignes: string[], entete: string[]): Omit<Extraction, 'vide' | 'pages' | 'mode' | 'confiance'> {
  const texte = lignes.join('\n')
  const plat = sansAccent(texte).toLowerCase()
  const trouve: Trouvaille = {}
  const sources: Record<string, string> = {}

  const pose = <K extends keyof Trouvaille>(cle: K, v: Trouvaille[K], src: string) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return
    trouve[cle] = v
    sources[cle] = src.slice(0, 90)
  }

  const mail = texte.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)
  if (mail) pose('email', mail[0], mail[0])
  /* Un numéro calédonien tient en six chiffres : exiger sept en perdait un. On
     garde le plus long candidat, pour préférer un numéro avec indicatif à un
     fragment. */
  const tels = (texte.match(/(?:\+\d{2,3}[ .]?)?(?:\d[ .]?){5,12}\d/g) ?? [])
    .filter((x) => /\d{6,}/.test(x.replace(/\D/g, '')))
    // « 2022 2023 » a huit chiffres et n'est pas un numéro : c'est une période.
    .filter((x) => !/^(?:19|20)\d{2}(?:19|20)\d{2}$/.test(x.replace(/\D/g, '')))
    .sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)
  if (tels[0]) pose('telephone', tels[0].trim(), tels[0].trim())

  /* Identité. Le nom est dans le bandeau du haut, pas forcément en tête de la
     colonne de gauche. On écarte d'abord l'intitulé de poste, qui vit au même
     endroit et se lit comme un prénom. */
  const haut = entete.length ? entete : lignes.slice(0, 8)
  const jetons: string[] = []
  for (const l of haut) {
    // Ni un niveau d'études (« Master MIAGE M1 »), ni un intitulé de poste, ni
    // un titre de rubrique ne sont une identité.
    if (METIER.test(l) || DIPL.test(l) || RUBRIQUE_LIB.test(l.trim())) continue
    // « &HACKING ETHIQUE » : une ligne qui ne commence pas par une lettre est la
    // suite de la précédente, pas un nom.
    if (!/^[A-Za-zÀ-ÿ]/.test(l.trim())) continue
    for (const brut of l.split(/[\s,]+/)) {
      const t = brut.replace(/^[^A-Za-zÀ-ÿ]+/, '').replace(/[^A-Za-zÀ-ÿ'-]+$/, '')
      // « Ææ » : une lecture optique produit des ligatures sans une seule lettre
      // ordinaire. Un prénom en a toujours.
      if (t.length >= 2 && t.length <= 20 && /^[A-Za-zÀ-ÿ'-]+$/.test(t) && /[A-Za-z]/.test(t) && !RUBRIQUE.test(t)) {
        jetons.push(t)
      }
    }
  }
  const capitales = jetons.filter((t) => t === t.toUpperCase())
  const capitalise = jetons.filter((t) => t !== t.toUpperCase() && /^[A-ZÀ-Ý]/.test(t))
  // Deux patronymes en capitales : le premier est le nom, l'ordre usuel.
  const nom = capitales[0] ?? capitalise[1] ?? null
  const prenom = capitalise[0] ?? (capitales.length > 1 ? capitales[1] : null)
  if (nom) pose('initiale', nom.charAt(0).toUpperCase(), nom)
  // « JEAN-PAUL » devient « Jean-Paul » : chaque partie prend sa majuscule.
  if (prenom) {
    pose('prenom', prenom.toLowerCase().replace(/(^|[-' ])([a-zà-ÿ])/g,
      (_, a: string, b: string) => a + b.toUpperCase()), prenom)
  }

  /* Trois passes. Passe 1 : à quelle rubrique appartient chaque ligne. */
  const sections: (string | null)[] = []
  const titres: (string | null)[] = []
  const estUnTitre: boolean[] = []
  let section: 'formation' | 'experience' | null = null
  let titre: string | null = null

  lignes.forEach((l, k) => {
    if (estTitre(l)) {
      /* Seul un libellé de rubrique change de section. Se fier au simple mot
         « stage » ou « alternance » faisait passer « TECHNICIEN EXPLOITATION –
         STAGE » pour un en-tête : le poste disparaissait, et l'employeur prenait
         sa place. */
      const lib = rubriqueDe(l)
      if (lib && SEC_EXP.test(lib)) { section = 'experience'; titre = null }
      else if (lib && SEC_FOR.test(lib)) { section = 'formation'; titre = null }
      else if (lib) { section = null; titre = null }
      else { titre = l.trim() }
      sections[k] = null
      titres[k] = null
      estUnTitre[k] = true
      return
    }
    sections[k] = section
    titres[k] = titre
    estUnTitre[k] = false
  })
  const rubriques = sections.some(Boolean)

  /* Passe 2 : les périodes datées. */
  const exp: Experience[] = []
  const formations: Formation[] = []
  let titrePris: string | null = null
  const formationConnue = (d: string) => {
    const a = d.toLowerCase()
    return formations.some((f) => {
      const b = f.domaine.toLowerCase()
      // Inclusion, pas seulement début : « Obtention du Baccalauréat Général »
      // et « Baccalauréat Général » sont la même ligne du parcours.
      return a === b || a.includes(b) || b.includes(a)
    })
  }

  lignes.forEach((ligne, k) => {
    if (estUnTitre[k]) return
    // Hors rubrique, une date isolée ne veut rien dire : « prix 2024 » n'est ni
    // un emploi ni un diplôme.
    if (rubriques && !sections[k]) return

    const datee = estUnePeriode(ligne)
    if (!datee) return
    const annees = datee.match(/(?:19|20)\d{2}/g)!
    const ouvert = /aujourd|pr[ée]sent|en cours|actuel/i.test(datee)
    const mois = moisDates(datee)

    // L'intitulé est parfois sur la ligne de date : on l'en débarrasse.
    const reste = datee
      .replace(RE_MOIS, ' ')
      .replace(/\(?\s*(?:19|20)\d{2}(?:\s*[-–—/àa]{1,3}\s*(?:(?:19|20)\d{2}|aujourd\S*|pr[ée]sent|en cours|actuel\S*))?\s*\)?/gi, ' ')
      .replace(RE_MOIS_SEUL, ' ')
      .replace(/\b(aujourd['’]?hui|pr[ée]sent|en cours|actuel\w*)\b/gi, ' ')
      /* « décembre 2024 à janvier 2025 » laissait un « à » orphelin collé à
         l'employeur : « SF2i Nouvelle-Calédonie, à ». */
      .replace(/\s+\b(à|a|au|de|du|depuis|jusqu['’]?au?|to|and)\b\s*$/i, '')
      .replace(/^\s*\b(à|a|au|de|du|depuis)\b\s+/i, '')
      .replace(/\s{2,}/g, ' ').replace(/^[\s\-–—:•·/,]+|[\s\-–—:•·/,]+$/g, '')

    const avant: string[] = []
    for (let j = k - 1; j >= Math.max(0, k - 3); j--) {
      if (estUnTitre[j]) break                    // on ne franchit pas un titre
      avant.push((lignes[j] ?? '').trim())
    }
    const autour = [reste, ...avant].join(' ')
    const utile = [reste, ...avant].filter((c) =>
      c.length >= 4 && c.length <= 70 && !/^\d/.test(c) && !/^option\b/i.test(c))

    const scolaire = sections[k] === 'formation'
      || (sections[k] !== 'experience' && DIPL.test(autour))
    let intitule = ''
    let brut = ''

    // Pour une formation, le diplôme prime : l'établissement en capitales
    // (« IAE NC ») n'apprend rien sur le niveau.
    if (scolaire) {
      const d = utile.find((c) => DIPL.test(c))
      if (d) { intitule = d; brut = d }
    }
    // Sinon le titre en capitales retenu juste au-dessus, une seule fois :
    // sans ça, le poste suivant hérite du précédent.
    if (!intitule && titres[k] && titres[k] !== titrePris) {
      intitule = titres[k]!
      titrePris = titres[k]!
    }
    // Sinon une ligne à dominante majuscule au-dessus : c'est le poste, pas
    // l'employeur collé aux dates.
    if (!intitule) intitule = avant.find(estIntitule) ?? ''
    // À défaut, ce qui reste de la ligne de dates.
    if (!intitule) intitule = utile[0] ?? ''

    const option = avant.find((c) => /^option\b/i.test(c))
    if (option && !intitule.includes(option)) intitule += ` ${option}`

    if (scolaire) {
      /* Le niveau se lit sur la ligne du diplôme, pas sur la fenêtre de trois
         lignes : celle-ci déborde sur la formation précédente et faisait passer
         un baccalauréat pour une licence.
         Aucune date conservée : l'année d'obtention révèle l'âge. */
      const dom = nettoie(intitule)
      // Sans mot de diplôme, un nom d'établissement seul n'apprend rien : le
      // diplôme est ailleurs, et cette ligne créerait un doublon muet.
      if (!brut && /universit|lyc[ée]e|[ée]cole|institut|\biae\b|\bcfa\b|centre de formation/i.test(dom)) return
      if (dom.length >= 4 && !formationConnue(dom)) {
        formations.push({ niveau: niveauDe(brut || autour), domaine: dom })
      }
    } else {
      /* Un intitulé vide ou qui commence en minuscule est une phrase coupée, pas
         un poste. Mieux vaut une expérience manquante qu'une expérience fausse :
         la première se corrige à la main, la seconde ne se voit pas. */
      const p = nettoie(intitule)
      if (p.length < 4 || /^[a-zà-ÿ]/.test(p)) return
      // Une année seule reste une année : on n'invente pas de mois.
      exp.push({
        poste: p, secteur: '',
        debut: mois ? mois[0]! : annees[0]!,
        fin: ouvert ? ''
          : (mois ? mois[mois.length - 1]! : (annees.length > 1 ? annees[1]! : annees[0]!)),
      })
    }
  })

  /* Passe 3 : les diplômes sans date. Une formation en cours n'a pas d'année de
     fin, et c'est justement la plus importante. On ne les cherche que dans la
     rubrique formation — ailleurs, « Master » est un mot comme un autre. */
  const connue = formationConnue
  lignes.forEach((ligne, k) => {
    if (sections[k] !== 'formation' || /\d{4}/.test(ligne)) return
    if (!DIPL.test(ligne) || ligne.length > 60) return
    const d = nettoie(ligne.trim())
    if (d.length >= 4 && !connue(d)) formations.push({ niveau: niveauDe(ligne), domaine: d })
  })
  // CV sans rubrique lisible : dernier recours, tout le texte.
  if (!formations.length) {
    for (const ligne of lignes) {
      if (estTitre(ligne) || /\d{4}/.test(ligne)) continue
      if (!DIPL.test(ligne) || ligne.length > 60) continue
      const d = nettoie(ligne)
      if (d && !connue(d)) formations.push({ niveau: niveauDe(ligne), domaine: d })
    }
  }

  if (exp.length) {
    pose('experiences', exp.slice(0, 6),
      rubriques ? 'rubrique « expérience » du CV' : 'périodes datées trouvées dans le texte')
  }
  if (formations.length) {
    pose('formations', formations.slice(0, 5),
      'années d’obtention volontairement ignorées : elles révèlent l’âge')
  }

  /* Le niveau global est celui des formations trouvées. Le déduire du texte
     entier faisait lire « je cherche un contrat pour mon Master » comme un Bac+5
     obtenu : c'est un projet, pas un diplôme. */
  if (formations.length) {
    pose('formation', Math.max(...formations.map((f) => f.niveau)),
      formations.map((f) => f.domaine).join(' · ').slice(0, 90))
  } else {
    const NIV: [number, RegExp][] = [
      [4, /(bac\s*\+\s*5|master|ing[ée]nieur|mast[eè]re)/i],
      [3, /(bac\s*\+\s*3|licence|bachelor|\bbut\b)/i],
      [2, /(bac\s*\+\s*2|\bbts\b|\bdut\b)/i],
      [1, /(baccalaur[ée]at|\bbac\b|\bcap\b|\bbep\b)/i],
    ]
    for (const [n, r] of NIV) {
      const ligne = lignes.find((l) => r.test(sansAccent(l)))
      if (ligne) { pose('formation', n, ligne.trim()); break }
    }
  }

  let comp = DICO.filter((c) => {
    const motif = sansAccent(c).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${motif}s?([^a-z0-9]|$)`).test(plat)
  })
  // « Développement web » plutôt que « Développement » : on garde le plus précis.
  /* « Développement » cède la place à « Développement web » ; « Java » ne cède
     pas à « JavaScript ». Le terme long doit être une extension par un mot, pas
     un mot différent qui commence pareil. */
  comp = comp.filter((c) => {
    const court = `${sansAccent(c).toLowerCase()} `
    return !comp.some((d) => d !== c && sansAccent(d).toLowerCase().startsWith(court))
  })
  if (comp.length) pose('competences', comp, 'reconnues dans le référentiel des métiers')

  /* Le niveau se lit sur la LIGNE de la langue, pas dans une fenêtre de cent
     signes qui ramasse le voisinage : « Anglais : Intermédiaire » devenait C2
     parce qu'un « C2 » traînait ailleurs sur la page. */
  const MENTIONS: [RegExp, Langue['niveau']][] = [
    [/bilingue|maternelle|natif|native/i, 'C2'],
    [/courant|avanc[ée]|fluent/i, 'C1'],
    [/interm[ée]diaire|bon niveau|professionnel/i, 'B1'],
    [/notions|d[ée]butant|scolaire|basique/i, 'A2'],
  ]
  const lg: Langue[] = []
  for (const n of LANGUES) {
    const cle = sansAccent(n).toLowerCase()
    const ligneL = lignes.find((l) => sansAccent(l).toLowerCase().includes(cle))
    if (!ligneL) continue
    const niv = ligneL.match(/\b([ABC][12])\b/)
    const mention = MENTIONS.find(([re]) => re.test(ligneL))
    lg.push({ langue: n, niveau: (niv?.[1] as Langue['niveau']) ?? mention?.[1] ?? 'B1' })
  }
  if (lg.length) pose('langues', lg, 'niveaux au format européen, déduits du contexte')

  if (/permis\s*b/i.test(texte)) pose('permis', true, 'mention « permis B »')

  return { trouve, sources, lignes: lignes.length }
}

/** Les erreurs classiques d'une lecture optique, corrigées seulement là où le
    contexte l'exige : « 2O24 » n'est pas une année, « L3 » en est un niveau. */
const RUBRIQUES_OCR = ['EXPÉRIENCES', 'EXPÉRIENCE', 'SCOLARITÉ', 'FORMATIONS', 'FORMATION',
  'COMPÉTENCES', 'LANGUES', 'MOTIVATIONS', 'CERTIFICATIONS', 'PROJETS', 'DIPLÔMES', 'PARCOURS']

function corrigeOCR(ligne: string): string {
  const l = ligne
    .replace(/(?<=\d)O|O(?=\d)/g, '0')
    .replace(/(?<=\d)[lI](?=\d)/g, '1')
  /* Un titre en blanc sur fond de couleur perd ses premières lettres à la
     lecture optique : « OLARITÉ » pour « SCOLARITÉ ». Sans la rubrique, tout
     le bloc des diplômes devient des expériences. Une fin de mot de cinq
     lettres au moins, seule sur sa ligne, se remet d'aplomb. */
  const t = sansAccent(l.trim()).toUpperCase().replace(/[^A-Z]/g, '')
  if (t.length >= 5 && t.length <= 14) {
    const r = RUBRIQUES_OCR.find((x) => { const y = sansAccent(x); return y !== t && y.endsWith(t) && y.length - t.length <= 3 })
    if (r) return r
  }
  return l
}

/* ------------------------------------------------------------------ entrée */

/* ------------------------------------------------------------------ entrée */

export type Avancement = (etape: string, fraction: number) => void

interface PageLue { frags: Fragment[]; largeur: number; hauteur: number }

/** Une image reconnue par l'OCR coûte plusieurs secondes par page : au-delà de
    trois, c'est un dossier, pas un CV. */
const PAGES_OCR_MAX = 3

/** Un PDF « texte » qui n'a que quelques mots est un scan avec un en-tête
    vectoriel ou un filigrane : ce n'est pas assez pour lire, on passe à l'OCR. */
const MOTS_TEXTE_MIN = 25

const estImage = (f: File) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(f.name)

function assembleTout(pages: PageLue[], mode: Mode) {
  let lignes: string[] = []
  let entete: string[] = []
  pages.forEach((p, i) => {
    const r = lignesDePage(p.frags, p.largeur, p.hauteur, mode)
    if (i === 0) entete = r.entete
    lignes = lignes.concat(r.lignes)
  })
  if (mode === 'ocr') {
    lignes = lignes.map(corrigeOCR)
    entete = entete.map(corrigeOCR)
  }
  return { lignes, entete }
}

/** Le point d'entrée. Un PDF est lu par sa couche texte ; s'il n'en a pas
    (scan), ses pages sont rendues en image et passent par l'OCR, comme une
    photo. Dans tous les cas, rien ne quitte l'appareil. */
export async function litCV(fichier: File, avance?: Avancement): Promise<Extraction> {
  if (estImage(fichier)) {
    const { litImage } = await import('./ocr')
    const p = await litImage(fichier, avance)
    return termine([p], 1, 'ocr', p.confiance)
  }

  const doc = await pdfjs.getDocument({ data: await fichier.arrayBuffer() }).promise
  const pages: PageLue[] = []
  let mots = 0
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vue = page.getViewport({ scale: 1 })
    const contenu = await page.getTextContent()
    const frags: Fragment[] = contenu.items
      .filter((it): it is TextItem => 'str' in it)
      .map((it) => ({
        t: it.str, x: it.transform[4], y: Math.round(it.transform[5]), w: it.width,
        h: it.height || Math.abs(it.transform[3]) || 0,
      }))
      .filter((f) => f.t.trim())
    mots += frags.reduce((s, f) => s + f.t.split(/\s+/).length, 0)
    pages.push({ frags, largeur: vue.width, hauteur: vue.height })
  }
  if (mots >= MOTS_TEXTE_MIN) {
    return termine(pages, doc.numPages, 'texte', null)
  }

  /* Pas de couche texte : un scan. Chaque page devient une image nette (échelle
     2, soit ~150 dpi pour un A4), et l'OCR prend le relais. */
  const { litImage } = await import('./ocr')
  const lues: PageLue[] = []
  let somme = 0
  const total = Math.min(doc.numPages, PAGES_OCR_MAX)
  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n)
    const vue = page.getViewport({ scale: 2 })
    const c = document.createElement('canvas')
    c.width = Math.ceil(vue.width)
    c.height = Math.ceil(vue.height)
    /* intent 'print' : le rendu n'attend pas requestAnimationFrame, qui ne
       tourne pas dans un onglet en arrière-plan — l'utilisateur qui change
       d'onglet pendant la lecture ne doit pas la figer. */
    await page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vue, intent: 'print' }).promise
    const p = await litImage(c, (etape, f) => avance?.(`${etape} (page ${n}/${total})`, (n - 1 + f) / total))
    lues.push(p)
    somme += p.confiance
  }
  return termine(lues, doc.numPages, 'ocr', total ? Math.round(somme / total) : 0)
}

function termine(pages: PageLue[], nbPages: number, mode: Mode, confiance: number | null): Extraction {
  const { lignes, entete } = assembleTout(pages, mode)
  if (!lignes.length) {
    return { vide: true, pages: nbPages, trouve: {}, sources: {}, lignes: 0, mode, confiance }
  }
  return { vide: false, pages: nbPages, mode, confiance, ...analyse(lignes, entete) }
}

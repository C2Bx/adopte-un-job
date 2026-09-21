/* Les règles du profil, au même endroit pour tous les écrans.
   Elles doublent celles de api/depot.php : c'est le serveur qui fait foi, mais
   sans copie ici l'utilisateur ne saurait ce qui manque qu'après un refus. */

import type { Profil, ProfilEnvoi } from './types'

export const ETAPES = ['Qui tu es', 'Ce que tu cherches', 'Ton parcours', 'Compétences', 'Relecture']

export interface Exigence {
  cle: keyof Profil
  libelle: string
  etape: number
  champ: string
}

export const REQUIS: Exigence[] = [
  { cle: 'prenom', libelle: 'Ton prénom', etape: 0, champ: '#f-prenom' },
  { cle: 'zones', libelle: 'Les zones où tu acceptes de travailler', etape: 0, champ: '#f-zones' },
  { cle: 'dispo', libelle: 'Ta date de disponibilité', etape: 0, champ: '#f-dispo' },
  { cle: 'metiers', libelle: 'Le ou les métiers que tu vises', etape: 1, champ: '#f-metiers' },
  { cle: 'contrats', libelle: 'Le type de contrat recherché', etape: 1, champ: '#f-contrats' },
  { cle: 'experiences', libelle: 'Au moins une expérience ou une formation', etape: 2, champ: '#f-exp' },
  { cle: 'formations', libelle: 'Ton niveau de formation', etape: 2, champ: '#f-for' },
  { cle: 'competences', libelle: 'Au moins trois compétences', etape: 3, champ: '#f-comp' },
]

export function rempli(p: Profil, cle: keyof Profil): boolean {
  if (cle === 'competences') return p.competences.length >= 3
  if (cle === 'experiences') return p.experiences.length > 0 || p.formations.length > 0
  if (cle === 'metiers') return p.metiers.length > 0 || p.metiersOpt.length > 0
  const v = p[cle]
  if (Array.isArray(v)) return v.length > 0
  return Boolean(v)
}

export function manques(p: Profil): Exigence[] {
  return REQUIS.filter((r) => !rempli(p, r.cle))
}

export function completude(p: Profil): number {
  const n = REQUIS.filter((r) => rempli(p, r.cle)).length
  return Math.round((n / REQUIS.length) * 100)
}

/** La force ne filtre rien : elle dit à quel point une entreprise peut te lire. */
export function force(p: Profil): number {
  let pts = 0
  if (p.competences.length >= 6) pts += 25
  else if (p.competences.length >= 3) pts += 12
  if (p.experiences.length >= 2) pts += 25
  else if (p.experiences.length === 1) pts += 15
  if (p.langues.length) pts += 10
  if (p.salaireMin != null) pts += 10
  if (p.permis !== null) pts += 5
  if (p.formations.length) pts += 10
  return Math.min(100, pts)
}

export interface Conseil {
  gain: number
  quoi: string
  pourquoi: string
  etape: number
}

/* Chaque conseil annonce ce qu'il rapporte, et les points sont ceux de force() :
   le guide ne peut donc pas promettre ce que le calcul ne donnera pas. */
export function conseils(p: Profil): Conseil[] {
  const c: Conseil[] = []
  const a = (gain: number, quoi: string, pourquoi: string, etape: number) =>
    c.push({ gain, quoi, pourquoi, etape })

  if (p.competences.length < 3) {
    a(25, 'Ajoute au moins trois compétences',
      'C’est le critère le plus lourd du score : une offre qui demande trois compétences que tu n’as pas déclarées te classe bas, même si tu les as.', 3)
  } else if (p.competences.length < 6) {
    a(13, 'Monte à six compétences',
      'Six, c’est le seuil où le score cesse de dépendre d’un seul mot bien placé.', 3)
  }
  if (!p.experiences.length) {
    a(25, 'Décris au moins une expérience',
      'Sans expérience datée, l’ancienneté vaut zéro et toutes les offres qui demandent deux ans te filtrent.', 2)
  } else if (p.experiences.length === 1) {
    a(10, 'Ajoute une deuxième expérience',
      'Deux périodes suffisent à montrer une progression — un stage, une alternance, un job d’été comptent.', 2)
  }
  if (!p.formations.length) {
    a(10, 'Renseigne ta formation',
      'Sans niveau, les offres qui exigent un diplôme te laissent en incertitude plutôt qu’en correspondance.', 2)
  }
  if (!p.langues.length) {
    a(10, 'Déclare tes langues',
      'Au format européen : « B2 » se compare, « anglais courant » non.', 3)
  }
  if (p.salaireMin == null) {
    a(10, 'Indique un salaire minimum',
      'Il ne te ferme aucune offre : il sert à ne pas te proposer ce que tu refuserais de toute façon.', 1)
  }
  if (p.permis === null) {
    a(5, 'Réponds sur le permis B',
      'Beaucoup d’offres l’exigent. Non renseigné, l’offre reste visible mais le doute pèse sur le score.', 1)
  }
  c.sort((x, y) => y.gain - x.gain)

  // Ceux-ci ne rapportent aucun point : ils changent le deck.
  if (p.ouverture === 'strict' && p.metiers.length + p.metiersOpt.length === 1) {
    c.push({ gain: 0, etape: 1, quoi: 'Passe en « ouvert aux métiers proches »',
      pourquoi: 'Un seul métier en mode strict : les autres métiers de la même famille passent après. L’ouverture les classe par compatibilité, sans distinction.' })
  }
  if (p.zones.length === 1) {
    c.push({ gain: 0, etape: 0, quoi: 'Accepte une zone de plus',
      pourquoi: 'Une offre hors de tes zones reste visible, mais l’écart pèse sur son score et s’affiche en clair.' })
  }
  if (p.competencesOpt.length < 3 && p.competences.length >= 3) {
    c.push({ gain: 0, etape: 3, quoi: 'Rapproche tes compétences du référentiel OPT-NC',
      pourquoi: 'Les AVP sont décrits avec les 409 compétences du référentiel. Celles qui s’y rattachent comptent dans le score structurel ; les autres ne pèsent que par leurs mots.' })
  }
  return c
}

export const profilVide: Profil = {
  prenom: '', initiale: '', nom: '', telephone: '',
  dispo: null, teletravail: 'peu importe', ouverture: 'strict',
  salaireMin: null, permis: null, formation: null,
  zones: [], contrats: [], metiers: [], metiersOpt: [], competences: [], competencesOpt: [],
  langues: [], experiences: [], formations: [],
}

/** Ce que PUT profil attend : les codes des métiers OPT, pas les objets. */
export function profilEnvoi(p: Profil): ProfilEnvoi {
  return {
    ...p,
    metiersOpt: p.metiersOpt.map((m) => m.code),
    competencesOptSaisies: p.competencesOpt.filter((c) => c.source === 'saisie').map((c) => c.code),
  }
}

export const NIVEAUX: Record<number, string> = { 1: 'Bac', 2: 'Bac+2', 3: 'Bac+3', 4: 'Bac+5' }

/** Ancienneté cumulée, en années. Une année seule compte pour l'année entière. */
export function anneesExperience(p: Profil): number | null {
  if (!p.experiences.length) return null
  let mois = 0
  const now = new Date()
  for (const x of p.experiences) {
    if (!x.debut) continue
    const a = new Date(`${x.debut.length === 4 ? `${x.debut}-01` : x.debut}-01`)
    const b = x.fin ? new Date(`${x.fin.length === 4 ? `${x.fin}-12` : x.fin}-01`) : now
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) continue
    mois += (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  }
  return mois > 0 ? Math.round(mois / 12) : 0
}

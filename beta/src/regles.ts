/* Les règles de complétude du profil. Elles ne calculent pas l'adéquation. */

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

export function nombreCompetences(p: Profil): number {
  const noms = [...p.competences, ...p.competencesOpt.map((c) => c.nom)]
  return new Set(noms.map((n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()).filter(Boolean)).size
}

export function rempli(p: Profil, cle: keyof Profil): boolean {
  if (cle === 'competences') return nombreCompetences(p) >= 3
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
  if (nombreCompetences(p) >= 6) pts += 25
  else if (nombreCompetences(p) >= 3) pts += 12
  if (p.experiences.length >= 2) pts += 25
  else if (p.experiences.length === 1) pts += 15
  if (p.langues.length) pts += 10
  if (p.salaireMin != null) pts += 10
  if (p.permis !== null) pts += 5
  if (p.formations.length) pts += 10
  return Math.round(pts / 85 * 100)
}

export interface Conseil {
  gain: number
  quoi: string
  pourquoi: string
  etape: number
}

/** Conseils de rédaction : aucun effet annoncé sur le classement des offres. */
export function conseils(p: Profil): Conseil[] {
  const c: Conseil[] = []
  const ajoute = (quoi: string, pourquoi: string, etape: number) => c.push({ gain: 0, quoi, pourquoi, etape })
  if (nombreCompetences(p) < 3) ajoute('Décris au moins trois compétences',
    'Les compétences libres et celles du référentiel comptent. Précise ce que tu sais faire.', 3)
  else if (nombreCompetences(p) < 6) ajoute('Précise tes compétences',
    'Ajoute celles que tes expériences permettent d’illustrer ; la quantité seule ne garantit pas l’adéquation.', 3)
  if (!p.experiences.length) ajoute('Décris une expérience',
    'Un stage, une alternance, un bénévolat ou un emploi peuvent illustrer tes compétences.', 2)
  else if (p.experiences.length === 1) ajoute('Complète ton parcours si nécessaire',
    'Une autre expérience pertinente aide le recruteur à comprendre ton parcours.', 2)
  if (!p.formations.length) ajoute('Renseigne ta formation', 'Précise ton diplôme ou ton domaine de formation.', 2)
  if (!p.langues.length) ajoute('Déclare tes langues', 'Indique un niveau européen si tu le connais.', 3)
  if (p.salaireMin == null) ajoute('Précise tes attentes si tu le souhaites',
    'Le salaire souhaité accompagne ton profil ; il ne filtre pas les offres et ne modifie pas l’adéquation.', 1)
  if (p.permis === null) ajoute('Réponds sur le permis B si tu le souhaites',
    'Cette indication accompagne ton profil. Vérifie les prérequis indiqués dans chaque avis.', 1)
  return c
}

export const profilVide: Profil = {
  prenom: '', initiale: '', nom: '', telephone: '',
  dispo: null, teletravail: 'peu importe', ouverture: 'strict',
  salaireMin: null, permis: null, refus: [], formation: null,
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

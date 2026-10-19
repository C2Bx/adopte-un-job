/* Les filtres du deck, calculés dans le navigateur sur les offres déjà chargées :
   un clic filtre instantanément, sans rappeler l'API.

   Trois règles, les mêmes pour toutes les puces :
   - dans une catégorie, plusieurs choix s'ajoutent : « Nouméa » + « Lifou » =
     les offres de Nouméa OU de Lifou ;
   - d'une catégorie à l'autre, ils se combinent : Nouméa ET Systèmes
     d'information ;
   - le nombre affiché sur une puce est le nombre d'offres qu'on verrait en la
     touchant, compte tenu des autres filtres actifs. Une puce qui ne mènerait
     à rien (0) disparaît, sauf si elle est active. */

import type { Offre } from './types'

export interface Filtres {
  q?: string
  villes?: string[]
  familles?: string[]
  directions?: string[]
  contrats?: string[]
  teletravail?: boolean
  encadrement?: boolean
  debutant?: boolean
  salaire?: boolean
  /** Les offres closes, pour s'entraîner : un autre jeu d'offres, pas un filtre. */
  clos?: boolean
}

export type Categorie = 'villes' | 'familles' | 'directions' | 'contrats'
export type Option = 'teletravail' | 'encadrement' | 'debutant' | 'salaire'

export const CATEGORIES: { cle: Categorie; titre: string }[] = [
  { cle: 'villes', titre: 'Lieu' },
  { cle: 'familles', titre: 'Métier' },
  { cle: 'directions', titre: 'Direction' },
  { cle: 'contrats', titre: 'Contrat' },
]

export const OPTIONS: { cle: Option; titre: string }[] = [
  { cle: 'debutant', titre: 'Débutant accepté' },
  { cle: 'teletravail', titre: 'Télétravail' },
  { cle: 'encadrement', titre: 'Encadrement' },
  { cle: 'salaire', titre: 'Salaire annoncé' },
]

const VALEURS: Record<Categorie, (o: Offre) => string[]> = {
  villes: (o) => (o.ville ? [o.ville] : []),
  familles: (o) => o.familles,
  directions: (o) => (o.direction ? [o.direction] : []),
  contrats: (o) => [o.contrat],
}

const VRAI: Record<Option, (o: Offre) => boolean> = {
  teletravail: (o) => o.teletravail !== 'non',
  encadrement: (o) => (o.nbAgentsEncadres ?? 0) > 0,
  debutant: (o) => o.experienceMin === 0,
  salaire: (o) => Boolean(o.salaire),
}

const plat = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const textes = new WeakMap<Offre, string>()
function texte(o: Offre): string {
  let t = textes.get(o)
  if (t === undefined) {
    t = plat([o.titre, o.description, o.metierOpt, o.direction, o.unite, o.ville, o.reference, ...o.familles,
      ...o.responsabilites, ...o.competencesTexte.map((c) => c.texte)].filter(Boolean).join(' '))
    textes.set(o, t)
  }
  return t
}

/** L'offre passe-t-elle les filtres, en ignorant au besoin une catégorie (pour compter ses puces) ? */
function passe(o: Offre, f: Filtres, sauf?: Categorie): boolean {
  if (f.q) {
    const t = texte(o)
    if (!plat(f.q).split(/\s+/).filter(Boolean).every((m) => t.includes(m))) return false
  }
  for (const { cle } of CATEGORIES) {
    const choisis = f[cle]
    if (cle === sauf || !choisis?.length) continue
    if (!VALEURS[cle](o).some((v) => choisis.includes(v))) return false
  }
  for (const { cle } of OPTIONS) if (f[cle] && !VRAI[cle](o)) return false
  return true
}

/** Les offres à montrer, les plus urgentes d'abord. */
export function resultats(offres: Offre[], f: Filtres): Offre[] {
  return offres.filter((o) => passe(o, f))
}

export interface Compteurs {
  categories: Record<Categorie, { valeur: string; n: number }[]>
  options: Record<Option, number>
}

/** Pour chaque puce : combien d'offres on verrait en la touchant. */
export function compteurs(offres: Offre[], f: Filtres): Compteurs {
  const categories = {} as Compteurs['categories']
  for (const { cle } of CATEGORIES) {
    const m = new Map<string, number>()
    for (const o of offres) {
      if (!passe(o, f, cle)) continue
      for (const v of VALEURS[cle](o)) m.set(v, (m.get(v) ?? 0) + 1)
    }
    // les choix actifs restent visibles, même à zéro
    for (const v of f[cle] ?? []) if (!m.has(v)) m.set(v, 0)
    categories[cle] = [...m.entries()].map(([valeur, n]) => ({ valeur, n }))
      .sort((a, b) => b.n - a.n || a.valeur.localeCompare(b.valeur))
  }
  const options = {} as Compteurs['options']
  for (const { cle } of OPTIONS) options[cle] = offres.filter((o) => passe(o, { ...f, [cle]: true })).length
  return { categories, options }
}

/** Le nombre de filtres actifs (recherche comprise), pour « Effacer ». */
export function nbActifs(f: Filtres): number {
  return (f.q ? 1 : 0)
    + CATEGORIES.reduce((n, { cle }) => n + (f[cle]?.length ?? 0), 0)
    + OPTIONS.filter(({ cle }) => f[cle]).length
}

export function basculeValeur(f: Filtres, cle: Categorie, v: string): Filtres {
  const l = f[cle] ?? []
  const nouvelle = l.includes(v) ? l.filter((x) => x !== v) : [...l, v]
  return { ...f, [cle]: nouvelle.length ? nouvelle : undefined }
}

export function basculeOption(f: Filtres, cle: Option): Filtres {
  return { ...f, [cle]: f[cle] ? undefined : true }
}

/** Tout effacer, sauf le jeu d'offres (ouvertes ou closes). */
export function efface(f: Filtres): Filtres {
  return f.clos ? { clos: true } : {}
}

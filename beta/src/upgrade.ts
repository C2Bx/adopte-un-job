import type { Offre } from './types'
import type { Adequation } from './api'

export type VueOffres = 'cartes' | 'liste' | 'tableau'
export type TriOffres = 'cloture' | 'publication' | 'titre' | 'adequation'
export function compteLocal(): string {
  if (new URLSearchParams(location.search).get('demo') === '1') return 'demo'
  try { const s = JSON.parse(sessionStorage.getItem('aj.session') ?? 'null'); return s?.id ? String(s.id) : 'visiteur' } catch { return 'visiteur' }
}
export function litLocal<T>(cle: string, defaut: T): T {
  try { const v = JSON.parse(localStorage.getItem(`aj.upgrade.${compteLocal()}.${cle}`) ?? 'null'); if (v === null || (Array.isArray(defaut) && !Array.isArray(v)) || (typeof defaut !== typeof v)) return defaut; return v } catch { return defaut }
}
export function ecritLocal(cle: string, valeur: unknown): boolean {
  try { localStorage.setItem(`aj.upgrade.${compteLocal()}.${cle}`, JSON.stringify(valeur)); window.dispatchEvent(new Event('aj:upgrade-local')); return true } catch { return false }
}
export function trieOffres<T extends Offre>(offres: T[], tri: TriOffres, scores: Map<string, Adequation> = new Map()): T[] {
  const temps = (date: string | null) => date && Number.isFinite(Date.parse(date)) ? Date.parse(date) : null
  return [...offres].sort((a, b) => {
    if (tri === 'titre') return a.titre.localeCompare(b.titre, 'fr') || a.id - b.id
    if (tri === 'adequation') return (scores.get(b.reference ?? '')?.pourcentage ?? -1) - (scores.get(a.reference ?? '')?.pourcentage ?? -1) || a.id - b.id
    if (tri === 'publication') return (temps(b.datePublication) ?? -Infinity) - (temps(a.datePublication) ?? -Infinity) || a.id - b.id
    return (temps(a.expire) ?? Infinity) - (temps(b.expire) ?? Infinity) || a.id - b.id
  })
}
export function lienOffre(id: number): string {
  const u = new URL(location.href); const demo = u.searchParams.get('demo') === '1'; u.search = ''; if (demo) u.searchParams.set('demo', '1'); u.searchParams.set('offre', String(id)); u.hash = 'swipe'; return u.toString()
}
export function idOffrePartagee(): number | null {
  const v = new URLSearchParams(location.search).get('offre'); return v && /^\d+$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : null
}
export interface RepereOffre { note: string; etiquettes: string; visite?: boolean }
export function limiteComparaison(selection: number[], id: number): number[] {
  return selection.includes(id) ? selection.filter((x) => x !== id) : selection.length < 3 ? [...selection, id] : selection
}
export function choixPersistes(v: unknown): { vue: VueOffres; tri: TriOffres } {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return { vue: ['cartes', 'liste', 'tableau'].includes(String(o.vue)) ? o.vue as VueOffres : 'cartes',
    tri: ['cloture', 'publication', 'titre', 'adequation'].includes(String(o.tri)) ? o.tri as TriOffres : 'cloture' }
}

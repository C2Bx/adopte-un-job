import type { Offre } from './types'

export const GROUPES_COMPARAISON = ['Pratique', 'Contenu du poste', 'Profil attendu'] as const
export type GroupeComparaison = typeof GROUPES_COMPARAISON[number]
export const normaliseComparaison = (v: string) => v.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
const renseignes = (valeurs: string[]) => [...new Map(valeurs.map((v) => [normaliseComparaison(v), v.trim()])).entries()]
  .filter(([cle]) => cle && !['non renseigné', 'non renseignée', 'non renseignées', 'non disponible', 'inconnu', '—'].includes(cle)).map(([, texte]) => texte)

/** Compare uniquement les valeurs connues, indépendamment de l'ordre des listes. */
export function analyseComparaison(brutes: string[][]) {
  const valeurs = brutes.map(renseignes)
  const connues = valeurs.filter((v) => v.length > 0).map((v) => v.map(normaliseComparaison))
  const comparable = connues.length >= 2
  const different = comparable && new Set(connues.map((v) => JSON.stringify([...v].sort()))).size > 1
  const incomplet = connues.length < valeurs.length
  const occurrences = new Map<string, number>()
  for (const offre of connues) for (const valeur of offre) occurrences.set(valeur, (occurrences.get(valeur) ?? 0) + 1)
  const communs = new Set([...occurrences].filter(([, n]) => n >= 2).map(([valeur]) => valeur))
  const etat = !connues.length ? 'Non renseigné' : !comparable ? 'À compléter' : different ? 'Valeurs différentes' : incomplet ? 'Identique · partiel' : 'Identique'
  return { valeurs, comparable, different, incomplet, communs, etat }
}
const texte = (v: string | null | undefined) => v?.trim() ? [v] : []

export function lignesComparaison(offres: (Offre | undefined)[], scores: Map<string, { pourcentage?: number }>) {
  const definitions: { cle: string; titre: string; groupe: GroupeComparaison; lire: (o: Offre) => string[] }[] = [
    { cle: 'lieu', titre: 'Lieu', groupe: 'Pratique', lire: (o) => texte(o.ville ?? o.province) },
    { cle: 'contrat', titre: 'Contrat', groupe: 'Pratique', lire: (o) => texte(o.contrat) },
    { cle: 'cloture', titre: 'Clôture', groupe: 'Pratique', lire: (o) => texte(o.expire?.slice(0, 10)) },
    { cle: 'debut', titre: 'Prise de poste', groupe: 'Pratique', lire: (o) => o.debutImmediat ? ['Dès que possible'] : texte(o.debut) },
    { cle: 'postes', titre: 'Postes à pourvoir', groupe: 'Pratique', lire: (o) => o.nbPostes !== null && Number.isFinite(o.nbPostes) ? [String(o.nbPostes)] : [] },
    { cle: 'metier', titre: 'Métier', groupe: 'Contenu du poste', lire: (o) => texte(o.metierOpt) },
    { cle: 'missions', titre: 'Missions', groupe: 'Contenu du poste', lire: (o) => o.responsabilites },
    { cle: 'conditions', titre: 'Conditions de travail', groupe: 'Contenu du poste', lire: (o) => texte(o.conditions) },
    { cle: 'competences', titre: 'Compétences', groupe: 'Profil attendu', lire: (o) => o.competencesTexte.map((c) => c.texte) },
    { cle: 'qualifications', titre: 'Qualifications', groupe: 'Profil attendu', lire: (o) => texte(o.qualifications) },
    { cle: 'experience', titre: 'Expérience', groupe: 'Profil attendu', lire: (o) => texte(o.experienceTexte) },
    { cle: 'adequation', titre: 'Adéquation disponible', groupe: 'Profil attendu', lire: (o) => { const n = o.reference ? scores.get(o.reference)?.pourcentage : undefined; return n !== undefined && Number.isFinite(n) ? [`${n} %`] : [] } },
  ]
  return definitions.map(({ lire, ...definition }) => ({ ...definition, ...analyseComparaison(offres.map((o) => o ? lire(o) : [])) }))
}

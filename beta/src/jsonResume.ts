type Doc = Record<string, unknown>
const objet = (v: unknown): v is Doc => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const SECTIONS = ['work', 'volunteer', 'education', 'skills', 'projects', 'certificates', 'languages', 'awards', 'publications', 'interests', 'references']

/** Valide les formes JSON Resume que l'interface peut conserver et relire. */
export function valideJsonResume(v: unknown): Doc {
  if (!objet(v)) throw new Error('Le JSON Resume doit être un objet.')
  if (new TextEncoder().encode(JSON.stringify(v)).length > 1_048_576) throw new Error('Le JSON Resume doit faire moins de 1 Mo.')
  let contenu = false
  if ('basics' in v) {
    if (!objet(v.basics)) throw new Error('La rubrique basics doit être un objet.')
    for (const k of ['name', 'label', 'email', 'phone', 'summary', 'url', 'image']) {
      if (k in v.basics && typeof v.basics[k] !== 'string') throw new Error(`Le champ basics.${k} doit être un texte.`)
      if (typeof v.basics[k] === 'string' && v.basics[k].trim()) contenu = true
    }
  }
  for (const k of SECTIONS) {
    if (!(k in v)) continue
    const liste = v[k]
    if (!Array.isArray(liste) || liste.some((x) => !objet(x))) throw new Error(`La rubrique ${k} doit contenir une liste d’objets.`)
    for (const x of liste as Doc[]) {
      for (const [champ, valeur] of Object.entries(x)) {
        if (['keywords', 'highlights', 'courses', 'roles'].includes(champ)) {
          if (!Array.isArray(valeur) || valeur.some((e) => typeof e !== 'string')) throw new Error(`Le champ ${k}.${champ} doit être une liste de textes.`)
        } else if (['name', 'position', 'summary', 'startDate', 'endDate', 'studyType', 'area', 'institution', 'language', 'fluency', 'url'].includes(champ) && typeof valeur !== 'string') {
          throw new Error(`Le champ ${k}.${champ} doit être un texte.`)
        }
      }
      if (Object.values(x).some((e) => typeof e === 'string' && e.trim())) contenu = true
    }
  }
  if ('meta' in v && !objet(v.meta)) throw new Error('La rubrique meta doit être un objet.')
  if (!contenu) throw new Error('Ce fichier ne contient aucun contenu de CV reconnu au format JSON Resume.')
  return v
}

/** L'extraction comble les absences, sans remplacer les champs déjà renseignés. */
export function completeDepuisExtraction(courant: Doc, extrait: Doc): Doc {
  const out: Doc = { ...extrait, ...courant }
  for (const [k, valeur] of Object.entries(extrait)) {
    const existant = courant[k]
    if (objet(valeur) && objet(existant)) out[k] = completeDepuisExtraction(existant, valeur)
    else if (existant === undefined || existant === null || existant === '' || (Array.isArray(existant) && existant.length === 0)) out[k] = valeur
  }
  return out
}

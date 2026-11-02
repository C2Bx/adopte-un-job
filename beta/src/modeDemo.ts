import { api, offreDepuisAvp, profilDepuisDocument, documentDepuisProfil } from './api'
import { valideJsonResume } from './jsonResume'
import type { Offre, ProfilEnvoi, Interet } from './types'

/** Scénarios MS3 fictifs. Le garde dans brut() interdit toute requête métier en démo. */
export function activeDemo(): void {
  type Doc = Record<string, unknown>
  const base: Doc = { basics: { name: 'Camille Démonstration', label: 'Conseil et relation client', email: 'demo@example.invalid' },
    work: [{ position: 'Conseiller clientèle', name: 'Entreprise fictive', startDate: '2022-01', summary: 'Accompagnement de clients dans un cadre fictif.' }],
    education: [{ studyType: 'BTS', area: 'Relation client' }], skills: [{ name: 'Relation client' }, { name: 'Organisation' }, { name: 'Bureautique' }],
    meta: { criteres: { zones: ['Sud'], disponibilite: '2026-11', metiers: ['Commerce'], contrats: ['CDI'] } } }
  let document = base
  try { document = JSON.parse(sessionStorage.getItem('aj.demo.profil') ?? 'null') ?? base } catch { /* reprendre le scénario initial */ }
  let copie: Doc | null = null
  const decisions = new Map<number, 'oui' | 'non' | 'plus_tard'>()
  const maintenant = new Date().toISOString().slice(0, 10)
  const limite = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10)
  const jeux: Offre[] = [
    { id: 9101, titre: 'Conseiller clientèle — démonstration', ville: 'Nouméa', typeContrat: 'PERMANENT', metierLibelle: 'Relation client', qualifications: 'BTS souhaité', dateLimite: limite, experienceRequise: 'Débutant accepté' },
    { id: 9102, titre: 'Technicien de proximité — démonstration', ville: 'Koné', typeContrat: 'FULL_TIME', metierLibelle: 'Assistance informatique', qualifications: 'Formation informatique demandée', dateLimite: '2099-12-31', experienceRequise: '2 ans' },
    { id: 9103, titre: 'Chargé de projet — démonstration', ville: 'Lifou', typeContrat: 'TEMPORARY', metierLibelle: 'Gestion de projet', dateLimite: '2099-11-30' },
    { id: 9104, titre: 'Avis incomplet — démonstration', ville: null, typeContrat: null, dateLimite: '2099-10-31' },
    { id: 9105, titre: 'Archive consultable — démonstration', ville: 'Nouméa', typeContrat: 'PERMANENT', dateLimite: '2020-01-01' },
  ].map((o) => offreDepuisAvp({ ...o, reference: `DEMO-${o.id}`, datePublication: maintenant,
    description: 'Avis entièrement fictif pour découvrir les outils MS3. Aucun recrutement et aucun envoi réel.',
    responsabilites: ['Accueillir et accompagner', 'Organiser les activités'], savoirFaire: ['Organisation', 'Communication'], contactEmail: null }))
  let refPromise: ReturnType<typeof chargeRef> | null = null
  async function chargeRef() {
    const r = await fetch(`${import.meta.env.BASE_URL}referentiel.json`)
    if (!r.ok) throw new Error('Le référentiel local est indisponible.')
    return r.json()
  }
  const ref = () => refPromise ??= chargeRef()
  const profil = async () => profilDepuisDocument(document, await ref())
  const garde = (d: Doc) => { document = d; sessionStorage.setItem('aj.demo.profil', JSON.stringify(d)) }
  Object.assign(api, {
    moi: async () => ({ id: 9900, email: 'demo@example.invalid', comptesModifiables: false }),
    profil,
    referentiels: ref,
    offresPubliques: async () => jeux,
    compteurOffres: async () => ({ total: 5, actifs: 4, expires: 1 }),
    deck: async (clos = false) => jeux.filter((o) => (o.statut === 'close') === clos && !decisions.has(o.id)),
    adequations: async () => new Map(), detailAdequation: async () => null,
    cvs: async () => ({ cv: [], actif: null }),
    exporteProfil: async () => structuredClone(document),
    enregistreProfil: async (p: ProfilEnvoi) => { const r = await ref(); garde(documentDepuisProfil(p, p.competencesOptSaisies?.map((code) => ({ code, nom: r.competencesOpt.find((x: { code: string }) => x.code === code)?.nom ?? code, source: 'saisie' as const })) ?? [], 'demo@example.invalid', document)); return profil() },
    enregistreComplements: async (doc: Doc) => { garde(doc); return profil() },
    importeProfil: async (doc: unknown) => { const d = valideJsonResume(doc); copie = structuredClone(document); garde({ ...d, meta: document.meta }); return profil() },
    copieAvantImportDisponible: () => copie !== null,
    restaureAvantImport: async () => { if (!copie) throw new Error('Aucune copie de démo.'); garde(copie); copie = null; return profil() },
    supprimeMonCv: async () => { garde({}) },
    swipe: async (id: number, decision: 'oui' | 'non' | 'plus_tard') => {
      if (jeux.find((o) => o.id === id)?.statut === 'close') throw new Error('Archive en lecture seule.')
      decisions.set(id, decision)
      return { ok: true, candidature: decision === 'oui' ? { id, statut: 'envoyee', equipe: 'EN_ATTENTE' } : null }
    },
    annuleSwipe: async (id: number) => { decisions.delete(id); return { ok: true } },
    interets: async () => jeux.filter((o) => decisions.has(o.id)).map((o): Interet => ({ ...o, decision: decisions.get(o.id)!, quand: new Date().toISOString(), match: null,
      candidature: decisions.get(o.id) === 'oui' ? { id: o.id, statut: 'envoyee', equipe: 'EN_ATTENTE' } : null })),
    interetsSynchro: async () => ({ interets: await api.interets(), equipeConnecte: true }),
    deconnexion: async () => { location.href = import.meta.env.BASE_URL },
  })
}

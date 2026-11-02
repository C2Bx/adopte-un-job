import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Profil } from '../types'
import { compteLocal } from '../upgrade'
type Doc = Record<string, unknown>
const objet = (v: unknown): Doc => v && typeof v === 'object' && !Array.isArray(v) ? v as Doc : {}
const liste = (v: unknown): Doc[] => Array.isArray(v) ? v.map(objet) : []
const texte = (v: unknown) => typeof v === 'string' ? v : ''

export function ProfilEnrichi({ avantOperation, onRelu }: { avantOperation: () => Promise<void>; onRelu: (p: Profil) => void }) {
  const [doc, setDoc] = useState<Doc | null>(null)
  const [propre, setPropre] = useState('')
  const cleBrouillon = `aj.complements.${compteLocal()}`
  const [erreur, setErreur] = useState(''); const [message, setMessage] = useState(''); const [envoi, setEnvoi] = useState(false)
  const charge = () => { setErreur(''); void avantOperation().then(() => api.exporteProfil()).then((serveur) => {
    setPropre(JSON.stringify(serveur))
    try { const brouillon = JSON.parse(sessionStorage.getItem(cleBrouillon) ?? 'null'); setDoc(brouillon && typeof brouillon === 'object' && !Array.isArray(brouillon) ? brouillon : serveur) } catch { setDoc(serveur) }
  }).catch(() => setErreur('Les rubriques détaillées n’ont pas pu être chargées.')) }
  useEffect(charge, [])
  const modifie = Boolean(doc && JSON.stringify(doc) !== propre)
  useEffect(() => {
    if (!doc || !propre) return
    try { if (modifie) sessionStorage.setItem(cleBrouillon, JSON.stringify(doc)); else sessionStorage.removeItem(cleBrouillon) } catch { /* la fermeture reste signalée */ }
  }, [doc, propre, modifie, cleBrouillon])
  useEffect(() => {
    const protege = (e: BeforeUnloadEvent) => { if (modifie) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', protege); return () => window.removeEventListener('beforeunload', protege)
  }, [modifie])
  const basics = objet(doc?.basics)
  const changeBasic = (k: string, v: unknown) => { setMessage(''); setDoc({ ...doc, basics: { ...basics, [k]: v } }) }
  const changeListe = (section: string, i: number, k: string, valeur: unknown) => { setMessage(''); setDoc({ ...doc, [section]: liste(doc?.[section]).map((x, j) => j === i ? { ...x, [k]: valeur } : x) }) }
  const ajoute = (section: string, valeurs: Doc) => setDoc({ ...doc, [section]: [...liste(doc?.[section]), valeurs] })
  const enregistre = async () => {
    if (!doc || envoi) return
    setEnvoi(true); setErreur(''); setMessage('')
    try { await avantOperation(); onRelu(await api.enregistreComplements(doc)); setPropre(JSON.stringify(doc)); setMessage('Les rubriques détaillées sont enregistrées.') }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Les rubriques n’ont pas été enregistrées.') }
    finally { setEnvoi(false) }
  }
  return <details className="upgrade-enrichi"><summary>Résumé, réalisations, projets et liens</summary>
    <p>Ces rubriques sont enregistrées dans ton profil JSON Resume avec l’enregistrement déjà disponible. Elles ne génèrent aucun document.</p>
    {erreur && <p role="alert">{erreur} {!doc && <button className="btn-mini" onClick={charge}>Réessayer</button>}</p>}
    {!doc ? <p role="status">{erreur ? 'Chargement interrompu.' : 'Chargement des rubriques…'}</p> : <fieldset disabled={envoi}>
      <label>Titre professionnel <input maxLength={180} value={texte(basics.label)} onChange={(e) => changeBasic('label', e.target.value)} /></label>
      <label>Résumé professionnel <textarea rows={4} maxLength={4000} value={texte(basics.summary)} onChange={(e) => changeBasic('summary', e.target.value)} /></label>
      {liste(doc.work).map((w, i) => <div className="upgrade-bloc" key={i}><h4>{texte(w.position) || `Expérience ${i + 1}`}</h4>
        <label>Résumé de cette expérience <textarea maxLength={4000} value={texte(w.summary)} onChange={(e) => changeListe('work', i, 'summary', e.target.value)} /></label>
        <label>Réalisations, une par ligne <textarea maxLength={6000} value={Array.isArray(w.highlights) ? w.highlights.join('\n') : ''} onChange={(e) => changeListe('work', i, 'highlights', e.target.value.split('\n'))} /></label>
      </div>)}
      {([{ cle: 'projects', nom: 'Projets', champs: ['name', 'description', 'url'] }, { cle: 'certificates', nom: 'Certifications', champs: ['name', 'issuer', 'date', 'url'] }, { cle: 'volunteer', nom: 'Bénévolat', champs: ['organization', 'position', 'summary', 'url'] }] as const).map((section) => <section key={section.cle}>
        <h4>{section.nom}</h4>{liste(doc[section.cle]).map((item, i) => <div className="upgrade-bloc" key={i}>{section.champs.map((k) => <label key={k}>{({ name: 'Intitulé', description: 'Description', url: 'Lien https://…', issuer: 'Organisme', date: 'Date', organization: 'Organisation', position: 'Rôle', summary: 'Résumé' } as Record<string, string>)[k]}
          <input maxLength={2000} value={texte(item[k])} onChange={(e) => changeListe(section.cle, i, k, e.target.value)} /></label>)}
          <button className="btn-mini" onClick={() => setDoc({ ...doc, [section.cle]: liste(doc[section.cle]).filter((_, j) => j !== i) })}>Retirer cette rubrique</button></div>)}
        <button className="btn-mini" disabled={liste(doc[section.cle]).length >= 20} onClick={() => ajoute(section.cle, { name: '', ...(section.cle === 'volunteer' ? { organization: '' } : {}) })}>Ajouter — {section.nom}</button>
      </section>)}
      <h4>Portfolio et profils professionnels</h4>
      {liste(basics.profiles).map((item, i) => <div className="upgrade-rangee" key={i}>
        {['network', 'url'].map((k) => <label key={k}>{k === 'network' ? 'Nom du site' : 'Lien'}<input maxLength={500} value={texte(item[k])} onChange={(e) => changeBasic('profiles', liste(basics.profiles).map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} /></label>)}
        <button className="btn-mini" onClick={() => changeBasic('profiles', liste(basics.profiles).filter((_, j) => j !== i))}>Retirer le lien</button>
      </div>)}
      <button className="btn-mini" disabled={liste(basics.profiles).length >= 12} onClick={() => changeBasic('profiles', [...liste(basics.profiles), { network: '', url: '' }])}>Ajouter un lien professionnel</button>
      <p role="status">{modifie ? "Modifications non envoyées : un brouillon est gardé dans cet onglet lorsque le stockage est disponible." : "Aucune modification en attente dans ces rubriques."}</p><p>Enregistre avec ce bouton :</p>
      <button className="btn primaire" onClick={() => void enregistre()}>{envoi ? 'Enregistrement…' : 'Enregistrer les rubriques détaillées'}</button>
    </fieldset>}
    {message && <p role="status">{message}</p>}
  </details>
}

import { useEffect, useRef, useState } from 'react'
import type { Offre } from '../types'
import type { Adequation } from '../api'
import type { Filtres } from '../filtres'
import { choixPersistes, ecritLocal, lienOffre, litLocal, limiteComparaison } from '../upgrade'
import type { RepereOffre, VueOffres, TriOffres } from '../upgrade'

export function useLocal<T>(cle: string, initial: T) {
  const [valeur, pose] = useState<T>(() => litLocal(cle, initial))
  const [erreur, setErreur] = useState(false)
  const courant = useRef(valeur); courant.current = valeur
  const change = (v: T | ((ancien: T) => T)) => {
    const suivant = typeof v === 'function' ? (v as (ancien: T) => T)(courant.current) : v
    courant.current = suivant; pose(suivant); setErreur(!ecritLocal(cle, suivant))
  }
  return [valeur, change, erreur] as const
}

export function CommandesOffres({ vue, tri, changeVue, changeTri, filtres, changeFiltres }: {
  vue: VueOffres; tri: TriOffres; changeVue: (v: VueOffres) => void; changeTri: (v: TriOffres) => void
  filtres: Filtres; changeFiltres: (v: Filtres) => void
}) {
  const [recherches, setRecherches, erreur] = useLocal<{ nom: string; filtres: Filtres; tri: TriOffres }[]>('recherches', [])
  const [nom, setNom] = useState('')
  return <section className="upgrade-commandes" aria-label="Présentation des offres">
    <div className="upgrade-rangee">
      <label>Affichage <select value={vue} onChange={(e) => changeVue(e.target.value as VueOffres)}>
        <option value="cartes">Cartes</option><option value="liste">Liste</option><option value="tableau">Tableau</option>
      </select></label>
      <label>Trier par <select value={tri} onChange={(e) => changeTri(e.target.value as TriOffres)}>
        <option value="cloture">Clôture la plus proche</option><option value="publication">Publication récente</option><option value="titre">Titre</option><option value="adequation">Adéquation disponible</option>
      </select></label>
    </div>
    <details><summary>Mes recherches dans ce navigateur</summary>
      <div className="upgrade-rangee"><input aria-label="Nom de la recherche" maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Informatique à Nouméa" />
        <button className="btn-mini" disabled={!nom.trim() || recherches.length >= 12} onClick={() => { setRecherches([...recherches, { nom: nom.trim(), filtres, tri }]); setNom('') }}>Mémoriser la recherche</button></div>
      {recherches.map((r, i) => <div className="upgrade-rangee" key={`${r.nom}-${i}`}>
        <button className="btn-mini" onClick={() => { changeFiltres(r.filtres); changeTri(choixPersistes({ tri: r.tri }).tri) }}>{r.nom}</button>
        <button className="btn-mini" aria-label={`Supprimer la recherche ${r.nom}`} onClick={() => setRecherches(recherches.filter((_, j) => j !== i))}>Supprimer</button>
      </div>)}
      {erreur && <p role="alert">Le stockage est indisponible : les changements resteront seulement dans cette page.</p>}
      <p className="pa">12 recherches maximum. Aucun envoi au serveur, aucune synchronisation entre appareils.</p>
    </details>
  </section>
}

export function ReperesOffre({ offre: o }: { offre: Offre }) {
  const repere = litLocal<RepereOffre>(`offre.${o.id}`, { note: '', etiquettes: '' })
  const publication = o.datePublication ? Date.parse(o.datePublication) : NaN
  const recente = Number.isFinite(publication) && publication <= Date.now() && Date.now() - publication < 7 * 86400_000
  return <span className="upgrade-reperes">
    {o.statut === 'close' ? <span>Archive</span> : o.joursRestants === 0 ? <span>Clôture aujourd’hui</span> : o.joursRestants !== null && o.joursRestants <= 7 ? <span>Clôture proche</span> : null}
    {recente && <span>Publication récente</span>}{repere.visite && <span>Déjà consultée</span>}{repere.note && <span>Note personnelle</span>}
  </span>
}

export function CarnetOffre({ offre: o }: { offre: Offre }) {
  const [repere, setRepere, erreur] = useLocal<RepereOffre>(`offre.${o.id}`, { note: '', etiquettes: '' })
  const [copie, setCopie] = useState(false)
  useEffect(() => { if (!repere.visite) setRepere({ ...repere, visite: true }) }, [])
  return <details className="upgrade-carnet"><summary>Partager et ajouter mes repères</summary>
    <label>Lien de cette offre <input readOnly value={lienOffre(o.id)} onFocus={(e) => e.target.select()} /></label>
    <button className="btn-mini" onClick={() => { void navigator.clipboard?.writeText(lienOffre(o.id)).then(() => setCopie(true)).catch(() => setCopie(false)) }}>{copie ? 'Lien copié' : 'Copier le lien'}</button>
    <label>Note personnelle <textarea maxLength={3000} rows={3} value={repere.note} onChange={(e) => setRepere({ ...repere, note: e.target.value })} /></label>
    <label>Étiquettes personnelles <input maxLength={120} value={repere.etiquettes} placeholder="priorité, à relire…" onChange={(e) => setRepere({ ...repere, etiquettes: e.target.value })} /></label>
    <p className="pa">Notes et étiquettes gardées dans ce navigateur uniquement. Le lien partagé ne les contient pas.</p>
    {erreur && <p role="alert">Ces repères ne peuvent pas être conservés après fermeture de cette page.</p>}
  </details>
}

export function ListeOffres({ offres, scores, tableau, ouvrir, comparer, selection }: {
  offres: Offre[]; scores: Map<string, Adequation>; tableau: boolean; ouvrir: (o: Offre) => void; comparer: (id: number) => void; selection: number[]
}) {
  const contenu = (o: Offre) => <><button className="btn-mini" onClick={() => ouvrir(o)}>Lire l’offre</button>
    <button className="btn-mini" disabled={selection.length >= 3 && !selection.includes(o.id)} aria-pressed={selection.includes(o.id)} onClick={() => comparer(o.id)}>{selection.includes(o.id) ? 'Retirer du comparateur' : 'Comparer'}</button></>
  if (tableau) return <div className="upgrade-tableau" tabIndex={0} role="region" aria-label="Tableau des offres, défilement horizontal possible"><table><caption>Offres correspondant aux filtres</caption><thead><tr><th scope="col">Poste</th><th scope="col">Lieu</th><th scope="col">Contrat</th><th scope="col">Clôture</th><th scope="col">Adéquation</th><th scope="col">Actions</th></tr></thead>
    <tbody>{offres.map((o) => <tr key={o.id}><th scope="row">{o.titre}<ReperesOffre offre={o} /></th><td>{o.ville ?? 'Non renseigné'}</td><td>{o.contrat}</td><td>{o.expire?.slice(0, 10) ?? 'Non renseignée'}</td><td>{scores.get(o.reference ?? '')?.pourcentage !== undefined ? `${scores.get(o.reference ?? '')!.pourcentage} %` : 'Indisponible'}</td><td>{contenu(o)}</td></tr>)}</tbody></table></div>
  return <div className="upgrade-liste">{offres.map((o) => <article key={o.id}><h3>{o.titre}</h3><p>{o.ville ?? o.zone} · {o.contrat} · {o.reference}</p><ReperesOffre offre={o} /><p>{o.description?.slice(0, 220)}</p><div className="upgrade-rangee">{contenu(o)}</div></article>)}</div>
}

export function Comparateur({ offres, scores, selection, change }: { offres: Offre[]; scores: Map<string, Adequation>; selection: number[]; change: (s: number[]) => void }) {
  const choisies = selection.map((id) => offres.find((o) => o.id === id)).filter((o): o is Offre => Boolean(o))
  if (!choisies.length) return null
  return <details className="upgrade-comparateur" open><summary>Comparer {choisies.length} offre(s), maximum 3</summary>
    <div className="upgrade-tableau" tabIndex={0} role="region" aria-label="Comparaison des offres"><table><caption>Comparaison à partir des données disponibles</caption><thead><tr><th scope="col">Critère</th>{choisies.map((o) => <th scope="col" key={o.id}>{o.titre}<button className="btn-mini" onClick={() => change(limiteComparaison(selection, o.id))}>Retirer</button></th>)}</tr></thead><tbody>
      {(['Lieu', 'Contrat', 'Clôture', 'Missions', 'Compétences', 'Qualifications', 'Adéquation'] as const).map((critere) => <tr key={critere}><th scope="row">{critere}</th>{choisies.map((o) => <td key={o.id}>{critere === 'Lieu' ? o.ville ?? 'Non renseigné' : critere === 'Contrat' ? o.contrat : critere === 'Clôture' ? o.expire?.slice(0, 10) ?? 'Non renseignée' : critere === 'Missions' ? o.responsabilites.join(' · ') || 'Non renseignées' : critere === 'Compétences' ? o.competencesTexte.map((c) => c.texte).join(' · ') || 'Non renseignées' : critere === 'Qualifications' ? o.qualifications ?? 'Non renseignées' : scores.has(o.reference ?? '') ? `${scores.get(o.reference!)!.pourcentage} %` : 'Indisponible'}</td>)}</tr>)}
    </tbody></table></div><p className="pa">Le comparateur affiche les résultats existants ; il ne calcule aucun score.</p>
  </details>
}

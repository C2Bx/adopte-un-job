import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Offre } from '../types'
import { resultats } from '../filtres'
import { idOffrePartagee, limiteComparaison, trieOffres } from '../upgrade'
import type { TriOffres } from '../upgrade'
import { Detail, Feuille } from './Deck'
import { ListeOffres, Comparateur } from './OutilsOffres'

export default function CataloguePublic({ retour }: { retour: () => void }) {
  const [offres, setOffres] = useState<Offre[] | null>(null)
  const [erreur, setErreur] = useState('')
  const [q, setQ] = useState(''); const [tri, setTri] = useState<TriOffres>('cloture')
  const [detail, setDetail] = useState<Offre | null>(null); const [selection, setSelection] = useState<number[]>([])
  const scores = useMemo(() => new Map(), [])
  const charge = () => {
    setErreur(''); setOffres(null)
    void api.offresPubliques().then((l) => {
      setOffres(l); const id = idOffrePartagee()
      if (id !== null) { const o = l.find((x) => x.id === id); if (o) setDetail(o); else setErreur('L’offre partagée n’est plus disponible.') }
    }).catch(() => setErreur('Les offres sont indisponibles. Tu peux réessayer.'))
  }
  useEffect(charge, [])
  const visibles = trieOffres(resultats((offres ?? []).filter((o) => o.statut !== 'close'), { q }), tri)
  return <main className="upgrade-public"><h1>Les offres à découvrir</h1>
    <p>Consultation sans compte. Connecte-toi pour utiliser ton profil et candidater.</p>
    <button className="btn primaire" onClick={retour}>Connexion / inscription</button>
    <div className="upgrade-rangee"><label>Rechercher <input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label>Trier <select value={tri} onChange={(e) => setTri(e.target.value as TriOffres)}><option value="cloture">Clôture</option><option value="publication">Publication</option><option value="titre">Titre</option></select></label></div>
    {erreur && <p role="alert">{erreur} <button className="btn-mini" onClick={charge}>Réessayer</button></p>}
    {!erreur && offres === null && <p role="status">Chargement des offres…</p>}
    {offres && <><p aria-live="polite">{visibles.length} offre(s) ouverte(s)</p><Comparateur offres={offres} scores={scores} selection={selection} change={setSelection} />
      <ListeOffres offres={visibles} scores={scores} tableau={false} ouvrir={setDetail} selection={selection} comparer={(id) => setSelection(limiteComparaison(selection, id))} />
      {!visibles.length && <p>{q ? 'Aucune offre avec ces mots. Retire un terme ou efface la recherche.' : 'Aucune offre ouverte dans les données actuelles.'}</p>}</>}
    {detail && <Feuille onFermer={() => setDetail(null)}><Detail offre={detail} /><button className="btn" onClick={() => setDetail(null)}>Fermer</button></Feuille>}
  </main>
}

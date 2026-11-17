import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAdequations } from '../adequation'
import { useSelectionComparaison } from '../comparaison'
import { GROUPES_COMPARAISON, lignesComparaison, normaliseComparaison } from '../comparaisonCriteres'
import type { Offre } from '../types'
import { Detail, Feuille } from './Deck'

function Valeurs({ valeurs, communs }: { valeurs: string[]; communs: Set<string> }) {
  if (!valeurs.length) return <span className="comparaison-absent">Non renseigné</span>
  const liste = (partie: string[]) => <ul className="comparaison-valeurs">{partie.map((v) => <li key={v} className={communs.has(normaliseComparaison(v)) ? 'en-commun' : undefined}>{v}{communs.has(normaliseComparaison(v)) && <span className="comparaison-commun">En commun</span>}</li>)}</ul>
  return <>{liste(valeurs.slice(0, 3))}{valeurs.length > 3 && <details className="comparaison-suite"><summary>{valeurs.length - 3} autres éléments</summary>{liste(valeurs.slice(3))}</details>}</>
}

export function EcranComparaison({ versOffres }: { versOffres: () => void }) {
  const [selection, change] = useSelectionComparaison()
  const [offres, setOffres] = useState<Offre[] | null>(null)
  const [erreur, setErreur] = useState(false)
  const [detail, setDetail] = useState<Offre | null>(null)
  const [mode, setMode] = useState('tous')
  const [groupe, setGroupe] = useState('tous')
  const scores = useAdequations(null)
  const [generation, recharge] = useState(0)
  const presente = selection.length > 0
  useEffect(() => {
    if (!presente) return
    let vivant = true
    setErreur(false)
    void api.offresDisponibles().then((l) => { if (vivant) setOffres(l) }).catch(() => { if (vivant) setErreur(true) })
    return () => { vivant = false }
  }, [presente, generation])
  const choisies = selection.map((id) => offres?.find((o) => o.id === id))
  const lignes = lignesComparaison(choisies, scores)
  const comparables = lignes.filter((l) => l.comparable).length
  const ecarts = lignes.filter((l) => l.different).length
  const visibles = lignes.filter((l) => (groupe === 'tous' || l.groupe === groupe) && (mode === 'tous' || (mode === 'ecarts' ? l.different : l.comparable)))
  const retire = (id: number) => change((avant) => avant.filter((n) => n !== id))
  const reinitialise = () => { setMode('tous'); setGroupe('tous') }
  const actions = (id: number, i: number) => <div>{choisies[i] && <button type="button" className="btn-mini" onClick={() => setDetail(choisies[i]!)} aria-label={`Lire ${choisies[i]!.titre}`}>Lire l’offre</button>}<button type="button" className="btn-mini" onClick={() => retire(id)} aria-label={`Retirer ${choisies[i]?.titre ?? id} de la comparaison`}>Retirer</button></div>
  return <section className="screen comparaison-screen comparaison-refonte" id="ec-comparaison">
    <header className="comparaison-entete"><div><h1>Comparaison</h1></div>
      <div className="comparaison-outils"><button type="button" className="btn-mini" onClick={versOffres}>{selection.length === 3 ? 'Changer les offres' : selection.length ? 'Ajouter' : 'Choisir des offres'}</button>{selection.length > 0 && <button type="button" className="btn-mini" onClick={() => change([])} aria-label="Vider la sélection">Vider</button>}</div>
    </header>
    {!selection.length ? <div className="comparaison-vide"><span className="comparaison-vide-icone" aria-hidden="true">⇄</span><h2>Deux offres, une vue claire</h2><p>Ajoute jusqu’à trois offres avec le bouton Comparer. Lieu, contrat, missions et profil attendu seront regroupés ici.</p><button type="button" className="btn primaire" onClick={versOffres}>Parcourir les offres</button></div>
    : erreur ? <div className="pal manque" role="alert">Les offres n’ont pas pu être chargées. <button className="btn-mini" onClick={() => recharge(generation + 1)}>Réessayer</button></div>
    : !offres ? <p role="status">Chargement de la comparaison…</p>
    : <>
      <div className="comparaison-commandes">
      <div className="comparaison-bilan" role="status"><span><b>{selection.length}<small>/ 3</small></b> offres sélectionnées</span><span><b>{comparables}</b> critères comparables</span><span><b>{ecarts}</b> avec des écarts</span></div>
      {selection.length === 1 && <p className="comparaison-conseil">Ajoute une deuxième offre pour faire ressortir les points communs et les différences.</p>}
      <div className="comparaison-filtres">
        <div className="comparaison-modes" role="group" aria-label="Critères à afficher">{[['tous', 'Tout voir'], ['ecarts', 'Les écarts'], ['comparables', 'Comparables']].map(([cle, nom]) => <button type="button" key={cle} aria-pressed={mode === cle} onClick={() => setMode(cle!)}>{nom}</button>)}</div>
        <select className="comparaison-mode-mobile" aria-label="Critères à afficher" value={mode} onChange={(e) => setMode(e.target.value)}><option value="tous">Tous les critères</option><option value="ecarts">Les écarts</option><option value="comparables">Comparables</option></select>
        <label><span>Rubrique</span> <select value={groupe} onChange={(e) => setGroupe(e.target.value)}><option value="tous">Toutes les rubriques</option>{GROUPES_COMPARAISON.map((g) => <option key={g}>{g}</option>)}</select></label>
      </div>
      </div>
      <details className="comparaison-gestion"><summary>Gérer les {selection.length} offres sélectionnées</summary><div>{selection.map((id, i) => <article key={id}><span className={`comparaison-numero offre-${i}`}>{i + 1}</span><strong>{choisies[i]?.titre ?? 'Offre indisponible'}</strong>{actions(id, i)}</article>)}</div></details>
      <div className="comparaison-table" tabIndex={0} role="region" aria-label="Critères et offres comparés"><table style={{ minWidth: 150 + selection.length * 190 }}><caption>Points communs, écarts et informations absentes des offres sélectionnées</caption><thead><tr><th scope="col">Les critères<span className="comparaison-compte">{visibles.length} affichés / {lignes.length}</span></th>{selection.map((id, i) => <th scope="col" key={id}><div className="comparaison-poste"><div className="comparaison-poste-entete"><span className={`comparaison-numero offre-${i}`}>Offre {i + 1}</span><button type="button" className="comparaison-retirer" onClick={() => retire(id)} aria-label={`Retirer ${choisies[i]?.titre ?? id} de la comparaison`} title="Retirer cette offre">×</button></div>{choisies[i] ? <button type="button" className="comparaison-lire" title={choisies[i]!.titre} onClick={() => setDetail(choisies[i]!)} aria-label={`Lire ${choisies[i]!.titre}`}>{choisies[i]!.titre}</button> : <strong>Offre indisponible</strong>}</div></th>)}</tr></thead><tbody>
        {visibles.map((l) => <tr key={l.cle} data-critere={l.cle} className={l.different ? 'comparaison-ecart' : undefined}><th scope="row"><span className="comparaison-rubrique">{l.groupe}</span><strong>{l.titre}</strong><span className={`comparaison-etat ${l.different ? 'etat-ecart' : l.comparable ? 'etat-commun' : 'etat-incomplet'}`}>{l.etat}</span></th>{selection.map((id, i) => <td key={id} data-offre={`Offre ${i + 1} · ${choisies[i]?.titre ?? 'indisponible'}`}>{!choisies[i] ? <span className="comparaison-absent">Offre indisponible</span> : <Valeurs valeurs={l.valeurs[i]!} communs={l.communs} />}</td>)}</tr>)}
        {!visibles.length && <tr className="comparaison-sans-resultat"><td colSpan={selection.length + 1}><strong>{mode === 'ecarts' ? 'Aucun écart renseigné dans cette vue' : 'Aucun critère dans cette vue'}</strong><p>{comparables ? 'Essaie une autre rubrique ou affiche tous les critères.' : 'Il faut au moins deux offres avec des informations renseignées pour les comparer.'}</p><button type="button" className="btn-mini" onClick={reinitialise}>Tout afficher</button></td></tr>}
      </tbody></table></div>
      <details className="comparaison-aide"><summary>Comprendre les repères et les limites</summary><p className="comparaison-legende">Les valeurs partagées par au moins deux offres sont repérées. Une absence n’est pas un écart.</p><p className="comparaison-note">Les écarts portent sur les valeurs renseignées, sans classement de la meilleure offre. L’adéquation disponible vient de CV-Matching. La sélection reste dans ce navigateur par compte.</p></details>
    </>}
    {detail && <Feuille titre="Détail de l’offre comparée" onFermer={() => setDetail(null)}><Detail offre={detail} /></Feuille>}
  </section>
}

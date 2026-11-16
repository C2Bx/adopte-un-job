import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAdequations } from '../adequation'
import { useSelectionComparaison } from '../comparaison'
import type { Offre } from '../types'
import { Detail, Feuille } from './Deck'

export function EcranComparaison({ versOffres }: { versOffres: () => void }) {
  const [selection, change] = useSelectionComparaison()
  const [offres, setOffres] = useState<Offre[] | null>(null)
  const [erreur, setErreur] = useState(false)
  const [detail, setDetail] = useState<Offre | null>(null)
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
  const retire = (id: number) => change((avant) => avant.filter((n) => n !== id))
  return <section className="screen comparaison-screen" id="ec-comparaison">
    <header className="comparaison-entete"><div><h1>Comparaison</h1><p>Jusqu’à trois offres, côte à côte, sur toute la page.</p></div>
      <div className="comparaison-outils"><button type="button" className="btn-mini" onClick={versOffres}>Choisir des offres</button>{selection.length > 0 && <button type="button" className="btn-mini" onClick={() => change([])}>Vider la sélection</button>}</div>
    </header>
    {!selection.length ? <div className="comparaison-vide"><h2>Quelles offres veux-tu comparer ?</h2><p>Dans Offres, utilise le bouton Comparer sur deux ou trois cartes, lignes ou lignes du tableau.</p><button type="button" className="btn primaire" onClick={versOffres}>Parcourir les offres</button></div>
    : erreur ? <div className="pal manque" role="alert">Les offres n’ont pas pu être chargées. <button className="btn-mini" onClick={() => recharge(generation + 1)}>Réessayer</button></div>
    : !offres ? <p role="status">Chargement de la comparaison…</p>
    : <><p className="comparaison-indication">{selection.length} / 3 offres sélectionnées. {selection.length < 2 ? 'Ajoute une deuxième offre pour les comparer.' : 'Les données manquantes restent indiquées.'}<span className="comparaison-indication-large">Les colonnes restent lisibles sur toute la largeur disponible.</span><span className="comparaison-indication-mobile">Sur mobile, les offres sont regroupées par critère pour éviter le défilement horizontal.</span></p>
      <details className="comparaison-gestion"><summary>Gérer les {selection.length} offres sélectionnées</summary><div>{selection.map((id, i) => <article key={id}><strong>{choisies[i]?.titre ?? 'Offre indisponible'}</strong><div>{choisies[i] && <button className="btn-mini" onClick={() => setDetail(choisies[i]!)}>Lire l’offre</button>}<button className="btn-mini" onClick={() => retire(id)}>Retirer</button></div></article>)}</div></details>
      <div className="comparaison-table" tabIndex={0} role="region" aria-label="Offres comparées, défilement horizontal possible"><table style={{ minWidth: 140 + selection.length * 260 }}><caption>Comparer les informations des offres sélectionnées</caption><thead><tr><th scope="col">Critère</th>{selection.map((id, i) => <th scope="col" key={id}><div className="comparaison-poste"><strong>{choisies[i]?.titre ?? 'Offre indisponible'}</strong><div>{choisies[i] && <button type="button" className="btn-mini" onClick={() => setDetail(choisies[i]!)}>Lire l’offre</button>}<button type="button" className="btn-mini" onClick={() => retire(id)} aria-label={`Retirer ${choisies[i]?.titre ?? id} de la comparaison`}>Retirer</button></div></div></th>)}</tr></thead><tbody>
        {['Lieu', 'Contrat', 'Clôture', 'Missions', 'Compétences', 'Qualifications', 'Adéquation'].map((critere) => <tr key={critere}><th scope="row">{critere}</th>{selection.map((id, i) => { const o = choisies[i]; const score = o?.reference ? scores.get(o.reference) : undefined; return <td key={id} data-offre={o?.titre ?? 'Offre indisponible'}>{!o ? 'Non disponible' : critere === 'Lieu' ? o.ville ?? o.zone : critere === 'Contrat' ? o.contrat : critere === 'Clôture' ? o.expire?.slice(0, 10) ?? 'Non renseignée' : critere === 'Missions' ? o.responsabilites.length ? <ul>{o.responsabilites.map((m, k) => <li key={k}>{m}</li>)}</ul> : 'Non renseignées' : critere === 'Compétences' ? o.competencesTexte.length ? <ul>{o.competencesTexte.map((c, k) => <li key={k}>{c.texte}</li>)}</ul> : 'Non renseignées' : critere === 'Qualifications' ? o.qualifications || 'Non renseignées' : score?.pourcentage !== undefined ? `${score.pourcentage} %` : 'Indisponible'}</td> })}</tr>)}
      </tbody></table></div><p className="comparaison-note">La comparaison affiche les données existantes. Elle ne calcule aucun score. La sélection est gardée dans ce navigateur par compte.</p>
    </>}
    {detail && <Feuille titre="Détail de l’offre comparée" onFermer={() => setDetail(null)}><Detail offre={detail} /></Feuille>}
  </section>
}

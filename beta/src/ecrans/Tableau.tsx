/* Le tableau de bord de l'organisation. Tout est calculé par le serveur sur
   toutes les lignes ; l'écran n'additionne rien. Chaque indicateur porte sa
   définition, lisible au survol ou au toucher : un chiffre qu'on ne sait pas
   lire n'est pas un indicateur. Le même tableau existe par offre. */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { ErreurApi } from '../types'
import type { Tableau } from '../types'
import { Anneau, Barres, Courbe, Entonnoir } from './Graphiques'

const PERIODES = [7, 30, 90, 365]
const NIVEAUX: Record<string, string> = { '0': 'non renseigné', '1': 'Bac', '2': 'Bac+2', '3': 'Bac+3', '4': 'Bac+5' }

export function EcranTableau({ onOffre }: { onOffre?: (id: number) => void }) {
  const [periode, setPeriode] = useState(30)
  const [offre, setOffre] = useState<number | undefined>(undefined)
  const [t, setT] = useState<Tableau | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [definition, setDefinition] = useState<string | null>(null)

  const charge = useCallback(async () => {
    setErreur(null)
    try {
      setT((await api.tableau(periode, offre)).tableau)
    } catch (e) {
      setT(null)
      setErreur(e instanceof ErreurApi ? e.message : 'Tableau indisponible.')
    }
  }, [periode, offre])
  useEffect(() => { void charge() }, [charge])

  const ind = (cle: string) => t?.indicateurs.find((i) => i.cle === cle)
  const val = (cle: string) => {
    const i = ind(cle)
    if (!i || i.valeur === null) return '—'
    return `${i.valeur}${i.unite ? ` ${i.unite}` : ''}`
  }

  return (
    <div className="screen" id="ec-tableau">
      <div className="pad tableau">
        <div className="tb-tete">
          <div>
            <h2>Tableau de bord{offre && t ? ` — ${t.offres.find((o) => o.id === offre)?.titre ?? 'offre'}` : ''}</h2>
            <p className="lead">
              {offre ? 'Une seule offre. ' : 'Toute l’organisation, tous les membres. '}
              Les chiffres portent sur les {periode} derniers jours ; l’état des candidatures est celui d’aujourd’hui.
            </p>
          </div>
          <div className="tb-outils">
            <div className="seg" role="tablist">
              {PERIODES.map((p) => (
                <button key={p} role="tab" aria-selected={periode === p} onClick={() => setPeriode(p)}>{p} j</button>
              ))}
            </div>
            {offre && <button className="btn-mini" onClick={() => setOffre(undefined)}>← Toute l’organisation</button>}
            <a className="btn-mini" href={api.urlTableauCsv(periode)}>Export CSV</a>
          </div>
        </div>

        {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}
        {!t && !erreur && <p className="pa">Calcul…</p>}

        {t && (
          <>
            <div className="kpis">
              {t.indicateurs.map((i) => (
                <button type="button" className={`kpi${definition === i.cle ? ' on' : ''}`} key={i.cle}
                  onClick={() => setDefinition(definition === i.cle ? null : i.cle)} title={i.definition}>
                  <span className="lib">{i.libelle}</span>
                  <span className="val">{i.valeur === null ? '—' : i.valeur}{i.valeur !== null && i.unite ? <small>{i.unite}</small> : null}</span>
                  {i.detail && <span className="det">{i.detail}</span>}
                </button>
              ))}
            </div>
            {definition && <div className="pal info"><b>{ind(definition)?.libelle}</b>{ind(definition)?.definition}</div>}

            <div className="tb-grille">
              <section className="tb-bloc large">
                <h3>Au fil des jours</h3>
                <div className="legende">
                  <i style={{ background: 'var(--brand)' }} /> vues
                  <i style={{ background: 'var(--accent)' }} /> candidatures
                  <i style={{ background: 'var(--yes)' }} /> présélections
                  <i style={{ background: 'var(--no)' }} /> refus
                </div>
                <Courbe series={[
                  { nom: 'vues', points: t.series.vues, teinte: 'var(--brand)' },
                  { nom: 'candidatures', points: t.series.candidatures, teinte: 'var(--accent)' },
                  { nom: 'présélections', points: t.series.matchs, teinte: 'var(--yes)' },
                  { nom: 'refus', points: t.series.refus, teinte: 'var(--no)' },
                ]} />
              </section>

              <section className="tb-bloc">
                <h3>De la vue à l’embauche</h3>
                <Entonnoir etapes={t.entonnoir} />
              </section>

              <section className="tb-bloc">
                <h3>Candidatures par état</h3>
                <Anneau parts={[
                  { nom: 'à traiter', n: t.parStatut.envoyee + t.parStatut.vue, teinte: 'var(--accent)' },
                  { nom: 'présélection', n: t.parStatut.preselection, teinte: 'var(--brand)' },
                  { nom: 'entretien', n: t.parStatut.entretien, teinte: 'var(--yes)' },
                  { nom: 'acceptées', n: t.parStatut.acceptee, teinte: 'var(--ink-3)' },
                  { nom: 'refusées', n: t.parStatut.refusee, teinte: 'var(--no)' },
                  { nom: 'retirées', n: t.parStatut.retiree, teinte: 'var(--line)' },
                ]} />
              </section>

              <section className="tb-bloc">
                <h3>Compétences qui manquent le plus</h3>
                <p className="pa">Chez les candidats de la période, face au métier de chaque offre.</p>
                <Barres donnees={t.competences.manquantes} teinte="var(--no)" />
              </section>

              <section className="tb-bloc">
                <h3>Compétences les plus présentes</h3>
                <Barres donnees={t.competences.presentes} teinte="var(--yes)" />
              </section>

              <section className="tb-bloc">
                <h3>Candidats par zone</h3>
                <Barres donnees={t.repartitions.zones} />
              </section>
              <section className="tb-bloc">
                <h3>Par niveau de formation</h3>
                <Barres donnees={t.repartitions.niveaux.map((x) => ({ valeur: NIVEAUX[x.valeur] ?? x.valeur, n: x.n }))} teinte="var(--accent)" />
              </section>
              <section className="tb-bloc">
                <h3>Par expérience</h3>
                <Barres donnees={t.repartitions.experience} teinte="var(--accent)" />
              </section>
              <section className="tb-bloc">
                <h3>Métiers visés par les candidats</h3>
                <Barres donnees={t.repartitions.metiers} />
              </section>
              <section className="tb-bloc">
                <h3>D’où viennent les vues</h3>
                <Barres donnees={t.repartitions.sourcesVues} teinte="var(--ink-3)" />
              </section>
              {t.equipe.length > 0 && (
                <section className="tb-bloc">
                  <h3>Décisions par membre</h3>
                  <Barres donnees={t.equipe} teinte="var(--brand)" />
                </section>
              )}
            </div>

            {!offre && (
              <section className="tb-bloc large">
                <h3>Par offre</h3>
                <div className="tablewrap">
                  <table className="tb-table">
                    <thead>
                      <tr>
                        <th>Offre</th><th>État</th><th>Vues</th><th>Candid.</th><th>À traiter</th><th>Présél.</th>
                        <th>Entretiens</th><th>Refus</th><th>Écartée</th><th>Score moy.</th><th>Conv.</th><th>Reste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.offres.map((o) => (
                        <tr key={o.id} className={o.statut !== 'publiee' ? 'close' : ''}>
                          <td>
                            <button type="button" className="lien" onClick={() => setOffre(o.id)}>{o.titre}</button>
                            <small>{o.source === 'opt' ? 'AVP OPT-NC' : 'offre interne'}{o.ville ? ` · ${o.ville}` : ''}</small>
                          </td>
                          <td>{o.statut === 'publiee' ? 'ouverte' : 'close'}</td>
                          <td>{o.vues}</td>
                          <td><b>{o.candidatures}</b></td>
                          <td>{o.enAttente ? <b style={{ color: 'var(--accent)' }}>{o.enAttente}</b> : 0}</td>
                          <td>{o.matchs}</td>
                          <td>{o.entretiens}</td>
                          <td>{o.refus}</td>
                          <td>{o.ecartee}</td>
                          <td>{o.scoreMoyen === null ? '—' : `${o.scoreMoyen} %`}</td>
                          <td>{o.tauxConversion === null ? '—' : `${o.tauxConversion} %`}</td>
                          <td>{o.joursRestants === null ? '—' : o.joursRestants < 0 ? 'expirée' : `${o.joursRestants} j`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {onOffre && <p className="pa">Cliquer une offre restreint tout le tableau à celle-ci.</p>}
              </section>
            )}

            <p className="pa">Généré le {t.genere} UTC · {val('vues')} vues sur {periode} jours.</p>
          </>
        )}
      </div>
    </div>
  )
}

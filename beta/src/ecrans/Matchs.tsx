/* Mes candidatures.

   Ce qu'on a décidé existe dès le premier glissé, réponse de l'employeur ou
   pas : c'est ça qu'il faut montrer, sans quoi la liste reste vide et l'écran
   passe pour cassé. */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { BlocEntete, BlocPoste, Detail, Feuille } from './Deck'
import { Attente } from '../Attente'
import { ErreurApi } from '../types'
import type { Interet, StatutCandidature, StatutEquipe } from '../types'

/* Ce que vaut chaque statut de candidature, dans les mots du candidat. */
const STATUTS: Record<StatutCandidature, { nom: string; classe: string }> = {
  envoyee: { nom: 'Candidature envoyée — pas encore ouverte', classe: 'attente' },
  vue: { nom: 'Candidature ouverte par l’organisation', classe: 'attente' },
  preselection: { nom: 'Présélectionné — ton contact et ton dossier sont transmis', classe: 'match' },
  entretien: { nom: 'Entretien proposé — l’organisation te contacte', classe: 'match' },
  acceptee: { nom: 'Candidature acceptée', classe: 'match' },
  refusee: { nom: 'Candidature non retenue', classe: 'refus' },
  retiree: { nom: 'Candidature retirée', classe: '' },
}

/* La décision du recruteur, lue dans l'API de l'équipe : elle passe avant le
   statut local, qui ne dit que ce que le candidat a fait. */
const DECISIONS: Record<StatutEquipe, { nom: string; classe: string }> = {
  EN_ATTENTE: { nom: 'Chez les recruteurs — en attente de réponse', classe: 'attente' },
  VALIDEE: { nom: 'Retenue par le recruteur', classe: 'match' },
  REJETEE: { nom: 'Non retenue par le recruteur', classe: 'refus' },
  ANNULEE: { nom: 'Candidature annulée', classe: '' },
}

type Onglet = 'oui' | 'plus_tard' | 'non'

const ONGLETS: { cle: Onglet; nom: string }[] = [
  { cle: 'oui', nom: 'Candidatures' },
  { cle: 'plus_tard', nom: 'Plus tard' },
  { cle: 'non', nom: 'Écartés' },
]

/* « Décidé il y a 20 min » se lit ; « 2026-09-08 21:14:02 » se déchiffre. Les
   dates de l'API sont en UTC, il faut le dire au navigateur. */
function depuis(quand: string): string {
  const t = Date.parse(`${quand.replace(' ', 'T')}Z`)
  if (Number.isNaN(t)) return 'date inconnue'
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  if (s < 172800) return 'hier'
  return `le ${new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}


/* Au-delà de 1100 px, le détail tient à côté de la liste : ouvrir une feuille
   par-dessus un écran à moitié vide n'a pas de sens. En dessous, la feuille
   reste le seul moyen de montrer autant de contenu. */
function useLarge(): boolean {
  const [large, setLarge] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1100px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)')
    const maj = () => setLarge(mq.matches)
    maj()                                   // l'état initial peut dater d'avant la mise en page
    mq.addEventListener('change', maj)
    // Et « resize » en plus : l'événement de media query ne part pas toujours,
    // notamment quand la fenêtre est redimensionnée par l'outil de test.
    window.addEventListener('resize', maj)
    return () => {
      mq.removeEventListener('change', maj)
      window.removeEventListener('resize', maj)
    }
  }, [])
  return large
}

export function EcranMatchs() {
  const [interets, setInterets] = useState<Interet[] | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('oui')
  const [detail, setDetail] = useState<Interet | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [synchro, setSynchro] = useState(true)
  const [mdp, setMdp] = useState('')
  const [reco, setReco] = useState(false)
  const large = useLarge()

  const charge = useCallback(async () => {
    try {
      const d = await api.interetsSynchro()
      setInterets(d.interets)
      setSynchro(d.equipeConnecte)
    } catch (e) {
      setInterets([])
      setErreur(e instanceof ErreurApi ? e.message : 'Liste indisponible.')
    }
  }, [])

  useEffect(() => { void charge() }, [charge])

  /* Une décision se revoit : on la remet dans le deck, ou on la change de
     colonne. Sans ça, la promesse « réversible » du chapô est un mensonge. */
  const reviens = async (x: Interet) => {
    try {
      await api.annuleSwipe(x.id)
      setInterets((l) => (l ?? []).filter((y) => y.id !== x.id))
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Impossible de remettre cette offre dans le deck.')
    }
  }

  const redecide = async (x: Interet, d: Onglet) => {
    try {
      const r = await api.swipe(x.id, d)
      setInterets((l) => (l ?? []).map((y) => (y.id === x.id ? { ...y, decision: d, candidature: r.candidature ?? y.candidature } : y)))
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'La décision n’a pas été enregistrée.')
    }
  }


  const liste = (interets ?? []).filter((x) => x.decision === onglet)
  const compte = (d: Onglet) => (interets ?? []).filter((x) => x.decision === d).length

  // Sur grand écran, une ligne est toujours détaillée : un panneau vide à côté
  // d'une liste pleine ressemble à une panne.
  const choisi = large ? (liste.find((x) => x.id === detail?.id) ?? liste[0] ?? null) : null

  return (
    <div className="screen" id="ec-interets">
      <div className="pad pad-i">
        <div className="col-liste">
        <h2>Mes candidatures</h2>
        <p className="lead">
          Un « oui » est une candidature : elle part chez les recruteurs avec ton profil, et leur
          réponse s’affiche ici. Ce que tu as écarté ou mis de côté reste ici, révocable.
        </p>

        {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}

        {!synchro && (interets ?? []).some((x) => x.candidature) && (
          <form className="pal" onSubmit={async (ev) => {
            ev.preventDefault()
            setReco(true)
            try {
              const r = await api.reconnexionEquipe(mdp)
              setMdp('')
              if (r.equipeConnecte) await charge()
            } catch (e) {
              setErreur(e instanceof ErreurApi ? e.message : 'La reconnexion a échoué.')
            } finally {
              setReco(false)
            }
          }}>
            <b>Réponses des recruteurs</b>
            Pour voir où en sont tes candidatures chez les recruteurs, confirme ton mot de passe
            (la liaison avec leur plateforme dure une heure).
            <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password"
                aria-label="Mot de passe" placeholder="mot de passe" required style={{ flex: 1 }} />
              <button className="btn-mini" disabled={reco || mdp === ''}>{reco ? '…' : 'Confirmer'}</button>
            </span>
          </form>
        )}

        <div className="seg" role="tablist">
          {ONGLETS.map((o) => (
            <button
              key={o.cle}
              role="tab"
              aria-selected={onglet === o.cle}
              onClick={() => setOnglet(o.cle)}
            >
              {o.nom}<span className="n">{compte(o.cle)}</span>
            </button>
          ))}
        </div>

        {interets === null && <Attente texte="Chargement…" />}

        {interets !== null && liste.length === 0 && (
          <div className="vide">
            <b>Rien ici</b>
            {onglet === 'oui'
              ? 'Tes candidatures apparaîtront ici, avec leur suite : ouverte, présélectionnée, entretien.'
              : onglet === 'plus_tard'
                ? 'Mettre de côté, c’est décider plus tard — pas décider non.'
                : 'Les offres passées restent consultables : une décision se revoit.'}
          </div>
        )}

        {liste.map((x) => {
          const j = x.joursRestants
          return (
            <article
              className={`item${x.statut === 'fermee' ? ' closed' : ''}${choisi?.id === x.id ? ' on' : ''}`}
              key={x.id}
              onClick={() => setDetail(x)}
            >
              {/* la colonne de gauche dit le temps qui reste avant la clôture */}
              <span className="sc" style={{ color: j === null || j < 0 ? 'var(--ink-3)' : j <= 3 ? 'var(--no)' : 'var(--ink)' }}>
                {j === null ? '—' : j < 0 ? '×' : j}
                <small>{j === null ? 'SANS DATE' : j < 0 ? 'CLOSE' : j === 1 ? 'JOUR' : 'JOURS'}</small>
              </span>
              <div>
                <h3>{x.titre}</h3>
                <div className="meta">{x.entreprise} · {x.zone} · {x.contrat}</div>
                <div className="quand">
                  Décidé {depuis(x.quand)}
                </div>
                {x.candidature && x.candidature.equipe && x.candidature.statut !== 'retiree'
                  ? <span className={`etat ${DECISIONS[x.candidature.equipe].classe}`}>{DECISIONS[x.candidature.equipe].nom}</span>
                  : x.candidature
                  ? <span className={`etat ${STATUTS[x.candidature.statut].classe}`}>{STATUTS[x.candidature.statut].nom}</span>
                  : x.decision === 'oui'
                    ? <span className="etat attente">Geste enregistré (offre close, entraînement)</span>
                    : null}
                <div className="actes" onClick={(e) => e.stopPropagation()}>
                  {/* Une candidature tranchée par un recruteur ne change plus (leur API répond 409). */}
                  {x.candidature && ['preselection', 'entretien', 'acceptee', 'refusee'].includes(x.candidature.statut)
                    ? null
                    : <>
                          <button className="fort" onClick={() => void reviens(x)}>{x.decision === 'oui' ? 'Annuler et remettre dans le deck' : 'Remettre dans le deck'}</button>
                          {ONGLETS.filter((o) => o.cle !== x.decision).map((o) => (
                            <button key={o.cle} onClick={() => void redecide(x, o.cle)}>
                              {o.cle === 'oui' ? (x.statut === 'publiee' ? 'Candidater' : 'M’entraîner') : o.cle === 'non' ? 'Écarter' : 'Plus tard'}
                            </button>
                          ))}
                        </>}
                </div>
              </div>
              <span className="chev" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            </article>
          )
        })}
        </div>

        {/* Le détail à côté de la liste, pas par-dessus. */}
        <aside className="side panneau" id="side-i">
          {choisi
            ? (
              <>
                <div className="col-p"><BlocEntete offre={choisi} /></div>
                <div className="col-p"><BlocPoste offre={choisi} /></div>
              </>
            )
            : <p className="vide-p">Choisis une offre à gauche pour voir son détail.</p>}
        </aside>
      </div>

      {detail && !large && (
        <Feuille onFermer={() => setDetail(null)}>
          <Detail offre={detail} />
          <div className="btns" style={{ marginTop: 'var(--s5)' }}>
            <button className="btn" onClick={() => setDetail(null)}>Fermer</button>
          </div>
        </Feuille>
      )}
    </div>
  )
}

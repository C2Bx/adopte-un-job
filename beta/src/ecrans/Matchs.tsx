/* Mes intérêts et les messages : la même matière, deux entrées.

   L'écran ne peut pas se contenter des matchs. Un match demande le oui des deux
   côtés : tant qu'aucune entreprise n'a répondu, la liste est vide et l'écran
   passe pour cassé. Ce qu'on a décidé, en revanche, existe dès le premier
   glissé — c'est ça qu'il faut montrer. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { BlocPoste, BlocPourquoi, BlocScore, Detail, Feuille } from './Deck'
import { dateLocale, formatHeure } from './Agenda'
import { ErreurApi } from '../types'
import type { Interet, MatchLigne, Message, Profil, StatutCandidature } from '../types'

/* Ce que vaut chaque statut de candidature, dans les mots du candidat. */
const STATUTS: Record<StatutCandidature, { nom: string; classe: string }> = {
  envoyee: { nom: 'Candidature envoyée — pas encore ouverte', classe: 'attente' },
  vue: { nom: 'Candidature ouverte par l’organisation', classe: 'attente' },
  preselection: { nom: 'Présélectionné — ton contact et ton dossier sont transmis', classe: 'match' },
  entretien: { nom: 'Entretien proposé — voir l’agenda', classe: 'match' },
  acceptee: { nom: 'Candidature acceptée', classe: 'match' },
  refusee: { nom: 'Candidature non retenue', classe: 'refus' },
  retiree: { nom: 'Candidature retirée', classe: '' },
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

/* Le serveur date en UTC ; on affiche l'heure locale, et le jour s'il n'est
   pas celui d'aujourd'hui. */
function heureMessage(utc: string): string {
  const d = dateLocale(utc)
  if (Number.isNaN(d.getTime())) return ''
  const h = formatHeure(d)
  return d.toDateString() === new Date().toDateString()
    ? h
    : `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${h}`
}

const teinte = (q: number) => (q >= 75 ? 'var(--yes)' : q >= 50 ? 'var(--accent)' : 'var(--no)')

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

export function EcranMatchs({ vue, profil }: { vue: 'interets' | 'messages'; profil: Profil }) {
  const [interets, setInterets] = useState<Interet[] | null>(null)
  const [matchs, setMatchs] = useState<MatchLigne[] | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('oui')
  const [ouvert, setOuvert] = useState<MatchLigne | null>(null)
  const [detail, setDetail] = useState<Interet | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const large = useLarge()

  // Les messages n'ont besoin que des matchs ; les intérêts n'existent que
  // pour un candidat (l'organisation n'a pas de deck).
  const charge = useCallback(async () => {
    try {
      if (vue === 'messages') {
        setMatchs(await api.matchs())
        setInterets([])
        return
      }
      const [i, m] = await Promise.all([api.interets(), api.matchs()])
      setInterets(i)
      setMatchs(m)
    } catch (e) {
      setInterets([])
      setMatchs([])
      setErreur(e instanceof ErreurApi ? e.message : 'Liste indisponible.')
    }
  }, [vue])

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

  /* Retirer une candidature déjà ouverte : elle reste dans la liste, avec son
     nouveau statut — l'organisation le voit aussi. */
  const retire = async (x: Interet) => {
    if (!x.candidature) return
    if (!window.confirm('Retirer cette candidature ? L’organisation en sera informée.')) return
    try {
      await api.statutCandidature(x.candidature.id, 'retiree')
      setInterets((l) => (l ?? []).map((y) => (y.id === x.id ? { ...y, candidature: { ...y.candidature!, statut: 'retiree' } } : y)))
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Le retrait n’a pas été enregistré.')
    }
  }

  if (ouvert) {
    return <Conversation match={ouvert} onRetour={() => { setOuvert(null); void charge() }} />
  }

  /* Messages : seuls les matchs ouvrent une conversation. On n'écrit pas à
     quelqu'un qui n'a pas dit oui. */
  if (vue === 'messages') {
    return (
      <div className="screen" id="ec-messages">
        <div className="pad">
          <h2>Messages</h2>
          <p className="lead">
            Une conversation s’ouvre à la présélection, jamais avant : le candidat a
            dit oui en candidatant, l’organisation dit oui en le présélectionnant.
          </p>
          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
          {matchs === null && <p className="pa">Chargement…</p>}
          {matchs?.length === 0 && (
            <div className="vide">
              <b>Aucune conversation</b>
              Il faut une candidature et une présélection pour ouvrir un fil.
            </div>
          )}
          {(matchs ?? []).map((m) => (
            <button className="item" key={m.id} onClick={() => setOuvert(m)}>
              <span className="sc">{m.qualite}<small>%</small></span>
              <span>
                <h3>{m.titre}</h3>
                <span className="meta">{m.entreprise ?? (m.prenom ? `${m.prenom} ${m.initiale ?? ''}`.trim() : `candidat #${m.candidate_id}`)}</span>
              </span>
              {m.non_lus > 0 && <span className="nonlus">{m.non_lus}</span>}
            </button>
          ))}
        </div>
      </div>
    )
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
          Un « oui » est une candidature : elle part anonyme, l’organisation ouvre ton contact et ton
          dossier si elle te présélectionne. Ce que tu as écarté ou mis de côté reste ici, révocable.
        </p>

        {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}

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

        {interets === null && <p className="pa">Chargement…</p>}

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
          const sc = x.score?.qualite ?? null
          return (
            <article
              className={`item${x.statut === 'fermee' ? ' closed' : ''}${choisi?.id === x.id ? ' on' : ''}`}
              key={x.id}
              onClick={() => setDetail(x)}
            >
              <span className="sc" style={{ color: sc === null ? 'var(--ink-3)' : teinte(sc) }}>
                {sc === null ? '—' : sc}
                <small>{sc === null ? 'SANS SCORE' : 'SUR 100'}</small>
              </span>
              <div>
                <h3>{x.titre}</h3>
                <div className="meta">{x.entreprise} · {x.zone} · {x.contrat}</div>
                <div className="quand">
                  Décidé {depuis(x.quand)}{sc === null ? '' : ` · score d’alors ${sc} %`}
                </div>
                {x.candidature
                  ? <span className={`etat ${STATUTS[x.candidature.statut].classe}`}>{STATUTS[x.candidature.statut].nom}</span>
                  : x.decision === 'oui'
                    ? <span className="etat attente">Geste enregistré (offre close, entraînement)</span>
                    : null}
                {x.score?.ecarts && x.score.ecarts.length > 0 && (
                  <span className="etat" style={{ color: 'var(--no)' }}>{x.score.ecarts.length} écart{x.score.ecarts.length > 1 ? 's' : ''} avec tes critères</span>
                )}
                <div className="actes" onClick={(e) => e.stopPropagation()}>
                  {x.candidature && ['preselection', 'entretien', 'acceptee'].includes(x.candidature.statut)
                    ? <>
                        <a className="fort" href={api.urlCvCandidature(x.candidature.id)} target="_blank" rel="noreferrer">CV envoyé (PDF)</a>
                        <button onClick={() => void retire(x)}>Retirer ma candidature</button>
                      </>
                    : x.candidature && x.candidature.statut === 'refusee'
                      ? <button className="fort" onClick={() => void reviens(x)}>Retirer de la liste</button>
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
              /* Deux colonnes comme dans le deck : le score d'un côté, ce qu'il
                 faut en comprendre de l'autre. Tout empiler dans une seule
                 colonne oblige à faire défiler pour relier un chiffre à sa
                 raison. */
              <>
                <div className="col-p"><BlocScore offre={choisi} /></div>
                <div className="col-p">
                  <BlocPourquoi offre={choisi} profil={profil} />
                  <BlocPoste offre={choisi} />
                  {choisi.match && (
                    <div className="btns" style={{ marginTop: 'var(--s5)' }}>
                      <button className="btn primaire" onClick={() => {
                        const m = (matchs ?? []).find((y) => y.id === choisi.match)
                        if (m) setOuvert(m)
                      }}>Ouvrir la conversation</button>
                    </div>
                  )}
                </div>
              </>
            )
            : <p className="vide-p">Choisis une offre à gauche pour voir le détail de son score.</p>}
        </aside>
      </div>

      {detail && !large && (
        <Feuille onFermer={() => setDetail(null)}>
          <Detail offre={detail} profil={profil} />
          <div className="btns" style={{ marginTop: 'var(--s5)' }}>
            {detail.match && (
              <button className="btn primaire" onClick={() => {
                const m = (matchs ?? []).find((x) => x.id === detail.match)
                setDetail(null)
                if (m) setOuvert(m)
              }}>Ouvrir la conversation</button>
            )}
            <button className="btn" onClick={() => setDetail(null)}>Fermer</button>
          </div>
        </Feuille>
      )}
    </div>
  )
}

export function Conversation({ match, onRetour }: { match: MatchLigne; onRetour: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const bas = useRef<HTMLDivElement>(null)

  /* Trois propositions de premier message, par règles, à partir du poste et
     du score. À modifier avant d'envoyer : ce sont des débuts, pas des lettres. */
  useEffect(() => {
    void api.suggestionsMatch(match.id).then((d) => setSuggestions(d.suggestions)).catch(() => setSuggestions([]))
  }, [match.id])

  const charge = useCallback(async () => {
    try {
      setMessages(await api.messages(match.id))
    } catch {
      setMessages([])
    }
  }, [match.id])

  useEffect(() => { void charge() }, [charge])
  useEffect(() => { bas.current?.scrollIntoView({ block: 'end' }) }, [messages])

  const envoie = async (e: React.FormEvent) => {
    e.preventDefault()
    const corps = texte.trim()
    if (!corps) return
    setEnvoi(true)
    try {
      await api.envoieMessage(match.id, corps)
      setTexte('')
      await charge()
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="screen" id="ec-messages">
      <div className="conv">
        <header className="conv-top">
          <button className="btn-mini" onClick={onRetour}>← Retour</button>
          <b>{match.titre}</b>
          <span>{match.entreprise ?? ''}</span>
        </header>

        <div className="conv-fil">
          {messages === null && <p className="pa">Chargement…</p>}
          {messages?.length === 0 && (
            <p className="pa">
              Personne n’a encore écrit. Une première question précise vaut mieux
              qu’un « bonjour » seul.
            </p>
          )}
          {(messages ?? []).map((m) => (
            <div className={`bulle${m.moi ? ' moi' : ''}`} key={m.id}>
              {m.corps}
              <time>{heureMessage(m.quand)}</time>
            </div>
          ))}
          <div ref={bas} />
        </div>

        {suggestions.length > 0 && (messages?.length ?? 0) < 4 && (
          <div className="conv-sugg">
            {suggestions.map((sg) => (
              <button type="button" key={sg} onClick={() => setTexte(sg)} title="Reprendre ce texte, à modifier">
                {sg.length > 70 ? sg.slice(0, 68) + '…' : sg}
              </button>
            ))}
          </div>
        )}
        <form className="conv-saisie" onSubmit={(e) => void envoie(e)}>
          <input
            type="text" value={texte} placeholder="Écrire un message"
            onChange={(e) => setTexte(e.target.value)}
          />
          <button className="btn primaire" type="submit" disabled={envoi || !texte.trim()}>Envoyer</button>
        </form>
      </div>
    </div>
  )
}

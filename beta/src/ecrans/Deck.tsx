/* Le deck. Les offres et leur score viennent du serveur : un score calculé dans
   le navigateur se modifie dans le navigateur.

   La carte reprend la composition du prototype, parce qu'elle a été travaillée
   pour ça : le score en tête avec sa jauge et sa confiance, le contenu en pages
   qu'on tourne au doigt, puis un pied qui rassemble les faits qu'on lit en
   dernier. Et surtout le glissé gauche/droite, qui est le geste du produit. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { manques } from '../regles'
import { ErreurApi } from '../types'
import type { Offre, Profil } from '../types'

interface Props {
  profil: Profil
  versProfil: (etape: number) => void
  /** Prévient la coquille qu'une décision a changé, pour ses pastilles. */
  onDecision?: () => void
}

type Decision = 'oui' | 'non' | 'plus_tard'

const FILTRES = [
  { cle: 'tout', nom: 'Pour toi' },
  { cle: 'ouvert', nom: 'Métiers proches' },
  { cle: 'teletravail', nom: 'Télétravail' },
  { cle: 'debutant', nom: 'Débutant accepté' },
  { cle: 'cdi', nom: 'CDI' },
  { cle: 'salaire', nom: 'Salaire annoncé' },
] as const

const NIV: Record<number, string> = { 1: 'Bac', 2: 'Bac+2', 3: 'Bac+3', 4: 'Bac+5' }
const pc = (v: number) => Math.round(v)
const teinte = (q: number) => (q >= 75 ? 'var(--yes)' : q >= 50 ? 'var(--accent)' : 'var(--no)')
const conf = (v: number) => (v >= 90 ? 'élevée' : v >= 60 ? 'moyenne' : 'faible')
const kf = (n: number) => `${Math.round(n / 1000)} k`

function passe(o: Offre, f: string): boolean {
  if (f === 'ouvert') return Boolean(o.score?.passerelle)
  if (f === 'teletravail') return o.teletravail !== 'non'
  if (f === 'debutant') return o.experienceMin === 0
  if (f === 'cdi') return o.contrat === 'CDI'
  if (f === 'salaire') return Boolean(o.salaire?.[0])
  return true
}

export function EcranDeck({ profil, versProfil, onDecision }: Props) {
  const [offres, setOffres] = useState<Offre[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [match, setMatch] = useState<Offre | null>(null)
  const [detail, setDetail] = useState<Offre | null>(null)
  const [filtres, setFiltres] = useState<string[]>([])
  const [dernier, setDernier] = useState<Offre | null>(null)

  const aCombler = manques(profil)

  const charge = useCallback(async () => {
    if (aCombler.length) { setOffres([]); return }
    setErreur(null)
    try {
      setOffres(await api.deck())
    } catch (e) {
      setOffres([])
      setErreur(e instanceof ErreurApi ? e.message : 'Le deck n’a pas pu être chargé.')
    }
  }, [aCombler.length])

  useEffect(() => { void charge() }, [charge])

  const visibles = useMemo(
    () => (offres ?? []).filter((o) => filtres.every((f) => passe(o, f))),
    [offres, filtres],
  )

  /* Un filtre qui ne filtre rien n'a pas à s'afficher : une puce qui annonce
     zéro résultat est une promesse vide. On garde celles qui sont actives, pour
     ne pas faire disparaître sous le doigt le filtre qu'on vient de poser. */
  const chips = useMemo(() => FILTRES.filter((f) => {
    if (f.cle === 'tout') return true
    if (filtres.includes(f.cle)) return true
    return (offres ?? []).some((o) => passe(o, f.cle))
  }), [offres, filtres])

  if (aCombler.length) {
    return (
      <div className="screen verrouille" id="ec-swipe">
        <div className="stack">
          <div className="zone-deck">
            <div className="empty verrou">
              <div>
                <svg className="v-cadenas" aria-hidden="true"><use href="#i-lock" /></svg>
                <h2>Le deck s’ouvre avec ton profil</h2>
                <p>
                  Il reste {aCombler.length} information{aCombler.length > 1 ? 's' : ''} à
                  renseigner. Sans elles, aucun score n’est calculable : ce qu’on afficherait
                  serait un ordre au hasard présenté comme une pertinence.
                </p>
                <ul className="v-liste">
                  {aCombler.map((m) => (
                    <li key={m.cle}>
                      <button type="button" onClick={() => versProfil(m.etape)}>{m.libelle}</button>
                    </li>
                  ))}
                </ul>
                <div className="v-actions">
                  <button className="btn primaire" onClick={() => versProfil(aCombler[0]!.etape)}>
                    Compléter mon profil
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const decide = async (o: Offre, decision: Decision) => {
    setEnCours(true)
    // On retire la carte tout de suite : attendre le réseau pour la faire
    // disparaître donnerait l'impression que le geste n'a pas été pris.
    setOffres((l) => (l ?? []).filter((x) => x.id !== o.id))
    setDernier(o)
    try {
      const r = await api.swipe(o.id, decision)
      if (r.match) setMatch(o)
      onDecision?.()
    } catch (e) {
      setOffres((l) => [o, ...(l ?? [])])
      setDernier(null)
      setErreur(e instanceof ErreurApi ? e.message : 'La décision n’a pas été enregistrée.')
    } finally {
      setEnCours(false)
    }
  }

  /* Revenir en arrière efface la décision côté serveur. La réécrire ne
     suffirait pas : la carte reviendrait au deck en restant décidée. */
  const reviens = async () => {
    if (!dernier) return
    setEnCours(true)
    try {
      await api.annuleSwipe(dernier.id)
      setOffres((l) => [dernier, ...(l ?? [])])
      setDernier(null)
      onDecision?.()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Impossible de revenir en arrière.')
    } finally {
      setEnCours(false)
    }
  }

  const courante = visibles[0] ?? null
  const suivante = visibles[1] ?? null

  return (
    <div className="screen" id="ec-swipe">
      <div className="stack">
        {chips.length > 1 && (
          <div className="filters">
            {chips.map((f) => {
              const on = f.cle === 'tout' ? filtres.length === 0 : filtres.includes(f.cle)
              return (
                <button
                  key={f.cle}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => {
                    if (f.cle === 'tout') setFiltres([])
                    else setFiltres((l) => (l.includes(f.cle) ? l.filter((x) => x !== f.cle) : [...l, f.cle]))
                  }}
                >
                  {f.nom}
                  {f.cle !== 'tout' && (
                    <span className="cpt">{(offres ?? []).filter((o) => passe(o, f.cle)).length}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="zone-deck">
          {offres === null && <div className="empty"><div><p>Chargement des offres…</p></div></div>}

          {offres !== null && !courante && (
            <div className="empty">
              <div>
                <h2>{filtres.length ? 'Aucune offre avec ces filtres' : 'Tu as vu tout ce qui correspond'}</h2>
                <p>
                  {erreur ?? (filtres.length
                    ? 'Tes filtres sont trop stricts pour ce qui reste. Retire-en un, ou touche « Pour toi ».'
                    : 'Aucune autre offre ouverte ne correspond à tes critères aujourd’hui.')}
                </p>
                {filtres.length > 0 && (
                  <button className="btn primaire" style={{ marginTop: 'var(--s5)' }} onClick={() => setFiltres([])}>
                    Tout réafficher
                  </button>
                )}
              </div>
            </div>
          )}

          {/* La carte suivante, en dessous : sans elle, le glissé découvre le vide. */}
          {suivante && (
            <Carte key={`bg-${suivante.id}`} offre={suivante} profondeur={1}
              mesCompetences={profil.competences} />
          )}

          {courante && (
            <Carte
              key={courante.id}
              offre={courante}
              profondeur={0}
              mesCompetences={profil.competences}
              peutRevenir={Boolean(dernier)}
              occupe={enCours}
              onDetail={() => setDetail(courante)}
              onDecide={(d) => void decide(courante, d)}
              onRetour={() => void reviens()}
            />
          )}
        </div>

        {courante?.score && <Panneau offre={courante} profil={profil} />}
      </div>

      {detail?.score && (
        <Feuille onFermer={() => setDetail(null)}>
          <Detail offre={detail} profil={profil} />
          <div className="btns" style={{ marginTop: 'var(--s5)' }}>
            <button className="btn primaire" onClick={() => setDetail(null)}>Fermer</button>
          </div>
        </Feuille>
      )}

      {match && (
        <Feuille onFermer={() => setMatch(null)}>
          <div className="eyebrow">Les deux ont dit oui</div>
          <h2>C’est un match</h2>
          <p className="qui">
            {match.entreprise} a aussi retenu ton profil pour <b>{match.titre}</b>.
            Elle voit maintenant ton nom et ton contact — pas avant.
          </p>
          <div className="btns" style={{ marginTop: 'var(--s5)' }}>
            <button className="btn primaire" onClick={() => setMatch(null)}>Continuer</button>
          </div>
        </Feuille>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ la carte */

/* Les pages de la carte. Le prototype les calcule en mesurant la hauteur réelle
   du texte ; ici les sections sont connues d'avance, alors on découpe par sens.
   Une page par idée : ce qu'on a en commun, le poste, les compétences, le score. */
function pagesDe(o: Offre, mes: string[]): { titre: string; corps: React.ReactNode }[] {
  const bas = mes.map((c) => c.toLowerCase())
  const jai = (c: string) => bas.includes(c.toLowerCase())
  const ok = o.requis.filter(jai)
  const manque = o.requis.filter((c) => !jai(c))
  const pages: { titre: string; corps: React.ReactNode }[] = [{
    titre: '',
    corps: (
      <div className="tags">
        {ok.map((c) => <span key={c}>{c}</span>)}
        {manque.slice(0, 3).map((c) => <span key={c} className="miss">{c} ?</span>)}
      </div>
    ),
  }]

  if (o.description) {
    pages.push({ titre: 'Le poste', corps: <p className="desc">{o.description}</p> })
  }
  if (o.requis.length || o.souhaite.length) {
    pages.push({
      titre: 'Compétences',
      corps: (
        <>
          {o.requis.length > 0 && (
            <>
              <h3>Exigé</h3>
              <div className="tags">
                {o.requis.map((c) => (
                  <span key={c} className={jai(c) ? '' : 'miss'}>{c}{jai(c) ? '' : ' ?'}</span>
                ))}
              </div>
            </>
          )}
          {o.souhaite.length > 0 && (
            <>
              <h3>Souhaité</h3>
              <div className="tags">{o.souhaite.map((c) => <span key={c} className="doux">{c}</span>)}</div>
            </>
          )}
        </>
      ),
    })
  }
  if (o.score?.detail) {
    pages.push({
      titre: 'Pourquoi ce score',
      corps: (
        <ul className="criteres">
          {[...o.score.detail.recruteur, ...o.score.detail.candidat].map((c) => (
            <li key={c.cle}>
              <span>{c.cle}</span>
              <b>{c.v === null ? 'non renseigné' : `${Math.round(c.v * 100)} %`}</b>
            </li>
          ))}
        </ul>
      ),
    })
  }
  return pages
}

const SEUIL = 90          // pixels au-delà desquels le glissé vaut décision

function Carte({ offre: o, profondeur, mesCompetences, peutRevenir, occupe, onDetail, onDecide, onRetour }: {
  offre: Offre
  profondeur: number
  mesCompetences: string[]
  peutRevenir?: boolean
  occupe?: boolean
  onDetail?: () => void
  onDecide?: (d: Decision) => void
  onRetour?: () => void
}) {
  const s = o.score
  const q = s?.qualite ?? 0
  const pages = useMemo(() => pagesDe(o, mesCompetences), [o, mesCompetences])
  const [page, setPage] = useState(0)
  const courante = pages[page] ?? pages[0]!

  /* Le glissé. La capture du pointeur n'est prise qu'après un vrai mouvement :
     la prendre au premier contact détourne le clic des boutons de la carte —
     l'erreur a déjà été commise deux fois sur le prototype. */
  const depart = useRef<{ x: number; y: number } | null>(null)
  const capture = useRef(false)
  const [dx, setDx] = useState(0)
  const [lache, setLache] = useState(false)
  const [sortie, setSortie] = useState<0 | 1 | -1>(0)

  const jouable = profondeur === 0 && !occupe && Boolean(onDecide)

  const debut = (e: React.PointerEvent) => {
    if (!jouable) return
    depart.current = { x: e.clientX, y: e.clientY }
    capture.current = false
    setLache(false)
  }
  const bouge = (e: React.PointerEvent) => {
    if (!depart.current) return
    const d = e.clientX - depart.current.x
    const dv = e.clientY - depart.current.y
    if (!capture.current) {
      // Un mouvement plus vertical qu'horizontal, c'est du défilement.
      if (Math.abs(d) < 6 || Math.abs(dv) > Math.abs(d)) return
      capture.current = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    setDx(d)
  }
  const fin = () => {
    if (!depart.current) return
    const aGlisse = capture.current
    depart.current = null
    capture.current = false
    setLache(true)
    if (aGlisse && Math.abs(dx) > SEUIL) {
      const sens = dx > 0 ? 1 : -1
      setSortie(sens)
      window.setTimeout(() => onDecide?.(sens > 0 ? 'oui' : 'non'), 160)
      return
    }
    setDx(0)
    // Un contact sans glissé tourne la page, en boucle : c'est le geste qu'on
    // essaie d'abord, et il ne doit jamais mener à un cul-de-sac.
    if (!aGlisse && pages.length > 1) setPage((p) => (p + 1) % pages.length)
  }

  const transform = sortie
    ? `translateX(${sortie * 700}px) rotate(${sortie * 22}deg)`
    : dx
      ? `translateX(${dx}px) rotate(${dx / 22}deg)`
      : `translateY(${profondeur * 8}px) scale(${1 - profondeur * 0.03})`

  return (
    <article
      className={`card${page ? ' turned' : ''}`}
      /* La carte du dessous n'est qu'un décor : elle ne doit ni recevoir les
         clics, ni prendre le focus au clavier. Son bouton de score répondait,
         sans rien faire. */
      aria-hidden={profondeur > 0 || undefined}
      inert={profondeur > 0}
      style={{
        transform,
        zIndex: 10 - profondeur,
        transition: lache ? 'transform .22s var(--ease)' : undefined,
        touchAction: 'pan-y',
        pointerEvents: profondeur > 0 ? 'none' : undefined,
      }}
      onPointerDown={debut}
      onPointerMove={bouge}
      onPointerUp={fin}
      onPointerCancel={fin}
    >
      <span className="stamp yes" style={{ opacity: Math.max(0, Math.min(1, dx / SEUIL)) }}>OUI</span>
      <span className="stamp no" style={{ opacity: Math.max(0, Math.min(1, -dx / SEUIL)) }}>NON</span>

      {pages.length > 1 && (
        <div className="segs">
          {pages.map((_, k) => (
            <i key={k} className={k === page ? 'on' : ''}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setPage(k) }} />
          ))}
        </div>
      )}

      <div className="stage">
        <div className="hero">
          <div className="hero-top">
            <button type="button" className="score score-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDetail?.() }}
              aria-label="Voir le détail du score">
              <span className="gauge"><b style={{ width: `${pc(q)}%`, background: teinte(q) }} /></span>
              <span className="v" style={{ color: teinte(q) }}>{pc(q)} %</span> compatible
            </button>
            {s?.passerelle && <span className="badge-pass">accessible depuis ton parcours</span>}
          </div>
          {s && (
            <div className="conf">
              confiance {conf(s.confiance)} · {pc(s.confiance)} % des critères renseignés
            </div>
          )}
          <h2 className="role">{o.titre}</h2>
          <div className="org">{o.entreprise}{o.secteur ? ` · ${o.secteur}` : ''}</div>
        </div>

        <div className="pagebox">
          {courante.titre && <div className="page-lead">{courante.titre}</div>}
          <div className="page-body">{courante.corps}</div>
        </div>
      </div>

      {/* Les faits qu'on lit en dernier, une fois l'intérêt décidé. */}
      <div className="facts">
        <div className="line">
          <em>{o.zone}</em> <span className="dot" />{' '}
          {o.teletravail === 'non' ? 'sur site' : `télétravail ${o.teletravail}`}
        </div>
        <div className="line">
          <em>{o.contrat}</em>
          {o.debut && <> <span className="dot" /> dès {o.debut}</>}
          {o.experienceMin > 0 && <> <span className="dot" /> {o.experienceMin} ans d’expérience</>}
        </div>
        <div className="line">
          {o.salaire?.[0]
            ? <em>{kf(o.salaire[0])}{o.salaire[1] ? ` – ${kf(o.salaire[1])}` : ''} XPF</em>
            : <em>salaire non annoncé</em>}
        </div>
      </div>

      {jouable && (
        <div className="coins" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="retour" disabled={!peutRevenir}
            onClick={(e) => { e.stopPropagation(); onRetour?.() }}
            aria-label="Revenir sur la dernière décision">
            <svg><use href="#i-undo" /></svg>
          </button>
          <button type="button" className="non"
            onClick={(e) => { e.stopPropagation(); onDecide?.('non') }} aria-label="Pas intéressé">
            <svg><use href="#i-x" /></svg>
          </button>
          <button type="button" className="fav"
            onClick={(e) => { e.stopPropagation(); onDecide?.('plus_tard') }} aria-label="Mettre de côté">
            <svg><use href="#i-star" /></svg>
          </button>
          <button type="button" className="oui"
            onClick={(e) => { e.stopPropagation(); onDecide?.('oui') }} aria-label="Ça m’intéresse">
            <svg><use href="#i-heart" /></svg>
          </button>
        </div>
      )}
    </article>
  )
}

/* --------------------------------------------------------------- la feuille */

/* Une feuille se ferme en la poussant vers le bas : c'est le geste qu'on essaie
   avant de chercher le bouton. */
export function Feuille({ onFermer, children }: { onFermer: () => void; children: React.ReactNode }) {
  const boite = useRef<HTMLDivElement>(null)
  const depart = useRef<number | null>(null)
  const capture = useRef(false)
  const [dy, setDy] = useState(0)
  const [lache, setLache] = useState(false)

  const debut = (e: React.PointerEvent) => {
    // On ne dispute pas le défilement : le geste ne part que du haut.
    if ((boite.current?.scrollTop ?? 0) > 0) return
    depart.current = e.clientY
    capture.current = false
    setLache(false)
  }
  const bouge = (e: React.PointerEvent) => {
    if (depart.current === null) return
    const d = e.clientY - depart.current
    if (!capture.current) {
      if (d < 6) return
      capture.current = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    setDy(Math.max(0, d))
  }
  const fin = () => {
    if (depart.current === null) return
    depart.current = null
    capture.current = false
    setLache(true)
    if (dy > 90) onFermer()
    else setDy(0)
  }

  return (
    <div className="sheet" onClick={onFermer}>
      <div
        ref={boite}
        className="sheet-box"
        style={{
          transform: dy ? `translateY(${dy}px)` : undefined,
          transition: lache ? 'transform .2s var(--ease)' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={debut}
        onPointerMove={bouge}
        onPointerUp={fin}
        onPointerCancel={fin}
      >
        <div className="poignee" />
        {/* La typographie du détail (titre, intertitres en petites capitales)
            est portée par « panneau ». Sans ce conteneur, la feuille affiche des
            h3 de corps de texte et un titre qui n'en est pas un. */}
        <div className="panneau">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ l'explication */

/* Dans les mots du prototype : ce qui colle, ce qui reste à vérifier. Un
   pourcentage sans phrase n'est pas exploitable par qui le reçoit. */
export function explique(o: Offre, p: Profil): { oui: string[]; att: string[] } {
  const oui: string[] = []
  const att: string[] = []
  const bas = p.competences.map((c) => c.toLowerCase())
  const jai = (c: string) => bas.includes(c.toLowerCase())
  const ok = o.requis.filter(jai)
  const manque = o.requis.filter((c) => !jai(c))

  if (ok.length) {
    oui.push(`${ok.length} compétence${ok.length > 1 ? 's' : ''} exigée${ok.length > 1 ? 's' : ''} sur ${o.requis.length} : ${ok.join(', ')}`)
  }
  if (manque.length) att.push(`Manque : ${manque.join(', ')}`)

  const exp = o.score?.detail?.recruteur.find((x) => x.cle === 'Expérience')
  if (o.experienceMin === 0) oui.push('Aucune expérience exigée')
  else if (exp?.v === 1) oui.push(`Expérience suffisante pour les ${o.experienceMin} ans demandés`)
  else if (exp && exp.v === null) att.push(`${o.experienceMin} ans demandés — ton ancienneté n’est pas renseignée`)
  else att.push(`${o.experienceMin} ans demandés`)

  const niv = p.formations.length ? Math.max(...p.formations.map((f) => f.niveau)) : p.formation
  if (o.formationMin) {
    if (niv && niv >= o.formationMin) oui.push(`Niveau ${NIV[niv]} pour ${NIV[o.formationMin]} demandé`)
    else att.push(`Niveau ${NIV[o.formationMin]} demandé`)
  }
  if (p.zones.includes(o.zone)) oui.push('Dans une zone que tu acceptes')
  if (p.contrats.includes(o.contrat)) oui.push(`Contrat ${o.contrat}, conforme`)
  if (o.salaire?.[0] && p.salaireMin != null) {
    if (p.salaireMin <= o.salaire[0]) oui.push('Salaire au-dessus de ton minimum')
    else att.push(`Le salaire démarre à ${kf(o.salaire[0])} XPF, sous ton minimum de ${kf(p.salaireMin)}`)
  }
  if (p.dispo && o.debut && p.dispo <= o.debut) oui.push('Disponible avant la prise de poste')
  for (const v of o.score?.vigilance ?? []) att.push(v)
  if (o.score?.passerelle) {
    att.push(`Métier différent de ceux visés${o.score.passerelleRaison ? ` — ${o.score.passerelleRaison}` : ' — accessible depuis ton parcours'}`)
  }
  return { oui, att }
}

function Jauges({ parts }: { parts: { cle: string; v: number | null }[] }) {
  return (
    <div className="jauges">
      {parts.map((x) => {
        const inc = x.v === null
        const v = Math.round((x.v ?? 0) * 100)
        return (
          <div className={`jauge${inc ? ' inconnu' : ''}`} key={x.cle}>
            <span>{x.cle}</span>
            <span className="piste">
              <b style={{ width: `${inc ? 0 : v}%`, background: inc ? 'var(--line)' : teinte(v) }} />
            </span>
            <span className="v">{inc ? 'inconnu' : `${v} %`}</span>
          </div>
        )
      })}
    </div>
  )
}

export function BlocScore({ offre: o }: { offre: Offre }) {
  const s = o.score
  return (
    <>
      <div className="titre">{o.titre}</div>
      <div className="org">
        {o.entreprise} · {o.contrat} ·{' '}
        {o.salaire?.[0] ? `${kf(o.salaire[0])}${o.salaire[1] ? ` – ${kf(o.salaire[1])}` : ''} XPF` : 'salaire non annoncé'}
      </div>
      {s?.detail && (
        <>
          <h3>Ce que l’entreprise regarde</h3>
          <Jauges parts={s.detail.recruteur} />
          <h3>Ce que tu regardes</h3>
          <Jauges parts={s.detail.candidat} />
        </>
      )}
      {s && (
        <p style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-3)', margin: 'var(--s3) 0 0' }}>
          Compatibilité {s.qualite} % — le plus faible des deux, jamais la moyenne.
          Confiance {conf(s.confiance)}, {s.confiance} % des critères renseignés.
        </p>
      )}
    </>
  )
}

export function BlocPourquoi({ offre: o, profil }: { offre: Offre; profil: Profil }) {
  const w = explique(o, profil)
  return (
    <>
      <h3>Pourquoi ce score</h3>
      <div className="deux">
        <div>
          <b style={{ color: 'var(--yes)', fontSize: 'var(--t-sm)' }}>Ce qui colle</b>
          <ul>{w.oui.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div>
          <b style={{ color: 'var(--accent)', fontSize: 'var(--t-sm)' }}>À vérifier</b>
          <ul>{w.att.length ? w.att.map((x) => <li key={x}>{x}</li>) : <li>Rien à signaler</li>}</ul>
        </div>
      </div>
    </>
  )
}

/* Le poste et l'entreprise : c'est ce qu'on lit après avoir compris le score,
   et ça manquait entièrement — le panneau ne montrait que des pourcentages. */
export function BlocPoste({ offre: o }: { offre: Offre }) {
  const lignes = (o.description ?? '').split('•').map((x) => x.trim()).filter(Boolean)
  const [tete, ...puces] = lignes
  return (
    <>
      {o.description && (
        <>
          <h3>Le poste</h3>
          <p style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-2)', margin: '0 0 var(--s3)' }}>{tete}</p>
          {puces.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 'var(--s5)', fontSize: 'var(--t-sm)', color: 'var(--ink-2)' }}>
              {puces.map((m) => <li key={m} style={{ marginBottom: 'var(--s2)' }}>{m}</li>)}
            </ul>
          )}
        </>
      )}
      {(o.pitch || o.taille || o.secteur) && (
        <>
          <h3>L’entreprise</h3>
          {o.pitch && (
            <p style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-2)', margin: '0 0 var(--s3)' }}>{o.pitch}</p>
          )}
          <dl className="kv2">
            {o.taille && <><dt>Effectif</dt><dd>{o.taille} salariés</dd></>}
            {o.secteur && <><dt>Secteur</dt><dd>{o.secteur}</dd></>}
            <dt>Zone</dt><dd>{o.zone}</dd>
            <dt>Publiée</dt><dd>{(o.publiee ?? '').slice(0, 10) || '—'}</dd>
          </dl>
        </>
      )}
    </>
  )
}

/** Dans une feuille, tout à la suite : il n'y a qu'une colonne. */
export function Detail({ offre: o, profil }: { offre: Offre; profil: Profil }) {
  return (
    <>
      <BlocScore offre={o} />
      <BlocPourquoi offre={o} profil={profil} />
      <BlocPoste offre={o} />
    </>
  )
}

/* Le panneau d'ordinateur ne montre rien de neuf : il sort de la carte ce qui y
   est enfoui, pour qu'on n'ait pas à faire défiler sur un grand écran. Deux
   colonnes au-delà de 1440 px, sinon les jauges s'étirent sur toute la largeur
   et deviennent illisibles. */
function Panneau({ offre: o, profil }: { offre: Offre; profil: Profil }) {
  return (
    <aside className="side panneau" id="side">
      <div className="col-p"><BlocScore offre={o} /></div>
      <div className="col-p">
        <BlocPourquoi offre={o} profil={profil} />
        <BlocPoste offre={o} />
      </div>
    </aside>
  )
}

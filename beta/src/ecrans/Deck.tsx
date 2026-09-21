/* Le deck. Les offres et leur score viennent du serveur : un score calculé dans
   le navigateur se modifie dans le navigateur.

   Depuis le 21/09, les offres sont les AVP réels de l'OPT-NC. Les filtres sont
   ceux de l'API OPT (ville, province, famille, direction, contrat, encadrement)
   et ils viennent du serveur avec leurs comptes : une puce n'apparaît que si
   elle filtre quelque chose. Rien n'élimine : un profil peut candidater à
   n'importe quel poste, et un écart (zone, contrat…) s'affiche au lieu de
   cacher la carte. Le glissé gauche/droite reste le geste du produit ; un
   « oui » est une candidature. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { manques } from '../regles'
import { ErreurApi } from '../types'
import type { Facettes, Filtres, Offre, Profil } from '../types'

/* Les directions de l'OPT arrivent en capitales sans accents (« DIRECTION DE LA
   POSTE… ») : on les rend lisibles sans prétendre restituer les accents. */
export function libDirection(d: string): string {
  const court = d.replace(/^DIRECTION (DE LA |DE L'|DES |DE |DU |D')?/i, '').toLowerCase()
  return court.charAt(0).toUpperCase() + court.slice(1)
}

interface Props {
  profil: Profil
  versProfil: (etape: number) => void
  /** Prévient la coquille qu'une décision a changé, pour ses pastilles. */
  onDecision?: () => void
}

type Decision = 'oui' | 'non' | 'plus_tard'

const NIV: Record<number, string> = { 1: 'Bac', 2: 'Bac+2', 3: 'Bac+3', 4: 'Bac+5' }
const pc = (v: number) => Math.round(v)
const teinte = (q: number) => (q >= 75 ? 'var(--yes)' : q >= 50 ? 'var(--accent)' : 'var(--no)')
const conf = (v: number) => (v >= 90 ? 'élevée' : v >= 60 ? 'moyenne' : 'faible')
const kf = (n: number) => `${Math.round(n / 1000)} k`

export function EcranDeck({ profil, versProfil, onDecision }: Props) {
  const [offres, setOffres] = useState<Offre[] | null>(null)
  const [facettes, setFacettes] = useState<Facettes | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [envoyee, setEnvoyee] = useState<{ offre: Offre; entrainement: boolean } | null>(null)
  const [detail, setDetail] = useState<Offre | null>(null)
  const [filtres, setFiltres] = useState<Filtres>({})
  const [recherche, setRecherche] = useState('')
  const [dernier, setDernier] = useState<Offre | null>(null)
  const vu = useRef<Set<number>>(new Set())

  const aCombler = manques(profil)

  const charge = useCallback(async (f: Filtres) => {
    if (aCombler.length) { setOffres([]); return }
    setErreur(null)
    try {
      const d = await api.deck(f)
      setOffres(d.offres)
      setFacettes(d.facettes)
    } catch (e) {
      setOffres([])
      setErreur(e instanceof ErreurApi ? e.message : 'Le deck n’a pas pu être chargé.')
    }
  }, [aCombler.length])

  useEffect(() => { void charge(filtres) }, [charge, filtres])

  // La recherche part quand la frappe s'arrête, pas à chaque lettre.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFiltres((f) => (f.q === recherche.trim() || (!f.q && !recherche.trim())) ? f : { ...f, q: recherche.trim() || undefined })
    }, 350)
    return () => window.clearTimeout(t)
  }, [recherche])

  const courante = offres?.[0] ?? null
  const suivante = offres?.[1] ?? null

  // Une carte affichée compte une vue — une seule par offre et par session.
  useEffect(() => {
    if (courante && !vu.current.has(courante.id)) {
      vu.current.add(courante.id)
      void api.vue(courante.id, 'deck')
    }
  }, [courante])

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
      if (decision === 'oui') setEnvoyee({ offre: o, entrainement: Boolean(r.entrainement) })
      onDecision?.()
    } catch (e) {
      setOffres((l) => [o, ...(l ?? [])])
      setDernier(null)
      setErreur(e instanceof ErreurApi ? e.message : 'La décision n’a pas été enregistrée.')
    } finally {
      setEnCours(false)
    }
  }

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

  const actifs = Object.entries(filtres).filter(([k, v]) => k !== 'q' && v).length
  const bascule = (k: keyof Filtres, v: string | boolean) =>
    setFiltres((f) => ({ ...f, [k]: f[k] === v ? undefined : v }))

  return (
    <div className="screen" id="ec-swipe">
      <div className="stack">
        <div className="filters filtres-avp">
          <input
            type="search" className="recherche" value={recherche} placeholder="Chercher un poste, un mot, un service…"
            onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher dans les offres"
          />
          <button className="chip" aria-pressed={actifs === 0 && !filtres.q}
            onClick={() => { setFiltres({}); setRecherche('') }}>Pour toi</button>
          {facettes && <Puces f={filtres} facettes={facettes} bascule={bascule} />}
        </div>

        <div className="zone-deck">
          {offres === null && <div className="empty"><div><p>Chargement des offres…</p></div></div>}

          {offres !== null && !courante && (
            <div className="empty">
              <div>
                <h2>{actifs || filtres.q ? 'Aucune offre avec ces filtres' : 'Tu as vu tout ce qui correspond'}</h2>
                <p>
                  {erreur ?? (actifs || filtres.q
                    ? 'Tes filtres sont trop stricts pour ce qui reste. Retire-en un, ou touche « Pour toi ».'
                    : 'Aucune autre offre ouverte aujourd’hui. Les AVP de l’OPT-NC arrivent au fil de l’eau — reviens demain, ou entraîne-toi sur les offres closes.')}
                </p>
                <div className="btns" style={{ marginTop: 'var(--s5)', justifyContent: 'center' }}>
                  {(actifs > 0 || filtres.q) && <button className="btn primaire" onClick={() => { setFiltres({}); setRecherche('') }}>Tout réafficher</button>}
                  {!filtres.clos && <button className="btn" onClick={() => setFiltres((f) => ({ ...f, clos: true }))}>M’entraîner sur les offres closes</button>}
                </div>
              </div>
            </div>
          )}

          {suivante && (
            <Carte key={`bg-${suivante.id}`} offre={suivante} profondeur={1} profil={profil} />
          )}

          {courante && (
            <Carte
              key={courante.id}
              offre={courante}
              profondeur={0}
              profil={profil}
              peutRevenir={Boolean(dernier)}
              occupe={enCours}
              onDetail={() => { setDetail(courante); void api.vue(courante.id, 'detail') }}
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

      {envoyee && (
        <Feuille onFermer={() => setEnvoyee(null)}>
          <div className="eyebrow">{envoyee.entrainement ? 'Entraînement' : 'Candidature envoyée'}</div>
          <h2>{envoyee.entrainement ? 'Offre close, geste enregistré' : 'C’est parti'}</h2>
          <p className="qui">
            {envoyee.entrainement
              ? <>Cet AVP est clos : ton geste compte pour t’entraîner, aucune candidature n’est envoyée.</>
              : <>
                  Ta candidature pour <b>{envoyee.offre.titre}</b> est chez {envoyee.offre.entreprise ?? 'l’organisation'}.
                  Elle voit ton profil <b>sans ton nom</b> ; à la présélection, elle reçoit ton contact, un CV
                  recentré sur ce poste et ton CV d’origine. Tu suis tout dans « Candidatures ».
                </>}
          </p>
          <div className="btns" style={{ marginTop: 'var(--s5)' }}>
            <button className="btn primaire" onClick={() => setEnvoyee(null)}>Continuer</button>
          </div>
        </Feuille>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ filtres */

/* Les puces viennent des facettes du serveur : chaque valeur avec son compte
   sur les offres ouvertes. Une valeur à zéro n'est pas affichée — sauf si
   elle est active, pour ne pas disparaître sous le doigt. */
function Puces({ f, facettes, bascule }: { f: Filtres; facettes: Facettes; bascule: (k: keyof Filtres, v: string | boolean) => void }) {
  const chip = (k: keyof Filtres, v: string | boolean, nom: string, n?: number) => {
    const on = f[k] === v
    if (!on && n !== undefined && n === 0) return null
    return (
      <button key={`${k}:${String(v)}`} className="chip" aria-pressed={on} onClick={() => bascule(k, v)}>
        {nom}{n !== undefined && <span className="cpt">{n}</span>}
      </button>
    )
  }
  return (
    <>
      {facettes.ville.slice(0, 6).map((x) => chip('ville', x.valeur, x.valeur, x.n))}
      {facettes.province.length > 1 && facettes.province.map((x) => chip('province', x.valeur, x.valeur.replace('province ', ''), x.n))}
      {facettes.famille.slice(0, 8).map((x) => chip('famille', x.valeur, x.valeur, x.n))}
      {facettes.contrat.length > 1 && facettes.contrat.map((x) => chip('contrat', x.valeur, x.valeur, x.n))}
      {chip('teletravail', true, 'Télétravail', facettes.teletravail)}
      {chip('encadrement', true, 'Encadrement', facettes.encadrement)}
      {chip('debutant', true, 'Débutant accepté', facettes.debutant)}
      {chip('salaire', true, 'Salaire annoncé', facettes.salaire)}
      {facettes.direction.slice(0, 4).map((x) => chip('direction', x.valeur, libDirection(x.valeur), x.n))}
      {chip('clos', true, 'Offres closes (entraînement)')}
    </>
  )
}

/* ------------------------------------------------------------------ la carte */

/* Les pages de la carte, une par idée : ce qu'on a en commun, les missions,
   les compétences attendues (dans les mots de l'AVP), le score, les écarts. */
function pagesDe(o: Offre): { titre: string; corps: React.ReactNode }[] {
  const s = o.score
  const lex = s?.detail?.lexical ?? null
  const st = s?.detail?.structurel ?? null
  const okLex = lex?.ok.map((x) => x.texte) ?? []
  const okSt = st?.ok.map((x) => x.nom) ?? []
  const manqueLex = lex?.manque.map((x) => x.texte) ?? []
  const manqueSt = st?.manque.map((x) => x.nom) ?? []
  const communs = [...new Set([...okSt, ...okLex])]
  const manque = [...new Set([...manqueSt.slice(0, 3), ...manqueLex.slice(0, 3)])]

  const pages: { titre: string; corps: React.ReactNode }[] = [{
    titre: '',
    corps: (
      <div className="tags">
        {communs.slice(0, 6).map((c) => <span key={c}>{c}</span>)}
        {manque.slice(0, 3).map((c) => <span key={c} className="miss">{c} ?</span>)}
        {communs.length === 0 && manque.length === 0 && o.requis.slice(0, 5).map((c) => <span key={c}>{c}</span>)}
        {communs.length === 0 && manque.length === 0 && !o.requis.length && <span className="doux">score calculé sur le métier et le parcours</span>}
      </div>
    ),
  }]

  if (o.responsabilites.length) {
    pages.push({
      titre: 'Les missions',
      corps: <ul className="missions">{o.responsabilites.slice(0, 6).map((m) => <li key={m}>{m}</li>)}</ul>,
    })
  } else if (o.description) {
    pages.push({ titre: 'Le poste', corps: <p className="desc">{o.description}</p> })
  }

  if (o.competencesTexte.length) {
    pages.push({
      titre: 'Ce que le poste demande',
      corps: (
        <div className="tags">
          {o.competencesTexte.slice(0, 10).map((c) => (
            <span key={c.texte} className={okLex.includes(c.texte) ? '' : manqueLex.includes(c.texte) ? 'miss' : 'doux'}>{c.texte}</span>
          ))}
        </div>
      ),
    })
  } else if (o.requis.length || o.souhaite.length) {
    pages.push({
      titre: 'Compétences',
      corps: (
        <div className="tags">
          {o.requis.map((c) => <span key={c}>{c}</span>)}
          {o.souhaite.map((c) => <span key={c} className="doux">{c}</span>)}
        </div>
      ),
    })
  }

  if (s?.detail) {
    pages.push({
      titre: 'Pourquoi ce score',
      corps: (
        <ul className="criteres">
          {[...s.detail.recruteur, ...s.detail.candidat].map((c) => (
            <li key={c.cle}>
              <span>{c.cle}</span>
              <b>{c.v === null ? 'non renseigné' : `${Math.round(c.v * 100)} %`}</b>
            </li>
          ))}
        </ul>
      ),
    })
  }
  if (s?.ecarts?.length) {
    pages.push({
      titre: 'Ce qui ne colle pas avec tes critères',
      corps: <ul className="missions ecarts">{s.ecarts.map((e) => <li key={e}>{e}</li>)}</ul>,
    })
  }
  return pages
}

const SEUIL = 90          // pixels au-delà desquels le glissé vaut décision

function Carte({ offre: o, profondeur, peutRevenir, occupe, onDetail, onDecide, onRetour }: {
  offre: Offre
  profondeur: number
  profil: Profil
  peutRevenir?: boolean
  occupe?: boolean
  onDetail?: () => void
  onDecide?: (d: Decision) => void
  onRetour?: () => void
}) {
  const s = o.score
  const q = s?.qualite ?? 0
  const pages = useMemo(() => pagesDe(o), [o])
  const [page, setPage] = useState(0)
  const courante = pages[page] ?? pages[0]!
  const close = o.statut !== 'publiee' || (o.joursRestants !== null && o.joursRestants < 0)

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
    if (!aGlisse && pages.length > 1) setPage((p) => (p + 1) % pages.length)
  }

  const transform = sortie
    ? `translateX(${sortie * 700}px) rotate(${sortie * 22}deg)`
    : dx
      ? `translateX(${dx}px) rotate(${dx / 22}deg)`
      : `translateY(${profondeur * 8}px) scale(${1 - profondeur * 0.03})`

  return (
    <article
      className={`card${page ? ' turned' : ''}${close ? ' close' : ''}`}
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
      <span className="stamp yes" style={{ opacity: Math.max(0, Math.min(1, dx / SEUIL)) }}>{close ? 'ESSAI' : 'OUI'}</span>
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
            {close
              ? <span className="badge-pass close">clos — pour t’entraîner</span>
              : s?.passerelle && <span className="badge-pass">hors de tes métiers visés</span>}
          </div>
          {s && (
            <div className="conf">
              confiance {conf(s.confiance)} · {pc(s.confiance)} % des critères renseignés
              {s.ecarts && s.ecarts.length > 0 && <> · <b style={{ color: 'var(--no)' }}>{s.ecarts.length} écart{s.ecarts.length > 1 ? 's' : ''}</b></>}
            </div>
          )}
          <h2 className="role">{o.titre}</h2>
          <div className="org">
            {o.entreprise}{o.direction ? ` · ${libDirection(o.direction)}` : o.secteur ? ` · ${o.secteur}` : ''}
          </div>
        </div>

        <div className="pagebox">
          {courante.titre && <div className="page-lead">{courante.titre}</div>}
          <div className="page-body">{courante.corps}</div>
        </div>
      </div>

      <div className="facts">
        <div className="line">
          <em>{o.ville ?? o.zone}</em>{o.ville && o.province ? <> <span className="dot" /> {o.province}</> : null}
          {' '}<span className="dot" />{' '}{o.teletravail === 'non' ? 'sur site' : `télétravail ${o.teletravail}`}
        </div>
        <div className="line">
          <em>{o.contrat}</em>
          {o.debut && <> <span className="dot" /> dès {o.debut}</>}
          {o.experienceMin > 0 && <> <span className="dot" /> {o.experienceMin} ans d’expérience</>}
          {o.nbAgentsEncadres ? <> <span className="dot" /> encadre {o.nbAgentsEncadres} agents</> : null}
        </div>
        <div className="line">
          {o.salaire?.[0]
            ? <em>{kf(o.salaire[0])}{o.salaire[1] ? ` – ${kf(o.salaire[1])}` : ''} XPF</em>
            : <em>salaire non annoncé</em>}
          {o.joursRestants !== null && o.joursRestants >= 0 && <> <span className="dot" /> {o.joursRestants === 0 ? 'dernier jour' : `${o.joursRestants} j restants`}</>}
          {o.reference && <> <span className="dot" /> réf. {o.reference}</>}
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
            onClick={(e) => { e.stopPropagation(); onDecide?.('oui') }} aria-label={close ? 'M’entraîner' : 'Candidater'}>
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
        <div className="panneau">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ l'explication */

/* Ce qui colle, ce qui reste à vérifier, ce qui ne colle pas. Un pourcentage
   sans phrase n'est pas exploitable par qui le reçoit. */
export function explique(o: Offre, p: Profil): { oui: string[]; att: string[]; non: string[] } {
  const oui: string[] = []
  const att: string[] = []
  const s = o.score
  const st = s?.detail?.structurel ?? null
  const lex = s?.detail?.lexical ?? null

  if (st && st.ok.length) {
    oui.push(`${st.ok.length} compétence${st.ok.length > 1 ? 's' : ''} du métier « ${o.metierOpt ?? o.codeMetier} » : ${st.ok.slice(0, 4).map((x) => x.nom).join(', ')}${st.ok.length > 4 ? '…' : ''}`)
  }
  if (lex && lex.ok.length) {
    oui.push(`${lex.ok.length} attente${lex.ok.length > 1 ? 's' : ''} de l’AVP couverte${lex.ok.length > 1 ? 's' : ''} sur ${lex.total} : ${lex.ok.slice(0, 3).map((x) => x.texte).join(' · ')}`)
  }
  if (st && st.manque.length) {
    att.push(`Manque, pour ce métier : ${st.manque.slice(0, 4).map((x) => x.nom).join(', ')}${st.manque.length > 4 ? ` (+${st.manque.length - 4})` : ''}`)
  }
  if (lex && lex.manque.length) {
    att.push(`Non couvert dans l’AVP : ${lex.manque.slice(0, 3).map((x) => x.texte).join(' · ')}${lex.manque.length > 3 ? ` (+${lex.manque.length - 3})` : ''}`)
  }
  if (!st && !lex) {
    const bas = p.competences.map((c) => c.toLowerCase())
    const jai = (c: string) => bas.includes(c.toLowerCase())
    const ok = o.requis.filter(jai)
    const manque = o.requis.filter((c) => !jai(c))
    if (ok.length) oui.push(`${ok.length} compétence${ok.length > 1 ? 's' : ''} exigée${ok.length > 1 ? 's' : ''} sur ${o.requis.length} : ${ok.join(', ')}`)
    if (manque.length) att.push(`Manque : ${manque.join(', ')}`)
  }

  const exp = s?.detail?.recruteur.find((x) => x.cle === 'Expérience')
  if (o.experienceMin === 0) oui.push('Aucune expérience exigée')
  else if (exp?.v === 1) oui.push(`Expérience suffisante pour les ${o.experienceMin} ans demandés`)
  else if (exp && exp.v === null) att.push(`${o.experienceMin} ans demandés — ton ancienneté n’est pas renseignée`)
  else att.push(`${o.experienceMin} ans demandés`)

  const niv = p.formations.length ? Math.max(...p.formations.map((f) => f.niveau)) : p.formation
  if (o.formationMin) {
    if (niv && niv >= o.formationMin) oui.push(`Niveau ${NIV[niv]} pour ${NIV[o.formationMin]} demandé`)
    else att.push(`Niveau ${NIV[o.formationMin]} demandé`)
  }
  if (p.zones.includes(o.zone)) oui.push(`Dans une zone que tu acceptes (${o.ville ?? o.zone})`)
  if (p.contrats.includes(o.contrat)) oui.push(`Contrat ${o.contrat}, conforme`)
  if (p.dispo && o.debut && p.dispo <= o.debut) oui.push('Disponible avant la prise de poste')
  for (const v of s?.vigilance ?? []) att.push(v)
  if (s?.passerelle) {
    att.push(`Métier différent de ceux visés${s.passerelleRaison ? ` — ${s.passerelleRaison}` : ''}`)
  }
  return { oui, att, non: s?.ecarts ?? [] }
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
  const st = s?.detail?.structurel ?? null
  const lex = s?.detail?.lexical ?? null
  return (
    <>
      <div className="titre">{o.titre}</div>
      <div className="org">
        {o.entreprise} · {o.contrat} · {o.ville ?? o.zone}
        {o.reference ? ` · réf. ${o.reference}` : ''}
      </div>
      {s?.detail && (
        <>
          <h3>Ce que l’employeur regarde</h3>
          <Jauges parts={s.detail.recruteur} />
          <h3>Ce que tu regardes</h3>
          <Jauges parts={s.detail.candidat} />
          {(st || lex) && (
            <>
              <h3>Les compétences, en détail</h3>
              <Jauges parts={[
                ...(st ? [{ cle: `Référentiel OPT (${st.ok.length}/${st.ok.length + st.manque.length})`, v: st.v }] : []),
                ...(lex ? [{ cle: `Attentes de l’AVP (${lex.ok.length}/${lex.total})`, v: lex.v }] : []),
              ]} />
            </>
          )}
        </>
      )}
      {s && (
        <p style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-3)', margin: 'var(--s3) 0 0' }}>
          Compatibilité {s.qualite} % — le plus faible des deux, jamais la moyenne
          {s.ecarts?.length ? `, moins ${s.ecarts.length} écart${s.ecarts.length > 1 ? 's' : ''}` : ''}.
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
          <ul>{w.oui.length ? w.oui.map((x) => <li key={x}>{x}</li>) : <li>Rien de mesurable encore</li>}</ul>
        </div>
        <div>
          <b style={{ color: 'var(--accent)', fontSize: 'var(--t-sm)' }}>À vérifier</b>
          <ul>{w.att.length ? w.att.map((x) => <li key={x}>{x}</li>) : <li>Rien à signaler</li>}</ul>
        </div>
      </div>
      {w.non.length > 0 && (
        <>
          <b style={{ color: 'var(--no)', fontSize: 'var(--t-sm)' }}>Ne colle pas avec tes critères — tu peux candidater quand même</b>
          <ul>{w.non.map((x) => <li key={x}>{x}</li>)}</ul>
        </>
      )}
    </>
  )
}

/* Le poste tel que l'AVP le décrit : missions, attentes, conditions. */
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
      {o.responsabilites.length > 0 && (
        <>
          <h3>Missions</h3>
          <ul style={{ margin: 0, paddingLeft: 'var(--s5)', fontSize: 'var(--t-sm)', color: 'var(--ink-2)' }}>
            {o.responsabilites.map((m) => <li key={m} style={{ marginBottom: 'var(--s2)' }}>{m}</li>)}
          </ul>
        </>
      )}
      {o.competencesTexte.length > 0 && (
        <>
          <h3>Attentes du poste</h3>
          <div className="tags">
            {o.competencesTexte.map((c) => <span key={c.texte} className={c.type === 'connaissance' ? 'doux' : ''}>{c.texte}</span>)}
          </div>
        </>
      )}
      <h3>{o.source === 'opt' ? 'L’AVP' : 'L’organisation'}</h3>
      {o.pitch && <p style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-2)', margin: '0 0 var(--s3)' }}>{o.pitch}</p>}
      <dl className="kv2">
        {o.direction && <><dt>Direction</dt><dd>{o.direction}</dd></>}
        {o.unite && <><dt>Unité</dt><dd>{o.unite}</dd></>}
        {o.metierOpt && <><dt>Métier OPT</dt><dd>{o.metierOpt}{o.codeMetier ? ` (${o.codeMetier})` : ''}</dd></>}
        {o.familles.length > 0 && <><dt>Famille</dt><dd>{o.familles.join(', ')}</dd></>}
        {(o.lieu || o.adresse) && <><dt>Lieu</dt><dd>{[o.lieu, o.adresse].filter(Boolean).join(', ')}</dd></>}
        {o.conditions && <><dt>Horaires</dt><dd>{o.conditions}</dd></>}
        {o.avantages && <><dt>Indemnités</dt><dd>{o.avantages}</dd></>}
        {o.exigencesPhysiques && <><dt>Conditions physiques</dt><dd>{o.exigencesPhysiques}</dd></>}
        {o.qualifications && <><dt>Habilitations</dt><dd>{o.qualifications}</dd></>}
        {o.experienceTexte && <><dt>Expérience</dt><dd>{o.experienceTexte}</dd></>}
        {o.taille && <><dt>Effectif</dt><dd>{o.taille} agents</dd></>}
        <dt>Publiée</dt><dd>{(o.datePublication ?? o.publiee ?? '').slice(0, 10) || '—'}</dd>
        {o.expire && <><dt>Clôture</dt><dd>{o.expire.slice(0, 10)}</dd></>}
        {o.url && <><dt>Source</dt><dd><a href={o.url} target="_blank" rel="noreferrer">annonce officielle</a></dd></>}
      </dl>
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

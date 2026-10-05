/* Le deck. Les offres et leur score viennent du serveur : un score calculé dans
   le navigateur se modifie dans le navigateur.

   Depuis le 21/09, les offres sont les AVP réels de l'OPT-NC. Les filtres sont
   ceux de l'API OPT (ville, province, famille, direction, contrat, encadrement)
   et ils viennent du serveur avec leurs comptes : une puce n'apparaît que si
   elle filtre quelque chose. Rien n'élimine : un profil peut candidater à
   n'importe quel poste, et un écart (zone, contrat…) s'affiche au lieu de
   cacher la carte. Le glissé gauche/droite reste le geste du produit ; un
   « oui » est une candidature. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { manques } from '../regles'
import { Attente } from '../Attente'
import { ErreurApi } from '../types'
import type { Facettes, Filtres, Offre, Profil } from '../types'

/* Les directions de l'OPT arrivent en capitales sans accents (« DIRECTION DE LA
   POSTE… ») : on les rend lisibles sans prétendre restituer les accents. */
/* Le référentiel Pyramide de l'OPT écrit ses directions en capitales et sans
   accents. Les remettre mot à mot : « Systemes d'information » à côté de la
   famille « Systèmes d'information » se lit comme une faute de notre part. */
const ACCENTS: Record<string, string> = {
  generale: 'générale', general: 'général', secretariat: 'secrétariat',
  telecommunications: 'télécommunications', systemes: 'systèmes',
  proximite: 'proximité', experience: 'expérience', immobilier: 'immobilier',
  reseau: 'réseau', reseaux: 'réseaux', batiment: 'bâtiment', bati: 'bâti',
  comptable: 'comptable', adjointe: 'adjointe', strategie: 'stratégie',
}

export function libDirection(d: string): string {
  const court = d.replace(/^DIRECTION (DE LA |DE L'|DES |DE |DU |D')?/i, '').toLowerCase()
  const accentue = court.replace(/[a-zà-ÿ']+/g, (m) => ACCENTS[m] ?? m)
  return accentue.charAt(0).toUpperCase() + accentue.slice(1)
}

interface Props {
  profil: Profil
  versProfil: (etape: number) => void
  /** Prévient la coquille qu'une décision a changé, pour ses pastilles. */
  onDecision?: () => void
}

/* Défilement horizontal d'une rangée de puces, à la souris.

   Au doigt le navigateur s'en charge. Sur ordinateur il n'y a rien : la barre
   de défilement est masquée par le style, et une molette verticale ne bouge
   pas un conteneur horizontal. La rangée paraissait donc figée — alors que le
   curseur « grab » et la classe `.dragging` de la feuille de style promettaient
   un glissé que personne ne branchait. */
function useGlisseHorizontal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const barre = ref.current
    if (!barre) return
    let tire: { x: number; left: number; bouge: boolean; id: number } | null = null
    let finTire = 0

    const bas = (ev: PointerEvent) => {
      if (ev.pointerType === 'touch') return                     // le doigt fait mieux
      if ((ev.target as HTMLElement).closest('input, textarea')) return   // on saisit, on ne glisse pas
      tire = { x: ev.clientX, left: barre.scrollLeft, bouge: false, id: ev.pointerId }
    }
    const bouge = (ev: PointerEvent) => {
      if (!tire) return
      const dx = ev.clientX - tire.x
      /* La capture ne se prend qu'après un vrai mouvement : prise au contact,
         elle détourne le clic vers la barre et la puce visée ne le reçoit
         jamais. Même piège que sur la carte du deck. */
      if (!tire.bouge && Math.abs(dx) > 5) {
        tire.bouge = true
        barre.classList.add('dragging')
        try { barre.setPointerCapture(tire.id) } catch { /* pointeur déjà relâché */ }
      }
      if (tire.bouge) barre.scrollLeft = tire.left - dx
    }
    const fin = () => {
      if (!tire) return
      if (tire.bouge) finTire = Date.now()
      tire = null
      barre.classList.remove('dragging')
    }
    // Un glissé qui s'achève sur une puce ne doit pas la sélectionner.
    const clic = (ev: MouseEvent) => {
      if (Date.now() - finTire < 250) { ev.preventDefault(); ev.stopPropagation() }
    }
    const molette = (ev: WheelEvent) => {
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return     // déjà horizontal
      barre.scrollLeft += ev.deltaY
      ev.preventDefault()
    }

    barre.addEventListener('pointerdown', bas)
    barre.addEventListener('pointermove', bouge)
    barre.addEventListener('pointerup', fin)
    barre.addEventListener('pointercancel', fin)
    barre.addEventListener('click', clic, true)
    barre.addEventListener('wheel', molette, { passive: false })
    return () => {
      barre.removeEventListener('pointerdown', bas)
      barre.removeEventListener('pointermove', bouge)
      barre.removeEventListener('pointerup', fin)
      barre.removeEventListener('pointercancel', fin)
      barre.removeEventListener('click', clic, true)
      barre.removeEventListener('wheel', molette)
    }
  }, [])
  return ref
}

type Decision = 'oui' | 'non' | 'plus_tard'

const kf = (n: number) => `${Math.round(n / 1000)} k`

export function EcranDeck({ profil, versProfil, onDecision }: Props) {
  const barreFiltres = useGlisseHorizontal<HTMLDivElement>()
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
                  renseigner. Quand tu candidates, c’est ton profil que le recruteur
                  lit : sans elles, ta candidature arriverait vide.
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
      if (decision === 'oui') setEnvoyee({ offre: o, entrainement: o.statut === 'close' && r.ok })
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
        <div className="filters filtres-avp" ref={barreFiltres}>
          <input
            type="search" className="recherche" value={recherche} placeholder="Chercher un poste, un mot, un service…"
            onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher dans les offres"
          />
          <button className="chip" aria-pressed={actifs === 0 && !filtres.q}
            onClick={() => { setFiltres({}); setRecherche('') }}>Pour toi</button>
          {facettes && <Puces f={filtres} facettes={facettes} bascule={bascule} />}
        </div>

        <div className="zone-deck">
          {offres === null && <div className="empty"><div><Attente texte="Chargement des offres…" centre /></div></div>}

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

        {courante && <Panneau offre={courante} />}
      </div>

      {detail && (
        <Feuille onFermer={() => setDetail(null)}>
          <Detail offre={detail} />
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
                  Ta candidature pour <b>{envoyee.offre.titre}</b> est chez le recruteur : il lit ton profil
                  et ton CV. Tu suis sa réponse dans « Candidatures ».
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
  /* `prefixe` qualifie la puce quand son libellé ne suffit pas : « Services
     bancaires » est à la fois une famille de métiers et une direction de
     l'OPT, et deux boutons au même nom avec deux comptes différents ne se
     distinguent pas. */
  const chip = (k: keyof Filtres, v: string | boolean, nom: string, n?: number, prefixe?: string) => {
    const on = f[k] === v
    if (!on && n !== undefined && n === 0) return null
    return (
      <button key={`${k}:${String(v)}`} className="chip" aria-pressed={on} onClick={() => bascule(k, v)}
        aria-label={prefixe ? `${prefixe} ${nom}` : undefined}>
        {prefixe && <i className="pre">{prefixe}</i>}{nom}{n !== undefined && <span className="cpt">{n}</span>}
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
      {facettes.direction.slice(0, 4).map((x) => chip('direction', x.valeur, libDirection(x.valeur), x.n, 'Direction'))}
      {chip('clos', true, 'Offres closes (entraînement)')}
    </>
  )
}

/* ------------------------------------------------------------------ la carte */

/* Les pages de la carte, une par idée : ce qu'on a en commun, les missions,
   les compétences attendues (dans les mots de l'AVP), le score, les écarts. */
function pagesDe(o: Offre): { titre: string; corps: React.ReactNode }[] {
  const pages: { titre: string; corps: React.ReactNode }[] = [{
    titre: '',
    corps: (
      <div className="tags">
        {[o.metierOpt, ...o.familles].filter((t): t is string => Boolean(t)).map((t) => <span key={t}>{t}</span>)}
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
            <span key={c.texte} className={c.type === 'connaissance' ? 'doux' : ''}>{c.texte}</span>
          ))}
        </div>
      ),
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
  const pages = useMemo(() => pagesDe(o), [o])
  const [page, setPage] = useState(0)
  const courante = pages[page] ?? pages[0]!

  /* Une page trop longue pour la carte (dix compétences, six missions) ne doit
     pas être coupée net : elle devient défilable, et le bas s'estompe pour le
     montrer (`.page-body.deborde`). Le glissé de la carte ne réagit qu'au
     mouvement horizontal, le défilement vertical reste libre. */
  const corps = useRef<HTMLDivElement>(null)
  const [deborde, setDeborde] = useState(false)
  useLayoutEffect(() => {
    const el = corps.current
    if (!el) return
    el.scrollTop = 0
    const mesure = () => setDeborde(el.scrollHeight > el.clientHeight + 2)
    mesure()
    const ro = new ResizeObserver(mesure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [page, o])
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
              onClick={(e) => { e.stopPropagation(); onDetail?.() }}>
              Voir l’offre
            </button>
            {close && <span className="badge-pass close">clos — pour t’entraîner</span>}
          </div>
          <h2 className="role">{o.titre}</h2>
          <div className="org">
            {o.entreprise}{o.direction ? ` · ${libDirection(o.direction)}` : o.secteur ? ` · ${o.secteur}` : ''}
          </div>
        </div>

        <div className="pagebox">
          {courante.titre && <div className="page-lead">{courante.titre}</div>}
          <div ref={corps} className={`page-body${deborde ? ' deborde' : ''}`}>{courante.corps}</div>
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

/* ------------------------------------------------------------ le détail */

/* L'en-tête du détail : le poste, l'employeur, la référence. */
export function BlocEntete({ offre: o }: { offre: Offre }) {
  return (
    <>
      <div className="titre">{o.titre}</div>
      <div className="org">
        {o.entreprise} · {o.contrat} · {o.ville ?? o.zone}
        {o.reference ? ` · réf. ${o.reference}` : ''}
      </div>
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
export function Detail({ offre: o }: { offre: Offre }) {
  return (
    <>
      <BlocEntete offre={o} />
      <BlocPoste offre={o} />
    </>
  )
}

function Panneau({ offre: o }: { offre: Offre }) {
  return (
    <aside className="side panneau" id="side">
      <div className="col-p"><BlocEntete offre={o} /></div>
      <div className="col-p"><BlocPoste offre={o} /></div>
    </aside>
  )
}

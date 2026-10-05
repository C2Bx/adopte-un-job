/* Le deck : les AVP réels de l'OPT-NC, lus dans l'API de l'équipe une fois par
   chargement. Les filtres s'appliquent ensuite dans le navigateur (filtres.ts) :
   plusieurs choix par catégorie, compteurs qui disent ce qu'on verrait en
   touchant une puce, effet instantané. Le glissé gauche/droite reste le geste
   du produit ; un « oui » est une candidature. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { manques } from '../regles'
import { Attente } from '../Attente'
import { ErreurApi } from '../types'
import type { Offre, Profil } from '../types'
import { CATEGORIES, OPTIONS, basculeOption, basculeValeur, compteurs, efface, nbActifs, resultats } from '../filtres'
import type { Categorie, Compteurs, Filtres } from '../filtres'

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
      if (barre.scrollWidth <= barre.clientWidth + 1) return     // barre à la ligne (souris) : rien à faire glisser
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
      if (barre.scrollWidth <= barre.clientWidth + 1) return     // rien à défiler : la molette fait défiler la page
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
  // toutes les offres du jeu courant (ouvertes ou closes) ; les filtres s'y appliquent sans réseau
  const [toutes, setToutes] = useState<Offre[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [envoyee, setEnvoyee] = useState<{ offre: Offre; entrainement: boolean } | null>(null)
  const [detail, setDetail] = useState<Offre | null>(null)
  const [filtres, setFiltres] = useState<Filtres>({})
  const [recherche, setRecherche] = useState('')
  // le panneau des filtres (une feuille, sur téléphone comme sur ordinateur)
  const [panneauFiltres, setPanneauFiltres] = useState(false)
  const [dernier, setDernier] = useState<Offre | null>(null)
  const vu = useRef<Set<number>>(new Set())
  // raccourcis clavier : la fonction est remise à jour à chaque rendu (elle lit l'état courant)
  const clavier = useRef<((e: KeyboardEvent) => void) | null>(null)
  useEffect(() => {
    const ecoute = (e: KeyboardEvent) => clavier.current?.(e)
    window.addEventListener('keydown', ecoute)
    return () => window.removeEventListener('keydown', ecoute)
  }, [])

  const aCombler = manques(profil)

  const charge = useCallback(async (clos: boolean) => {
    if (aCombler.length) { setToutes([]); return }
    setErreur(null)
    try {
      setToutes(await api.deck(clos))
    } catch (e) {
      setToutes([])
      setErreur(e instanceof ErreurApi ? e.message : 'Le deck n’a pas pu être chargé.')
    }
  }, [aCombler.length])

  // on ne recharge que si le jeu change (ouvertes ↔ closes) ; le reste filtre sur place
  useEffect(() => { void charge(Boolean(filtres.clos)) }, [charge, filtres.clos])

  const offres = useMemo(() => (toutes ? resultats(toutes, filtres) : null), [toutes, filtres])
  const comptes = useMemo(() => (toutes ? compteurs(toutes, filtres) : null), [toutes, filtres])

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
    setToutes((l) => (l ?? []).filter((x) => x.id !== o.id))
    setDernier(o)
    try {
      const r = await api.swipe(o.id, decision)
      if (decision === 'oui') setEnvoyee({ offre: o, entrainement: o.statut === 'close' && r.ok })
      onDecision?.()
    } catch (e) {
      setToutes((l) => [o, ...(l ?? [])])
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
      setToutes((l) => [dernier, ...(l ?? [])])
      setDernier(null)
      onDecision?.()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Impossible de revenir en arrière.')
    } finally {
      setEnCours(false)
    }
  }

  /* ← passer, → candidater, ↓ plus tard, Retour arrière : revenir, Espace : page
     suivante. Jamais pendant une saisie, ni quand une feuille est ouverte. */
  clavier.current = (e: KeyboardEvent) => {
    const cible = e.target as HTMLElement | null
    if (cible?.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return
    if (!courante || enCours || detail || envoyee || panneauFiltres) return
    if (e.key === 'ArrowRight') { e.preventDefault(); void decide(courante, 'oui') }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); void decide(courante, 'non') }
    else if (e.key === 'ArrowDown') { e.preventDefault(); void decide(courante, 'plus_tard') }
    else if (e.key === 'Backspace' && dernier) { e.preventDefault(); void reviens() }
    else if (e.key === ' ') { e.preventDefault(); window.dispatchEvent(new Event('aj:page-suivante')) }
  }

  const actifs = nbActifs(filtres)
  const toutEffacer = () => { setFiltres(efface); setRecherche('') }

  return (
    <div className="screen" id="ec-swipe">
      <div className="stack">
        <div className="filters filtres-avp" ref={barreFiltres}>
          <input
            type="search" className="recherche" value={recherche} placeholder="Chercher un poste, un mot, un service…"
            onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher dans les offres"
          />
          {comptes && (
            <BarreFiltres f={filtres} total={offres?.length ?? 0} actifs={actifs}
              ouvre={() => setPanneauFiltres(true)} change={setFiltres} toutEffacer={toutEffacer} />
          )}
        </div>

        <div className="zone-deck">
          {offres === null && <div className="empty"><div><Attente texte="Chargement des offres…" centre /></div></div>}

          {offres !== null && !courante && (
            <div className="empty">
              <div>
                <h2>{actifs ? 'Aucune offre avec ces filtres' : 'Tu as vu tout ce qui correspond'}</h2>
                <p>
                  {erreur ?? (actifs
                    ? 'Tes filtres sont trop stricts pour ce qui reste : retire-en un, ou efface-les tous.'
                    : 'Aucune autre offre ouverte aujourd’hui. Les AVP de l’OPT-NC arrivent au fil de l’eau — reviens demain, ou entraîne-toi sur les offres closes.')}
                </p>
                <div className="btns vide-actions">
                  {actifs > 0 && <button className="btn primaire" onClick={toutEffacer}>Effacer les filtres</button>}
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

        {courante && <Panneau offre={courante} profil={profil} />}
      </div>

      {detail && (
        <Feuille onFermer={() => setDetail(null)}>
          <Detail offre={detail} profil={profil} />
          <div className="btns" style={{ marginTop: 'var(--s5)' }}>
            <button className="btn primaire" onClick={() => setDetail(null)}>Fermer</button>
          </div>
        </Feuille>
      )}

      {panneauFiltres && comptes && (
        <Feuille onFermer={() => setPanneauFiltres(false)}>
          <PanneauFiltres f={filtres} comptes={comptes} total={offres?.length ?? 0} actifs={actifs}
            change={setFiltres} toutEffacer={toutEffacer} fermer={() => setPanneauFiltres(false)} />
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

type Maj = (maj: (f: Filtres) => Filtres) => void

const libelleValeur = (cle: Categorie, v: string) => (cle === 'directions' ? libDirection(v) : v)

/* La barre : la recherche, le bouton qui ouvre le panneau, puis les filtres
   ACTIFS seulement, chacun retirable d'une croix. On voit d'un coup d'œil ce
   qui filtre, et le nombre d'offres qui restent. */
function BarreFiltres({ f, total, actifs, ouvre, change, toutEffacer }: {
  f: Filtres; total: number; actifs: number; ouvre: () => void; change: Maj; toutEffacer: () => void
}) {
  const nbFiltres = actifs - (f.q ? 1 : 0)
  return (
    <>
      <button type="button" className={`chip ouvre-filtres${nbFiltres ? ' on' : ''}`} onClick={ouvre} aria-haspopup="dialog">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Filtres{nbFiltres > 0 && <span className="pastille">{nbFiltres}</span>}
      </button>
      {f.clos && (
        <button className="chip actif" onClick={() => change((g) => ({ ...efface(g), q: g.q, clos: undefined }))}>
          Offres closes <span className="croix" aria-hidden="true">✕</span>
        </button>
      )}
      {CATEGORIES.flatMap(({ cle, titre }) => (f[cle] ?? []).map((v) => (
        <button key={`${cle}:${v}`} className="chip actif" aria-label={`Retirer le filtre ${titre} : ${libelleValeur(cle, v)}`}
          onClick={() => change((g) => basculeValeur(g, cle, v))}>
          {libelleValeur(cle, v)} <span className="croix" aria-hidden="true">✕</span>
        </button>
      )))}
      {OPTIONS.filter(({ cle }) => f[cle]).map(({ cle, titre }) => (
        <button key={cle} className="chip actif" aria-label={`Retirer le filtre ${titre}`}
          onClick={() => change((g) => basculeOption(g, cle))}>
          {titre} <span className="croix" aria-hidden="true">✕</span>
        </button>
      ))}
      {actifs > 0 && <button className="lien-efface" onClick={toutEffacer}>Tout effacer</button>}
      <span className="filtres-total" aria-live="polite"><b>{total}</b> offre{total > 1 ? 's' : ''}</span>
    </>
  )
}

/* Le panneau : une section par catégorie, des cases à cocher avec, pour
   chacune, le nombre d'offres qu'on verrait en la cochant compte tenu du reste.
   Plusieurs cases dans une section = l'une OU l'autre ; d'une section à
   l'autre = les deux. Le bouton du bas dit combien d'offres on va voir. */
function PanneauFiltres({ f, comptes, total, actifs, change, toutEffacer, fermer }: {
  f: Filtres; comptes: Compteurs; total: number; actifs: number; change: Maj; toutEffacer: () => void; fermer: () => void
}) {
  const ligne = (cle: string, coche: boolean, nom: string, n: number, agir: () => void) => (
    <label key={cle} className={`pf-ligne${!coche && n === 0 ? ' vide' : ''}`}>
      <input type="checkbox" checked={coche} disabled={!coche && n === 0} onChange={agir} />
      <span className="pf-nom">{nom}</span>
      <span className="pf-n">{n}</span>
    </label>
  )
  return (
    <div className="pf">
      <div className="pf-tete">
        <h2>Filtres</h2>
        <p>{total} offre{total > 1 ? 's' : ''} correspond{total > 1 ? 'ent' : ''}</p>
      </div>

      <div className="pf-jeu" role="radiogroup" aria-label="Offres à afficher">
        <button role="radio" aria-checked={!f.clos} className={!f.clos ? 'on' : ''}
          onClick={() => change((g) => ({ ...efface(g), q: g.q, clos: undefined }))}>Ouvertes</button>
        <button role="radio" aria-checked={Boolean(f.clos)} className={f.clos ? 'on' : ''}
          onClick={() => change((g) => ({ ...efface(g), q: g.q, clos: true }))}>Closes (entraînement)</button>
      </div>

      {CATEGORIES.map(({ cle, titre }) => {
        const valeurs = comptes.categories[cle]
        if (valeurs.length < 2 && !f[cle]?.length) return null       // une seule valeur ne filtre rien
        return (
          <section key={cle} className="pf-section">
            <h3>{titre}{f[cle]?.length ? <span className="pf-choix">{f[cle]!.length} choisi{f[cle]!.length > 1 ? 's' : ''}</span> : null}</h3>
            <div className="pf-lignes">
              {valeurs.map((x) => ligne(`${cle}:${x.valeur}`, Boolean(f[cle]?.includes(x.valeur)),
                libelleValeur(cle, x.valeur), x.n, () => change((g) => basculeValeur(g, cle, x.valeur))))}
            </div>
          </section>
        )
      })}

      <section className="pf-section">
        <h3>Options</h3>
        <div className="pf-lignes">
          {OPTIONS.map(({ cle, titre }) => ligne(`o:${cle}`, Boolean(f[cle]), titre, comptes.options[cle],
            () => change((g) => basculeOption(g, cle))))}
        </div>
      </section>

      <div className="pf-pied">
        <button className="btn" disabled={actifs === 0} onClick={toutEffacer}>Tout effacer</button>
        <button className="btn primaire" onClick={fermer}>Voir {total} offre{total > 1 ? 's' : ''}</button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ la carte */

/* Les pages de la carte, une par idée : ce qu'on a en commun, les missions,
   les compétences attendues (dans les mots de l'AVP), le score, les écarts. */
const plat = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Les compétences de la personne, pour surligner celles que le poste demande (de l'affichage, pas un score). */
function motsDuProfil(p: Profil): string[] {
  return [...p.competences, ...p.competencesOpt.map((c) => c.nom)]
    .map((x) => plat(x.trim())).filter((x) => x.length >= 3)
}
function jeLAi(texte: string, mots: string[]): boolean {
  const t = plat(texte)
  return mots.some((m) => t.includes(m) || (t.length >= 4 && m.includes(t)))
}

/** La première phrase de la description, sans dépasser deux lignes de carte. */
function accroche(o: Offre): string | null {
  const d = (o.description ?? '').split('•')[0]!.trim()
  if (!d) return null
  const phrase = /^(.{40,220}?[.!?])(\s|$)/.exec(d)?.[1] ?? d
  return phrase.length > 220 ? `${phrase.slice(0, 217).trimEnd()}…` : phrase
}

/* Les pages de la carte, une par idée. La première suffit à comprendre l'offre :
   une phrase sur le poste et ses premières missions. */
function pagesDe(o: Offre, p: Profil): { titre: string; corps: React.ReactNode }[] {
  const phrase = accroche(o)
  const pages: { titre: string; corps: React.ReactNode }[] = [{
    titre: 'L’essentiel',
    corps: (
      <>
        {phrase && <p className="desc accroche">{phrase}</p>}
        {o.responsabilites.length > 0 && (
          <ul className="missions">{o.responsabilites.slice(0, 3).map((m) => <li key={m}>{m}</li>)}</ul>
        )}
        {!phrase && !o.responsabilites.length && (
          <div className="tags">{[o.metierOpt, ...o.familles].filter((t): t is string => Boolean(t)).map((t) => <span key={t}>{t}</span>)}</div>
        )}
      </>
    ),
  }]

  if (o.responsabilites.length > 3) {
    pages.push({
      titre: 'Toutes les missions',
      corps: <ul className="missions">{o.responsabilites.map((m) => <li key={m}>{m}</li>)}</ul>,
    })
  }

  if (o.competencesTexte.length) {
    const mots = motsDuProfil(p)
    const ok = o.competencesTexte.filter((c) => jeLAi(c.texte, mots)).length
    pages.push({
      titre: ok ? `Ce que le poste demande · ${ok} chez toi` : 'Ce que le poste demande',
      corps: (
        <div className="tags">
          {o.competencesTexte.slice(0, 12).map((c) => (
            <span key={c.texte} className={jeLAi(c.texte, mots) ? 'has' : c.type === 'connaissance' ? 'doux' : ''}>{c.texte}</span>
          ))}
        </div>
      ),
    })
  }
  return pages
}

/** « Office des postes et télécommunications… » sur chaque carte : OPT-NC suffit. */
function employeur(o: Offre): string {
  const e = o.entreprise ?? ''
  return /^office des postes/i.test(e) ? 'OPT-NC' : e
}


const SEUIL = 90          // pixels au-delà desquels le glissé vaut décision

function Carte({ offre: o, profondeur, profil, peutRevenir, occupe, onDetail, onDecide, onRetour }: {
  offre: Offre
  profondeur: number
  profil: Profil
  peutRevenir?: boolean
  occupe?: boolean
  onDetail?: () => void
  onDecide?: (d: Decision) => void
  onRetour?: () => void
}) {
  const pages = useMemo(() => pagesDe(o, profil), [o, profil])
  const [page, setPage] = useState(0)

  // espace (clavier) : page suivante, sur la carte du dessus seulement
  useEffect(() => {
    if (profondeur !== 0) return
    const suivante = () => setPage((p) => (p + 1) % pages.length)
    window.addEventListener('aj:page-suivante', suivante)
    return () => window.removeEventListener('aj:page-suivante', suivante)
  }, [profondeur, pages.length])
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
  const fin = (e: React.PointerEvent) => {
    if (!depart.current) return
    const aGlisse = capture.current
    const boite = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const aGauche = e.clientX - boite.left < boite.width / 3
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
    if (!aGlisse && pages.length > 1) {
      setPage((p) => (aGauche ? (p - 1 + pages.length) % pages.length : (p + 1) % pages.length))
    }
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
      <span className={`teinte ${dx > 0 ? 'oui' : 'non'}`} aria-hidden="true"
        style={{ opacity: Math.min(1, Math.abs(dx) / SEUIL) }} />
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
            {employeur(o)}{o.direction ? ` · ${libDirection(o.direction)}` : o.secteur ? ` · ${o.secteur}` : ''}
          </div>
          <div className="cles">
            {(o.ville ?? o.zone) && <span className="cle">{o.ville ?? o.zone}</span>}
            <span className="cle">{o.contrat}</span>
            {o.joursRestants !== null && o.joursRestants >= 0 && (
              <span className={`cle${o.joursRestants <= 7 ? ' urgent' : ''}`}>
                {o.joursRestants === 0 ? 'Dernier jour' : `Clôture dans ${o.joursRestants} j`}
              </span>
            )}
            {o.codeMetier && profil.metiersOpt.some((m) => m.code === o.codeMetier) && <span className="cle moi">Dans tes métiers visés</span>}
            {profil.zones.includes(o.zone) && <span className="cle moi">Dans ta zone</span>}
          </div>
        </div>

        <div className="pagebox">
          {courante.titre && (
            <div className="page-lead">
              {courante.titre}
              {pages.length > 1 && <span className="page-n" aria-label={`page ${page + 1} sur ${pages.length}`}>{page + 1}/{pages.length}</span>}
            </div>
          )}
          <div ref={corps} className={`page-body${deborde ? ' deborde' : ''}`}>{courante.corps}</div>
        </div>
      </div>

      <div className="facts">
        <div className="line">
          {o.province && <span>{o.province}</span>}
          <span>{o.teletravail === 'non' ? 'sur site' : `télétravail ${o.teletravail}`}</span>
          {o.debut && <span>dès {o.debut}</span>}
          {o.experienceMin > 0 && <span>{o.experienceMin} ans d’expérience</span>}
          {o.nbAgentsEncadres ? <span>encadre {o.nbAgentsEncadres} agents</span> : null}
          {o.salaire?.[0] ? <em>{kf(o.salaire[0])}{o.salaire[1] ? ` – ${kf(o.salaire[1])}` : ''} XPF</em> : null}
        </div>
      </div>

      {jouable && (
        <div className="coins" onPointerDown={(e) => e.stopPropagation()}>
          <div className="coin">
            <button type="button" className="retour" disabled={!peutRevenir}
              onClick={(e) => { e.stopPropagation(); onRetour?.() }} aria-label="Revenir sur la dernière décision">
              <svg><use href="#i-undo" /></svg>
            </button>
            <span>Retour</span>
          </div>
          <div className="coin">
            <button type="button" className="non"
              onClick={(e) => { e.stopPropagation(); onDecide?.('non') }} aria-label="Passer">
              <svg><use href="#i-x" /></svg>
            </button>
            <span>Passer</span>
          </div>
          <div className="coin">
            <button type="button" className="fav"
              onClick={(e) => { e.stopPropagation(); onDecide?.('plus_tard') }} aria-label="Plus tard">
              <svg><use href="#i-star" /></svg>
            </button>
            <span>Plus tard</span>
          </div>
          <div className="coin">
            <button type="button" className="oui"
              onClick={(e) => { e.stopPropagation(); onDecide?.('oui') }} aria-label={close ? 'M’entraîner' : 'Candidater'}>
              <svg><use href="#i-heart" /></svg>
            </button>
            <span>{close ? 'S’entraîner' : 'Candidater'}</span>
          </div>
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

/* ------------------------------------------------- le détail de l'offre */

/** « SECTION MAGASINS ET TRANSPORTS » → « Section magasins et transports » (les AVP arrivent en capitales). */
function casse(t: string | null): string | null {
  if (!t) return null
  if (t !== t.toUpperCase() || !/[A-ZÀ-Ý]/.test(t)) return t
  const bas = t.toLowerCase().replace(/[a-zà-ÿ']+/g, (m) => ACCENTS[m] ?? m)
  return bas.charAt(0).toUpperCase() + bas.slice(1)
}
const date = (d: string | null) => {
  if (!d) return null
  const t = new Date(`${d.slice(0, 10)}T12:00:00`)
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* L'en-tête : l'employeur et la direction, le poste, puis les mêmes pastilles
   que sur la carte (lieu, contrat, clôture, repères du profil). */
export function BlocEntete({ offre: o, profil }: { offre: Offre; profil?: Profil }) {
  return (
    <header className="do-entete">
      <div className="do-org">{employeur(o)}{o.direction ? ` · ${libDirection(o.direction)}` : ''}</div>
      <h2 className="do-titre">{o.titre}</h2>
      <div className="cles">
        {(o.ville ?? o.zone) && <span className="cle">{o.ville ?? o.zone}</span>}
        <span className="cle">{o.contrat}</span>
        {o.teletravail !== 'non' && <span className="cle">Télétravail {o.teletravail}</span>}
        {o.joursRestants !== null && o.joursRestants >= 0 && (
          <span className={`cle${o.joursRestants <= 7 ? ' urgent' : ''}`}>
            {o.joursRestants === 0 ? 'Dernier jour' : `Clôture dans ${o.joursRestants} j`}
          </span>
        )}
        {o.joursRestants !== null && o.joursRestants < 0 && <span className="cle">Close</span>}
        {profil && o.codeMetier && profil.metiersOpt.some((m) => m.code === o.codeMetier) && <span className="cle moi">Dans tes métiers visés</span>}
        {profil && profil.zones.includes(o.zone) && <span className="cle moi">Dans ta zone</span>}
      </div>
    </header>
  )
}

/* Le poste : la description, les missions, puis ce qu'il demande, rangé en
   savoir-faire et connaissances (celles qu'on a déjà sont surlignées). */
export function BlocPoste({ offre: o, profil }: { offre: Offre; profil?: Profil }) {
  const [tete, ...puces] = (o.description ?? '').split('•').map((x) => x.trim()).filter(Boolean)
  const mots = profil ? motsDuProfil(profil) : []
  const savoirFaire = o.competencesTexte.filter((c) => c.type !== 'connaissance')
  const connaissances = o.competencesTexte.filter((c) => c.type === 'connaissance')
  const acquises = o.competencesTexte.filter((c) => jeLAi(c.texte, mots)).length
  const etiquettes = (l: { texte: string }[]) => (
    <div className="tags">
      {l.map((c) => <span key={c.texte} className={jeLAi(c.texte, mots) ? 'has' : ''}>{c.texte}</span>)}
    </div>
  )
  return (
    <div className="do-poste">
      {tete && (
        <section>
          <h3>Le poste</h3>
          <p className="do-desc">{tete}</p>
          {puces.length > 0 && <ul className="do-liste">{puces.map((m) => <li key={m}>{m}</li>)}</ul>}
        </section>
      )}
      {o.responsabilites.length > 0 && (
        <section>
          <h3>Missions <span className="do-n">{o.responsabilites.length}</span></h3>
          <ul className="do-liste">{o.responsabilites.map((m) => <li key={m}>{m}</li>)}</ul>
        </section>
      )}
      {o.competencesTexte.length > 0 && (
        <section>
          <h3>Ce que le poste demande{acquises > 0 && <span className="do-acquis">{acquises} chez toi</span>}</h3>
          {savoirFaire.length > 0 && <><div className="do-sous">Savoir-faire et savoir-être</div>{etiquettes(savoirFaire)}</>}
          {connaissances.length > 0 && <><div className="do-sous">Connaissances</div>{etiquettes(connaissances)}</>}
        </section>
      )}
    </div>
  )
}

/* « En bref » : les faits de l'AVP, sans capitales criardes, dates en clair. */
export function EnBref({ offre: o }: { offre: Offre }) {
  const lignes: [string, React.ReactNode][] = []
  const ajoute = (k: string, v: React.ReactNode) => { if (v) lignes.push([k, v]) }
  ajoute('Direction', o.direction ? libDirection(o.direction) : null)
  ajoute('Unité', casse(o.unite))
  ajoute('Métier OPT', o.metierOpt ? `${casse(o.metierOpt)}${o.codeMetier ? ` (${o.codeMetier})` : ''}` : null)
  ajoute('Famille', o.familles.join(', '))
  ajoute('Lieu', [casse(o.lieu), o.adresse].filter(Boolean).join(', '))
  ajoute('Prise de poste', o.debut ? (/^\d{4}-\d{2}/.test(o.debut) ? date(`${o.debut}-01`)?.replace(/^1er? /, '') : o.debut) : null)
  ajoute('Expérience', o.experienceTexte)
  ajoute('Horaires', o.conditions)
  ajoute('Habilitations', o.qualifications)
  ajoute('Conditions physiques', o.exigencesPhysiques)
  ajoute('Indemnités', o.avantages)
  ajoute('Publiée le', date(o.datePublication ?? o.publiee))
  ajoute('Clôture le', date(o.expire))
  ajoute('Référence', o.reference)
  return (
    <aside className="do-bref">
      <h3>En bref</h3>
      <dl>{lignes.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {o.url && <a className="do-lien" href={o.url} target="_blank" rel="noreferrer">Fiche métier OPT-NC ↗</a>}
    </aside>
  )
}

/** Le détail complet : à côté du deck, dans une feuille sur téléphone, dans Candidatures. */
export function Detail({ offre: o, profil }: { offre: Offre; profil?: Profil }) {
  return (
    <div className="detail-offre">
      <div className="do-principal">
        <BlocEntete offre={o} profil={profil} />
        <BlocPoste offre={o} profil={profil} />
      </div>
      <EnBref offre={o} />
    </div>
  )
}

function Panneau({ offre: o, profil }: { offre: Offre; profil: Profil }) {
  return (
    <aside className="side panneau" id="side">
      <Detail offre={o} profil={profil} />
    </aside>
  )
}

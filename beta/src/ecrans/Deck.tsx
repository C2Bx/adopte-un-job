/* Le deck : les AVP réels de l'OPT-NC, lus dans l'API de l'équipe une fois par
   chargement. Les filtres s'appliquent ensuite dans le navigateur (filtres.ts) :
   plusieurs choix par catégorie, compteurs qui disent ce qu'on verrait en
   touchant une puce, effet instantané. Le glissé gauche/droite reste le geste
   du produit ; un « oui » est une candidature. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Feuille } from '../Dialogue'
export { Feuille } from '../Dialogue'

import { api } from '../api'
import { useSelectionComparaison } from '../comparaison'
import type { Adequation, CompteurOffres } from '../api'
import { useAdequations } from '../adequation'
import { BlocAdequation, PastilleAdequation } from './Adequation'
import { manques } from '../regles'
import { CommandesOffres, ListeOffres, CarnetOffre, useLocal } from './OutilsOffres'
import { choixPersistes, idOffrePartagee, limiteComparaison, trieOffres } from '../upgrade'
import type { VueOffres, TriOffres } from '../upgrade'
import { ApercuDocument } from './RelectureDocument'
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
  versComparaison: () => void
  versProfil: (etape: number) => void
  /** Prévient la coquille qu'une décision a changé, pour ses pastilles. */
  onDecision?: () => void
  avantDecision: () => Promise<void>
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
      if ((ev.target as HTMLElement).closest('input, textarea, select, button, a')) return   // on saisit, on ne glisse pas
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

export function EcranDeck({ profil, versProfil, onDecision, avantDecision, versComparaison }: Props) {
  const barreFiltres = useGlisseHorizontal<HTMLDivElement>()
  // toutes les offres du jeu courant (ouvertes ou closes) ; les filtres s'y appliquent sans réseau
  const [toutes, setToutes] = useState<Offre[] | null>(null)
  // ce que l'OPT-NC a d'ouvert en ce moment (route publique) : un écran vide qui dit vrai
  const [compteur, setCompteur] = useState<CompteurOffres | null>(null)
  useEffect(() => { void api.compteurOffres().then(setCompteur) }, [])
  const aucuneOuverte = compteur !== null && compteur.actifs === 0
  // l'adéquation du profil avec chaque offre (CV-Matching, MS5), par référence d'AVP
  const adequations = useAdequations(profil)
  const adequationDe = (o: Offre | null | undefined) => (o?.reference ? adequations.get(o.reference) : undefined)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [envoyee, setEnvoyee] = useState<Offre | null>(null)
  const [detail, setDetail] = useState<Offre | null>(null)
  const [filtres, setFiltres, erreurStockage] = useLocal<Filtres>('filtres', {})
  const [recherche, setRecherche] = useState(filtres.q ?? '')
  const [presentation, setPresentation] = useLocal('presentation', choixPersistes(null))
  const { vue, tri } = choixPersistes(presentation)
  const changeVue = (v: VueOffres) => setPresentation({ vue: v, tri })
  const changeTri = (t: TriOffres) => setPresentation({ vue, tri: t })
  const [selection, setSelection] = useSelectionComparaison()
  const [validation, setValidation] = useState<{ offre: Offre; doc: Record<string, unknown>; cv: string | null } | null>(null)
  const [preparation, setPreparation] = useState(false)
  const [confirmer, setConfirmer] = useLocal('confirmer-candidature', true)
  const [partageErreur, setPartageErreur] = useState('')
  useEffect(() => {
    const id = idOffrePartagee()
    if (id === null) return
    let actif = true
    void api.offresDisponibles().then((l) => {
      if (!actif) return
      const offre = l.find((o) => o.id === id)
      if (offre) setDetail(offre)
      else setPartageErreur('Cette offre n’est plus disponible dans la liste actuelle.')
    }).catch(() => { if (actif) setPartageErreur('L’offre partagée n’a pas pu être chargée. Réessaie plus tard.') })
    return () => { actif = false }
  }, [])
  // le panneau des filtres (une feuille, sur téléphone comme sur ordinateur)
  const [panneauFiltres, setPanneauFiltres] = useState(false)
  // sur téléphone, la recherche s'ouvre en feuille depuis la loupe de la barre du haut
  const [rechercheOuverte, setRechercheOuverte] = useState(false)
  const [dernier, setDernier] = useState<Offre | null>(null)
  const vu = useRef<Set<number>>(new Set())
  // raccourcis clavier : la fonction est remise à jour à chaque rendu (elle lit l'état courant)
  const clavier = useRef<((e: KeyboardEvent) => void) | null>(null)
  useEffect(() => {
    const ecoute = (e: KeyboardEvent) => clavier.current?.(e)
    window.addEventListener('keydown', ecoute)
    return () => window.removeEventListener('keydown', ecoute)
  }, [])

  // la loupe et l'entonnoir de la barre du haut (sur téléphone) pilotent le deck
  useEffect(() => {
    const ouvreRecherche = () => setRechercheOuverte(true)
    const ouvreFiltres = () => setPanneauFiltres(true)
    document.addEventListener('aj:recherche', ouvreRecherche)
    document.addEventListener('aj:filtres', ouvreFiltres)
    return () => {
      document.removeEventListener('aj:recherche', ouvreRecherche)
      document.removeEventListener('aj:filtres', ouvreFiltres)
    }
  }, [])

  const aCombler = manques(profil)

  const charge = useCallback(async (clos: boolean) => {
    setErreur(null)
    try {
      setToutes(await api.deck(clos))
    } catch (e) {
      setToutes([])
      setErreur(e instanceof ErreurApi ? e.message : 'Le deck n’a pas pu être chargé.')
    }
  }, [])

  // on ne recharge que si le jeu change (ouvertes ↔ closes) ; le reste filtre sur place
  useEffect(() => { void charge(Boolean(filtres.clos)) }, [charge, filtres.clos])

  const offres = useMemo(() => (toutes ? trieOffres(resultats(toutes, filtres), tri, adequations) : null), [toutes, filtres, tri, adequations])
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

  const envoieDecision = async (o: Offre, decision: Decision) => {
    if (o.statut === 'close') return
    setEnCours(true)
    // On retire la carte tout de suite : attendre le réseau pour la faire
    // disparaître donnerait l'impression que le geste n'a pas été pris.
    setToutes((l) => (l ?? []).filter((x) => x.id !== o.id))
    setDernier(o)
    try {
      await avantDecision()
      await api.swipe(o.id, decision)
      if (decision === 'oui') setEnvoyee(o)
      onDecision?.()
    } catch (e) {
      setToutes((l) => [o, ...(l ?? [])])
      setDernier(null)
      setErreur(e instanceof ErreurApi ? e.message : 'La décision n’a pas été enregistrée.')
    } finally {
      setEnCours(false)
    }
  }

  const decide = async (o: Offre, decision: Decision) => {
    if (enCours || preparation || o.statut === 'close') return
    if (decision === 'oui' && aCombler.length) { versProfil(aCombler[0]!.etape); return }
    if (decision !== 'oui' || !confirmer) { await envoieDecision(o, decision); return }
    setPreparation(true); setErreur(null)
    try {
      await avantDecision()
      const [doc, fichiers] = await Promise.all([api.exporteProfil(), api.cvs()])
      setValidation({ offre: o, doc, cv: fichiers.actif?.nom ?? null })
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Le récapitulatif n’a pas pu être préparé.') }
    finally { setPreparation(false) }
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

  /* ← passer, → candidater, ↑/↓ favoris, Retour arrière : revenir, Espace : page
     suivante. Jamais pendant une saisie, ni quand une feuille est ouverte. */
  clavier.current = (e: KeyboardEvent) => {
    if (document.querySelector('dialog[open], .guide-voile')) return
    const cible = e.target as HTMLElement | null
    if (cible?.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return
    if (!courante || courante.statut === 'close' || enCours || preparation || validation || vue !== 'cartes' || detail || envoyee || panneauFiltres || rechercheOuverte) return
    if (e.key === 'ArrowRight') { e.preventDefault(); void decide(courante, 'oui') }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); void decide(courante, 'non') }
    else if (e.key === 'ArrowUp') { e.preventDefault(); void decide(courante, 'plus_tard') }
    else if (e.key === 'ArrowDown') { e.preventDefault(); void decide(courante, 'plus_tard') }
    else if (e.key === 'Backspace' && dernier) { e.preventDefault(); void reviens() }
    else if (e.key === ' ') { e.preventDefault(); window.dispatchEvent(new Event('aj:page-suivante')) }
  }

  const [presentationOuverte, setPresentationOuverte] = useState(false)
  const actifs = nbActifs(filtres)
  const toutEffacer = () => { setFiltres(efface); setRecherche('') }

  return (
    <div className={`screen upgrade-deck ${vue !== 'cartes' ? 'upgrade-vue-liste' : ''} ${offres !== null && !courante ? 'deck-vide' : ''}`} id="ec-swipe">
      <div className="deck-contenu">
      <div className="upgrade-haut">
        <div className="ui-titre-page"><div><p className="ui-surtitre">Les postes de l’OPT-NC</p><h1>Offres</h1></div><span className="ui-badge">Cartes · liste · tableau</span></div>
        <button type="button" className="btn-mini ui-comparer-ouvrir" onClick={versComparaison}>Comparer{selection.length ? ` (${selection.length})` : ''}</button>
        <button type="button" className="btn-mini ui-presentation" aria-haspopup="dialog" onClick={() => setPresentationOuverte(true)}>Affichage et tri</button>
        {aCombler.length > 0 && <p>Tu peux consulter les offres. <button className="btn-mini" onClick={() => versProfil(aCombler[0]!.etape)}>Compléter mon profil avant de candidater</button></p>}
        {(erreurStockage || partageErreur) && <p role="status">{partageErreur || 'Les filtres ne peuvent pas être conservés dans ce navigateur.'}</p>}

        {erreur && <div role="alert" className="pal manque">{erreur}<button className="btn-mini" onClick={() => void charge(Boolean(filtres.clos))}>Réessayer le chargement</button></div>}
      </div>
      <div className="stack">
        <div className="filters filtres-avp" ref={barreFiltres}>
          <input
            type="search" className="recherche" value={recherche} placeholder="Chercher un poste, un mot, un service…"
            onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher dans les offres"
          />
          {comptes && <div className="filtres-rapides">
            {(['villes', 'contrats'] as const).map((cle) => <label key={cle}><span>{cle === 'villes' ? 'Lieu' : 'Contrat'}</span><select aria-label={cle === 'villes' ? 'Filtrer par lieu' : 'Filtrer par contrat'} value={(filtres[cle]?.length ?? 0) > 1 ? '__plusieurs' : filtres[cle]?.[0] ?? ''} onChange={(e) => setFiltres((g) => ({ ...g, [cle]: e.target.value ? [e.target.value] : undefined }))}>
              <option value="">{cle === 'villes' ? 'Tous les lieux' : 'Tous les contrats'}</option>
              {(filtres[cle]?.length ?? 0) > 1 && <option value="__plusieurs" disabled>{filtres[cle]!.length} sélectionnés</option>}
              {comptes.categories[cle].map((x) => <option key={x.valeur} value={x.valeur}>{libelleValeur(cle, x.valeur)} ({x.n})</option>)}
            </select></label>)}
          </div>}
          {comptes && (
            <BarreFiltres f={filtres} total={offres?.length ?? 0} actifs={actifs}
              ouvre={() => setPanneauFiltres(true)} change={setFiltres} toutEffacer={toutEffacer} />
          )}
        </div>

        <div className={`zone-deck${!courante ? ' zone-vide' : ''}`}>
          {offres === null && <div className="empty"><div><Attente texte="Chargement des offres…" centre /></div></div>}

          {offres !== null && !courante && (
            <div className="empty">
              <div>
                <h2>{actifs ? 'Aucune offre avec ces filtres'
                  : aucuneOuverte && !filtres.clos ? 'Aucune offre ouverte en ce moment'
                  : 'Tu as vu tout ce qui te correspond'}</h2>
                <p>
                  {erreur ?? (actifs
                    ? 'Tes filtres sont trop stricts pour ce qui reste : retire-en un, ou efface-les tous.'
                    : aucuneOuverte && !filtres.clos
                      ? `Aucun avis n’est ouvert sur la plateforme en ce moment (${compteur?.expires ?? 0} clos). Les AVP arrivent au fil de l’eau — reviens demain, ou consulte les offres closes.`
                      : 'Aucune autre offre ouverte aujourd’hui. Les AVP de l’OPT-NC arrivent au fil de l’eau — reviens demain, ou consulte les offres closes.')}
                </p>
                <div className="btns vide-actions">
                  {actifs > 0 && <button className="btn primaire" onClick={toutEffacer}>Effacer les filtres</button>}
                  {!filtres.clos && <button className="btn" onClick={() => setFiltres((f) => ({ ...f, clos: true }))}>Consulter les offres closes</button>}
                </div>
              </div>
            </div>
          )}

          {vue === 'cartes' && offres !== null && !courante && <ActionsOffre close={false} vide occupe={enCours || preparation} peutRevenir={Boolean(dernier)} onRetour={() => void reviens()} onDecide={() => {}} />}

          {vue !== 'cartes' && offres && <ListeOffres offres={offres} scores={adequations} tableau={vue === 'tableau'} ouvrir={setDetail}
            comparer={(id) => setSelection(limiteComparaison(selection, id))} selection={selection} />}
          {vue === 'cartes' && suivante && (
            <div className="deck-fond" aria-hidden="true" />
          )}

          {vue === 'cartes' && courante && (
            <Carte
              key={courante.id}
              offre={courante}
              profondeur={0}
              profil={profil}
              occupe={enCours || preparation}
              onDetail={() => { setDetail(courante); void api.vue(courante.id, 'detail') }}
              onDecide={courante.statut === 'close' ? undefined : (d) => void decide(courante, d)}
              adequation={adequationDe(courante)}
              ouvrirOutils={() => setPanneauFiltres(true)}
              nbFiltres={actifs}
              comparer={() => setSelection(limiteComparaison(selection, courante.id))}
              comparee={selection.includes(courante.id)}
              comparaisonPleine={selection.length >= 3}
              actions={<ActionsOffre close={courante.statut === 'close'} vide={false} occupe={enCours || preparation} peutRevenir={Boolean(dernier)} onRetour={() => void reviens()} onDecide={(d) => void decide(courante, d)} />}
            />
          )}
        </div>

        {vue === 'cartes' && courante && <Panneau offre={courante} profil={profil} adequation={adequationDe(courante)} />}
      </div>

      </div>


      {presentationOuverte && <Feuille titre="Affichage, tri et recherches" onFermer={() => setPresentationOuverte(false)}>
        <CommandesOffres vue={vue} tri={tri} changeVue={changeVue} changeTri={changeTri} filtres={filtres} changeFiltres={(f) => { setFiltres(f); setRecherche(f.q ?? '') }} />
        <div className="ui-options"><label><input type="checkbox" checked={confirmer} onChange={(e) => setConfirmer(e.target.checked)} /> Relire mon dossier avant chaque candidature</label></div>
      </Feuille>}
      {detail && (
        <Feuille onFermer={() => setDetail(null)}>
          <Detail offre={detail} profil={profil} adequation={adequationDe(detail)} />
          <div className="upgrade-rangee">
            <button className="btn-mini" disabled={selection.length >= 3 && !selection.includes(detail.id)} onClick={() => setSelection(limiteComparaison(selection, detail.id))}>{selection.includes(detail.id) ? 'Retirer du comparateur' : 'Comparer cette offre'}</button>
            {detail.statut !== 'close' && <>
              <button className="btn primaire" disabled={enCours || preparation} onClick={() => { const o = detail; setDetail(null); void decide(o, 'oui') }}>Candidater</button>
              <button className="btn-mini" disabled={enCours || preparation} onClick={() => { const o = detail; setDetail(null); void decide(o, 'plus_tard') }}>Mettre en favori</button>
            </>}
          </div>
          <div className="btns" style={{ marginTop: 'var(--s5)' }}>
            <button className="btn primaire" onClick={() => setDetail(null)}>Fermer</button>
          </div>
        </Feuille>
      )}

      {panneauFiltres && comptes && (
        <Feuille titre="Recherche et filtres" onFermer={() => setPanneauFiltres(false)} pied={<div className="pf-pied">
          <button className="btn" disabled={actifs === 0} onClick={toutEffacer}>Tout effacer</button>
          <button className="btn primaire" onClick={() => setPanneauFiltres(false)}>Voir {offres?.length ?? 0} offre{offres?.length !== 1 ? 's' : ''}</button>
        </div>}>
          <div className="outils-pleine-hauteur">
            <label>Rechercher un poste<input type="search" className="recherche-popup" aria-label="Rechercher un poste dans les filtres" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Titre, métier, service…" /></label>
            <button type="button" className="btn-mini" onClick={() => { setPanneauFiltres(false); setPresentationOuverte(true) }}>Affichage et tri</button>
          </div>
          <PanneauFiltres f={filtres} comptes={comptes} total={offres?.length ?? 0} actifs={actifs}
            change={setFiltres} />
        </Feuille>
      )}

      {rechercheOuverte && (
        <Feuille onFermer={() => setRechercheOuverte(false)}>
          <div className="eyebrow">Recherche</div>
          <h2>Un poste, un mot</h2>
          <input
            type="search" className="recherche recherche-popup" autoFocus value={recherche}
            placeholder="Chercher un poste, un mot, un service…"
            onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher dans les offres"
            onKeyDown={(e) => { if (e.key === 'Enter') setRechercheOuverte(false) }}
          />
          <div className="btns" style={{ marginTop: 'var(--s5)' }}>
            {recherche && <button className="btn" onClick={() => setRecherche('')}>Effacer</button>}
            <button className="btn primaire" onClick={() => setRechercheOuverte(false)}>
              Voir {offres?.length ?? 0} offre{(offres?.length ?? 0) > 1 ? 's' : ''}
            </button>
          </div>
        </Feuille>
      )}

      {validation && <Feuille onFermer={() => setValidation(null)}>
        <h2>Relire avant de candidater</h2><h3>{validation.offre.titre}</h3>
        <p>{validation.offre.reference} · clôture : {validation.offre.expire?.slice(0, 10) ?? 'non renseignée'}</p>
        <p>Ton profil enregistré actuellement sera utilisé par l’API de l’équipe. Relis-le avant de confirmer.</p>
        <p>Document CV : {validation.cv ?? 'Aucun document déposé'}</p>
        <ApercuDocument document={validation.doc} />
        <p className="pa">Ce récapitulatif n’est pas une copie figée du dossier chez les recruteurs.</p>
        <button className="btn primaire" disabled={enCours} onClick={() => { const o = validation.offre; setValidation(null); void envoieDecision(o, 'oui') }}>Confirmer ma candidature</button>
        <button className="btn" onClick={() => setValidation(null)}>Annuler</button>
      </Feuille>}
      {envoyee && (
        <Feuille onFermer={() => setEnvoyee(null)}>
          <div className="eyebrow">Candidature envoyée</div>
          <h2>C’est parti</h2>
          <p className="qui">
            Ta candidature pour <b>{envoyee.titre}</b> est chez le recruteur : il lit ton profil et ton CV. Tu suis sa réponse dans « Candidatures ».
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
      {(nbFiltres > 0 || f.clos) && <div className="filtres-selection"><div className="filtres-actifs">
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
      </div><button className="lien-efface" onClick={toutEffacer}>Tout effacer</button></div>}
      <span className="filtres-total" aria-live="polite"><b>{total}</b> offre{total > 1 ? 's' : ''}</span>
    </>
  )
}

/* Le panneau : une section par catégorie, des cases à cocher avec, pour
   chacune, le nombre d'offres qu'on verrait en la cochant compte tenu du reste.
   Plusieurs cases dans une section = l'une OU l'autre ; d'une section à
   l'autre = les deux. Le bouton du bas dit combien d'offres on va voir. */
function PanneauFiltres({ f, comptes, total, actifs, change }: {
  f: Filtres; comptes: Compteurs; total: number; actifs: number; change: Maj
}) {
  const [rechercheChoix, setRechercheChoix] = useState('')
  const cherche = (nom: string) => plat(nom).includes(plat(rechercheChoix.trim()))
  const ligne = (cle: string, coche: boolean, nom: string, n: number, agir: () => void) => (
    <label key={cle} className={`pf-ligne${!coche && n === 0 ? ' indisponible' : ''}`}>
      <input type="checkbox" checked={coche} disabled={!coche && n === 0} onChange={agir} />
      <span className="pf-nom">{nom}</span>
      <span className="pf-n" aria-label={`${n} offre${n !== 1 ? 's' : ''}`}>{n}</span>
    </label>
  )
  const groupes = CATEGORIES.map((c) => ({ ...c, valeurs: comptes.categories[c.cle].filter((x) => cherche(c.titre) || cherche(libelleValeur(c.cle, x.valeur))) })).filter((c) => c.valeurs.length)
  const options = OPTIONS.filter((o) => cherche(o.titre) || cherche('Options'))
  return <div className="pf pf-refonte">
    <div className="pf-bilan"><div><b aria-live="polite">{total} offre{total !== 1 ? 's' : ''}</b><span> dans cette sélection</span></div><span>{actifs ? `${actifs} critère${actifs > 1 ? 's' : ''} actif${actifs > 1 ? 's' : ''}` : 'Aucun critère actif'}</span></div>
    <div className="pf-jeu" role="group" aria-label="Offres à afficher">
      <button type="button" aria-pressed={!f.clos} className={!f.clos ? 'on' : ''} onClick={() => change((g) => ({ ...efface(g), q: g.q, clos: undefined }))}>Offres ouvertes</button>
      <button type="button" aria-pressed={Boolean(f.clos)} className={f.clos ? 'on' : ''} onClick={() => change((g) => ({ ...efface(g), q: g.q, clos: true }))}>Archives (lecture seule)</button>
    </div>

    {actifs > 0 && <section className="pf-selection" aria-label="Critères actifs"><h3>Ta sélection</h3>
      <div className="pf-puces">
        {f.q && <span className="pf-recherche-active">Recherche de poste : {f.q}</span>}
        {CATEGORIES.flatMap(({ cle, titre }) => (f[cle] ?? []).map((v) => <button type="button" key={`${cle}:${v}`} className="chip actif" aria-label={`Retirer le filtre ${titre} : ${libelleValeur(cle, v)}`} onClick={() => change((g) => basculeValeur(g, cle, v))}>{libelleValeur(cle, v)} <span aria-hidden="true">×</span></button>))}
        {OPTIONS.filter(({ cle }) => f[cle]).map(({ cle, titre }) => <button type="button" key={cle} className="chip actif" aria-label={`Retirer le filtre ${titre}`} onClick={() => change((g) => basculeOption(g, cle))}>{titre} <span aria-hidden="true">×</span></button>)}
      </div>
    </section>}
    <label className="pf-cherche"><span>Rechercher un critère</span><input type="search" value={rechercheChoix} onChange={(e) => setRechercheChoix(e.target.value)} placeholder="Un lieu, un métier, un contrat…" /></label>
    {!groupes.length && !options.length && <p role="status" className="pf-sans-choix">Aucun critère ne correspond à cette recherche. <button type="button" className="btn-mini" onClick={() => setRechercheChoix('')}>Effacer la recherche de critères</button></p>}
    {groupes.map(({ cle, titre, valeurs }) => {
      const nombre = f[cle]?.length ?? 0
      return <section key={cle} className="pf-categorie">
        <div className="pf-categorie-entete"><h3 className="pf-categorie-titre">{titre}<small>{nombre ? `${nombre} sélectionné${nombre > 1 ? 's' : ''}` : ''}</small></h3>
          {nombre > 0 && <button type="button" className="pf-retire-categorie" aria-label={`Effacer le filtre ${titre}`} onClick={() => change((g) => ({ ...g, [cle]: undefined }))}>Effacer</button>}
        </div>
        <div className="pf-lignes">{valeurs.map((x) => ligne(`${cle}:${x.valeur}`, Boolean(f[cle]?.includes(x.valeur)), libelleValeur(cle, x.valeur), x.n, () => change((g) => basculeValeur(g, cle, x.valeur))))}</div>
      </section>
    })}
    {options.length > 0 && <section className="pf-categorie"><h3 className="pf-options-titre">Options</h3><div className="pf-lignes">{options.map(({ cle, titre }) => ligne(`o:${cle}`, Boolean(f[cle]), titre, comptes.options[cle], () => change((g) => basculeOption(g, cle))))}</div></section>}
  </div>
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

function Carte({ offre: o, profondeur, profil, occupe, onDetail, onDecide, adequation, actions, comparer, comparee, comparaisonPleine, ouvrirOutils, nbFiltres }: {
  offre: Offre
  profondeur: number
  profil: Profil
  adequation?: Adequation
  actions?: React.ReactNode
  ouvrirOutils?: () => void
  nbFiltres?: number
  comparer?: () => void
  comparee?: boolean
  comparaisonPleine?: boolean
  occupe?: boolean
  onDetail?: () => void
  onDecide?: (d: Decision) => void
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
  const [dy, setDy] = useState(0)
  const axe = useRef<'x' | 'y' | null>(null)
  const glisseVersHaut = useRef(false)
  const [lache, setLache] = useState(false)

  const jouable = profondeur === 0 && !occupe && Boolean(onDecide)

  const debut = (e: React.PointerEvent) => {
    if (!jouable || !e.isPrimary || e.button !== 0 || (e.target instanceof Element && e.target.closest('button, a, input, select, textarea'))) return
    depart.current = { x: e.clientX, y: e.clientY }
    glisseVersHaut.current = e.pointerType === 'mouse' || (e.target instanceof Element && Boolean(e.target.closest('.carte-poignee')))
    axe.current = null
    capture.current = false
    setLache(false)
  }
  const bouge = (e: React.PointerEvent) => {
    if (!depart.current) return
    const d = e.clientX - depart.current.x
    const dv = e.clientY - depart.current.y
    if (!capture.current) {
      if (Math.abs(dv) > 10 && Math.abs(dv) > Math.abs(d)) {
        if (glisseVersHaut.current && dv < 0) axe.current = 'y'
        else { depart.current = null; return }
      } else {
        if (Math.abs(d) < 10) return
        axe.current = 'x'
      }
      capture.current = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (axe.current === 'y') { setDy(Math.min(0, dv)); setDx(0) }
    else { setDx(d); setDy(0) }
  }
  const fin = (e: React.PointerEvent) => {
    if (!depart.current) return
    const aGlisse = capture.current
    const vertical = axe.current === 'y'
    const versHaut = e.clientY - depart.current.y < -SEUIL
    const horizontal = e.clientX - depart.current.x
    const boite = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const aGauche = e.clientX - boite.left < boite.width / 3
    depart.current = null
    capture.current = false
    setLache(true)
    setDy(0)
    if (aGlisse && vertical) { setDx(0); if (versHaut) onDecide?.('plus_tard'); return }
    if (aGlisse && Math.abs(horizontal) > SEUIL) {
      const sens = horizontal > 0 ? 1 : -1
      setDx(0)
      onDecide?.(sens > 0 ? 'oui' : 'non')
      return
    }
    setDx(0)
    if (!aGlisse && pages.length > 1) {
      setPage((p) => (aGauche ? (p - 1 + pages.length) % pages.length : (p + 1) % pages.length))
    }
  }

  const transform = dx || dy
      ? `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`
      : `translateY(${profondeur * 8}px) scale(${1 - profondeur * 0.03})`

  return (
    <article
      className={`card${jouable ? ' glissable' : ''}${page ? ' turned' : ''}${close ? ' close' : ''}`}
      aria-hidden={profondeur > 0 || undefined}
      inert={profondeur > 0}
      style={{
        transform,
        zIndex: 10 - profondeur,
        transition: lache ? 'transform .22s var(--ease)' : undefined,
        touchAction: 'pan-y',
        pointerEvents: profondeur > 0 ? 'none' : undefined,
      }}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={debut}
      onPointerMove={bouge}
      onPointerUp={fin}
      onPointerCancel={() => { depart.current = null; capture.current = false; setDx(0); setDy(0); setLache(true) }}
    >
      <span className={`teinte ${dx > 0 ? 'oui' : 'non'}`} aria-hidden="true"
        style={{ opacity: Math.min(1, Math.abs(dx) / SEUIL) }} />
      <span className="stamp yes" style={{ opacity: Math.max(0, Math.min(1, dx / SEUIL)) }}>OUI</span>
      <span className="stamp no" style={{ opacity: Math.max(0, Math.min(1, -dx / SEUIL)) }}>NON</span>
      <span className="stamp favori" style={{ opacity: Math.max(0, Math.min(1, -dy / SEUIL)) }}>FAVORI</span>

      {pages.length > 1 && (
        <div className="segs">
          {pages.map((_, k) => (
            <i key={k} className={k === page ? 'on' : ''}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setPage(k) }} />
          ))}
        </div>
      )}

      <div className={`carte-poignee${jouable ? '' : ' inactive'}`} title="Glisser cette poignée vers le haut pour mettre en favori">
        <svg aria-hidden="true"><use href="#i-star" fill="currentColor" /></svg><span>↑ Glisser ici vers le haut · Favori</span>
      </div>
      <div className="stage">
        <div className="hero">
          <div className="hero-top">
            <button type="button" className="score score-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDetail?.() }}>
              Voir l’offre
            </button>
            <button type="button" className="score ui-comparer-carte" aria-pressed={comparee} disabled={comparaisonPleine && !comparee} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); comparer?.() }}>{comparee ? 'Retirer' : 'Comparer'}</button>
            <button type="button" className="score ui-outils-carte" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); ouvrirOutils?.() }} aria-haspopup="dialog">Filtres{nbFiltres ? ` (${nbFiltres})` : ''}</button>
            {close && <span className="badge-pass close">Offre expirée · lecture seule</span>}
          </div>
          <h2 className="role">{o.titre}</h2>
          <div className="org">
            {employeur(o)}{o.direction ? ` · ${libDirection(o.direction)}` : o.secteur ? ` · ${o.secteur}` : ''}
          </div>
          <div className="cles">
            {adequation && <PastilleAdequation a={adequation} />}
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
      <div className="facts">
        <div className="line">
          {o.province && <span>{o.province}</span>}
          <span>{o.teletravail === 'inconnu' ? 'Télétravail non renseigné' : o.teletravail === 'non' ? 'sur site' : `télétravail ${o.teletravail}`}</span>
          {o.debut && <span>dès {o.debut}</span>}
          {o.experienceMin !== null && o.experienceMin > 0 && <span>{o.experienceMin} ans d’expérience</span>}
          {o.nbAgentsEncadres ? <span>encadre {o.nbAgentsEncadres} agents</span> : null}
          {o.salaire?.[0] ? <em>{kf(o.salaire[0])}{o.salaire[1] ? ` – ${kf(o.salaire[1])}` : ''} XPF</em> : null}
        </div>
      </div>
      </div>

      {actions}

    </article>
  )
}

function ActionsOffre({ close, vide, occupe, peutRevenir, onRetour, onDecide }: {
  close: boolean; vide: boolean; occupe: boolean; peutRevenir: boolean; onRetour: () => void; onDecide: (d: Decision) => void
}) {
  return <footer className="deck-actions" aria-label="Actions sur l’offre">
    <p className="deck-actions-info" hidden={!vide && !close && !occupe} role="status">{vide ? 'Aucune offre à traiter dans cette sélection.' : close ? 'Offre expirée : consultation uniquement, aucune candidature possible.' : occupe ? 'Traitement en cours…' : '← Passer · ↑ Favori depuis la poignée · Candidater →'}</p>
    <div className="coins">
      <div className="coin"><button type="button" className="retour" disabled={!peutRevenir || close || occupe} onClick={onRetour} aria-label="Revenir sur la dernière décision"><svg aria-hidden="true"><use href="#i-undo" /></svg></button><span>Retour</span></div>
      <div className="coin"><button type="button" className="non" disabled={close || vide || occupe} onClick={() => onDecide('non')} aria-label="Passer"><svg aria-hidden="true"><use href="#i-x" /></svg></button><span>Passer</span></div>
      <div className="coin"><button type="button" className="fav" disabled={close || vide || occupe} onClick={() => onDecide('plus_tard')} aria-label="Mettre en favori"><svg aria-hidden="true"><use href="#i-star" fill="currentColor" /></svg></button><span>Favori</span></div>
      <div className="coin"><button type="button" className="oui" disabled={close || vide || occupe} onClick={() => onDecide('oui')} aria-label="Candidater"><svg aria-hidden="true"><use href="#i-heart" /></svg></button><span>Candidater</span></div>
    </div>
  </footer>
}

/* --------------------------------------------------------------- la feuille */

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
export function BlocEntete({ offre: o, profil, adequation }: { offre: Offre; profil?: Profil; adequation?: Adequation }) {
  return (
    <header className="do-entete">
      <div className="do-org">{employeur(o)}{o.direction ? ` · ${libDirection(o.direction)}` : ''}</div>
      <h2 className="do-titre">{o.titre}</h2>
      <div className="cles">
        {adequation && <PastilleAdequation a={adequation} />}
        {(o.ville ?? o.zone) && <span className="cle">{o.ville ?? o.zone}</span>}
        <span className="cle">{o.contrat}</span>
        {['hybride', 'total'].includes(o.teletravail) && <span className="cle">Télétravail {o.teletravail}</span>}
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
      {o.relations.length > 0 && (
        <section>
          <h3>Relations de travail <span className="do-n">{o.relations.length}</span></h3>
          <div className="tags">{o.relations.map((r) => <span key={r}>{r}</span>)}</div>
        </section>
      )}
      {o.presentationEmployeur && (
        <section>
          <h3>L’employeur</h3>
          <p className="do-desc">{o.presentationEmployeur}</p>
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

/* Le contact indique sur l'avis. C'est la sortie attendue de MS3 — « contact
   employeur » — et l'OPT-NC le renseigne sur tous ses AVP. L'afficher, c'est
   rendre la candidature possible meme quand on ne passe pas par l'application :
   on ne retient personne. */
export function BlocContact({ offre: o }: { offre: Offre }) {
  if (!o.contactEmail && !o.contactTelephone) {
    return null
  }
  return (
    <section className="do-contact">
      <h3>{o.statut === 'close' ? 'Contact de l’avis archivé' : 'Pour candidater'}</h3>
      <p>Cet avis indique à qui s’adresser à l’Office des postes et télécommunications.</p>
      <div className="do-contact-l">
        {o.contactEmail && (
          <a href={`mailto:${o.contactEmail}?subject=${encodeURIComponent(`${o.statut === 'close' ? 'Renseignement' : 'Candidature'} — ${o.titre}${o.reference ? ` (${o.reference})` : ''}`)}`}>
            {o.contactEmail}
          </a>
        )}
        {o.contactTelephone && (
          <a href={`tel:${o.contactTelephone.replace(/[^+0-9]/g, '')}`}>{o.contactTelephone}</a>
        )}
      </div>
      {o.candidatureDirecte && <p className="do-contact-n">L’avis précise que la candidature directe est acceptée.</p>}
    </section>
  )
}

/* « En bref » : les faits de l'AVP, sans capitales criardes, dates en clair. */
export function EnBref({ offre: o }: { offre: Offre }) {
  const lignes: [string, React.ReactNode][] = []
  const ajoute = (k: string, v: React.ReactNode) => { if (v) lignes.push([k, v]) }
  ajoute('Direction', o.direction ? libDirection(o.direction) : null)
  ajoute('Unité', casse(o.unite))
  ajoute('Rattaché à', o.superieur)
  ajoute('Organigramme', o.placeOrganigramme)
  ajoute('Métier OPT', o.metierOpt ? `${casse(o.metierOpt)}${o.codeMetier ? ` (${o.codeMetier})` : ''}` : null)
  ajoute('Corps', o.corps)
  ajoute('Métier ROME', o.libelleRome ? `${o.libelleRome}${o.codeRome ? ` (${o.codeRome})` : ''}` : null)
  ajoute('Famille', o.familles.join(', '))
  ajoute('Lieu', [casse(o.lieu), o.adresse].filter(Boolean).join(', '))
  ajoute('Postes à pourvoir', o.nbPostes !== null && o.nbPostes > 1 ? String(o.nbPostes) : null)
  ajoute('Prise de poste', o.debutImmediat
    ? 'Dès que possible'
    : o.debut ? (/^\d{4}-\d{2}/.test(o.debut) ? date(`${o.debut}-01`)?.replace(/^1er? /, '') : o.debut) : null)
  ajoute('Expérience', o.experienceTexte)
  ajoute('Horaires', o.conditions)
  ajoute('Habilitations', o.qualifications)
  ajoute('Conditions physiques', o.exigencesPhysiques)
  ajoute('Engagements', o.engagements)
  // rare (1 avis sur 24) mais elle écarte des candidats : on la montre quand elle existe
  ajoute('Résidence exigée', o.conditionResidence)
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
export function Detail({ offre: o, profil, adequation }: { offre: Offre; profil?: Profil; adequation?: Adequation }) {
  return (
    <div className="detail-offre">
      <nav className="upgrade-sommaire" aria-label="Rubriques de l’offre">
        <button className="btn-mini" onClick={(e) => e.currentTarget.closest('.detail-offre')?.querySelector('[data-rubrique="poste"]')?.scrollIntoView({ block: 'start', behavior: 'instant' })}>Le poste</button>
        <button className="btn-mini" onClick={(e) => e.currentTarget.closest('.detail-offre')?.querySelector('[data-rubrique="conditions"]')?.scrollIntoView({ block: 'start', behavior: 'instant' })}>Conditions et prérequis</button>
        <button className="btn-mini" onClick={(e) => e.currentTarget.closest('.detail-offre')?.querySelector('[data-rubrique="contact"]')?.scrollIntoView({ block: 'start', behavior: 'instant' })}>Contact</button>
      </nav>
      <div className="do-principal">
        <BlocEntete offre={o} profil={profil} adequation={adequation} />
        <BlocAdequation offre={o} adequation={adequation} />
        <details open data-rubrique="poste"><summary>Missions et compétences attendues</summary><BlocPoste offre={o} profil={profil} /></details>
        <div data-rubrique="contact"><BlocContact offre={o} /></div>
        <CarnetOffre key={o.id} offre={o} />
      </div>
      <div data-rubrique="conditions"><EnBref offre={o} /></div>
    </div>
  )
}

function Panneau({ offre: o, profil, adequation }: { offre: Offre; profil: Profil; adequation?: Adequation }) {
  return (
    <aside className="side panneau" id="side">
      <Detail offre={o} profil={profil} adequation={adequation} />
    </aside>
  )
}

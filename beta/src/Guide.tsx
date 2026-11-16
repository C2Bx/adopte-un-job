import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Onglet } from './App'

type Etape = { titre: string; texte: string; cible: string }
const ETAPES: Record<Onglet, Etape[]> = {
  swipe: [
    { titre: 'Choisir ton affichage', texte: 'Ouvre « Affichage et recherches » pour passer des cartes à la liste ou au tableau, puis choisis le tri qui t’aide à lire les offres.', cible: '.ui-presentation' },
    { titre: 'Rechercher un poste', texte: 'Saisis un titre, un métier ou un mot. Les résultats suivent ta recherche ; efface le texte pour élargir la sélection.', cible: '.filtres-avp .recherche' },
    { titre: 'Affiner les résultats', texte: 'Ouvre les filtres pour choisir tes critères ou consulter les archives. Les offres expirées restent en lecture seule.', cible: '.ouvre-filtres' },
    { titre: 'Passer, garder ou candidater', texte: 'Sur les cartes : croix pour passer, étoile pour les favoris, cœur pour candidater. À la souris, maintiens le clic gauche et glisse à gauche, à droite ou vers le haut. Au tactile, glisse la poignée vers le haut pour les favoris. Les commandes restent grisées sans offre ouverte.', cible: '.deck-actions, .upgrade-liste, .upgrade-tableau' },
    { titre: 'Relire avant d’envoyer', texte: 'La relecture est activée par défaut. Le cœur ouvre ton récapitulatif : seule la confirmation envoie la candidature. Tu peux annuler et retrouver ta carte.', cible: '.ui-presentation' },
    { titre: 'Retrouver une recherche', texte: 'Donne un nom à tes critères pour les mémoriser dans ce navigateur. Pour suivre tes décisions et tes réponses, ouvre ensuite Candidatures.', cible: '.ui-presentation' },
  ],
  interets: [
    { titre: 'Retrouver tes décisions', texte: 'Les candidatures, les favoris et les offres écartées ont chacune leur onglet.', cible: '#ec-interets .seg' },
    { titre: 'Rechercher et classer', texte: 'Cherche dans les offres et tes notes, filtre sur la réponse reçue et choisis l’ordre d’affichage. La liste se met à jour automatiquement lorsque la page est visible.', cible: '.ui-suivi-filtres' },
    { titre: 'Lire un dossier', texte: 'Sélectionne une offre pour ouvrir son détail. Sur grand écran, il apparaît à côté de la liste ; sur mobile, une fenêtre s’ouvre.', cible: '#ec-interets .item, #ec-interets .vide' },
    { titre: 'Revoir une décision', texte: 'Les actions d’une offre permettent de la remettre dans les cartes ou de changer ton choix lorsque son statut le permet. Une réponse du recruteur peut empêcher la modification.', cible: '#ec-interets .actes, #ec-interets .col-liste' },
  ],
  profil: [
    { titre: 'Comprendre l’état de ton profil', texte: 'La progression indique les informations requises. « Enregistré » confirme la sauvegarde ; un message d’erreur demande de réessayer.', cible: '.pentete' },
    { titre: 'Utiliser ton CV', texte: 'Ouvre la rubrique du CV pour déposer ton fichier et relire son extraction. Tu choisis les données à intégrer ; ta saisie existante reste prioritaire.', cible: '.ui-cv, .mescv-carte' },
    { titre: 'Compléter ton parcours', texte: 'Utilise les cinq étapes du formulaire. Si ton profil est vide, choisis d’abord le formulaire ou les questions guidées.', cible: '.petapes, .qzdepart' },
    { titre: 'Relire et enrichir', texte: 'L’étape Relecture rassemble ton profil et les rubriques détaillées : projets, réalisations, certifications et liens. Les rubriques détaillées ont leur bouton d’enregistrement.', cible: '.petapes, .qzdepart' },
    { titre: 'Gérer tes outils', texte: 'Import, export et informations du compte sont regroupés ici. Avant de remplacer le profil, vérifie l’aperçu de l’import.', cible: '.ui-profil-outils' },
  ],
}
const NOMS: Record<Onglet, string> = { swipe: 'Offres', interets: 'Candidatures', profil: 'Profil' }

type Cadre = { x: number; y: number; w: number; h: number; vw: number; vh: number }
export function Guide({ onglet, onFermer }: { onglet: Onglet; onFermer: () => void }) {
  const guide = useRef<HTMLElement>(null)
  const titreId = useId()
  const [index, setIndex] = useState(0)
  const [cadre, setCadre] = useState<Cadre | null>(null)
  const [position, setPosition] = useState({ x: 12, y: 12 })
  const etapes = ETAPES[onglet]
  const etape = etapes[index]!
  useEffect(() => {
    const app = document.querySelector<HTMLElement>('.app')
    const avant = document.activeElement as HTMLElement | null
    const inerte = app?.inert ?? false
    if (app) app.inert = true
    guide.current?.querySelector<HTMLButtonElement>('.guide-suivant')?.focus({ preventScroll: true })
    return () => {
      if (app) app.inert = inerte
      if (avant?.isConnected) avant.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    let cible: HTMLElement | null = null
    const mesure = () => {
      const r = cible?.getBoundingClientRect()
      if (!r) return
      const x = Math.max(6, r.left - 5), y = Math.max(6, r.top - 5)
      const suivant = { x, y, w: Math.max(1, Math.min(innerWidth - 6, r.right + 5) - x), h: Math.max(1, Math.min(innerHeight - 6, r.bottom + 5) - y), vw: innerWidth, vh: innerHeight }
      setCadre((ancien) => ancien && JSON.stringify(ancien) === JSON.stringify(suivant) ? ancien : suivant)
    }
    const tailles = new ResizeObserver(mesure)
    const actualise = () => {
      const suivant = document.querySelector<HTMLElement>(etape.cible) ?? document.querySelector<HTMLElement>('.screen')
      if (suivant !== cible) {
        if (cible) tailles.unobserve(cible)
        cible = suivant
        if (cible) { tailles.observe(cible); cible.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }) }
      }
      mesure()
    }
    actualise()
    const observation = new MutationObserver(actualise)
    const ecran = document.querySelector('.screen')
    if (ecran) observation.observe(ecran, { childList: true, subtree: true })
    window.addEventListener('resize', mesure)
    window.addEventListener('scroll', mesure, true)
    return () => { observation.disconnect(); tailles.disconnect(); window.removeEventListener('resize', mesure); window.removeEventListener('scroll', mesure, true) }
  }, [etape])
  useLayoutEffect(() => {
    const popup = guide.current
    if (!popup || !cadre) return
    const w = popup.offsetWidth, h = popup.offsetHeight, marge = 12, ecart = 14
    const limite = (v: number, max: number) => Math.max(marge, Math.min(v, max - marge))
    let x: number, y: number
    if (cadre.vw - cadre.x - cadre.w >= w + ecart + marge) { x = cadre.x + cadre.w + ecart; y = limite(cadre.y, cadre.vh - h) }
    else if (cadre.x >= w + ecart + marge) { x = cadre.x - w - ecart; y = limite(cadre.y, cadre.vh - h) }
    else if (cadre.vh - cadre.y - cadre.h >= h + ecart + marge) { x = limite(cadre.x, cadre.vw - w); y = cadre.y + cadre.h + ecart }
    else if (cadre.y >= h + ecart + marge) { x = limite(cadre.x, cadre.vw - w); y = cadre.y - h - ecart }
    else { x = limite((cadre.vw - w) / 2, cadre.vw - w); y = cadre.y + cadre.h / 2 < cadre.vh / 2 ? Math.max(marge, cadre.vh - h - marge) : marge }
    setPosition((ancien) => ancien.x === x && ancien.y === y ? ancien : { x, y })
  }, [cadre, index])
  return createPortal(<div className={`guide-voile${cadre ? '' : ' sans-cible'}`}>
    {cadre && <div className="guide-projecteur" aria-hidden="true" style={{ left: cadre.x, top: cadre.y, width: cadre.w, height: cadre.h }} />}
    <aside ref={guide} className="ui-guide" role="dialog" aria-modal="true" aria-labelledby={titreId} style={{ left: position.x, top: position.y }} onKeyDown={(e) => {
      e.stopPropagation()
      if (e.key === 'Escape') { e.preventDefault(); onFermer(); return }
      if (e.key !== 'Tab') return
      const boutons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const premier = boutons[0], dernier = boutons.at(-1)
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier?.focus() }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier?.focus() }
    }}>
      <div className="guide-entete"><strong>Guide · {NOMS[onglet]}</strong><span>{index + 1} / {etapes.length}</span><progress value={index + 1} max={etapes.length} aria-label="Progression du guide" /></div>
      <div className="guide-texte" aria-live="polite" aria-atomic="true"><h2 id={titreId}>{etape.titre}</h2><p>{etape.texte}</p></div>
      <div className="guide-actions"><button type="button" className="btn-mini" disabled={index === 0} onClick={() => setIndex(index - 1)}>Précédent</button><button type="button" className="btn-mini guide-suivant" onClick={() => index === etapes.length - 1 ? onFermer() : setIndex(index + 1)}>{index === etapes.length - 1 ? 'Terminer' : 'Suivant'}</button><button type="button" className="btn-mini guide-arreter" onClick={onFermer}>Arrêter</button></div>
    </aside>
  </div>, document.body)
}

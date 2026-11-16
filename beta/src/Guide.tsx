import { useEffect, useRef, useState } from 'react'
import type { Onglet } from './App'

type Etape = { titre: string; texte: string; cible: string }
const ETAPES: Record<Onglet, Etape[]> = {
  swipe: [
    { titre: 'Choisir ton affichage', texte: 'Passe des cartes à la liste ou au tableau, puis choisis le tri qui t’aide à lire les offres.', cible: '.upgrade-commandes' },
    { titre: 'Rechercher un poste', texte: 'Saisis un titre, un métier ou un mot. Les résultats suivent ta recherche ; efface le texte pour élargir la sélection.', cible: '.filtres-avp .recherche' },
    { titre: 'Affiner les résultats', texte: 'Ouvre les filtres pour choisir tes critères ou consulter les archives. Les offres expirées restent en lecture seule.', cible: '.ouvre-filtres' },
    { titre: 'Passer, garder ou candidater', texte: 'Sur les cartes : croix pour passer, étoile pour les favoris, cœur pour candidater. Glisse à gauche/droite, ou la poignée de la carte vers le haut pour mettre en favori. Les commandes restent grisées sans offre ouverte.', cible: '.deck-actions, .upgrade-liste, .upgrade-tableau' },
    { titre: 'Relire avant d’envoyer', texte: 'La relecture est activée par défaut. Le cœur ouvre ton récapitulatif : seule la confirmation envoie la candidature. Tu peux annuler et retrouver ta carte.', cible: '.ui-options' },
    { titre: 'Retrouver une recherche', texte: 'Donne un nom à tes critères pour les mémoriser dans ce navigateur. Pour suivre tes décisions et tes réponses, ouvre ensuite Candidatures.', cible: '.ui-recherches' },
  ],
  interets: [
    { titre: 'Retrouver tes décisions', texte: 'Les candidatures, les favoris et les offres écartées ont chacune leur onglet.', cible: '#ec-interets .seg' },
    { titre: 'Rechercher et classer', texte: 'Cherche dans les offres et tes notes, filtre sur la réponse reçue et choisis l’ordre d’affichage. Actualiser recharge les informations existantes.', cible: '.ui-suivi-filtres' },
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

export function Guide({ onglet, onFermer }: { onglet: Onglet; onFermer: () => void }) {
  const guide = useRef<HTMLElement>(null)
  const [index, setIndex] = useState(0)
  const etapes = ETAPES[onglet]
  const etape = etapes[index]!
  useEffect(() => {
    guide.current?.querySelector<HTMLButtonElement>('.guide-suivant')?.focus({ preventScroll: true })
    return () => document.querySelector<HTMLButtonElement>('.ui-aide-bouton')?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    let cible: HTMLElement | null = null
    const actualise = () => {
      const suivante = document.querySelector<HTMLElement>(etape.cible)
      if (suivante === cible) return
      cible?.classList.remove('ui-guide-cible')
      cible = suivante
      cible?.classList.add('ui-guide-cible')
      cible?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    }
    actualise()
    const observation = new MutationObserver(actualise)
    const ecran = document.querySelector('.screen')
    if (ecran) observation.observe(ecran, { childList: true, subtree: true })
    return () => { observation.disconnect(); cible?.classList.remove('ui-guide-cible') }
  }, [etape])
  return <aside ref={guide} className="ui-guide" aria-label={`Guide de la page ${NOMS[onglet]}`} onKeyDown={(e) => e.stopPropagation()}>
    <div className="guide-entete"><strong>Guide · {NOMS[onglet]}</strong><span>Étape {index + 1} sur {etapes.length}</span><progress value={index + 1} max={etapes.length} aria-label="Progression du guide" /></div>
    <div className="guide-texte" aria-live="polite" aria-atomic="true"><h2>{etape.titre}</h2><p>{etape.texte}</p></div>
    <div className="guide-actions">
      <button type="button" className="btn-mini" disabled={index === 0} onClick={() => setIndex(index - 1)}>Précédent</button>
      <button type="button" className="btn-mini guide-suivant" onClick={() => index === etapes.length - 1 ? onFermer() : setIndex(index + 1)}>{index === etapes.length - 1 ? 'Terminer' : 'Suivant'}</button>
      <button type="button" className="btn-mini guide-arreter" onClick={onFermer}>Arrêter</button>
    </div>
  </aside>
}

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Onglet } from './App'

type Etape = { titre: string; texte: string; cible: string }
const ETAPES: Record<Onglet, Etape[]> = {
  swipe: [
    { titre: 'Choisir ton affichage', texte: '', cible: '.ui-presentation, .ui-outils-carte' },
    { titre: 'Rechercher un poste', texte: '', cible: '.filtres-avp .recherche, .ui-outils-carte' },
    { titre: 'Affiner les résultats', texte: '', cible: '.filtres-rapides, .ui-outils-carte' },
    { titre: 'Lire toute l’offre', texte: '', cible: '.card .score-btn, .upgrade-liste, .upgrade-tableau' },
    { titre: 'Comprendre l’adéquation', texte: '', cible: '.card .cles, .upgrade-liste, .upgrade-tableau' },
    { titre: 'Comparer les offres', texte: '', cible: '[data-onglet=comparaison]' },
    { titre: 'Passer, garder ou candidater', texte: '', cible: '.deck-actions, .upgrade-liste, .upgrade-tableau' },
    { titre: 'Relire avant d’envoyer', texte: '', cible: '.ui-presentation, .ui-outils-carte' },
    { titre: 'Notes et étiquettes', texte: '', cible: '.card .score-btn, .upgrade-liste, .upgrade-tableau' },
    { titre: 'Partager une offre', texte: '', cible: '.card .score-btn, .upgrade-liste, .upgrade-tableau' },
    { titre: 'Retrouver une recherche', texte: '', cible: '.ui-presentation, .ui-outils-carte' },
    { titre: 'Adapter la lecture', texte: '', cible: '.ui-aide-bouton' },
  ],
  comparaison: [
    { titre: 'Choisir des offres à comparer', texte: '', cible: '.comparaison-outils' },
    { titre: 'Lire côte à côte', texte: '', cible: '.comparaison-table, .comparaison-vide' },
    { titre: 'Changer la sélection', texte: '', cible: '.comparaison-outils' },
    { titre: 'Données du comparateur', texte: '', cible: '.comparaison-aide, .comparaison-vide' },
  ],
  interets: [
    { titre: 'Retrouver tes décisions', texte: '', cible: '#ec-interets .seg' },
    { titre: 'Rechercher et classer', texte: '', cible: '.ui-suivi-filtres' },
    { titre: 'Lire un dossier', texte: '', cible: '#ec-interets .item, #ec-interets .vide' },
    { titre: 'Comprendre les réponses', texte: '', cible: '#ec-interets .ui-suivi-filtres' },
    { titre: 'Revoir une décision', texte: '', cible: '#ec-interets .actes, #ec-interets .col-liste' },
    { titre: 'Notes et étiquettes', texte: '', cible: '#ec-interets .item, #ec-interets .vide' },
    { titre: 'Suivre les mises à jour', texte: '', cible: '.ui-synchro-auto' },
  ],
  profil: [
    { titre: 'Comprendre l’état de ton profil', texte: '', cible: '.pentete' },
    { titre: 'Utiliser ton CV', texte: '', cible: '.ui-cv, .mescv-carte' },
    { titre: 'Compléter ton parcours', texte: '', cible: '.petapes, .qzdepart' },
    { titre: 'Corriger au bon endroit', texte: '', cible: '.pguide' },
    { titre: 'Relire et enrichir', texte: '', cible: '.petapes, .qzdepart' },
    { titre: 'Répondre aux questions', texte: '', cible: '.ui-assistant, .qzdepart' },
    { titre: 'Importer ou exporter', texte: '', cible: '.ui-profil-outils' },
    { titre: 'Rétablir et effacer', texte: '', cible: '.ui-profil-outils' },
    { titre: 'Compte et confort', texte: '', cible: '.ui-profil-outils' },
  ],
}
const CONSIGNES: Record<string, [string, string][]> = {
  'Choisir ton affichage': [['Affichage et tri', 'Sur petit écran, ouvre Filtres sur la carte, puis Affichage et tri.'], ['Cartes, liste ou tableau', 'Garde la vue la plus confortable pour toi.'], ['Tri', 'Classe par clôture, publication, titre ou adéquation disponible.']],
  'Rechercher un poste': [['Rechercher', 'Saisis un titre ou un métier. Sur petit écran, ouvre Filtres sur la carte.'], ['Expression exacte', 'Place plusieurs mots entre guillemets.'], ['Élargir', 'Efface la recherche pour retrouver toutes les offres.']],
  'Affiner les résultats': [['Lieu et contrat', 'Choisis-les directement dans la barre des offres.'], ['Filtres', 'Ouvre les autres critères et coche tes choix.'], ['Retirer', 'Utilise la croix d’un critère ou Tout effacer.']],
  'Passer, garder ou candidater': [['Croix · gauche', 'Maintiens le clic gauche et glisse à gauche, ou utilise le bouton.'], ['Étoile jaune · haut', 'Glisse vers le haut à la souris ; au tactile, utilise la poignée. Le bouton fait la même chose.'], ['Cœur · droite', 'Bouton ou glissement à droite : relis le dossier avant confirmation.']],
  'Relire avant d’envoyer': [['Relecture', 'Elle est activée par défaut.'], ['Confirmer', 'Ce bouton envoie réellement la candidature.'], ['Annuler', 'Retrouve ta carte sans envoyer le dossier.']],
  'Retrouver une recherche': [['Affichage et tri', 'Ouvre Recherches enregistrées.'], ['Mémoriser', 'Nomme tes critères pour les retrouver dans ce navigateur.'], ['Candidatures', 'Ce menu rassemble tes décisions et les réponses reçues.']],
  'Retrouver tes décisions': [['Candidatures', 'Retrouve les dossiers envoyés.'], ['Favoris', 'Reprends les offres gardées pour plus tard.'], ['Écartés', 'Consulte les offres que tu as passées.']],
  'Rechercher et classer': [['Recherche', 'Retrouve une offre ou une note personnelle.'], ['Réponse et ordre', 'Choisis le statut et le classement utiles.'], ['Mise à jour automatique', 'Les réponses sont rechargées quand cette page est visible.']],
  'Lire un dossier': [['Sélectionner', 'Clique sur le titre ou la ligne d’une offre.'], ['Lire', 'Le détail s’ouvre à côté ou dans une fenêtre selon la place.'], ['Fermer', 'Reviens à la liste sans perdre tes choix.']],
  'Revoir une décision': [['Actions de l’offre', 'Retrouve les choix encore autorisés.'], ['Remettre dans les cartes', 'Reprends une offre lorsque son statut le permet.'], ['Réponse du recruteur', 'Elle peut empêcher une modification de candidature.']],
  'Comprendre l’état de ton profil': [['Informations requises', 'La progression et le bouton Compléter amènent aux informations manquantes ; Relire ouvre le dossier quand l’essentiel est renseigné.'], ['Enregistré', 'Ce statut confirme la sauvegarde.'], ['Erreur', 'Réessaie avant de quitter si la sauvegarde a échoué.']],
  'Utiliser ton CV': [['Mon CV', 'Ouvre cette rubrique pour déposer ton fichier.'], ['Relire l’extraction', 'Vérifie les données reconnues avant de les intégrer.'], ['Choisir les champs', 'Ta saisie existante reste prioritaire.']],
  'Compléter ton parcours': [['Choisir une étape', 'Les cinq étapes indiquent leur état : à renseigner, renseigné ou relecture.'], ['Compléter', 'Renseigne les champs utiles dans le formulaire.'], ['Corriger un conseil', 'Le bouton amène directement au champ concerné.']],
  'Relire et enrichir': [['Relecture', 'Vérifie le profil qui accompagne tes candidatures.'], ['Rubriques détaillées', 'Ajoute projets, réalisations, certifications et liens.'], ['Enregistrer', 'Valide les rubriques détaillées avec leur bouton dédié.']],
  'Gérer tes outils': [['Mon compte', 'Retrouve les informations du compte.'], ['Exporter', 'Télécharge ton profil au format JSON Resume.'], ['Importer', 'Vérifie l’aperçu avant de remplacer tes données.']],
}
Object.assign(CONSIGNES, {
  'Lire toute l’offre': [['Voir l’offre', 'Ouvre le détail complet, avec ses missions et prérequis.'], ['Sommaire', 'Passe directement au poste, aux conditions ou au contact.'], ['Archives', 'Tu peux les lire, mais aucune candidature n’est possible.']],
  'Comprendre l’adéquation': [['Score disponible', 'Il vient de CV-Matching ; il n’est pas calculé par cette interface.'], ['Détail', 'Lis les compétences couvertes, écarts et avertissements.'], ['Indisponible', 'L’absence de score ne vaut pas une mauvaise adéquation.']],
  'Comparer les offres': [['Comparer sur la carte', 'Sélectionne deux ou trois offres. En liste/tableau, le même bouton est disponible.'], ['Menu Comparaison', 'Ouvre la page dédiée, sur toute la largeur, depuis la navigation principale.'], ['Retirer', 'Retire une sélection pour changer les offres comparées.']],
  'Notes et étiquettes': [['Ouvrir le détail', 'Déplie « Partager et ajouter mes repères ».'], ['Note et étiquettes', 'Écris tes repères puis retrouve-les dans la recherche des candidatures.'], ['Dans ce navigateur', 'Ces informations ne sont pas transmises au recruteur ni synchronisées.']],
  'Partager une offre': [['Ouvrir le détail', 'Déplie « Partager et ajouter mes repères ».'], ['Copier le lien', 'Le destinataire devra se connecter pour lire l’offre.'], ['Tes notes restent privées', 'Le lien ne contient ni note ni étiquette personnelle.']],
  'Adapter la lecture': [['Guide', 'Après la visite, ouvre ce bouton pour retrouver l’aide et les réglages.'], ['Taille et densité', 'Agrandis les textes ou choisis une présentation compacte.'], ['Lune / soleil', 'Le bouton de l’en-tête change le thème jour ou nuit.']],
  'Comprendre les réponses': [['En attente', 'Ce statut ne confirme pas que le dossier a été lu.'], ['Réponse reçue', 'Retenue, non retenue ou entretien viennent du recruteur.'], ['Filtrer', 'Le champ Réponse reçue permet d’isoler un statut.']],
  'Suivre les mises à jour': [['Automatique', 'Les réponses se rechargent toutes les 30 secondes si cette page est visible.'], ['Retour à la fenêtre', 'Un rechargement est également demandé quand tu reviens.'], ['Erreur réseau', 'La liste reste affichée et une tentative suivante reprend la mise à jour.']],
  'Corriger au bon endroit': [['Améliorer mon profil', 'Déplie les conseils s’ils sont fermés.'], ['Corriger', 'Le bouton ouvre l’étape puis amène au champ précis.'], ['Champ mis en évidence', 'Le focus te permet de compléter directement la bonne information.']],
  'Répondre aux questions': [['Assistant', 'Ouvre « Affiner mon profil par questions ».'], ['Parcours court', 'Réponds aux neuf questions pour renseigner tes préférences.'], ['Vérifier', 'Reviens ensuite au formulaire pour relire et compléter.']],
  'Importer ou exporter': [['Mon compte, import et export', 'Ouvre cette rubrique en bas du profil.'], ['Exporter', 'Télécharge une copie JSON Resume.'], ['Importer', 'Compare l’aperçu avec ton profil avant de confirmer le remplacement.']],
  'Rétablir et effacer': [['Après un import', 'La copie précédente reste récupérable dans cet onglet.'], ['Réinitialiser les informations', 'Lis la confirmation : le fichier CV et son extraction sont conservés.'], ['Quitter l’onglet', 'Les brouillons et la copie avant import ne sont pas un stockage permanent.']],
  'Compte et confort': [['Mon compte', 'Retrouve les informations et fonctions réellement disponibles.'], ['Guide et apparence', 'Ajuste la lecture dans Guide et le thème avec lune/soleil.'], ['Autres pages', 'Le bouton Guide présente aussi les outils des Offres et Candidatures.']],
})
Object.assign(CONSIGNES, {
  'Choisir des offres à comparer': [['Choisir des offres', 'Retourne aux Offres pour sélectionner jusqu’à trois postes.'], ['Comparer', 'Le bouton de chaque carte ou ligne ajoute ou retire une offre.'], ['Menu dédié', 'La pastille indique combien d’offres sont sélectionnées.']],
  'Lire côte à côte': [['Colonnes', 'Chaque offre garde son titre en tête.'], ['Critères et écarts', 'Tout voir, Les écarts ou Comparables isolent les critères utiles. Choisis aussi une rubrique.'], ['Petit écran', 'Les offres sont regroupées par critère, avec leur titre, sans défilement horizontal.']],
  'Changer la sélection': [['Retirer', 'Supprime une offre avec le bouton de sa colonne.'], ['Vider la sélection', 'Recommence une comparaison complète.'], ['Lire l’offre', 'Clique sur son titre dans la colonne ; sur mobile, ouvre Gérer les offres sélectionnées.']],
  'Données du comparateur': [['Repères', 'En commun signale les valeurs partagées ; une absence reste À compléter et ne vaut pas une différence.'], ['Adéquation', 'Le score disponible vient du service existant.'], ['Sélection locale', 'Elle est conservée par compte dans ce navigateur.']],
})
const NOMS: Record<Onglet, string> = { swipe: 'Offres', comparaison: 'Comparaison', interets: 'Candidatures', profil: 'Profil' }

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
      const suivant = Array.from(document.querySelectorAll<HTMLElement>(etape.cible)).find((el) => el.getClientRects().length > 0) ?? document.querySelector<HTMLElement>('.screen')
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
      <div className="guide-texte" aria-live="polite" aria-atomic="true"><h2 id={titreId}>{etape.titre}</h2><ul className="guide-consignes">{(CONSIGNES[etape.titre] ?? [[etape.titre, etape.texte]]).map(([action, precision]) => <li key={action}><span className="guide-repere" aria-hidden="true">›</span><div><strong>{action}</strong><span>{precision}</span></div></li>)}</ul></div>
      <div className="guide-actions"><button type="button" className="btn-mini" disabled={index === 0} onClick={() => setIndex(index - 1)}>Précédent</button><button type="button" className="btn-mini guide-suivant" onClick={() => index === etapes.length - 1 ? onFermer() : setIndex(index + 1)}>{index === etapes.length - 1 ? 'Terminer' : 'Suivant'}</button><button type="button" className="btn-mini guide-arreter" onClick={onFermer}>Arrêter</button></div>
    </aside>
  </div>, document.body)
}

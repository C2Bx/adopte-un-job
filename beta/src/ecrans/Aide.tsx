import { useEffect, useState } from 'react'
import { Feuille } from '../Dialogue'
import { useLocal } from './OutilsOffres'

export function Aide({ onGuide }: { onGuide: () => void }) {
  const [ouverte, setOuverte] = useState(false)
  const [affichage, setAffichage, erreur] = useLocal('affichage', { taille: 'normale', densite: 'confort' })
  useEffect(() => {
    document.documentElement.dataset.taille = affichage.taille
    document.documentElement.dataset.densite = affichage.densite
  }, [affichage])
  return <><button type="button" className="btn-mini ui-aide-bouton" onClick={() => setOuverte(true)} aria-haspopup="dialog" title="Guide et aide">Guide</button>
    {ouverte && <Feuille titre="Aide et affichage" onFermer={() => setOuverte(false)}><div className="upgrade-aide">
    <div className="guide-demarrage"><h3>Un tour de cette page</h3><p>Un guide étape par étape, avec Suivant, Précédent et Arrêter. Tu peux le relancer quand tu veux.</p><button type="button" className="btn primaire" onClick={() => { setOuverte(false); onGuide() }}>Démarrer le tutoriel de cette page</button></div>
    <div className="upgrade-rangee"><label>Taille du texte <select value={affichage.taille} onChange={(e) => setAffichage({ ...affichage, taille: e.target.value })}><option value="normale">Normale</option><option value="grande">Grande</option><option value="tres-grande">Très grande</option></select></label>
      <label>Densité <select value={affichage.densite} onChange={(e) => setAffichage({ ...affichage, densite: e.target.value })}><option value="confort">Confortable</option><option value="compacte">Compacte</option></select></label></div>
    {erreur && <p role="alert">Ce réglage ne peut pas être mémorisé dans le navigateur.</p>}
    <ol><li>Consulte les offres en cartes, liste ou tableau ; les filtres restent ton choix.</li>
      <li>Complète et relis ton profil avant de candidater. « Enregistré » confirme la sauvegarde.</li>
      <li>Une candidature utilise ton profil dans HACKAVPI. Les réponses affichées viennent des recruteurs.</li>
      <li>L’adéquation de CV-Matching décrit les compétences, sans décider de ton recrutement.</li></ol>
    <p>Recherche : plusieurs mots sont combinés. Utilise des guillemets pour une expression exacte et « -mot » pour exclure un terme.</p>
    <p>Sur les cartes : flèche droite pour candidater, gauche pour passer, haut ou bas pour les favoris. À la souris, maintiens le clic gauche sur la carte et glisse à gauche, à droite ou vers le haut. Sur écran tactile, utilise la poignée pour le glissement vers le haut ; le texte reste défilable. Les boutons offrent les mêmes actions. Échap ferme les feuilles.</p>
    <p>« En attente » n’indique pas que le dossier a été lu. « Retenue » et « Non retenue » sont les décisions reçues. « Entretien à programmer » s’affiche uniquement si le recruteur le signale.</p>
    <p>Notes, étiquettes et recherches sont locales à ce navigateur. Les brouillons de profil et la copie avant import restent dans cet onglet. Ces données ne sont pas synchronisées.</p>
    <p>Les archives sont en lecture seule. Une erreur de réseau n’est jamais une confirmation d’envoi : vérifie tes candidatures avant de réessayer.</p>
  </div></Feuille>}</>
}

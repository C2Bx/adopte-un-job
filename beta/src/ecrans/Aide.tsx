import { useEffect } from 'react'
import { useLocal } from './OutilsOffres'

export function Aide() {
  const [affichage, setAffichage, erreur] = useLocal('affichage', { taille: 'normale', densite: 'confort' })
  useEffect(() => {
    document.documentElement.dataset.taille = affichage.taille
    document.documentElement.dataset.densite = affichage.densite
  }, [affichage])
  return <details className="upgrade-aide"><summary>Aide</summary>
    <div className="upgrade-rangee"><label>Taille du texte <select value={affichage.taille} onChange={(e) => setAffichage({ ...affichage, taille: e.target.value })}><option value="normale">Normale</option><option value="grande">Grande</option><option value="tres-grande">Très grande</option></select></label>
      <label>Densité <select value={affichage.densite} onChange={(e) => setAffichage({ ...affichage, densite: e.target.value })}><option value="confort">Confortable</option><option value="compacte">Compacte</option></select></label></div>
    {erreur && <p role="alert">Ce réglage ne peut pas être mémorisé dans le navigateur.</p>}
    <ol><li>Consulte les offres en cartes, liste ou tableau ; les filtres restent ton choix.</li>
      <li>Complète et relis ton profil avant de candidater. « Enregistré » confirme la sauvegarde.</li>
      <li>Une candidature utilise ton profil dans HACKAVPI. Les réponses affichées viennent des recruteurs.</li>
      <li>L’adéquation de CV-Matching décrit les compétences, sans décider de ton recrutement.</li></ol>
    <p>Recherche : plusieurs mots sont combinés. Utilise des guillemets pour une expression exacte et « -mot » pour exclure un terme.</p>
    <p>Sur les cartes : flèche droite pour candidater, gauche pour passer, bas pour plus tard. Les boutons offrent les mêmes actions. Échap ferme les feuilles.</p>
    <p>« En attente » n’indique pas que le dossier a été lu. « Retenue » et « Non retenue » sont les décisions reçues. « Entretien à programmer » s’affiche uniquement si le recruteur le signale.</p>
    <p>Notes, étiquettes et recherches sont locales à ce navigateur. Les brouillons de profil et la copie avant import restent dans cet onglet. Ces données ne sont pas synchronisées.</p>
    <p>Les archives sont en lecture seule. Une erreur de réseau n’est jamais une confirmation d’envoi : vérifie tes candidatures avant de réessayer.</p>
    <a href={`${import.meta.env.BASE_URL}?demo=1`}>Ouvrir la démonstration fictive sans compte</a>
  </details>
}

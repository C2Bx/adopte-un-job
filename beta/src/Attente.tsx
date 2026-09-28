/* L'attente, en un seul endroit.

   Six écrans font patienter : le démarrage, la connexion, le deck, les
   candidatures, l'enregistrement du profil, le dépôt d'un CV. Chacun avait sa
   petite phrase — « Chargement… », « Un instant… », « Envoi… » — et rien qui
   bouge, ce qui, au-delà d'une seconde, ressemble à une page figée.

   Un seul rond, donc, et une seule règle de style. Il prend sa couleur du
   contexte (`currentColor`) et sa taille de la police (`em`) : le même élément
   sert dans un bouton bleu, dans une ligne de texte gris et au milieu d'un
   écran vide, sans variante à écrire. */

/** Le rond qui tourne, seul. Décoratif : ce qui doit être lu est à côté. */
export function Spinner({ grand }: { grand?: boolean }) {
  return <span className={grand ? 'spin grand' : 'spin'} aria-hidden="true" />
}

/**
 * Le rond et sa phrase. `role="status"` fait annoncer le texte par un lecteur
 * d'écran quand il apparaît — sans quoi l'attente ne serait visible que pour
 * ceux qui voient.
 */
export function Attente({ texte, centre }: { texte: string; centre?: boolean }) {
  return (
    <p className={`attente${centre ? ' centre' : ''}`} role="status">
      <Spinner />{texte}
    </p>
  )
}

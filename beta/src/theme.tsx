/* Le thème : jour par défaut, nuit au choix, mémorisé dans le navigateur.
   Une seule source : l'attribut data-da sur <html> (data-da="b" = la direction
   artistique « Nuit & Lagon »). index.html le pose avant le premier rendu ; ici,
   on le change et on prévient tous les boutons, pour qu'ils restent d'accord. */

import { useEffect, useState } from 'react'

const EVENEMENT = 'aj:theme'

export const estNuit = (): boolean => document.documentElement.getAttribute('data-da') === 'b'

export function poseNuit(nuit: boolean): void {
  try { localStorage.setItem('aj-theme', nuit ? 'nuit' : 'jour') } catch { /* navigation privée */ }
  if (nuit) document.documentElement.setAttribute('data-da', 'b')
  else document.documentElement.removeAttribute('data-da')
  window.dispatchEvent(new Event(EVENEMENT))
}

/** L'état du thème, tenu à jour quel que soit l'endroit où on le change. */
export function useNuit(): [boolean, (nuit: boolean) => void] {
  const [nuit, setNuit] = useState(estNuit)
  useEffect(() => {
    const suit = () => setNuit(estNuit())
    window.addEventListener(EVENEMENT, suit)
    return () => window.removeEventListener(EVENEMENT, suit)
  }, [])
  return [nuit, poseNuit]
}

/** Le bouton lune / soleil : un clic bascule entre jour et nuit. `dansMenu` : un
    élément du menu de navigation (icône + « Nuit » / « Jour »), sinon un bouton rond. */
export function BoutonTheme({ dansMenu = false }: { dansMenu?: boolean }) {
  const [nuit, pose] = useNuit()
  const titre = nuit ? 'Passer en mode jour' : 'Passer en mode nuit'
  return (
    <button type="button" className={dansMenu ? 'nav-theme' : 'iconbtn bouton-theme'} onClick={() => pose(!nuit)}
      aria-pressed={nuit} title={titre} aria-label={titre}>
      {nuit ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
      {dansMenu && (nuit ? 'Jour' : 'Nuit')}
    </button>
  )
}

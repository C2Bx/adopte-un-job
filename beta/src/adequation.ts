/* L'adéquation du profil avec les offres, calculée par CV-Matching (MS5).
   Un seul calcul par version du profil, partagé entre le deck et les
   candidatures (le cache vit dans api.ts). Tant qu'il n'est pas arrivé, ou
   s'il échoue, la carte est vide : rien ne s'affiche, rien ne bloque. */

import { useEffect, useState } from 'react'
import { api } from './api'
import type { Adequation } from './api'

/** Référence d'AVP → adéquation. `version` : ce qui doit relancer le calcul (le profil). */
export function useAdequations(version: unknown): Map<string, Adequation> {
  const [carte, setCarte] = useState<Map<string, Adequation>>(() => new Map())
  useEffect(() => {
    let vivant = true
    void api.adequations().then((m) => { if (vivant) setCarte(m) })
    return () => { vivant = false }
  }, [version])
  return carte
}

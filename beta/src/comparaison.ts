import { useCallback, useEffect, useState } from 'react'
import { compteLocal, ecritLocal, litLocal } from './upgrade'

const memoire = new Map<string, number[]>()
const valide = (v: unknown): number[] => Array.isArray(v) ? [...new Set(v.filter((n): n is number => Number.isSafeInteger(n) && n > 0))].slice(0, 3) : []
export function useSelectionComparaison() {
  const compte = compteLocal()
  const lit = () => memoire.get(compte) ?? valide(litLocal('comparaison', []))
  const [selection, setSelection] = useState(lit)
  useEffect(() => {
    const reprend = () => setSelection(lit())
    const stockage = () => { memoire.delete(compte); reprend() }
    window.addEventListener('aj:upgrade-local', reprend)
    window.addEventListener('storage', stockage)
    return () => { window.removeEventListener('aj:upgrade-local', reprend); window.removeEventListener('storage', stockage) }
  }, [compte])
  const change = useCallback((v: number[] | ((avant: number[]) => number[])) => {
    const avant = memoire.get(compte) ?? valide(litLocal('comparaison', []))
    const suite = valide(typeof v === 'function' ? v(avant) : v)
    memoire.set(compte, suite)
    setSelection(suite)
    if (!ecritLocal('comparaison', suite)) window.dispatchEvent(new Event('aj:upgrade-local'))
  }, [compte])
  return [selection, change] as const
}

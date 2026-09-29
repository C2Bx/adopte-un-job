/* Les champs partagés par le formulaire guidé et le questionnaire.
   Ils vivaient dans Profil.tsx, où le questionnaire ne pouvait pas les
   atteindre. Les recopier aurait donné deux listes de puces qui divergent :
   une seule, appelée des deux côtés. */

import { useMemo, useState } from 'react'
import type { MetierOpt } from '../types'

export function Puces({ id, liste, valeurs, max, onChange }: {
  id: string
  liste: { slug?: string; label: string }[]
  valeurs: string[]
  max?: number
  onChange: (v: string[]) => void
}) {
  return (
    <div className="pchips" id={id} tabIndex={-1}>
      {liste.map((o) => {
        const cle = o.slug ?? o.label
        const on = valeurs.includes(cle)
        return (
          <button
            key={cle}
            type="button"
            className={`pchip${on ? ' on' : ''}`}
            onClick={() => {
              if (on) onChange(valeurs.filter((v) => v !== cle))
              else if (!max || valeurs.length < max) onChange([...valeurs, cle])
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

export function MetiersOptChoix({ id, liste, familles, valeurs, onChange }: {
  id: string
  liste: MetierOpt[]
  familles: { id: string; libelle: string }[]
  valeurs: MetierOpt[]
  onChange: (v: MetierOpt[]) => void
}) {
  const [choix, setChoix] = useState('')
  const parFamille = useMemo(() => {
    const m = new Map<string, MetierOpt[]>()
    for (const x of liste) {
      const k = x.familleLibelle ?? x.famille ?? 'Autres'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(x)
    }
    return [...m.entries()]
  }, [liste])
  return (
    <div id={id} tabIndex={-1}>
      <div className="pchips">
        {valeurs.map((m) => (
          <span className="pchip on lib" key={m.code}>
            {m.nom}
            <button type="button" aria-label="Retirer" onClick={() => onChange(valeurs.filter((x) => x.code !== m.code))}>✕</button>
          </span>
        ))}
        {valeurs.length === 0 && <span className="pvide">Aucun métier visé — sans lui, le score ne sait pas où tu veux aller.</span>}
      </div>
      {valeurs.length < 3 && (
        <select
          value={choix}
          onChange={(e) => {
            const m = liste.find((x) => x.code === e.target.value)
            if (m && !valeurs.some((v) => v.code === m.code)) onChange([...valeurs, m])
            setChoix('')
          }}
          aria-label="Ajouter un métier"
        >
          <option value="">Ajouter un métier…</option>
          {parFamille.map(([f, ms]) => (
            <optgroup label={f} key={f}>
              {ms.map((m) => <option key={m.code} value={m.code}>{m.nom}{m.avpOuverts ? ` (${m.avpOuverts} AVP)` : ''}</option>)}
            </optgroup>
          ))}
        </select>
      )}
      {familles.length > 0 && valeurs.length > 0 && (
        <span className="pa">Famille{valeurs.length > 1 ? 's' : ''} : {[...new Set(valeurs.map((v) => v.familleLibelle ?? v.famille))].join(', ')}</span>
      )}
    </div>
  )
}

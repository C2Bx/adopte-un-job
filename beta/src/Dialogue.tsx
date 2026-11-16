import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/** Une fenêtre au premier plan, indépendante des conteneurs défilants. */
export function Feuille({ onFermer, children, pied, titre = 'Détail et options' }: {
  onFermer: () => void; children: React.ReactNode; pied?: React.ReactNode; titre?: string
}) {
  const dialogue = useRef<HTMLDialogElement>(null)
  const titreId = useId()
  useEffect(() => {
    const el = dialogue.current
    if (!el) return
    const avant = document.activeElement as HTMLElement | null
    const debordement = document.body.style.overflow
    el.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      el.close()
      document.body.style.overflow = debordement
      if (avant?.isConnected) avant.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(<dialog ref={dialogue} className="sheet" aria-labelledby={titreId}
    onKeyDown={(e) => {
      e.stopPropagation()
      if (e.key !== 'Tab') return
      const elements = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter((el) => el.getClientRects().length > 0)
      const premier = elements[0]; const dernier = elements.at(-1)
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier?.focus() }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier?.focus() }
    }}
    onCancel={(e) => { e.preventDefault(); onFermer() }}
    onClick={(e) => { if (e.target === e.currentTarget) onFermer() }}>
    <div className="sheet-box">
      <div className="dialogue-entete"><h2 id={titreId}>{titre}</h2>
        <button type="button" className="btn-mini" onClick={onFermer} autoFocus>Fermer <span aria-hidden="true">×</span></button>
      </div>
      <div className="dialogue-corps"><div className="panneau">{children}</div></div>
      {pied && <div className="dialogue-pied">{pied}</div>}
    </div>
  </dialog>, document.body)
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design.css'
import './beta.css'
import './v2.css'
import './upgrades.css'
import { App } from './App'
import { ProtectionEcran } from './ProtectionEcran'

const racine = document.getElementById('racine')
if (!racine) throw new Error('#racine absent de index.html')

const affiche = () => createRoot(racine).render(<StrictMode><ProtectionEcran><App /></ProtectionEcran></StrictMode>)
if (new URLSearchParams(location.search).get('demo') === '1') {
  void import('./modeDemo').then(({ activeDemo }) => { activeDemo(); affiche() }).catch(() => { racine.textContent = 'La démonstration est indisponible. Recharge la page pour réessayer.' })
} else affiche()

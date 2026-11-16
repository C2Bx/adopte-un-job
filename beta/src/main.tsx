import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design.css'
import './beta.css'
import './v2.css'
import './upgrades.css'
import './interface.css'
import { App } from './App'
import { ProtectionEcran } from './ProtectionEcran'

const racine = document.getElementById('racine')
if (!racine) throw new Error('#racine absent de index.html')

const affiche = () => createRoot(racine).render(<StrictMode><ProtectionEcran><App /></ProtectionEcran></StrictMode>)
affiche()

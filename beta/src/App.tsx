/* La coquille : barre du haut, écrans, navigation.
   Un seul état de session vit ici et descend aux écrans — un contexte serait
   du cérémonial pour cinq écrans qui partagent trois valeurs. */

import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { profilVide } from './regles'
import type { Profil, Utilisateur } from './types'
import { Connexion } from './ecrans/Connexion'
import { EcranProfil } from './ecrans/Profil'
import { EcranDeck } from './ecrans/Deck'
import { EcranMatchs } from './ecrans/Matchs'

export type Onglet = 'swipe' | 'interets' | 'messages' | 'profil'

const ONGLETS: { cle: Onglet; icone: string; nom: string }[] = [
  { cle: 'swipe', icone: 'i-swipe', nom: 'Swipe' },
  { cle: 'interets', icone: 'i-heart', nom: 'Intérêts' },
  { cle: 'messages', icone: 'i-chat', nom: 'Messages' },
  { cle: 'profil', icone: 'i-user', nom: 'Profil' },
]

/* Les pastilles de la barre. Règle du prototype : sur « Intérêts », le nombre de
   matchs en vert s'il y en a, sinon le nombre d'offres en attente de réponse en
   rouge — la bonne nouvelle passe devant l'attente. Sur « Messages », les
   messages non lus. Une pastille qui compte quelque chose qu'on ne peut pas
   traiter n'est qu'un point rouge de plus. */
interface Badges { interets: number; interetsMatch: boolean; messages: number }

export function App() {
  const [charge, setCharge] = useState(false)
  const [moi, setMoi] = useState<Utilisateur | null>(null)
  const [profil, setProfil] = useState<Profil>(profilVide)
  const [onglet, setOnglet] = useState<Onglet>('swipe')
  const [badges, setBadges] = useState<Badges>({ interets: 0, interetsMatch: false, messages: 0 })

  const rafraichisBadges = useCallback(async () => {
    try {
      const [i, m] = await Promise.all([api.interets(), api.matchs()])
      const matchs = i.filter((x) => x.decision === 'oui' && x.match).length
      const attente = i.filter((x) => x.decision === 'oui' && !x.match).length
      setBadges({
        interets: matchs || attente,
        interetsMatch: matchs > 0,
        messages: m.reduce((n, x) => n + x.non_lus, 0),
      })
    } catch {
      setBadges({ interets: 0, interetsMatch: false, messages: 0 })
    }
  }, [])

  const chargeProfil = useCallback(async (u: Utilisateur | null) => {
    if (u?.role === 'candidat') {
      try {
        setProfil(await api.profil())
      } catch {
        setProfil(profilVide)
      }
    }
  }, [])

  useEffect(() => {
    let vivant = true
    void (async () => {
      let u: Utilisateur | null = null
      try {
        u = await api.moi()
      } catch {
        u = null
      }
      if (!vivant) return
      setMoi(u)
      await chargeProfil(u)
      if (u?.role === 'candidat') await rafraichisBadges()
      if (vivant) setCharge(true)
    })()
    return () => { vivant = false }
  }, [chargeProfil, rafraichisBadges])

  const entre = async (u: Utilisateur) => {
    setMoi(u)
    await chargeProfil(u)
    // Un compte neuf n'a rien à swiper : on l'amène là où il y a à faire.
    setOnglet(u.role === 'candidat' ? 'profil' : 'swipe')
  }

  const sors = async () => {
    await api.deconnexion()
    setMoi(null)
    setProfil(profilVide)
    setOnglet('swipe')
  }

  // Changer d'onglet est le moment naturel pour remettre les compteurs à jour :
  // pas de sondage, et jamais de pastille périmée sous les yeux.
  const va = (o: Onglet) => {
    setOnglet(o)
    if (moi?.role === 'candidat') void rafraichisBadges()
  }

  if (!charge) {
    return <div className="chargement" role="status">Chargement…</div>
  }
  if (!moi) {
    return <Connexion onEntre={entre} />
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="mark">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="7" width="16" height="21" rx="5" fill="var(--brand)" opacity=".28" transform="rotate(-8 12 17)" />
            <rect x="9" y="4" width="16" height="21" rx="5" fill="var(--brand)" />
            <circle cx="17" cy="14.5" r="3.2" fill="var(--accent)" />
          </svg>
          <b>Adopte un Job</b>
          <span className="tag-beta">bêta</span>
        </span>
        <span className="spacer" />
        <button className="iconbtn" onClick={() => void sors()} title="Se déconnecter" aria-label="Se déconnecter">
          <svg><use href="#i-sortie" /></svg>
        </button>
      </header>

      {onglet === 'swipe' && (
        <EcranDeck
          profil={profil}
          versProfil={(e) => { setOnglet('profil'); viseEtape(e) }}
          onDecision={() => { if (moi.role === 'candidat') void rafraichisBadges() }}
        />
      )}
      {onglet === 'interets' && <EcranMatchs vue="interets" profil={profil} />}
      {onglet === 'messages' && <EcranMatchs vue="messages" profil={profil} />}
      {onglet === 'profil' && (
        <EcranProfil profil={profil} onProfil={setProfil} />
      )}

      <nav className="nav">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            onClick={() => va(o.cle)}
            aria-current={onglet === o.cle ? 'page' : undefined}
          >
            <svg><use href={`#${o.icone}`} /></svg>
            {o.cle === 'interets' && badges.interets > 0 && (
              <span className="badge"
                style={{ background: badges.interetsMatch ? 'var(--yes)' : 'var(--no)' }}>
                {badges.interets}
              </span>
            )}
            {o.cle === 'messages' && badges.messages > 0 && (
              <span className="badge">{badges.messages}</span>
            )}
            {o.nom}
          </button>
        ))}
      </nav>
    </div>
  )
}

/* L'écran de profil lit l'étape demandée au montage : passer par le document
   évite de faire remonter un état d'étape jusqu'ici pour un seul usage. */
function viseEtape(e: number): void {
  window.setTimeout(() => {
    document.dispatchEvent(new CustomEvent('aj:etape', { detail: e }))
  }, 0)
}

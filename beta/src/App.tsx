/* La coquille : barre du haut, écrans, navigation.
   Un seul état de session vit ici et descend aux écrans. Un seul jeu d'onglets :
   on swipe, on suit ses candidatures, on tient son profil. */

import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { profilVide } from './regles'
import type { Profil, Utilisateur } from './types'
import { Spinner } from './Attente'
import { Connexion } from './ecrans/Connexion'
import { EcranProfil } from './ecrans/Profil'
import { EcranDeck } from './ecrans/Deck'
import { EcranMatchs } from './ecrans/Matchs'

export type Onglet = 'swipe' | 'interets' | 'profil'

const ONGLETS: { cle: Onglet; icone: string; nom: string }[] = [
  { cle: 'swipe', icone: 'i-swipe', nom: 'Swipe' },
  { cle: 'interets', icone: 'i-heart', nom: 'Candidatures' },
  { cle: 'profil', icone: 'i-user', nom: 'Profil' },
]

/* L'onglet vit dans l'adresse (#swipe, #candidatures, #profil) : un F5 garde
   l'onglet où l'on est, et le bouton « retour » du téléphone revient à
   l'onglet précédent au lieu de quitter l'application. */
const ANCRES: Record<Onglet, string> = { swipe: 'swipe', interets: 'candidatures', profil: 'profil' }

function ongletDeLAdresse(): Onglet {
  const a = window.location.hash.replace(/^#/, '')
  return (Object.keys(ANCRES) as Onglet[]).find((o) => ANCRES[o] === a) ?? 'swipe'
}

/* La pastille de « Candidatures » : les présélections en vert s'il y en a,
   sinon les candidatures en attente en rouge. */
interface Badges { interets: number; interetsMatch: boolean }

export function App() {
  const [charge, setCharge] = useState(false)
  const [panne, setPanne] = useState(false)
  const [moi, setMoi] = useState<Utilisateur | null>(null)
  const [profil, setProfil] = useState<Profil>(profilVide)
  const [onglet, setOnglet] = useState<Onglet>(ongletDeLAdresse)
  const [badges, setBadges] = useState<Badges>({ interets: 0, interetsMatch: false })

  useEffect(() => {
    const ancre = '#' + ANCRES[onglet]
    if (window.location.hash === ancre) return
    // une adresse sans ancre (premier chargement) se complète sans créer d'étape d'historique
    if (window.location.hash === '') window.history.replaceState(null, '', ancre)
    else window.history.pushState(null, '', ancre)
  }, [onglet])

  useEffect(() => {
    const suit = () => setOnglet(ongletDeLAdresse())
    window.addEventListener('popstate', suit)
    return () => window.removeEventListener('popstate', suit)
  }, [])

  const rafraichisBadges = useCallback(async (u: Utilisateur | null) => {
    if (!u) return
    try {
      const i = await api.interets()
      const presel = i.filter((x) => x.candidature && ['preselection', 'entretien', 'acceptee'].includes(x.candidature.statut)).length
      const attente = i.filter((x) => x.candidature && ['envoyee', 'vue'].includes(x.candidature.statut)).length
      setBadges({ interets: presel || attente, interetsMatch: presel > 0 })
    } catch {
      setBadges({ interets: 0, interetsMatch: false })
    }
  }, [])

  const chargeProfil = useCallback(async (u: Utilisateur | null) => {
    if (!u) return
    try {
      setProfil(await api.profil())
    } catch {
      setProfil(profilVide)
    }
  }, [])

  /* Au démarrage, on demande au serveur qui on est.

     `auth/moi` répond 200 avec `utilisateur: null` quand personne n'est
     connecté : une exception ici n'est donc JAMAIS un « pas connecté », c'est
     le réseau, le serveur ou une limite de débit. Les confondre renvoyait à
     l'écran de connexion sur un simple hoquet — un F5 malchanceux suffisait à
     « déconnecter » quelqu'un dont la session était parfaitement valide, et
     le jeton en mémoire était perdu avec le rechargement. On réessaie, puis
     on le dit, au lieu de faire croire à une déconnexion. */
  const demarre = useCallback(async (): Promise<void> => {
    setPanne(false)
    let u: Utilisateur | null = null
    for (let essai = 0; ; essai++) {
      try {
        u = await api.moi()
        break
      } catch {
        if (essai >= 1) { setPanne(true); setCharge(true); return }
        await new Promise((r) => setTimeout(r, 1200))
      }
    }
    setMoi(u)
    await chargeProfil(u)
    await rafraichisBadges(u)
    setCharge(true)
  }, [chargeProfil, rafraichisBadges])

  useEffect(() => { void demarre() }, [demarre])

  const entre = async (u: Utilisateur) => {
    setMoi(u)
    await chargeProfil(u)
    // Un compte neuf n'a rien à swiper : on l'amène là où il y a à faire.
    setOnglet('profil')
    await rafraichisBadges(u)
  }

  const sors = async () => {
    await api.deconnexion()
    setMoi(null)
    setProfil(profilVide)
    setOnglet('swipe')
  }

  const va = (o: Onglet) => {
    setOnglet(o)
    void rafraichisBadges(moi)
  }

  if (!charge) {
    return (
      <div className="chargement" role="status">
        <Spinner grand />
        <span>Chargement…</span>
      </div>
    )
  }
  /* Le serveur n'a pas répondu : on ne sait pas si la session est valide, donc
     on ne prétend pas qu'elle ne l'est plus. */
  if (panne) {
    return (
      <div className="chargement" role="alert">
        <b>Le serveur n’a pas répondu</b>
        <span>Ta session n’est pas perdue pour autant : c’est la connexion qui a manqué.</span>
        <button className="btn primaire" onClick={() => { setCharge(false); void demarre() }}>Réessayer</button>
      </div>
    )
  }
  if (!moi) {
    return <Connexion onEntre={entre} />
  }

  return (
    <div className="app">
      <header className="topbar">
        {/* Le logo porte déjà le nom : l'écrire une seconde fois à côté ferait
            doublon. L'alt le rend au lecteur d'écran. */}
        <span className="mark">
          <img src={`${import.meta.env.BASE_URL}marque/logo-horizontal.png`}
            alt="Adopte un Job" className="logo" width={168} height={36} />
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
          onDecision={() => void rafraichisBadges(moi)}
        />
      )}
      {onglet === 'interets' && <EcranMatchs profil={profil} />}
      {onglet === 'profil' && <EcranProfil profil={profil} onProfil={setProfil} />}

      <nav className={`nav n${ONGLETS.length}`}>
        {ONGLETS.map((o) => (
          <button key={o.cle} onClick={() => va(o.cle)} aria-current={onglet === o.cle ? 'page' : undefined}>
            <svg><use href={`#${o.icone}`} /></svg>
            {o.cle === 'interets' && badges.interets > 0 && (
              <span className="badge" style={{ background: badges.interetsMatch ? 'var(--yes)' : 'var(--no)' }}>{badges.interets}</span>
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

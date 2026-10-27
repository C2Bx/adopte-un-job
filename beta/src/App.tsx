/* La coquille : barre du haut, écrans, navigation.
   Un seul état de session vit ici et descend aux écrans. Un seul jeu d'onglets :
   on swipe, on suit ses candidatures, on tient son profil. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { profilVide, profilEnvoi } from './regles'
import { SauvegardeProfil } from './sauvegarde'
import type { EtatSauvegarde } from './sauvegarde'
import type { Profil, Utilisateur } from './types'
import { Spinner } from './Attente'
import { Connexion } from './ecrans/Connexion'
import { EcranProfil } from './ecrans/Profil'
import { EcranDeck } from './ecrans/Deck'
import { EcranMatchs } from './ecrans/Matchs'
import { BoutonTheme } from './theme'

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
  const [profilPret, setProfilPret] = useState(false)
  const [profilErreur, setProfilErreur] = useState(false)
  const [etatSauvegarde, setEtatSauvegarde] = useState<EtatSauvegarde>('repos')
  const sauvegarde = useRef<SauvegardeProfil | null>(null)
  const chargementProfil = useRef(0)

  const modifieProfil = (p: Profil) => {
    setProfil(p)
    sauvegarde.current?.modifie(p)
  }
  const termineSauvegarde = async () => { await sauvegarde.current?.termine() }

  useEffect(() => {
    const protege = (e: BeforeUnloadEvent) => {
      if (sauvegarde.current?.enAttente) { e.preventDefault(); e.returnValue = '' }
    }
    const reprend = () => { void sauvegarde.current?.termine().catch(() => undefined) }
    window.addEventListener('beforeunload', protege)
    window.addEventListener('online', reprend)
    return () => {
      window.removeEventListener('beforeunload', protege)
      window.removeEventListener('online', reprend)
    }
  }, [])
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
    const generation = ++chargementProfil.current
    setProfilPret(false)
    setProfilErreur(false)
    sauvegarde.current?.arrete()
    try {
      const p = await api.profil()
      if (generation !== chargementProfil.current || (await api.moi())?.id !== u.id) return
      const file = new SauvegardeProfil(u.id, async (brouillon) => {
        if ((await api.moi())?.id !== u.id) throw new Error('Session changée')
        await api.enregistreProfil(profilEnvoi(brouillon))
      }, (e) => { if (sauvegarde.current === file) setEtatSauvegarde(e) })
      sauvegarde.current = file
      const brouillon = file.reprend()
      setProfil(brouillon ?? p)
      setEtatSauvegarde('repos')
      setProfilPret(true)
      if (brouillon) file.modifie(brouillon)
    } catch {
      if (generation === chargementProfil.current) setProfilErreur(true)
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

  // Leur jeton dure une heure, sans renouvellement : à expiration, retour à la connexion.
  useEffect(() => {
    const sortie = () => {
      chargementProfil.current++
      sauvegarde.current?.arrete()
      sauvegarde.current = null
      setMoi(null); setProfil(profilVide); setProfilPret(false)
    }
    window.addEventListener('aj:session-expiree', sortie)
    return () => window.removeEventListener('aj:session-expiree', sortie)
  }, [])

  const entre = async (u: Utilisateur) => {
    setMoi(u)
    await chargeProfil(u)
    // Un compte neuf n'a rien à swiper : on l'amène là où il y a à faire.
    setOnglet('profil')
    await rafraichisBadges(u)
  }

  const sors = async () => {
    // Le brouillon reste récupérable si le serveur est momentanément indisponible.
    try { await termineSauvegarde() } catch { /* conservé dans l'onglet */ }
    sauvegarde.current?.arrete()
    sauvegarde.current = null
    chargementProfil.current++
    setProfilPret(false)
    await api.deconnexion()
    setMoi(null)
    setProfil(profilVide)
    setOnglet('swipe')
  }

  const va = (o: Onglet) => {
    void termineSauvegarde().catch(() => undefined)
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

  if (!profilPret) {
    return <div className="chargement" role={profilErreur ? 'alert' : 'status'}>
      <b>{profilErreur ? 'Ton profil est temporairement indisponible' : 'Chargement du profil…'}</b>
      {profilErreur && <>
        <span>Réessaie pour retrouver ta saisie avant de continuer.</span>
        <button className="btn primaire" onClick={() => void chargeProfil(moi)}>Réessayer</button>
        <button className="btn" onClick={() => void sors()}>Se déconnecter</button>
      </>}
    </div>
  }

  return (
    <div className="app">
      <header className="topbar">
        {/* Le logo porte déjà le nom : l'écrire une seconde fois à côté ferait
            doublon. L'alt le rend au lecteur d'écran. */}
        <span className="mark">
          <img src={`${import.meta.env.BASE_URL}marque/logo-horizontal.png`}
            alt="Adopte un Job" className="logo logo-jour" width={168} height={36} />
          <img src={`${import.meta.env.BASE_URL}marque/logo-horizontal-blanc.png`}
            alt="" aria-hidden="true" className="logo logo-nuit" width={168} height={36} />
        </span>
        <span className="spacer" />
        {/* Sur téléphone, la recherche et les filtres vivent ici (là où était la
            déconnexion, désormais seulement dans le menu du bas) : une loupe qui
            ouvre la recherche, un entonnoir qui ouvre les filtres. Le deck écoute
            ces deux événements. Masqué sur grand écran (barre dédiée dans le deck). */}
        {onglet === 'swipe' && (
          <div className="topbar-actions">
            <button className="iconbtn" title="Rechercher" aria-label="Rechercher une offre"
              onClick={() => document.dispatchEvent(new Event('aj:recherche'))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" />
              </svg>
            </button>
            <button className="iconbtn" title="Filtres" aria-label="Filtrer les offres"
              onClick={() => document.dispatchEvent(new Event('aj:filtres'))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {onglet === 'swipe' && (
        <EcranDeck
          profil={profil}
          avantDecision={termineSauvegarde}
          versProfil={(e) => { setOnglet('profil'); viseEtape(e) }}
          onDecision={() => void rafraichisBadges(moi)}
        />
      )}
      {onglet === 'interets' && <EcranMatchs avantDecision={termineSauvegarde} />}
      {etatSauvegarde === 'erreur' && <div className="pal manque" role="alert">
        <b>Ton profil n’a pas encore été enregistré.</b>
        Le brouillon est gardé dans cet onglet.
        <button className="btn-mini" onClick={() => void termineSauvegarde().catch(() => undefined)}>Réessayer</button>
      </div>}
      {onglet === 'profil' && <EcranProfil profil={profil} onProfil={setProfil}
        onModification={modifieProfil} etat={etatSauvegarde} avantOperation={termineSauvegarde} />}

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
        {/* sur grand écran, la déconnexion vit en bas du rail ; sur téléphone, dans la barre du haut */}
        {/* jour / nuit : dans le menu, sur tous les écrans */}
        <BoutonTheme dansMenu />
        <button className="nav-sortie" onClick={() => void sors()} title="Se déconnecter">
          <svg><use href="#i-sortie" /></svg>
          Déconnexion
        </button>
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

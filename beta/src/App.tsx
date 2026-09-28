/* La coquille : barre du haut, écrans, navigation.
   Un seul état de session vit ici et descend aux écrans. Deux jeux d'onglets,
   selon le rôle : le candidat swipe, candidate, discute, a un agenda et un
   profil ; l'organisation a un tableau de bord, ses offres, ses candidatures,
   l'agenda, les messages et sa page d'organisation. */

import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { profilVide } from './regles'
import type { Profil, Utilisateur } from './types'
import { Connexion } from './ecrans/Connexion'
import { EcranProfil } from './ecrans/Profil'
import { EcranDeck } from './ecrans/Deck'
import { EcranMatchs } from './ecrans/Matchs'
import { EcranAgenda } from './ecrans/Agenda'
import { EcranTableau } from './ecrans/Tableau'
import { EcranCandidaturesRH, EcranOffres, EcranOrganisation } from './ecrans/Recruteur'

export type Onglet = 'swipe' | 'interets' | 'messages' | 'agenda' | 'profil' | 'tableau' | 'offres' | 'candidatures' | 'organisation'

const ONGLETS_CANDIDAT: { cle: Onglet; icone: string; nom: string }[] = [
  { cle: 'swipe', icone: 'i-swipe', nom: 'Swipe' },
  { cle: 'interets', icone: 'i-heart', nom: 'Candidatures' },
  { cle: 'messages', icone: 'i-chat', nom: 'Messages' },
  { cle: 'agenda', icone: 'i-agenda', nom: 'Agenda' },
  { cle: 'profil', icone: 'i-user', nom: 'Profil' },
]
const ONGLETS_RH: { cle: Onglet; icone: string; nom: string }[] = [
  { cle: 'tableau', icone: 'i-tableau', nom: 'Tableau' },
  { cle: 'offres', icone: 'i-swipe', nom: 'Offres' },
  { cle: 'candidatures', icone: 'i-heart', nom: 'Candidatures' },
  { cle: 'messages', icone: 'i-chat', nom: 'Messages' },
  { cle: 'agenda', icone: 'i-agenda', nom: 'Agenda' },
  { cle: 'organisation', icone: 'i-user', nom: 'Organisation' },
]

/* Les pastilles. Candidat : sur « Candidatures », les présélections en vert
   s'il y en a, sinon les candidatures en attente en rouge ; sur « Messages »,
   les non-lus. Organisation : sur « Candidatures », ce qui est à traiter. */
interface Badges { interets: number; interetsMatch: boolean; messages: number; aTraiter: number }

export function App() {
  const [charge, setCharge] = useState(false)
  const [panne, setPanne] = useState(false)
  const [moi, setMoi] = useState<Utilisateur | null>(null)
  const [profil, setProfil] = useState<Profil>(profilVide)
  const [onglet, setOnglet] = useState<Onglet>('swipe')
  const [offreRH, setOffreRH] = useState<number | undefined>(undefined)
  const [badges, setBadges] = useState<Badges>({ interets: 0, interetsMatch: false, messages: 0, aTraiter: 0 })

  const rafraichisBadges = useCallback(async (u: Utilisateur | null) => {
    if (!u) return
    try {
      const m = await api.matchs()
      const nonLus = m.reduce((n, x) => n + x.non_lus, 0)
      if (u.role === 'candidat') {
        const i = await api.interets()
        const presel = i.filter((x) => x.candidature && ['preselection', 'entretien', 'acceptee'].includes(x.candidature.statut)).length
        const attente = i.filter((x) => x.candidature && ['envoyee', 'vue'].includes(x.candidature.statut)).length
        setBadges({ interets: presel || attente, interetsMatch: presel > 0, messages: nonLus, aTraiter: 0 })
      } else {
        const c = u.organisation ? await api.candidatures() : []
        setBadges({ interets: 0, interetsMatch: false, messages: nonLus, aTraiter: c.filter((x) => x.statut === 'envoyee' || x.statut === 'vue').length })
      }
    } catch {
      setBadges({ interets: 0, interetsMatch: false, messages: 0, aTraiter: 0 })
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
    if (u && u.role !== 'candidat') setOnglet(u.organisation ? 'tableau' : 'organisation')
    await chargeProfil(u)
    await rafraichisBadges(u)
    setCharge(true)
  }, [chargeProfil, rafraichisBadges])

  useEffect(() => { void demarre() }, [demarre])

  const entre = async (u: Utilisateur) => {
    setMoi(u)
    await chargeProfil(u)
    // Un compte neuf n'a rien à swiper : on l'amène là où il y a à faire.
    setOnglet(u.role === 'candidat' ? 'profil' : (u.organisation ? 'tableau' : 'organisation'))
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
    if (o !== 'candidatures') setOffreRH(undefined)
    void rafraichisBadges(moi)
  }

  const rechargeMoi = async () => {
    try {
      const u = await api.moi()
      setMoi(u)
      await rafraichisBadges(u)
    } catch { /* on garde l'état courant */ }
  }

  /* Passer de l'autre côté sans se déconnecter : le serveur décide qui en a le
     droit, on se contente de recharger ce qui dépend du rôle. Le profil et les
     candidatures restent en base — on revient à l'identique en rebasculant. */
  const [bascule, setBascule] = useState(false)
  const changeRole = async (role: Utilisateur['role']) => {
    if (!moi || moi.role === role || bascule) return
    setBascule(true)
    try {
      const u = await api.basculeRole(role)
      setMoi(u)
      setOffreRH(undefined)
      await chargeProfil(u)
      setOnglet(u.role === 'candidat' ? 'swipe' : (u.organisation ? 'tableau' : 'organisation'))
      await rafraichisBadges(u)
    } catch { /* le serveur a refusé : on reste où on est */ } finally {
      setBascule(false)
    }
  }

  if (!charge) {
    return <div className="chargement" role="status">Chargement…</div>
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

  const candidat = moi.role === 'candidat'
  const onglets = candidat ? ONGLETS_CANDIDAT : ONGLETS_RH

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
          <span className="tag-beta">{candidat ? 'bêta' : (moi.organisation?.nom ?? 'recruteur')}</span>
        </span>
        <span className="spacer" />
        {moi.peutBasculer && (
          <div className="bascule" role="group" aria-label="Changer de rôle">
            <button aria-pressed={candidat} disabled={bascule}
              onClick={() => void changeRole('candidat')}>Candidat</button>
            <button aria-pressed={!candidat} disabled={bascule}
              onClick={() => void changeRole('recruteur')}>Recruteur</button>
          </div>
        )}
        <button className="iconbtn" onClick={() => void sors()} title="Se déconnecter" aria-label="Se déconnecter">
          <svg><use href="#i-sortie" /></svg>
        </button>
      </header>

      {candidat && onglet === 'swipe' && (
        <EcranDeck
          profil={profil}
          versProfil={(e) => { setOnglet('profil'); viseEtape(e) }}
          onDecision={() => void rafraichisBadges(moi)}
        />
      )}
      {candidat && onglet === 'interets' && <EcranMatchs vue="interets" profil={profil} />}
      {onglet === 'messages' && <EcranMatchs vue="messages" profil={profil} />}
      {onglet === 'agenda' && <EcranAgenda role={moi.role} />}
      {candidat && onglet === 'profil' && <EcranProfil profil={profil} onProfil={setProfil} />}

      {!candidat && onglet === 'tableau' && (moi.organisation
        ? <EcranTableau />
        : <EcranOrganisation moi={moi} onChange={() => void rechargeMoi()} />)}
      {!candidat && onglet === 'offres' && <EcranOffres onCandidatures={(id) => { setOffreRH(id); setOnglet('candidatures') }} />}
      {!candidat && onglet === 'candidatures' && (
        <EcranCandidaturesRH offre={offreRH} onRetour={offreRH ? () => { setOffreRH(undefined); setOnglet('offres') } : undefined} />
      )}
      {!candidat && onglet === 'organisation' && <EcranOrganisation moi={moi} onChange={() => void rechargeMoi()} />}

      <nav className={`nav n${onglets.length}`}>
        {onglets.map((o) => (
          <button key={o.cle} onClick={() => va(o.cle)} aria-current={onglet === o.cle ? 'page' : undefined}>
            <svg><use href={`#${o.icone}`} /></svg>
            {o.cle === 'interets' && badges.interets > 0 && (
              <span className="badge" style={{ background: badges.interetsMatch ? 'var(--yes)' : 'var(--no)' }}>{badges.interets}</span>
            )}
            {o.cle === 'candidatures' && badges.aTraiter > 0 && <span className="badge">{badges.aTraiter}</span>}
            {o.cle === 'messages' && badges.messages > 0 && <span className="badge">{badges.messages}</span>}
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

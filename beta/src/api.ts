/* Le seul endroit qui parle à l'API.
   Le jeton est doublé : cookie httpOnly pour le navigateur, en-tête Bearer pour
   l'application empaquetée, qui n'aura pas de cookie. Les deux sont acceptés
   côté serveur, donc le même code marche dans les deux mondes. */

import { ErreurApi } from './types'
import type {
  Interet, MatchLigne, Message, Offre, Profil, Referentiels, Utilisateur,
} from './types'

const RACINE = '/avp/app/api/index.php'
const CLE_JETON = 'aj.jeton'

export function jeton(): string | null {
  try {
    return localStorage.getItem(CLE_JETON)
  } catch {
    return null
  }
}

function poseJeton(t: string | null): void {
  try {
    if (t) localStorage.setItem(CLE_JETON, t)
    else localStorage.removeItem(CLE_JETON)
  } catch {
    /* navigation privée : le cookie prend le relais */
  }
}

async function appel<T>(methode: string, route: string, corps?: unknown): Promise<T> {
  const entetes: Record<string, string> = { Accept: 'application/json' }
  if (corps !== undefined) entetes['Content-Type'] = 'application/json'
  const t = jeton()
  if (t) entetes['Authorization'] = `Bearer ${t}`

  let r: Response
  try {
    r = await fetch(`${RACINE}/${route}`, {
      method: methode,
      headers: entetes,
      credentials: 'include',
      body: corps === undefined ? undefined : JSON.stringify(corps),
    })
  } catch {
    // Coupure réseau : le message doit dire quoi faire, pas afficher une pile.
    throw new ErreurApi('reseau', 'Pas de connexion au serveur. Réessaie dans un instant.', 0)
  }

  const brut = await r.text()
  const donnees: unknown = brut ? JSON.parse(brut) : null

  if (!r.ok) {
    const d = donnees as { erreur?: string; message?: string; manques?: string[] } | null
    throw new ErreurApi(
      d?.erreur ?? 'inconnue',
      d?.message ?? `Erreur ${r.status}`,
      r.status,
      d?.manques,
    )
  }
  return donnees as T
}

export const api = {
  /* ------------------------------------------------------------- comptes */
  async inscription(email: string, motdepasse: string, role: 'candidat' | 'recruteur') {
    const d = await appel<{ jeton: string; utilisateur: Utilisateur }>(
      'POST', 'auth/inscription', { email, motdepasse, role },
    )
    poseJeton(d.jeton)
    return d.utilisateur
  },

  async connexion(email: string, motdepasse: string) {
    const d = await appel<{ jeton: string; utilisateur: Utilisateur }>(
      'POST', 'auth/connexion', { email, motdepasse },
    )
    poseJeton(d.jeton)
    return d.utilisateur
  },

  async deconnexion() {
    try {
      await appel('POST', 'auth/deconnexion')
    } finally {
      poseJeton(null)
    }
  },

  async moi() {
    const d = await appel<{ utilisateur: Utilisateur | null }>('GET', 'auth/moi')
    return d.utilisateur
  },

  export: () => appel<Record<string, unknown>>('GET', 'auth/export'),
  supprimeCompte: () => appel<{ ok: boolean }>('DELETE', 'auth/compte'),

  /* -------------------------------------------------------- référentiels */
  referentiels: () => appel<Referentiels>('GET', 'referentiels'),

  /* --------------------------------------------------------------- profil */
  async profil() {
    const d = await appel<{ profil: Profil }>('GET', 'profil')
    return d.profil
  },
  async enregistreProfil(p: Profil) {
    const d = await appel<{ profil: Profil }>('PUT', 'profil', p)
    return d.profil
  },

  /* Le fichier n'est pas envoyé : on journalise le dépôt et ce que la lecture
     a produit, pour pouvoir retraiter plus tard sans redemander le CV. */
  deposeCV: (m: {
    nom: string; mime: string; octets: number
    moteur: string; version: string; brut: unknown; retenu: unknown
  }) => appel<{ cv: { id: number; nom: string } }>('POST', 'profil/cv', m),

  /* ----------------------------------------------------------------- deck */
  async deck() {
    const d = await appel<{ offres: Offre[] }>('GET', 'deck')
    return d.offres
  },
  swipe: (offre: number, decision: 'oui' | 'non' | 'plus_tard') =>
    appel<{ ok: boolean; match: { id: number; qualite: number } | null }>(
      'POST', 'swipes', { offre, decision },
    ),
  /* Revenir sur une décision l'efface. La réécrire ne suffirait pas : la carte
     reviendrait au deck en restant décidée. */
  annuleSwipe: (offre: number) => appel<{ ok: boolean }>('DELETE', `swipes/${offre}`),

  /* Tout ce que j'ai décidé. Les matchs seuls ne suffisent pas : il en faut
     deux pour en créer un, donc la liste serait presque toujours vide. */
  async interets() {
    const d = await appel<{ interets: Interet[] }>('GET', 'interets')
    return d.interets
  },

  /* --------------------------------------------------------------- matchs */
  async matchs() {
    const d = await appel<{ matchs: MatchLigne[] }>('GET', 'matchs')
    return d.matchs
  },
  async messages(matchId: number) {
    const d = await appel<{ messages: Message[] }>('GET', `matchs/${matchId}/messages`)
    return d.messages
  },
  envoieMessage: (matchId: number, corps: string) =>
    appel<{ ok: boolean }>('POST', `matchs/${matchId}/messages`, { corps }),
}

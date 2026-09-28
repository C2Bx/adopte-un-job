/* Le seul endroit qui parle à l'API.

   Le jeton de session vit en MÉMOIRE et dans le cookie httpOnly posé par le
   serveur. Il n'est écrit dans localStorage que sous Capacitor (application
   empaquetée), qui n'a pas de cookie : dans un navigateur, un jeton lisible par
   JavaScript serait volé par le premier script injecté. */

import { ErreurApi } from './types'
import type {
  Candidature, CvInfo, Evenement, Facettes, Filtres, Interet,
  MetierOpt, Offre, Profil, ProfilEnvoi, Referentiels, StatutCandidature, Utilisateur,
} from './types'

const RACINE = '/avp/app/api/index.php'
const CLE_JETON = 'aj.jeton'

/** Sous Capacitor, pas de cookie : le jeton doit survivre à la fermeture. */
const NATIF = typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: unknown }).Capacitor)

let jetonMemoire: string | null = null

export function jeton(): string | null {
  if (jetonMemoire) return jetonMemoire
  if (!NATIF) return null
  try {
    return localStorage.getItem(CLE_JETON)
  } catch {
    return null
  }
}

function poseJeton(t: string | null): void {
  jetonMemoire = t
  if (!NATIF) return
  try {
    if (t) localStorage.setItem(CLE_JETON, t)
    else localStorage.removeItem(CLE_JETON)
  } catch {
    /* stockage indisponible : le jeton en mémoire suffit pour la session */
  }
}

/** Construit une URL absolue de l'API (pour un lien, un PDF, un .ics). */
export function urlApi(route: string, query?: Record<string, string | number | boolean | undefined>): string {
  const u = new URL(`${RACINE}/${route}`, window.location.origin)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== '' && v !== false) u.searchParams.set(k, String(v === true ? 1 : v))
  }
  return u.toString()
}

async function appel<T>(methode: string, route: string, corps?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const entetes: Record<string, string> = { Accept: 'application/json' }
  const formulaire = typeof FormData !== 'undefined' && corps instanceof FormData
  if (corps !== undefined && !formulaire) entetes['Content-Type'] = 'application/json'
  const t = jeton()
  if (t) entetes['Authorization'] = `Bearer ${t}`

  let r: Response
  try {
    r = await fetch(urlApi(route, query), {
      method: methode,
      headers: entetes,
      credentials: 'include',
      body: corps === undefined ? undefined : (formulaire ? (corps as FormData) : JSON.stringify(corps)),
    })
  } catch {
    // Coupure réseau : le message doit dire quoi faire, pas afficher une pile.
    throw new ErreurApi('reseau', 'Pas de connexion au serveur. Réessaie dans un instant.', 0)
  }

  const brut = await r.text()
  let donnees: unknown = null
  try {
    donnees = brut ? JSON.parse(brut) : null
  } catch {
    donnees = null
  }

  if (!r.ok) {
    const d = donnees as { erreur?: string; message?: string; manques?: string[] } | null
    throw new ErreurApi(d?.erreur ?? 'inconnue', d?.message ?? `Erreur ${r.status}`, r.status, d?.manques)
  }
  return donnees as T
}

function filtresEnQuery(f: Filtres = {}): Record<string, string | number | boolean | undefined> {
  return {
    q: f.q, ville: f.ville, province: f.province, famille: f.famille, direction: f.direction,
    contrat: f.contrat, zone: f.zone, metier: f.metier, source: f.source, statut: f.statut,
    teletravail: f.teletravail, encadrement: f.encadrement, debutant: f.debutant, salaire: f.salaire, clos: f.clos,
  }
}

export const api = {
  /* ------------------------------------------------------------- comptes */
  /* Prénom et nom sont exigés par l'API de l'équipe, qui tient les comptes :
     son `RegisterRequest` les déclare obligatoires. Ils amorcent aussi le
     profil, qui les demandait de toute façon à l'étape suivante. */
  async inscription(email: string, motdepasse: string, prenom: string, nom: string) {
    const d = await appel<{ jeton: string; utilisateur: Utilisateur }>('POST', 'auth/inscription', { email, motdepasse, prenom, nom })
    poseJeton(d.jeton)
    return d.utilisateur
  },
  async connexion(email: string, motdepasse: string) {
    const d = await appel<{ jeton: string; utilisateur: Utilisateur }>('POST', 'auth/connexion', { email, motdepasse })
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
  /* Ce que le service de comptes permet, avant même d'être connecté : l'écran
     d'accueil n'affiche « mot de passe oublié » que si ça mène quelque part. */
  async capacites() {
    const d = await appel<{ comptesModifiables: boolean }>('GET', 'auth/moi')
    return d.comptesModifiables === true
  },
  sessions: () => appel<{ sessions: { courante: boolean; ouverte: string; active: string; expire: string }[] }>('GET', 'auth/sessions'),
  fermeAutresSessions: () => appel<{ ok: boolean }>('DELETE', 'auth/sessions'),
  /* Le compte est tenu par l'API de l'équipe : ces quatre gestes ne font que
     la relayer, et répondent 501 tant qu'elle ne les expose pas. */
  changeMotDePasse: (ancien: string, nouveau: string) => appel<{ ok: boolean }>('PUT', 'auth/motdepasse', { ancien, nouveau }),
  changeEmail: (email: string, motdepasse: string) => appel<{ ok: boolean; email: string }>('PUT', 'auth/email', { email, motdepasse }),
  oubli: (email: string) => appel<{ ok: boolean; message: string }>('POST', 'auth/oubli', { email }),
  oubliConfirme: (code: string, motdepasse: string) => appel<{ ok: boolean; message: string }>('POST', 'auth/oubli/confirme', { code, motdepasse }),
  export: () => appel<Record<string, unknown>>('GET', 'auth/export'),
  supprimeCompte: () => appel<{ ok: boolean }>('DELETE', 'auth/compte'),
  cles: () => appel<{ cles: { id: number; nom: string; prefixe: string; creee: string; utilisee: string | null }[] }>('GET', 'cles'),
  creeCle: (nom: string) => appel<{ cle: { id: number; nom: string; prefixe: string; cle: string } }>('POST', 'cles', { nom }),
  revoqueCle: (id: number) => appel<{ ok: boolean }>('DELETE', `cles/${id}`),

  /* -------------------------------------------------------- référentiels */
  referentiels: () => appel<Referentiels>('GET', 'referentiels'),
  metiers: () => appel<{ metiers: MetierOpt[]; familles: { id: string; libelle: string; couleur: string | null }[] }>('GET', 'metiers'),
  metier: (code: string) => appel<{ metier: MetierOpt & { famille: string; competences: { code: string; nom: string; groupe: string; poids: string; niveau_requis: string | null }[] } }>('GET', `metiers/${code}`),
  competencesOpt: (q: string) => appel<{ competences: { code: string; nom: string; groupe: string }[] }>('GET', 'competences', undefined, { q }),

  /* --------------------------------------------------------------- profil */
  async profil() {
    const d = await appel<{ profil: Profil }>('GET', 'profil')
    return d.profil
  },
  async enregistreProfil(p: ProfilEnvoi) {
    const d = await appel<{ profil: Profil }>('PUT', 'profil', p)
    return d.profil
  },
  jsonResume: () => appel<Record<string, unknown>>('GET', 'profil/jsonresume'),
  urlCvGenere: () => urlApi('profil/cv.pdf'),

  /* -------------------------------------------------------------------- CV */
  deposeCV: (m: { nom: string; mime: string; octets: number; moteur: string; version: string; brut: unknown; retenu: unknown }) =>
    appel<{ cv: { id: number; nom: string } }>('POST', 'profil/cv', m),
  async cvs() {
    const d = await appel<{ cv: CvInfo[]; actif: CvInfo | null }>('GET', 'profil/cv')
    return d
  },
  retenuCV: (id: number, retenu: unknown, actif = true) => appel<{ cv: CvInfo }>('PUT', `profil/cv/${id}`, { retenu, actif }),
  supprimeCV: (id: number) => appel<{ ok: boolean }>('DELETE', `profil/cv/${id}`),
  /** Le fichier d'origine, en multipart. Chiffré côté serveur. */
  deposeFichierCV(fichier: File, cv?: number) {
    const f = new FormData()
    f.append('fichier', fichier, fichier.name)
    if (cv) f.append('cv', String(cv))
    return appel<{ cv: CvInfo }>('POST', 'profil/cv/fichier', f)
  },
  urlFichierCV: (id: number) => urlApi(`profil/cv/${id}/fichier`),

  /* ----------------------------------------------------------------- AVP */
  async avp(f: Filtres = {}, page = 1) {
    return appel<{ offres: Offre[]; total: number; page: number; facettes: Facettes; filtres: Filtres }>('GET', 'avp', undefined, { ...filtresEnQuery(f), page })
  },
  avpFiltres: (f: Filtres = {}) => appel<{ facettes: Facettes }>('GET', 'avp/filtres', undefined, filtresEnQuery(f)),
  avpDetail: (id: number) => appel<{ offre: Offre; candidature: { id: number; statut: StatutCandidature } | null; metier?: { nom: string; famille: string; competences: { code: string; nom: string; poids: string; niveau_requis: string | null }[] } }>('GET', `avp/${id}`),
  vue: (id: number, source: 'deck' | 'detail' | 'recherche' | 'lien') =>
    appel<{ ok: boolean }>('POST', `avp/${id}/vue`, { source }).catch(() => ({ ok: false })),

  /* ----------------------------------------------------------------- deck */
  async deck(f: Filtres = {}) {
    return appel<{ offres: Offre[]; facettes: Facettes; filtres: Filtres }>('GET', 'deck', undefined, filtresEnQuery(f))
  },
  swipe: (offre: number, decision: 'oui' | 'non' | 'plus_tard', message?: string) =>
    appel<{ ok: boolean; candidature: { id: number; statut: StatutCandidature } | null; entrainement?: boolean; message?: string }>(
      'POST', 'swipes', { offre, decision, message },
    ),
  annuleSwipe: (offre: number) => appel<{ ok: boolean }>('DELETE', `swipes/${offre}`),
  async interets() {
    const d = await appel<{ interets: Interet[] }>('GET', 'interets')
    return d.interets
  },

  /* --------------------------------------------------------- candidatures */
  candidate: (offre: number, message?: string) => appel<{ candidature: Candidature }>('POST', 'candidatures', { offre, message }),
  async candidatures(q: { offre?: number; statut?: StatutCandidature } = {}) {
    const d = await appel<{ candidatures: Candidature[] }>('GET', 'candidatures', undefined, q)
    return d.candidatures
  },
  candidature: (id: number) => appel<{ candidature: Candidature; evenements: Evenement[] }>('GET', `candidatures/${id}`),
  statutCandidature: (id: number, statut: StatutCandidature, motif?: string) =>
    appel<{ candidature: Candidature }>('PUT', `candidatures/${id}/statut`, { statut, motif }),
  suggestions: (candidature: number) => appel<{ suggestions: string[] }>('GET', `candidatures/${candidature}/suggestions`),
  urlCvCandidature: (id: number) => urlApi(`candidatures/${id}/cv.pdf`),
  urlCvOriginal: (id: number) => urlApi(`candidatures/${id}/cv-original`),

  notifications: () => appel<{ notifications: { id: number; type: string; donnees: Record<string, unknown> | null; quand: string; lu: boolean }[] }>('GET', 'notifications'),
  notificationsLues: () => appel<{ ok: boolean }>('POST', 'notifications/lu'),

}

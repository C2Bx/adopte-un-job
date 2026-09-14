/* Les formes que rend l'API. Elles ne sont pas devinées : chaque champ ici
   correspond à une colonne rendue par api/depot.php. Quand l'API change, c'est
   ce fichier qui doit échouer à la compilation, pas l'écran au moment du clic. */

export type Role = 'candidat' | 'recruteur' | 'admin'

export interface Utilisateur {
  id: number
  email: string
  role: Role
}

export interface Langue {
  langue: string
  niveau: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
}

export interface Experience {
  poste: string
  secteur: string
  /** « 2022 » ou « 2022-09 » : on garde la précision donnée, sans inventer de mois. */
  debut: string
  fin: string
}

export interface Formation {
  /** 1 Bac · 2 Bac+2 · 3 Bac+3 · 4 Bac+5. Jamais d'année : elle révèle l'âge. */
  niveau: number
  domaine: string
}

export interface Profil {
  prenom: string
  initiale: string
  nom: string
  telephone: string
  dispo: string | null
  teletravail: 'peu importe' | 'non' | 'hybride' | 'total'
  ouverture: 'strict' | 'ouvert'
  salaireMin: number | null
  permis: boolean | null
  formation: number | null
  zones: string[]
  contrats: string[]
  metiers: string[]
  competences: string[]
  langues: Langue[]
  experiences: Experience[]
  formations: Formation[]
}

export interface Critere {
  cle: string
  poids: number
  v: number | null
}

export interface Score {
  qualite: number
  recruteur: number
  candidat: number
  confiance: number
  passerelle?: boolean
  passerelleRaison?: string | null
  vigilance?: string[]
  detail?: {
    recruteur: Critere[]
    candidat: Critere[]
    couverture: { v: number; ok: number[]; manque: number[]; bonus: number[] }
  }
}

export interface Offre {
  id: number
  titre: string
  entreprise: string | null
  secteur: string | null
  taille: string | null
  pitch: string | null
  contrat: string
  zone: string
  teletravail: string
  salaire: [number | null, number | null] | null
  experienceMin: number
  formationMin: number | null
  permis: boolean
  debut: string | null
  description: string | null
  requis: string[]
  souhaite: string[]
  publiee: string | null
  score?: Score
}

/** Une offre déjà décidée : l'offre, la décision, et sa suite éventuelle. */
export interface Interet extends Offre {
  decision: 'oui' | 'non' | 'plus_tard'
  quand: string
  match: number | null
  statut: string
}

export interface MatchLigne {
  id: number
  qualite: number
  statut: string
  created_at: string
  offre: number
  titre: string
  entreprise?: string
  candidate_id?: number
  non_lus: number
}

export interface Message {
  id: number
  moi: boolean
  corps: string
  quand: string
}

export interface Referentiels {
  zones: string[]
  contrats: string[]
  niveauxLangue: string[]
  formations: Record<string, string>
  metiers: { slug: string; label: string; family: string | null }[]
  competences: { slug: string; label: string; family: string | null }[]
}

/** Une erreur d'API porte un code exploitable, pas seulement un texte. */
export class ErreurApi extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly http: number,
    readonly manques?: string[],
  ) {
    super(message)
  }
}

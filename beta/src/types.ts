/* Les formes que les écrans connaissent. Les réponses de l'API de l'équipe
   sont traduites dans ces formes par api.ts : quand leur API change, c'est
   api.ts qui s'adapte, et ce fichier qui doit échouer à la compilation. */

export interface Utilisateur {
  id: number
  email: string
  /** Le service de comptes de l'équipe sait-il changer mot de passe et adresse ?
      C'est le serveur qui le dit ; le front n'affiche que ce qui aboutira. */
  comptesModifiables?: boolean
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

/** Un métier du référentiel OPT-NC (84), avec sa famille. */
export interface MetierOpt {
  code: string
  nom: string
  famille?: string | null
  familleLibelle?: string | null
  avpOuverts?: number
}

/** Une compétence OPT rattachée au profil, et d'où vient le rattachement. */
export interface CompetenceOpt {
  code: string
  nom: string
  source?: 'saisie' | 'alias' | 'mots' | 'cv'
  depuis?: string | null
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
  /** Contraintes exclues — mêmes clés que la colonne SET `candidates.refus`. */
  refus: string[]
  formation: number | null
  zones: string[]
  contrats: string[]
  metiers: string[]
  metiersOpt: MetierOpt[]
  competences: string[]
  competencesOpt: CompetenceOpt[]
  langues: Langue[]
  experiences: Experience[]
  formations: Formation[]
}

/** Ce que PUT profil accepte en plus : les codes, pas les objets. */
export interface ProfilEnvoi extends Omit<Profil, 'metiersOpt' | 'competencesOpt'> {
  metiersOpt: string[]
  competencesOptSaisies?: string[]
}

export interface Offre {
  id: number
  source: 'app' | 'opt'
  reference: string | null
  url: string | null
  titre: string
  entreprise: string | null
  secteur: string | null
  taille: string | null
  pitch: string | null
  ville: string | null
  province: string | null
  direction: string | null
  familles: string[]
  codeMetier: string | null
  metierOpt: string | null
  codeRome: string | null
  employmentType: string | null
  nbAgentsEncadres: number | null
  competencesTexte: { texte: string; type: string }[]
  responsabilites: string[]
  conditions: string | null
  avantages: string | null
  exigencesPhysiques: string | null
  qualifications: string | null
  experienceTexte: string | null
  unite: string | null
  lieu: string | null
  adresse: string | null
  datePublication: string | null
  expire: string | null
  joursRestants: number | null
  statut: string | null
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
}

/** Une offre déjà décidée : l'offre, la décision, et sa suite éventuelle. */
export interface Interet extends Offre {
  decision: 'oui' | 'non' | 'plus_tard'
  quand: string
  match: number | null
  candidature: { id: number; statut: StatutCandidature; equipe?: StatutEquipe | null; equipeLe?: string | null } | null
}

/** La decision du recruteur, lue dans l'API de l'equipe (AVPRO-NC decide). */
export type StatutEquipe = 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE' | 'ANNULEE'

export type StatutCandidature = 'envoyee' | 'vue' | 'preselection' | 'entretien' | 'acceptee' | 'refusee' | 'retiree'

export interface CvInfo {
  id: number
  nom: string
  mime: string
  octets: number
  actif: boolean
  depose: string
  fichier: boolean
  lecture: { moteur: string; version: string; lu: Record<string, unknown>; retenu: Record<string, unknown> | null; quand: string } | null
}

export interface Referentiels {
  zones: string[]
  contrats: string[]
  niveauxLangue: string[]
  formations: Record<string, string>
  metiers: { slug: string; label: string; family: string | null }[]
  competences: { slug: string; label: string; family: string | null }[]
  metiersOpt: MetierOpt[]
  familles: { id: string; libelle: string; couleur: string | null }[]
  villes: string[]
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

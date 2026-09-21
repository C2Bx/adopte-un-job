/* Les formes que rend l'API. Elles ne sont pas devinées : chaque champ ici
   correspond à une colonne rendue par api/depot.php ou par un module de route.
   Quand l'API change, c'est ce fichier qui doit échouer à la compilation, pas
   l'écran au moment du clic. */

export type Role = 'candidat' | 'recruteur' | 'admin'

export interface Utilisateur {
  id: number
  email: string
  role: Role
  emailVerifie?: boolean
  organisation?: { id: number; nom: string; role?: string } | null
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
  /** Ce qui ne correspond pas à ce que le candidat a dit vouloir : affiché, jamais éliminatoire. */
  ecarts?: string[]
  detail?: {
    recruteur: Critere[]
    candidat: Critere[]
    couverture: { v: number | null; ok: number[]; manque: number[]; bonus: number[] }
    structurel?: { v: number | null; ok: { code: string; nom: string; poids: number }[]; manque: { code: string; nom: string; poids: number; niveau?: number | null }[] } | null
    lexical?: { v: number | null; ok: { texte: string; type: string; mots: string[] }[]; manque: { texte: string; type: string }[]; total: number } | null
    ecarts?: string[]
    semantique?: number
  }
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
  score?: Score
  /** Côté organisation, dans la liste des offres. */
  candidatures?: number
  enAttente?: number
  matchs?: number
  vues?: number
}

/** Une offre déjà décidée : l'offre, la décision, et sa suite éventuelle. */
export interface Interet extends Offre {
  decision: 'oui' | 'non' | 'plus_tard'
  quand: string
  match: number | null
  candidature: { id: number; statut: StatutCandidature } | null
}

export type StatutCandidature = 'envoyee' | 'vue' | 'preselection' | 'entretien' | 'acceptee' | 'refusee' | 'retiree'

export interface EntretienCourt {
  id: number
  debut_utc: string
  duree_min: number
  mode: string
  lieu: string | null
  statut: string
}

export interface CandidatVu {
  id: number
  metiers: string[]
  metiersOpt: MetierOpt[]
  competences: string[]
  competencesOpt: CompetenceOpt[]
  experiences: Experience[]
  formations: Formation[]
  langues: Langue[]
  zones: string[]
  contrats: string[]
  dispo: string | null
  teletravail: string
  formation: number | null
  prenom?: string
  nom?: string
  initiale?: string
  telephone?: string
  email?: string | null
  candidature?: { id: number; statut: StatutCandidature; le: string } | null
  score?: Score
}

export interface Candidature {
  id: number
  statut: StatutCandidature
  message: string | null
  qualite: number | null
  creee: string
  maj: string
  decidee: string | null
  match: number | null
  offre: Offre
  entretiens: EntretienCourt[]
  dossier: { cvGenere: boolean; cvOriginal: boolean; ouvertPourOrganisation: boolean }
  candidat?: CandidatVu
  score?: { qualite: number | null; detail: Score['detail'] } | null
}

export interface Evenement {
  type: string
  quand: string
  moi: boolean
  donnees: Record<string, unknown> | null
}

export interface Entretien {
  id: number
  candidature: number
  offre: number
  titre: string
  organisation: string
  debut: string
  duree: number
  mode: string
  lieu: string | null
  notes: string | null
  statut: 'propose' | 'confirme' | 'refuse' | 'annule' | 'termine'
  proposeParMoi: boolean
  candidat?: { id: number; prenom: string; nom: string; telephone: string }
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
  prenom?: string
  initiale?: string
  candidature: number | null
  non_lus: number
}

export interface Message {
  id: number
  moi: boolean
  corps: string
  quand: string
}

export interface Facettes {
  ville: { valeur: string; n: number }[]
  province: { valeur: string; n: number }[]
  direction: { valeur: string; n: number }[]
  contrat: { valeur: string; n: number }[]
  zone: { valeur: string; n: number }[]
  source: { valeur: string; n: number }[]
  famille: { valeur: string; n: number }[]
  metier: { valeur: string; nom: string | null; n: number }[]
  teletravail: number
  encadrement: number
  debutant: number
  salaire: number
}

/** Les filtres du catalogue et du deck — les mêmes que ceux de l'API OPT. */
export interface Filtres {
  q?: string
  ville?: string
  province?: string
  famille?: string
  direction?: string
  contrat?: string
  zone?: string
  metier?: string
  teletravail?: boolean
  encadrement?: boolean
  debutant?: boolean
  salaire?: boolean
  source?: '' | 'app' | 'opt'
  statut?: 'ouvert' | 'clos' | 'tous'
  clos?: boolean
}

export interface Organisation {
  id: number
  nom: string
  slug: string | null
  secteur: string | null
  taille: string | null
  site: string | null
  pitch: string | null
  source: 'app' | 'opt'
  monRole: 'proprietaire' | 'recruteur' | 'lecteur' | null
}

export interface Membre {
  id: number
  email: string
  role: 'proprietaire' | 'recruteur' | 'lecteur'
  depuis: string
  decisions: number
}

export interface Indicateur {
  cle: string
  libelle: string
  valeur: number | null
  unite?: string
  detail?: string | null
  definition: string
}

export interface Tableau {
  periode: number
  offre: number | null
  indicateurs: Indicateur[]
  entonnoir: { etape: string; n: number }[]
  parStatut: Record<StatutCandidature, number>
  series: Record<'vues' | 'candidatures' | 'matchs' | 'refus', { jour: string; n: number }[]>
  repartitions: Record<'zones' | 'niveaux' | 'metiers' | 'experience' | 'sourcesVues', { valeur: string; n: number }[]>
  competences: { manquantes: { valeur: string; n: number }[]; presentes: { valeur: string; n: number }[] }
  offres: {
    id: number; titre: string; statut: string; source: string; ville: string | null; publiee: string | null; expire: string | null
    joursRestants: number | null; vues: number; candidatures: number; enAttente: number; refus: number; matchs: number
    entretiens: number; ecartee: number; scoreMoyen: number | null; tauxConversion: number | null
  }[]
  equipe: { valeur: string; n: number }[]
  genere: string
}

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

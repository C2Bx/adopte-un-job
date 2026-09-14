-- Adopte un Job — schema de production (MySQL 8, InnoDB, utf8mb4).
--
-- Trois principes qui expliquent la forme du schema :
--   1. Ce qui est interdit au score n'est pas stocke. Pas de date de naissance,
--      pas de photo, pas d'adresse, pas d'annee d'obtention de diplome.
--   2. Le masquage avant match est une regle serveur : les colonnes sensibles
--      vivent dans des tables distinctes de celles qu'on expose au deck.
--   3. Les tables de conformite (consents, audit_logs) existent des le depart :
--      elles ne se rajoutent pas apres coup sans reprendre tout le schema.
--
-- Les dates sont stockees en UTC. La Nouvelle-Caledonie est a UTC+11 : afficher
-- l'heure locale est un travail d'affichage, jamais de stockage.

SET NAMES utf8mb4;

-- =========================================================== comptes et acces

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(190) NOT NULL,
  pass_hash     VARCHAR(255) NOT NULL,
  role          ENUM('candidat','recruteur','admin') NOT NULL,
  status        ENUM('actif','suspendu','anonymise') NOT NULL DEFAULT 'actif',
  created_at    DATETIME NOT NULL,
  last_login_at DATETIME NULL,
  anonymized_at DATETIME NULL,
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Jeton opaque en base plutot qu'un JWT : on veut pouvoir revoquer une session
-- immediatement, ce qu'un jeton auto-porte ne permet pas.
CREATE TABLE IF NOT EXISTS sessions (
  token      CHAR(64) PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  last_seen  DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  ua_hash    CHAR(32) NULL,
  KEY ix_sessions_user (user_id),
  KEY ix_sessions_exp (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS companies (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  ridet      VARCHAR(20) NULL,
  sector     VARCHAR(80) NULL,
  size       ENUM('1-10','11-50','51-200','200+') NULL,
  website    VARCHAR(190) NULL,
  pitch      TEXT NULL,
  created_at DATETIME NOT NULL,
  KEY ix_companies_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_members (
  company_id BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  role       ENUM('proprietaire','recruteur') NOT NULL DEFAULT 'recruteur',
  created_at DATETIME NOT NULL,
  PRIMARY KEY (company_id, user_id),
  KEY ix_cm_user (user_id),
  CONSTRAINT fk_cm_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================================ referentiels

CREATE TABLE IF NOT EXISTS occupations (
  id     SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug   VARCHAR(60) NOT NULL,
  label  VARCHAR(80) NOT NULL,
  family VARCHAR(40) NULL,
  UNIQUE KEY uq_occ_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- La table qui rend la reconversion calculable : une proximite explicite,
-- ecrite et discutable, plutot qu'une distance devinee par un modele.
CREATE TABLE IF NOT EXISTS occupation_links (
  a_id      SMALLINT UNSIGNED NOT NULL,
  b_id      SMALLINT UNSIGNED NOT NULL,
  proximity DECIMAL(3,2) NOT NULL,
  reason    VARCHAR(160) NULL,
  PRIMARY KEY (a_id, b_id),
  CONSTRAINT fk_ol_a FOREIGN KEY (a_id) REFERENCES occupations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ol_b FOREIGN KEY (b_id) REFERENCES occupations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skills (
  id     SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug   VARCHAR(80) NOT NULL,
  label  VARCHAR(80) NOT NULL,
  family VARCHAR(40) NULL,
  UNIQUE KEY uq_skill_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Toutes les orthographes rencontrees pointent vers une competence canonique :
-- « dev web », « developpement web » et « web developer » sont la meme chose.
CREATE TABLE IF NOT EXISTS skill_aliases (
  alias    VARCHAR(80) PRIMARY KEY,
  skill_id SMALLINT UNSIGNED NOT NULL,
  KEY ix_sa_skill (skill_id),
  CONSTRAINT fk_sa_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================================ candidats

CREATE TABLE IF NOT EXISTS candidates (
  user_id       BIGINT UNSIGNED PRIMARY KEY,
  prenom        VARCHAR(40) NOT NULL DEFAULT '',
  initiale      CHAR(2) NOT NULL DEFAULT '',
  nom           VARCHAR(60) NOT NULL DEFAULT '',   -- masque avant match
  telephone     VARCHAR(30) NOT NULL DEFAULT '',   -- masque avant match
  dispo         CHAR(7) NULL,                      -- AAAA-MM
  teletravail   ENUM('peu importe','non','hybride','total') NOT NULL DEFAULT 'peu importe',
  ouverture     ENUM('strict','ouvert') NOT NULL DEFAULT 'strict',
  salaire_min   INT UNSIGNED NULL,
  permis        TINYINT NULL,                      -- 1 oui, 0 non, NULL non renseigne
  formation_max TINYINT UNSIGNED NULL,             -- 1 Bac … 4 Bac+5
  experience_ans TINYINT UNSIGNED NULL,
  resume_json   JSON NULL,                         -- le document de verite, lu en entier
  visible       TINYINT NOT NULL DEFAULT 1,
  updated_at    DATETIME NOT NULL,
  CONSTRAINT fk_cand_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_zones (
  user_id BIGINT UNSIGNED NOT NULL,
  zone    VARCHAR(30) NOT NULL,
  PRIMARY KEY (user_id, zone),
  CONSTRAINT fk_cz_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_contracts (
  user_id  BIGINT UNSIGNED NOT NULL,
  contract ENUM('CDI','CDD','Alternance','Intérim','Stage') NOT NULL,
  PRIMARY KEY (user_id, contract),
  CONSTRAINT fk_cc_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_occupations (
  user_id       BIGINT UNSIGNED NOT NULL,
  occupation_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, occupation_id),
  KEY ix_co_occ (occupation_id),
  CONSTRAINT fk_co_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_co_occ FOREIGN KEY (occupation_id) REFERENCES occupations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_skills (
  user_id  BIGINT UNSIGNED NOT NULL,
  skill_id SMALLINT UNSIGNED NOT NULL,
  source   ENUM('saisie','cv','question') NOT NULL DEFAULT 'saisie',
  PRIMARY KEY (user_id, skill_id),
  KEY ix_cs_skill (skill_id),
  CONSTRAINT fk_cs_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_languages (
  user_id BIGINT UNSIGNED NOT NULL,
  langue  VARCHAR(30) NOT NULL,
  niveau  ENUM('A1','A2','B1','B2','C1','C2') NOT NULL,
  PRIMARY KEY (user_id, langue),
  CONSTRAINT fk_cl_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_experiences (
  id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  poste   VARCHAR(120) NOT NULL DEFAULT '',
  secteur VARCHAR(60) NOT NULL DEFAULT '',
  debut   VARCHAR(7) NOT NULL DEFAULT '',   -- « 2022 » ou « 2022-09 » : on garde la precision donnee
  fin     VARCHAR(7) NOT NULL DEFAULT '',
  rang    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  KEY ix_ce_user (user_id, rang),
  CONSTRAINT fk_ce_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aucune date : l'annee d'obtention d'un diplome revele l'age, qui est un
-- critere de discrimination interdit. Le niveau suffit a comparer.
CREATE TABLE IF NOT EXISTS candidate_educations (
  id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  niveau  TINYINT UNSIGNED NOT NULL,
  domaine VARCHAR(120) NOT NULL DEFAULT '',
  rang    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  KEY ix_ced_user (user_id, rang),
  CONSTRAINT fk_ced_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================================= documents

CREATE TABLE IF NOT EXISTS resumes (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  filename    VARCHAR(190) NOT NULL,
  mime        VARCHAR(80) NOT NULL,
  bytes       INT UNSIGNED NOT NULL,
  storage_key VARCHAR(190) NOT NULL,   -- jamais servi en direct : lien signe, courte duree
  sha256      CHAR(64) NOT NULL,
  is_active   TINYINT NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL,
  KEY ix_res_user (user_id, is_active),
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- La sortie brute est conservee avec la version du moteur : c'est ce qui permet
-- de retraiter un CV plus tard sans redemander le fichier a l'utilisateur.
CREATE TABLE IF NOT EXISTS resume_extractions (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resume_id  BIGINT UNSIGNED NOT NULL,
  engine     VARCHAR(40) NOT NULL,
  version    VARCHAR(20) NOT NULL,
  payload    JSON NOT NULL,
  accepted   JSON NULL,                -- ce que l'utilisateur a effectivement valide
  created_at DATETIME NOT NULL,
  KEY ix_rx_resume (resume_id),
  CONSTRAINT fk_rx_resume FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================================================================== offres

CREATE TABLE IF NOT EXISTS jobs (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id     BIGINT UNSIGNED NOT NULL,
  created_by     BIGINT UNSIGNED NULL,
  titre          VARCHAR(160) NOT NULL,
  occupation_id  SMALLINT UNSIGNED NULL,
  contrat        ENUM('CDI','CDD','Alternance','Intérim','Stage') NOT NULL,
  zone           VARCHAR(30) NOT NULL,
  teletravail    ENUM('non','hybride','total') NOT NULL DEFAULT 'non',
  salaire_min    INT UNSIGNED NULL,
  salaire_max    INT UNSIGNED NULL,
  experience_min TINYINT UNSIGNED NOT NULL DEFAULT 0,
  formation_min  TINYINT UNSIGNED NULL,
  permis_requis  TINYINT NOT NULL DEFAULT 0,
  debut          CHAR(7) NULL,
  description    TEXT NULL,
  statut         ENUM('brouillon','publiee','fermee') NOT NULL DEFAULT 'brouillon',
  published_at   DATETIME NULL,
  expires_at     DATETIME NULL,
  created_at     DATETIME NOT NULL,
  updated_at     DATETIME NOT NULL,
  KEY ix_jobs_deck (statut, zone, contrat),
  KEY ix_jobs_company (company_id, statut),
  KEY ix_jobs_occ (occupation_id),
  CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_jobs_occ FOREIGN KEY (occupation_id) REFERENCES occupations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- La distinction exige / souhaite est structurante : un « exige » manquant
-- ecarte, un « souhaite » manquant coute des points. Les confondre fausse tout.
CREATE TABLE IF NOT EXISTS job_skills (
  job_id   BIGINT UNSIGNED NOT NULL,
  skill_id SMALLINT UNSIGNED NOT NULL,
  niveau   ENUM('exige','souhaite') NOT NULL DEFAULT 'souhaite',
  PRIMARY KEY (job_id, skill_id),
  KEY ix_js_skill (skill_id),
  CONSTRAINT fk_js_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_js_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS job_languages (
  job_id BIGINT UNSIGNED NOT NULL,
  langue VARCHAR(30) NOT NULL,
  niveau ENUM('A1','A2','B1','B2','C1','C2') NOT NULL,
  exige  TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (job_id, langue),
  CONSTRAINT fk_jl_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================== interactions

-- Deux scores directionnels, jamais moyennes : la qualite d'un match est le
-- minimum des deux. Une offre parfaite pour l'entreprise et mediocre pour le
-- candidat n'est pas un demi-bon match, c'est un mauvais match.
CREATE TABLE IF NOT EXISTS match_scores (
  job_id        BIGINT UNSIGNED NOT NULL,
  candidate_id  BIGINT UNSIGNED NOT NULL,
  fit_recruteur TINYINT UNSIGNED NOT NULL,
  fit_candidat  TINYINT UNSIGNED NOT NULL,
  qualite       TINYINT UNSIGNED NOT NULL,
  confiance     TINYINT UNSIGNED NOT NULL,
  detail        JSON NOT NULL,
  algo          VARCHAR(12) NOT NULL,
  computed_at   DATETIME NOT NULL,
  PRIMARY KEY (job_id, candidate_id),
  KEY ix_ms_cand (candidate_id, qualite),
  KEY ix_ms_algo (algo),
  CONSTRAINT fk_ms_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_ms_cand FOREIGN KEY (candidate_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Une decision par sens : le candidat sur l'offre, le recruteur sur le candidat.
-- L'unicite empeche le double comptage quand le reseau renvoie deux fois.
CREATE TABLE IF NOT EXISTS swipes (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sens         ENUM('candidat','recruteur') NOT NULL,
  job_id       BIGINT UNSIGNED NOT NULL,
  candidate_id BIGINT UNSIGNED NOT NULL,
  acteur_id    BIGINT UNSIGNED NOT NULL,
  decision     ENUM('oui','non') NOT NULL,
  created_at   DATETIME NOT NULL,
  UNIQUE KEY uq_swipe (sens, job_id, candidate_id),
  KEY ix_sw_acteur (acteur_id, created_at),
  CONSTRAINT fk_sw_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_sw_cand FOREIGN KEY (candidate_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matches (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_id       BIGINT UNSIGNED NOT NULL,
  candidate_id BIGINT UNSIGNED NOT NULL,
  qualite      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  statut       ENUM('ouvert','archive','refuse') NOT NULL DEFAULT 'ouvert',
  created_at   DATETIME NOT NULL,
  UNIQUE KEY uq_match (job_id, candidate_id),
  KEY ix_m_cand (candidate_id, statut),
  CONSTRAINT fk_m_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_m_cand FOREIGN KEY (candidate_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id   BIGINT UNSIGNED NOT NULL,
  auteur_id  BIGINT UNSIGNED NOT NULL,
  corps      TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  read_at    DATETIME NULL,
  KEY ix_msg_match (match_id, id),
  CONSTRAINT fk_msg_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_auteur FOREIGN KEY (auteur_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS appointments (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id   BIGINT UNSIGNED NOT NULL,
  propose_par BIGINT UNSIGNED NOT NULL,
  debut_utc  DATETIME NOT NULL,
  duree_min  SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  mode       ENUM('sur place','visio','telephone') NOT NULL DEFAULT 'sur place',
  lieu       VARCHAR(190) NULL,
  statut     ENUM('propose','accepte','refuse','annule') NOT NULL DEFAULT 'propose',
  created_at DATETIME NOT NULL,
  KEY ix_rdv_match (match_id, debut_utc),
  CONSTRAINT fk_rdv_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  type       VARCHAR(40) NOT NULL,
  payload    JSON NULL,
  created_at DATETIME NOT NULL,
  read_at    DATETIME NULL,
  KEY ix_notif_user (user_id, read_at, id),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================================ conformite

CREATE TABLE IF NOT EXISTS consents (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  finalite   VARCHAR(60) NOT NULL,
  version    VARCHAR(20) NOT NULL,
  accorde    TINYINT NOT NULL,
  created_at DATETIME NOT NULL,
  ip_hash    CHAR(32) NULL,
  KEY ix_cons_user (user_id, finalite),
  CONSTRAINT fk_cons_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Qui a consulte quelle donnee personnelle, et quand. Sans cette table, on ne
-- peut repondre a aucune demande d'acces, et aucune fuite n'est tracable.
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  acteur_id   BIGINT UNSIGNED NULL,
  action      VARCHAR(40) NOT NULL,
  cible_type  VARCHAR(30) NOT NULL,
  cible_id    BIGINT UNSIGNED NULL,
  created_at  DATETIME NOT NULL,
  ip_hash     CHAR(32) NULL,
  KEY ix_audit_acteur (acteur_id, created_at),
  KEY ix_audit_cible (cible_type, cible_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

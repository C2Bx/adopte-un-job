-- Migration 001 (2026-09-21) — organisations, AVP reels, referentiel OPT,
-- candidatures, agenda, securite. Additive et rejouable : chaque ordre est
-- garde par IF NOT EXISTS, ou execute par scripts/migre.py qui verifie la
-- colonne avant un ALTER.
--
-- @alter <table> <colonne> : ALTER TABLE <table> ADD COLUMN ... (migre.py saute
-- l'ordre si la colonne existe deja). Les CREATE TABLE sont passes tels quels.

SET NAMES utf8mb4;

-- ============================================================ organisations
-- Une organisation (companies) regroupe plusieurs comptes recruteurs sur les
-- memes AVP : c'est elle qui porte le tableau de bord, pas le compte.

-- @alter companies slug
ALTER TABLE companies ADD COLUMN slug VARCHAR(60) NULL, ADD UNIQUE KEY uq_comp_slug (slug);
-- @alter companies invite_code
ALTER TABLE companies ADD COLUMN invite_code CHAR(12) NULL, ADD UNIQUE KEY uq_comp_invite (invite_code);
-- @alter companies source
ALTER TABLE companies ADD COLUMN source ENUM('app','opt') NOT NULL DEFAULT 'app';

-- @modify company_members role
ALTER TABLE company_members MODIFY role ENUM('proprietaire','recruteur','lecteur') NOT NULL DEFAULT 'recruteur';

-- =================================================================== comptes
-- @alter users email_verified_at
ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL;
-- @alter users verify_hash
ALTER TABLE users ADD COLUMN verify_hash CHAR(64) NULL;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64) PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL,
  KEY ix_pr_user (user_id),
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cles d'API pour un tiers (ATS, plateforme d'emploi) : le secret n'est jamais
-- stocke, seulement son empreinte ; le prefixe sert a le retrouver.
CREATE TABLE IF NOT EXISTS api_keys (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  nom          VARCHAR(80) NOT NULL,
  prefixe      CHAR(8) NOT NULL,
  hash         CHAR(64) NOT NULL,
  created_at   DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  revoked_at   DATETIME NULL,
  UNIQUE KEY uq_ak_prefixe (prefixe),
  KEY ix_ak_user (user_id),
  CONSTRAINT fk_ak_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Limite de debit : une ligne par cle (ip, compte, route) et par fenetre.
CREATE TABLE IF NOT EXISTS rate_limits (
  cle           VARCHAR(120) PRIMARY KEY,
  fenetre_debut DATETIME NOT NULL,
  n             INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================================== referentiel OPT
-- Le referentiel metiers de l'OPT-NC (odata-referentiel-metiers), tel quel :
-- 12 familles, 84 metiers, 409 competences, 1988 liens ponderes.

CREATE TABLE IF NOT EXISTS opt_familles (
  id      VARCHAR(40) PRIMARY KEY,
  libelle VARCHAR(80) NOT NULL,
  couleur CHAR(7) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opt_metiers (
  code_metier VARCHAR(10) PRIMARY KEY,
  nom         VARCHAR(120) NOT NULL,
  famille_id  VARCHAR(40) NOT NULL,
  actif       TINYINT NOT NULL DEFAULT 1,
  KEY ix_om_famille (famille_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opt_competences (
  code        VARCHAR(12) PRIMARY KEY,
  nom         VARCHAR(255) NOT NULL,
  groupe      VARCHAR(40) NULL,
  slug        VARCHAR(255) NULL,
  KEY ix_oc_groupe (groupe)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opt_metier_competences (
  code_metier     VARCHAR(10) NOT NULL,
  code_competence VARCHAR(12) NOT NULL,
  poids           DECIMAL(4,2) NOT NULL DEFAULT 1,
  niveau_requis   DECIMAL(3,1) NULL,
  PRIMARY KEY (code_metier, code_competence),
  KEY ix_omc_comp (code_competence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opt_niveaux (
  code_competence VARCHAR(12) NOT NULL,
  niveau          TINYINT NOT NULL,
  description     TEXT NULL,
  PRIMARY KEY (code_competence, niveau)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Le candidat exprime ses competences librement ; on les rattache au
-- referentiel OPT (alias explicite ou recouvrement de mots), et on garde la
-- trace de comment, pour qu'il puisse corriger.
CREATE TABLE IF NOT EXISTS candidate_opt_competences (
  user_id         BIGINT UNSIGNED NOT NULL,
  code_competence VARCHAR(12) NOT NULL,
  niveau          TINYINT NULL,
  source          ENUM('saisie','alias','mots','cv') NOT NULL DEFAULT 'mots',
  libelle_source  VARCHAR(120) NULL,
  PRIMARY KEY (user_id, code_competence),
  KEY ix_coc_comp (code_competence),
  CONSTRAINT fk_coc_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_opt_metiers (
  user_id     BIGINT UNSIGNED NOT NULL,
  code_metier VARCHAR(10) NOT NULL,
  PRIMARY KEY (user_id, code_metier),
  KEY ix_com_metier (code_metier),
  CONSTRAINT fk_com_user FOREIGN KEY (user_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opt_competence_alias (
  alias           VARCHAR(120) PRIMARY KEY,
  code_competence VARCHAR(12) NOT NULL,
  KEY ix_oca_comp (code_competence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================================================================== AVP
-- Une offre peut venir de l'application ou de l'OPT-NC (source 'opt'). Les
-- champs de l'AVP qui servent au filtre et au score sont a plat ; la fiche
-- JobPosting complete est conservee dans json_data.

-- @alter jobs source
ALTER TABLE jobs ADD COLUMN source ENUM('app','opt') NOT NULL DEFAULT 'app';
-- @alter jobs external_id
ALTER TABLE jobs ADD COLUMN external_id VARCHAR(40) NULL, ADD UNIQUE KEY uq_jobs_ext (source, external_id);
-- @alter jobs code_metier
ALTER TABLE jobs ADD COLUMN code_metier VARCHAR(10) NULL, ADD KEY ix_jobs_cm (code_metier);
-- @alter jobs code_rome
ALTER TABLE jobs ADD COLUMN code_rome VARCHAR(6) NULL;
-- @alter jobs ville
ALTER TABLE jobs ADD COLUMN ville VARCHAR(60) NULL;
-- @alter jobs province
ALTER TABLE jobs ADD COLUMN province VARCHAR(40) NULL;
-- @alter jobs direction
ALTER TABLE jobs ADD COLUMN direction VARCHAR(120) NULL;
-- @alter jobs familles
ALTER TABLE jobs ADD COLUMN familles JSON NULL;
-- @alter jobs employment_type
ALTER TABLE jobs ADD COLUMN employment_type VARCHAR(20) NULL;
-- @alter jobs nb_agents_encadres
ALTER TABLE jobs ADD COLUMN nb_agents_encadres SMALLINT UNSIGNED NULL;
-- @alter jobs json_data
ALTER TABLE jobs ADD COLUMN json_data JSON NULL;
-- @alter jobs url
ALTER TABLE jobs ADD COLUMN url VARCHAR(255) NULL;
-- @alter jobs contact_email
ALTER TABLE jobs ADD COLUMN contact_email VARCHAR(190) NULL;
-- @alter jobs synced_at
ALTER TABLE jobs ADD COLUMN synced_at DATETIME NULL;
-- @alter jobs texte_recherche
ALTER TABLE jobs ADD COLUMN texte_recherche TEXT NULL, ADD FULLTEXT KEY ft_jobs (titre, texte_recherche);
-- @alter jobs competences_texte
ALTER TABLE jobs ADD COLUMN competences_texte JSON NULL;

-- Une vue : qui a ouvert quelle offre, d'ou. Le tableau de bord en vit.
CREATE TABLE IF NOT EXISTS job_views (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_id     BIGINT UNSIGNED NOT NULL,
  viewer_id  BIGINT UNSIGNED NULL,
  source     ENUM('deck','detail','recherche','lien') NOT NULL DEFAULT 'deck',
  created_at DATETIME NOT NULL,
  ip_hash    CHAR(32) NULL,
  KEY ix_jv_job (job_id, created_at),
  KEY ix_jv_viewer (viewer_id, job_id),
  CONSTRAINT fk_jv_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================ candidatures
-- Le « oui » d'un candidat est une candidature. Le recruteur la traite ; sa
-- preselection ouvre le match (contact + dossier), la suite est un statut.

CREATE TABLE IF NOT EXISTS applications (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_id        BIGINT UNSIGNED NOT NULL,
  candidate_id  BIGINT UNSIGNED NOT NULL,
  statut        ENUM('envoyee','vue','preselection','entretien','acceptee','refusee','retiree') NOT NULL DEFAULT 'envoyee',
  match_id      BIGINT UNSIGNED NULL,
  resume_id     BIGINT UNSIGNED NULL,
  message       TEXT NULL,
  qualite       TINYINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  vue_at        DATETIME NULL,
  decided_at    DATETIME NULL,
  decided_by    BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_app (job_id, candidate_id),
  KEY ix_app_cand (candidate_id, statut),
  KEY ix_app_job (job_id, statut, created_at),
  CONSTRAINT fk_app_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_cand FOREIGN KEY (candidate_id) REFERENCES candidates(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS application_events (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  acteur_id      BIGINT UNSIGNED NULL,
  type           VARCHAR(30) NOT NULL,
  payload        JSON NULL,
  created_at     DATETIME NOT NULL,
  KEY ix_ae_app (application_id, id),
  CONSTRAINT fk_ae_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Le fichier du CV, chiffre au repos (AES-256-GCM, cle hors base). storage_key
-- est un nom aleatoire dans un dossier hors docroot, jamais servi en direct.
-- @alter resumes enc_iv
ALTER TABLE resumes ADD COLUMN enc_iv CHAR(32) NULL;
-- @alter resumes enc_tag
ALTER TABLE resumes ADD COLUMN enc_tag CHAR(32) NULL;

-- ================================================================== agenda

CREATE TABLE IF NOT EXISTS entretiens (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  job_id         BIGINT UNSIGNED NOT NULL,
  candidate_id   BIGINT UNSIGNED NOT NULL,
  propose_par    BIGINT UNSIGNED NOT NULL,
  debut_utc      DATETIME NOT NULL,
  duree_min      SMALLINT UNSIGNED NOT NULL DEFAULT 45,
  mode           ENUM('sur place','visio','telephone') NOT NULL DEFAULT 'sur place',
  lieu           VARCHAR(190) NULL,
  notes          TEXT NULL,
  statut         ENUM('propose','confirme','refuse','annule','termine') NOT NULL DEFAULT 'propose',
  uid_ics        CHAR(36) NOT NULL,
  created_at     DATETIME NOT NULL,
  updated_at     DATETIME NOT NULL,
  KEY ix_ent_app (application_id, debut_utc),
  KEY ix_ent_cand (candidate_id, debut_utc),
  KEY ix_ent_job (job_id, debut_utc),
  CONSTRAINT fk_ent_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================================== e-mails
-- Rien ne part : les messages sont mis en file avec leur contenu, pour qu'un
-- expediteur (Brevo, SMTP) puisse les prendre plus tard sans rien reecrire.

CREATE TABLE IF NOT EXISTS email_queue (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  destinataire VARCHAR(190) NOT NULL,
  sujet       VARCHAR(190) NOT NULL,
  corps       TEXT NOT NULL,
  piece_type  VARCHAR(30) NULL,
  piece_id    BIGINT UNSIGNED NULL,
  statut      ENUM('attente','envoye','abandonne') NOT NULL DEFAULT 'attente',
  created_at  DATETIME NOT NULL,
  sent_at     DATETIME NULL,
  KEY ix_eq_statut (statut, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

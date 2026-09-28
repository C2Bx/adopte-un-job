-- Passerelle d'echange de fichiers : un dossier FTPS par partenaire, un
-- veilleur qui valide ce qui entre et ecrit ce qui sort.
--
-- Les droits vivent en base et non dans le systeme de fichiers : couper
-- l'acces d'un partenaire doit etre une ligne a modifier, pas un compte a
-- retrouver. Et le journal doit dire qui a lu quoi, puisqu'il s'agit de
-- donnees personnelles.

CREATE TABLE IF NOT EXISTS echange_partenaires (
  id          SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(40) NOT NULL,          -- = nom du dossier, = login FTPS
  libelle     VARCHAR(120) NOT NULL,
  actif       TINYINT NOT NULL DEFAULT 1,
  lit_profils TINYINT NOT NULL DEFAULT 0,    -- ecrit les JSON Resume dans sortant/
  lit_cv_pdf  TINYINT NOT NULL DEFAULT 0,    -- ecrit les CV generes dans sortant/
  depose_profils TINYINT NOT NULL DEFAULT 0, -- a le droit de deposer dans entrant/
  created_at  DATETIME NOT NULL,
  UNIQUE KEY uq_echange_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS echange_journal (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  partenaire   VARCHAR(40) NOT NULL,
  sens         ENUM('sortant','entrant') NOT NULL,
  fichier      VARCHAR(190) NOT NULL,
  verdict      ENUM('ecrit','inchange','accepte','refuse','erreur') NOT NULL,
  detail       VARCHAR(500) NULL,
  user_id      BIGINT UNSIGNED NULL,         -- la personne concernee, si connue
  octets       INT UNSIGNED NULL,
  created_at   DATETIME NOT NULL,
  KEY ix_ech_part (partenaire, created_at),
  KEY ix_ech_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO echange_partenaires
  (code, libelle, actif, lit_profils, lit_cv_pdf, depose_profils, created_at) VALUES
  ('florian',        'MS1 — CV Extractor (Word vers JSON Resume)', 1, 1, 0, 1, UTC_TIMESTAMP()),
  ('anthony-kim',    'MS4 — CV Generator',                         1, 1, 1, 0, UTC_TIMESTAMP()),
  ('jo-michel',      'MS5 — Matching',                             1, 1, 0, 0, UTC_TIMESTAMP()),
  ('elodie-mathieu', 'MS7 — BI et pilotage',                       1, 1, 0, 0, UTC_TIMESTAMP());

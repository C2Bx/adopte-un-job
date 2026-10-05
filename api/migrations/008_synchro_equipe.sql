-- Synchronisation avec l'API de l'equipe (MS2 HACKAVPays), 05/10/2026.
--
-- Depuis le 05/10, leur API porte le cycle de candidature : le candidat depose
-- son profil (PUT /profils/moi), un like sur un AVP cree une candidature
-- EN_ATTENTE, un recruteur (AVPRO-NC) la passe en VALIDEE ou REJETEE.
-- Adopte un Job reste le cote candidat : il leur envoie le profil et les
-- swipes, et affiche la decision du recruteur. Il ne decide de rien.
--
-- Le minimum stocke ici :
--   - leur jeton JWT (1 h), CHIFFRE et rattache a la session : leurs routes
--     candidat l'exigent. Il disparait avec la session.
--   - la date du dernier envoi du profil et de chaque candidature, pour
--     rattraper ce qui n'a pas pu partir (jeton expire, API arretee).
--   - le dernier statut lu chez eux, pour l'afficher quand leur API ne repond pas.
-- Aucune copie de leurs donnees au-dela.

-- @alter sessions equipe_jeton
ALTER TABLE sessions ADD COLUMN equipe_jeton TEXT NULL COMMENT 'JWT de leur API, chiffre AES-256-GCM (base64)';
-- @alter sessions equipe_iv
ALTER TABLE sessions ADD COLUMN equipe_iv CHAR(32) NULL;
-- @alter sessions equipe_tag
ALTER TABLE sessions ADD COLUMN equipe_tag CHAR(32) NULL;
-- @alter sessions equipe_expire
ALTER TABLE sessions ADD COLUMN equipe_expire DATETIME NULL COMMENT 'UTC, une minute avant leur expiration';

-- @alter candidates equipe_profil_le
ALTER TABLE candidates ADD COLUMN equipe_profil_le DATETIME NULL COMMENT 'dernier PUT /profils/moi reussi (UTC)';

-- @alter applications equipe_envoi_le
ALTER TABLE applications ADD COLUMN equipe_envoi_le DATETIME NULL COMMENT 'dernier swipe envoye chez eux (UTC)';
-- @alter applications equipe_statut
ALTER TABLE applications ADD COLUMN equipe_statut VARCHAR(12) NULL COMMENT 'EN_ATTENTE, VALIDEE, REJETEE, ANNULEE : dernier lu chez eux';
-- @alter applications equipe_statut_le
ALTER TABLE applications ADD COLUMN equipe_statut_le DATETIME NULL;

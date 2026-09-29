-- Les comptes sont chez l'equipe : la base ne garde que ce qui la regarde.
--
-- Depuis le 29/09, `auth/inscription` et `auth/connexion` relaient vers leur
-- API. Notre table `users` n'a plus a porter de secret, seulement le lien
-- entre une personne et ce qu'elle a fait ici.
--
-- CE QUI PART
--   users.pass_hash     plus jamais ecrit ni lu : 40 lignes vides sur 41.
--   password_resets     le parcours « mot de passe oublie » local n'existe
--                       plus (0 ligne).
--
-- CE QUI ARRIVE
--   users.equipe_user_id  l'identifiant que LEUR API rend a l'inscription.
--                       Aujourd'hui le seul lien entre les deux cotes est
--                       l'adresse e-mail — or ils ouvriront un jour le
--                       changement d'adresse, et le lien casserait. Il reste
--                       NULL pour les comptes anterieurs : leur API n'expose
--                       pas de quoi le retrouver (il faudrait un /users/me,
--                       qui fait partie des routes demandees).
--
-- CE QUI RESTE, malgre les apparences
--   users.role          elle ne vaut plus que « candidat », mais c'est elle
--                       qui garde `admin/sync/avp` et `admin/passerelle`
--                       (role === 'admin'). La supprimer, c'est supprimer le
--                       controle, pas une colonne inutile.
--   users.status        actif / anonymise : l'anonymisation s'en sert.

ALTER TABLE users ADD COLUMN equipe_user_id BIGINT UNSIGNED NULL AFTER email;

-- Le cote employeur n'existe plus : une ligne restee en « recruteur » ne
-- pourrait que se heurter a des 403.
UPDATE users SET role = 'candidat' WHERE role = 'recruteur';

ALTER TABLE users DROP COLUMN pass_hash;

DROP TABLE IF EXISTS password_resets;

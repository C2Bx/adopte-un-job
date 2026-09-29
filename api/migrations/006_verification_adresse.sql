-- La verification d'adresse n'existe plus : elle appartient au service de
-- comptes de l'equipe, qui ne l'expose pas (encore).
--
-- Les deux colonnes sont sans lecture ni ecriture depuis le 29/09 : le code
-- qui les remplissait partait avec les routes `auth/verification` et
-- `auth/verification/renvoi`, et `auth/moi` n'annonce plus `emailVerifie`.
--
-- Si leur API ouvre un jour la verification, c'est CHEZ EUX que l'etat vivra :
-- rien a remettre ici.

ALTER TABLE users DROP COLUMN verify_hash;
ALTER TABLE users DROP COLUMN email_verified_at;

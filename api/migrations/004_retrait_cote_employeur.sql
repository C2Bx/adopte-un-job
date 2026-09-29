-- Retrait du cote employeur : les tables qui ne portent plus rien.
--
-- Le 29/09, l'application est devenue celle du candidat seul. Six tables
-- n'ont plus ni ecriture ni lecture :
--
--   messages          la conversation qui s'ouvrait a la preselection
--   appointments      un premier jet d'agenda, jamais utilise (0 ligne)
--   entretiens        les creneaux proposes par l'employeur
--   matches           le double oui
--   company_members   l'appartenance d'un compte a une organisation
--   echange_partenaires  les quatre dossiers d'echange, remplaces par un seul
--
-- NE SONT PAS SUPPRIMEES, malgre les apparences :
--   companies         elle porte l'employeur de chaque AVP (« OPT-NC »),
--                     jointe sur toutes les offres rendues. Sans elle, plus de
--                     nom d'organisation sur une carte.
--   occupations       le referentiel metier maison, lu par le profil
--   occupation_links  la proximite entre metiers, dont le score se sert pour
--                     les passerelles et les reconversions.
--
-- L'ordre suit les cles etrangeres : `messages` et `appointments` pointent sur
-- `matches`, `entretiens` sur `applications`. Aucune table CONSERVEE ne pointe
-- sur une table supprimee — `applications.match_id` est une simple colonne
-- nullable, sans contrainte, qu'on remet a NULL puisque plus rien ne la resout.

UPDATE applications SET match_id = NULL WHERE match_id IS NOT NULL;

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS entretiens;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS company_members;
DROP TABLE IF EXISTS echange_partenaires;

-- Les contraintes que le candidat refuse.
--
-- Neuvieme question du questionnaire guide, et seule des neuf qui n'avait pas
-- de champ : le formulaire pas a pas ne l'a jamais demandee.
--
-- Liste fermee et courte : une colonne SET suffit, comme les ENUM voisins
-- `teletravail` et `ouverture`. Les valeurs multiples ouvertes (zones,
-- contrats) ont leur table, celles-ci n'en ont pas besoin.
--
-- Le score s'en sert en ECART, jamais en elimination : cette application
-- n'escamote aucune offre, elle dit ce qui ne colle pas et pourquoi.

ALTER TABLE candidates
  ADD COLUMN refus SET('nuit','weekend','deplacements','coupures','astreinte')
      NOT NULL DEFAULT '' AFTER permis;

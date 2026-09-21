-- Migration 002 (2026-09-21) — le detail du score au moment de la candidature.
-- Les scores en cache (match_scores) sont effaces a chaque synchronisation des
-- AVP et a chaque modification de profil : le tableau de bord, qui parle des
-- candidatures recues, doit lire une photographie prise au moment du geste.
-- Additive et rejouable (cf. 001).

SET NAMES utf8mb4;

-- @alter applications detail
ALTER TABLE applications ADD COLUMN detail JSON NULL AFTER qualite;

-- ============================================================
-- Migration : ajout du rôle president-etablissement
-- Date : 2026-05-26
-- ============================================================

-- Suppression de l'ancienne contrainte CHECK sur le rôle
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Recréation avec le nouveau rôle
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super-admin',
    'admin',
    'agent-saisie',
    'validateur',
    'observateur',
    'president-bureau',
    'president-etablissement'
  ));

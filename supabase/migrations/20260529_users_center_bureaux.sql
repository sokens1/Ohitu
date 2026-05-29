-- Add assigned_center_bureaux column to store bureau assignments for president-etablissement
-- Structure : { "center_uuid": ["bureau_uuid1", "bureau_uuid2"] }
-- Tableau vide pour un centre = tous les bureaux de ce centre
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_center_bureaux JSONB DEFAULT '{}'::jsonb;

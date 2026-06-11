-- Migration : ajout du champ is_second_tour sur procès_verbaux
-- À exécuter dans l'éditeur SQL Supabase

ALTER TABLE "procès_verbaux"
  ADD COLUMN IF NOT EXISTS is_second_tour BOOLEAN NOT NULL DEFAULT false;

-- Index pour filtrer rapidement les bureaux second tour par élection
CREATE INDEX IF NOT EXISTS idx_pv_second_tour
  ON "procès_verbaux" (election_id, is_second_tour)
  WHERE is_second_tour = true;

ANALYZE "procès_verbaux";

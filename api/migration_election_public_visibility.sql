-- ============================================================================
-- Visibilité publique des élections (masquage persistant côté login / accueil)
-- À exécuter dans Supabase → SQL Editor
-- ============================================================================

-- 1. Colonne dédiée (indépendante de is_published)
ALTER TABLE elections
  ADD COLUMN IF NOT EXISTS is_public_visible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN elections.is_public_visible IS
  'FALSE = élection masquée sur les pages publiques (login, accueil, sélecteur), sans retirer la publication des PV.';

-- 2. Autoriser le statut « Annulée » (désactivation administrative)
ALTER TABLE elections DROP CONSTRAINT IF EXISTS elections_status_check;
ALTER TABLE elections ADD CONSTRAINT elections_status_check
  CHECK (status IN ('À venir', 'En cours', 'Terminée', 'Annulée'));

-- 3. Synchroniser les élections déjà « désactivées » via is_published uniquement
UPDATE elections
SET
  is_public_visible = FALSE,
  status = 'Annulée'
WHERE is_published = FALSE
  AND status IS DISTINCT FROM 'Annulée';

-- 4. Index pour les listes publiques
CREATE INDEX IF NOT EXISTS idx_elections_public_visible
  ON elections (is_public_visible)
  WHERE is_public_visible = TRUE;

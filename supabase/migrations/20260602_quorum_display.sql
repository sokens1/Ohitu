-- ============================================================
-- Migration : affichage public des PV sans quorum
-- Permet à l'admin de contrôler si les lignes rouges (quorum non atteint)
-- sont visibles sur la page publique des résultats.
-- Date : 2026-06-02
-- ============================================================

ALTER TABLE elections
  ADD COLUMN IF NOT EXISTS show_quorum_failed_public BOOLEAN NOT NULL DEFAULT TRUE;

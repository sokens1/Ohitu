-- ============================================================
-- Migration : avis d'observateurs multiples + centres validateur
-- Date : 2026-05-26
-- ============================================================

-- 1. Table des avis observateurs (multi-observateurs par PV)
CREATE TABLE IF NOT EXISTS pv_observer_opinions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id             UUID NOT NULL REFERENCES procès_verbaux(id) ON DELETE CASCADE,
  observer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  annotation        TEXT,
  conformity        TEXT CHECK (conformity IN ('conforme', 'non_conforme')),
  annotated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pv_id, observer_id)    -- un seul avis par observateur et par PV
);

CREATE INDEX IF NOT EXISTS idx_pvo_pv_id ON pv_observer_opinions(pv_id);
CREATE INDEX IF NOT EXISTS idx_pvo_observer_id ON pv_observer_opinions(observer_id);

-- RLS : les observateurs peuvent lire tous les avis de leurs élections
-- et insérer/mettre à jour uniquement leur propre avis
ALTER TABLE pv_observer_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "observers can manage own opinion"
  ON pv_observer_opinions FOR ALL
  USING (observer_id = auth.uid())
  WITH CHECK (observer_id = auth.uid());

CREATE POLICY "validators and admins can read opinions"
  ON pv_observer_opinions FOR SELECT
  USING (true);


-- 2. Centres assignés au validateur (dans son élection)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_center_ids UUID[] DEFAULT '{}';


-- 3. Colonne pour le commentaire de rejet (renvoi en saisie)
ALTER TABLE procès_verbaux
  ADD COLUMN IF NOT EXISTS rejection_comment TEXT;

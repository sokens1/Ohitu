-- =============================================================================
-- O'HITU — Migration correctifs élections professionnelles
-- À exécuter dans Supabase → SQL Editor
-- =============================================================================

-- 1. Colonne election_id sur voting_bureaux
--    Permet de filtrer les bureaux par élection (nécessaire pour les élections pro)
ALTER TABLE voting_bureaux
  ADD COLUMN IF NOT EXISTS election_id UUID REFERENCES elections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_voting_bureaux_election_id
  ON voting_bureaux(election_id);

-- 2. Collège du bureau (pour les élections professionnelles multi-collèges)
ALTER TABLE voting_bureaux
  ADD COLUMN IF NOT EXISTS college_type VARCHAR(20)
    CHECK (college_type IN ('cadres','employes','ouvriers','general'));

-- 3. Collège sur les PV (pour agréger les résultats par collège)
ALTER TABLE procès_verbaux
  ADD COLUMN IF NOT EXISTS college_type VARCHAR(20)
    CHECK (college_type IN ('cadres','employes','ouvriers','general'));

-- 4. Champ anomalies textuelles sur les PV
ALTER TABLE procès_verbaux
  ADD COLUMN IF NOT EXISTS anomalies TEXT;

-- 5. Sièges alloués par liste syndicale dans candidate_results
ALTER TABLE candidate_results
  ADD COLUMN IF NOT EXISTS seats_allocated INTEGER DEFAULT 0;

-- 6. Index utiles
CREATE INDEX IF NOT EXISTS idx_pv_college_type
  ON procès_verbaux(college_type);

CREATE INDEX IF NOT EXISTS idx_pv_election_bureau
  ON procès_verbaux(election_id, bureau_id);

-- =============================================================================
-- Vérification
-- =============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name IN ('voting_bureaux','procès_verbaux','candidate_results')
-- AND column_name IN ('election_id','college_type','anomalies','seats_allocated')
-- ORDER BY table_name, column_name;

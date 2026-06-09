-- Migration : indexes de performance pour réduire la charge CPU/RAM/IO
-- À exécuter dans Supabase SQL Editor

-- procès_verbaux : jointures fréquentes sur election_id, bureau_id, status
CREATE INDEX IF NOT EXISTS idx_pv_election_id      ON "procès_verbaux"(election_id);
CREATE INDEX IF NOT EXISTS idx_pv_bureau_id        ON "procès_verbaux"(bureau_id);
CREATE INDEX IF NOT EXISTS idx_pv_status           ON "procès_verbaux"(status);
CREATE INDEX IF NOT EXISTS idx_pv_election_status  ON "procès_verbaux"(election_id, status);

-- candidate_results : jointure fréquente sur pv_id
CREATE INDEX IF NOT EXISTS idx_cr_pv_id            ON candidate_results(pv_id);
CREATE INDEX IF NOT EXISTS idx_cr_candidate_id     ON candidate_results(candidate_id);

-- voting_bureaux : filtrages fréquents sur center_id et election_id
CREATE INDEX IF NOT EXISTS idx_vb_center_id        ON voting_bureaux(center_id);
CREATE INDEX IF NOT EXISTS idx_vb_election_id      ON voting_bureaux(election_id);
CREATE INDEX IF NOT EXISTS idx_vb_center_election  ON voting_bureaux(center_id, election_id);

-- election_centers : clé de jointure principale
CREATE INDEX IF NOT EXISTS idx_ec_election_id      ON election_centers(election_id);
CREATE INDEX IF NOT EXISTS idx_ec_center_id        ON election_centers(center_id);

-- electoral_colleges : filtrage sur election_id pour élections pro
CREATE INDEX IF NOT EXISTS idx_ecol_election_id    ON electoral_colleges(election_id);

-- union_lists : filtrage sur election_id pour élections pro
CREATE INDEX IF NOT EXISTS idx_ul_election_id      ON union_lists(election_id);

-- elections : recherche par slug (déjà créé mais au cas où)
CREATE UNIQUE INDEX IF NOT EXISTS idx_elections_slug ON elections(slug);

-- candidates : jointure depuis candidate_results
CREATE INDEX IF NOT EXISTS idx_candidates_id       ON candidates(id);

-- Analyse des tables pour mettre à jour les statistiques du planificateur
ANALYZE "procès_verbaux";
ANALYZE candidate_results;
ANALYZE voting_bureaux;
ANALYZE election_centers;
ANALYZE electoral_colleges;
ANALYZE union_lists;
ANALYZE elections;

-- =============================================================================
-- O'HITU — Migration : isoler les bureaux de vote par élection
-- Problème : la contrainte unique (center_id, name) sur voting_bureaux empêche
--            d'importer le même fichier Excel dans deux élections différentes.
-- Solution : remplacer par (election_id, center_id, name) pour que chaque
--            élection ait ses propres bureaux indépendants.
-- À exécuter dans Supabase → SQL Editor
-- =============================================================================

-- 1. Supprimer toutes les contraintes UNIQUE existantes sur voting_bureaux
--    qui portent sur (center_id, name) sans election_id
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'voting_bureaux'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.constraint_name NOT LIKE '%election%'
  LOOP
    EXECUTE 'ALTER TABLE voting_bureaux DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    RAISE NOTICE 'Contrainte supprimée : %', r.constraint_name;
  END LOOP;
END $$;

-- Supprimer aussi les index UNIQUE existants hors election_id
DROP INDEX IF EXISTS voting_bureaux_center_id_name_key;
DROP INDEX IF EXISTS voting_bureaux_center_id_name_idx;

-- 2. Créer la nouvelle contrainte incluant election_id
--    Permet au même centre d'avoir les mêmes bureaux dans des élections différentes
CREATE UNIQUE INDEX IF NOT EXISTS voting_bureaux_election_center_name_unique
  ON voting_bureaux(election_id, center_id, name)
  WHERE election_id IS NOT NULL;

-- 3. Vérification
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'voting_bureaux' AND indexdef LIKE '%UNIQUE%';

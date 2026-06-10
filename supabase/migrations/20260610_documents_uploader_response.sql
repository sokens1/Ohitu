-- ============================================================
-- Migration : commentaire du déposant + réponse à un avis admin
-- Date : 2026-06-10
-- ============================================================

-- 1. Nouvelle colonne : commentaire libre du déposant (président de bureau,
--    suppléant, président d'établissement) — optionnel, éditable à tout moment.
--    Sert à la fois de commentaire à la soumission ET de réponse à un avis admin
--    (review_comment) sur le PV ou la liste de participation.
ALTER TABLE establishment_documents
  ADD COLUMN IF NOT EXISTS uploader_comment TEXT;

-- 2. Étendre la lecture des documents aux présidents de bureau et suppléants
--    (même périmètre que président d'établissement : assigned_center_bureaux)
DROP POLICY IF EXISTS "presidents read assigned documents" ON establishment_documents;
CREATE POLICY "presidents read assigned documents"
  ON establishment_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('president-etablissement', 'president-bureau', 'suppleant-president')
        AND u.assigned_election_ids IS NOT NULL
        AND establishment_documents.election_id = ANY(u.assigned_election_ids)
        AND (
          u.assigned_center_bureaux IS NULL
          OR u.assigned_center_bureaux = '{}'::jsonb
          OR establishment_documents.center_id::text IN (
            SELECT jsonb_object_keys(u.assigned_center_bureaux)
          )
        )
    )
  );

-- 3. Permettre au déposant de mettre à jour son propre commentaire
--    (en complément des politiques existantes — les politiques UPDATE sont OR'd)
DROP POLICY IF EXISTS "uploaders can update own document comment" ON establishment_documents;
CREATE POLICY "uploaders can update own document comment"
  ON establishment_documents FOR UPDATE
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

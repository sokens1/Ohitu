-- ============================================================
-- Migration : documents d'établissement (PV + liste de participation)
-- Date : 2026-05-26
-- ============================================================

-- Table principale des documents
CREATE TABLE IF NOT EXISTS establishment_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  center_id       UUID NOT NULL,                       -- établissement (voting_centers.id)
  college_type    TEXT,                                -- NULL = tous les collèges du centre
  document_type   TEXT NOT NULL
    CHECK (document_type IN ('pv', 'participation_list')),
  file_url        TEXT NOT NULL,
  file_name       TEXT,
  file_size       BIGINT,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Avis admin
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validated', 'reserved', 'rejected')),
  review_comment  TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_estdoc_election ON establishment_documents(election_id);
CREATE INDEX IF NOT EXISTS idx_estdoc_center   ON establishment_documents(center_id);
CREATE INDEX IF NOT EXISTS idx_estdoc_uploader ON establishment_documents(uploaded_by);

-- RLS
ALTER TABLE establishment_documents ENABLE ROW LEVEL SECURITY;

-- Président d'établissement : gérer ses propres documents
CREATE POLICY "president can manage own documents"
  ON establishment_documents FOR ALL
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Admin / super-admin / agent-saisie : lire tous les documents
CREATE POLICY "staff can read all documents"
  ON establishment_documents FOR SELECT
  USING (true);

-- Admin / super-admin : mettre à jour le statut (review)
CREATE POLICY "admins can review documents"
  ON establishment_documents FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Bucket de stockage pour les documents d'établissement
-- (à créer manuellement dans la console Supabase si nécessaire)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('establishment-docs', 'establishment-docs', false)
-- ON CONFLICT DO NOTHING;

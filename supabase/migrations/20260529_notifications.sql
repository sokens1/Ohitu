-- ============================================================
-- Migration : système de notifications persistantes
-- Date : 2026-05-29
-- ============================================================

-- Recréation propre (aucune donnée à conserver — la table était vide)
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  type          TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  severity      TEXT        NOT NULL DEFAULT 'info'
                            CHECK (severity IN ('info', 'success', 'warning', 'error')),
  read          BOOLEAN     NOT NULL DEFAULT false,
  election_id   UUID,
  center_id     UUID,
  pv_id         UUID,
  document_id   UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient
  ON notifications(recipient_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE
  USING  (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "users delete own notifications"
  ON notifications FOR DELETE
  USING (recipient_id = auth.uid());

CREATE POLICY "authenticated insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND actor_id = auth.uid());

-- ── Fonction SECURITY DEFINER : trouver les destinataires ────────────────────
CREATE OR REPLACE FUNCTION public.find_notification_recipients(
  p_roles        TEXT[],
  p_election_id  UUID    DEFAULT NULL,
  p_center_id    UUID    DEFAULT NULL,
  p_college_type TEXT    DEFAULT NULL
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT u.id) INTO ids
  FROM users u
  WHERE u.is_active = true
    AND u.role = ANY(p_roles)
    AND u.id <> auth.uid()
    AND (
      u.role IN ('super-admin', 'admin')
      OR (
        p_election_id IS NOT NULL
        AND u.assigned_election_ids IS NOT NULL
        AND p_election_id = ANY(u.assigned_election_ids)
        AND (
          p_center_id IS NULL
          OR (
            u.assigned_center_ids IS NOT NULL
            AND p_center_id = ANY(u.assigned_center_ids)
            AND (
              p_college_type IS NULL
              OR u.assigned_center_colleges IS NULL
              OR u.assigned_center_colleges = '{}'::jsonb
              OR NOT (u.assigned_center_colleges ? p_center_id::text)
              OR jsonb_array_length(u.assigned_center_colleges -> p_center_id::text) = 0
              OR (u.assigned_center_colleges -> p_center_id::text) ? p_college_type
            )
          )
          OR (
            u.assigned_center_bureaux IS NOT NULL
            AND p_center_id::text IN (SELECT jsonb_object_keys(u.assigned_center_bureaux))
          )
        )
      )
    );

  RETURN COALESCE(ids, ARRAY[]::UUID[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_notification_recipients TO authenticated;

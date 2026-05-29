-- Add reactions JSONB column to pv_observer_opinions for admin/super-admin reaction tracking
ALTER TABLE pv_observer_opinions
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

-- Allow admins, super-admins and presidents to update opinion rows (e.g. add reactions)
DROP POLICY IF EXISTS "admins can update opinion reactions" ON pv_observer_opinions;
CREATE POLICY "admins can update opinion reactions"
  ON pv_observer_opinions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('super-admin', 'admin', 'president-etablissement')
    )
  )
  WITH CHECK (true);

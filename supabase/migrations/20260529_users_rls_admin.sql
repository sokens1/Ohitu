-- Allow super-admin and admin to UPDATE any user row via the client.
-- Without this, if RLS is enabled on `users`, UPDATE calls from the frontend
-- are silently blocked (0 rows affected, error = null) → false "success" toast.
-- Safe to run even if RLS is not yet enabled: the policy will take effect
-- automatically once RLS is enabled.

DROP POLICY IF EXISTS "admins can update users" ON users;
CREATE POLICY "admins can update users"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users AS me
      WHERE me.id = auth.uid()
        AND me.role IN ('super-admin', 'admin')
    )
  )
  WITH CHECK (true);

-- Fonction SECURITY DEFINER : lit le rôle du user courant sans déclencher RLS
-- NE PAS mettre SET search_path ici — auth.uid() doit rester accessible
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

-- Autoriser tous les utilisateurs authentifiés à appeler la fonction
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- ─────────────────────────────────────────────────────────────
-- Politiques sur la table users
-- ─────────────────────────────────────────────────────────────

-- Chaque utilisateur lit sa propre ligne
-- (nécessaire pour que les subqueries sur d'autres tables puissent
--  lire les champs assigned_* du user courant sans récursion)
DROP POLICY IF EXISTS "users can read own row" ON users;
CREATE POLICY "users can read own row"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Super-admin / admin : lire tous les utilisateurs
-- get_my_role() évite la récursion infinie (ne relance pas les politiques users)
DROP POLICY IF EXISTS "admins can read all users" ON users;
CREATE POLICY "admins can read all users"
  ON users FOR SELECT
  USING (public.get_my_role() IN ('super-admin', 'admin'));

-- Super-admin / admin : mettre à jour n'importe quel utilisateur
DROP POLICY IF EXISTS "admins can update users" ON users;
CREATE POLICY "admins can update users"
  ON users FOR UPDATE
  USING  (public.get_my_role() IN ('super-admin', 'admin'))
  WITH CHECK (true);

-- Super-admin / admin : insérer (complément au service role de l'API)
DROP POLICY IF EXISTS "admins can insert users" ON users;
CREATE POLICY "admins can insert users"
  ON users FOR INSERT
  WITH CHECK (public.get_my_role() IN ('super-admin', 'admin'));

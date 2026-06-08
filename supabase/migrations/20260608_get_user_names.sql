-- Fonction SECURITY DEFINER : résout les noms d'utilisateurs à partir d'une liste d'IDs.
-- Bypasse le RLS sur `users` (qui limite la lecture à sa propre ligne pour les rôles
-- non-admin) afin que la piste d'audit, l'historique des PV et les avis observateurs
-- affichent le nom des auteurs au lieu de leur UUID brut.
-- N'expose volontairement que id + name (aucune donnée sensible).

CREATE OR REPLACE FUNCTION public.get_user_names(p_ids UUID[])
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT u.id, u.name
  FROM public.users u
  WHERE u.id = ANY(p_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_names(UUID[]) TO authenticated;

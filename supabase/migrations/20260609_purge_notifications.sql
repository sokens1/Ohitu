-- Fonction SECURITY DEFINER : purge les notifications antérieures à une date donnée
-- pour TOUS les utilisateurs. Réservée au super-admin (vérification interne via get_my_role).
-- Retourne le nombre de lignes supprimées.

CREATE OR REPLACE FUNCTION public.purge_notifications_before(p_before TIMESTAMPTZ)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  IF public.get_my_role() <> 'super-admin' THEN
    RAISE EXCEPTION 'Accès refusé : rôle super-admin requis';
  END IF;

  WITH deleted AS (
    DELETE FROM public.notifications
    WHERE created_at < p_before
    RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_notifications_before(TIMESTAMPTZ) TO authenticated;

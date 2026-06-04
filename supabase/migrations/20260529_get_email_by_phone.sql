-- Fonction SECURITY DEFINER : résoudre un email à partir d'un numéro de téléphone.
-- Bypasse le RLS (nécessaire car l'utilisateur n'est pas encore authentifié au login).
-- Normalise les deux côtés (supprime tirets, espaces, +) avant comparaison.

CREATE OR REPLACE FUNCTION public.get_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_normalized TEXT;
BEGIN
  -- Normaliser : garder uniquement les chiffres
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  SELECT email INTO v_email
  FROM public.users
  WHERE regexp_replace(phone, '[^0-9]', '', 'g') = v_normalized
    AND is_active = true
  LIMIT 1;

  RETURN v_normalized;  -- return placeholder replaced below
END;
$$;

-- Recréer avec le bon return
DROP FUNCTION IF EXISTS public.get_email_by_phone(TEXT);

CREATE OR REPLACE FUNCTION public.get_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email      TEXT;
  v_normalized TEXT;
BEGIN
  -- Normaliser : garder uniquement les chiffres
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  SELECT email INTO v_email
  FROM public.users
  WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_normalized
    AND is_active = true
  LIMIT 1;

  RETURN v_email;  -- NULL si non trouvé
END;
$$;

-- Accessible aux utilisateurs non authentifiés (clé anon)
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(TEXT) TO authenticated;

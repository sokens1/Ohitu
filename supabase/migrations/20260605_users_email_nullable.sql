-- Permettre email NULL dans la table users
-- Un utilisateur peut être créé avec uniquement un numéro de téléphone

ALTER TABLE public.users
  ALTER COLUMN email DROP NOT NULL;

-- Mettre à jour la fonction get_email_by_phone pour retourner l'email Auth interne
-- si l'email réel est NULL (cas d'un compte créé par téléphone uniquement)
CREATE OR REPLACE FUNCTION public.get_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_normalized TEXT;
  v_user_email TEXT;
  v_auth_email TEXT;
  v_user_id   UUID;
BEGIN
  -- Normalisation : on garde uniquement les chiffres
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Chercher l'utilisateur par téléphone (en normalisant aussi la colonne)
  SELECT id, email
  INTO v_user_id, v_user_email
  FROM public.users
  WHERE regexp_replace(phone, '[^0-9]', '', 'g') = v_normalized
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Si l'email réel existe, le retourner directement
  IF v_user_email IS NOT NULL AND v_user_email != '' THEN
    RETURN v_user_email;
  END IF;

  -- Sinon, récupérer l'email Auth (email interne généré au format phone@phone.ohitu.internal)
  SELECT email INTO v_auth_email
  FROM auth.users
  WHERE id = v_user_id
  LIMIT 1;

  RETURN v_auth_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_phone(TEXT) TO anon, authenticated;

-- ============================================================
-- Migration : colonne slug sur la table elections
-- Remplace l'UUID dans les URLs publiques par un identifiant lisible
-- Date : 2026-05-29
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Ajouter la colonne slug (nullable pour l'instant)
ALTER TABLE elections ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Fonction interne de génération de slug
CREATE OR REPLACE FUNCTION public.generate_election_slug(p_title TEXT, p_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter   INT := 0;
BEGIN
  -- Normaliser : minuscules, sans accents, sans caractères spéciaux, espaces → tirets
  base_slug := lower(
    regexp_replace(
      regexp_replace(unaccent(p_title), '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
  -- Supprimer les tirets multiples et de début/fin
  base_slug := trim(both '-' from regexp_replace(base_slug, '-+', '-', 'g'));

  final_slug := base_slug;

  -- Garantir l'unicité
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM elections WHERE slug = final_slug AND id <> p_id
    );
    counter    := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- 3. Peupler les slugs pour les élections existantes
UPDATE elections
SET slug = public.generate_election_slug(title, id)
WHERE slug IS NULL OR slug = '';

-- 4. Rendre la colonne obligatoire et unique
ALTER TABLE elections ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_elections_slug ON elections(slug);

-- 5. Trigger pour auto-générer le slug à l'insertion (si non fourni)
CREATE OR REPLACE FUNCTION public.elections_set_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_election_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_elections_set_slug ON elections;
CREATE TRIGGER trg_elections_set_slug
  BEFORE INSERT ON elections
  FOR EACH ROW EXECUTE FUNCTION public.elections_set_slug();

-- Migration : ajouter la colonne order_num à union_lists avec défaut à 1
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE union_lists
  ADD COLUMN IF NOT EXISTS order_num INTEGER DEFAULT 1;

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'union_lists' AND column_name = 'order_num';

-- ============================================================================
-- O'HITU v2 — Migration: Élections Professionnelles (Délégués du Personnel)
-- À exécuter dans Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Table des entreprises / établissements
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector TEXT CHECK (sector IN ('public', 'parapublic', 'prive')) DEFAULT 'prive',
  administrative_unit TEXT, -- Ministère de rattachement
  total_employees INTEGER DEFAULT 0,
  employees_by_category JSONB DEFAULT '{"cadres": 0, "employes": 0, "ouvriers": 0}'::jsonb,
  hr_contact JSONB DEFAULT '{"name": "", "phone": "", "email": ""}'::jsonb,
  province_id UUID REFERENCES provinces(id) ON DELETE SET NULL,
  commune_id UUID REFERENCES communes(id) ON DELETE SET NULL,
  province_name TEXT,
  commune_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Table des syndicats
-- ============================================================================
CREATE TABLE IF NOT EXISTS unions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  acronym TEXT,
  registration_number TEXT, -- N° récépissé
  registration_date DATE,
  federation TEXT,
  confederation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Table des listes syndicales par élection
-- ============================================================================
CREATE TABLE IF NOT EXISTS union_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
  union_id UUID REFERENCES unions(id) ON DELETE CASCADE,
  college TEXT DEFAULT 'general' CHECK (college IN ('cadres', 'employes', 'ouvriers', 'general')),
  is_independent BOOLEAN DEFAULT FALSE, -- Liste libre (2nd tour si carence)
  cnep_status TEXT DEFAULT 'pending' CHECK (cnep_status IN ('pending', 'accepted', 'mise_en_demeure', 'rejected', 'ras')),
  cnep_observation TEXT,
  titulaires JSONB DEFAULT '[]'::jsonb, -- [{name, position, order}]
  suppleants JSONB DEFAULT '[]'::jsonb, -- [{name, position, order}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. Table des collèges électoraux
-- ============================================================================
CREATE TABLE IF NOT EXISTS electoral_colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'Cadres', 'Employés', 'Ouvriers', 'Collège unique'
  college_type TEXT DEFAULT 'general' CHECK (college_type IN ('cadres', 'employes', 'ouvriers', 'general')),
  total_voters INTEGER DEFAULT 0,
  seats_to_fill INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. Ajout de colonnes à la table elections existante
-- ============================================================================
ALTER TABLE elections ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS has_second_round BOOLEAN DEFAULT FALSE;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS second_round_date DATE;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS participation_rate NUMERIC(5,2);
ALTER TABLE elections ADD COLUMN IF NOT EXISTS list_display_date DATE;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS campaign_start DATE;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS campaign_end DATE;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS legal_framework TEXT DEFAULT 'LOI-022-2021';
ALTER TABLE elections ADD COLUMN IF NOT EXISTS carence BOOLEAN DEFAULT FALSE;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS recours_period_start DATE;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS recours_period_end DATE;

-- Ajout du lien entreprise pour les sites/établissements
-- -----------------------------------------------------------------------------
-- CONFIGURATION DU STORAGE POUR LES PHOTOS (AVATARS)
-- -----------------------------------------------------------------------------

-- 1. Créer le bucket 'avatars' s'il n'existe pas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Supprimer les anciennes politiques si elles existent pour éviter les doublons
DROP POLICY IF EXISTS "Avatar Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update Access" ON storage.objects;

-- 3. Autoriser l'accès public en lecture
CREATE POLICY "Avatar Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 4. Autoriser l'insertion (upload) anonyme pour le développement
CREATE POLICY "Avatar Upload Access" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars');

-- 5. Autoriser la mise à jour (upsert)
CREATE POLICY "Avatar Update Access" ON storage.objects
FOR UPDATE WITH CHECK (bucket_id = 'avatars');

-- **Hiérarchie des Cartes** :
--     - Pour les élections pro, la **Tête de liste** est désormais mise en avant (Photo principale et Nom).
--     - Le **Syndicat** et le **Suppléant** sont affichés en tant qu'informations secondaires.
-- - **Corrections de Bugs & Filtrage** :
--     - Correction d'un bug `TypeError` sur le sélecteur de syndicat.
--     - Renforcement du filtrage : les données politiques (centres publics, candidats nationaux) sont désormais **totalement exclues** de la vue professionnelle, et inversement.

-- Mise à jour de la contrainte type pour accepter "Élection Professionnelle"
ALTER TABLE elections DROP CONSTRAINT IF EXISTS elections_type_check;
ALTER TABLE elections ADD CONSTRAINT elections_type_check CHECK (type IN ('Législatives', 'Locales', 'Élection Professionnelle', 'Présidentielle', 'Sénatoriales', 'Référendum'));

-- ============================================================================
-- 6. RLS Policies (Row Level Security) — Permettre accès aux nouvelles tables
-- ============================================================================

-- Enterprises
ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on enterprises" ON enterprises FOR ALL USING (true) WITH CHECK (true);

-- Unions
ALTER TABLE unions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on unions" ON unions FOR ALL USING (true) WITH CHECK (true);

-- Union lists
ALTER TABLE union_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on union_lists" ON union_lists FOR ALL USING (true) WITH CHECK (true);

-- Electoral colleges
ALTER TABLE electoral_colleges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on electoral_colleges" ON electoral_colleges FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. Index pour performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_union_lists_election_id ON union_lists(election_id);
CREATE INDEX IF NOT EXISTS idx_union_lists_union_id ON union_lists(union_id);
CREATE INDEX IF NOT EXISTS idx_electoral_colleges_election_id ON electoral_colleges(election_id);
CREATE INDEX IF NOT EXISTS idx_elections_enterprise_id ON elections(enterprise_id);

-- ============================================================================
-- TERMINÉ — Vérification
-- ============================================================================
-- Pour vérifier que tout est bien créé:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('enterprises', 'unions', 'union_lists', 'electoral_colleges');

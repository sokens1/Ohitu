-- ============================================================================
-- O'HITU — Migration : Sièges à pourvoir au niveau bureau/centre
-- Objectif : distinguer le nombre d'électeurs (registered_voters) du nombre
--            de sièges à pourvoir (seats_to_fill / total_seats), tels que
--            mappés depuis le modèle Excel `modele_etablissements.xlsx`
--            (colonnes nb_sieges_* vs Nbre_electeurs_*).
-- À exécuter dans Supabase SQL Editor.
-- ============================================================================

-- 1) Sièges par bureau de vote (1 bureau == 1 collège dans le modèle pro)
ALTER TABLE voting_bureaux
  ADD COLUMN IF NOT EXISTS seats_to_fill INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN voting_bureaux.seats_to_fill IS
  'Nombre de sièges à pourvoir pour ce bureau (issu des colonnes nb_sieges_* du modèle Excel pro). Distinct de registered_voters.';

-- 2) Total des sièges au niveau établissement (somme des bureaux)
ALTER TABLE voting_centers
  ADD COLUMN IF NOT EXISTS total_seats INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN voting_centers.total_seats IS
  'Somme des sièges à pourvoir des bureaux de l''établissement.';

-- 3) Backfill : si une élection pro existe déjà, on laisse à 0 par défaut.
--    Les imports ultérieurs renseigneront ces colonnes.

-- 4) Lieu de vote stocké explicitement sur le bureau (issu de la colonne Lieu_vote
--    du modèle Excel pro). Évite d'avoir à le déduire du nom du bureau.
ALTER TABLE voting_bureaux
  ADD COLUMN IF NOT EXISTS lieu_vote TEXT;

COMMENT ON COLUMN voting_bureaux.lieu_vote IS
  'Lieu de vote effectif (colonne Lieu_vote du modèle Excel pro). Plusieurs bureaux d''un même établissement partagent le même lieu de vote.';

-- 5) Collège stocké explicitement sur le bureau (Encadrement / Cadres / Maîtrise / Exécution).
--    Permet l'agrégation par collège sans deviner depuis le nom.
ALTER TABLE voting_bureaux
  ADD COLUMN IF NOT EXISTS college TEXT;

COMMENT ON COLUMN voting_bureaux.college IS
  'Collège représenté par ce bureau (Encadrement, Cadres, Maîtrise, Exécution ou autre). Pour les élections politiques, peut rester NULL.';

-- ============================================================================
-- 6) Politiques RLS (Row Level Security) pour voting_centers et voting_bureaux
-- Objectif : s'assurer que TOUS les utilisateurs (anonymes et connectés) peuvent
--            lire (SELECT) les centres et bureaux de vote pour éviter les conflits
--            d'importation (409 Conflict) et permettre la consultation publique.
-- ============================================================================

-- A. Activation explicite de la sécurité RLS
ALTER TABLE voting_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_bureaux ENABLE ROW LEVEL SECURITY;

-- B. Nettoyage des anciennes politiques pour éviter les doublons/conflits
DROP POLICY IF EXISTS "Allow select for authenticated users" ON voting_centers;
DROP POLICY IF EXISTS "Allow select for all authenticated users" ON voting_centers;
DROP POLICY IF EXISTS "Allow select for observateur" ON voting_centers;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON voting_centers;
DROP POLICY IF EXISTS "Allow read for authenticated" ON voting_centers;
DROP POLICY IF EXISTS "voting_centers_select_policy" ON voting_centers;
DROP POLICY IF EXISTS "Enable read access for all users" ON voting_centers;
DROP POLICY IF EXISTS "Enable read access for all" ON voting_centers;
DROP POLICY IF EXISTS "Allow public read access" ON voting_centers;

-- C. Création de la politique de lecture publique (SELECT) sur les centres
CREATE POLICY "Enable read access for all" ON voting_centers
  FOR SELECT USING (true);

-- D. Autoriser l'écriture (INSERT/UPDATE/DELETE) pour les rôles habilités (super-admin, agent-saisie, validateur)
DROP POLICY IF EXISTS "Allow write for authorized roles" ON voting_centers;
DROP POLICY IF EXISTS "Enable write access for authorized users" ON voting_centers;
DROP POLICY IF EXISTS "Allow all operations for admins" ON voting_centers;

CREATE POLICY "Enable write access for authorized users" ON voting_centers
  FOR ALL TO authenticated
  USING (
    coalesce((SELECT role FROM users WHERE id = auth.uid()), 'observateur') IN ('super-admin', 'agent-saisie', 'validateur')
  )
  WITH CHECK (
    coalesce((SELECT role FROM users WHERE id = auth.uid()), 'observateur') IN ('super-admin', 'agent-saisie', 'validateur')
  );

-- E. Nettoyage des anciennes politiques sur les bureaux
DROP POLICY IF EXISTS "Allow select for authenticated users" ON voting_bureaux;
DROP POLICY IF EXISTS "Allow select for all authenticated users" ON voting_bureaux;
DROP POLICY IF EXISTS "Allow select for observateur" ON voting_bureaux;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON voting_bureaux;
DROP POLICY IF EXISTS "Allow read for authenticated" ON voting_bureaux;
DROP POLICY IF EXISTS "voting_bureaux_select_policy" ON voting_bureaux;
DROP POLICY IF EXISTS "Enable read access for all users" ON voting_bureaux;
DROP POLICY IF EXISTS "Enable read access for all" ON voting_bureaux;
DROP POLICY IF EXISTS "Allow public read access" ON voting_bureaux;

-- F. Création de la politique de lecture publique (SELECT) sur les bureaux
CREATE POLICY "Enable read access for all" ON voting_bureaux
  FOR SELECT USING (true);

-- G. Autoriser l'écriture (INSERT/UPDATE/DELETE) pour les rôles habilités sur les bureaux
DROP POLICY IF EXISTS "Allow write for authorized roles" ON voting_bureaux;
DROP POLICY IF EXISTS "Enable write access for authorized users" ON voting_bureaux;
DROP POLICY IF EXISTS "Allow all operations for admins" ON voting_bureaux;

CREATE POLICY "Enable write access for authorized users" ON voting_bureaux
  FOR ALL TO authenticated
  USING (
    coalesce((SELECT role FROM users WHERE id = auth.uid()), 'observateur') IN ('super-admin', 'agent-saisie', 'validateur')
  )
  WITH CHECK (
    coalesce((SELECT role FROM users WHERE id = auth.uid()), 'observateur') IN ('super-admin', 'agent-saisie', 'validateur')
  );


-- ============================================================
-- Migration : Restriction d'accès par rôle — observateur et président
-- Date : 2026-05-29
--
-- Prérequis : exécuter 20260529_users_rls_admin.sql en premier
--   (crée la fonction public.get_my_role() SECURITY DEFINER)
--
-- Principe :
--   • super-admin / admin      → accès complet à tout
--   • validateur / agent-saisie → élections assignées
--   • observateur              → lecture seule, élections + centres assignés
--   • president-etablissement  → élections + centres assignés (assigned_center_bureaux)
--
-- Note sur la récursion RLS :
--   Les politiques sur les autres tables font un
--   EXISTS (SELECT 1 FROM users WHERE id = auth.uid() ...).
--   Cela est sûr : elles lisent uniquement la ligne du user courant,
--   autorisée par "users can read own row" (USING id = auth.uid()).
--   Les vérifications admin utilisent get_my_role() pour éviter toute récursion.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. procès_verbaux
-- ─────────────────────────────────────────────────────────────
ALTER TABLE procès_verbaux ENABLE ROW LEVEL SECURITY;

-- Accès public : lecture des PVs des élections marquées is_public_visible
-- Couvre les utilisateurs non authentifiés (page résultats publique)
DROP POLICY IF EXISTS "public read visible election pvs" ON procès_verbaux;
CREATE POLICY "public read visible election pvs"
  ON procès_verbaux FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = procès_verbaux.election_id
        AND e.is_public_visible = true
    )
  );

-- Super-admin / admin : accès total (get_my_role évite la récursion)
DROP POLICY IF EXISTS "admins full access pvs" ON procès_verbaux;
CREATE POLICY "admins full access pvs"
  ON procès_verbaux FOR ALL
  USING     (public.get_my_role() IN ('super-admin', 'admin'))
  WITH CHECK(public.get_my_role() IN ('super-admin', 'admin'));

-- Validateur / agent-saisie : accès aux élections assignées
DROP POLICY IF EXISTS "validators agents access pvs" ON procès_verbaux;
CREATE POLICY "validators agents access pvs"
  ON procès_verbaux FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('validateur', 'agent-saisie')
        AND (
          u.assigned_election_ids IS NULL
          OR array_length(u.assigned_election_ids, 1) IS NULL
          OR procès_verbaux.election_id = ANY(u.assigned_election_ids)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('validateur', 'agent-saisie')
        AND (
          u.assigned_election_ids IS NULL
          OR array_length(u.assigned_election_ids, 1) IS NULL
          OR procès_verbaux.election_id = ANY(u.assigned_election_ids)
        )
    )
  );

-- Observateur : lecture seule, élections + centres + collèges assignés
-- assigned_center_colleges = { "center_uuid": ["cadres","employes"] }
-- Tableau vide pour un centre = tous les collèges de ce centre
DROP POLICY IF EXISTS "observateurs read assigned pvs" ON procès_verbaux;
CREATE POLICY "observateurs read assigned pvs"
  ON procès_verbaux FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN voting_bureaux vb ON vb.id = procès_verbaux.bureau_id
      WHERE u.id = auth.uid()
        AND u.role = 'observateur'
        AND u.assigned_election_ids IS NOT NULL
        AND procès_verbaux.election_id = ANY(u.assigned_election_ids)
        -- Filtre centre
        AND (
          u.assigned_center_ids IS NULL
          OR array_length(u.assigned_center_ids, 1) IS NULL
          OR vb.center_id = ANY(u.assigned_center_ids)
        )
        -- Filtre collège par centre
        AND (
          -- Pas de map de collèges configurée : tous les collèges visibles
          u.assigned_center_colleges IS NULL
          OR u.assigned_center_colleges = '{}'::jsonb
          -- Ce centre n'a pas de clé dans la map : tous ses collèges visibles
          OR NOT (u.assigned_center_colleges ? vb.center_id::text)
          -- Ce centre a un tableau vide : tous ses collèges visibles
          OR jsonb_array_length(u.assigned_center_colleges -> vb.center_id::text) = 0
          -- Le college_type du PV est dans la liste assignée pour ce centre
          OR (u.assigned_center_colleges -> vb.center_id::text) ? procès_verbaux.college_type
        )
    )
  );

-- President-etablissement : accès complet, élections + centres assignés
DROP POLICY IF EXISTS "presidents access assigned pvs" ON procès_verbaux;
CREATE POLICY "presidents access assigned pvs"
  ON procès_verbaux FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN voting_bureaux vb ON vb.id = procès_verbaux.bureau_id
      WHERE u.id = auth.uid()
        AND u.role = 'president-etablissement'
        AND u.assigned_election_ids IS NOT NULL
        AND procès_verbaux.election_id = ANY(u.assigned_election_ids)
        AND (
          u.assigned_center_bureaux IS NULL
          OR u.assigned_center_bureaux = '{}'::jsonb
          OR vb.center_id::text IN (
            SELECT jsonb_object_keys(u.assigned_center_bureaux)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN voting_bureaux vb ON vb.id = procès_verbaux.bureau_id
      WHERE u.id = auth.uid()
        AND u.role = 'president-etablissement'
        AND u.assigned_election_ids IS NOT NULL
        AND procès_verbaux.election_id = ANY(u.assigned_election_ids)
        AND (
          u.assigned_center_bureaux IS NULL
          OR u.assigned_center_bureaux = '{}'::jsonb
          OR vb.center_id::text IN (
            SELECT jsonb_object_keys(u.assigned_center_bureaux)
          )
        )
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 2. establishment_documents
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "staff can read all documents" ON establishment_documents;

-- Super-admin / admin
DROP POLICY IF EXISTS "admins read all documents" ON establishment_documents;
CREATE POLICY "admins read all documents"
  ON establishment_documents FOR SELECT
  USING (public.get_my_role() IN ('super-admin', 'admin'));

-- Validateur / agent-saisie : élections assignées
DROP POLICY IF EXISTS "validators agents read assigned documents" ON establishment_documents;
CREATE POLICY "validators agents read assigned documents"
  ON establishment_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('validateur', 'agent-saisie')
        AND (
          u.assigned_election_ids IS NULL
          OR array_length(u.assigned_election_ids, 1) IS NULL
          OR establishment_documents.election_id = ANY(u.assigned_election_ids)
        )
    )
  );

-- Observateur : élections + centres assignés
DROP POLICY IF EXISTS "observateurs read assigned documents" ON establishment_documents;
CREATE POLICY "observateurs read assigned documents"
  ON establishment_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'observateur'
        AND u.assigned_election_ids IS NOT NULL
        AND establishment_documents.election_id = ANY(u.assigned_election_ids)
        AND (
          u.assigned_center_ids IS NULL
          OR array_length(u.assigned_center_ids, 1) IS NULL
          OR establishment_documents.center_id = ANY(u.assigned_center_ids)
        )
    )
  );

-- President-etablissement : centres assignés
DROP POLICY IF EXISTS "presidents read assigned documents" ON establishment_documents;
CREATE POLICY "presidents read assigned documents"
  ON establishment_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'president-etablissement'
        AND u.assigned_election_ids IS NOT NULL
        AND establishment_documents.election_id = ANY(u.assigned_election_ids)
        AND (
          u.assigned_center_bureaux IS NULL
          OR u.assigned_center_bureaux = '{}'::jsonb
          OR establishment_documents.center_id::text IN (
            SELECT jsonb_object_keys(u.assigned_center_bureaux)
          )
        )
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 3. pv_observer_opinions
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "validators and admins can read opinions" ON pv_observer_opinions;

-- Super-admin / admin
DROP POLICY IF EXISTS "admins read all opinions" ON pv_observer_opinions;
CREATE POLICY "admins read all opinions"
  ON pv_observer_opinions FOR SELECT
  USING (public.get_my_role() IN ('super-admin', 'admin'));

-- Validateur / agent-saisie / president : PVs de leurs élections assignées
DROP POLICY IF EXISTS "validators staff read assigned opinions" ON pv_observer_opinions;
CREATE POLICY "validators staff read assigned opinions"
  ON pv_observer_opinions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN procès_verbaux pv ON pv.id = pv_observer_opinions.pv_id
      WHERE u.id = auth.uid()
        AND u.role IN ('validateur', 'agent-saisie', 'president-etablissement')
        AND (
          u.assigned_election_ids IS NULL
          OR array_length(u.assigned_election_ids, 1) IS NULL
          OR pv.election_id = ANY(u.assigned_election_ids)
        )
    )
  );

-- Observateur : son propre avis + avis des PVs de ses centres + collèges assignés
DROP POLICY IF EXISTS "observateurs read assigned opinions" ON pv_observer_opinions;
CREATE POLICY "observateurs read assigned opinions"
  ON pv_observer_opinions FOR SELECT
  USING (
    observer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      JOIN procès_verbaux pv ON pv.id = pv_observer_opinions.pv_id
      JOIN voting_bureaux  vb ON vb.id = pv.bureau_id
      WHERE u.id = auth.uid()
        AND u.role = 'observateur'
        AND u.assigned_election_ids IS NOT NULL
        AND pv.election_id = ANY(u.assigned_election_ids)
        -- Filtre centre
        AND (
          u.assigned_center_ids IS NULL
          OR array_length(u.assigned_center_ids, 1) IS NULL
          OR vb.center_id = ANY(u.assigned_center_ids)
        )
        -- Filtre collège par centre (même logique que sur procès_verbaux)
        AND (
          u.assigned_center_colleges IS NULL
          OR u.assigned_center_colleges = '{}'::jsonb
          OR NOT (u.assigned_center_colleges ? vb.center_id::text)
          OR jsonb_array_length(u.assigned_center_colleges -> vb.center_id::text) = 0
          OR (u.assigned_center_colleges -> vb.center_id::text) ? pv.college_type
        )
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 4. opinion_reactions : mise à jour par admins et presidents
--    (remplace la politique dans 20260529_opinion_reactions.sql
--     pour utiliser get_my_role et éviter toute récursion future)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins can update opinion reactions" ON pv_observer_opinions;
CREATE POLICY "admins can update opinion reactions"
  ON pv_observer_opinions FOR UPDATE
  USING (
    public.get_my_role() IN ('super-admin', 'admin')
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'president-etablissement'
    )
  )
  WITH CHECK (true);

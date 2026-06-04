-- ============================================================
-- Migration : ajout des rôles "employeur" et "suppleant-president"
-- Date : 2026-05-29
-- ============================================================

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Recréer avec les nouveaux rôles
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super-admin',
    'admin',
    'agent-saisie',
    'validateur',
    'observateur',
    'president-bureau',
    'president-etablissement',
    'employeur',
    'suppleant-president'
  ));

-- Mettre à jour la politique "get_my_role" n'a pas besoin de changements
-- car elle lit directement la colonne role sans filtre sur les valeurs.

-- Mettre à jour les politiques RLS pour inclure les nouveaux rôles
-- (si nécessaire selon vos politiques existantes)

-- Politique pv_observer_opinions : employeur peut lire les avis (même que observateur)
DROP POLICY IF EXISTS "validators staff read assigned opinions" ON pv_observer_opinions;
CREATE POLICY "validators staff read assigned opinions"
  ON pv_observer_opinions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN procès_verbaux pv ON pv.id = pv_observer_opinions.pv_id
      WHERE u.id = auth.uid()
        AND u.role IN ('validateur', 'agent-saisie', 'president-etablissement', 'employeur', 'suppleant-president')
        AND (
          u.assigned_election_ids IS NULL
          OR array_length(u.assigned_election_ids, 1) IS NULL
          OR pv.election_id = ANY(u.assigned_election_ids)
        )
    )
  );

-- Politique procès_verbaux : employeur peut lire comme observateur
DROP POLICY IF EXISTS "observateurs read assigned pvs" ON procès_verbaux;
CREATE POLICY "observateurs read assigned pvs"
  ON procès_verbaux FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN voting_bureaux vb ON vb.id = procès_verbaux.bureau_id
      WHERE u.id = auth.uid()
        AND u.role IN ('observateur', 'employeur')
        AND u.assigned_election_ids IS NOT NULL
        AND procès_verbaux.election_id = ANY(u.assigned_election_ids)
        AND (
          u.assigned_center_ids IS NULL
          OR array_length(u.assigned_center_ids, 1) IS NULL
          OR vb.center_id = ANY(u.assigned_center_ids)
        )
        AND (
          u.assigned_center_colleges IS NULL
          OR u.assigned_center_colleges = '{}'::jsonb
          OR NOT (u.assigned_center_colleges ? vb.center_id::text)
          OR jsonb_array_length(u.assigned_center_colleges -> vb.center_id::text) = 0
          OR (u.assigned_center_colleges -> vb.center_id::text) ? procès_verbaux.college_type
        )
    )
  );

-- Politique establishment_documents : suppléant-président peut déposer des documents
-- (déjà couvert par "president can manage own documents" FOR ALL USING uploaded_by = auth.uid())

-- Permettre aux admins et super-admins de supprimer des documents
-- Sans cette politique, le DELETE est silencieusement bloqué par RLS
-- (error = null mais 0 lignes supprimées → faux succès côté front)

DROP POLICY IF EXISTS "admins can delete documents" ON establishment_documents;
CREATE POLICY "admins can delete documents"
  ON establishment_documents FOR DELETE
  USING (public.get_my_role() IN ('super-admin', 'admin'));

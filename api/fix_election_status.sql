-- ============================================================================
-- Correctif : statuts d'élections corrompus par la migration de visibilité
-- Contexte : l'ancienne version de migration_election_public_visibility.sql
--   mettait status = 'Annulée' pour les élections avec is_published = FALSE.
--   Ce script identifie les élections potentiellement affectées et permet
--   de corriger manuellement leurs statuts.
-- À exécuter dans Supabase → SQL Editor
-- ============================================================================

-- 1. Voir les élections avec status = 'Annulée' (potentiellement corrompues)
--    → Vérifiez la colonne updated_at pour confirmer si la corruption est récente
SELECT id, title, status, is_public_visible, is_published, updated_at
FROM elections
WHERE status = 'Annulée'
ORDER BY updated_at DESC;

-- 2. Corriger les élections dont le statut 'Annulée' est incorrect
--    (ajustez le statut correct pour chaque élection selon votre situation)
--
-- Exemples :
--   UPDATE elections SET status = 'À venir'   WHERE id = '<uuid>' AND status = 'Annulée';
--   UPDATE elections SET status = 'En cours'  WHERE id = '<uuid>' AND status = 'Annulée';
--   UPDATE elections SET status = 'Terminée'  WHERE id = '<uuid>' AND status = 'Annulée';

-- 3. Vérification après correction
-- SELECT id, title, status, is_public_visible FROM elections ORDER BY updated_at DESC LIMIT 20;

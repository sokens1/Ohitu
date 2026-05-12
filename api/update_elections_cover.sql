-- Ajout de la colonne cover_image à la table elections
ALTER TABLE elections ADD COLUMN IF NOT EXISTS cover_image TEXT;

-- S'assurer que le bucket avatars existe (déjà fait normalement mais par sécurité)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques de sécurité pour les avatars (si non existantes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Avatar Public Access'
    ) THEN
        CREATE POLICY "Avatar Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Avatar Upload Access'
    ) THEN
        CREATE POLICY "Avatar Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
    END IF;
END $$;

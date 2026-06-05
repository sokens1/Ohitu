-- Ajout du numéro de téléphone dans la table users
-- Permet la connexion par téléphone + mot de passe

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Index unique (ignore les NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- Permettre à chaque user de lire son propre numéro
-- (déjà couvert par "users can read own row")

-- Permettre aux admins de lire/modifier le téléphone
-- (déjà couvert par "admins can read all users" + "admins can update users")

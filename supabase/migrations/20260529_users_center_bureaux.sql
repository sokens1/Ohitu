-- Add assigned_center_bureaux column to store bureau assignments (replacing college assignments)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_center_bureaux JSONB DEFAULT '{}'::jsonb;

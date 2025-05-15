/*
  # Add avatar column to users table

  1. Changes
    - Add `avatar` column to `users` table
      - Type: text
      - Nullable: true
      - No default value
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'avatar'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar text;
  END IF;
END $$;
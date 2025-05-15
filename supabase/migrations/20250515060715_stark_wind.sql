/*
  # Add medical_record_id to vitals table

  1. Changes
    - Add `medical_record_id` column to `vitals` table
    - Set foreign key constraint to reference visits table
    - Create index for better query performance

  2. Notes
    - Using IF NOT EXISTS to prevent errors if column already exists
    - Adding index to improve lookup performance
    - Setting ON DELETE CASCADE to maintain referential integrity
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vitals' AND column_name = 'medical_record_id'
  ) THEN
    ALTER TABLE vitals 
    ADD COLUMN medical_record_id uuid REFERENCES visits(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_vitals_medical_record 
    ON vitals(medical_record_id);
  END IF;
END $$;
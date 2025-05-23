-- First ensure we have the correct foreign key
ALTER TABLE vitals DROP CONSTRAINT IF EXISTS vitals_medical_record_id_fkey;
ALTER TABLE vitals DROP COLUMN IF EXISTS medical_record_id;

-- Make sure visit_id is properly set up
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vitals' AND column_name = 'visit_id'
  ) THEN
    ALTER TABLE vitals ADD COLUMN visit_id uuid;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'vitals_visit_id_fkey'
  ) THEN
    ALTER TABLE vitals
    ADD CONSTRAINT vitals_visit_id_fkey
    FOREIGN KEY (visit_id)
    REFERENCES visits(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for visit_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_vitals_visit ON vitals(visit_id);

-- Disable RLS as requested
ALTER TABLE vitals DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON vitals;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON vitals;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON vitals;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON vitals;
-- Migration: Practice Types Normalization
-- Creates proper normalized schema with practice_types lookup table
-- and foreign keys as requested by user

-- Step 1: Create practice_types lookup table
CREATE TABLE IF NOT EXISTS practice_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Enable RLS on practice_types
ALTER TABLE practice_types ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policy for read access
CREATE POLICY "practice_types_read_all" ON practice_types FOR SELECT USING (true);

-- Step 4: Insert the known practice types (aesthetic, dental, medical)
INSERT INTO practice_types (name, description) 
VALUES 
  ('dental', 'Dental practice type'),
  ('medical', 'Medical practice type'),
  ('aesthetic', 'Aesthetic practice type')
ON CONFLICT (name) DO NOTHING;

-- Step 5: Add practice_type_id to practices table
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_type_id UUID REFERENCES practice_types(id);

-- Step 6: Update practices with correct practice_type_id
UPDATE practices 
SET practice_type_id = (
  SELECT id FROM practice_types WHERE name = practices.practice_type
)
WHERE practice_type_id IS NULL;

-- Step 7: Add practice_type_id to practice_tariffs table  
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS practice_type_id UUID REFERENCES practice_types(id);

-- Step 8: Update all dental codes to dental practice type
UPDATE practice_tariffs 
SET practice_type_id = (
  SELECT id FROM practice_types WHERE name = 'dental'
)
WHERE practice_type_id IS NULL;

-- Step 9: Create view for easy querying with proper joins
CREATE OR REPLACE VIEW practice_tariffs_with_types AS
SELECT 
  pt.*,
  ptype.name as practice_type_name,
  ptype.description as practice_type_description
FROM practice_tariffs pt
JOIN practice_types ptype ON pt.practice_type_id = ptype.id
WHERE pt.is_active = true AND ptype.is_active = true
ORDER BY pt.code;

-- Step 10: Grant permissions
GRANT SELECT ON practice_types TO anon, authenticated;
GRANT SELECT ON practice_tariffs_with_types TO anon, authenticated;

-- Step 11: Create RLS policy for practice_tariffs_with_types
-- Note: Views inherit policies from underlying tables, but we ensure access
CREATE POLICY IF NOT EXISTS "practice_tariffs_read_all" ON practice_tariffs FOR SELECT USING (true);

-- Step 12: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_practice_types_updated_at BEFORE UPDATE ON practice_types
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 13: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_practice_type_id ON practice_tariffs(practice_type_id);
CREATE INDEX IF NOT EXISTS idx_practices_practice_type_id ON practices(practice_type_id);
CREATE INDEX IF NOT EXISTS idx_practice_types_name ON practice_types(name);

-- Step 14: Verify the setup
DO $$
DECLARE
  tariff_count INTEGER;
  dental_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tariff_count FROM practice_tariffs_with_types;
  SELECT COUNT(*) INTO dental_count FROM practice_tariffs_with_types WHERE practice_type_name = 'dental';
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Total tariffs in view: %', tariff_count;
  RAISE NOTICE 'Dental tariffs in view: %', dental_count;
END $$;
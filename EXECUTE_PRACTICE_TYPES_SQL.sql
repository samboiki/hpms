-- EXECUTE THIS SQL IN SUPABASE SQL EDITOR
-- Creates practice_types normalization as requested

-- Step 1: Create practice_types lookup table
CREATE TABLE IF NOT EXISTS practice_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Insert known practice types
INSERT INTO practice_types (name, description) 
VALUES 
  ('dental', 'Dental practice type'),
  ('medical', 'Medical practice type'),
  ('aesthetic', 'Aesthetic practice type')
ON CONFLICT (name) DO NOTHING;

-- Step 3: Add practice_type_id to practices table
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_type_id UUID REFERENCES practice_types(id);

-- Step 4: Update practices with correct practice_type_id
UPDATE practices 
SET practice_type_id = (
  SELECT id FROM practice_types WHERE name = practices.practice_type
)
WHERE practice_type_id IS NULL;

-- Step 5: Add practice_type_id to practice_tariffs table  
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS practice_type_id UUID REFERENCES practice_types(id);

-- Step 6: Update all dental codes to dental practice type
UPDATE practice_tariffs 
SET practice_type_id = (
  SELECT id FROM practice_types WHERE name = 'dental'
)
WHERE practice_type_id IS NULL;

-- Step 7: Create view for easy querying
CREATE OR REPLACE VIEW practice_tariffs_with_types AS
SELECT 
  pt.*,
  ptype.name as practice_type_name,
  ptype.description as practice_type_description
FROM practice_tariffs pt
JOIN practice_types ptype ON pt.practice_type_id = ptype.id
WHERE pt.is_active = true AND ptype.is_active = true
ORDER BY pt.code;

-- Step 8: Enable RLS and permissions
ALTER TABLE practice_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "practice_types_read_all" ON practice_types FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "practice_tariffs_read_all" ON practice_tariffs FOR SELECT USING (true);

GRANT SELECT ON practice_types TO anon, authenticated;
GRANT SELECT ON practice_tariffs_with_types TO anon, authenticated;

-- Step 9: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_practice_type_id ON practice_tariffs(practice_type_id);
CREATE INDEX IF NOT EXISTS idx_practices_practice_type_id ON practices(practice_type_id);

-- Step 10: Verify results
SELECT 
  practice_type_name,
  COUNT(*) as tariff_count
FROM practice_tariffs_with_types 
GROUP BY practice_type_name;
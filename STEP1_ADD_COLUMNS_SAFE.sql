-- STEP 1: Add Required Columns to practice_tariffs Table (SAFE VERSION)
-- Execute this first in Supabase SQL Editor
-- Keeps existing columns to avoid breaking dependencies

-- Add new columns based on Excel structure (keeping existing ones)
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS code INTEGER;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS official_2025_price_nad DECIMAL(10,2);
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS on_2025_list TEXT;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS found_in_claims TEXT;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS requires_tooth_number TEXT;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS can_be_multiplied TEXT;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS business_rule_formula TEXT;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS example_calculation TEXT;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS practice_type TEXT DEFAULT 'dental';

-- Ensure system columns exist
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS effective_to DATE;
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Verify the new table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'practice_tariffs' 
AND table_schema = 'public'
ORDER BY ordinal_position;
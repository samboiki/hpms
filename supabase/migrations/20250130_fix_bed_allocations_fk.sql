-- Migration: Fix bed_allocations foreign key to point to beds table
-- Date: 2025-01-30
-- Description: Changes the bed_allocations.bed_id foreign key from hospital_beds to beds table

-- Step 1: Drop the old foreign key constraint if it exists
ALTER TABLE bed_allocations
DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey;

-- Step 2: Add new foreign key constraint pointing to beds table
ALTER TABLE bed_allocations
ADD CONSTRAINT bed_allocations_bed_id_fkey
FOREIGN KEY (bed_id)
REFERENCES beds(id)
ON DELETE CASCADE;

-- Verification query (run this after migration to confirm):
-- SELECT
--     tc.constraint_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--     AND tc.table_name='bed_allocations'
--     AND kcu.column_name='bed_id';

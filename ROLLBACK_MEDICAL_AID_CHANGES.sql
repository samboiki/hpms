-- ============================================
-- ROLLBACK: Undo All Medical Aid Enhancement Changes
-- Execute this in Supabase SQL Editor to undo database changes
-- ============================================

-- STEP 1: Drop any functions I created
-- ====================================
DROP FUNCTION IF EXISTS calculate_medical_aid_coverage(UUID, NUMERIC, TEXT[]);
DROP FUNCTION IF EXISTS update_medical_aid_limit(UUID, NUMERIC, NUMERIC, UUID, VARCHAR(100), TEXT);
DROP FUNCTION IF EXISTS process_medical_aid_invoice();

-- STEP 2: Drop any triggers I created
-- ===================================
DROP TRIGGER IF EXISTS process_medical_aid_invoice_trigger ON invoices_enhanced;

-- STEP 3: Drop any views I created
-- ================================
DROP VIEW IF EXISTS patient_medical_aid_status;
DROP VIEW IF EXISTS recent_limit_updates;

-- STEP 4: Drop any tables I created
-- =================================
DROP TABLE IF EXISTS medical_aid_coverage_history CASCADE;

-- STEP 5: Remove any policies I created
-- ====================================
DROP POLICY IF EXISTS "Users can view coverage history" ON medical_aid_coverage_history;
DROP POLICY IF EXISTS "Users can insert coverage history" ON medical_aid_coverage_history;

-- STEP 6: Remove columns I added to medical_aid_details
-- =====================================================
ALTER TABLE medical_aid_details 
DROP COLUMN IF EXISTS annual_limit,
DROP COLUMN IF EXISTS remaining_limit,
DROP COLUMN IF EXISTS last_limit_check_date,
DROP COLUMN IF EXISTS limit_updated_by,
DROP COLUMN IF EXISTS coverage_percentage,
DROP COLUMN IF EXISTS co_payment_amount,
DROP COLUMN IF EXISTS deductible_amount,
DROP COLUMN IF EXISTS authorization_required,
DROP COLUMN IF EXISTS pre_authorization_number,
DROP COLUMN IF EXISTS benefit_year_start,
DROP COLUMN IF EXISTS benefit_year_end;

-- STEP 7: Drop any indexes I created
-- ==================================
DROP INDEX IF EXISTS idx_coverage_history_medical_aid;
DROP INDEX IF EXISTS idx_coverage_history_visit;
DROP INDEX IF EXISTS idx_coverage_history_date;

-- STEP 8: Clean up any comments I added
-- =====================================
COMMENT ON COLUMN medical_aid_details.annual_limit IS NULL;
COMMENT ON COLUMN medical_aid_details.remaining_limit IS NULL;
COMMENT ON COLUMN medical_aid_details.last_limit_check_date IS NULL;
COMMENT ON COLUMN medical_aid_details.limit_updated_by IS NULL;
COMMENT ON COLUMN medical_aid_details.coverage_percentage IS NULL;
COMMENT ON COLUMN medical_aid_details.co_payment_amount IS NULL;
COMMENT ON COLUMN medical_aid_details.deductible_amount IS NULL;

-- STEP 9: Verification queries
-- ============================

-- Check that medical_aid_details table is back to original structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'medical_aid_details' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check that no orphaned functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (
    routine_name LIKE '%medical_aid%' OR 
    routine_name LIKE '%coverage%' OR
    routine_name LIKE '%limit%'
  );

-- Check that no orphaned tables exist
SELECT 
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%coverage%';

-- Final success message
SELECT 
  '✅ ROLLBACK COMPLETE!' as status,
  'All medical aid enhancement changes have been undone' as message,
  'Your database is back to its original state' as confirmation;
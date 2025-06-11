-- ============================================
-- ROLLBACK: Undo All Medical Aid Enhancement Changes (FIXED)
-- Execute this in Supabase SQL Editor to undo database changes
-- ============================================

-- STEP 1: Drop triggers FIRST (before functions)
-- ==============================================
DROP TRIGGER IF EXISTS process_medical_aid_invoice_trigger ON invoices_enhanced;

-- STEP 2: Drop any functions I created
-- ====================================
DROP FUNCTION IF EXISTS calculate_medical_aid_coverage(UUID, NUMERIC, TEXT[]);
DROP FUNCTION IF EXISTS update_medical_aid_limit(UUID, NUMERIC, NUMERIC, UUID, VARCHAR(100), TEXT);
DROP FUNCTION IF EXISTS process_medical_aid_invoice();

-- STEP 3: Drop any views I created
-- ================================
DROP VIEW IF EXISTS patient_medical_aid_status;
DROP VIEW IF EXISTS recent_limit_updates;

-- STEP 4: Remove any policies I created (before dropping table)
-- ============================================================
DROP POLICY IF EXISTS "Users can view coverage history" ON medical_aid_coverage_history;
DROP POLICY IF EXISTS "Users can insert coverage history" ON medical_aid_coverage_history;

-- STEP 5: Drop any tables I created
-- =================================
DROP TABLE IF EXISTS medical_aid_coverage_history CASCADE;

-- STEP 6: Drop any indexes I created
-- ==================================
DROP INDEX IF EXISTS idx_coverage_history_medical_aid;
DROP INDEX IF EXISTS idx_coverage_history_visit;
DROP INDEX IF EXISTS idx_coverage_history_date;

-- STEP 7: Remove columns I added to medical_aid_details
-- =====================================================
ALTER TABLE medical_aid_details 
DROP COLUMN IF EXISTS annual_limit CASCADE,
DROP COLUMN IF EXISTS remaining_limit CASCADE,
DROP COLUMN IF EXISTS last_limit_check_date CASCADE,
DROP COLUMN IF EXISTS limit_updated_by CASCADE,
DROP COLUMN IF EXISTS coverage_percentage CASCADE,
DROP COLUMN IF EXISTS co_payment_amount CASCADE,
DROP COLUMN IF EXISTS deductible_amount CASCADE,
DROP COLUMN IF EXISTS authorization_required CASCADE,
DROP COLUMN IF EXISTS pre_authorization_number CASCADE,
DROP COLUMN IF EXISTS benefit_year_start CASCADE,
DROP COLUMN IF EXISTS benefit_year_end CASCADE;

-- STEP 8: Verification queries
-- ============================

-- Check that medical_aid_details table is back to original structure
SELECT 
  'Current medical_aid_details columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'medical_aid_details' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check that no orphaned functions exist
SELECT 
  'Remaining functions with medical_aid/coverage/limit:' as info,
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
  'Remaining tables with coverage:' as info,
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%coverage%';

-- Check for any remaining triggers
SELECT 
  'Remaining triggers on invoices_enhanced:' as info,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoices_enhanced' 
  AND trigger_schema = 'public';

-- Final success message
SELECT 
  '✅ ROLLBACK COMPLETE!' as status,
  'All medical aid enhancement changes have been undone' as message,
  'Your database is back to its original state' as confirmation;
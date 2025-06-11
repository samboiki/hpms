-- ============================================
-- ROLLBACK: Medical Aid Coverage and Limits Enhancement
-- Execute this in Supabase SQL Editor to undo the enhancements
-- ============================================

-- STEP 1: Drop triggers first
-- ===========================
DROP TRIGGER IF EXISTS process_medical_aid_invoice_trigger ON invoices_enhanced;

-- STEP 2: Drop functions
-- ======================
DROP FUNCTION IF EXISTS process_medical_aid_invoice();
DROP FUNCTION IF EXISTS update_medical_aid_limit(UUID, NUMERIC, NUMERIC, UUID, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS calculate_medical_aid_coverage(UUID, NUMERIC, TEXT[]);

-- STEP 3: Drop views
-- ==================
DROP VIEW IF EXISTS recent_limit_updates;
DROP VIEW IF EXISTS patient_medical_aid_status;

-- STEP 4: Drop tables
-- ===================
DROP TABLE IF EXISTS medical_aid_coverage_history;

-- STEP 5: Remove added columns from medical_aid_details
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

-- STEP 6: Clean up any sample data updates (reset to original state)
-- ==================================================================
-- Note: This will reset any limit/coverage data that was added
UPDATE medical_aid_details SET
  updated_at = NOW()
WHERE id IS NOT NULL;

-- STEP 7: Verification
-- ===================
-- Check that all enhancements have been removed
SELECT 
  'medical_aid_details' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'medical_aid_details' 
  AND table_schema = 'public'
  AND column_name IN (
    'annual_limit', 'remaining_limit', 'last_limit_check_date', 
    'limit_updated_by', 'coverage_percentage', 'co_payment_amount',
    'deductible_amount', 'authorization_required', 'pre_authorization_number',
    'benefit_year_start', 'benefit_year_end'
  );

-- If the above query returns any rows, those columns still exist and need manual removal

-- Check for any remaining tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'medical_aid_coverage_history';

-- Check for any remaining functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_medical_aid_coverage',
    'update_medical_aid_limit', 
    'process_medical_aid_invoice'
  );

-- Final success message
SELECT 
  'Medical aid enhancement rollback completed!' as status,
  'All complex medical aid features have been removed' as result,
  'System restored to simple 100% coverage model' as note;
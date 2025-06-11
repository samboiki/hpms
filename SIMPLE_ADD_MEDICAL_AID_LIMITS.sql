-- ============================================
-- SIMPLE: Add Medical Aid Limit Fields
-- Just adds limit fields to capture medical aid limits manually
-- ============================================

-- Add limit tracking columns to medical_aid_details table
ALTER TABLE medical_aid_details 
ADD COLUMN IF NOT EXISTS annual_limit NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_limit NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_limit_check_date DATE,
ADD COLUMN IF NOT EXISTS coverage_percentage NUMERIC(5,2) DEFAULT 80.00,
ADD COLUMN IF NOT EXISTS co_payment_amount NUMERIC(10,2) DEFAULT 0.00;

-- Add comments for clarity
COMMENT ON COLUMN medical_aid_details.annual_limit IS 'Total annual benefit limit from medical aid';
COMMENT ON COLUMN medical_aid_details.remaining_limit IS 'Remaining limit available - updated by receptionist';
COMMENT ON COLUMN medical_aid_details.last_limit_check_date IS 'Last date limit was checked with medical aid portal';
COMMENT ON COLUMN medical_aid_details.coverage_percentage IS 'Percentage covered by medical aid (e.g., 80%)';
COMMENT ON COLUMN medical_aid_details.co_payment_amount IS 'Fixed co-payment amount per visit';

-- Add sample data to existing records
UPDATE medical_aid_details SET
  annual_limit = CASE 
    WHEN provider = 'Discovery' THEN 25000.00
    WHEN provider = 'Bonitas' THEN 20000.00
    WHEN provider = 'Old Mutual' THEN 18000.00
    ELSE 15000.00
  END,
  remaining_limit = CASE 
    WHEN provider = 'Discovery' THEN 22000.00
    WHEN provider = 'Bonitas' THEN 18000.00
    WHEN provider = 'Old Mutual' THEN 15000.00
    ELSE 12000.00
  END,
  coverage_percentage = CASE 
    WHEN provider = 'Discovery' THEN 85.00
    WHEN provider = 'Bonitas' THEN 80.00
    ELSE 75.00
  END,
  co_payment_amount = 150.00,
  last_limit_check_date = CURRENT_DATE - INTERVAL '2 days'
WHERE annual_limit IS NULL;

SELECT 'Medical aid limit fields added successfully!' as status;
-- ============================================
-- Medical Aid Coverage and Limits Enhancement
-- Execute this in Supabase SQL Editor
-- ============================================

-- STEP 1: Add medical aid limit tracking to medical_aid_details table
-- ===================================================================

ALTER TABLE medical_aid_details 
ADD COLUMN IF NOT EXISTS annual_limit NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_limit NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_limit_check_date DATE,
ADD COLUMN IF NOT EXISTS limit_updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS coverage_percentage NUMERIC(5,2) DEFAULT 80.00,
ADD COLUMN IF NOT EXISTS co_payment_amount NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS deductible_amount NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS authorization_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pre_authorization_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS benefit_year_start DATE,
ADD COLUMN IF NOT EXISTS benefit_year_end DATE;

-- Add comments for clarity
COMMENT ON COLUMN medical_aid_details.annual_limit IS 'Total annual benefit limit from medical aid';
COMMENT ON COLUMN medical_aid_details.remaining_limit IS 'Remaining limit available - updated by receptionist';
COMMENT ON COLUMN medical_aid_details.last_limit_check_date IS 'Last date limit was checked with medical aid portal';
COMMENT ON COLUMN medical_aid_details.limit_updated_by IS 'User who last updated the limit information';
COMMENT ON COLUMN medical_aid_details.coverage_percentage IS 'Percentage covered by medical aid (e.g., 80%)';
COMMENT ON COLUMN medical_aid_details.co_payment_amount IS 'Fixed co-payment amount per visit';
COMMENT ON COLUMN medical_aid_details.deductible_amount IS 'Annual deductible amount';

-- STEP 2: Create medical aid coverage tracking table
-- ==================================================

CREATE TABLE IF NOT EXISTS medical_aid_coverage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_aid_detail_id UUID NOT NULL REFERENCES medical_aid_details(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id),
  invoice_id UUID REFERENCES invoices_enhanced(id),
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_remaining_limit NUMERIC(12,2),
  new_remaining_limit NUMERIC(12,2),
  amount_claimed NUMERIC(10,2),
  authorization_number VARCHAR(50),
  portal_reference VARCHAR(100),
  checked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_coverage_history_medical_aid ON medical_aid_coverage_history(medical_aid_detail_id);
CREATE INDEX IF NOT EXISTS idx_coverage_history_visit ON medical_aid_coverage_history(visit_id);
CREATE INDEX IF NOT EXISTS idx_coverage_history_date ON medical_aid_coverage_history(check_date);

-- STEP 3: Enhanced invoice billing logic
-- ======================================

-- Function to calculate medical aid coverage for an invoice
CREATE OR REPLACE FUNCTION calculate_medical_aid_coverage(
  p_patient_id UUID,
  p_total_amount NUMERIC,
  p_service_codes TEXT[] DEFAULT NULL
) RETURNS TABLE (
  covered_amount NUMERIC,
  patient_amount NUMERIC,
  coverage_percentage NUMERIC,
  remaining_limit NUMERIC,
  requires_authorization BOOLEAN,
  coverage_status TEXT
) AS $$
DECLARE
  v_medical_aid RECORD;
  v_covered_amount NUMERIC := 0;
  v_patient_amount NUMERIC := 0;
  v_coverage_status TEXT := 'approved';
BEGIN
  -- Get patient's medical aid details
  SELECT 
    mad.*,
    map.name as provider_name,
    map.requires_pre_auth
  INTO v_medical_aid
  FROM medical_aid_details mad
  JOIN medical_aid_providers map ON map.name = mad.provider
  WHERE mad.patient_id = p_patient_id
    AND (mad.valid_to IS NULL OR mad.valid_to >= CURRENT_DATE)
  ORDER BY mad.created_at DESC
  LIMIT 1;

  -- If no medical aid found
  IF v_medical_aid IS NULL THEN
    RETURN QUERY SELECT 
      0::NUMERIC as covered_amount,
      p_total_amount as patient_amount,
      0::NUMERIC as coverage_percentage,
      0::NUMERIC as remaining_limit,
      false as requires_authorization,
      'no_medical_aid'::TEXT as coverage_status;
    RETURN;
  END IF;

  -- Check if sufficient limit remaining
  IF v_medical_aid.remaining_limit < p_total_amount THEN
    v_coverage_status := 'insufficient_limit';
    v_covered_amount := v_medical_aid.remaining_limit;
    v_patient_amount := p_total_amount - v_covered_amount;
  ELSE
    -- Calculate coverage based on percentage
    v_covered_amount := ROUND((p_total_amount * v_medical_aid.coverage_percentage / 100), 2);
    
    -- Apply co-payment if applicable
    IF v_medical_aid.co_payment_amount > 0 THEN
      v_patient_amount := v_medical_aid.co_payment_amount + (p_total_amount - v_covered_amount);
      v_covered_amount := p_total_amount - v_patient_amount;
    ELSE
      v_patient_amount := p_total_amount - v_covered_amount;
    END IF;
    
    -- Check if authorization is required
    IF v_medical_aid.authorization_required OR v_medical_aid.requires_pre_auth THEN
      IF v_medical_aid.pre_authorization_number IS NULL THEN
        v_coverage_status := 'authorization_required';
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT 
    v_covered_amount,
    v_patient_amount,
    v_medical_aid.coverage_percentage,
    v_medical_aid.remaining_limit - v_covered_amount as remaining_limit,
    (v_medical_aid.authorization_required OR v_medical_aid.requires_pre_auth) as requires_authorization,
    v_coverage_status;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Function to update medical aid limits
-- =============================================

CREATE OR REPLACE FUNCTION update_medical_aid_limit(
  p_patient_id UUID,
  p_new_remaining_limit NUMERIC,
  p_annual_limit NUMERIC DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL,
  p_portal_reference VARCHAR(100) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_medical_aid_id UUID;
  v_previous_limit NUMERIC;
BEGIN
  -- Get the medical aid details
  SELECT id, remaining_limit INTO v_medical_aid_id, v_previous_limit
  FROM medical_aid_details
  WHERE patient_id = p_patient_id
    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_medical_aid_id IS NULL THEN
    RAISE EXCEPTION 'No active medical aid found for patient %', p_patient_id;
  END IF;

  -- Update the medical aid details
  UPDATE medical_aid_details SET
    remaining_limit = p_new_remaining_limit,
    annual_limit = COALESCE(p_annual_limit, annual_limit),
    last_limit_check_date = CURRENT_DATE,
    limit_updated_by = p_updated_by,
    updated_at = NOW()
  WHERE id = v_medical_aid_id;

  -- Record the limit update in history
  INSERT INTO medical_aid_coverage_history (
    medical_aid_detail_id,
    previous_remaining_limit,
    new_remaining_limit,
    portal_reference,
    checked_by,
    notes
  ) VALUES (
    v_medical_aid_id,
    v_previous_limit,
    p_new_remaining_limit,
    p_portal_reference,
    p_updated_by,
    p_notes
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: Enhanced invoice creation trigger
-- =========================================

CREATE OR REPLACE FUNCTION process_medical_aid_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage RECORD;
  v_medical_aid RECORD;
BEGIN
  -- Only process if invoice has medical aid involvement
  IF NEW.medical_aid_total IS NOT NULL AND NEW.medical_aid_total > 0 THEN
    
    -- Get coverage calculation
    SELECT * INTO v_coverage FROM calculate_medical_aid_coverage(
      NEW.patient_id,
      NEW.total
    );
    
    -- Update invoice with calculated amounts
    UPDATE invoices_enhanced SET
      medical_aid_total = v_coverage.covered_amount,
      patient_total = v_coverage.patient_amount,
      medical_aid_status = CASE 
        WHEN v_coverage.coverage_status = 'approved' THEN 'approved'
        WHEN v_coverage.coverage_status = 'authorization_required' THEN 'pending_authorization'
        WHEN v_coverage.coverage_status = 'insufficient_limit' THEN 'partial_coverage'
        ELSE 'pending'
      END
    WHERE id = NEW.id;
    
    -- Update remaining limit if coverage was approved
    IF v_coverage.coverage_status = 'approved' AND v_coverage.covered_amount > 0 THEN
      UPDATE medical_aid_details SET
        remaining_limit = remaining_limit - v_coverage.covered_amount,
        last_limit_check_date = CURRENT_DATE
      WHERE patient_id = NEW.patient_id
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE);
        
      -- Record the transaction
      INSERT INTO medical_aid_coverage_history (
        medical_aid_detail_id,
        invoice_id,
        previous_remaining_limit,
        new_remaining_limit,
        amount_claimed,
        notes
      ) 
      SELECT 
        mad.id,
        NEW.id,
        mad.remaining_limit + v_coverage.covered_amount,
        mad.remaining_limit,
        v_coverage.covered_amount,
        'Automatic deduction from invoice creation'
      FROM medical_aid_details mad
      WHERE mad.patient_id = NEW.patient_id
        AND (mad.valid_to IS NULL OR mad.valid_to >= CURRENT_DATE)
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS process_medical_aid_invoice_trigger ON invoices_enhanced;
CREATE TRIGGER process_medical_aid_invoice_trigger
  AFTER INSERT ON invoices_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION process_medical_aid_invoice();

-- STEP 6: Add RLS policies for new tables
-- =======================================

-- Enable RLS on new table
ALTER TABLE medical_aid_coverage_history ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read coverage history
CREATE POLICY "Users can view coverage history" ON medical_aid_coverage_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for authenticated users to insert coverage history
CREATE POLICY "Users can insert coverage history" ON medical_aid_coverage_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- STEP 7: Create helper views
-- ===========================

-- View for easy medical aid status checking
CREATE OR REPLACE VIEW patient_medical_aid_status AS
SELECT 
  p.id as patient_id,
  p.first_name,
  p.last_name,
  mad.provider,
  mad.scheme_name,
  mad.membership_number,
  mad.annual_limit,
  mad.remaining_limit,
  mad.coverage_percentage,
  mad.last_limit_check_date,
  mad.authorization_required,
  mad.pre_authorization_number,
  CASE 
    WHEN mad.remaining_limit <= 0 THEN 'limit_exhausted'
    WHEN mad.remaining_limit < 1000 THEN 'low_limit'
    WHEN mad.last_limit_check_date < CURRENT_DATE - INTERVAL '7 days' THEN 'needs_update'
    ELSE 'active'
  END as status,
  CASE 
    WHEN mad.valid_to IS NULL THEN true
    WHEN mad.valid_to >= CURRENT_DATE THEN true
    ELSE false
  END as is_active
FROM patients p
LEFT JOIN medical_aid_details mad ON mad.patient_id = p.id
WHERE mad.id IS NOT NULL;

-- View for recent limit updates
CREATE OR REPLACE VIEW recent_limit_updates AS
SELECT 
  p.first_name || ' ' || p.last_name as patient_name,
  mad.provider,
  mach.previous_remaining_limit,
  mach.new_remaining_limit,
  mach.amount_claimed,
  mach.check_date,
  u.email as updated_by,
  mach.notes
FROM medical_aid_coverage_history mach
JOIN medical_aid_details mad ON mad.id = mach.medical_aid_detail_id
JOIN patients p ON p.id = mad.patient_id
LEFT JOIN auth.users u ON u.id = mach.checked_by
ORDER BY mach.created_at DESC;

-- STEP 8: Sample data for testing
-- ================================

-- Update existing medical aid details with sample limits
UPDATE medical_aid_details SET
  annual_limit = 25000.00,
  remaining_limit = CASE 
    WHEN provider = 'Bonitas' THEN 18500.00
    WHEN provider = 'Discovery' THEN 22000.00
    WHEN provider = 'Old Mutual' THEN 15000.00
    WHEN provider = 'Momentum' THEN 20000.00
    ELSE 15000.00
  END,
  coverage_percentage = CASE 
    WHEN provider = 'Discovery' THEN 85.00
    WHEN provider = 'Bonitas' THEN 80.00
    ELSE 75.00
  END,
  last_limit_check_date = CURRENT_DATE - INTERVAL '3 days',
  benefit_year_start = DATE_TRUNC('year', CURRENT_DATE)::DATE,
  benefit_year_end = (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE
WHERE annual_limit IS NULL;

-- Success message
SELECT 'Medical aid coverage and limits system successfully created!' as status,
       'Use update_medical_aid_limit() function to update patient limits' as usage_note,
       'Check patient_medical_aid_status view for current status' as monitoring_note;
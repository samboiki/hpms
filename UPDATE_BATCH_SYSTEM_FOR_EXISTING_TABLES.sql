-- 🏗️ Updated Financial & Batch Management System
-- This script works with EXISTING invoices_enhanced and invoice_services tables

-- 1. First, let's DROP the conflicting tables if they were created
-- ================================================
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS visit_services CASCADE;

-- 2. Create Batch Management Tables (These are new)
-- ================================================

-- Batch headers table
CREATE TABLE IF NOT EXISTS batch_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  practice_number VARCHAR(15) NOT NULL,
  system_identification INTEGER DEFAULT 1,
  transaction_type CHAR(1) DEFAULT 'D',
  batch_number INTEGER NOT NULL,
  batch_date DATE NOT NULL,
  source_software VARCHAR(50) DEFAULT 'OneHealth',
  source_software_version VARCHAR(10) DEFAULT '2.1',
  medical_aid_reference VARCHAR(10) NOT NULL,
  total_invoices INTEGER DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'active', -- active, sent, completed, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE NULL,
  recipient_email VARCHAR(255),
  
  UNIQUE(practice_id, medical_aid_reference, batch_date, batch_number)
);

-- Batch details table (updated to reference invoices_enhanced)
CREATE TABLE IF NOT EXISTS batch_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_header_id UUID REFERENCES batch_headers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices_enhanced(id), -- Changed to reference existing table
  transaction_id CHAR(1) DEFAULT 'D',
  transaction_number_in_batch INTEGER NOT NULL,
  system_transaction_number INTEGER,
  system_patient_reference_number VARCHAR(20),
  type_of_service CHAR(1) DEFAULT 'T',
  medical_aid_reference VARCHAR(10) NOT NULL,
  not_used_1 VARCHAR(10) DEFAULT '',
  medical_aid_membership_number VARCHAR(20),
  member_surname VARCHAR(50),
  member_initials VARCHAR(10),
  patient_name VARCHAR(100),
  patient_date_of_birth DATE,
  bhf_tariff_code VARCHAR(10) NOT NULL,
  service_amount DECIMAL(10,2) NOT NULL,
  diagnosis TEXT,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  service_date DATE NOT NULL,
  number_of_services DECIMAL(5,2) DEFAULT 1.00,
  service_fee INTEGER DEFAULT 7,
  modifier_1 VARCHAR(10) DEFAULT '',
  modifier_2 VARCHAR(10) DEFAULT '',
  modifier_3 VARCHAR(10) DEFAULT '',
  modifier_4 VARCHAR(10) DEFAULT '',
  invoice_number VARCHAR(20) NOT NULL,
  referring_doctor VARCHAR(50) DEFAULT '',
  nappi_code VARCHAR(20) DEFAULT '',
  referred_to_practice_number VARCHAR(15) DEFAULT '',
  not_used_2 VARCHAR(10) DEFAULT '',
  practice_number VARCHAR(15) NOT NULL,
  hospital_indicator VARCHAR(10) DEFAULT '',
  authorisation_number VARCHAR(20) DEFAULT '',
  resubmission_flag VARCHAR(10) DEFAULT '',
  diagnostic_code VARCHAR(20) DEFAULT '',
  diagnostic_code_type VARCHAR(10) DEFAULT '',
  dosage_description TEXT DEFAULT '',
  not_used_3 VARCHAR(10) DEFAULT '',
  treating_doctor_hpcsa_number VARCHAR(20),
  tooth_numbers VARCHAR(50) DEFAULT '',
  gender CHAR(1) NOT NULL,
  tariff_code_type CHAR(1) DEFAULT 'T',
  cpt_cdt_code VARCHAR(20) DEFAULT '',
  free_text TEXT DEFAULT '',
  place_of_service VARCHAR(20) DEFAULT '',
  referring_doctor_2 VARCHAR(50) DEFAULT '',
  tracking_number VARCHAR(30) DEFAULT '',
  reading_additions VARCHAR(100) DEFAULT '',
  lens_prescription VARCHAR(100) DEFAULT '',
  density_of_tint VARCHAR(50) DEFAULT '',
  patient_id_number VARCHAR(20) NOT NULL,
  service_time TIME DEFAULT NULL,
  employer_name VARCHAR(100) DEFAULT '',
  employee_number VARCHAR(50) DEFAULT '',
  date_of_injury DATE DEFAULT NULL,
  iod_reference_number VARCHAR(30) DEFAULT '',
  
  patient_id UUID REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch trailer table
CREATE TABLE IF NOT EXISTS batch_trailer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_header_id UUID REFERENCES batch_headers(id) ON DELETE CASCADE,
  trailer_identifier CHAR(1) DEFAULT 'Z',
  total_detail_transactions INTEGER NOT NULL,
  total_amount_detail_transactions DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(batch_header_id)
);

-- 3. Add batch_id to existing invoices_enhanced table if not exists
-- ================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'invoices_enhanced' 
                 AND column_name = 'batch_id') THEN
    ALTER TABLE invoices_enhanced ADD COLUMN batch_id UUID REFERENCES batch_headers(id);
  END IF;
END $$;

-- 4. Create Indexes
-- ================================================
CREATE INDEX IF NOT EXISTS idx_batch_headers_practice_id ON batch_headers(practice_id);
CREATE INDEX IF NOT EXISTS idx_batch_headers_medical_aid ON batch_headers(medical_aid_reference);
CREATE INDEX IF NOT EXISTS idx_batch_headers_status ON batch_headers(status);
CREATE INDEX IF NOT EXISTS idx_batch_details_batch_header_id ON batch_details(batch_header_id);
CREATE INDEX IF NOT EXISTS idx_batch_details_invoice_id ON batch_details(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_batch_id ON invoices_enhanced(batch_id);

-- 5. Create Triggers for batch totals
-- ================================================
CREATE OR REPLACE FUNCTION update_batch_header_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE batch_headers 
  SET 
    total_invoices = (
      SELECT COUNT(DISTINCT invoice_number) 
      FROM batch_details 
      WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id)
    ),
    total_amount = (
      SELECT COALESCE(SUM(service_amount - discount_amount), 0) 
      FROM batch_details 
      WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.batch_header_id, OLD.batch_header_id);
  
  -- Update or create the batch trailer
  INSERT INTO batch_trailer (
    batch_header_id, 
    total_detail_transactions, 
    total_amount_detail_transactions
  ) 
  VALUES (
    COALESCE(NEW.batch_header_id, OLD.batch_header_id),
    (SELECT COUNT(*) FROM batch_details WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id)),
    (SELECT COALESCE(SUM(service_amount - discount_amount), 0) FROM batch_details WHERE batch_header_id = COALESCE(NEW.batch_header_id, OLD.batch_header_id))
  )
  ON CONFLICT (batch_header_id) 
  DO UPDATE SET
    total_detail_transactions = EXCLUDED.total_detail_transactions,
    total_amount_detail_transactions = EXCLUDED.total_amount_detail_transactions;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_batch_totals_insert ON batch_details;
CREATE TRIGGER trigger_update_batch_totals_insert
  AFTER INSERT ON batch_details
  FOR EACH ROW EXECUTE FUNCTION update_batch_header_totals();

DROP TRIGGER IF EXISTS trigger_update_batch_totals_update ON batch_details;
CREATE TRIGGER trigger_update_batch_totals_update
  AFTER UPDATE ON batch_details
  FOR EACH ROW EXECUTE FUNCTION update_batch_header_totals();

DROP TRIGGER IF EXISTS trigger_update_batch_totals_delete ON batch_details;
CREATE TRIGGER trigger_update_batch_totals_delete
  AFTER DELETE ON batch_details
  FOR EACH ROW EXECUTE FUNCTION update_batch_header_totals();

-- 6. Create Batch Management View (updated to use invoices_enhanced)
-- ================================================
CREATE OR REPLACE VIEW batch_management_view AS
SELECT 
  bh.id as batch_id,
  bh.practice_number,
  bh.batch_number,
  bh.batch_date,
  bh.medical_aid_reference,
  bh.status,
  bh.total_invoices,
  bh.total_amount,
  bh.created_at,
  bh.sent_at,
  bh.confirmed_at,
  
  -- Medical aid provider details
  map.name as medical_aid_name,
  map.short_name as medical_aid_short_name,
  map.email as medical_aid_email,
  
  -- Practice details
  p.name as practice_name,
  p.contact_email as practice_email,
  
  -- Batch details count
  COALESCE(bd_count.detail_count, 0) as detail_transactions,
  
  -- Trailer information
  bt.total_detail_transactions,
  bt.total_amount_detail_transactions,
  
  -- Generate filename for .dat file
  CONCAT(
    bh.practice_number, '_', 
    bh.batch_number, '_', 
    bh.medical_aid_reference
  ) as dat_filename
FROM batch_headers bh
LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
LEFT JOIN practices p ON p.id = bh.practice_id
LEFT JOIN batch_trailer bt ON bt.batch_header_id = bh.id
LEFT JOIN (
  SELECT batch_header_id, COUNT(*) as detail_count
  FROM batch_details 
  GROUP BY batch_header_id
) bd_count ON bd_count.batch_header_id = bh.id
ORDER BY bh.batch_date DESC, bh.batch_number DESC;

-- 7. Create Helper Functions
-- ================================================

-- Function to create new batch
CREATE OR REPLACE FUNCTION create_new_batch(
  p_practice_id UUID,
  p_medical_aid_reference VARCHAR(10),
  p_batch_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  v_practice_number VARCHAR(15);
  v_next_batch_number INTEGER;
  v_batch_id UUID;
BEGIN
  -- Get practice number
  SELECT practice_number INTO v_practice_number
  FROM practices 
  WHERE id = p_practice_id;
  
  IF v_practice_number IS NULL THEN
    RAISE EXCEPTION 'Practice not found or practice_number not set';
  END IF;
  
  -- Get next batch number for this medical aid
  SELECT COALESCE(MAX(batch_number), 0) + 1 INTO v_next_batch_number
  FROM batch_headers 
  WHERE practice_id = p_practice_id 
    AND medical_aid_reference = p_medical_aid_reference;
  
  -- Create new batch header
  INSERT INTO batch_headers (
    practice_id,
    practice_number,
    batch_number,
    batch_date,
    medical_aid_reference,
    status
  ) VALUES (
    p_practice_id,
    v_practice_number,
    v_next_batch_number,
    p_batch_date,
    p_medical_aid_reference,
    'active'
  ) RETURNING id INTO v_batch_id;
  
  RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add invoice to batch
CREATE OR REPLACE FUNCTION add_invoice_to_batch(
  p_batch_id UUID,
  p_invoice_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_invoice RECORD;
  v_patient RECORD;
  v_medical_aid RECORD;
  v_batch RECORD;
  v_service RECORD;
  v_transaction_number INTEGER;
BEGIN
  -- Get batch info
  SELECT * INTO v_batch FROM batch_headers WHERE id = p_batch_id;
  
  -- Get invoice info
  SELECT * INTO v_invoice FROM invoices_enhanced WHERE id = p_invoice_id;
  
  -- Get patient info
  SELECT * INTO v_patient FROM patients WHERE id = v_invoice.patient_id;
  
  -- Get medical aid info
  SELECT * INTO v_medical_aid FROM medical_aid_details WHERE patient_id = v_invoice.patient_id LIMIT 1;
  
  -- Get next transaction number
  SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_transaction_number
  FROM batch_details WHERE batch_header_id = p_batch_id;
  
  -- Add each service from invoice_services
  FOR v_service IN 
    SELECT * FROM invoice_services WHERE invoice_id = p_invoice_id
  LOOP
    INSERT INTO batch_details (
      batch_header_id,
      invoice_id,
      transaction_number_in_batch,
      system_patient_reference_number,
      medical_aid_reference,
      medical_aid_membership_number,
      member_surname,
      member_initials,
      patient_name,
      patient_date_of_birth,
      bhf_tariff_code,
      service_amount,
      diagnosis,
      service_date,
      number_of_services,
      invoice_number,
      practice_number,
      treating_doctor_hpcsa_number,
      gender,
      patient_id_number,
      patient_id,
      visit_id
    ) VALUES (
      p_batch_id,
      p_invoice_id,
      v_transaction_number,
      v_patient.id::TEXT,
      v_batch.medical_aid_reference,
      COALESCE(v_medical_aid.membership_number, ''),
      UPPER(v_patient.last_name),
      UPPER(SUBSTRING(v_patient.first_name FROM 1 FOR 1)),
      UPPER(v_patient.first_name || ' ' || v_patient.last_name),
      v_patient.date_of_birth,
      v_service.code,
      v_service.total_price,
      v_service.description,
      v_invoice.issue_date,
      v_service.quantity,
      v_invoice.invoice_number,
      v_batch.practice_number,
      'DEN00417', -- Default HPCSA number, should be updated
      UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)),
      v_patient.id_number,
      v_patient.id,
      v_invoice.visit_id
    );
    
    v_transaction_number := v_transaction_number + 1;
  END LOOP;
  
  -- Update invoice to link to batch
  UPDATE invoices_enhanced SET batch_id = p_batch_id WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Update Practice Numbers (if needed)
-- ================================================
UPDATE practices 
SET practice_number = '0540001133241' 
WHERE slug = 'newcharm-dental' AND practice_number IS NULL;

-- 9. Grant Permissions
-- ================================================
GRANT SELECT, INSERT, UPDATE ON batch_headers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON batch_details TO authenticated;
GRANT SELECT, INSERT, UPDATE ON batch_trailer TO authenticated;
GRANT SELECT ON batch_management_view TO authenticated;

-- Done! 🎉
-- The Batch Management System now integrates with your existing invoices_enhanced and invoice_services tables
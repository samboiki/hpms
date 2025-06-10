-- 🏗️ Financial & Batch Management System Setup
-- Execute this in Supabase SQL Editor

-- 1. Create Billing Tables
-- ================================================

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id),
  practice_id UUID REFERENCES practices(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, partial, paid, overdue, cancelled
  payment_method VARCHAR(20), -- cash, card, eft, medical_aid, mixed
  medical_aid_claim_number VARCHAR(50),
  medical_aid_status VARCHAR(20) DEFAULT 'not_submitted', -- not_submitted, submitted, approved, rejected, partial
  medical_aid_amount DECIMAL(10,2) DEFAULT 0.00,
  patient_amount DECIMAL(10,2) DEFAULT 0.00,
  notes TEXT,
  batch_id UUID, -- Will reference batch_headers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  tariff_code_id UUID REFERENCES practice_tariffs(id),
  code VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  medical_aid_covered BOOLEAN DEFAULT true,
  medical_aid_amount DECIMAL(10,2) DEFAULT 0.00,
  patient_amount DECIMAL(10,2) DEFAULT 0.00,
  tooth_numbers VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create visit_services table
CREATE TABLE IF NOT EXISTS visit_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id),
  practice_tariff_id UUID REFERENCES practice_tariffs(id),
  quantity DECIMAL(5,2) DEFAULT 1.00,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  tooth_numbers VARCHAR(100),
  notes TEXT,
  rendered_by UUID REFERENCES users(id),
  rendered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Batch Management Tables
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
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE NULL,
  recipient_email VARCHAR(255),
  
  UNIQUE(practice_id, medical_aid_reference, batch_date, batch_number)
);

-- Batch details table
CREATE TABLE IF NOT EXISTS batch_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_header_id UUID REFERENCES batch_headers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
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
  visit_service_id UUID REFERENCES visit_services(id),
  
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

-- 3. Create Indexes
-- ================================================

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_practice_id ON invoices(practice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_medical_aid_status ON invoices(medical_aid_status);
CREATE INDEX IF NOT EXISTS idx_invoices_batch_id ON invoices(batch_id);

-- Invoice items indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Visit services indexes
CREATE INDEX IF NOT EXISTS idx_visit_services_visit_id ON visit_services(visit_id);

-- Batch indexes
CREATE INDEX IF NOT EXISTS idx_batch_headers_practice_id ON batch_headers(practice_id);
CREATE INDEX IF NOT EXISTS idx_batch_headers_medical_aid ON batch_headers(medical_aid_reference);
CREATE INDEX IF NOT EXISTS idx_batch_headers_status ON batch_headers(status);
CREATE INDEX IF NOT EXISTS idx_batch_details_batch_header_id ON batch_details(batch_header_id);
CREATE INDEX IF NOT EXISTS idx_batch_details_invoice_id ON batch_details(invoice_id);

-- 4. Create Triggers
-- ================================================

-- Function for batch totals
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

-- 5. Create Batch Management View
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

-- 6. Create Helper Functions
-- ================================================

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(p_practice_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_year VARCHAR(4);
  v_next_number INTEGER;
  v_invoice_number VARCHAR(50);
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_number
  FROM invoices
  WHERE practice_id = p_practice_id
    AND invoice_number LIKE 'INV-' || v_year || '-%';
  
  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

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

-- 7. Update Practice Numbers
-- ================================================

UPDATE practices 
SET practice_number = '0540001133241' 
WHERE slug = 'newcharm-dental' AND practice_number IS NULL;

-- 8. Grant Permissions (if needed)
-- ================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON visit_services TO authenticated;
GRANT SELECT, INSERT, UPDATE ON batch_headers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON batch_details TO authenticated;
GRANT SELECT, INSERT, UPDATE ON batch_trailer TO authenticated;
GRANT SELECT ON batch_management_view TO authenticated;

-- Done! 🎉
-- The Financial & Batch Management System is now ready
-- CRITICAL BILLING SYSTEM FIX - EXECUTE THIS IN SUPABASE
-- This fixes all the invoice table issues

-- 1. Add missing foreign key relationship (check if exists first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoice_services_invoice_id_fkey'
    ) THEN
        ALTER TABLE invoice_services 
        ADD CONSTRAINT invoice_services_invoice_id_fkey 
        FOREIGN KEY (invoice_id) REFERENCES invoices_enhanced(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Add updated_at column to vitals table if it doesn't exist
ALTER TABLE vitals 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Fix the invoice number generation function (no ambiguous columns)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_val TEXT;
  month_val TEXT;
  sequence_num INT;
  new_invoice_number TEXT;
BEGIN
  year_val := to_char(CURRENT_DATE, 'YY');
  month_val := to_char(CURRENT_DATE, 'MM');
  
  -- Use fully qualified column names to avoid ambiguity
  SELECT COALESCE(MAX(SUBSTRING(ie.invoice_number FROM 7)::integer), 0) + 1
  INTO sequence_num
  FROM invoices_enhanced ie
  WHERE ie.invoice_number LIKE concat('INV', year_val, month_val, '%');
  
  new_invoice_number := concat('INV', year_val, month_val, LPAD(sequence_num::text, 4, '0'));
  NEW.invoice_number := new_invoice_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for invoice number generation
DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON invoices_enhanced;
CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON invoices_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();

-- 5. Fix the populate_invoice_details function  
CREATE OR REPLACE FUNCTION populate_invoice_details()
RETURNS TRIGGER AS $$
DECLARE
  patient_medical_aid RECORD;
BEGIN
  -- Get practice_id from the patient
  SELECT p.practice_id INTO NEW.practice_id
  FROM patients p
  WHERE p.id = NEW.patient_id;

  -- If no practice_id found, try to get it from the visit
  IF NEW.practice_id IS NULL THEN
    SELECT p.practice_id INTO NEW.practice_id
    FROM visits v
    JOIN patients p ON v.patient_id = p.id
    WHERE v.id = NEW.visit_id;
  END IF;

  -- Get active medical aid details for the patient
  SELECT
    mad.id,
    mad.membership_number,
    mad.provider,
    mad.scheme
  INTO patient_medical_aid
  FROM medical_aid_details mad
  WHERE mad.patient_id = NEW.patient_id
  ORDER BY mad.created_at DESC
  LIMIT 1;

  -- Populate medical aid details if found
  IF patient_medical_aid.id IS NOT NULL THEN
    NEW.medical_aid_id := patient_medical_aid.id;
    NEW.medical_aid_number := patient_medical_aid.membership_number;
    NEW.medical_aid_provider := patient_medical_aid.provider;
    NEW.medical_aid_scheme := patient_medical_aid.scheme;
    NEW.is_cash_client := FALSE;
  ELSE
    -- No medical aid found - mark as cash client
    NEW.is_cash_client := TRUE;
    NEW.medical_aid_id := NULL;
    NEW.medical_aid_number := NULL;
    NEW.medical_aid_provider := NULL;
    NEW.medical_aid_scheme := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create the populate trigger
DROP TRIGGER IF EXISTS trigger_populate_invoice_details ON invoices_enhanced;
CREATE TRIGGER trigger_populate_invoice_details 
  BEFORE INSERT OR UPDATE ON invoices_enhanced 
  FOR EACH ROW 
  EXECUTE FUNCTION populate_invoice_details();

-- 7. Fix the update_invoice_totals function
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  invoice_subtotal DECIMAL(10,2);
  invoice_tax DECIMAL(10,2);
  invoice_total DECIMAL(10,2);
  medical_aid_amount DECIMAL(10,2);
  patient_amount DECIMAL(10,2);
BEGIN
  -- Calculate totals from invoice_services
  SELECT
    COALESCE(SUM(total_price), 0),
    COALESCE(SUM(medical_aid_covered), 0),
    COALESCE(SUM(patient_portion), 0)
  INTO invoice_subtotal, medical_aid_amount, patient_amount
  FROM invoice_services
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Calculate tax (15% VAT)
  invoice_tax := invoice_subtotal * 0.15;
  invoice_total := invoice_subtotal + invoice_tax;

  -- Update the invoice totals in the enhanced table
  UPDATE invoices_enhanced
  SET
    subtotal = invoice_subtotal,
    tax = invoice_tax,
    total = invoice_total,
    medical_aid_total = medical_aid_amount,
    patient_total = patient_amount + invoice_tax, -- Patient pays tax
    balance_due = (patient_amount + invoice_tax) - COALESCE(amount_paid, 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 8. Create the totals trigger
DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON invoice_services;
CREATE TRIGGER trigger_update_invoice_totals
  AFTER INSERT OR DELETE OR UPDATE ON invoice_services
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();

-- 9. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_invoice_services_invoice_id_fkey ON invoice_services(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_practice_id ON invoices_enhanced(practice_id);

-- 10. Update the invoice_services_view properly
DROP VIEW IF EXISTS invoice_services_view;
CREATE VIEW invoice_services_view AS
SELECT
  s.id,
  s.invoice_id,
  i.invoice_number,
  i.patient_id,
  i.visit_id,
  i.issue_date,
  i.payment_status,
  s.code,
  s.description,
  s.quantity,
  s.unit_price,
  s.total_price,
  s.medical_aid_covered,
  s.patient_portion,
  s.notes,
  s.created_at
FROM
  invoice_services s
  JOIN invoices_enhanced i ON s.invoice_id = i.id;

-- Success message
SELECT 'Billing system FULLY FIXED! All tables and functions updated.' as status;
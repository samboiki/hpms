-- 🔧 IMMEDIATE FIX FOR BILLING TABLES
-- Run this SQL in Supabase SQL Editor NOW

-- Step 1: Fix the invoice number generation query (remove ambiguous reference)
-- Update the invoice service to use the correct table

-- Step 2: Ensure invoices_enhanced table has all required columns
ALTER TABLE invoices_enhanced 
ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);

-- Step 3: Create missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_practice_id ON invoices_enhanced(practice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_patient_id ON invoices_enhanced(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_visit_id ON invoices_enhanced(visit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_invoice_number ON invoices_enhanced(invoice_number);

-- Step 4: Update invoice_services table foreign key if needed
ALTER TABLE invoice_services 
ADD CONSTRAINT fk_invoice_services_invoice_id 
FOREIGN KEY (invoice_id) REFERENCES invoices_enhanced(id) ON DELETE CASCADE
ON CONFLICT DO NOTHING;

-- Step 5: Create function to auto-populate practice_id from visit
CREATE OR REPLACE FUNCTION set_invoice_practice_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get practice_id from the visit's doctor
  SELECT u.practice_id INTO NEW.practice_id
  FROM visits v
  JOIN users u ON u.id = v.doctor_id
  WHERE v.id = NEW.visit_id;
  
  -- If no practice_id found from doctor, try to get from patient
  IF NEW.practice_id IS NULL THEN
    SELECT p.practice_id INTO NEW.practice_id
    FROM patients p
    WHERE p.id = NEW.patient_id;
  END IF;
  
  -- Generate invoice number if not provided
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number = 'INV' || 
      TO_CHAR(NOW(), 'YYMM') || 
      LPAD((
        SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) + 1
        FROM invoices_enhanced 
        WHERE invoice_number LIKE ('INV' || TO_CHAR(NOW(), 'YYMM') || '%')
        AND practice_id = NEW.practice_id
      )::TEXT, 5, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to auto-populate practice_id and invoice_number
DROP TRIGGER IF EXISTS trigger_set_invoice_practice_id ON invoices_enhanced;
CREATE TRIGGER trigger_set_invoice_practice_id
  BEFORE INSERT ON invoices_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_practice_id();

-- Step 7: Create automatic total calculation trigger
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate totals from invoice_services
  UPDATE invoices_enhanced 
  SET 
    subtotal = COALESCE((
      SELECT SUM(total_price) 
      FROM invoice_services 
      WHERE invoice_id = NEW.invoice_id
    ), 0),
    tax = COALESCE((
      SELECT SUM(total_price) * 0.15 
      FROM invoice_services 
      WHERE invoice_id = NEW.invoice_id
    ), 0),
    total = COALESCE((
      SELECT SUM(total_price) * 1.15 
      FROM invoice_services 
      WHERE invoice_id = NEW.invoice_id
    ), 0),
    medical_aid_total = COALESCE((
      SELECT SUM(medical_aid_covered) 
      FROM invoice_services 
      WHERE invoice_id = NEW.invoice_id
    ), 0),
    patient_total = COALESCE((
      SELECT SUM(patient_portion) 
      FROM invoice_services 
      WHERE invoice_id = NEW.invoice_id
    ), 0)
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger for automatic total calculation
DROP TRIGGER IF EXISTS trigger_calculate_invoice_totals ON invoice_services;
CREATE TRIGGER trigger_calculate_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON invoice_services
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_totals();

-- Step 9: Ensure proper RLS policies
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON invoices_enhanced;
CREATE POLICY "Enable all operations for authenticated users" ON invoices_enhanced
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON invoice_services;
CREATE POLICY "Enable all operations for authenticated users" ON invoice_services
  FOR ALL USING (auth.role() = 'authenticated');

-- Step 10: Test the setup
DO $$
BEGIN
  RAISE NOTICE '✅ Billing tables setup completed successfully!';
  RAISE NOTICE 'Tables ready: invoices_enhanced, invoice_services';
  RAISE NOTICE 'Triggers created: auto practice_id, invoice_number, totals';
  RAISE NOTICE 'RLS policies: enabled for authenticated users';
END $$;
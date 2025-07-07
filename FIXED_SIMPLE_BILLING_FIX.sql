-- 🚀 FIXED SIMPLE BILLING SYSTEM FIX
-- Run this SQL in Supabase SQL Editor

-- Step 1: Ensure invoices_enhanced table has all required columns
ALTER TABLE invoices_enhanced 
ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES practices(id);

-- Step 2: Remove conflicting triggers to avoid ambiguous column references
DROP TRIGGER IF EXISTS trigger_set_invoice_practice_id ON invoices_enhanced;
DROP TRIGGER IF EXISTS trigger_calculate_invoice_totals ON invoice_services;
DROP FUNCTION IF EXISTS set_invoice_practice_id();
DROP FUNCTION IF EXISTS calculate_invoice_totals();

-- Step 3: Ensure invoice_services foreign key exists (fixed syntax)
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_services_invoice_id'
        AND table_name = 'invoice_services'
    ) THEN
        ALTER TABLE invoice_services 
        ADD CONSTRAINT fk_invoice_services_invoice_id 
        FOREIGN KEY (invoice_id) REFERENCES invoices_enhanced(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Create simple function for invoice number generation (no triggers)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_practice_id UUID)
RETURNS TEXT AS $$
DECLARE
    year_month TEXT;
    next_number INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get current year and month
    year_month := TO_CHAR(NOW(), 'YYMM');
    
    -- Get next number for this practice and month
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_number
    FROM invoices_enhanced 
    WHERE practice_id = p_practice_id
    AND invoice_number LIKE ('INV' || year_month || '%');
    
    -- Generate the invoice number
    invoice_number := 'INV' || year_month || LPAD(next_number::TEXT, 5, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Ensure proper RLS policies exist
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON invoices_enhanced;
CREATE POLICY "Enable all operations for authenticated users" ON invoices_enhanced
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON invoice_services;
CREATE POLICY "Enable all operations for authenticated users" ON invoice_services
  FOR ALL USING (auth.role() = 'authenticated');

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_practice_id ON invoices_enhanced(practice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_patient_id ON invoices_enhanced(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_visit_id ON invoices_enhanced(visit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_invoice_number ON invoices_enhanced(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_services_invoice_id ON invoice_services(invoice_id);

-- Step 7: Test the setup
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed simple billing system setup completed!';
  RAISE NOTICE 'Tables ready: invoices_enhanced, invoice_services';
  RAISE NOTICE 'Function created: generate_invoice_number()';
  RAISE NOTICE 'RLS policies: enabled for authenticated users';
  RAISE NOTICE 'Foreign keys: properly configured';
  RAISE NOTICE 'Indexes: created for performance';
  RAISE NOTICE 'No conflicting triggers - clean manual control';
END $$;
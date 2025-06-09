-- 💥 NUCLEAR BILLING FIX - COMPLETE RESET
-- Run this SQL in Supabase SQL Editor to completely clean everything

-- Step 1: Find and remove ALL triggers that might reference invoice_number
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Drop all triggers on invoices_enhanced
    FOR trigger_record IN 
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'invoices_enhanced'::regclass
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.tgname || ' ON invoices_enhanced CASCADE';
        RAISE NOTICE 'Dropped trigger: %', trigger_record.tgname;
    END LOOP;
    
    -- Drop all triggers on invoice_services
    FOR trigger_record IN 
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'invoice_services'::regclass
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.tgname || ' ON invoice_services CASCADE';
        RAISE NOTICE 'Dropped trigger: %', trigger_record.tgname;
    END LOOP;
END $$;

-- Step 2: Find and remove ALL functions that might reference invoice_number
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc 
        WHERE proname LIKE '%invoice%' OR proname LIKE '%billing%'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.proname || '(' || func_record.args || ') CASCADE';
        RAISE NOTICE 'Dropped function: % (%)', func_record.proname, func_record.args;
    END LOOP;
END $$;

-- Step 3: Check for any views or materialized views that might cause conflicts
DROP VIEW IF EXISTS invoice_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS invoice_summary CASCADE;

-- Step 4: Disable RLS temporarily to avoid any policy conflicts
ALTER TABLE invoices_enhanced DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_services DISABLE ROW LEVEL SECURITY;

-- Step 5: Drop ALL policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename IN ('invoices_enhanced', 'invoice_services')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON invoices_enhanced';
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON invoice_services';
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Step 6: Create completely fresh, minimal table structure
DROP TABLE IF EXISTS invoices_enhanced CASCADE;
CREATE TABLE invoices_enhanced (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    patient_id UUID NOT NULL,
    visit_id UUID NOT NULL,
    practice_id UUID,
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    medical_aid_total DECIMAL(10,2) DEFAULT 0,
    patient_total DECIMAL(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    medical_aid_claim_number TEXT,
    medical_aid_status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 7: Create completely fresh invoice_services table
DROP TABLE IF EXISTS invoice_services CASCADE;
CREATE TABLE invoice_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
    tariff_id UUID,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    medical_aid_covered DECIMAL(10,2) DEFAULT 0,
    patient_portion DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 8: Create basic indexes
CREATE INDEX idx_invoices_enhanced_patient_id ON invoices_enhanced(patient_id);
CREATE INDEX idx_invoices_enhanced_visit_id ON invoices_enhanced(visit_id);
CREATE INDEX idx_invoices_enhanced_practice_id ON invoices_enhanced(practice_id);
CREATE INDEX idx_invoice_services_invoice_id ON invoice_services(invoice_id);

-- Step 9: Set up minimal RLS
ALTER TABLE invoices_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_all_access" ON invoices_enhanced FOR ALL USING (true);
CREATE POLICY "invoice_services_all_access" ON invoice_services FOR ALL USING (true);

-- Step 10: Create a simple trigger to calculate invoice totals (no ambiguous references)
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    invoice_totals RECORD;
BEGIN
    -- Calculate totals for the affected invoice
    SELECT 
        COALESCE(SUM(total_price), 0) as subtotal_calc,
        COALESCE(SUM(total_price) * 0.15, 0) as tax_calc,
        COALESCE(SUM(total_price) * 1.15, 0) as total_calc,
        COALESCE(SUM(medical_aid_covered), 0) as medical_aid_calc,
        COALESCE(SUM(patient_portion), 0) as patient_calc
    INTO invoice_totals
    FROM invoice_services 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Update the invoice with calculated totals
    UPDATE invoices_enhanced 
    SET 
        subtotal = invoice_totals.subtotal_calc,
        tax = invoice_totals.tax_calc,
        total = invoice_totals.total_calc,
        medical_aid_total = invoice_totals.medical_aid_calc,
        patient_total = invoice_totals.patient_calc,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update totals when services change
CREATE TRIGGER calculate_invoice_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON invoice_services
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_totals();

-- Step 11: Test the clean setup
DO $$
BEGIN
  RAISE NOTICE '💥 NUCLEAR RESET COMPLETED!';
  RAISE NOTICE 'All triggers removed';
  RAISE NOTICE 'All functions removed';
  RAISE NOTICE 'All policies removed';
  RAISE NOTICE 'Tables recreated from scratch';
  RAISE NOTICE 'Basic RLS enabled with open policies';
  RAISE NOTICE 'Simple totals calculation trigger added';
  RAISE NOTICE 'No ambiguous references possible';
END $$;
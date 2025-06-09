-- 🔥 ULTRA SIMPLE BILLING FIX - NO TRIGGERS, NO FUNCTIONS
-- Run this SQL in Supabase SQL Editor

-- Step 1: Clean slate - remove ALL triggers and functions that might cause conflicts
DROP TRIGGER IF EXISTS trigger_set_invoice_practice_id ON invoices_enhanced CASCADE;
DROP TRIGGER IF EXISTS trigger_calculate_invoice_totals ON invoice_services CASCADE;
DROP FUNCTION IF EXISTS set_invoice_practice_id() CASCADE;
DROP FUNCTION IF EXISTS calculate_invoice_totals() CASCADE;
DROP FUNCTION IF EXISTS generate_invoice_number(UUID) CASCADE;

-- Step 2: Ensure basic table structure exists
ALTER TABLE invoices_enhanced 
ADD COLUMN IF NOT EXISTS practice_id UUID;

-- Step 3: Basic RLS policies (simple)
ALTER TABLE invoices_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON invoices_enhanced;
CREATE POLICY "Allow all for authenticated users" ON invoices_enhanced
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated users" ON invoice_services;  
CREATE POLICY "Allow all for authenticated users" ON invoice_services
  FOR ALL USING (auth.role() = 'authenticated');

-- Step 4: Test with a simple query
DO $$
BEGIN
  RAISE NOTICE '🔥 Ultra simple billing setup completed!';
  RAISE NOTICE 'No triggers, no functions, no complications';
  RAISE NOTICE 'Just basic tables with RLS policies';
  RAISE NOTICE 'Invoice numbers generated in JavaScript';
END $$;
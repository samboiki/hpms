-- Create billing system tables
-- This migration creates the comprehensive billing infrastructure

-- 1. Visit Services table - links services to visits
CREATE TABLE IF NOT EXISTS visit_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  tariff_id UUID NOT NULL REFERENCES practice_tariffs(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enhanced Invoices table - comprehensive invoice management
CREATE TABLE IF NOT EXISTS invoices_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  visit_id UUID NOT NULL REFERENCES visits(id),
  practice_id UUID REFERENCES practices(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  medical_aid_total DECIMAL(10,2) DEFAULT 0,
  patient_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method VARCHAR(50),
  medical_aid_claim_number VARCHAR(100),
  medical_aid_status VARCHAR(20) DEFAULT 'not_submitted' CHECK (medical_aid_status IN ('not_submitted', 'submitted', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enhanced Invoice Items table - detailed line items
CREATE TABLE IF NOT EXISTS invoice_items_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
  tariff_code_id UUID NOT NULL REFERENCES practice_tariffs(id),
  code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  medical_aid_covered BOOLEAN DEFAULT FALSE,
  medical_aid_amount DECIMAL(10,2) DEFAULT 0,
  patient_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_visit_services_visit_id ON visit_services(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_services_tariff_id ON visit_services(tariff_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_patient_id ON invoices_enhanced(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_visit_id ON invoices_enhanced(visit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_status ON invoices_enhanced(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_date ON invoices_enhanced(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_enhanced_invoice_id ON invoice_items_enhanced(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_enhanced_tariff_id ON invoice_items_enhanced(tariff_code_id);

-- Enable RLS on all tables
ALTER TABLE visit_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items_enhanced ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for visit_services
CREATE POLICY "Users can view visit services from their practice" ON visit_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = visit_services.visit_id
      AND p.practice_id = auth.jwt() ->> 'practice_id'
    )
  );

CREATE POLICY "Users can insert visit services for their practice" ON visit_services
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = visit_services.visit_id
      AND p.practice_id = auth.jwt() ->> 'practice_id'
    )
  );

-- Create RLS policies for invoices_enhanced
CREATE POLICY "Users can view invoices from their practice" ON invoices_enhanced
  FOR SELECT USING (
    practice_id = auth.jwt() ->> 'practice_id'
    OR EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = invoices_enhanced.patient_id
      AND p.practice_id = auth.jwt() ->> 'practice_id'
    )
  );

CREATE POLICY "Users can manage invoices for their practice" ON invoices_enhanced
  FOR ALL USING (
    practice_id = auth.jwt() ->> 'practice_id'
    OR EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = invoices_enhanced.patient_id
      AND p.practice_id = auth.jwt() ->> 'practice_id'
    )
  );

-- Create RLS policies for invoice_items_enhanced
CREATE POLICY "Users can view invoice items from their practice" ON invoice_items_enhanced
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices_enhanced i
      WHERE i.id = invoice_items_enhanced.invoice_id
      AND (
        i.practice_id = auth.jwt() ->> 'practice_id'
        OR EXISTS (
          SELECT 1 FROM patients p
          WHERE p.id = i.patient_id
          AND p.practice_id = auth.jwt() ->> 'practice_id'
        )
      )
    )
  );

CREATE POLICY "Users can manage invoice items for their practice" ON invoice_items_enhanced
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices_enhanced i
      WHERE i.id = invoice_items_enhanced.invoice_id
      AND (
        i.practice_id = auth.jwt() ->> 'practice_id'
        OR EXISTS (
          SELECT 1 FROM patients p
          WHERE p.id = i.patient_id
          AND p.practice_id = auth.jwt() ->> 'practice_id'
        )
      )
    )
  );

-- Insert sample data for testing
DO $$
DECLARE
  sample_patient_id UUID;
  sample_visit_id UUID;
  sample_tariff_id UUID;
  sample_invoice_id UUID;
  sample_tariff_code VARCHAR(50);
  sample_tariff_desc TEXT;
  sample_tariff_price DECIMAL(10,2);
BEGIN
  -- Get sample patient
  SELECT id INTO sample_patient_id 
  FROM patients 
  LIMIT 1;

  -- Get sample visit
  SELECT id INTO sample_visit_id 
  FROM visits 
  WHERE patient_id = sample_patient_id
  LIMIT 1;

  -- Get sample tariff
  SELECT id, code, description, price 
  INTO sample_tariff_id, sample_tariff_code, sample_tariff_desc, sample_tariff_price
  FROM practice_tariffs 
  WHERE price IS NOT NULL AND price > 0
  LIMIT 1;

  -- Only proceed if we have valid data
  IF sample_patient_id IS NOT NULL AND sample_visit_id IS NOT NULL AND sample_tariff_id IS NOT NULL THEN
    
    -- Insert sample visit service
    INSERT INTO visit_services (
      visit_id, tariff_id, quantity, unit_price, total_price, notes
    ) VALUES (
      sample_visit_id, 
      sample_tariff_id, 
      1, 
      sample_tariff_price, 
      sample_tariff_price,
      'Sample service for testing billing system'
    );

    -- Insert sample invoice
    INSERT INTO invoices_enhanced (
      invoice_number,
      patient_id,
      visit_id,
      issue_date,
      due_date,
      subtotal,
      tax,
      total,
      patient_total,
      balance_due,
      payment_status,
      notes
    ) VALUES (
      'INV' || TO_CHAR(NOW(), 'YYYYMM') || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0'),
      sample_patient_id,
      sample_visit_id,
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      sample_tariff_price,
      sample_tariff_price * 0.15,
      sample_tariff_price * 1.15,
      sample_tariff_price * 1.15,
      sample_tariff_price * 1.15,
      'pending',
      'Sample invoice for testing billing system'
    ) RETURNING id INTO sample_invoice_id;

    -- Insert sample invoice item
    INSERT INTO invoice_items_enhanced (
      invoice_id,
      tariff_code_id,
      code,
      description,
      quantity,
      unit_price,
      total_price,
      patient_amount
    ) VALUES (
      sample_invoice_id,
      sample_tariff_id,
      sample_tariff_code,
      sample_tariff_desc,
      1,
      sample_tariff_price,
      sample_tariff_price,
      sample_tariff_price
    );

  END IF;
END $$;
-- HPMS Billing System Database Migration
-- Creates comprehensive billing infrastructure for invoice generation and service tracking

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enhanced invoices table (extend existing or create new structure)
CREATE TABLE IF NOT EXISTS invoices_enhanced (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number text UNIQUE NOT NULL,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visits(id) ON DELETE SET NULL,
  practice_id uuid REFERENCES practices(id) ON DELETE CASCADE,
  
  -- Dates
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  
  -- Financial details
  subtotal decimal(10,2) NOT NULL DEFAULT 0,
  tax decimal(10,2) NOT NULL DEFAULT 0,
  total decimal(10,2) NOT NULL DEFAULT 0,
  
  -- Medical aid handling
  medical_aid_total decimal(10,2) DEFAULT 0,
  patient_total decimal(10,2) DEFAULT 0,
  medical_aid_claim_number text,
  medical_aid_status text CHECK (medical_aid_status IN ('not_submitted', 'submitted', 'approved', 'rejected', 'partial')) DEFAULT 'not_submitted',
  
  -- Payment tracking
  payment_status text CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')) NOT NULL DEFAULT 'pending',
  payment_method text CHECK (payment_method IN ('cash', 'card', 'eft', 'medical_aid', 'mixed')),
  
  -- Metadata
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enhanced invoice items table
CREATE TABLE IF NOT EXISTS invoice_items_enhanced (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
  tariff_code_id uuid REFERENCES practice_tariffs(id) ON DELETE SET NULL,
  
  -- Service details
  code text NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price decimal(10,2) NOT NULL CHECK (total_price >= 0),
  
  -- Medical aid breakdown
  medical_aid_covered boolean DEFAULT false,
  medical_aid_amount decimal(10,2) DEFAULT 0,
  patient_amount decimal(10,2) DEFAULT 0,
  
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Link services to visits (for tracking what was done during each visit)
CREATE TABLE IF NOT EXISTS visit_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  tariff_id uuid NOT NULL REFERENCES practice_tariffs(id) ON DELETE CASCADE,
  
  -- Service details
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price decimal(10,2) NOT NULL CHECK (total_price >= 0),
  
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(visit_id, tariff_id) -- Prevent duplicate services per visit
);

-- Medical aid coverage rules
CREATE TABLE IF NOT EXISTS medical_aid_coverage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  medical_aid_id uuid NOT NULL REFERENCES medical_aid_details(id) ON DELETE CASCADE,
  tariff_code text NOT NULL,
  
  -- Coverage details
  coverage_percentage decimal(5,2) NOT NULL DEFAULT 0 CHECK (coverage_percentage >= 0 AND coverage_percentage <= 100),
  max_amount decimal(10,2),
  waiting_period_days integer DEFAULT 0 CHECK (waiting_period_days >= 0),
  requires_pre_auth boolean DEFAULT false,
  
  -- Metadata
  is_active boolean DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(medical_aid_id, tariff_code, effective_from)
);

-- Payment records for detailed payment tracking
CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
  
  -- Payment details
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'eft', 'medical_aid')),
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Reference information
  reference text, -- Transaction reference, check number, etc.
  notes text,
  processed_by text NOT NULL, -- User who processed the payment
  
  created_at timestamp with time zone DEFAULT now()
);

-- Practice billing settings
CREATE TABLE IF NOT EXISTS practice_billing_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id uuid UNIQUE NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  
  -- Tax settings
  tax_rate decimal(5,2) NOT NULL DEFAULT 15.00 CHECK (tax_rate >= 0),
  tax_registration_number text,
  
  -- Invoice settings
  invoice_prefix text DEFAULT 'INV',
  payment_terms_days integer DEFAULT 30 CHECK (payment_terms_days > 0),
  auto_generate_invoices boolean DEFAULT true,
  require_payment_on_service boolean DEFAULT false,
  
  -- Medical aid settings
  accept_medical_aid boolean DEFAULT true,
  submit_claims_electronically boolean DEFAULT false,
  
  -- Communication settings
  email_invoices boolean DEFAULT true,
  sms_payment_reminders boolean DEFAULT true,
  late_fees_enabled boolean DEFAULT false,
  late_fee_percentage decimal(5,2) DEFAULT 5.00,
  grace_period_days integer DEFAULT 7,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add missing columns to existing practice_tariffs table if needed
ALTER TABLE practice_tariffs 
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'per_visit' CHECK (unit IN ('per_visit', 'per_tooth', 'per_treatment', 'per_film', 'per_surface')),
ADD COLUMN IF NOT EXISTS complexity text DEFAULT 'moderate' CHECK (complexity IN ('simple', 'moderate', 'complex')),
ADD COLUMN IF NOT EXISTS requires_pre_auth boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS medical_aid_code text,
ADD COLUMN IF NOT EXISTS notes text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_patient ON invoices_enhanced(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_visit ON invoices_enhanced(visit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_practice ON invoices_enhanced(practice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_status ON invoices_enhanced(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_date ON invoices_enhanced(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_number ON invoices_enhanced(invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoice_items_enhanced_invoice ON invoice_items_enhanced(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_enhanced_tariff ON invoice_items_enhanced(tariff_code_id);

CREATE INDEX IF NOT EXISTS idx_visit_services_visit ON visit_services(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_services_tariff ON visit_services(tariff_id);

CREATE INDEX IF NOT EXISTS idx_medical_aid_coverage_aid ON medical_aid_coverage(medical_aid_id);
CREATE INDEX IF NOT EXISTS idx_medical_aid_coverage_code ON medical_aid_coverage(tariff_code);
CREATE INDEX IF NOT EXISTS idx_medical_aid_coverage_active ON medical_aid_coverage(is_active);

CREATE INDEX IF NOT EXISTS idx_payment_records_invoice ON payment_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_date ON payment_records(payment_date);

-- Add updated_at trigger for tables that need it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_invoices_enhanced_updated_at ON invoices_enhanced;
CREATE TRIGGER update_invoices_enhanced_updated_at 
    BEFORE UPDATE ON invoices_enhanced 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medical_aid_coverage_updated_at ON medical_aid_coverage;
CREATE TRIGGER update_medical_aid_coverage_updated_at 
    BEFORE UPDATE ON medical_aid_coverage 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_practice_billing_settings_updated_at ON practice_billing_settings;
CREATE TRIGGER update_practice_billing_settings_updated_at 
    BEFORE UPDATE ON practice_billing_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE invoices_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_aid_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_billing_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices_enhanced
CREATE POLICY "Users can view invoices for their practice" ON invoices_enhanced
    FOR SELECT USING (
        practice_id IN (
            SELECT practice_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create invoices for their practice" ON invoices_enhanced
    FOR INSERT WITH CHECK (
        practice_id IN (
            SELECT practice_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update invoices for their practice" ON invoices_enhanced
    FOR UPDATE USING (
        practice_id IN (
            SELECT practice_id FROM users WHERE id = auth.uid()
        )
    );

-- RLS Policies for invoice_items_enhanced
CREATE POLICY "Users can view invoice items for their practice" ON invoice_items_enhanced
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM invoices_enhanced WHERE practice_id IN (
                SELECT practice_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create invoice items for their practice" ON invoice_items_enhanced
    FOR INSERT WITH CHECK (
        invoice_id IN (
            SELECT id FROM invoices_enhanced WHERE practice_id IN (
                SELECT practice_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- RLS Policies for visit_services
CREATE POLICY "Users can view visit services for their practice" ON visit_services
    FOR SELECT USING (
        visit_id IN (
            SELECT v.id FROM visits v
            JOIN patients p ON v.patient_id = p.id
            WHERE p.practice_id IN (
                SELECT practice_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create visit services for their practice" ON visit_services
    FOR INSERT WITH CHECK (
        visit_id IN (
            SELECT v.id FROM visits v
            JOIN patients p ON v.patient_id = p.id
            WHERE p.practice_id IN (
                SELECT practice_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- RLS Policies for medical_aid_coverage  
CREATE POLICY "Users can view medical aid coverage for their practice" ON medical_aid_coverage
    FOR SELECT USING (
        medical_aid_id IN (
            SELECT mad.id FROM medical_aid_details mad
            JOIN patients p ON mad.patient_id = p.id
            WHERE p.practice_id IN (
                SELECT practice_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- RLS Policies for payment_records
CREATE POLICY "Users can view payment records for their practice" ON payment_records
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM invoices_enhanced WHERE practice_id IN (
                SELECT practice_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create payment records for their practice" ON payment_records
    FOR INSERT WITH CHECK (
        invoice_id IN (
            SELECT id FROM invoices_enhanced WHERE practice_id IN (
                SELECT practice_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- RLS Policies for practice_billing_settings
CREATE POLICY "Users can view billing settings for their practice" ON practice_billing_settings
    FOR SELECT USING (
        practice_id IN (
            SELECT practice_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update billing settings for their practice" ON practice_billing_settings
    FOR ALL USING (
        practice_id IN (
            SELECT practice_id FROM users WHERE id = auth.uid()
        )
    );

-- Insert default billing settings for existing practices
INSERT INTO practice_billing_settings (practice_id)
SELECT id FROM practices 
WHERE id NOT IN (SELECT practice_id FROM practice_billing_settings);

-- Create a view for comprehensive invoice details
CREATE OR REPLACE VIEW invoice_details AS
SELECT 
    i.*,
    p.first_name || ' ' || p.last_name as patient_name,
    p.cell_number as patient_phone,
    p.email as patient_email,
    v.visit_date,
    v.diagnosis,
    pr.name as practice_name,
    pr.email as practice_email,
    pr.phone as practice_phone,
    array_agg(
        json_build_object(
            'code', ii.code,
            'description', ii.description,
            'quantity', ii.quantity,
            'unit_price', ii.unit_price,
            'total_price', ii.total_price,
            'medical_aid_amount', ii.medical_aid_amount,
            'patient_amount', ii.patient_amount
        )
    ) as invoice_items,
    COALESCE(SUM(pr_rec.amount), 0) as amount_paid,
    i.total - COALESCE(SUM(pr_rec.amount), 0) as amount_due
FROM invoices_enhanced i
LEFT JOIN patients p ON i.patient_id = p.id
LEFT JOIN visits v ON i.visit_id = v.id
LEFT JOIN practices pr ON i.practice_id = pr.id
LEFT JOIN invoice_items_enhanced ii ON i.id = ii.invoice_id
LEFT JOIN payment_records pr_rec ON i.id = pr_rec.invoice_id
GROUP BY i.id, p.first_name, p.last_name, p.cell_number, p.email, 
         v.visit_date, v.diagnosis, pr.name, pr.email, pr.phone;

-- Add helpful comments
COMMENT ON TABLE invoices_enhanced IS 'Enhanced invoice tracking with medical aid integration';
COMMENT ON TABLE invoice_items_enhanced IS 'Individual line items for each invoice';
COMMENT ON TABLE visit_services IS 'Links services provided to specific visits';
COMMENT ON TABLE medical_aid_coverage IS 'Defines coverage rules for medical aid schemes';
COMMENT ON TABLE payment_records IS 'Tracks all payments made against invoices';
COMMENT ON TABLE practice_billing_settings IS 'Configurable billing settings per practice';
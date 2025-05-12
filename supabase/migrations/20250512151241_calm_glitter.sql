/*
  # Add visits and invoices tables

  1. New Tables
    - visits: Track patient consultations and medical visits
    - invoices: Handle billing and payments
    - invoice_items: Store individual line items for invoices

  2. Features
    - Automatic invoice number generation (format: INVYYMMxxxx)
    - Medical aid integration
    - Visit tracking with diagnosis and treatment
    
  3. Security
    - RLS enabled on all tables
    - Policies for authenticated staff access
*/

-- Visits table
CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  visit_date date NOT NULL,
  visit_time time NOT NULL,
  visit_type text NOT NULL CHECK (visit_type IN ('consultation', 'follow-up', 'procedure', 'emergency')),
  chief_complaint text,
  diagnosis text,
  treatment_plan text,
  prescription text,
  follow_up_required boolean DEFAULT false,
  follow_up_date date,
  notes text,
  status text NOT NULL CHECK (status IN ('in-progress', 'completed', 'cancelled')) DEFAULT 'in-progress',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Invoices table
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number text UNIQUE NOT NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visits(id) ON DELETE SET NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  tax decimal(10,2) NOT NULL DEFAULT 0,
  total decimal(10,2) NOT NULL,
  payment_status text NOT NULL CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')) DEFAULT 'pending',
  payment_method text CHECK (payment_method IN ('cash', 'card', 'bank-transfer', 'medical-aid')),
  medical_aid_claim_number text,
  medical_aid_status text CHECK (medical_aid_status IN ('not-submitted', 'submitted', 'in-progress', 'approved', 'rejected')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Invoice items table
CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total decimal(10,2) NOT NULL,
  medical_aid_code text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_visit_datetime ON visits(visit_date, visit_time);
CREATE INDEX idx_visit_patient ON visits(patient_id);
CREATE INDEX idx_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoice_patient ON invoices(patient_id);
CREATE INDEX idx_invoice_status ON invoices(payment_status);

-- Enable RLS
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can view all visits" ON visits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert visits" ON visits
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update visits" ON visits
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Staff can view all invoices" ON invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert invoices" ON invoices
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update invoices" ON invoices
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Staff can manage invoice items" ON invoice_items
  FOR ALL TO authenticated USING (true);

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS trigger AS $$
DECLARE
  year TEXT;
  month TEXT;
  sequence INT;
  invoice_number TEXT;
BEGIN
  year := to_char(CURRENT_DATE, 'YY');
  month := to_char(CURRENT_DATE, 'MM');
  
  SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM 7)::integer), 0) + 1
  INTO sequence
  FROM invoices
  WHERE invoice_number LIKE concat('INV', year, month, '%');
  
  NEW.invoice_number := concat('INV', year, month, LPAD(sequence::text, 4, '0'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate invoice numbers
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();
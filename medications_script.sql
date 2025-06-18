-- Medications tracking table for HPMS
-- Run this script in Supabase SQL Editor to create the medications table

-- Create medications table
CREATE TABLE IF NOT EXISTS medications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  prescribed_by uuid REFERENCES auth.users(id),
  prescribed_date timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued', 'cancelled')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medications_visit_id ON medications(visit_id);
CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_prescribed_by ON medications(prescribed_by);
CREATE INDEX IF NOT EXISTS idx_medications_status ON medications(status);
CREATE INDEX IF NOT EXISTS idx_medications_prescribed_date ON medications(prescribed_date);

-- Enable Row Level Security (RLS)
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view medications for patients they have access to
CREATE POLICY "Users can view medications for accessible patients" ON medications
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      -- Doctors and admins can see all medications
      (SELECT role FROM users WHERE id = auth.uid()) IN ('doctor', 'admin') OR
      -- Nurses and receptionists can see medications for patients in their practice
      EXISTS (
        SELECT 1 FROM patients p 
        JOIN users u ON u.practice_id = p.practice_id 
        WHERE p.id = medications.patient_id 
        AND u.id = auth.uid()
      )
    )
  );

-- Users can insert medications for patients they have access to
CREATE POLICY "Users can insert medications for accessible patients" ON medications
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND (
      -- Only doctors can prescribe medications
      (SELECT role FROM users WHERE id = auth.uid()) IN ('doctor', 'admin') AND
      EXISTS (
        SELECT 1 FROM patients p 
        JOIN users u ON u.practice_id = p.practice_id 
        WHERE p.id = medications.patient_id 
        AND u.id = auth.uid()
      )
    )
  );

-- Users can update medications they prescribed or have access to
CREATE POLICY "Users can update medications for accessible patients" ON medications
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      -- Prescriber can update their own prescriptions
      prescribed_by = auth.uid() OR
      -- Doctors and admins can update any medication in their practice
      (
        (SELECT role FROM users WHERE id = auth.uid()) IN ('doctor', 'admin') AND
        EXISTS (
          SELECT 1 FROM patients p 
          JOIN users u ON u.practice_id = p.practice_id 
          WHERE p.id = medications.patient_id 
          AND u.id = auth.uid()
        )
      )
    )
  );

-- Users can delete medications they prescribed or have admin access
CREATE POLICY "Users can delete medications for accessible patients" ON medications
  FOR DELETE USING (
    auth.role() = 'authenticated' AND (
      -- Prescriber can delete their own prescriptions
      prescribed_by = auth.uid() OR
      -- Only admins can delete any medication
      (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_medications_updated_at 
  BEFORE UPDATE ON medications 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional - remove in production)
-- This is just for testing purposes
/*
INSERT INTO medications (visit_id, patient_id, medication_name, dosage, frequency, duration, instructions, prescribed_by, status) 
VALUES 
  (
    (SELECT id FROM visits LIMIT 1),
    (SELECT patient_id FROM visits LIMIT 1),
    'Amoxicillin',
    '500mg',
    '3 times daily',
    '7 days',
    'Take with food to reduce stomach upset',
    (SELECT id FROM auth.users WHERE email LIKE '%doctor%' LIMIT 1),
    'active'
  ),
  (
    (SELECT id FROM visits LIMIT 1),
    (SELECT patient_id FROM visits LIMIT 1),
    'Paracetamol',
    '1000mg',
    'Every 6 hours as needed',
    '5 days',
    'Do not exceed 4g per day',
    (SELECT id FROM auth.users WHERE email LIKE '%doctor%' LIMIT 1),
    'active'
  );
*/

-- Grant necessary permissions
GRANT ALL ON medications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE medications IS 'Stores prescribed medications for patients during visits';
COMMENT ON COLUMN medications.id IS 'Unique identifier for the medication record';
COMMENT ON COLUMN medications.visit_id IS 'Reference to the visit when this medication was prescribed';
COMMENT ON COLUMN medications.patient_id IS 'Reference to the patient who was prescribed this medication';
COMMENT ON COLUMN medications.medication_name IS 'Name of the prescribed medication';
COMMENT ON COLUMN medications.dosage IS 'Dosage amount (e.g., 500mg, 10ml)';
COMMENT ON COLUMN medications.frequency IS 'How often to take the medication (e.g., 3 times daily, every 6 hours)';
COMMENT ON COLUMN medications.duration IS 'How long to take the medication (e.g., 7 days, 2 weeks)';
COMMENT ON COLUMN medications.instructions IS 'Special instructions (e.g., take with food, avoid alcohol)';
COMMENT ON COLUMN medications.prescribed_by IS 'Reference to the doctor who prescribed the medication';
COMMENT ON COLUMN medications.prescribed_date IS 'When the medication was prescribed';
COMMENT ON COLUMN medications.status IS 'Current status of the prescription (active, completed, discontinued, cancelled)';
COMMENT ON COLUMN medications.notes IS 'Additional notes about the medication';

-- Create a view for easier querying with doctor and patient names
CREATE OR REPLACE VIEW medications_with_details AS
SELECT 
  m.*,
  p.first_name || ' ' || p.last_name AS patient_name,
  u.email AS prescribed_by_email,
  v.visit_date,
  v.visit_type
FROM medications m
LEFT JOIN patients p ON m.patient_id = p.id
LEFT JOIN auth.users u ON m.prescribed_by = u.id
LEFT JOIN visits v ON m.visit_id = v.id;

-- Grant access to the view
GRANT SELECT ON medications_with_details TO authenticated;

COMMENT ON VIEW medications_with_details IS 'View that includes patient and prescriber details with medication records';
/*
  # Create Lab Tests and Sample Data

  1. New Tables
    - `lab_tests`
      - Test details and results for patients
      - Links to medical records
    - `vitals`
      - Patient vital signs per visit
      - Tracks key health metrics

  2. Sample Data
    - Add lab tests for existing patients
    - Add vitals records for visits
*/

-- Create lab tests table
CREATE TABLE lab_tests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  medical_record_id uuid REFERENCES medical_records(id) ON DELETE CASCADE,
  test_name text NOT NULL,
  test_type text NOT NULL,
  test_date date NOT NULL,
  result_value text NOT NULL,
  unit text,
  reference_range text,
  status text NOT NULL CHECK (status IN ('normal', 'high', 'low', 'critical')),
  ordered_by uuid REFERENCES users(id) ON DELETE SET NULL,
  lab_notes text,
  created_at timestamptz DEFAULT now()
);

-- Create vitals table
CREATE TABLE vitals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  blood_pressure text,
  temperature numeric(4,1),
  pulse_rate integer,
  respiratory_rate integer,
  weight numeric(5,2),
  height numeric(5,2),
  bmi numeric(4,1),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can view all lab tests"
  ON lab_tests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage lab tests"
  ON lab_tests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can view all vitals"
  ON vitals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage vitals"
  ON vitals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert sample lab tests
INSERT INTO lab_tests (patient_id, test_name, test_type, test_date, result_value, unit, reference_range, status, lab_notes) VALUES
  ('03dd4f09-67a8-4796-8e72-9f6356160178', 'Complete Blood Count', 'hematology', '2024-03-01', '14.2', 'g/dL', '12.0-16.0', 'normal', 'Regular checkup'),
  ('03dd4f09-67a8-4796-8e72-9f6356160178', 'Blood Glucose', 'chemistry', '2024-03-01', '142', 'mg/dL', '70-140', 'high', 'Fasting blood sugar'),
  ('2a2136ad-7af7-47d0-b431-7dcef3411859', 'Lipid Panel', 'chemistry', '2024-02-15', '190', 'mg/dL', '<200', 'normal', 'Annual checkup'),
  ('327925ed-6d7d-4464-8581-5a6fae75931e', 'Thyroid Function', 'endocrinology', '2024-02-20', '3.2', 'mIU/L', '0.4-4.0', 'normal', 'Routine screening'),
  ('d09ad54c-b7df-4c1f-b11b-994048aa730b', 'Liver Function', 'chemistry', '2024-03-05', '45', 'U/L', '7-56', 'normal', 'Comprehensive metabolic panel');

-- Insert sample visits
INSERT INTO visits (patient_id, visit_date, visit_time, visit_type, chief_complaint, status) VALUES
  ('03dd4f09-67a8-4796-8e72-9f6356160178', '2024-03-01', '09:00', 'consultation', 'Annual checkup', 'completed'),
  ('2a2136ad-7af7-47d0-b431-7dcef3411859', '2024-02-15', '10:30', 'consultation', 'Routine follow-up', 'completed'),
  ('327925ed-6d7d-4464-8581-5a6fae75931e', '2024-02-20', '14:15', 'consultation', 'Thyroid evaluation', 'completed'),
  ('d09ad54c-b7df-4c1f-b11b-994048aa730b', '2024-03-05', '11:00', 'consultation', 'General checkup', 'completed');

-- Insert sample vitals
INSERT INTO vitals (visit_id, blood_pressure, temperature, pulse_rate, respiratory_rate, weight, height, bmi) 
SELECT 
  v.id,
  '120/80',
  37.0,
  72,
  16,
  70.5,
  170.0,
  24.4
FROM visits v;

-- Create indexes
CREATE INDEX idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX idx_lab_tests_date ON lab_tests(test_date);
CREATE INDEX idx_vitals_visit ON vitals(visit_id);
-- Drop existing tables to recreate with new structure
DROP TABLE IF EXISTS lab_results CASCADE;
DROP TABLE IF EXISTS lab_requests CASCADE;

-- Create simplified lab_requests table (just the request metadata)
CREATE TABLE public.lab_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  visit_id uuid NULL,
  practice_id uuid NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  preferred_date date NULL,
  lab_facility text NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes text NULL,
  media_url text NULL,
  media_type text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  
  PRIMARY KEY (id),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
  FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE SET NULL
);

-- Create lab_results table (individual test results)
CREATE TABLE public.lab_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_request_id uuid NOT NULL,
  test_name text NOT NULL,
  test_value text NOT NULL,
  test_unit text NULL,
  reference_range text NULL,
  status text NULL CHECK (status IN ('normal', 'high', 'low', 'critical')),
  created_at timestamp with time zone NULL DEFAULT now(),
  
  PRIMARY KEY (id),
  FOREIGN KEY (lab_request_id) REFERENCES lab_requests(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_lab_requests_patient_id ON lab_requests(patient_id);
CREATE INDEX idx_lab_requests_visit_id ON lab_requests(visit_id);
CREATE INDEX idx_lab_requests_status ON lab_requests(status);
CREATE INDEX idx_lab_results_lab_request_id ON lab_results(lab_request_id);

-- Enable RLS
ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for lab_requests
CREATE POLICY "Authenticated users can view lab requests"
  ON lab_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create lab requests"
  ON lab_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lab requests"
  ON lab_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lab requests"
  ON lab_requests FOR DELETE
  TO authenticated
  USING (true);

-- RLS policies for lab_results
CREATE POLICY "Authenticated users can view lab results"
  ON lab_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create lab results"
  ON lab_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lab results"
  ON lab_results FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lab results"
  ON lab_results FOR DELETE
  TO authenticated
  USING (true);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_lab_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_lab_requests_updated_at
  BEFORE UPDATE ON lab_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_requests_updated_at();

-- Add comments
COMMENT ON TABLE lab_requests IS 'Simplified lab requests - just metadata';
COMMENT ON TABLE lab_results IS 'Individual test results extracted from lab documents';
COMMENT ON COLUMN lab_requests.preferred_date IS 'Expected date for lab results';
COMMENT ON COLUMN lab_results.test_name IS 'Name of the test/investigation';
COMMENT ON COLUMN lab_results.test_value IS 'The result value';
COMMENT ON COLUMN lab_results.test_unit IS 'Unit of measurement';
COMMENT ON COLUMN lab_results.reference_range IS 'Normal reference range';
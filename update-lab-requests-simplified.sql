-- Drop existing lab_requests table to recreate with new simplified structure
DROP TABLE IF EXISTS lab_requests CASCADE;

-- Create simplified lab_requests table
CREATE TABLE public.lab_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  visit_id uuid NULL,
  practice_id uuid NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status IN ('pending', 'completed', 'cancelled')),
  test_name text NOT NULL,
  test_value text NULL,
  test_unit text NULL,
  reference_range text NULL,
  lab_facility text NULL,
  preferred_date date NULL,
  notes text NULL,
  completed_date date NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  completed_at timestamp with time zone NULL,
  
  -- Add media fields for uploaded files
  media_url text NULL,
  media_type text NULL,
  ai_extraction_data jsonb NULL,
  ai_extraction_error text NULL,
  
  PRIMARY KEY (id),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
  FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_lab_requests_patient_id ON lab_requests(patient_id);
CREATE INDEX idx_lab_requests_visit_id ON lab_requests(visit_id);
CREATE INDEX idx_lab_requests_status ON lab_requests(status);
CREATE INDEX idx_lab_requests_request_date ON lab_requests(request_date);

-- Enable RLS
ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lab_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
    NEW.completed_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_lab_requests_updated_at
  BEFORE UPDATE ON lab_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_requests_updated_at();

-- Add comments for clarity
COMMENT ON TABLE lab_requests IS 'Simplified lab requests table focusing on test results';
COMMENT ON COLUMN lab_requests.test_name IS 'Name of the lab test/investigation';
COMMENT ON COLUMN lab_requests.test_value IS 'The result value of the test';
COMMENT ON COLUMN lab_requests.test_unit IS 'Unit of measurement (e.g., mg/dL, mmol/L)';
COMMENT ON COLUMN lab_requests.reference_range IS 'Normal reference range for the test';
COMMENT ON COLUMN lab_requests.media_url IS 'URL to uploaded lab result document/image';
COMMENT ON COLUMN lab_requests.ai_extraction_data IS 'JSON data from AI extraction';
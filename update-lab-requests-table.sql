-- Drop the existing lab_requests table if it exists
DROP TABLE IF EXISTS public.lab_requests CASCADE;

-- Create the new simplified lab_requests table
CREATE TABLE public.lab_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  visit_id uuid NULL,
  practice_id uuid NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending'::text,
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
  
  -- Constraints
  CONSTRAINT lab_requests_pkey PRIMARY KEY (id),
  CONSTRAINT lab_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT lab_requests_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  CONSTRAINT lab_requests_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_lab_requests_patient_id ON public.lab_requests(patient_id);
CREATE INDEX idx_lab_requests_visit_id ON public.lab_requests(visit_id);
CREATE INDEX idx_lab_requests_practice_id ON public.lab_requests(practice_id);
CREATE INDEX idx_lab_requests_status ON public.lab_requests(status);
CREATE INDEX idx_lab_requests_request_date ON public.lab_requests(request_date);

-- Add RLS policies
ALTER TABLE public.lab_requests ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view all lab requests
CREATE POLICY "Authenticated users can view lab requests" ON public.lab_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert lab requests
CREATE POLICY "Authenticated users can insert lab requests" ON public.lab_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated users to update lab requests
CREATE POLICY "Authenticated users can update lab requests" ON public.lab_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users to delete lab requests
CREATE POLICY "Authenticated users can delete lab requests" ON public.lab_requests
  FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lab_requests_updated_at
  BEFORE UPDATE ON public.lab_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.lab_requests IS 'Simplified lab requests table for storing test results extracted from uploaded documents';
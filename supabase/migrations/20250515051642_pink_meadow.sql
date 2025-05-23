/*
  # Add Request Tracking for Lab Results and Medical Media

  1. New Tables
    - `lab_requests`
      - Tracks pending and in-progress lab test requests
      - Links to visits and lab_results
      - Includes status tracking and expected completion dates
    
    - `media_requests` 
      - Tracks pending and in-progress medical imaging requests
      - Links to visits and visit_media
      - Includes status tracking and expected completion dates

  2. Changes
    - Added status tracking and notification preferences
    - Added expected completion dates
    - Added request priority levels
    - Added referring department information

  3. Indexes
    - Added indexes for efficient querying by status and dates
    - Added indexes for visit relationships
*/

-- Create lab_requests table
CREATE TABLE IF NOT EXISTS lab_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  test_name text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('routine', 'urgent', 'stat')),
  status text NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  requesting_doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz DEFAULT now(),
  expected_completion_date timestamptz,
  completed_at timestamptz,
  notes text,
  notify_on_completion boolean DEFAULT true,
  lab_result_id uuid REFERENCES lab_results(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create media_requests table
CREATE TABLE IF NOT EXISTS media_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('xray', 'ct', 'mri', 'ultrasound')),
  body_part text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('routine', 'urgent', 'stat')),
  status text NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  requesting_doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz DEFAULT now(),
  expected_completion_date timestamptz,
  completed_at timestamptz,
  notes text,
  notify_on_completion boolean DEFAULT true,
  media_result_id uuid REFERENCES visit_media(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_lab_requests_status ON lab_requests(status);
CREATE INDEX idx_lab_requests_priority ON lab_requests(priority);
CREATE INDEX idx_lab_requests_completion ON lab_requests(expected_completion_date);
CREATE INDEX idx_lab_requests_visit ON lab_requests(visit_id);

CREATE INDEX idx_media_requests_status ON media_requests(status);
CREATE INDEX idx_media_requests_priority ON media_requests(priority);
CREATE INDEX idx_media_requests_completion ON media_requests(expected_completion_date);
CREATE INDEX idx_media_requests_visit ON media_requests(visit_id);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_lab_requests_updated_at
    BEFORE UPDATE ON lab_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_requests_updated_at
    BEFORE UPDATE ON media_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add dashboard view for pending requests
CREATE OR REPLACE VIEW pending_requests_view AS
SELECT 
  'lab' as request_type,
  lr.id,
  lr.visit_id,
  lr.test_name as description,
  lr.priority,
  lr.status,
  lr.requesting_doctor_id,
  lr.requested_at,
  lr.expected_completion_date,
  v.patient_id,
  p.first_name || ' ' || p.last_name as patient_name,
  u.full_name as doctor_name
FROM lab_requests lr
JOIN visits v ON lr.visit_id = v.id
JOIN patients p ON v.patient_id = p.id
JOIN users u ON lr.requesting_doctor_id = u.id
WHERE lr.status IN ('pending', 'in-progress')

UNION ALL

SELECT 
  'media' as request_type,
  mr.id,
  mr.visit_id,
  mr.type || ' - ' || mr.body_part as description,
  mr.priority,
  mr.status,
  mr.requesting_doctor_id,
  mr.requested_at,
  mr.expected_completion_date,
  v.patient_id,
  p.first_name || ' ' || p.last_name as patient_name,
  u.full_name as doctor_name
FROM media_requests mr
JOIN visits v ON mr.visit_id = v.id
JOIN patients p ON v.patient_id = p.id
JOIN users u ON mr.requesting_doctor_id = u.id
WHERE mr.status IN ('pending', 'in-progress');

COMMENT ON VIEW pending_requests_view IS 'Consolidated view of all pending lab and media requests';
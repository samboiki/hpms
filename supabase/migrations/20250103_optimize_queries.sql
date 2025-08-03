-- Create optimized function for getting patient visit counts
CREATE OR REPLACE FUNCTION get_patient_visit_counts(patient_ids uuid[])
RETURNS TABLE (
  patient_id uuid,
  visit_count bigint,
  last_visit_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.patient_id,
    COUNT(*)::bigint as visit_count,
    MAX(v.visit_date) as last_visit_date
  FROM visits v
  WHERE v.patient_id = ANY(patient_ids)
  GROUP BY v.patient_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON visits(patient_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_practice_date ON visits(practice_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_practice_date ON appointments(practice_id, date);
CREATE INDEX IF NOT EXISTS idx_patients_practice_name ON patients(practice_id, last_name, first_name);

-- Create materialized view for patient statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS patient_visit_stats AS
SELECT 
  p.id as patient_id,
  p.practice_id,
  COUNT(v.id) as total_visits,
  MAX(v.visit_date) as last_visit_date,
  COUNT(CASE WHEN v.status = 'completed' THEN 1 END) as completed_visits,
  COUNT(CASE WHEN v.visit_date >= CURRENT_DATE - INTERVAL '6 months' THEN 1 END) as recent_visits
FROM patients p
LEFT JOIN visits v ON p.id = v.patient_id
GROUP BY p.id, p.practice_id;

-- Create index on materialized view
CREATE INDEX idx_patient_visit_stats_practice ON patient_visit_stats(practice_id);

-- Create function to refresh stats (can be called periodically)
CREATE OR REPLACE FUNCTION refresh_patient_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY patient_visit_stats;
END;
$$ LANGUAGE plpgsql;

-- Fix the RPC function that was causing errors
DROP FUNCTION IF EXISTS get_patients_with_full_data(uuid);

CREATE OR REPLACE FUNCTION get_patients_with_full_data(p_practice_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  gender text,
  id_number text,
  cell_number text,
  email text,
  practice_id uuid,
  medical_aid_provider_name text,
  membership_number text,
  visit_count bigint,
  last_visit_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.gender,
    p.id_number,
    p.cell_number,
    p.email,
    p.practice_id,
    map.name as medical_aid_provider_name,
    mad.membership_number,
    COALESCE(pvs.total_visits, 0)::bigint as visit_count,
    pvs.last_visit_date
  FROM patients p
  LEFT JOIN medical_aid_details mad ON mad.patient_id = p.id
  LEFT JOIN medical_aid_providers map ON map.id = mad.medical_aid_provider_id
  LEFT JOIN patient_visit_stats pvs ON pvs.patient_id = p.id
  WHERE p.practice_id = p_practice_id
  ORDER BY p.last_name, p.first_name;
END;
$$ LANGUAGE plpgsql STABLE;
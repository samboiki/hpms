-- Create an optimized view for appointments/visits that combines frequently accessed data
-- This reduces the number of joins and improves query performance

-- First, let's create indexes on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_visits_practice_date ON visits(practice_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date_time ON visits(scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_is_cancelled ON visits(is_cancelled);
CREATE INDEX IF NOT EXISTS idx_visits_is_confirmed ON visits(is_confirmed);

-- Create indexes on appointments table if it exists
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(date, time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Create a materialized view for today's appointments that refreshes periodically
CREATE MATERIALIZED VIEW IF NOT EXISTS today_visits_view AS
SELECT 
  v.id,
  v.patient_id,
  v.doctor_id,
  v.practice_id,
  v.scheduled_date,
  v.scheduled_time,
  v.visit_date,
  v.visit_time,
  v.visit_type,
  v.chief_complaint,
  v.status,
  v.is_scheduled,
  v.is_confirmed,
  v.is_checked_in,
  v.is_ready,
  v.is_cancelled,
  v.notes,
  v.created_at,
  v.updated_at,
  -- Patient data
  p.first_name as patient_first_name,
  p.last_name as patient_last_name,
  p.cell_number as patient_cell_number,
  p.email as patient_email,
  p.date_of_birth as patient_date_of_birth,
  -- Doctor data
  u.full_name as doctor_full_name,
  u.role as doctor_role
FROM visits v
LEFT JOIN patients p ON v.patient_id = p.id
LEFT JOIN users u ON v.doctor_id = u.id
WHERE v.scheduled_date = CURRENT_DATE
  AND v.practice_id IS NOT NULL
ORDER BY v.scheduled_time ASC;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX idx_today_visits_view_id ON today_visits_view(id);
CREATE INDEX idx_today_visits_view_practice ON today_visits_view(practice_id);
CREATE INDEX idx_today_visits_view_status ON today_visits_view(status);

-- Create a function to refresh the view
CREATE OR REPLACE FUNCTION refresh_today_visits_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY today_visits_view;
END;
$$ LANGUAGE plpgsql;

-- Set up automatic refresh every 5 minutes using pg_cron (if available)
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('refresh-today-visits', '*/5 * * * *', 'SELECT refresh_today_visits_view();');

-- Create an optimized function to get appointments with pagination
CREATE OR REPLACE FUNCTION get_appointments_optimized(
  p_practice_id UUID,
  p_date DATE DEFAULT NULL,
  p_doctor_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  doctor_id UUID,
  scheduled_date DATE,
  scheduled_time TIME,
  visit_type TEXT,
  status TEXT,
  is_confirmed BOOLEAN,
  is_cancelled BOOLEAN,
  patient_name TEXT,
  patient_phone TEXT,
  doctor_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.patient_id,
    v.doctor_id,
    v.scheduled_date,
    v.scheduled_time,
    v.visit_type,
    v.status,
    v.is_confirmed,
    v.is_cancelled,
    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
    p.cell_number as patient_phone,
    u.full_name as doctor_name
  FROM visits v
  LEFT JOIN patients p ON v.patient_id = p.id
  LEFT JOIN users u ON v.doctor_id = u.id
  WHERE v.practice_id = p_practice_id
    AND (p_date IS NULL OR v.scheduled_date = p_date)
    AND (p_doctor_id IS NULL OR v.doctor_id = p_doctor_id)
    AND (p_status IS NULL OR v.status = p_status)
  ORDER BY v.scheduled_date DESC, v.scheduled_time DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get appointment statistics efficiently
CREATE OR REPLACE FUNCTION get_appointment_stats(
  p_practice_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_appointments INT,
  confirmed_count INT,
  pending_count INT,
  completed_count INT,
  cancelled_count INT,
  no_show_count INT,
  in_progress_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INT as total_appointments,
    COUNT(*) FILTER (WHERE is_confirmed = true AND is_cancelled = false)::INT as confirmed_count,
    COUNT(*) FILTER (WHERE is_scheduled = true AND is_confirmed = false AND is_cancelled = false)::INT as pending_count,
    COUNT(*) FILTER (WHERE status = 'completed')::INT as completed_count,
    COUNT(*) FILTER (WHERE is_cancelled = true OR status = 'cancelled')::INT as cancelled_count,
    COUNT(*) FILTER (WHERE status = 'no-show')::INT as no_show_count,
    COUNT(*) FILTER (WHERE status = 'in-progress')::INT as in_progress_count
  FROM visits
  WHERE practice_id = p_practice_id
    AND scheduled_date = p_date;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT ON today_visits_view TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_today_visits_view() TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointments_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointment_stats TO authenticated;
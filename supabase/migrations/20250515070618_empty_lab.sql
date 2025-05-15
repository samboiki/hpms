/*
  # Create Views for Visit Information

  1. New Views
    - visit_details_view: Comprehensive view of visit information including related data
    - visit_timeline_view: Chronological view of visits with counts of related items

  2. Changes
    - Creates two views for easier data access
    - Includes JSON aggregation for nested data
    - Adds proper comments for documentation
*/

-- Create visit details view
CREATE OR REPLACE VIEW visit_details_view AS
SELECT 
  v.id,
  v.patient_id,
  v.doctor_id,
  v.appointment_id,
  v.visit_date,
  v.visit_time,
  v.visit_type,
  v.chief_complaint,
  v.diagnosis,
  v.treatment_plan,
  v.prescription,
  v.follow_up_required,
  v.follow_up_date,
  v.notes,
  v.status,
  v.created_at,
  v.updated_at,
  -- Patient details
  p.first_name as patient_first_name,
  p.last_name as patient_last_name,
  -- Doctor details
  u.full_name as doctor_name,
  -- Vitals as JSON
  (
    SELECT json_build_object(
      'blood_pressure', vt.blood_pressure,
      'temperature', vt.temperature,
      'pulse_rate', vt.pulse_rate,
      'respiratory_rate', vt.respiratory_rate,
      'weight', vt.weight,
      'height', vt.height,
      'bmi', vt.bmi,
      'created_at', vt.created_at
    )
    FROM vitals vt
    WHERE vt.visit_id = v.id
    ORDER BY vt.created_at DESC
    LIMIT 1
  ) as vitals,
  -- Lab results as JSON array
  (
    SELECT json_agg(json_build_object(
      'id', lr.id,
      'name', lr.name,
      'value', lr.value,
      'unit', lr.unit,
      'reference_range', lr.reference_range,
      'status', lr.status,
      'date', lr.date,
      'created_at', lr.created_at
    ))
    FROM lab_results lr
    WHERE lr.visit_id = v.id
  ) as lab_results,
  -- Media as JSON array
  (
    SELECT json_agg(json_build_object(
      'id', vm.id,
      'type', vm.type,
      'url', vm.url,
      'description', vm.description,
      'date', vm.date,
      'created_at', vm.created_at
    ))
    FROM visit_media vm
    WHERE vm.visit_id = v.id
  ) as media,
  -- Pending requests as JSON
  (
    SELECT json_build_object(
      'lab_requests', (
        SELECT json_agg(json_build_object(
          'id', lr.id,
          'test_name', lr.test_name,
          'priority', lr.priority,
          'status', lr.status,
          'expected_completion_date', lr.expected_completion_date
        ))
        FROM lab_requests lr
        WHERE lr.visit_id = v.id AND lr.status IN ('pending', 'in-progress')
      ),
      'media_requests', (
        SELECT json_agg(json_build_object(
          'id', mr.id,
          'type', mr.type,
          'body_part', mr.body_part,
          'priority', mr.priority,
          'status', mr.status,
          'expected_completion_date', mr.expected_completion_date
        ))
        FROM media_requests mr
        WHERE mr.visit_id = v.id AND mr.status IN ('pending', 'in-progress')
      )
    )
  ) as pending_requests
FROM visits v
LEFT JOIN patients p ON v.patient_id = p.id
LEFT JOIN users u ON v.doctor_id = u.id;

-- Create visit timeline view
CREATE OR REPLACE VIEW visit_timeline_view AS
SELECT 
  v.id,
  v.patient_id,
  v.visit_date,
  v.visit_time,
  v.visit_type,
  v.chief_complaint,
  v.diagnosis,
  v.treatment_plan,
  v.prescription,
  v.status,
  u.full_name as doctor_name,
  u.id as doctor_id,
  -- Include counts of related items
  (
    SELECT COUNT(*)
    FROM lab_results lr
    WHERE lr.visit_id = v.id
  ) as lab_results_count,
  (
    SELECT COUNT(*)
    FROM visit_media vm
    WHERE vm.visit_id = v.id
  ) as media_count,
  (
    SELECT COUNT(*)
    FROM lab_requests lr
    WHERE lr.visit_id = v.id AND lr.status IN ('pending', 'in-progress')
  ) as pending_lab_requests_count,
  (
    SELECT COUNT(*)
    FROM media_requests mr
    WHERE mr.visit_id = v.id AND mr.status IN ('pending', 'in-progress')
  ) as pending_media_requests_count,
  v.created_at,
  v.updated_at
FROM visits v
LEFT JOIN users u ON v.doctor_id = u.id
ORDER BY v.visit_date DESC, v.visit_time DESC;

-- Create indexes on the base tables instead of views
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date, visit_time);

COMMENT ON VIEW visit_details_view IS 'Comprehensive view of visit information including vitals, lab results, and media';
COMMENT ON VIEW visit_timeline_view IS 'Chronological view of patient visits with related data';
-- Manually create a follow-up visit to see what the automation would do
-- This simulates what happens when the automation runs

-- First, find a recent completed visit
WITH recent_visit AS (
    SELECT 
        v.id,
        v.patient_id,
        v.practice_id,
        v.branch_id,
        v.doctor_id
    FROM visits v
    WHERE v.status = 'completed'
    AND v.practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
    ORDER BY v.created_at DESC
    LIMIT 1
)
-- Create a follow-up visit
INSERT INTO visits (
    patient_id,
    practice_id,
    branch_id,
    doctor_id,
    visit_type,
    visit_subtype,
    scheduled_date,
    scheduled_time,
    scheduled_duration,
    status,
    notes,
    preceding_visit_id,
    applied_template_id,
    care_plan_step,
    follow_up_loop_count,
    is_scheduled
)
SELECT 
    rv.patient_id,
    rv.practice_id,
    rv.branch_id,
    rv.doctor_id,
    'follow-up',
    'Post-Extraction Check',
    CURRENT_DATE + INTERVAL '7 days',
    '09:00:00',
    30,
    'scheduled',
    'Post-extraction follow-up for 8104. Check healing progress, assess for dry socket, remove sutures if needed.',
    rv.id,
    'd1233035-76d2-491b-8d53-b7bf786217f9', -- The Post-Extraction template ID
    1,
    1,
    true
FROM recent_visit rv
RETURNING 
    id,
    patient_id,
    scheduled_date,
    scheduled_time,
    visit_type,
    notes,
    'Follow-up visit created successfully!' as message;
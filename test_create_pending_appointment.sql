-- Create a test pending appointment
INSERT INTO appointments (
    id,
    patient_id,
    practice_id,
    date,
    time,
    duration,
    type,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM patients WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3' LIMIT 1),
    'b64632c2-3a56-44cf-a2c9-0e42be03a2d3',
    CURRENT_DATE + INTERVAL '2 days',
    '10:00',
    30,
    'consultation',
    'pending',
    'Test pending appointment for approval workflow',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING
RETURNING *;

-- Verify the appointment was created
SELECT 
    a.id,
    a.date,
    a.time,
    a.status,
    a.practice_id,
    a.doctor_id,
    p.first_name || ' ' || p.last_name as patient_name
FROM appointments a
LEFT JOIN patients p ON p.id = a.patient_id
WHERE a.status = 'pending'
AND a.practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY a.created_at DESC;
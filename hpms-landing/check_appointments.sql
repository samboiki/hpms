-- Check if Dr. Polina appointments exist
SELECT 
    a.id,
    a.date,
    a.time,
    a.status,
    a.doctor_id,
    a.practice_id,
    p.first_name || ' ' || p.last_name as patient_name,
    p.email as patient_email,
    pr.name as practice_name
FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN practices pr ON a.practice_id = pr.id
WHERE pr.slug = 'dr-polina-aesthetics'
   OR a.notes LIKE '%Online Booking%'
ORDER BY a.created_at DESC
LIMIT 10;
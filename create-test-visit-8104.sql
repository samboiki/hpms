-- Create a test visit with tariff code 8104 for demonstration
-- First, get a patient from the practice
WITH test_patient AS (
    SELECT p.id
    FROM patients p
    WHERE p.practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
    LIMIT 1
),
-- Create a completed visit
new_visit AS (
    INSERT INTO visits (
        patient_id,
        practice_id,
        branch_id,
        doctor_id,
        visit_type,
        visit_date,
        visit_time,
        status,
        chief_complaint,
        diagnosis,
        created_at,
        updated_at
    )
    SELECT 
        tp.id,
        'b64632c2-3a56-44cf-a2c9-0e42be03a2d3',
        b.id,
        '00dd5a75-fd97-448b-8e66-e192400f49f2', -- Andreas David (doctor)
        'consultation',
        CURRENT_DATE,
        '10:00:00',
        'completed',
        'Tooth pain - needs extraction',
        'Tooth extraction required',
        NOW(),
        NOW()
    FROM test_patient tp
    CROSS JOIN (SELECT id FROM branches WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3' LIMIT 1) b
    RETURNING id
),
-- Create an invoice for the visit
new_invoice AS (
    INSERT INTO invoices_enhanced (
        visit_id,
        patient_id,
        practice_id,
        invoice_date,
        total_amount,
        status,
        created_by,
        created_at,
        updated_at
    )
    SELECT 
        nv.id,
        v.patient_id,
        v.practice_id,
        CURRENT_DATE,
        150.00,
        'paid',
        v.doctor_id,
        NOW(),
        NOW()
    FROM new_visit nv
    JOIN visits v ON v.id = nv.id
    RETURNING id, visit_id
)
-- Add the 8104 service to the invoice
INSERT INTO invoice_services (
    invoice_id,
    tariff_code,
    description,
    quantity,
    unit_price,
    total_price,
    created_at
)
SELECT 
    ni.id,
    '8104',
    'Tooth Extraction',
    1,
    150.00,
    150.00,
    NOW()
FROM new_invoice ni;

-- Return the created visit ID
SELECT 
    v.id as visit_id,
    v.patient_id,
    v.status,
    'Visit created with tariff 8104 - ready for follow-up automation' as message
FROM visits v
WHERE v.id IN (SELECT id FROM new_visit);
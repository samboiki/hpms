-- Check if automation is enabled
SELECT 
    p.id,
    p.name,
    p.is_follow_up_automation_enabled
FROM practices p
WHERE p.id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

-- Check recent completed visits with their tariff codes
SELECT 
    v.id as visit_id,
    v.patient_id,
    v.practice_id,
    v.status,
    v.visit_date,
    v.created_at,
    v.updated_at,
    ie.id as invoice_id,
    array_agg(DISTINCT ins.tariff_code) as tariff_codes
FROM visits v
LEFT JOIN invoices_enhanced ie ON ie.visit_id = v.id
LEFT JOIN invoice_services ins ON ins.invoice_id = ie.id
WHERE v.status = 'completed'
AND v.practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
AND v.updated_at > NOW() - INTERVAL '24 hours'
GROUP BY v.id, v.patient_id, v.practice_id, v.status, v.visit_date, v.created_at, v.updated_at, ie.id
ORDER BY v.updated_at DESC
LIMIT 10;

-- Check if there are any active templates
SELECT 
    id,
    template_name,
    trigger_type,
    trigger_value,
    is_active
FROM follow_up_templates
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
AND is_active = true;
-- CHECK MEDICAL AID PATIENTS AND THEIR INVOICES
-- This query shows which patients have medical aid and their current invoice status

-- 1. Show all patients with medical aid
SELECT 
    p.id as patient_id,
    p.first_name,
    p.last_name,
    mad.provider,
    mad.scheme,
    mad.membership_number
FROM patients p
JOIN medical_aid_details mad ON p.id = mad.patient_id
ORDER BY p.first_name, p.last_name;

-- 2. Show problematic invoices for medical aid patients
SELECT 
    inv.invoice_number,
    p.first_name || ' ' || p.last_name as patient_name,
    mad.provider as medical_aid,
    inv.total,
    inv.medical_aid_total,
    inv.patient_total,
    CASE 
        WHEN inv.patient_total > 0 THEN '❌ PROBLEM: Patient being charged'
        ELSE '✅ OK: Patient not charged'
    END as status
FROM invoices_enhanced inv
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
ORDER BY inv.created_at DESC;

-- 3. Show problematic invoice services
SELECT 
    inv.invoice_number,
    p.first_name || ' ' || p.last_name as patient_name,
    svc.code,
    svc.description,
    svc.total_price,
    svc.medical_aid_covered,
    svc.patient_portion,
    CASE 
        WHEN svc.patient_portion > 0 THEN '❌ PROBLEM: Patient being charged for service'
        ELSE '✅ OK: Medical aid covers service'
    END as status
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
ORDER BY inv.invoice_number, svc.code;

-- 4. Count summary
SELECT 
    'Total medical aid patients' as category,
    COUNT(DISTINCT p.id) as count
FROM patients p
JOIN medical_aid_details mad ON p.id = mad.patient_id

UNION ALL

SELECT 
    'Medical aid invoices with patient charges' as category,
    COUNT(DISTINCT inv.id) as count
FROM invoices_enhanced inv
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE inv.patient_total > 0

UNION ALL

SELECT 
    'Medical aid services with patient charges' as category,
    COUNT(svc.id) as count
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
JOIN patients p ON inv.patient_id = p.id
JOIN medical_aid_details mad ON p.id = mad.patient_id
WHERE svc.patient_portion > 0;
-- DEBUG: Check if patient ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8 has medical aid

-- 1. Check if patient exists
SELECT 'Patient exists' as check_type, 
       first_name, last_name, id
FROM patients 
WHERE id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8';

-- 2. Check if patient has medical aid details
SELECT 'Medical aid details' as check_type,
       mad.id, mad.provider, mad.scheme, mad.membership_number,
       mad.patient_id
FROM medical_aid_details mad
WHERE mad.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8';

-- 3. Check recent invoice for this patient
SELECT 'Recent invoice' as check_type,
       inv.invoice_number, inv.patient_id, inv.medical_aid_total, inv.patient_total
FROM invoices_enhanced inv
WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
ORDER BY inv.created_at DESC
LIMIT 1;

-- 4. Check recent invoice services for this patient
SELECT 'Recent services' as check_type,
       svc.code, svc.description, svc.total_price, 
       svc.medical_aid_covered, svc.patient_portion
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
ORDER BY svc.created_at DESC
LIMIT 5;
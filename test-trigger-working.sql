-- TEST: Check if our trigger is working by manually inserting a test service

-- First, let's see what triggers exist on invoice_services
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoice_services';

-- Now let's manually test the trigger by updating an existing service
-- This should trigger our fix_medical_aid_invoice_totals function
UPDATE invoice_services 
SET description = description || ' (trigger test)'
WHERE id = (
    SELECT svc.id 
    FROM invoice_services svc
    JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
    WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
    AND svc.patient_portion > 0
    ORDER BY svc.created_at DESC
    LIMIT 1
);

-- Check if the trigger fixed the service
SELECT 'After trigger test' as check_type,
       svc.code, svc.description, svc.total_price, 
       svc.medical_aid_covered, svc.patient_portion,
       inv.medical_aid_total, inv.patient_total
FROM invoice_services svc
JOIN invoices_enhanced inv ON svc.invoice_id = inv.id
WHERE inv.patient_id = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8'
ORDER BY svc.created_at DESC
LIMIT 2;
-- TEST BILLING SYSTEM - Run this AFTER the main fix
-- This will help you test if the billing system is working

-- 1. First, let's check if the tables exist and are set up correctly
SELECT 'Checking invoices_enhanced table...' as step;
SELECT COUNT(*) as invoice_count FROM invoices_enhanced;

SELECT 'Checking invoice_services table...' as step;
SELECT COUNT(*) as service_count FROM invoice_services;

-- 2. Check if we have any practice tariffs for testing
SELECT 'Checking practice tariffs...' as step;
SELECT COUNT(*) as tariff_count FROM practice_tariffs WHERE price > 0;

-- 3. Check if we have any patients for testing
SELECT 'Checking patients...' as step;
SELECT COUNT(*) as patient_count FROM patients;

-- 4. Check if we have any visits for testing
SELECT 'Checking visits...' as step;
SELECT COUNT(*) as visit_count FROM visits;

-- 5. Let's see if there are any existing invoices for any patient
SELECT 'Existing invoices by patient...' as step;
SELECT 
    p.first_name,
    p.last_name,
    COUNT(i.id) as invoice_count,
    SUM(i.total) as total_amount
FROM patients p
LEFT JOIN invoices_enhanced i ON p.id = i.patient_id
GROUP BY p.id, p.first_name, p.last_name
HAVING COUNT(i.id) > 0
ORDER BY invoice_count DESC
LIMIT 10;

-- 6. Show the invoice_services_view structure
SELECT 'Testing invoice_services_view...' as step;
SELECT * FROM invoice_services_view LIMIT 5;

-- 7. If you want to create a test invoice, use this (replace the UUIDs with real ones):
/*
-- EXAMPLE: Create a test invoice (uncomment and update IDs)
INSERT INTO invoices_enhanced (patient_id, visit_id, due_date, notes)
VALUES (
    'REPLACE_WITH_REAL_PATIENT_ID',  -- Get from patients table
    'REPLACE_WITH_REAL_VISIT_ID',    -- Get from visits table
    CURRENT_DATE + INTERVAL '30 days',
    'Test invoice for billing system'
);

-- Then add services to the invoice:
INSERT INTO invoice_services (invoice_id, tariff_id, code, description, quantity, unit_price, total_price, patient_portion)
VALUES (
    (SELECT id FROM invoices_enhanced ORDER BY created_at DESC LIMIT 1),  -- Latest invoice
    'REPLACE_WITH_REAL_TARIFF_ID',   -- Get from practice_tariffs table
    '8101',
    'Full mouth examination, charting and treatment planning',
    1,
    254.70,
    254.70,
    254.70
);
*/

SELECT 'Billing system test completed!' as status;
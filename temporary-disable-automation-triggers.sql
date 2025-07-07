-- Temporary fix: Disable automation triggers to allow appointments to be saved
-- This is a quick fix while we properly resolve the automation system

-- Drop the problematic triggers temporarily
DROP TRIGGER IF EXISTS automation_trigger_visits_insert ON visits;
DROP TRIGGER IF EXISTS automation_trigger_visits_update ON visits;
DROP TRIGGER IF EXISTS automation_trigger_invoices_insert ON invoices_enhanced;
DROP TRIGGER IF EXISTS automation_trigger_invoices_update ON invoices_enhanced;
DROP TRIGGER IF EXISTS automation_trigger_lab_requests_update ON lab_requests;
DROP TRIGGER IF EXISTS automation_trigger_patients_insert ON patients;

-- You can re-enable them later by running the fix-automation-trigger-error.sql file
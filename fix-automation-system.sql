-- COMPREHENSIVE AUTOMATION SYSTEM FIX
-- This script will diagnose and fix all automation issues

-- 1. Check if automation trigger exists and is working
SELECT 'Checking patient automation trigger...' as status;
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname LIKE '%patient%automation%';

-- 2. Check automation settings
SELECT 'Checking automation settings...' as status;
SELECT 
    automation_id,
    name,
    is_active,
    channels,
    created_at,
    updated_at
FROM automation_settings
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
AND automation_id = 'welcome-new-patient';

-- 3. Check recent patients
SELECT 'Checking recent patients...' as status;
SELECT 
    id,
    first_name,
    last_name,
    created_at
FROM patients
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check automation executions
SELECT 'Checking automation executions...' as status;
SELECT 
    ae.id,
    ae.automation_id,
    ae.patient_id,
    p.first_name || ' ' || p.last_name as patient_name,
    ae.status,
    ae.created_at,
    ae.scheduled_at,
    ae.error_message
FROM automation_executions ae
LEFT JOIN patients p ON p.id = ae.patient_id
WHERE ae.practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY ae.created_at DESC
LIMIT 10;

-- 5. Check automation queue
SELECT 'Checking automation queue...' as status;
SELECT 
    id,
    trigger_type,
    status,
    created_at,
    processed_at,
    error_message
FROM automation_queue
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Fix: Recreate patient automation trigger
DROP TRIGGER IF EXISTS trigger_patient_automation ON patients;

CREATE OR REPLACE FUNCTION trigger_patient_automation()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into automation_queue
    INSERT INTO automation_queue (
        id,
        practice_id,
        trigger_type,
        trigger_data,
        status,
        created_at
    ) VALUES (
        gen_random_uuid(),
        NEW.practice_id,
        'new_patient',
        jsonb_build_object(
            'patient_id', NEW.id,
            'patient_name', NEW.first_name || ' ' || NEW.last_name,
            'patient_email', NEW.email,
            'patient_phone', NEW.cell_number
        ),
        'pending',
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_patient_automation
AFTER INSERT ON patients
FOR EACH ROW
EXECUTE FUNCTION trigger_patient_automation();

-- 7. Process any stuck automation queue items
UPDATE automation_queue
SET status = 'pending', processed_at = NULL
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
AND status = 'processing'
AND processed_at < NOW() - INTERVAL '10 minutes';

-- 8. Manually create automation for recent patients without one
INSERT INTO automation_executions (
    id,
    automation_id,
    practice_id,
    patient_id,
    status,
    scheduled_at,
    channel,
    template_data,
    variables_used
)
SELECT 
    gen_random_uuid(),
    'welcome-new-patient',
    p.practice_id,
    p.id,
    'pending',
    NOW(),
    'BOTH',
    jsonb_build_object(
        'automation_type', 'welcome-new-patient',
        'trigger_type', 'new_patient'
    ),
    jsonb_build_object(
        'patientName', p.first_name || ' ' || p.last_name,
        'patientFirstName', p.first_name,
        'patientEmail', p.email,
        'patientPhone', p.cell_number,
        'practiceName', 'New Charm Dental Practice'
    )
FROM patients p
WHERE p.practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
AND p.created_at > NOW() - INTERVAL '1 hour'
AND NOT EXISTS (
    SELECT 1 
    FROM automation_executions ae 
    WHERE ae.patient_id = p.id 
    AND ae.automation_id = 'welcome-new-patient'
);
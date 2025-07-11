-- Test Automation Setup for OneHealth
-- Run these queries to verify your automation system is working

-- 1. Check if practice has automations enabled
SELECT 
  pas.automation_id,
  pas.enabled,
  pas.sms_enabled,
  pas.email_enabled,
  pas.sms_template,
  pas.email_subject,
  LENGTH(pas.email_body) as email_body_length
FROM practice_automation_settings pas
WHERE pas.practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90' -- NewCharm
  AND pas.enabled = true;

-- 2. Check if practice has n8n credential configured
SELECT 
  poc.practice_id,
  poc.provider,
  poc.n8n_credential_id,
  poc.email,
  poc.connected_at
FROM practice_oauth_credentials poc
WHERE poc.practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
  AND poc.provider = 'google';

-- 3. Check pending automations in queue
SELECT 
  aq.id as queue_id,
  aq.trigger_type,
  aq.status,
  aq.scheduled_for,
  aq.attempt_count,
  aq.payload->>'patientName' as patient_name,
  aq.created_at
FROM automation_queue aq
WHERE aq.practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
ORDER BY aq.created_at DESC
LIMIT 10;

-- 4. Test the RPC function (dry run)
SELECT * FROM get_all_pending_automations(
  batch_size := 5,
  max_attempts := 3
);

-- 5. Check automation logs
SELECT 
  'SMS' as type,
  psl.sent_at,
  psl.recipient_phone,
  psl.status,
  psl.message_type
FROM practice_sms_logs psl
WHERE psl.practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
  AND psl.sent_at > NOW() - INTERVAL '1 day'
UNION ALL
SELECT 
  'Email' as type,
  pel.sent_at,
  pel.recipient_email,
  pel.status,
  pel.email_type
FROM practice_email_logs pel
WHERE pel.practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
  AND pel.sent_at > NOW() - INTERVAL '1 day'
ORDER BY sent_at DESC;

-- 6. Create a test automation (welcome email)
-- First create a test patient, then check the queue
INSERT INTO patients (
  practice_id,
  first_name,
  last_name,
  email,
  cell_number
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'Test',
  'Patient',
  'test@example.com',
  '+27123456789'
) RETURNING id;

-- 7. Manually queue a test automation
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Test Patient',
    'patientEmail', 'test@example.com',
    'patientPhone', '+27123456789',
    'automation_id', 'welcome-new-patient'
  ),
  NOW(), -- Send immediately
  'queued'
) RETURNING id;

-- 8. Debug: Check why automations might not be sending
WITH automation_check AS (
  SELECT 
    p.id as practice_id,
    p.name as practice_name,
    COUNT(DISTINCT pas.id) as enabled_automations,
    bool_or(pas.sms_enabled) as has_sms,
    bool_or(pas.email_enabled) as has_email,
    poc.n8n_credential_id,
    COUNT(DISTINCT aq.id) FILTER (WHERE aq.status = 'queued') as pending_count
  FROM practices p
  LEFT JOIN practice_automation_settings pas 
    ON pas.practice_id = p.id AND pas.enabled = true
  LEFT JOIN practice_oauth_credentials poc
    ON poc.practice_id = p.id AND poc.provider = 'google'
  LEFT JOIN automation_queue aq
    ON aq.practice_id = p.id AND aq.scheduled_for <= NOW()
  WHERE p.id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
  GROUP BY p.id, p.name, poc.n8n_credential_id
)
SELECT 
  *,
  CASE 
    WHEN enabled_automations = 0 THEN 'No automations enabled'
    WHEN NOT has_sms AND NOT has_email THEN 'No channels enabled'
    WHEN has_email AND n8n_credential_id IS NULL THEN 'Gmail not configured (will use fallback)'
    WHEN pending_count = 0 THEN 'No pending automations'
    ELSE 'Ready to process'
  END as status
FROM automation_check;
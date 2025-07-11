-- Fix ambiguous max_attempts reference in get_all_pending_automations function
CREATE OR REPLACE FUNCTION get_all_pending_automations(
  batch_size INTEGER DEFAULT 100,
  max_attempts INTEGER DEFAULT 3
)
RETURNS TABLE (
  queue_id UUID,
  practice_id UUID,
  practice_name TEXT,
  practice_phone TEXT,
  practice_email TEXT,
  automation_id TEXT,
  trigger_type TEXT,
  payload JSONB,
  scheduled_for TIMESTAMPTZ,
  attempt_count INTEGER,
  sms_enabled BOOLEAN,
  sms_template TEXT,
  email_enabled BOOLEAN,
  email_subject TEXT,
  email_body TEXT,
  n8n_credential_id TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_attempts INTEGER := max_attempts; -- Store parameter in local variable
BEGIN
  RETURN QUERY
  WITH pending_automations AS (
    -- Get all pending automations that are due
    SELECT 
      aq.id as queue_id,
      aq.practice_id,
      aq.trigger_type,
      aq.payload,
      aq.scheduled_for,
      aq.attempt_count,
      aq.created_at,
      -- Extract automation_id from trigger_type or payload
      COALESCE(
        aq.payload->>'automation_id',
        CASE 
          WHEN aq.trigger_type = 'patient.created' THEN 'welcome-new-patient'
          WHEN aq.trigger_type = 'appointment.created' THEN 'appointment-confirmation'
          WHEN aq.trigger_type = 'appointment.reminder.24h' THEN 'appointment-reminder-24h'
          WHEN aq.trigger_type = 'appointment.reminder.1h' THEN 'appointment-reminder-1h'
          WHEN aq.trigger_type = 'visit.completed' THEN 'post-visit-follow-up'
          WHEN aq.trigger_type = 'patient.birthday' THEN 'birthday-wishes'
          WHEN aq.trigger_type = 'appointment.no_show' THEN 'no-show-follow-up'
          ELSE aq.trigger_type
        END
      ) as automation_id
    FROM automation_queue aq
    WHERE aq.status = 'queued'
      AND aq.scheduled_for <= NOW()
      AND aq.attempt_count < v_max_attempts -- Use local variable here
    ORDER BY aq.scheduled_for ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  SELECT 
    pa.queue_id,
    pa.practice_id,
    p.name as practice_name,
    p.phone as practice_phone,
    p.email as practice_email,
    pa.automation_id,
    pa.trigger_type,
    pa.payload,
    pa.scheduled_for,
    pa.attempt_count,
    COALESCE(pas.sms_enabled, false) as sms_enabled,
    pas.sms_template,
    pas.email_enabled,
    pas.email_subject,
    pas.email_body,
    poc.n8n_credential_id,
    pa.created_at
  FROM pending_automations pa
  JOIN practices p ON p.id = pa.practice_id
  LEFT JOIN practice_automation_settings pas 
    ON pas.practice_id = pa.practice_id 
    AND pas.automation_id = pa.automation_id
  LEFT JOIN practice_oauth_credentials poc
    ON poc.practice_id = pa.practice_id
    AND poc.provider = 'google'
  WHERE pas.enabled = true OR pas.enabled IS NULL; -- Handle cases where no settings exist yet

  -- Update status to processing
  UPDATE automation_queue
  SET status = 'processing',
      updated_at = NOW()
  WHERE id IN (
    SELECT queue_id 
    FROM pending_automations
  );
END;
$$;
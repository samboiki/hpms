-- RPC Functions for n8n to efficiently query pending automations

-- 1. Function to get pending welcome automations
CREATE OR REPLACE FUNCTION get_pending_welcome_automations(batch_size INT DEFAULT 100)
RETURNS TABLE (
    queue_id UUID,
    practice_id UUID,
    practice_name TEXT,
    practice_phone TEXT,
    practice_email TEXT,
    payload JSONB,
    sms_enabled BOOLEAN,
    email_enabled BOOLEAN,
    sms_template TEXT,
    email_subject TEXT,
    email_body TEXT,
    google_refresh_token TEXT,
    google_email TEXT,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update status to processing for selected records to prevent double processing
    WITH selected_records AS (
        SELECT aq.id
        FROM automation_queue aq
        JOIN practice_automation_settings pas 
            ON pas.practice_id = aq.practice_id 
            AND pas.automation_id = 'welcome-new-patient'
            AND pas.enabled = true
        WHERE aq.status = 'pending'
            AND aq.trigger_type = 'patient.created'
            AND aq.scheduled_for <= NOW()
        ORDER BY aq.scheduled_for, aq.created_at
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE automation_queue
    SET status = 'processing',
        picked_at = NOW()
    WHERE id IN (SELECT id FROM selected_records);

    -- Return the updated records with all necessary data
    RETURN QUERY
    SELECT 
        aq.id as queue_id,
        aq.practice_id,
        p.name as practice_name,
        p.contact_phone as practice_phone,
        p.contact_email as practice_email,
        aq.payload,
        COALESCE(pas.sms_enabled, true) as sms_enabled,
        COALESCE(pas.email_enabled, true) as email_enabled,
        COALESCE(pas.sms_template, 
            'Welcome to {{practiceName}}, {{patientName}}! We look forward to caring for you. Save our number for easy access. Reply STOP to opt out.'
        ) as sms_template,
        COALESCE(pas.email_subject, 'Welcome to {{practiceName}}!') as email_subject,
        COALESCE(pas.email_body, 
            '<h2>Welcome {{patientName}}!</h2><p>Thank you for choosing {{practiceName}} for your healthcare needs.</p><p>We are committed to providing you with excellent care.</p><p>If you have any questions, please don''t hesitate to contact us at {{practicePhone}}.</p><p>Best regards,<br>{{practiceName}} Team</p>'
        ) as email_body,
        pas.google_refresh_token,
        pas.google_email,
        aq.created_at
    FROM automation_queue aq
    JOIN practices p ON p.id = aq.practice_id
    LEFT JOIN practice_automation_settings pas 
        ON pas.practice_id = aq.practice_id 
        AND pas.automation_id = 'welcome-new-patient'
    WHERE aq.status = 'processing'
        AND aq.trigger_type = 'patient.created'
        AND aq.picked_at >= NOW() - INTERVAL '1 minute'; -- Only return recently picked records
END;
$$;

-- 2. Generic function to get pending automations by type
CREATE OR REPLACE FUNCTION get_pending_automations_by_type(
    automation_type VARCHAR(50),
    batch_size INT DEFAULT 100
)
RETURNS TABLE (
    queue_id UUID,
    practice_id UUID,
    practice_name TEXT,
    practice_phone TEXT,
    practice_email TEXT,
    payload JSONB,
    automation_id VARCHAR(50),
    automation_name TEXT,
    sms_enabled BOOLEAN,
    email_enabled BOOLEAN,
    sms_template TEXT,
    email_subject TEXT,
    email_body TEXT,
    google_refresh_token TEXT,
    google_email TEXT,
    timings JSONB,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update status to processing for selected records
    WITH selected_records AS (
        SELECT aq.id
        FROM automation_queue aq
        JOIN automation_definitions ad ON ad.trigger_events @> ARRAY[aq.trigger_type]
        JOIN practice_automation_settings pas 
            ON pas.practice_id = aq.practice_id 
            AND pas.automation_id = ad.id
            AND pas.enabled = true
        WHERE aq.status = 'pending'
            AND ad.id = automation_type
            AND aq.scheduled_for <= NOW()
        ORDER BY aq.scheduled_for, aq.created_at
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE automation_queue
    SET status = 'processing',
        picked_at = NOW()
    WHERE id IN (SELECT id FROM selected_records);

    -- Return the updated records with all necessary data
    RETURN QUERY
    SELECT 
        aq.id as queue_id,
        aq.practice_id,
        p.name as practice_name,
        p.contact_phone as practice_phone,
        p.contact_email as practice_email,
        aq.payload,
        ad.id as automation_id,
        ad.name as automation_name,
        COALESCE(pas.sms_enabled, true) as sms_enabled,
        COALESCE(pas.email_enabled, true) as email_enabled,
        pas.sms_template,
        pas.email_subject,
        pas.email_body,
        pas.google_refresh_token,
        pas.google_email,
        COALESCE(pas.timings, ad.default_timings) as timings,
        aq.created_at
    FROM automation_queue aq
    JOIN automation_definitions ad ON ad.trigger_events @> ARRAY[aq.trigger_type]
    JOIN practices p ON p.id = aq.practice_id
    LEFT JOIN practice_automation_settings pas 
        ON pas.practice_id = aq.practice_id 
        AND pas.automation_id = ad.id
    WHERE aq.status = 'processing'
        AND ad.id = automation_type
        AND aq.picked_at >= NOW() - INTERVAL '1 minute';
END;
$$;

-- 3. Function to reset stuck automations (housekeeping)
CREATE OR REPLACE FUNCTION reset_stuck_automations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Reset automations that have been processing for more than 5 minutes
    UPDATE automation_queue
    SET status = 'pending',
        attempt_count = attempt_count + 1,
        error_message = 'Reset due to timeout'
    WHERE status = 'processing'
        AND picked_at < NOW() - INTERVAL '5 minutes'
        AND attempt_count < max_attempts;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$;

-- 4. Function to get automation statistics for a practice
CREATE OR REPLACE FUNCTION get_practice_automation_stats(
    p_practice_id UUID,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    automation_id VARCHAR(50),
    automation_name TEXT,
    total_sent INTEGER,
    sms_sent INTEGER,
    email_sent INTEGER,
    success_rate NUMERIC,
    avg_processing_time_ms INTEGER,
    last_executed TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ad.id as automation_id,
        ad.name as automation_name,
        COUNT(ae.id)::INTEGER as total_sent,
        COUNT(ae.id) FILTER (WHERE ae.sms_sent = true)::INTEGER as sms_sent,
        COUNT(ae.id) FILTER (WHERE ae.email_sent = true)::INTEGER as email_sent,
        CASE 
            WHEN COUNT(ae.id) > 0 
            THEN ROUND((COUNT(ae.id) FILTER (WHERE ae.status = 'success')::NUMERIC / COUNT(ae.id)::NUMERIC) * 100, 2)
            ELSE 0
        END as success_rate,
        AVG(ae.execution_time_ms)::INTEGER as avg_processing_time_ms,
        MAX(ae.completed_at) as last_executed
    FROM automation_definitions ad
    LEFT JOIN automation_executions ae 
        ON ae.template_id = ad.id 
        AND ae.practice_id = p_practice_id
        AND ae.created_at >= NOW() - INTERVAL '1 day' * p_days_back
    GROUP BY ad.id, ad.name
    ORDER BY total_sent DESC;
END;
$$;

-- 5. Function to template variable replacement
CREATE OR REPLACE FUNCTION replace_template_variables(
    template TEXT,
    variables JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result TEXT := template;
    key TEXT;
    value TEXT;
BEGIN
    -- Replace each variable in the template
    FOR key, value IN SELECT * FROM jsonb_each_text(variables)
    LOOP
        -- Replace {{variableName}} with the actual value
        result := REPLACE(result, '{{' || key || '}}', COALESCE(value, ''));
    END LOOP;
    
    RETURN result;
END;
$$;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_pending_welcome_automations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_pending_automations_by_type TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION reset_stuck_automations TO service_role;
GRANT EXECUTE ON FUNCTION get_practice_automation_stats TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION replace_template_variables TO anon, authenticated, service_role;
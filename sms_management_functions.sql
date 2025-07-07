-- =====================================================
-- SMS MANAGEMENT FUNCTIONS AND UTILITIES
-- =====================================================
-- Additional functions for SMS portal integration and management

-- Function to send SMS (portal integration placeholder)
CREATE OR REPLACE FUNCTION send_sms(
  practice_uuid UUID,
  recipient_phone TEXT,
  message_content TEXT,
  message_type TEXT DEFAULT 'custom',
  template_variables JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  sms_log_id UUID;
  subscription_record RECORD;
  portal_config RECORD;
  estimated_cost DECIMAL(5,4);
BEGIN
  -- Get practice SMS subscription
  SELECT * INTO subscription_record
  FROM practice_sms_subscriptions 
  WHERE practice_id = practice_uuid AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active SMS subscription found for practice';
  END IF;
  
  -- Check if practice has remaining SMS credits
  IF subscription_record.current_usage >= subscription_record.monthly_limit THEN
    RAISE EXCEPTION 'SMS limit exceeded. Current usage: %, Limit: %', 
      subscription_record.current_usage, subscription_record.monthly_limit;
  END IF;
  
  -- Get SMS portal configuration
  SELECT * INTO portal_config
  FROM sms_portal_config 
  WHERE practice_id = practice_uuid AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No SMS portal configuration found for practice';
  END IF;
  
  -- Calculate estimated cost
  estimated_cost := 0.35; -- Default cost per SMS - adjust based on portal pricing
  
  -- Create SMS usage log entry
  INSERT INTO sms_usage_logs (
    practice_id,
    subscription_id,
    recipient_phone,
    message_content,
    message_type,
    status,
    cost
  ) VALUES (
    practice_uuid,
    subscription_record.id,
    recipient_phone,
    message_content,
    message_type,
    'pending',
    estimated_cost
  ) RETURNING id INTO sms_log_id;
  
  -- Here you would integrate with actual SMS portal API
  -- For now, we'll simulate successful sending
  UPDATE sms_usage_logs 
  SET status = 'sent', sent_at = NOW()
  WHERE id = sms_log_id;
  
  -- Log the SMS sending action
  INSERT INTO admin_activity_logs (admin_id, action, resource, resource_id, details)
  VALUES (
    NULL, -- System action
    'sms_sent',
    'sms_usage_logs',
    sms_log_id,
    jsonb_build_object(
      'practice_id', practice_uuid,
      'recipient', recipient_phone,
      'message_type', message_type,
      'cost', estimated_cost
    )
  );
  
  RETURN sms_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process SMS template with variables
CREATE OR REPLACE FUNCTION process_sms_template(
  template_content TEXT,
  variables JSONB
) RETURNS TEXT AS $$
DECLARE
  processed_content TEXT;
  var_key TEXT;
  var_value TEXT;
BEGIN
  processed_content := template_content;
  
  -- Replace each variable in the template
  FOR var_key, var_value IN SELECT key, value FROM jsonb_each_text(variables)
  LOOP
    processed_content := REPLACE(processed_content, '{{' || var_key || '}}', var_value);
  END LOOP;
  
  RETURN processed_content;
END;
$$ LANGUAGE plpgsql;

-- Function to send appointment reminder SMS
CREATE OR REPLACE FUNCTION send_appointment_reminder_sms(
  appointment_uuid UUID
) RETURNS UUID AS $$
DECLARE
  appointment_record RECORD;
  patient_record RECORD;
  practice_record RECORD;
  doctor_record RECORD;
  template_record RECORD;
  message_content TEXT;
  template_vars JSONB;
  sms_log_id UUID;
BEGIN
  -- Get appointment details
  SELECT a.*, p.first_name, p.last_name, p.cell_number,
         pr.name as practice_name, pr.contact_phone as practice_phone, pr.address as practice_address,
         u.full_name as doctor_name
  INTO appointment_record
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN practices pr ON pr.id = a.practice_id
  LEFT JOIN users u ON u.id = a.doctor_id
  WHERE a.id = appointment_uuid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  
  -- Get SMS template for appointment reminders
  SELECT * INTO template_record
  FROM sms_templates 
  WHERE practice_id = appointment_record.practice_id 
    AND template_type = 'appointment_reminder'
    AND is_active = true
  ORDER BY is_default DESC, created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No appointment reminder template found for practice';
  END IF;
  
  -- Prepare template variables
  template_vars := jsonb_build_object(
    'patient_name', appointment_record.first_name || ' ' || appointment_record.last_name,
    'appointment_date', TO_CHAR(appointment_record.appointment_date, 'DD/MM/YYYY'),
    'appointment_time', TO_CHAR(appointment_record.appointment_time, 'HH24:MI'),
    'doctor_name', COALESCE(appointment_record.doctor_name, 'the doctor'),
    'practice_name', appointment_record.practice_name,
    'practice_phone', appointment_record.practice_phone,
    'practice_address', appointment_record.practice_address
  );
  
  -- Process template
  message_content := process_sms_template(template_record.content, template_vars);
  
  -- Send SMS
  sms_log_id := send_sms(
    appointment_record.practice_id,
    appointment_record.cell_number,
    message_content,
    'appointment_reminder'
  );
  
  -- Update appointment with reminder sent status
  UPDATE appointments 
  SET reminder_sent_at = NOW()
  WHERE id = appointment_uuid;
  
  RETURN sms_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check SMS delivery status (portal integration)
CREATE OR REPLACE FUNCTION update_sms_delivery_status(
  sms_log_uuid UUID,
  new_status TEXT,
  delivery_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  failure_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE sms_usage_logs 
  SET 
    status = new_status,
    delivered_at = CASE WHEN new_status = 'delivered' THEN delivery_timestamp ELSE delivered_at END,
    failed_at = CASE WHEN new_status = 'failed' THEN delivery_timestamp ELSE failed_at END,
    failure_reason = COALESCE(failure_reason, failure_reason)
  WHERE id = sms_log_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get SMS usage summary for a practice
CREATE OR REPLACE FUNCTION get_sms_usage_summary(
  practice_uuid UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
) RETURNS TABLE (
  total_sent INTEGER,
  total_delivered INTEGER,
  total_failed INTEGER,
  delivery_rate DECIMAL(5,2),
  total_cost DECIMAL(10,2),
  usage_by_type JSONB,
  daily_usage JSONB
) AS $$
DECLARE
  filter_start DATE;
  filter_end DATE;
BEGIN
  -- Set default date range if not provided (current month)
  filter_start := COALESCE(start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  filter_end := COALESCE(end_date, CURRENT_DATE);
  
  RETURN QUERY
  WITH usage_stats AS (
    SELECT 
      COUNT(*) as sent,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      SUM(cost) as cost,
      
      -- Usage by message type
      jsonb_object_agg(
        message_type, 
        COUNT(*)
      ) FILTER (WHERE message_type IS NOT NULL) as by_type,
      
      -- Daily usage breakdown
      jsonb_object_agg(
        created_at::DATE::TEXT,
        COUNT(*)
      ) as daily_breakdown
      
    FROM sms_usage_logs 
    WHERE practice_id = practice_uuid 
      AND created_at::DATE >= filter_start 
      AND created_at::DATE <= filter_end
  )
  SELECT 
    sent::INTEGER,
    delivered::INTEGER,
    failed::INTEGER,
    CASE WHEN sent > 0 THEN ROUND((delivered * 100.0 / sent), 2) ELSE 0 END::DECIMAL(5,2),
    cost::DECIMAL(10,2),
    COALESCE(by_type, '{}'::jsonb),
    COALESCE(daily_breakdown, '{}'::jsonb)
  FROM usage_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upgrade/downgrade SMS plan
CREATE OR REPLACE FUNCTION change_sms_plan(
  practice_uuid UUID,
  new_plan_id UUID,
  effective_date DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
DECLARE
  current_subscription RECORD;
  new_plan RECORD;
BEGIN
  -- Get current subscription
  SELECT * INTO current_subscription
  FROM practice_sms_subscriptions 
  WHERE practice_id = practice_uuid AND is_active = true;
  
  -- Get new plan details
  SELECT * INTO new_plan
  FROM sms_plans 
  WHERE id = new_plan_id AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMS plan not found or inactive';
  END IF;
  
  -- Deactivate current subscription
  IF FOUND THEN
    UPDATE practice_sms_subscriptions 
    SET is_active = false, updated_at = NOW()
    WHERE id = current_subscription.id;
  END IF;
  
  -- Create new subscription
  INSERT INTO practice_sms_subscriptions (
    practice_id,
    plan_id,
    monthly_limit,
    billing_cycle_start,
    billing_cycle_end,
    is_active
  ) VALUES (
    practice_uuid,
    new_plan_id,
    new_plan.monthly_sms_limit,
    effective_date,
    effective_date + INTERVAL '1 month',
    true
  );
  
  -- Log the plan change
  INSERT INTO admin_activity_logs (admin_id, action, resource, resource_id, details)
  VALUES (
    NULL,
    'sms_plan_changed',
    'practice_sms_subscriptions',
    practice_uuid,
    jsonb_build_object(
      'old_plan', current_subscription.plan_id,
      'new_plan', new_plan_id,
      'effective_date', effective_date
    )
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly SMS usage (for billing cycle)
CREATE OR REPLACE FUNCTION reset_monthly_sms_usage(
  practice_uuid UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE practice_sms_subscriptions 
  SET 
    current_usage = 0,
    additional_sms_purchased = 0,
    billing_cycle_start = CURRENT_DATE,
    billing_cycle_end = CURRENT_DATE + INTERVAL '1 month',
    updated_at = NOW()
  WHERE practice_id = practice_uuid AND is_active = true;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to purchase additional SMS credits
CREATE OR REPLACE FUNCTION purchase_additional_sms(
  practice_uuid UUID,
  additional_sms INTEGER,
  cost DECIMAL(10,2)
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE practice_sms_subscriptions 
  SET 
    additional_sms_purchased = additional_sms_purchased + additional_sms,
    updated_at = NOW()
  WHERE practice_id = practice_uuid AND is_active = true;
  
  -- Log the purchase
  INSERT INTO admin_activity_logs (admin_id, action, resource, resource_id, details)
  VALUES (
    NULL,
    'sms_credits_purchased',
    'practice_sms_subscriptions',
    practice_uuid,
    jsonb_build_object(
      'additional_sms', additional_sms,
      'cost', cost,
      'purchase_date', CURRENT_DATE
    )
  );
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get practices approaching SMS limit
CREATE OR REPLACE FUNCTION get_practices_approaching_sms_limit(
  threshold_percentage DECIMAL DEFAULT 80.0
) RETURNS TABLE (
  practice_id UUID,
  practice_name TEXT,
  current_usage INTEGER,
  monthly_limit INTEGER,
  usage_percentage DECIMAL(5,2),
  remaining_sms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    s.current_usage,
    s.monthly_limit,
    ROUND((s.current_usage * 100.0 / s.monthly_limit), 2)::DECIMAL(5,2),
    (s.monthly_limit - s.current_usage)
  FROM practices p
  JOIN practice_sms_subscriptions s ON s.practice_id = p.id
  WHERE s.is_active = true
    AND s.monthly_limit > 0
    AND (s.current_usage * 100.0 / s.monthly_limit) >= threshold_percentage
  ORDER BY (s.current_usage * 100.0 / s.monthly_limit) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk send appointment reminders
CREATE OR REPLACE FUNCTION send_daily_appointment_reminders()
RETURNS TABLE (
  practice_id UUID,
  appointments_processed INTEGER,
  reminders_sent INTEGER,
  errors INTEGER
) AS $$
DECLARE
  appointment_record RECORD;
  reminders_sent_count INTEGER := 0;
  errors_count INTEGER := 0;
  current_practice UUID;
  practice_count INTEGER := 0;
BEGIN
  -- Get appointments for tomorrow that haven't had reminders sent
  FOR appointment_record IN
    SELECT a.id, a.practice_id
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
      AND a.status IN ('scheduled', 'confirmed')
      AND a.reminder_sent_at IS NULL
      AND p.cell_number IS NOT NULL
      AND LENGTH(p.cell_number) > 8
    ORDER BY a.practice_id
  LOOP
    BEGIN
      -- Track practice changes
      IF current_practice IS DISTINCT FROM appointment_record.practice_id THEN
        -- Return results for previous practice
        IF current_practice IS NOT NULL THEN
          RETURN QUERY SELECT current_practice, practice_count, reminders_sent_count, errors_count;
        END IF;
        
        -- Reset counters for new practice
        current_practice := appointment_record.practice_id;
        practice_count := 0;
        reminders_sent_count := 0;
        errors_count := 0;
      END IF;
      
      practice_count := practice_count + 1;
      
      -- Attempt to send reminder
      PERFORM send_appointment_reminder_sms(appointment_record.id);
      reminders_sent_count := reminders_sent_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      errors_count := errors_count + 1;
      -- Log the error
      INSERT INTO admin_activity_logs (admin_id, action, resource, resource_id, details)
      VALUES (
        NULL,
        'sms_reminder_error',
        'appointments',
        appointment_record.id,
        jsonb_build_object(
          'error_message', SQLERRM,
          'appointment_date', CURRENT_DATE + INTERVAL '1 day'
        )
      );
    END;
  END LOOP;
  
  -- Return final practice results
  IF current_practice IS NOT NULL THEN
    RETURN QUERY SELECT current_practice, practice_count, reminders_sent_count, errors_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sms_usage_logs_practice_date ON sms_usage_logs(practice_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_usage_logs_status ON sms_usage_logs(status);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_sent ON appointments(reminder_sent_at) WHERE reminder_sent_at IS NULL;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION send_sms TO authenticated;
GRANT EXECUTE ON FUNCTION process_sms_template TO authenticated;
GRANT EXECUTE ON FUNCTION send_appointment_reminder_sms TO authenticated;
GRANT EXECUTE ON FUNCTION get_sms_usage_summary TO authenticated;

-- Comments
COMMENT ON FUNCTION send_sms IS 'Send SMS through configured portal with usage tracking';
COMMENT ON FUNCTION send_appointment_reminder_sms IS 'Send appointment reminder SMS using practice template';
COMMENT ON FUNCTION get_sms_usage_summary IS 'Get comprehensive SMS usage statistics for a practice';
COMMENT ON FUNCTION change_sms_plan IS 'Upgrade or downgrade SMS plan for a practice';
COMMENT ON FUNCTION send_daily_appointment_reminders IS 'Bulk send appointment reminders for next day appointments';
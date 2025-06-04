-- Setup SMS Management for All Practices
-- Execute this after the main migration is complete

-- Create SMS portal configurations for existing practices
INSERT INTO sms_portal_config (
  practice_id,
  portal_name,
  api_endpoint,
  api_key,
  username,
  password,
  sender_id,
  webhook_url,
  settings,
  is_active
)
SELECT 
  p.id,
  'SMS Portal Namibia', -- Default portal name
  'https://api.smsportal.na/v1/send', -- Default API endpoint
  'your_api_key_here', -- You'll need to replace this with actual API key
  'your_username', -- Replace with actual username
  'your_password', -- Replace with actual password
  'OneHealth', -- Default sender ID
  'https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/sms-webhook',
  json_build_object(
    'rate_limit', '100_per_minute',
    'delivery_reports', true,
    'unicode_support', true,
    'long_message_support', true
  )::jsonb,
  false -- Start as inactive until API credentials are configured
FROM practices p
WHERE NOT EXISTS (
  SELECT 1 FROM sms_portal_config WHERE practice_id = p.id
);

-- Assign SMS subscriptions to all practices
INSERT INTO practice_sms_subscriptions (
  practice_id,
  plan_id,
  monthly_limit,
  additional_sms_purchased,
  current_usage,
  billing_cycle_start,
  billing_cycle_end,
  is_active,
  auto_renew
)
SELECT 
  p.id,
  CASE 
    WHEN p.subscription_tier = 'enterprise' OR p.subscription_tier = 'premium' 
    THEN (SELECT id FROM sms_plans WHERE name = 'Enterprise' LIMIT 1)
    WHEN p.subscription_tier = 'standard' 
    THEN (SELECT id FROM sms_plans WHERE name = 'Professional' LIMIT 1)
    ELSE (SELECT id FROM sms_plans WHERE name = 'Starter' LIMIT 1)
  END,
  CASE 
    WHEN p.subscription_tier = 'enterprise' OR p.subscription_tier = 'premium' THEN 10000
    WHEN p.subscription_tier = 'standard' THEN 2000
    ELSE 500
  END,
  0, -- No additional SMS purchased initially
  0, -- No usage initially
  DATE_TRUNC('month', CURRENT_DATE), -- Start of current month
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', -- End of current month
  true, -- Active subscription
  true  -- Auto-renew enabled
FROM practices p
WHERE NOT EXISTS (
  SELECT 1 FROM practice_sms_subscriptions WHERE practice_id = p.id AND is_active = true
);

-- Create comprehensive reporting view for SMS management
CREATE OR REPLACE VIEW sms_management_dashboard AS
WITH practice_sms_summary AS (
  SELECT 
    p.id as practice_id,
    p.name as practice_name,
    p.contact_phone,
    p.subscription_tier,
    sms_sub.monthly_limit,
    sms_sub.current_usage,
    sms_sub.additional_sms_purchased,
    sms_sub.billing_cycle_start,
    sms_sub.billing_cycle_end,
    sms_plan.price_per_month,
    sms_plan.price_per_additional_sms,
    sms_config.is_active as portal_configured,
    sms_config.sender_id
  FROM practices p
  LEFT JOIN practice_sms_subscriptions sms_sub ON sms_sub.practice_id = p.id AND sms_sub.is_active = true
  LEFT JOIN sms_plans sms_plan ON sms_plan.id = sms_sub.plan_id
  LEFT JOIN sms_portal_config sms_config ON sms_config.practice_id = p.id
),
usage_stats AS (
  SELECT 
    practice_id,
    COUNT(*) as total_sent_this_month,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_this_month,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_this_month,
    SUM(cost) as total_cost_this_month
  FROM sms_usage_logs
  WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY practice_id
)
SELECT 
  pss.*,
  COALESCE(us.total_sent_this_month, 0) as sms_sent_this_month,
  COALESCE(us.delivered_this_month, 0) as sms_delivered_this_month,
  COALESCE(us.failed_this_month, 0) as sms_failed_this_month,
  COALESCE(us.total_cost_this_month, 0) as sms_cost_this_month,
  
  -- Calculate usage percentage
  CASE 
    WHEN pss.monthly_limit > 0 
    THEN ROUND((pss.current_usage * 100.0 / pss.monthly_limit), 2)
    ELSE 0
  END as usage_percentage,
  
  -- Calculate remaining SMS
  GREATEST(0, pss.monthly_limit - pss.current_usage + pss.additional_sms_purchased) as remaining_sms,
  
  -- Calculate delivery rate
  CASE 
    WHEN COALESCE(us.total_sent_this_month, 0) > 0 
    THEN ROUND((COALESCE(us.delivered_this_month, 0) * 100.0 / us.total_sent_this_month), 2)
    ELSE 0
  END as delivery_rate_percentage,
  
  -- Days until billing cycle end
  EXTRACT(DAYS FROM pss.billing_cycle_end - CURRENT_DATE) as days_until_reset
FROM practice_sms_summary pss
LEFT JOIN usage_stats us ON us.practice_id = pss.practice_id
ORDER BY pss.practice_name;

-- Create function to allocate SMS to a practice
CREATE OR REPLACE FUNCTION allocate_sms_to_practice(
  practice_uuid UUID,
  additional_sms INTEGER,
  allocated_by_admin UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  current_subscription RECORD;
BEGIN
  -- Get current subscription
  SELECT * INTO current_subscription
  FROM practice_sms_subscriptions 
  WHERE practice_id = practice_uuid AND is_active = true
  LIMIT 1;
  
  IF current_subscription IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No active SMS subscription found for this practice'
    );
  END IF;
  
  -- Update the subscription with additional SMS
  UPDATE practice_sms_subscriptions
  SET 
    additional_sms_purchased = additional_sms_purchased + additional_sms,
    updated_at = NOW()
  WHERE id = current_subscription.id;
  
  -- Log the allocation
  INSERT INTO admin_audit_logs (
    admin_user_id,
    action,
    resource_type,
    resource_id,
    new_values
  ) VALUES (
    COALESCE(allocated_by_admin, auth.uid()),
    'SMS_ALLOCATION',
    'practice_sms_subscriptions',
    current_subscription.id,
    json_build_object(
      'practice_id', practice_uuid,
      'additional_sms_allocated', additional_sms,
      'new_total_additional', current_subscription.additional_sms_purchased + additional_sms
    )::jsonb
  );
  
  RETURN json_build_object(
    'success', true,
    'practice_id', practice_uuid,
    'additional_sms_allocated', additional_sms,
    'total_additional_sms', current_subscription.additional_sms_purchased + additional_sms,
    'monthly_limit', current_subscription.monthly_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON sms_management_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_sms_to_practice(UUID, INTEGER, UUID) TO authenticated;

-- Summary
SELECT 
  'SMS Management Setup Complete!' as status,
  json_build_object(
    'practices_with_sms_config', (SELECT COUNT(*) FROM sms_portal_config),
    'active_sms_subscriptions', (SELECT COUNT(*) FROM practice_sms_subscriptions WHERE is_active = true),
    'total_monthly_sms_allocated', (SELECT SUM(monthly_limit) FROM practice_sms_subscriptions WHERE is_active = true),
    'sms_plans_available', (SELECT COUNT(*) FROM sms_plans WHERE is_active = true)
  ) as summary;
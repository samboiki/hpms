-- Create function to increment email usage
CREATE OR REPLACE FUNCTION increment_email_usage(
  p_practice_id UUID,
  p_count INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription RECORD;
  v_new_usage INTEGER;
BEGIN
  -- Find active subscription
  SELECT * INTO v_subscription
  FROM practice_email_subscriptions
  WHERE practice_id = p_practice_id
    AND is_active = true
    AND billing_cycle_end >= CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no active subscription found, return error
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active email subscription found'
    );
  END IF;

  -- Update usage
  v_new_usage := COALESCE(v_subscription.current_usage, 0) + p_count;
  
  UPDATE practice_email_subscriptions
  SET 
    current_usage = v_new_usage,
    updated_at = NOW()
  WHERE id = v_subscription.id;

  -- Return success with updated info
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'new_usage', v_new_usage,
    'monthly_limit', v_subscription.monthly_limit,
    'remaining', v_subscription.monthly_limit - v_new_usage
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_email_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_email_usage(UUID, INTEGER) TO service_role;
-- Note: Edge Functions must be deployed via Supabase CLI or Dashboard
-- This SQL creates the necessary database setup for the booking system

-- Ensure practices table has online_booking feature flag
UPDATE practices 
SET features = jsonb_set(
  COALESCE(features, '{}'), 
  '{online_booking}', 
  'true'
) 
WHERE slug = 'dr-polina-aesthetics';

-- Create a log table for booking attempts (optional but useful for monitoring)
CREATE TABLE IF NOT EXISTS booking_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT,
  practice_id UUID REFERENCES practices(id),
  patient_email TEXT,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_booking_logs_created_at ON booking_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_logs_ip ON booking_logs(ip_address);

-- Grant access to service role
GRANT ALL ON booking_logs TO service_role;

-- Output instructions
SELECT 'Database setup complete. Please deploy the Edge Function via Supabase Dashboard:' as message
UNION ALL
SELECT '1. Go to https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/functions'
UNION ALL
SELECT '2. Click "New Function"'
UNION ALL
SELECT '3. Name it: submit-booking'
UNION ALL
SELECT '4. Copy the code from /supabase/functions/submit-booking/index.ts'
UNION ALL
SELECT '5. Add environment variable: RECAPTCHA_SECRET_KEY = 6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

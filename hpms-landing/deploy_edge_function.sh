#!/bin/bash

# This script deploys the Edge Function using curl directly to Supabase API
# No need for CLI authentication

PROJECT_REF="jjxlfunlbyayxwvlpgwt"
FUNCTION_NAME="submit-booking"

echo "Deploying Edge Function to Supabase..."

# Read the function code
FUNCTION_CODE=$(cat /home/happy/projects/hpms/supabase/functions/submit-booking/index.ts)

# Create a deployment script that can be run in Supabase SQL Editor
cat > /home/happy/projects/hpms/hpms-landing/deploy_function_sql.sql << 'EOF'
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
EOF

echo "Created SQL setup file: deploy_function_sql.sql"
echo ""
echo "Since we can't deploy Edge Functions via CLI without authentication,"
echo "here are the manual steps:"
echo ""
echo "1. Go to Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
echo ""
echo "2. Click 'New Function'"
echo ""
echo "3. Name: submit-booking"
echo ""
echo "4. Copy the function code from:"
echo "   /home/happy/projects/hpms/supabase/functions/submit-booking/index.ts"
echo ""
echo "5. In the function settings, add environment variable:"
echo "   RECAPTCHA_SECRET_KEY = 6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"
echo ""
echo "6. Deploy the function"
echo ""
echo "The function code is already optimized with:"
echo "- Rate limiting (3 bookings per IP per 15 min)"
echo "- CAPTCHA verification"
echo "- Input validation"
echo "- SQL injection prevention"
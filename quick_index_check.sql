-- Quick manual index check
-- Run this directly in Supabase SQL Editor

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'users',
    'practices',
    'patients',
    'visits',
    'system_notifications',
    'internal_channel_members',
    'practice_sms_subscriptions',
    'practice_email_subscriptions'
  )
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Expected results: 13 rows
-- If you see fewer, indexes are missing
-- If you see 0 rows, no indexes were created

-- Expected indexes:
-- idx_users_practice_id
-- idx_users_role
-- idx_users_email
-- idx_practices_status
-- idx_practices_practice_type_id
-- idx_patients_practice_id
-- idx_visits_practice_id
-- idx_visits_patient_id
-- idx_visits_doctor_id
-- idx_system_notifications_user_id
-- idx_internal_channel_members_user_id
-- idx_practice_sms_subscriptions_practice_id
-- idx_practice_email_subscriptions_practice_id

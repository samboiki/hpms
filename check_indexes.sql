SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members', 'practice_sms_subscriptions', 'practice_email_subscriptions')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

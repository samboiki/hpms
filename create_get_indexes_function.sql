-- Create RPC function to query pg_indexes system view
-- This allows us to check if our performance indexes exist

CREATE OR REPLACE FUNCTION public.get_performance_indexes()
RETURNS TABLE (
  schemaname name,
  tablename name,
  indexname name,
  indexdef text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    schemaname::name,
    tablename::name,
    indexname::name,
    indexdef::text
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members', 'practice_sms_subscriptions', 'practice_email_subscriptions')
    AND indexname LIKE 'idx_%'
  ORDER BY tablename, indexname;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_performance_indexes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_indexes() TO anon;

COMMENT ON FUNCTION public.get_performance_indexes() IS 'Returns all performance indexes created for core tables';

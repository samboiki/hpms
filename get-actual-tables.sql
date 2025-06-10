-- EMERGENCY: Run this in Supabase SQL Editor to get actual table list
-- Copy and paste this entire query into Supabase Dashboard > SQL Editor

SELECT 
  t.table_name,
  (SELECT COUNT(*) 
   FROM information_schema.columns c 
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count,
  pg_size_pretty(pg_total_relation_size('public.'||t.table_name)) as table_size
FROM information_schema.tables t
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT LIKE 'pg_%'
ORDER BY t.table_name;

-- Get column details for critical tables
SELECT 
  table_name,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('practices', 'patients', 'appointments', 'users', 'visits', 'invoices', 'batches')
ORDER BY table_name, ordinal_position;

-- Get row counts for all tables
DO $$
DECLARE
    table_name text;
    row_count int;
BEGIN
    FOR table_name IN 
        SELECT t.table_name 
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
          AND t.table_name NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM public.%I', table_name) INTO row_count;
        RAISE NOTICE 'Table: % | Rows: %', table_name, row_count;
    END LOOP;
END $$;
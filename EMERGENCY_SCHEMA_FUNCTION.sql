-- EMERGENCY SCHEMA EXPORT FUNCTION
-- Execute this in Supabase SQL Editor to create helper function

CREATE OR REPLACE FUNCTION get_emergency_schema()
RETURNS TABLE(
  table_name text,
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  row_count bigint
) AS $$
DECLARE
  t_name text;
  sql_text text;
  row_cnt bigint;
BEGIN
  -- Loop through all tables
  FOR t_name IN 
    SELECT information_schema.tables.table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY information_schema.tables.table_name
  LOOP
    -- Get row count for this table
    sql_text := format('SELECT COUNT(*) FROM public.%I', t_name);
    EXECUTE sql_text INTO row_cnt;
    
    -- Return table structure with row count
    RETURN QUERY
    SELECT 
      t_name as table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      row_cnt as row_count
    FROM information_schema.columns c
    WHERE c.table_name = t_name 
      AND c.table_schema = 'public'
    ORDER BY c.ordinal_position;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_emergency_schema() TO authenticated;

-- Create simplified table list function
CREATE OR REPLACE FUNCTION get_schema_tables()
RETURNS TABLE(
  table_name text,
  column_count bigint,
  row_count bigint
) AS $$
DECLARE
  t_name text;
  sql_text text;
  row_cnt bigint;
  col_cnt bigint;
BEGIN
  FOR t_name IN 
    SELECT information_schema.tables.table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY information_schema.tables.table_name
  LOOP
    -- Get row count
    sql_text := format('SELECT COUNT(*) FROM public.%I', t_name);
    EXECUTE sql_text INTO row_cnt;
    
    -- Get column count
    SELECT COUNT(*) INTO col_cnt
    FROM information_schema.columns c
    WHERE c.table_name = t_name 
      AND c.table_schema = 'public';
    
    RETURN QUERY SELECT t_name, col_cnt, row_cnt;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_schema_tables() TO authenticated;

-- Create critical data export function
CREATE OR REPLACE FUNCTION get_critical_system_info()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'export_time', NOW(),
    'database_version', version(),
    'table_count', (
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ),
    'total_rows', (
      SELECT SUM(n_tup_ins + n_tup_upd) 
      FROM pg_stat_user_tables
    ),
    'practices_count', (SELECT COUNT(*) FROM practices),
    'patients_count', (SELECT COUNT(*) FROM patients),
    'appointments_count', (SELECT COUNT(*) FROM appointments),
    'users_count', (SELECT COUNT(*) FROM users)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_critical_system_info() TO authenticated;
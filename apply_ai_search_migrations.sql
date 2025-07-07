-- Combined AI Search Migrations
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt/sql/new

-- 1. Function to safely execute AI-generated patient search queries
CREATE OR REPLACE FUNCTION execute_ai_query(sql_query TEXT)
RETURNS TABLE(
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  cell_number TEXT,
  date_of_birth DATE,
  gender TEXT,
  marital_status TEXT,
  occupation TEXT,
  employer TEXT,
  home_language TEXT,
  home_address TEXT,
  postal_address TEXT,
  postal_code TEXT,
  created_at TIMESTAMPTZ,
  medical_aid_provider TEXT,
  age INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the query for debugging
  RAISE NOTICE 'Executing AI query: %', sql_query;
  
  -- Security: Only allow SELECT statements
  IF sql_query !~* '^\s*SELECT\s+' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Security: Prevent certain dangerous operations
  IF sql_query ~* '\b(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b' THEN
    RAISE EXCEPTION 'Query contains forbidden operations';
  END IF;
  
  -- Security: Only allow queries on allowed tables
  IF sql_query !~* '\bpatients\b' THEN
    RAISE EXCEPTION 'Query must include patients table';
  END IF;
  
  -- Execute the query and return results
  RETURN QUERY EXECUTE sql_query;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE 'Query execution error: %', SQLERRM;
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_ai_query(TEXT) TO authenticated;

-- 2. Function to get foreign key relationships
CREATE OR REPLACE FUNCTION get_foreign_keys()
RETURNS TABLE(
  table_name text,
  column_name text,
  foreign_table_name text,
  foreign_column_name text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    tc.table_name::text,
    kcu.column_name::text,
    ccu.table_name::text AS foreign_table_name,
    ccu.column_name::text AS foreign_column_name
  FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
  ORDER BY tc.table_name, kcu.column_name;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_foreign_keys() TO service_role;

-- 3. Function to get table information (fallback for direct queries)
CREATE OR REPLACE FUNCTION get_tables_info()
RETURNS TABLE(table_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT table_name::text
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT IN ('schema_migrations')
  ORDER BY table_name;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_tables_info() TO service_role;

-- 4. Function to execute raw SQL (for schema queries only)
CREATE OR REPLACE FUNCTION execute_raw_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow SELECT queries on information_schema
  IF sql_query !~* '^\s*SELECT\s+' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  IF sql_query !~* 'information_schema' THEN
    RAISE EXCEPTION 'Only information_schema queries are allowed';
  END IF;
  
  -- Execute the query and return as JSON
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || sql_query || ') t' INTO result;
  
  RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION execute_raw_sql(TEXT) TO service_role;

-- Test the execute_ai_query function
SELECT * FROM execute_ai_query('SELECT patients.*, NULL::text as medical_aid_provider, EXTRACT(YEAR FROM AGE(patients.date_of_birth))::integer as age FROM patients LIMIT 1');
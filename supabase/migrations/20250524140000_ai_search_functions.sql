-- Function to get table information (fallback for direct queries)
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

-- Function to execute raw SQL (for schema queries only)
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

-- Update the execute_ai_query function to handle the format from the Edge Function
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_tables_info() TO service_role;
GRANT EXECUTE ON FUNCTION execute_raw_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION execute_ai_query(TEXT) TO authenticated;
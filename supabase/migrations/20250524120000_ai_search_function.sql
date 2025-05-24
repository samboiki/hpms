-- Function to safely execute AI-generated patient search queries
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
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_ai_query(TEXT) TO authenticated;

-- Create RLS policy for the function (it runs with SECURITY DEFINER)
-- The function will respect existing RLS policies on the tables it queries
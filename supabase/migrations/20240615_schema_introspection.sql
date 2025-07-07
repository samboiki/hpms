-- Schema Introspection Functions for Real-time Type Awareness

-- Function to get all table schemas with columns
CREATE OR REPLACE FUNCTION get_database_schema()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'tables', (
        SELECT json_agg(
          json_build_object(
            'table_name', t.table_name,
            'columns', (
              SELECT json_agg(
                json_build_object(
                  'column_name', c.column_name,
                  'data_type', c.data_type,
                  'is_nullable', c.is_nullable::boolean,
                  'column_default', c.column_default,
                  'character_maximum_length', c.character_maximum_length,
                  'numeric_precision', c.numeric_precision,
                  'is_primary_key', (
                    EXISTS (
                      SELECT 1
                      FROM information_schema.constraint_column_usage ccu
                      JOIN information_schema.table_constraints tc
                        ON tc.constraint_name = ccu.constraint_name
                      WHERE ccu.table_name = t.table_name
                        AND ccu.column_name = c.column_name
                        AND tc.constraint_type = 'PRIMARY KEY'
                    )
                  ),
                  'foreign_key', (
                    SELECT json_build_object(
                      'references_table', ccu.table_name,
                      'references_column', ccu.column_name
                    )
                    FROM information_schema.key_column_usage kcu
                    JOIN information_schema.constraint_column_usage ccu
                      ON ccu.constraint_name = kcu.constraint_name
                    WHERE kcu.table_name = t.table_name
                      AND kcu.column_name = c.column_name
                      AND kcu.constraint_name LIKE '%_fkey'
                    LIMIT 1
                  )
                )
                ORDER BY c.ordinal_position
              )
              FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name = t.table_name
            ),
            'indexes', (
              SELECT json_agg(
                json_build_object(
                  'index_name', i.indexname,
                  'is_unique', i.indexdef LIKE '%UNIQUE%',
                  'columns', (
                    SELECT array_agg(a.attname)
                    FROM pg_index pi
                    JOIN pg_attribute a ON a.attrelid = pi.indrelid
                    WHERE pi.indexrelid = (i.schemaname||'.'||i.indexname)::regclass
                      AND a.attnum = ANY(pi.indkey)
                  )
                )
              )
              FROM pg_indexes i
              WHERE i.schemaname = 'public'
                AND i.tablename = t.table_name
            )
          )
          ORDER BY t.table_name
        )
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
      ),
      'functions', (
        SELECT json_agg(
          json_build_object(
            'function_name', p.proname,
            'return_type', pg_get_function_result(p.oid),
            'arguments', pg_get_function_arguments(p.oid),
            'language', l.lanname,
            'is_trigger', p.prorettype = 'trigger'::regtype
          )
        )
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        JOIN pg_language l ON p.prolang = l.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
      ),
      'enums', (
        SELECT json_agg(
          json_build_object(
            'enum_name', t.typname,
            'values', (
              SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
              FROM pg_enum e
              WHERE e.enumtypid = t.oid
            )
          )
        )
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.typtype = 'e'
      )
    )
  );
END;
$$;

-- Function to get schema for a specific table
CREATE OR REPLACE FUNCTION get_table_schema(table_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'table_name', table_name,
      'exists', EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ),
      'columns', (
        SELECT json_agg(
          json_build_object(
            'column_name', column_name,
            'data_type', data_type,
            'is_nullable', is_nullable::boolean,
            'column_default', column_default,
            'character_maximum_length', character_maximum_length
          )
          ORDER BY ordinal_position
        )
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
      ),
      'row_count', (
        SELECT COUNT(*) FROM public.patients WHERE 1=1
      )
    )
  );
END;
$$;

-- Function to detect schema changes (for development)
CREATE OR REPLACE FUNCTION get_schema_hash()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  schema_text text;
  hash text;
BEGIN
  -- Get concatenated schema definition
  SELECT string_agg(
    table_name || ':' || 
    column_name || ':' || 
    data_type || ':' || 
    is_nullable,
    ','
    ORDER BY table_name, ordinal_position
  )
  INTO schema_text
  FROM information_schema.columns
  WHERE table_schema = 'public';
  
  -- Generate MD5 hash
  SELECT md5(schema_text) INTO hash;
  
  RETURN hash;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_database_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_schema(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_schema_hash() TO authenticated;
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SqlRequest {
  sql: string;
  operation_type?: 'DDL' | 'DML' | 'SELECT';
  description?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse the request body
    const { sql, operation_type, description }: SqlRequest = await req.json()

    if (!sql) {
      return new Response(
        JSON.stringify({ error: 'SQL query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔍 SQL Execution Request:', {
      operation_type,
      description,
      sql: sql.substring(0, 100) + '...'
    })

    // Security: Validate allowed operations
    const allowedOperations = [
      'ALTER TABLE',
      'CREATE INDEX',
      'CREATE CONSTRAINT',
      'DROP CONSTRAINT',
      'CREATE TRIGGER',
      'DROP TRIGGER',
      'CREATE FUNCTION',
      'CREATE OR REPLACE FUNCTION',
      'DROP FUNCTION',
      'UPDATE',
      'INSERT',
      'DELETE',
      'SELECT'
    ]

    const sqlUpper = sql.trim().toUpperCase()
    const isAllowed = allowedOperations.some(op => sqlUpper.startsWith(op))

    if (!isAllowed) {
      console.error('❌ Blocked SQL operation:', sqlUpper.substring(0, 50))
      return new Response(
        JSON.stringify({ 
          error: 'SQL operation not allowed',
          allowed_operations: allowedOperations
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Execute the SQL
    console.log('✅ Executing allowed SQL operation...')
    const startTime = Date.now()

    // Use rpc to execute raw SQL
    const { data, error } = await supabase.rpc('exec_raw_sql', { 
      sql_query: sql 
    })

    const executionTime = Date.now() - startTime

    if (error) {
      console.error('❌ SQL execution failed:', error)
      
      // If exec_raw_sql doesn't exist, try direct database connection
      if (error.message?.includes('exec_raw_sql')) {
        console.log('📝 exec_raw_sql function not found, creating it...')
        
        // First create the function
        const createFunctionSql = `
          CREATE OR REPLACE FUNCTION exec_raw_sql(sql_query text)
          RETURNS text
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
            result text;
          BEGIN
            EXECUTE sql_query;
            GET DIAGNOSTICS result = ROW_COUNT;
            RETURN 'Executed successfully. Rows affected: ' || result;
          EXCEPTION
            WHEN OTHERS THEN
              RETURN 'Error: ' || SQLERRM;
          END;
          $$;
        `
        
        // Try to create the function and then execute the original SQL
        return new Response(
          JSON.stringify({ 
            error: 'exec_raw_sql function missing',
            solution: 'Please create the exec_raw_sql function first',
            create_function_sql: createFunctionSql,
            original_sql: sql
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: error.message, details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ SQL executed successfully in ${executionTime}ms`)

    // Log the operation for audit trail
    const auditLog = {
      timestamp: new Date().toISOString(),
      operation_type,
      description,
      sql: sql.substring(0, 500), // Truncate for storage
      execution_time_ms: executionTime,
      success: true
    }

    console.log('📋 Audit Log:', auditLog)

    return new Response(
      JSON.stringify({
        success: true,
        result: data,
        execution_time_ms: executionTime,
        audit_log: auditLog
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Edge Function Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
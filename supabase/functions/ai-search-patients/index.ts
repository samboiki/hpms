/// <reference types="https://deno.land/x/types/index.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { decideStaffAccess, deniedResponse, loadCaller } from '../_shared/callerAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': '*'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('AI Search Function called');
    
    // Get environment variables
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    // Only signed-in, active staff may search: the schema lookups below run with the service role key and every
    // search spends the OpenAI key. Patient app logins have no staff row and are refused.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const access = decideStaffAccess(await loadCaller(supabase, req.headers.get('Authorization'), SUPABASE_SERVICE_ROLE_KEY));
    if (!access.allowed) return deniedResponse(access, corsHeaders);

    // Parse request body
    const { query } = await req.json();
    console.log('Search query:', query);
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'No query provided' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    // Fetch database schema dynamically
    console.log('Fetching database schema...');
    
    // Get all tables
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables_info', {});
    
    let schemaInfo = 'DATABASE SCHEMA:\n\n';
    
    // If the RPC doesn't exist, use direct queries
    if (tablesError || !tables) {
      console.log('Using direct information_schema queries...');
      
      // Query information_schema directly
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
        AND table_name NOT IN ('schema_migrations')
        ORDER BY table_name;
      `;
      
      const { data: tableData, error: tableError } = await supabase
        .rpc('execute_raw_sql', { sql_query: tablesQuery });
      
      if (tableError || !tableData) {
        // Fallback to hardcoded essential tables
        console.log('Using hardcoded schema as fallback...');
        const essentialTables = ['patients', 'visits', 'medical_records', 'appointments', 'medical_aid_details', 'vitals', 'lab_results'];
        
        for (const tableName of essentialTables) {
          schemaInfo += `Table: ${tableName}\n`;
          
          // Try to get columns
          const columnsQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = '${tableName}'
            ORDER BY ordinal_position;
          `;
          
          try {
            const { data: columns } = await supabase
              .rpc('execute_raw_sql', { sql_query: columnsQuery });
            
            if (columns) {
              for (const col of columns) {
                schemaInfo += `  - ${col.column_name} (${col.data_type})\n`;
              }
            }
          } catch (e) {
            console.error(`Error fetching columns for ${tableName}:`, e);
          }
          
          schemaInfo += '\n';
        }
      } else {
        // Process tables from query
        for (const table of tableData) {
          schemaInfo += `Table: ${table.table_name}\n`;
          
          // Get columns for each table
          const columnsQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = '${table.table_name}'
            ORDER BY ordinal_position;
          `;
          
          const { data: columns } = await supabase
            .rpc('execute_raw_sql', { sql_query: columnsQuery });
          
          if (columns) {
            for (const col of columns) {
              const nullable = col.is_nullable === 'YES' ? 'nullable' : 'not null';
              schemaInfo += `  - ${col.column_name} (${col.data_type}, ${nullable})\n`;
            }
          }
          
          schemaInfo += '\n';
        }
      }
    } else {
      // Use tables from RPC
      console.log('Using tables from RPC...');
      for (const table of tables) {
        schemaInfo += `Table: ${table.table_name}\n`;
        
        // Get columns for each table
        const columnsQuery = `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${table.table_name}'
          ORDER BY ordinal_position;
        `;
        
        const { data: columns } = await supabase
          .rpc('execute_raw_sql', { sql_query: columnsQuery });
        
        if (columns) {
          for (const col of columns) {
            const nullable = col.is_nullable === 'YES' ? 'nullable' : 'not null';
            schemaInfo += `  - ${col.column_name} (${col.data_type}, ${nullable})\n`;
          }
        }
        
        schemaInfo += '\n';
      }
    }
    
    schemaInfo += `
IMPORTANT NOTES:
- Patient complaints/symptoms are stored in visits.chief_complaint
- Diagnoses are stored in visits.diagnosis and medical_records.diagnosis
- For age calculations: Use EXTRACT(YEAR FROM AGE(date_of_birth))
- Use ILIKE for case-insensitive text searches
- Always return DISTINCT patients when joining with visits to avoid duplicates
`;

    console.log('Schema fetched, calling OpenAI...');
    
    // Create the prompt for OpenAI
    const systemPrompt = `You are a PostgreSQL expert that converts natural language queries into SQL for a healthcare database.

${schemaInfo}

CRITICAL RULES for SQL generation:
1. ONLY include tables/joins that are DIRECTLY MENTIONED or REQUIRED by the query
2. For basic patient queries, just use: SELECT patients.*
3. Only JOIN medical_aid_details if the query mentions: medical aid, insurance, coverage, scheme, provider
4. Only JOIN visits if the query mentions: complaints, symptoms, diagnosis, visit, chief complaint
5. Only JOIN appointments if the query mentions: appointments, scheduled, booking
6. For age calculations: EXTRACT(YEAR FROM AGE(patients.date_of_birth))
7. Use DISTINCT when joining with visits to avoid duplicates
8. Always ORDER BY patients.first_name, patients.last_name
9. Use ILIKE for case-insensitive text searches
10. Be MINIMAL - don't add unnecessary columns or joins

DO NOT automatically include medical_aid_provider unless specifically asked for!

Generate ONLY the SQL query, no explanations.`;

    const userPrompt = `Convert this natural language query to SQL: "${query}"

Examples:
Query: "patients with coughing complaint"
SQL: SELECT DISTINCT patients.* FROM patients INNER JOIN visits ON visits.patient_id = patients.id WHERE visits.chief_complaint ILIKE '%cough%' ORDER BY patients.first_name, patients.last_name;

Query: "patients with coughing over the age of 37"
SQL: SELECT DISTINCT patients.*, EXTRACT(YEAR FROM AGE(patients.date_of_birth)) as age FROM patients INNER JOIN visits ON visits.patient_id = patients.id WHERE visits.chief_complaint ILIKE '%cough%' AND EXTRACT(YEAR FROM AGE(patients.date_of_birth)) > 37 ORDER BY patients.first_name, patients.last_name;

Query: "female patients with medical aid"
SQL: SELECT patients.*, medical_aid_details.provider as medical_aid_provider FROM patients LEFT JOIN medical_aid_details ON patients.id = medical_aid_details.patient_id WHERE patients.gender = 'female' AND medical_aid_details.provider IS NOT NULL ORDER BY patients.first_name, patients.last_name;

Query: "all patients"
SQL: SELECT patients.* FROM patients ORDER BY patients.first_name, patients.last_name;`;

    // Call OpenAI API
    console.log('Calling OpenAI API...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json();
      console.error('OpenAI API error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API error',
          details: error.error?.message || 'Unknown error'
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const openaiData = await openaiResponse.json();
    console.log('OpenAI response:', openaiData);
    
    const sqlQuery = openaiData.choices[0]?.message?.content?.trim();
    
    if (!sqlQuery) {
      console.error('No SQL query generated');
      return new Response(
        JSON.stringify({ error: 'No SQL query generated' }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    // Clean up the SQL query
    const cleanedQuery = sqlQuery
      .replace(/```sql/gi, '')
      .replace(/```/g, '')
      .replace(/^SQL:\s*/i, '')
      .trim();
    
    console.log('Generated SQL:', cleanedQuery);
    
    // Just return the SQL query without executing it
    // Let the frontend handle the execution
    return new Response(
      JSON.stringify({ 
        sql_query: cleanedQuery,
        success: true,
        description: `AI Search: ${query}`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in AI search function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
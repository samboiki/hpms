import { createClient } from '@supabase/supabase-js';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkDepartmentsColumns() {
  console.log('🔍 Checking departments table columns...\n');

  try {
    // First, check if departments table exists by trying to select from it
    console.log('1. Checking if departments table exists...');
    const { data: testData, error: testError } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (testError) {
      if (testError.code === '42P01') {
        console.log('❌ departments table does not exist');
        return;
      } else {
        console.log('⚠️  departments table exists but got error:', testError.message);
      }
    } else {
      console.log('✅ departments table exists');
    }

    // Try different approaches to get column information
    console.log('\n2. Attempting to get column information...');

    // Approach 1: Try with different RPC function names
    const rpcFunctions = ['exec_raw_sql', 'execute_sql', 'run_sql'];

    for (const funcName of rpcFunctions) {
      console.log(`   Trying ${funcName}...`);
      try {
        const { data, error } = await supabase.rpc(funcName, {
          sql_query: `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'departments'
            AND table_schema = 'public'
            ORDER BY ordinal_position;
          `
        });

        if (!error && data) {
          console.log('✅ Successfully retrieved column information!');
          console.log('📋 Columns in departments table:');
          console.log('------------------------------------');
          data.forEach((column, index) => {
            console.log(`${index + 1}. ${column.column_name} (${column.data_type})`);
          });

          console.log(`\n✅ Found ${data.length} columns in departments table`);

          // Check if specific columns exist
          const columnNames = data.map(col => col.column_name);
          const expectedColumns = ['id', 'name', 'description', 'created_at', 'updated_at'];

          console.log('\n🎯 Column check:');
          expectedColumns.forEach(expectedCol => {
            const exists = columnNames.includes(expectedCol);
            console.log(`  ${exists ? '✅' : '❌'} ${expectedCol}`);
          });
          return;
        }
      } catch (e) {
        // Continue to next function
      }
    }

    // Approach 2: Try to infer columns from an actual query
    console.log('\n3. Attempting to infer columns from table structure...');
    try {
      // Get one row to see the column structure
      const { data: sampleRow, error: sampleError } = await supabase
        .from('departments')
        .select('*')
        .limit(1)
        .single();

      if (sampleRow) {
        console.log('✅ Inferred columns from sample data:');
        console.log('📋 Columns in departments table:');
        console.log('------------------------------------');
        Object.keys(sampleRow).forEach((columnName, index) => {
          const value = sampleRow[columnName];
          const inferredType = typeof value === 'string' ? 'text' :
                              typeof value === 'number' ? 'numeric' :
                              value instanceof Date ? 'timestamp' :
                              'unknown';
          console.log(`${index + 1}. ${columnName} (${inferredType}) = ${value}`);
        });

        console.log(`\n✅ Found ${Object.keys(sampleRow).length} columns in departments table`);

        // Check if specific columns exist
        const columnNames = Object.keys(sampleRow);
        const expectedColumns = ['id', 'name', 'description', 'created_at', 'updated_at'];

        console.log('\n🎯 Column check:');
        expectedColumns.forEach(expectedCol => {
          const exists = columnNames.includes(expectedCol);
          console.log(`  ${exists ? '✅' : '❌'} ${expectedCol}`);
        });
        return;
      }
    } catch (e) {
      console.log('⚠️  No sample data available or table is empty');
    }

    console.log('❌ Could not retrieve column information using any method');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function main() {
  console.log('🚀 Departments Table Column Checker\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  await checkDepartmentsColumns();

  console.log('\n✅ Check complete!');
}

main().catch(console.error);
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function addDepartmentColumns() {
  console.log('🚀 MCP SQL Executor - Adding Department Columns');
  console.log('================================================\n');

  try {
    // First check if we can connect
    const { data: depts, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (deptError) {
      console.log('❌ Cannot connect to departments table:', deptError.message);
      return;
    }

    console.log('✅ Connected to Supabase successfully!');

    if (depts && depts.length > 0) {
      const dept = depts[0];
      console.log('\n📊 Current department columns:');
      console.log('  - contact_email:', 'contact_email' in dept ? '✅ EXISTS' : '❌ MISSING');
      console.log('  - contact_phone:', 'contact_phone' in dept ? '✅ EXISTS' : '❌ MISSING');
      console.log('  - description:', 'description' in dept ? '✅ EXISTS' : '❌ MISSING');
    }

    console.log('\n🔧 Attempting to add columns via exec_sql function...');

    // Try to execute SQL using RPC function
    const { data: result, error: rpcError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE departments
        ADD COLUMN IF NOT EXISTS contact_email TEXT,
        ADD COLUMN IF NOT EXISTS contact_phone TEXT;
      `
    });

    if (rpcError) {
      console.log('ℹ️  exec_sql function not available:', rpcError.message);

      // Try alternative approach - create a stored function
      console.log('\n🔧 Creating stored function for column addition...');

      const { data: funcResult, error: funcError } = await supabase.rpc('create_function', {
        definition: `
          CREATE OR REPLACE FUNCTION add_department_columns()
          RETURNS void AS $$
          BEGIN
            ALTER TABLE departments ADD COLUMN IF NOT EXISTS contact_email TEXT;
            ALTER TABLE departments ADD COLUMN IF NOT EXISTS contact_phone TEXT;
          END;
          $$ LANGUAGE plpgsql;
        `
      });

      if (funcError) {
        console.log('ℹ️  Cannot create function:', funcError.message);

        console.log('\n⚠️  Direct SQL execution not available through REST API');
        console.log('📋 Please run this SQL in Supabase Dashboard:');
        console.log('-------------------------------------------');
        console.log('ALTER TABLE departments');
        console.log('ADD COLUMN IF NOT EXISTS contact_email TEXT,');
        console.log('ADD COLUMN IF NOT EXISTS contact_phone TEXT;');
        console.log('-------------------------------------------');
        console.log('🔗 https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql');
      } else {
        console.log('✅ Function created! Executing...');
        const { error: execError } = await supabase.rpc('add_department_columns');
        if (!execError) {
          console.log('✅ Columns added successfully!');
        }
      }
    } else {
      console.log('✅ SQL executed successfully!');
      console.log('Result:', result);
    }

    // Verify the columns were added
    console.log('\n🔍 Verifying columns...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (verifyData && verifyData.length > 0) {
      const dept = verifyData[0];
      console.log('\n✅ Final column status:');
      console.log('  - contact_email:', 'contact_email' in dept ? '✅ EXISTS' : '❌ STILL MISSING');
      console.log('  - contact_phone:', 'contact_phone' in dept ? '✅ EXISTS' : '❌ STILL MISSING');
      console.log('  - description:', 'description' in dept ? '✅ EXISTS' : '❌ STILL MISSING');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Execute
addDepartmentColumns();
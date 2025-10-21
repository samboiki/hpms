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

async function addContactColumnsToDepartments() {
  console.log('🏥 Adding contact columns to departments table...\n');

  try {
    // First check if departments table exists by trying to query it
    const { data: testData, error: tableError } = await supabase
      .from('departments')
      .select('id')
      .limit(1);

    if (tableError) {
      console.log('❌ Error accessing departments table:', tableError.message);
      console.log('This could mean the table does not exist or there are permission issues');
      return;
    }

    console.log('✅ departments table exists and is accessible');

    // Try to execute the ALTER TABLE command directly since column checking is complex
    console.log('🔧 Executing SQL to add contact columns to departments table...');

    // Execute the ALTER TABLE command
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE departments
        ADD COLUMN IF NOT EXISTS contact_email TEXT,
        ADD COLUMN IF NOT EXISTS contact_phone TEXT;
      `
    });

    if (error) {
      console.log('❌ Error executing SQL:', error.message);
      console.log('🔧 Please execute the following SQL manually in Supabase dashboard:');
      console.log(`
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;
      `);
      return;
    }

    console.log('✅ Successfully added contact columns to departments table!');

    // Try to verify by doing a simple query
    try {
      const { data: testQuery, error: testError } = await supabase
        .from('departments')
        .select('id, contact_email, contact_phone')
        .limit(1);

      if (!testError) {
        console.log('📋 Verification: Successfully queried new contact columns');
      } else {
        console.log('⚠️  Could not verify columns, but SQL was executed');
      }
    } catch (e) {
      console.log('⚠️  Could not verify columns, but SQL was executed');
    }

  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    console.log('🔧 Please execute the following SQL manually in Supabase dashboard:');
    console.log(`
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    `);
  }
}

async function main() {
  console.log('🚀 Add Contact Columns to Departments\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  await addContactColumnsToDepartments();

  console.log('\n✅ Operation complete!');
}

main().catch(console.error);
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
    const { data: testQuery, error: tableError } = await supabase
      .from('departments')
      .select('id')
      .limit(1);

    if (tableError) {
      console.log('❌ Error: departments table does not exist or is not accessible');
      console.log('   Error details:', tableError.message);
      return;
    }

    console.log('✅ departments table exists and is accessible');

    // Try to query a sample record to check current columns
    const { data: sampleData, error: sampleError } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('❌ Error querying departments table:', sampleError.message);
      return;
    }

    // Check current columns in the sample data
    const currentColumns = sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

    console.log('📋 Current columns in departments table:', currentColumns.join(', '));

    if (currentColumns.includes('contact_email') && currentColumns.includes('contact_phone')) {
      console.log('✅ Both contact_email and contact_phone columns already exist in departments table');
      return;
    }

    if (currentColumns.includes('contact_email')) {
      console.log('ℹ️  contact_email column already exists');
    }

    if (currentColumns.includes('contact_phone')) {
      console.log('ℹ️  contact_phone column already exists');
    }

    console.log('🔧 The following SQL needs to be executed manually in Supabase dashboard:');
    console.log('📋 Copy and paste this SQL into the SQL Editor in your Supabase dashboard:\n');

    const sqlCommands = [];

    if (!currentColumns.includes('contact_email')) {
      sqlCommands.push('ALTER TABLE departments ADD COLUMN IF NOT EXISTS contact_email TEXT;');
    }

    if (!currentColumns.includes('contact_phone')) {
      sqlCommands.push('ALTER TABLE departments ADD COLUMN IF NOT EXISTS contact_phone TEXT;');
    }

    sqlCommands.forEach(cmd => {
      console.log(`${cmd}`);
    });

    console.log('\n💡 To execute:');
    console.log('1. Go to https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt');
    console.log('2. Click on "SQL Editor" in the sidebar');
    console.log('3. Paste the SQL commands above');
    console.log('4. Click "Run" to execute');

    // Try to verify after manual execution hint
    console.log('\n🔍 After executing the SQL, you can verify with:');
    console.log('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'departments\' AND column_name IN (\'contact_email\', \'contact_phone\');');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Add Contact Columns to Departments Tool\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  await addContactColumnsToDepartments();

  console.log('\n✅ Process complete!');
}

main().catch(console.error);
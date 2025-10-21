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

async function main() {
  console.log('🚀 Executing Department Contact Columns Migration\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  try {
    // First, verify departments table exists
    const { data: testData, error: testError } = await supabase
      .from('departments')
      .select('id')
      .limit(1);

    if (testError) {
      console.log('❌ Cannot access departments table:', testError.message);
      return;
    }

    console.log('✅ departments table is accessible');

    // Since we cannot execute DDL directly, let's create the migration using Supabase CLI approach
    console.log('🔧 Creating migration file for contact columns...');

    // Use the suggested execute_raw_sql function
    const { data, error } = await supabase.rpc('execute_raw_sql', {
      query: `
        ALTER TABLE departments
        ADD COLUMN IF NOT EXISTS contact_email TEXT,
        ADD COLUMN IF NOT EXISTS contact_phone TEXT;
      `
    });

    if (!error) {
      console.log('✅ Successfully executed ALTER TABLE command!');
      console.log('📄 SQL execution result:', data);

      // Verify the columns were added
      const { data: verifyData, error: verifyError } = await supabase
        .from('departments')
        .select('id, contact_email, contact_phone')
        .limit(1);

      if (!verifyError) {
        console.log('📋 Verification: New contact columns are accessible');
      } else {
        console.log('⚠️  Columns may have been added but verification failed:', verifyError.message);
      }
    } else {
      console.log('❌ Failed to execute SQL:', error.message);
      console.log('\n🔧 Please execute this SQL manually in the Supabase Dashboard SQL Editor:');
      console.log(`
-- Add contact columns to departments table
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'departments'
  AND table_schema = 'public'
  AND column_name IN ('contact_email', 'contact_phone');
      `);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\n🔧 Please execute this SQL manually in the Supabase Dashboard SQL Editor:');
    console.log(`
-- Add contact columns to departments table
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'departments'
  AND table_schema = 'public'
  AND column_name IN ('contact_email', 'contact_phone');
    `);
  }

  console.log('\n✅ Migration process complete!');
}

main().catch(console.error);
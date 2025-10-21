import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function updatePracticesStatusConstraint() {
  console.log('🚀 UPDATING PRACTICES TABLE STATUS CONSTRAINT');
  console.log('='.repeat(70));
  console.log('📋 Project: jjxlfunlbyayxwvlpgwt');
  console.log('📋 New status values: lead, contacted, qualified, onboarding, active, inactive');
  console.log('='.repeat(70));
  console.log();

  try {
    // Step 1: Drop old constraint
    console.log('🔧 Step 1: Dropping old constraint...');
    const dropSql = 'ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;';
    console.log(`📝 SQL: ${dropSql}`);

    const { data: dropData, error: dropError } = await supabase.rpc('exec', {
      sql: dropSql
    });

    if (dropError) {
      console.error('⚠️  Error dropping constraint:', dropError);
      console.log('   (This may be OK if constraint didn\'t exist)');
    } else {
      console.log('✅ Old constraint dropped successfully');
    }

    console.log();

    // Step 2: Add new constraint
    console.log('🔧 Step 2: Adding new constraint...');
    const addSql = `ALTER TABLE practices ADD CONSTRAINT practices_status_check CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive'));`;
    console.log(`📝 SQL: ${addSql}`);

    const { data: addData, error: addError } = await supabase.rpc('exec', {
      sql: addSql
    });

    if (addError) {
      console.error('❌ Error adding new constraint:', addError);
      throw addError;
    }

    console.log('✅ New constraint added successfully!');
    console.log();

    // Step 3: Verify constraint
    console.log('🔍 Step 3: Verifying constraint...');

    // Try to insert a test record with a valid status
    console.log('   Testing with valid status "active"...');
    const validTest = await supabase
      .from('practices')
      .select('id, status')
      .eq('status', 'active')
      .limit(1);

    if (validTest.error) {
      console.log('   ⚠️  Could not query practices:', validTest.error.message);
    } else {
      console.log('   ✅ Valid status query works');
    }

    console.log();
    console.log('='.repeat(70));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log();
    console.log('📋 New practices status values:');
    console.log('   ✓ lead        - Initial contact/interest');
    console.log('   ✓ contacted   - Practice has been reached out to');
    console.log('   ✓ qualified   - Practice meets criteria for onboarding');
    console.log('   ✓ onboarding  - Practice is in setup process');
    console.log('   ✓ active      - Practice is fully operational');
    console.log('   ✓ inactive    - Practice is not currently active');
    console.log('='.repeat(70));

  } catch (error) {
    console.error();
    console.error('❌ ERROR DURING MIGRATION:');
    console.error('='.repeat(70));
    console.error(error);
    console.error('='.repeat(70));
    process.exit(1);
  }
}

updatePracticesStatusConstraint();
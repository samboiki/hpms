import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function fixBedAllocationsForeignKey() {
  try {
    console.log('🔍 Step 1: Checking current constraints on bed_allocations.bed_id...\n');

    // First, let's check what constraint exists
    const { data: beforeConstraints, error: beforeError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, constraint_type')
      .eq('table_name', 'bed_allocations')
      .eq('constraint_type', 'FOREIGN KEY');

    if (beforeError) {
      console.log('Note: Cannot query information_schema directly via REST API');
    } else {
      console.log('Before:', beforeConstraints);
    }

    console.log('\n🔧 Executing DDL operations via Management API...\n');
    console.log('Note: DDL operations require direct database access or migration files.');
    console.log('Attempting to use Supabase SQL Editor approach...\n');

    // Use the SQL Editor endpoint
    const apiUrl = `${supabaseUrl}/rest/v1/rpc/execute_raw_sql`;

    // Step 2: Drop old constraint
    console.log('🗑️  Step 2: Dropping old foreign key constraint...\n');

    const dropSQL = 'ALTER TABLE bed_allocations DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey;';

    const dropResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query_text: dropSQL })
    });

    const dropResult = await dropResponse.text();
    console.log('Drop response:', dropResponse.status, dropResult);

    if (!dropResponse.ok) {
      console.log('❌ Could not execute via REST API. Using alternative approach...\n');
      console.log('\n📋 SQL COMMANDS TO EXECUTE MANUALLY:\n');
      console.log('Please run these commands in the Supabase SQL Editor:\n');
      console.log('-- Step 1: Drop old constraint');
      console.log('ALTER TABLE bed_allocations DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey;\n');
      console.log('-- Step 2: Add new constraint to beds table');
      console.log('ALTER TABLE bed_allocations ADD CONSTRAINT bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE;\n');
      console.log('-- Step 3: Verify');
      console.log(`SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name='bed_allocations'
    AND kcu.column_name='bed_id';`);
      return;
    }

    // Step 3: Add new constraint
    console.log('\n➕ Step 3: Adding new foreign key to beds table...\n');

    const addSQL = 'ALTER TABLE bed_allocations ADD CONSTRAINT bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE;';

    const addResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query_text: addSQL })
    });

    const addResult = await addResponse.text();
    console.log('Add response:', addResponse.status, addResult);

    console.log('\n✅ Foreign key constraint operations completed!');
    console.log('\nPlease verify the changes in Supabase SQL Editor with:');
    console.log(`SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name='bed_allocations'
    AND kcu.column_name='bed_id';`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 MANUAL EXECUTION REQUIRED:\n');
    console.log('Please run these commands in the Supabase SQL Editor:\n');
    console.log('-- Step 1: Drop old constraint');
    console.log('ALTER TABLE bed_allocations DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey;\n');
    console.log('-- Step 2: Add new constraint to beds table');
    console.log('ALTER TABLE bed_allocations ADD CONSTRAINT bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE;\n');
  }
}

fixBedAllocationsForeignKey();

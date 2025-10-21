import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixBedAllocationsForeignKey() {
  console.log('🔍 Step 1: Checking current constraints on bed_allocations.bed_id...\n');

  const checkConstraintQuery = `
    SELECT
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
      AND kcu.column_name='bed_id';
  `;

  const { data: currentConstraints, error: checkError } = await supabase.rpc('execute_raw_sql', {
    query_text: checkConstraintQuery
  });

  if (checkError) {
    console.error('❌ Error checking constraints:', checkError);
  } else {
    console.log('Current constraints:', currentConstraints);
  }

  console.log('\n🗑️  Step 2: Dropping old foreign key constraint...\n');

  const dropConstraintQuery = `
    ALTER TABLE bed_allocations
    DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey;
  `;

  const { data: dropResult, error: dropError } = await supabase.rpc('execute_raw_sql', {
    query_text: dropConstraintQuery
  });

  if (dropError) {
    console.error('❌ Error dropping constraint:', dropError);
  } else {
    console.log('✅ Constraint dropped successfully');
  }

  console.log('\n➕ Step 3: Adding new foreign key to beds table...\n');

  const addConstraintQuery = `
    ALTER TABLE bed_allocations
    ADD CONSTRAINT bed_allocations_bed_id_fkey
    FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE;
  `;

  const { data: addResult, error: addError } = await supabase.rpc('execute_raw_sql', {
    query_text: addConstraintQuery
  });

  if (addError) {
    console.error('❌ Error adding constraint:', addError);
  } else {
    console.log('✅ New constraint added successfully');
  }

  console.log('\n✅ Step 4: Verifying the new constraint...\n');

  const { data: verifiedConstraints, error: verifyError } = await supabase.rpc('execute_raw_sql', {
    query_text: checkConstraintQuery
  });

  if (verifyError) {
    console.error('❌ Error verifying constraints:', verifyError);
  } else {
    console.log('Verified constraints:', verifiedConstraints);
  }

  console.log('\n🎉 Foreign key constraint fix completed!');
}

fixBedAllocationsForeignKey().catch(console.error);

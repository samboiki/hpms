import pkg from 'pg';
const { Client } = pkg;

async function fixMedicalAidRLS() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check current RLS policies
    console.log('\n📋 Checking current RLS policies for medical_aid_details...');
    const currentPolicies = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'medical_aid_details'
      ORDER BY policyname;
    `);
    
    console.log('Current policies:', currentPolicies.rows);

    // Check if RLS is enabled
    const rlsStatus = await client.query(`
      SELECT schemaname, tablename, rowsecurity, forcerowsecurity
      FROM pg_tables 
      WHERE tablename = 'medical_aid_details';
    `);
    
    console.log('RLS Status:', rlsStatus.rows);

    // Drop all existing policies
    console.log('\n🗑️ Dropping existing RLS policies...');
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "Enable insert for authenticated users" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "Enable update for authenticated users" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "Enable delete for authenticated users" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_details_select_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_details_insert_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_details_update_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_details_delete_policy" ON medical_aid_details;'
    ];

    for (const policy of dropPolicies) {
      try {
        await client.query(policy);
        console.log(`✅ Dropped policy: ${policy.split('"')[1]}`);
      } catch (error) {
        console.log(`ℹ️ Policy not found: ${policy.split('"')[1]}`);
      }
    }

    // Create comprehensive RLS policies
    console.log('\n🔒 Creating comprehensive RLS policies...');
    
    const newPolicies = [
      // SELECT policy - allow authenticated users to read medical aid details
      `CREATE POLICY "medical_aid_select_policy" ON medical_aid_details
       FOR SELECT
       USING (auth.role() = 'authenticated');`,
      
      // INSERT policy - allow authenticated users to insert medical aid details
      `CREATE POLICY "medical_aid_insert_policy" ON medical_aid_details
       FOR INSERT
       WITH CHECK (auth.role() = 'authenticated');`,
      
      // UPDATE policy - allow authenticated users to update medical aid details
      `CREATE POLICY "medical_aid_update_policy" ON medical_aid_details
       FOR UPDATE
       USING (auth.role() = 'authenticated')
       WITH CHECK (auth.role() = 'authenticated');`,
      
      // DELETE policy - allow authenticated users to delete medical aid details
      `CREATE POLICY "medical_aid_delete_policy" ON medical_aid_details
       FOR DELETE
       USING (auth.role() = 'authenticated');`
    ];

    for (const policy of newPolicies) {
      await client.query(policy);
      const policyName = policy.match(/"([^"]+)"/)[1];
      console.log(`✅ Created policy: ${policyName}`);
    }

    // Ensure RLS is enabled
    console.log('\n🔐 Ensuring RLS is enabled...');
    await client.query('ALTER TABLE medical_aid_details ENABLE ROW LEVEL SECURITY;');
    console.log('✅ RLS enabled on medical_aid_details');

    // Verify new policies
    console.log('\n✅ Verifying new policies...');
    const newPoliciesCheck = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'medical_aid_details'
      ORDER BY policyname;
    `);
    
    console.log('New policies created:');
    newPoliciesCheck.rows.forEach(policy => {
      console.log(`- ${policy.policyname} (${policy.cmd})`);
    });

    // Test insert capability
    console.log('\n🧪 Testing insert capability...');
    try {
      const testInsert = await client.query(`
        INSERT INTO medical_aid_details (
          patient_id, provider, scheme_name, member_number, main_member_name
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', 'TEST_PROVIDER', 'TEST_SCHEME', 'TEST123', 'Test Member'
        ) RETURNING id;
      `);
      
      const testId = testInsert.rows[0].id;
      console.log('✅ Test insert successful, ID:', testId);
      
      // Clean up test record
      await client.query('DELETE FROM medical_aid_details WHERE id = $1;', [testId]);
      console.log('✅ Test record cleaned up');
      
    } catch (testError) {
      console.log('❌ Test insert failed:', testError.message);
    }

    console.log('\n🎉 Medical aid RLS policies fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing medical aid RLS:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Execute if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  fixMedicalAidRLS().catch(console.error);
}

export { fixMedicalAidRLS };
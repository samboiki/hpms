const { Client } = require('pg');

async function fixMedicalAidRLS() {
  const client = new Client({
    host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'T@ngisasa200',
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

    // Drop all existing policies first
    console.log('\n🗑️ Dropping existing RLS policies...');
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "Enable insert for authenticated users" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "Enable update for authenticated users" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "Enable delete for authenticated users" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_details_select_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_details_insert_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_details_update_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_details_delete_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_select_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_insert_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_update_policy" ON medical_aid_details;',
      'DROP POLICY IF EXISTS "medical_aid_delete_policy" ON medical_aid_details;'
    ];

    for (const policy of dropPolicies) {
      try {
        await client.query(policy);
        console.log(`✅ Dropped policy`);
      } catch (error) {
        console.log(`ℹ️ Policy not found or already dropped`);
      }
    }

    // Create simple, permissive RLS policies
    console.log('\n🔒 Creating new RLS policies...');
    
    const newPolicies = [
      // Allow all authenticated users to SELECT
      `CREATE POLICY "Allow authenticated select" ON medical_aid_details
       FOR SELECT
       TO authenticated
       USING (true);`,
      
      // Allow all authenticated users to INSERT
      `CREATE POLICY "Allow authenticated insert" ON medical_aid_details
       FOR INSERT
       TO authenticated
       WITH CHECK (true);`,
      
      // Allow all authenticated users to UPDATE
      `CREATE POLICY "Allow authenticated update" ON medical_aid_details
       FOR UPDATE
       TO authenticated
       USING (true)
       WITH CHECK (true);`,
      
      // Allow all authenticated users to DELETE
      `CREATE POLICY "Allow authenticated delete" ON medical_aid_details
       FOR DELETE
       TO authenticated
       USING (true);`
    ];

    for (const policy of newPolicies) {
      await client.query(policy);
      console.log(`✅ Created policy`);
    }

    // Ensure RLS is enabled
    console.log('\n🔐 Enabling RLS...');
    await client.query('ALTER TABLE medical_aid_details ENABLE ROW LEVEL SECURITY;');
    console.log('✅ RLS enabled');

    // Grant necessary permissions
    console.log('\n👥 Granting permissions...');
    await client.query('GRANT ALL ON medical_aid_details TO authenticated;');
    await client.query('GRANT ALL ON medical_aid_details TO anon;');
    console.log('✅ Permissions granted');

    // Verify policies
    console.log('\n✅ Verifying new policies...');
    const verifyPolicies = await client.query(`
      SELECT policyname, cmd
      FROM pg_policies 
      WHERE tablename = 'medical_aid_details'
      ORDER BY policyname;
    `);
    
    console.log('Active policies:');
    verifyPolicies.rows.forEach(policy => {
      console.log(`- ${policy.policyname} (${policy.cmd})`);
    });

    console.log('\n🎉 Medical aid RLS policies fixed successfully!');
    console.log('You can now insert, update, and delete medical aid details.');

  } catch (error) {
    console.error('❌ Error fixing medical aid RLS:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  fixMedicalAidRLS().catch(console.error);
}

module.exports = { fixMedicalAidRLS };
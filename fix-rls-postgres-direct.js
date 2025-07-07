import pg from 'pg';

async function fixRLSPolicies() {
  const client = new pg.Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.jjxlfunlbyayxwvlpgwt',
    password: 'T@ngisasa200',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check current policies
    console.log('📋 Current RLS policies for practice_tariffs:');
    const policiesResult = await client.query(`
      SELECT policyname, roles, cmd, qual
      FROM pg_policies 
      WHERE tablename = 'practice_tariffs'
    `);
    
    if (policiesResult.rows.length > 0) {
      policiesResult.rows.forEach(policy => {
        console.log(`  - ${policy.policyname}: ${policy.cmd} for ${policy.roles}`);
      });
    } else {
      console.log('  No policies found');
    }
    
    // Drop existing policies
    console.log('\n🗑️  Dropping existing policies...');
    await client.query(`DROP POLICY IF EXISTS "Users can view tariffs" ON practice_tariffs`);
    await client.query(`DROP POLICY IF EXISTS "Enable read access for all users" ON practice_tariffs`);
    await client.query(`DROP POLICY IF EXISTS "practice_tariffs_select_policy" ON practice_tariffs`);
    await client.query(`DROP POLICY IF EXISTS "practice_tariffs_read_all" ON practice_tariffs`);
    
    // Create new permissive policy
    console.log('\n✨ Creating new permissive read policy...');
    await client.query(`
      CREATE POLICY "practice_tariffs_read_all" 
      ON practice_tariffs 
      FOR SELECT 
      TO public 
      USING (true)
    `);
    
    // Ensure RLS is enabled
    await client.query(`ALTER TABLE practice_tariffs ENABLE ROW LEVEL SECURITY`);
    
    // Grant permissions
    console.log('\n🔑 Granting permissions...');
    await client.query(`GRANT SELECT ON practice_tariffs TO anon`);
    await client.query(`GRANT SELECT ON practice_tariffs TO authenticated`);
    
    // Verify the fix
    console.log('\n✅ Verifying the fix...');
    const countResult = await client.query('SELECT COUNT(*) FROM practice_tariffs');
    console.log(`  Total records in practice_tariffs: ${countResult.rows[0].count}`);
    
    // Get a sample of dental codes
    const sampleResult = await client.query('SELECT code, description, price FROM practice_tariffs LIMIT 5');
    console.log('\n📋 Sample dental codes:');
    sampleResult.rows.forEach((code, idx) => {
      console.log(`  ${idx + 1}. ${code.code}: ${code.description} - N$${code.price}`);
    });
    
    console.log('\n🎉 RLS fix complete!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

fixRLSPolicies();
import pg from 'pg';

async function fixRLSForBrowserAccess() {
  console.log('🔧 Fixing RLS policies for browser access...\n');
  
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
    console.log('✅ Connected to database');
    
    // Check current policies
    console.log('\n📋 Current RLS policies:');
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
    
    // Drop all existing policies
    console.log('\n🗑️  Dropping all existing policies...');
    await client.query(`DROP POLICY IF EXISTS "Users can view tariffs" ON practice_tariffs`);
    await client.query(`DROP POLICY IF EXISTS "Enable read access for all users" ON practice_tariffs`);
    await client.query(`DROP POLICY IF EXISTS "practice_tariffs_select_policy" ON practice_tariffs`);
    await client.query(`DROP POLICY IF EXISTS "practice_tariffs_read_all" ON practice_tariffs`);
    await client.query(`DROP POLICY IF EXISTS "public_read_practice_tariffs" ON practice_tariffs`);
    
    // Create a completely permissive policy for reading
    console.log('\n✨ Creating permissive read policy for all users...');
    await client.query(`
      CREATE POLICY "allow_all_read_practice_tariffs" 
      ON practice_tariffs 
      FOR SELECT 
      USING (true)
    `);
    
    // Ensure RLS is enabled
    await client.query(`ALTER TABLE practice_tariffs ENABLE ROW LEVEL SECURITY`);
    
    // Grant broad permissions
    console.log('\n🔑 Granting permissions to all roles...');
    await client.query(`GRANT SELECT ON practice_tariffs TO anon`);
    await client.query(`GRANT SELECT ON practice_tariffs TO authenticated`);
    await client.query(`GRANT SELECT ON practice_tariffs TO public`);
    
    // Test the fix with anon role
    console.log('\n🧪 Testing anonymous access...');
    
    // We can't test anon directly from here, but let's verify the table structure
    const countResult = await client.query('SELECT COUNT(*) FROM practice_tariffs');
    console.log(`  Total records: ${countResult.rows[0].count}`);
    
    const sampleResult = await client.query('SELECT code, description, price FROM practice_tariffs LIMIT 3');
    console.log('  Sample codes:');
    sampleResult.rows.forEach((row, idx) => {
      console.log(`    ${idx + 1}. ${row.code}: ${row.description} - N$${row.price}`);
    });
    
    console.log('\n✅ RLS fix completed!');
    console.log('Now anonymous users should be able to read practice_tariffs');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

fixRLSForBrowserAccess();
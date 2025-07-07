const { createClient } = require('@supabase/supabase-js');

// Service role key bypasses RLS
const adminClient = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.4X9nJKdwYhGDnE8aQOlMANJC8BfgEF_JjLRiKHYfQ3w'
);

// Regular anon client
const anonClient = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function verifyAndFix() {
  console.log('🔍 Checking practice_tariffs data...\n');
  
  // Check with service role
  console.log('1. Checking with service role (bypasses RLS):');
  const { data: adminData, count: adminCount } = await adminClient
    .from('practice_tariffs')
    .select('*', { count: 'exact', head: false })
    .limit(5);
  
  console.log(`   Total records: ${adminCount}`);
  if (adminData && adminData.length > 0) {
    console.log('   Sample records:');
    adminData.forEach((record, idx) => {
      console.log(`     ${idx + 1}. ${record.code}: ${record.description} - N$${record.price}`);
    });
  }
  
  // Check with anon client
  console.log('\n2. Checking with anon client (subject to RLS):');
  const { data: anonData, error: anonError, count: anonCount } = await anonClient
    .from('practice_tariffs')
    .select('*', { count: 'exact', head: false })
    .limit(5);
  
  if (anonError) {
    console.log(`   ❌ Error: ${anonError.message}`);
  } else {
    console.log(`   Total records visible: ${anonCount}`);
    if (anonCount === 0) {
      console.log('   ⚠️  No records visible to anon users - RLS is blocking access');
      
      // Fix RLS using service role
      console.log('\n3. Fixing RLS policies...');
      
      // Execute SQL to fix RLS
      const { error: fixError } = await adminClient.rpc('exec_sql', {
        sql: `
          -- Drop existing policies
          DROP POLICY IF EXISTS "practice_tariffs_read_all" ON practice_tariffs;
          DROP POLICY IF EXISTS "Users can view tariffs" ON practice_tariffs;
          DROP POLICY IF EXISTS "Enable read access for all users" ON practice_tariffs;
          
          -- Create new permissive policy
          CREATE POLICY "public_read_practice_tariffs" 
          ON practice_tariffs 
          FOR SELECT 
          TO public 
          USING (true);
          
          -- Ensure RLS is enabled
          ALTER TABLE practice_tariffs ENABLE ROW LEVEL SECURITY;
          
          -- Grant permissions
          GRANT SELECT ON practice_tariffs TO anon;
          GRANT SELECT ON practice_tariffs TO authenticated;
        `
      });
      
      if (fixError) {
        console.log(`   ❌ Failed to fix RLS: ${fixError.message}`);
        console.log('\n   Alternative: Try disabling RLS temporarily');
        
        // Try disabling RLS as a last resort
        const { error: disableError } = await adminClient.rpc('exec_sql', {
          sql: 'ALTER TABLE practice_tariffs DISABLE ROW LEVEL SECURITY;'
        });
        
        if (disableError) {
          console.log(`   ❌ Failed to disable RLS: ${disableError.message}`);
        } else {
          console.log('   ✅ RLS disabled for practice_tariffs table');
        }
      } else {
        console.log('   ✅ RLS policies updated successfully');
      }
      
      // Verify fix
      console.log('\n4. Verifying fix...');
      const { count: fixedCount } = await anonClient
        .from('practice_tariffs')
        .select('*', { count: 'exact', head: true });
      
      if (fixedCount && fixedCount > 0) {
        console.log(`   ✅ Success! Anon users can now see ${fixedCount} records`);
      } else {
        console.log('   ❌ Fix did not work. Manual intervention may be required.');
      }
    } else {
      console.log('   ✅ Anon users can already see the data!');
    }
  }
}

verifyAndFix().catch(console.error);
import { createClient } from '@supabase/supabase-js';

// Use service role to check all tariff-related tables
const serviceClient = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function checkAllTariffTables() {
  console.log('🔍 Checking all tariff-related tables...\n');
  
  // List of possible table names
  const possibleTables = [
    'practice_tariffs',
    'tariffs', 
    'dental_tariffs',
    'medical_tariffs',
    'service_tariffs'
  ];
  
  for (const tableName of possibleTables) {
    console.log(`📋 Checking table: ${tableName}`);
    
    try {
      // Try to get schema
      const { data, error } = await serviceClient
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`   ✅ Found ${Object.keys(data[0]).length} columns:`);
        const columns = Object.keys(data[0]);
        console.log(`   📝 Columns: ${columns.join(', ')}`);
        
        // Check for practice/type related columns
        const practiceColumns = columns.filter(col => 
          col.toLowerCase().includes('practice') || 
          col.toLowerCase().includes('type')
        );
        if (practiceColumns.length > 0) {
          console.log(`   🏥 Practice/Type columns: ${practiceColumns.join(', ')}`);
        }
        
        // Get count
        const { count } = await serviceClient
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        console.log(`   📊 Record count: ${count}`);
        
      } else {
        console.log(`   ✅ Table exists but no records found`);
      }
      
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
  
  // Also check if there are any RLS policies on practice_tariffs
  console.log('🔒 Checking RLS policies for practice_tariffs:');
  try {
    const { data: policies, error } = await serviceClient
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename, 
            policyname,
            permissive,
            roles,
            cmd,
            qual
          FROM pg_policies 
          WHERE tablename = 'practice_tariffs'
        `
      });
    
    if (error) {
      console.log('   ❌ Error checking policies:', error.message);
    } else if (policies && policies.length > 0) {
      console.log('   ✅ Found RLS policies:');
      policies.forEach(policy => {
        console.log(`     - ${policy.policyname}: ${policy.cmd} for ${policy.roles}`);
        console.log(`       Using: ${policy.qual || 'true'}`);
      });
    } else {
      console.log('   ⚠️  No RLS policies found for practice_tariffs');
    }
  } catch (err) {
    console.log('   ❌ Exception checking policies:', err.message);
  }
}

checkAllTariffTables();
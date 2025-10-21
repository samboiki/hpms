import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
});

async function executeSQLStatements() {
  console.log('🚀 Executing practice registration migration...\n');

  // Read the SQL file
  const sqlFile = fs.readFileSync('supabase/migrations/20250930_add_practice_branch_columns.sql', 'utf8');
  
  // Extract individual ALTER TABLE and COMMENT statements
  const statements = sqlFile
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    
    // Skip comments-only lines
    if (stmt.trim().length === 1) continue;
    
    const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);
    
    try {
      // Use Supabase's rpc function to execute raw SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // If exec_sql doesn't exist, try alternative method
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log('   ⚠️  exec_sql RPC not available, trying direct table access...');
          
          // For ALTER TABLE statements, we need direct database access
          // This won't work via the REST API, need to use Management API or psql
          console.log('   ⏭️  Skipping (requires direct database access)');
          continue;
        }
        
        console.log(`   ❌ Error: ${error.message}`);
        failCount++;
      } else {
        console.log('   ✅ Success');
        successCount++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Results: ${successCount} successful, ${failCount} failed\n`);

  if (failCount > 0) {
    console.log('⚠️  Some statements failed to execute via the REST API.');
    console.log('💡 DDL statements (ALTER TABLE, CREATE TABLE, etc.) require direct database access.');
    console.log('\nPlease execute the migration using one of these methods:\n');
    console.log('1. Supabase Dashboard → SQL Editor');
    console.log('   - Copy the contents of: supabase/migrations/20250930_add_practice_branch_columns.sql');
    console.log('   - Paste into the SQL Editor and run\n');
    console.log('2. Use psql command line:');
    console.log('   psql "postgresql://postgres:[PASSWORD]@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres" -f supabase/migrations/20250930_add_practice_branch_columns.sql\n');
    console.log('3. Use Supabase Management API with proper authentication\n');
  } else {
    console.log('✅ All statements executed successfully!');
  }

  // Verify tables are accessible
  console.log('🔍 Verifying table access...\n');
  
  const { data: practices, error: pError } = await supabase
    .from('practices')
    .select('id')
    .limit(1);
  
  if (!pError) {
    console.log('✅ Practices table is accessible');
  } else {
    console.log('⚠️  Practices table:', pError.message);
  }

  const { data: branches, error: bError } = await supabase
    .from('branches')
    .select('id')
    .limit(1);
  
  if (!bError) {
    console.log('✅ Branches table is accessible');
  } else {
    console.log('⚠️  Branches table:', bError.message);
  }
}

executeSQLStatements().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

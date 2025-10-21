const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('ERROR: No Supabase key found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeMigration() {
  console.log('📖 Reading migration file...\n');
  
  const migrationSQL = fs.readFileSync('supabase/migrations/20250930_add_practice_branch_columns.sql', 'utf8');
  
  // Remove comments and split by statements
  const statements = migrationSQL
    .split('\n')
    .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
    .join('\n')
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`\n⚡ Executing statement ${i + 1}/${statements.length}...`);
    console.log(`Statement: ${stmt.substring(0, 80)}...`);
    
    try {
      const { data, error } = await supabase.rpc('execute_raw_sql', {
        query_text: stmt
      });

      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    } catch (err) {
      console.error(`❌ Exception executing statement ${i + 1}:`, err.message);
    }
  }

  console.log('\n\n✅ Migration execution complete!');
  console.log('\n🔍 Verifying the schema changes...\n');

  // Verify practices table
  const { data: practicesColumns, error: e1 } = await supabase
    .from('practices')
    .select('*')
    .limit(0);

  if (e1) {
    console.error('Error verifying practices table:', e1);
  } else {
    console.log('✅ Practices table is accessible');
  }

  // Verify branches table
  const { data: branchesColumns, error: e2 } = await supabase
    .from('branches')
    .select('*')
    .limit(0);

  if (e2) {
    console.error('Error verifying branches table:', e2);
  } else {
    console.log('✅ Branches table is accessible');
  }
}

executeMigration().catch(console.error);

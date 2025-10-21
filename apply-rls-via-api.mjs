import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Read the migration file and split into individual statements
const migrationSQL = readFileSync(
  join(__dirname, 'supabase/migrations/20250930_fix_rls_policies_for_registration.sql'),
  'utf8'
);

console.log('🚀 Applying RLS policy migration via Supabase Management API...\n');

// Split SQL into individual statements (remove comments and split by semicolon)
const statements = migrationSQL
  .split('\n')
  .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
  .join('\n')
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('DO $$'));

console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

let successCount = 0;
let errorCount = 0;

// Execute each statement via Supabase Management API
for (let i = 0; i < statements.length; i++) {
  const statement = statements[i] + ';';
  const statementType = statement.split(' ')[0];

  try {
    console.log(`[${i + 1}/${statements.length}] Executing ${statementType}...`);

    const response = await fetch(`https://api.supabase.com/v1/projects/jjxlfunlbyayxwvlpgwt/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({ query: statement })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || `HTTP ${response.status}`);
    }

    console.log(`   ✅ Success`);
    successCount++;
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    errorCount++;
  }
  console.log('');
}

console.log('\n📊 EXECUTION SUMMARY:');
console.log('=' .repeat(60));
console.log(`   ✅ Successful: ${successCount}`);
console.log(`   ❌ Failed: ${errorCount}`);
console.log(`   📝 Total: ${statements.length}`);
console.log('=' .repeat(60));

if (errorCount === 0) {
  console.log('\n🎉 All RLS policies applied successfully!');
  console.log('   Anonymous users can now register practices via /onehealth');
} else {
  console.log('\n⚠️  Some statements failed. Please review errors above.');
  console.log('   You may need to apply the migration manually via Supabase dashboard.');
}
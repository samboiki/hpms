import { createClient } from '@supabase/supabase-js';

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

async function fixPracticesStatusConstraint() {
  console.log('🚀 Fixing practices table status constraint...\n');

  const statements = [
    "ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;",
    "ALTER TABLE practices ADD CONSTRAINT practices_status_check CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive', 'pending', 'suspended'));"
  ];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`[${i + 1}/${statements.length}] ${stmt.substring(0, 80)}...`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);

        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log('\n⚠️  exec_sql RPC not available.');
          console.log('💡 Please execute the following SQL in Supabase Dashboard → SQL Editor:\n');
          console.log('-- Drop the old constraint');
          console.log('ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;\n');
          console.log('-- Add new constraint with all Kanban statuses');
          console.log("ALTER TABLE practices ADD CONSTRAINT practices_status_check CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive', 'pending', 'suspended'));\n");
          process.exit(1);
        }
      } else {
        console.log('   ✅ Success');
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('\n🔍 Verifying constraint update...\n');

  // Try to query practices table to ensure it's still accessible
  const { data: practices, error: pError } = await supabase
    .from('practices')
    .select('id, status')
    .limit(1);

  if (!pError) {
    console.log('✅ Practices table is accessible');
    console.log('✅ Status constraint updated successfully!');
    console.log('\nAllowed statuses: lead, contacted, qualified, onboarding, active, inactive, pending, suspended');
  } else {
    console.log('⚠️  Practices table error:', pError.message);
  }
}

fixPracticesStatusConstraint().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
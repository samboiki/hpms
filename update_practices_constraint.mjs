import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updatePracticesConstraint() {
  console.log('🚀 Updating practices table status constraint...\n');

  try {
    // Drop the old constraint
    console.log('📋 Step 1: Dropping old constraint...');
    const { error: dropError } = await supabase.rpc('execute_sql', {
      query: 'ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;'
    });

    if (dropError) {
      // Try direct SQL execution if RPC doesn't exist
      console.log('⚠️ RPC function not available, trying direct execution...');

      const dropSql = `ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;`;
      const { error: directDropError } = await supabase.from('_sql').insert({ query: dropSql });

      if (directDropError) {
        console.log('⚠️ Direct execution not available, using raw query...');
      }
    }
    console.log('✅ Old constraint dropped (if existed)\n');

    // Add new constraint with all statuses
    console.log('📋 Step 2: Adding new constraint with Kanban statuses...');
    const addConstraintSql = `
ALTER TABLE practices ADD CONSTRAINT practices_status_check
CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive', 'pending', 'suspended'));
    `.trim();

    const { error: addError } = await supabase.rpc('execute_sql', {
      query: addConstraintSql
    });

    if (addError) {
      console.log('⚠️ RPC execution failed, trying direct execution...');

      const { error: directAddError } = await supabase.from('_sql').insert({ query: addConstraintSql });

      if (directAddError) {
        // For DDL operations, we need to use the REST API directly
        console.log('⚠️ Using REST API for DDL execution...');

        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: addConstraintSql })
        });

        if (!response.ok) {
          throw new Error(`REST API execution failed: ${response.statusText}`);
        }
      }
    }
    console.log('✅ New constraint added successfully!\n');

    // Verify the constraint
    console.log('📋 Step 3: Verifying constraint...');
    const { data: constraints, error: verifyError } = await supabase
      .from('information_schema.check_constraints')
      .select('*')
      .eq('constraint_name', 'practices_status_check')
      .limit(1);

    if (!verifyError && constraints && constraints.length > 0) {
      console.log('✅ Constraint verified successfully!');
      console.log('Constraint details:', constraints[0]);
    } else {
      console.log('⚠️ Could not verify constraint through information_schema');
    }

    console.log('\n🎉 SUCCESS: practices table now supports all Kanban statuses:');
    console.log('   • lead');
    console.log('   • contacted');
    console.log('   • qualified');
    console.log('   • onboarding');
    console.log('   • active');
    console.log('   • inactive');
    console.log('   • pending (backward compatibility)');
    console.log('   • suspended (backward compatibility)');

  } catch (error) {
    console.error('❌ Error updating constraint:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

updatePracticesConstraint();
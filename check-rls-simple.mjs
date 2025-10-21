import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

console.log('🔍 CHECKING RLS POLICIES\n');
console.log('='.repeat(80));

async function checkRLS() {
  const tables = ['wards', 'rooms', 'beds', 'patient_admissions', 'bed_allocations'];

  for (const table of tables) {
    console.log(`\n📊 ${table.toUpperCase()}`);
    console.log('-'.repeat(80));

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql_query: `
            SELECT
              t.relrowsecurity as rls_enabled,
              COUNT(p.policyname) as policy_count
            FROM pg_class t
            LEFT JOIN pg_policies p ON p.tablename = t.relname
            WHERE t.relname = '${table}'
              AND t.relnamespace = 'public'::regnamespace
            GROUP BY t.relrowsecurity;
          `
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('RLS Enabled:', data[0]?.rls_enabled || false);
        console.log('Policy Count:', data[0]?.policy_count || 0);
      }

      // Get policy details
      const response2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql_query: `
            SELECT
              policyname,
              cmd,
              roles::text,
              CASE
                WHEN qual IS NOT NULL THEN pg_get_expr(qual, polrelid)
                ELSE 'N/A'
              END as using_clause
            FROM pg_policy
            JOIN pg_class ON pg_class.oid = pg_policy.polrelid
            WHERE pg_class.relname = '${table}';
          `
        })
      });

      if (response2.ok) {
        const policies = await response2.json();
        if (policies && policies.length > 0) {
          console.log('\nPolicies:');
          policies.forEach(p => {
            console.log(`  - ${p.policyname} (${p.cmd}) for ${p.roles}`);
            console.log(`    Using: ${p.using_clause}`);
          });
        } else {
          console.log('\n⚠️  No policies defined');
        }
      }
    } catch (err) {
      console.error(`Error checking ${table}:`, err.message);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('✅ COMPLETE');
  console.log('='.repeat(80));
}

checkRLS().catch(console.error);

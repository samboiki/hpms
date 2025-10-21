import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔍 CHECKING RLS POLICIES FOR INPATIENT TABLES\n');
console.log('='.repeat(80));

async function checkRLS() {
  const tables = ['wards', 'rooms', 'beds', 'patient_admissions', 'bed_allocations'];

  for (const table of tables) {
    console.log(`\n\n📊 TABLE: ${table}`);
    console.log('='.repeat(80));

    // Check if RLS is enabled
    const { data: tableInfo, error: e1 } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT
          schemaname,
          tablename,
          rowsecurity as rls_enabled
        FROM pg_tables
        WHERE tablename = '${table}'
          AND schemaname = 'public';
      `
    }).catch(() => ({ data: null, error: null }));

    if (tableInfo) {
      console.log('RLS Status:', tableInfo);
    }

    // Get RLS policies
    const { data: policies, error: e2 } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE tablename = '${table}'
          AND schemaname = 'public'
        ORDER BY policyname;
      `
    }).catch(() => ({ data: null, error: null }));

    if (policies && policies.length > 0) {
      console.log('\nRLS Policies:');
      console.table(policies);
    } else {
      console.log('\n⚠️  No RLS policies found (or unable to query)');
    }

    // Try direct query via pg_catalog
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          sql_query: `
            SELECT
              pol.policyname as name,
              pol.permissive,
              pol.cmd as command,
              pol.qual as using_expression,
              pol.with_check as with_check_expression
            FROM pg_policies pol
            WHERE pol.schemaname = 'public'
              AND pol.tablename = '${table}'
            ORDER BY pol.policyname;
          `
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          console.log('\nDetailed Policy Info:');
          data.forEach(policy => {
            console.log(`\n  Policy: ${policy.name}`);
            console.log(`  Command: ${policy.command}`);
            console.log(`  Permissive: ${policy.permissive}`);
            console.log(`  Using: ${policy.using_expression || 'N/A'}`);
            console.log(`  With Check: ${policy.with_check_expression || 'N/A'}`);
          });
        }
      }
    } catch (err) {
      // Ignore errors
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('✅ RLS CHECK COMPLETE');
  console.log('='.repeat(80));
}

checkRLS().catch(console.error);

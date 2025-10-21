import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

console.log('🔍 CHECKING RLS STATUS FOR INPATIENT TABLES\n');
console.log('='.repeat(80));

async function checkRLSStatus() {
  const tables = ['wards', 'rooms', 'beds', 'patient_admissions', 'bed_allocations'];

  for (const tableName of tables) {
    console.log(`\n📊 TABLE: ${tableName.toUpperCase()}`);
    console.log('-'.repeat(80));

    try {
      // Check if table exists and RLS status using information_schema
      const { data: tableData, error: e1 } = await supabase
        .from('pg_tables')
        .select('tablename, rowsecurity')
        .eq('schemaname', 'public')
        .eq('tablename', tableName)
        .single();

      if (e1) {
        console.log('⚠️  Unable to query pg_tables directly');
        console.log('Trying alternative method...');

        // Try to query the table directly to see if it exists
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .limit(0);

        if (error) {
          if (error.code === '42P01') {
            console.log(`❌ Table "${tableName}" does NOT exist`);
          } else if (error.code === '42501') {
            console.log(`✅ Table exists but RLS is blocking access (RLS is enabled)`);
            console.log(`   Error: ${error.message}`);
          } else {
            console.log(`⚠️  Error: ${error.code} - ${error.message}`);
          }
        } else {
          console.log(`✅ Table exists and is accessible`);
          console.log(`   Row count: ${count}`);
        }
      } else {
        console.log(`✅ Table exists`);
        console.log(`   RLS Enabled: ${tableData.rowsecurity ? 'YES' : 'NO'}`);
      }

      // Try to count policies (this might not work without proper RPC)
      console.log('\nAttempting to check policies...');
      const { data: policyData, error: e2 } = await supabase
        .from('pg_policies')
        .select('policyname, cmd')
        .eq('schemaname', 'public')
        .eq('tablename', tableName);

      if (e2) {
        console.log(`⚠️  Cannot query pg_policies: ${e2.message}`);
      } else if (policyData && policyData.length > 0) {
        console.log(`✅ ${policyData.length} policies found:`);
        policyData.forEach(p => {
          console.log(`   - ${p.policyname} (${p.cmd})`);
        });
      } else {
        console.log(`⚠️  No policies found (RLS may be enabled but no policies defined)`);
      }

    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('TESTING AUTHENTICATED ACCESS SIMULATION');
  console.log('='.repeat(80));

  // Try to access data with a simulated authenticated context
  console.log('\n🔐 Attempting to query as authenticated user...');
  console.log('(Using service role but checking what an auth user would see)\n');

  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

  try {
    const { data: wards, error } = await supabase
      .from('wards')
      .select('id, ward_name, capacity, current_occupancy')
      .eq('practice_id', practiceId);

    if (error) {
      console.log(`❌ Query failed: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Details: ${error.details}`);
    } else {
      console.log(`✅ Query succeeded with service role`);
      console.log(`   Wards returned: ${wards.length}`);
      if (wards.length > 0) {
        console.log('\n   Sample ward:');
        console.log(`   - ${wards[0].ward_name}`);
        console.log(`   - Capacity: ${wards[0].capacity}`);
        console.log(`   - Occupancy: ${wards[0].current_occupancy}`);
      }
    }
  } catch (err) {
    console.error(`❌ Exception: ${err.message}`);
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('✅ RLS STATUS CHECK COMPLETE');
  console.log('='.repeat(80));
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('   1. If RLS is enabled but no policies exist → Create RLS policies');
  console.log('   2. If RLS is not enabled → Enable RLS and create policies');
  console.log('   3. If policies exist but queries fail → Check policy logic');
  console.log('   4. Update frontend to use correct column names (capacity, current_occupancy)');
  console.log('\n');
}

checkRLSStatus().catch(console.error);

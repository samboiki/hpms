const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTableStructures() {
  const tables = ['departments', 'wards', 'rooms', 'beds', 'bed_allocations', 'patient_admissions'];

  console.log('='.repeat(80));
  console.log('INPATIENT MODULE - TABLE STRUCTURES');
  console.log('='.repeat(80));

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1);

      if (error) {
        console.log(`\n❌ ${table.toUpperCase()}: ERROR - ${error.message}`);
      } else {
        console.log(`\n✅ ${table.toUpperCase()}`);
        console.log('-'.repeat(80));
        console.log(`Row count: ${count || 0}`);

        if (data && data.length > 0) {
          const columns = Object.keys(data[0]);
          console.log(`Columns (${columns.length}):`, columns.join(', '));
          console.log('\nSample row:');
          console.log(JSON.stringify(data[0], null, 2));
        } else {
          console.log('(Empty table - no data to show structure)');
        }
      }
    } catch (err) {
      console.log(`\n❌ ${table.toUpperCase()}: EXCEPTION - ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('CHECKING LEGACY TABLES');
  console.log('='.repeat(80));

  const legacyTables = ['hospital_wards', 'ward_beds'];
  for (const table of legacyTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1);

      if (error) {
        console.log(`\n⚠️  ${table.toUpperCase()}: ${error.message}`);
      } else {
        console.log(`\n✅ ${table.toUpperCase()} (legacy)`);
        console.log(`Row count: ${count || 0}`);
        if (data && data.length > 0) {
          console.log('Columns:', Object.keys(data[0]).join(', '));
        }
      }
    } catch (err) {
      console.log(`\n⚠️  ${table.toUpperCase()}: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

getTableStructures().catch(console.error);

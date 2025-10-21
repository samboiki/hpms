/**
 * Get detailed schema information for inpatient module tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getTableSchema(tableName) {
  console.log(`\n📋 SCHEMA FOR: ${tableName}`);
  console.log('='.repeat(80));

  // Get column information from information_schema
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        column_default,
        is_nullable,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${tableName}'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    // Try alternative method
    const { data: altData, error: altError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (altError) {
      console.error(`❌ Error getting schema: ${altError.message}`);
      return;
    }

    if (altData && altData.length > 0) {
      const columns = Object.keys(altData[0]);
      console.log(`✅ Table has ${columns.length} columns:\n`);
      columns.forEach((col, idx) => {
        const value = altData[0][col];
        const type = typeof value;
        console.log(`  ${idx + 1}. ${col}`);
        console.log(`     Type: ${type} (inferred from data)`);
        console.log(`     Sample: ${JSON.stringify(value)}`);
      });
    }
    return;
  }

  if (data && data.length > 0) {
    console.log(`✅ Table has ${data.length} columns:\n`);
    data.forEach((col, idx) => {
      console.log(`  ${idx + 1}. ${col.column_name}`);
      console.log(`     Type: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
      console.log(`     Nullable: ${col.is_nullable}`);
      console.log(`     Default: ${col.column_default || 'None'}`);
    });
  }
}

async function getConstraints(tableName) {
  console.log(`\n🔗 CONSTRAINTS FOR: ${tableName}`);
  console.log('='.repeat(80));

  const { data, error } = await supabase
    .from('pg_constraint')
    .select('*');

  if (error) {
    console.log('⚠️ Could not fetch constraints (requires RLS policy or direct SQL)');
    return;
  }

  console.log('Constraints retrieved');
}

async function checkInpatientSchemas() {
  console.log('\n🏥 INPATIENT MODULE - DETAILED SCHEMA ANALYSIS\n');

  // Check hospital_wards
  await getTableSchema('hospital_wards');

  // Check ward_beds
  await getTableSchema('ward_beds');

  // Get sample data with all fields
  console.log('\n\n📊 SAMPLE DATA WITH ALL FIELDS');
  console.log('='.repeat(80));

  console.log('\n🏨 Hospital Wards (Sample):');
  const { data: wardSample } = await supabase
    .from('hospital_wards')
    .select('*')
    .limit(1);

  if (wardSample && wardSample.length > 0) {
    console.log(JSON.stringify(wardSample[0], null, 2));
  }

  console.log('\n\n🛏️ Ward Beds (Sample):');
  const { data: bedSample } = await supabase
    .from('ward_beds')
    .select('*')
    .limit(1);

  if (bedSample && bedSample.length > 0) {
    console.log(JSON.stringify(bedSample[0], null, 2));
  }

  // Check for any admissions or patient assignments
  console.log('\n\n🏥 ADDITIONAL INPATIENT TABLES CHECK');
  console.log('='.repeat(80));

  const tablesToCheck = [
    'inpatient_admissions',
    'patient_admissions',
    'bed_assignments',
    'ward_admissions',
    'hospital_admissions'
  ];

  for (const table of tablesToCheck) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: Does not exist`);
    } else {
      console.log(`✅ ${table}: EXISTS (${data || 0} records)`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Schema analysis complete\n');
}

checkInpatientSchemas().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
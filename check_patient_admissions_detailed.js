/**
 * Get detailed schema for patient_admissions table
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

async function checkPatientAdmissions() {
  console.log('\n🏥 PATIENT_ADMISSIONS TABLE DETAILED ANALYSIS\n');
  console.log('='.repeat(80));

  // Try to get any existing data
  console.log('\n🔍 Checking for any existing records...\n');
  const { data: existingData, error: selectError, count } = await supabase
    .from('patient_admissions')
    .select('*', { count: 'exact' })
    .limit(10);

  if (selectError) {
    console.log(`❌ Select error: ${selectError.message}`);
    return;
  }

  console.log(`✅ Total records: ${count}`);

  if (existingData && existingData.length > 0) {
    console.log('\nSample records:');
    existingData.forEach((record, idx) => {
      console.log(`\nRecord ${idx + 1}:`, JSON.stringify(record, null, 2));
    });
  } else {
    console.log('\n⚠️ No records found. Table exists but is empty.');
  }

  // Check related tables
  console.log('\n\n🔗 CHECKING RELATED TABLES\n');
  console.log('-'.repeat(80));

  const relatedTables = [
    'bed_assignments',
    'admission_vitals',
    'admission_medications',
    'admission_procedures',
    'discharge_summaries'
  ];

  for (const table of relatedTables) {
    const { count: tableCount, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: Does not exist`);
    } else {
      console.log(`✅ ${table}: EXISTS (${tableCount || 0} records)`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete\n');
}

checkPatientAdmissions().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
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

  // Try to insert with specific fields to discover schema
  const testData = {
    patient_id: '00000000-0000-0000-0000-000000000000',
    admission_number: 'TEST001',
    admission_date: new Date().toISOString(),
    admission_type: 'emergency',
    ward_id: '00000000-0000-0000-0000-000000000000'
  };

  console.log('\n🔍 Testing with sample data to discover required fields...\n');
  const { data, error } = await supabase
    .from('patient_admissions')
    .insert(testData)
    .select();

  if (error) {
    console.log(`Error message: ${error.message}`);
    console.log(`Error details: ${JSON.stringify(error.details, null, 2)}`);
    console.log(`Error hint: ${error.hint}`);
  } else {
    console.log('✅ Insert successful (will be rolled back)');
    console.log('Data structure:', JSON.stringify(data, null, 2));
  }

  // Try to get any existing data
  console.log('\n\n🔍 Checking for any existing records...\n');
  const { data: existingData, error: selectError, count } = await supabase
    .from('patient_admissions')
    .select('*', { count: 'exact' })
    .limit(1);

  if (selectError) {
    console.log(`Select error: ${selectError.message}`);
  } else {
    console.log(`Total records: ${count}`);
    if (existingData && existingData.length > 0) {
      console.log('Sample record:', JSON.stringify(existingData[0], null, 2));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete\n');
}

checkPatientAdmissions().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

/**
 * Check admission-related table structures
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

async function checkAdmissionTables() {
  console.log('\n🏥 ADMISSION TABLES STRUCTURE ANALYSIS\n');
  console.log('='.repeat(80));

  const tables = [
    'inpatient_admissions',
    'patient_admissions',
    'bed_assignments',
    'ward_admissions',
    'hospital_admissions'
  ];

  for (const tableName of tables) {
    console.log(`\n📋 TABLE: ${tableName}`);
    console.log('-'.repeat(80));

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      continue;
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`✅ Table has ${columns.length} columns:\n`);

      columns.forEach((col, idx) => {
        const value = data[0][col];
        const type = typeof value;
        console.log(`  ${idx + 1}. ${col}`);
        console.log(`     Type: ${type}`);
        console.log(`     Sample: ${JSON.stringify(value)}`);
      });
    } else {
      // Table exists but has no data - try to get column info from a failed insert
      console.log(`✅ Table exists but is empty. Attempting to get column structure...\n`);

      // Try inserting an empty object to see required fields
      const { error: insertError } = await supabase
        .from(tableName)
        .insert({})
        .select();

      if (insertError) {
        console.log(`Column info from error: ${insertError.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Admission tables analysis complete\n');
}

checkAdmissionTables().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 VERIFYING INPATIENT MODULE TABLES\n');

async function verifyTables() {
  const tablesToCheck = [
    'hospital_wards',
    'ward_beds',
    'rooms',
    'beds',
    'patient_admissions',
    'bed_allocations'
  ];

  for (const table of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: DOES NOT EXIST or NO ACCESS`);
        console.log(`   Error: ${error.message}\n`);
      } else {
        console.log(`✅ ${table}: EXISTS`);
        console.log(`   Records: ${count || 0}\n`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ERROR - ${err.message}\n`);
    }
  }

  // Get schema for existing tables
  console.log('\n📊 GETTING SCHEMAS:\n');

  // Check ward_beds schema
  try {
    const { data: wardBeds } = await supabase
      .from('ward_beds')
      .select('*')
      .limit(1);

    if (wardBeds && wardBeds.length > 0) {
      console.log('📋 ward_beds columns:', Object.keys(wardBeds[0]));
    }
  } catch (err) {
    console.log('ward_beds schema check failed');
  }

  // Check rooms schema
  try {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*')
      .limit(1);

    if (rooms && rooms.length > 0) {
      console.log('📋 rooms columns:', Object.keys(rooms[0]));
    }
  } catch (err) {
    console.log('rooms schema check failed');
  }

  // Check beds schema
  try {
    const { data: beds } = await supabase
      .from('beds')
      .select('*')
      .limit(1);

    if (beds && beds.length > 0) {
      console.log('📋 beds columns:', Object.keys(beds[0]));
    }
  } catch (err) {
    console.log('beds schema check failed');
  }

  // Check bed_allocations FK
  console.log('\n🔗 CHECKING bed_allocations FOREIGN KEY:\n');
  try {
    const { data: allocations } = await supabase
      .from('bed_allocations')
      .select('bed_id')
      .limit(1);

    if (allocations) {
      console.log('bed_allocations.bed_id references: Checking...');
      
      // Try to match with ward_beds
      const { data: fromWardBeds, error: wardBedsErr } = await supabase
        .from('ward_beds')
        .select('id')
        .limit(1);

      // Try to match with beds
      const { data: fromBeds, error: bedsErr } = await supabase
        .from('beds')
        .select('id')
        .limit(1);

      if (!wardBedsErr) {
        console.log('✅ ward_beds table exists - FK likely references this');
      }
      if (!bedsErr) {
        console.log('✅ beds table exists - may be new structure');
      }
    }
  } catch (err) {
    console.log('bed_allocations FK check failed:', err.message);
  }
}

verifyTables().catch(console.error);

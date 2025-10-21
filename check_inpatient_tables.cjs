const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU5OTg2MywiZXhwIjoyMDUwMTc1ODYzfQ.oU9NqLqJGSfmH4gg2fmTCCzYUf3vZCg_Pz7cTl2ZBCw'
);

async function checkInpatientTables() {
  console.log('🔍 INVESTIGATING INPATIENT TABLES SCHEMA AND DATA\n');

  try {
    // Check hospital_wards
    console.log('=== 1. HOSPITAL_WARDS TABLE ===');
    const { data: wardsData, error: wardsError } = await supabase
      .from('hospital_wards')
      .select('*')
      .limit(5);

    if (wardsError) {
      console.log('❌ Error fetching wards:', wardsError.message);
    } else {
      console.log(`✅ Found ${wardsData.length} wards`);
      if (wardsData.length > 0) {
        console.log('📋 Sample ward data:');
        console.log(JSON.stringify(wardsData[0], null, 2));
        console.log('\n📊 Columns present:', Object.keys(wardsData[0]).join(', '));
        console.log(`\n🔗 department_id present: ${wardsData[0].hasOwnProperty('department_id') ? '✅ YES' : '❌ NO'}`);
      }
    }

    // Check ward_beds
    console.log('\n\n=== 2. WARD_BEDS TABLE ===');
    const { data: bedsData, error: bedsError } = await supabase
      .from('ward_beds')
      .select('*')
      .limit(5);

    if (bedsError) {
      console.log('❌ Error fetching beds:', bedsError.message);
    } else {
      console.log(`✅ Found ${bedsData.length} beds`);
      if (bedsData.length > 0) {
        console.log('📋 Sample bed data:');
        console.log(JSON.stringify(bedsData[0], null, 2));
        console.log('\n📊 Columns present:', Object.keys(bedsData[0]).join(', '));
        console.log(`\n🔗 ward_id present: ${bedsData[0].hasOwnProperty('ward_id') ? '✅ YES' : '❌ NO'}`);
        console.log(`🔗 room_number present: ${bedsData[0].hasOwnProperty('room_number') ? '✅ YES' : '❌ NO'}`);
      }
    }

    // Check departments
    console.log('\n\n=== 3. DEPARTMENTS TABLE ===');
    const { data: deptsData, error: deptsError } = await supabase
      .from('departments')
      .select('*')
      .limit(5);

    if (deptsError) {
      console.log('❌ Error fetching departments:', deptsError.message);
    } else {
      console.log(`✅ Found ${deptsData.length} departments`);
      if (deptsData.length > 0) {
        console.log('📋 Sample department data:');
        console.log(JSON.stringify(deptsData[0], null, 2));
        console.log('\n📊 Columns present:', Object.keys(deptsData[0]).join(', '));
      }
    }

    // Check relationships
    console.log('\n\n=== 4. RELATIONSHIP VERIFICATION ===');

    // Check if wards have valid department_ids
    const { data: wardsWithDepts, error: joinError } = await supabase
      .from('hospital_wards')
      .select(`
        id,
        name,
        department_id,
        departments:department_id (
          id,
          name
        )
      `)
      .limit(10);

    if (joinError) {
      console.log('❌ Error checking ward-department relationship:', joinError.message);
    } else {
      console.log('✅ Ward-Department relationship check:');
      wardsWithDepts.forEach(ward => {
        console.log(`  - Ward: ${ward.name}`);
        console.log(`    Department ID: ${ward.department_id || 'NULL'}`);
        console.log(`    Department Name: ${ward.departments?.name || 'NOT LINKED'}`);
      });
    }

    // Check if beds have valid ward_ids
    const { data: bedsWithWards, error: bedJoinError } = await supabase
      .from('ward_beds')
      .select(`
        id,
        bed_number,
        room_number,
        ward_id,
        hospital_wards:ward_id (
          id,
          name
        )
      `)
      .limit(10);

    if (bedJoinError) {
      console.log('\n❌ Error checking bed-ward relationship:', bedJoinError.message);
    } else {
      console.log('\n✅ Bed-Ward relationship check:');
      bedsWithWards.forEach(bed => {
        console.log(`  - Bed: ${bed.bed_number}, Room: ${bed.room_number || 'N/A'}`);
        console.log(`    Ward ID: ${bed.ward_id || 'NULL'}`);
        console.log(`    Ward Name: ${bed.hospital_wards?.name || 'NOT LINKED'}`);
      });
    }

    // Summary
    console.log('\n\n=== 5. SUMMARY ===');
    const wardCount = wardsData?.length || 0;
    const bedCount = bedsData?.length || 0;
    const deptCount = deptsData?.length || 0;

    console.log(`📊 Total Records:`);
    console.log(`  - Wards: ${wardCount}`);
    console.log(`  - Beds: ${bedCount}`);
    console.log(`  - Departments: ${deptCount}`);

    console.log('\n🔍 Potential Issues:');
    if (wardCount === 0) console.log('  ⚠️ No wards found in hospital_wards table');
    if (bedCount === 0) console.log('  ⚠️ No beds found in ward_beds table');
    if (deptCount === 0) console.log('  ⚠️ No departments found in departments table');
    if (wardsWithDepts && wardsWithDepts.some(w => !w.department_id)) {
      console.log('  ⚠️ Some wards have NULL department_id');
    }
    if (bedsWithWards && bedsWithWards.some(b => !b.ward_id)) {
      console.log('  ⚠️ Some beds have NULL ward_id');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

checkInpatientTables();
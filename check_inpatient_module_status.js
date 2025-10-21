/**
 * Comprehensive Inpatient Module Structure Check
 * Analyzes hospital_wards, ward_beds, and department relationships
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

async function checkInpatientModule() {
  console.log('\n🏥 INPATIENT MODULE STRUCTURE CHECK\n');
  console.log('='.repeat(80));

  // Query 1: Check hospital_wards table
  console.log('\n📋 QUERY 1: Hospital Wards Sample Data');
  console.log('-'.repeat(80));

  const { data: wards, error: wardsError } = await supabase
    .from('hospital_wards')
    .select('id, ward_name, ward_code, ward_type, floor_number, total_beds, occupied_beds, department_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (wardsError) {
    console.error('❌ Error querying hospital_wards:', wardsError.message);
  } else {
    console.log(`✅ Found ${wards?.length || 0} wards`);
    if (wards && wards.length > 0) {
      wards.forEach(ward => {
        console.log(`\n  Ward: ${ward.ward_name} (${ward.ward_code})`);
        console.log(`  - Type: ${ward.ward_type}`);
        console.log(`  - Floor: ${ward.floor_number}`);
        console.log(`  - Beds: ${ward.occupied_beds}/${ward.total_beds} occupied`);
        console.log(`  - Department ID: ${ward.department_id || 'None'}`);
        console.log(`  - Created: ${new Date(ward.created_at).toLocaleString()}`);
      });
    } else {
      console.log('  No wards found in the database.');
    }
  }

  // Query 2: Check ward_beds table
  console.log('\n\n📋 QUERY 2: Ward Beds Sample Data');
  console.log('-'.repeat(80));

  const { data: beds, error: bedsError } = await supabase
    .from('ward_beds')
    .select('id, ward_id, bed_number, bed_code, room_number, room_type, status, daily_rate, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (bedsError) {
    console.error('❌ Error querying ward_beds:', bedsError.message);
  } else {
    console.log(`✅ Found ${beds?.length || 0} beds`);
    if (beds && beds.length > 0) {
      beds.forEach(bed => {
        console.log(`\n  Bed: ${bed.bed_code} (#${bed.bed_number})`);
        console.log(`  - Ward ID: ${bed.ward_id}`);
        console.log(`  - Room: ${bed.room_number} (${bed.room_type})`);
        console.log(`  - Status: ${bed.status}`);
        console.log(`  - Daily Rate: R${bed.daily_rate || 0}`);
        console.log(`  - Created: ${new Date(bed.created_at).toLocaleString()}`);
      });
    } else {
      console.log('  No beds found in the database.');
    }
  }

  // Query 3: Check department-ward relationships
  console.log('\n\n📋 QUERY 3: Department-Ward Relationships');
  console.log('-'.repeat(80));

  // Get all departments
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('id, name');

  if (deptError) {
    console.error('❌ Error querying departments:', deptError.message);
  } else {
    console.log(`✅ Found ${departments?.length || 0} departments\n`);

    if (departments && departments.length > 0) {
      for (const dept of departments) {
        const { data: deptWards, error: deptWardsError } = await supabase
          .from('hospital_wards')
          .select('id, ward_name')
          .eq('department_id', dept.id);

        const wardCount = deptWards?.length || 0;
        console.log(`  ${dept.name}: ${wardCount} ward${wardCount !== 1 ? 's' : ''}`);

        if (deptWards && deptWards.length > 0) {
          deptWards.forEach(w => {
            console.log(`    - ${w.ward_name}`);
          });
        }
      }
    }
  }

  // Query 4: Check for ward_rooms table
  console.log('\n\n📋 QUERY 4: Ward Rooms Table Check');
  console.log('-'.repeat(80));

  const { data: roomsData, error: roomsError } = await supabase
    .from('ward_rooms')
    .select('id, ward_id, room_number, room_type, total_beds')
    .limit(5);

  if (roomsError) {
    if (roomsError.message.includes('does not exist')) {
      console.log('❌ ward_rooms table does NOT exist');
      console.log('   Rooms appear to be grouped by room_number in ward_beds table');
    } else {
      console.error('❌ Error querying ward_rooms:', roomsError.message);
    }
  } else {
    console.log(`✅ ward_rooms table EXISTS with ${roomsData?.length || 0} rooms`);
    if (roomsData && roomsData.length > 0) {
      roomsData.forEach(room => {
        console.log(`\n  Room: ${room.room_number}`);
        console.log(`  - Ward ID: ${room.ward_id}`);
        console.log(`  - Type: ${room.room_type}`);
        console.log(`  - Total Beds: ${room.total_beds}`);
      });
    }
  }

  // Additional Analysis: Room grouping in ward_beds
  console.log('\n\n📋 ADDITIONAL ANALYSIS: Room Grouping in ward_beds');
  console.log('-'.repeat(80));

  const { data: roomGroups, error: roomGroupError } = await supabase
    .rpc('get_room_grouping_analysis');

  if (roomGroupError) {
    // If RPC doesn't exist, do it manually
    const { data: allBeds } = await supabase
      .from('ward_beds')
      .select('room_number, room_type, ward_id');

    if (allBeds && allBeds.length > 0) {
      const roomMap = new Map();
      allBeds.forEach(bed => {
        const key = `${bed.ward_id}-${bed.room_number}`;
        if (!roomMap.has(key)) {
          roomMap.set(key, {
            ward_id: bed.ward_id,
            room_number: bed.room_number,
            room_type: bed.room_type,
            bed_count: 0
          });
        }
        roomMap.get(key).bed_count++;
      });

      console.log(`✅ Found ${roomMap.size} unique rooms across ${allBeds.length} beds\n`);

      const roomArray = Array.from(roomMap.values()).slice(0, 10);
      roomArray.forEach(room => {
        console.log(`  Room ${room.room_number} (Ward: ${room.ward_id})`);
        console.log(`  - Type: ${room.room_type}`);
        console.log(`  - Beds: ${room.bed_count}`);
      });
    } else {
      console.log('  No beds found for room grouping analysis.');
    }
  }

  // Summary Statistics
  console.log('\n\n📊 SUMMARY STATISTICS');
  console.log('='.repeat(80));

  const { count: totalWards } = await supabase
    .from('hospital_wards')
    .select('*', { count: 'exact', head: true });

  const { count: totalBeds } = await supabase
    .from('ward_beds')
    .select('*', { count: 'exact', head: true });

  const { count: occupiedBeds } = await supabase
    .from('ward_beds')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'occupied');

  const { count: availableBeds } = await supabase
    .from('ward_beds')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'available');

  console.log(`\n  Total Wards: ${totalWards || 0}`);
  console.log(`  Total Beds: ${totalBeds || 0}`);
  console.log(`  Occupied Beds: ${occupiedBeds || 0}`);
  console.log(`  Available Beds: ${availableBeds || 0}`);

  if (totalBeds && totalBeds > 0) {
    const occupancyRate = ((occupiedBeds || 0) / totalBeds * 100).toFixed(1);
    console.log(`  Occupancy Rate: ${occupancyRate}%`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Inpatient module structure check complete\n');
}

// Run the check
checkInpatientModule().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
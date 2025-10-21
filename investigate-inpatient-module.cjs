const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function investigateInpatientModule() {
  console.log('🔍 COMPREHENSIVE INPATIENT MODULE DATABASE INVESTIGATION\n');
  console.log('='.repeat(80));

  try {
    // 1. Check hospital_wards structure
    console.log('\n📊 1. HOSPITAL_WARDS TABLE STRUCTURE:');
    console.log('-'.repeat(80));
    const { data: wardsSchema, error: wardsSchemaError } = await supabase.rpc('exec', {
      sql: `SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'hospital_wards'
      ORDER BY ordinal_position;`
    });

    if (wardsSchemaError) {
      // Try direct query instead
      const { data: wards, error: wardsError } = await supabase
        .from('hospital_wards')
        .select('*')
        .limit(1);

      if (wards && wards.length > 0) {
        console.log('Columns in hospital_wards:');
        console.log(JSON.stringify(Object.keys(wards[0]), null, 2));
      } else {
        console.log('❌ Error getting wards schema:', wardsError?.message || 'Unknown error');
      }
    } else {
      console.table(wardsSchema);
    }

    // 2. Check hospital_rooms structure
    console.log('\n📊 2. HOSPITAL_ROOMS TABLE STRUCTURE:');
    console.log('-'.repeat(80));
    const { data: rooms, error: roomsError } = await supabase
      .from('hospital_rooms')
      .select('*')
      .limit(1);

    if (rooms && rooms.length > 0) {
      console.log('Columns in hospital_rooms:');
      console.log(JSON.stringify(Object.keys(rooms[0]), null, 2));
      console.log('\nSample room record:');
      console.log(JSON.stringify(rooms[0], null, 2));
    } else {
      console.log('❌ Error or no rooms found:', roomsError?.message || 'No data');
    }

    // 3. Check hospital_beds structure
    console.log('\n📊 3. HOSPITAL_BEDS TABLE STRUCTURE:');
    console.log('-'.repeat(80));
    const { data: beds, error: bedsError } = await supabase
      .from('hospital_beds')
      .select('*')
      .limit(1);

    if (beds && beds.length > 0) {
      console.log('Columns in hospital_beds:');
      console.log(JSON.stringify(Object.keys(beds[0]), null, 2));
      console.log('\nSample bed record:');
      console.log(JSON.stringify(beds[0], null, 2));
    } else {
      console.log('❌ Error or no beds found:', bedsError?.message || 'No data');
    }

    // 4. Get bed counts and statistics
    console.log('\n📊 4. BED STATISTICS:');
    console.log('-'.repeat(80));
    const { data: allBeds, error: allBedsError } = await supabase
      .from('hospital_beds')
      .select('status');

    if (allBeds) {
      const stats = {
        total_beds: allBeds.length,
        available_beds: allBeds.filter(b => b.status === 'available').length,
        occupied_beds: allBeds.filter(b => b.status === 'occupied').length,
        maintenance_beds: allBeds.filter(b => b.status === 'maintenance').length,
        reserved_beds: allBeds.filter(b => b.status === 'reserved').length,
        other_status: allBeds.filter(b => !['available', 'occupied', 'maintenance', 'reserved'].includes(b.status)).length
      };
      console.table(stats);

      // Show unique statuses
      const uniqueStatuses = [...new Set(allBeds.map(b => b.status))];
      console.log('\nUnique bed statuses found:', uniqueStatuses);
    } else {
      console.log('❌ Error getting bed statistics:', allBedsError?.message);
    }

    // 5. Check patient_admissions structure and count
    console.log('\n📊 5. PATIENT_ADMISSIONS TABLE:');
    console.log('-'.repeat(80));
    const { data: admissions, error: admissionsError } = await supabase
      .from('patient_admissions')
      .select('*')
      .limit(1);

    if (admissions && admissions.length > 0) {
      console.log('Columns in patient_admissions:');
      console.log(JSON.stringify(Object.keys(admissions[0]), null, 2));
      console.log('\nSample admission record:');
      console.log(JSON.stringify(admissions[0], null, 2));
    } else {
      console.log('❌ Error or no admissions found:', admissionsError?.message || 'No data');
    }

    // Count active admissions
    const { data: activeAdmissions, error: activeError } = await supabase
      .from('patient_admissions')
      .select('admission_id', { count: 'exact', head: true })
      .eq('status', 'active');

    console.log(`\nActive admissions count: ${activeAdmissions || 0}`);

    // 6. Check ward-department linkage
    console.log('\n📊 6. WARD-DEPARTMENT LINKAGE (First 10):');
    console.log('-'.repeat(80));
    const { data: wardsData, error: wardsDataError } = await supabase
      .from('hospital_wards')
      .select('ward_id, ward_name, department_id, practice_id, created_at')
      .limit(10);

    if (wardsData) {
      console.table(wardsData);

      // Count wards with/without department_id
      const { data: allWards } = await supabase
        .from('hospital_wards')
        .select('department_id');

      if (allWards) {
        const wardsWithDept = allWards.filter(w => w.department_id).length;
        const wardsWithoutDept = allWards.filter(w => !w.department_id).length;
        console.log(`\nWards with department_id: ${wardsWithDept}`);
        console.log(`Wards without department_id: ${wardsWithoutDept}`);
      }
    } else {
      console.log('❌ Error getting wards data:', wardsDataError?.message);
    }

    // 7. Check room linkage
    console.log('\n📊 7. ROOM LINKAGE (First 10):');
    console.log('-'.repeat(80));
    const { data: roomsData, error: roomsDataError } = await supabase
      .from('hospital_rooms')
      .select('room_id, room_number, ward_id, department_id, practice_id, room_type, status')
      .limit(10);

    if (roomsData) {
      console.table(roomsData);

      // Count rooms with/without ward_id and department_id
      const { data: allRooms } = await supabase
        .from('hospital_rooms')
        .select('ward_id, department_id');

      if (allRooms) {
        const roomsWithWard = allRooms.filter(r => r.ward_id).length;
        const roomsWithoutWard = allRooms.filter(r => !r.ward_id).length;
        const roomsWithDept = allRooms.filter(r => r.department_id).length;
        const roomsWithoutDept = allRooms.filter(r => !r.department_id).length;
        console.log(`\nRooms with ward_id: ${roomsWithWard}`);
        console.log(`Rooms without ward_id: ${roomsWithoutWard}`);
        console.log(`Rooms with department_id: ${roomsWithDept}`);
        console.log(`Rooms without department_id: ${roomsWithoutDept}`);
      }
    } else {
      console.log('❌ Error getting rooms data:', roomsDataError?.message);
    }

    // 8. Check bed linkage
    console.log('\n📊 8. BED LINKAGE (First 10):');
    console.log('-'.repeat(80));
    const { data: bedsData, error: bedsDataError } = await supabase
      .from('hospital_beds')
      .select('bed_id, bed_number, room_id, ward_id, department_id, practice_id, status, bed_type')
      .limit(10);

    if (bedsData) {
      console.table(bedsData);

      // Count beds with/without linkage
      const { data: allBedsLinkage } = await supabase
        .from('hospital_beds')
        .select('room_id, ward_id, department_id');

      if (allBedsLinkage) {
        const bedsWithRoom = allBedsLinkage.filter(b => b.room_id).length;
        const bedsWithoutRoom = allBedsLinkage.filter(b => !b.room_id).length;
        const bedsWithWard = allBedsLinkage.filter(b => b.ward_id).length;
        const bedsWithoutWard = allBedsLinkage.filter(b => !b.ward_id).length;
        const bedsWithDept = allBedsLinkage.filter(b => b.department_id).length;
        const bedsWithoutDept = allBedsLinkage.filter(b => !b.department_id).length;
        console.log(`\nBeds with room_id: ${bedsWithRoom}`);
        console.log(`Beds without room_id: ${bedsWithoutRoom}`);
        console.log(`Beds with ward_id: ${bedsWithWard}`);
        console.log(`Beds without ward_id: ${bedsWithoutWard}`);
        console.log(`Beds with department_id: ${bedsWithDept}`);
        console.log(`Beds without department_id: ${bedsWithoutDept}`);
      }
    } else {
      console.log('❌ Error getting beds data:', bedsDataError?.message);
    }

    // 9. Check for orphaned records
    console.log('\n📊 9. DATA INTEGRITY CHECK:');
    console.log('-'.repeat(80));

    // Check for rooms without valid ward_id
    const { data: orphanedRooms } = await supabase
      .from('hospital_rooms')
      .select('room_id, room_number, ward_id')
      .not('ward_id', 'is', null);

    if (orphanedRooms) {
      let invalidRooms = 0;
      for (const room of orphanedRooms) {
        const { data: ward } = await supabase
          .from('hospital_wards')
          .select('ward_id')
          .eq('ward_id', room.ward_id)
          .single();

        if (!ward) invalidRooms++;
      }
      console.log(`Rooms with invalid ward_id references: ${invalidRooms}`);
    }

    // Check for beds without valid room_id
    const { data: orphanedBeds } = await supabase
      .from('hospital_beds')
      .select('bed_id, bed_number, room_id')
      .not('room_id', 'is', null)
      .limit(100); // Check first 100 to avoid long execution

    if (orphanedBeds) {
      let invalidBeds = 0;
      for (const bed of orphanedBeds.slice(0, 10)) { // Check only first 10
        const { data: room } = await supabase
          .from('hospital_rooms')
          .select('room_id')
          .eq('room_id', bed.room_id)
          .single();

        if (!room) invalidBeds++;
      }
      console.log(`Sample beds with invalid room_id references (first 10 checked): ${invalidBeds}`);
    }

    // 10. Summary statistics
    console.log('\n📊 10. SUMMARY STATISTICS:');
    console.log('-'.repeat(80));

    const { count: wardCount } = await supabase
      .from('hospital_wards')
      .select('*', { count: 'exact', head: true });

    const { count: roomCount } = await supabase
      .from('hospital_rooms')
      .select('*', { count: 'exact', head: true });

    const { count: bedCount } = await supabase
      .from('hospital_beds')
      .select('*', { count: 'exact', head: true });

    const { count: admissionCount } = await supabase
      .from('patient_admissions')
      .select('*', { count: 'exact', head: true });

    console.table({
      'Total Wards': wardCount || 0,
      'Total Rooms': roomCount || 0,
      'Total Beds': bedCount || 0,
      'Total Admissions': admissionCount || 0
    });

    console.log('\n✅ Investigation complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during investigation:', error.message);
    console.error(error);
  }
}

investigateInpatientModule();
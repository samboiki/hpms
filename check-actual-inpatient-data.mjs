import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

console.log('🔍 CHECKING ACTUAL INPATIENT DATA (SERVICE ROLE - BYPASSING RLS)\n');
console.log(`Practice ID: ${practiceId}\n`);
console.log('='.repeat(80));

async function executeQuery(title, query) {
  console.log(`\n📊 ${title}`);
  console.log('-'.repeat(80));
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });

    if (error) {
      // Try direct query if RPC doesn't exist
      const result = await supabase.from('_sql').select('*').limit(0);
      console.log('⚠️  RPC function not available, trying alternative method...');

      // Execute via raw SQL using the REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql_query: query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    console.log('Trying direct table query instead...');
  }
}

async function checkTables() {
  console.log('\n\n1️⃣  WARDS COUNT');
  console.log('='.repeat(80));

  try {
    // Total wards
    const { count: totalWards, error: e1 } = await supabase
      .from('wards')
      .select('*', { count: 'exact', head: true });

    console.log(`Total wards in database: ${totalWards || 0}`);

    // Practice wards
    const { count: practiceWards, error: e2 } = await supabase
      .from('wards')
      .select('*', { count: 'exact', head: true })
      .eq('practice_id', practiceId);

    console.log(`Wards for practice ${practiceId}: ${practiceWards || 0}`);

    // Show actual wards
    const { data: wards, error: e3 } = await supabase
      .from('wards')
      .select('id, ward_name, ward_type, practice_id, is_active, total_beds, occupied_beds')
      .eq('practice_id', practiceId)
      .limit(10);

    if (wards && wards.length > 0) {
      console.log('\nActual ward data:');
      console.table(wards);
    } else {
      console.log('\n⚠️  No wards found for this practice');
    }
  } catch (err) {
    console.error(`❌ Error checking wards: ${err.message}`);
  }

  console.log('\n\n2️⃣  ROOMS COUNT');
  console.log('='.repeat(80));

  try {
    // Total rooms
    const { count: totalRooms, error: e1 } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true });

    console.log(`Total rooms in database: ${totalRooms || 0}`);

    // Get ward IDs for practice first
    const { data: practiceWardIds } = await supabase
      .from('wards')
      .select('id')
      .eq('practice_id', practiceId);

    const wardIds = practiceWardIds?.map(w => w.id) || [];

    if (wardIds.length > 0) {
      const { count: practiceRooms, error: e2 } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .in('ward_id', wardIds);

      console.log(`Rooms for practice ${practiceId}: ${practiceRooms || 0}`);

      // Show actual rooms with ward names
      const { data: rooms, error: e3 } = await supabase
        .from('rooms')
        .select('id, room_number, ward_id, wards!inner(ward_name)')
        .eq('wards.practice_id', practiceId)
        .limit(10);

      if (rooms && rooms.length > 0) {
        console.log('\nActual room data:');
        console.table(rooms.map(r => ({
          id: r.id,
          room_number: r.room_number,
          ward_id: r.ward_id,
          ward_name: r.wards?.ward_name || 'N/A'
        })));
      } else {
        console.log('\n⚠️  No rooms found for this practice');
      }
    } else {
      console.log(`Rooms for practice ${practiceId}: 0 (no wards exist)`);
    }
  } catch (err) {
    console.error(`❌ Error checking rooms: ${err.message}`);
  }

  console.log('\n\n3️⃣  BEDS COUNT');
  console.log('='.repeat(80));

  try {
    // Total beds
    const { count: totalBeds, error: e1 } = await supabase
      .from('beds')
      .select('*', { count: 'exact', head: true });

    console.log(`Total beds in database: ${totalBeds || 0}`);

    // Get ward IDs for practice first
    const { data: practiceWardIds } = await supabase
      .from('wards')
      .select('id')
      .eq('practice_id', practiceId);

    const wardIds = practiceWardIds?.map(w => w.id) || [];

    if (wardIds.length > 0) {
      // Get rooms for these wards
      const { data: practiceRoomIds } = await supabase
        .from('rooms')
        .select('id')
        .in('ward_id', wardIds);

      const roomIds = practiceRoomIds?.map(r => r.id) || [];

      if (roomIds.length > 0) {
        const { count: practiceBeds, error: e2 } = await supabase
          .from('beds')
          .select('*', { count: 'exact', head: true })
          .in('room_id', roomIds);

        console.log(`Beds for practice ${practiceId}: ${practiceBeds || 0}`);

        // Show actual beds with room and ward info
        const { data: beds, error: e3 } = await supabase
          .from('beds')
          .select(`
            id,
            bed_number,
            bed_status,
            room_id,
            rooms!inner(
              room_number,
              ward_id,
              wards!inner(ward_name)
            )
          `)
          .in('room_id', roomIds)
          .limit(10);

        if (beds && beds.length > 0) {
          console.log('\nActual bed data:');
          console.table(beds.map(b => ({
            id: b.id,
            bed_number: b.bed_number,
            bed_status: b.bed_status,
            room_number: b.rooms?.room_number || 'N/A',
            ward_name: b.rooms?.wards?.ward_name || 'N/A'
          })));
        } else {
          console.log('\n⚠️  No beds found for this practice');
        }
      } else {
        console.log(`Beds for practice ${practiceId}: 0 (no rooms exist)`);
      }
    } else {
      console.log(`Beds for practice ${practiceId}: 0 (no wards exist)`);
    }
  } catch (err) {
    console.error(`❌ Error checking beds: ${err.message}`);
  }

  console.log('\n\n4️⃣  PATIENT ADMISSIONS');
  console.log('='.repeat(80));

  try {
    const { count: admissions, error: e1 } = await supabase
      .from('patient_admissions')
      .select('*', { count: 'exact', head: true })
      .eq('practice_id', practiceId);

    console.log(`Patient admissions for practice: ${admissions || 0}`);

    const { data: admissionData, error: e2 } = await supabase
      .from('patient_admissions')
      .select('*')
      .eq('practice_id', practiceId)
      .limit(5);

    if (admissionData && admissionData.length > 0) {
      console.log('\nSample admissions:');
      console.table(admissionData);
    }
  } catch (err) {
    console.error(`❌ Error checking patient admissions: ${err.message}`);
  }

  console.log('\n\n5️⃣  BED ALLOCATIONS');
  console.log('='.repeat(80));

  try {
    // Get ward IDs for practice
    const { data: practiceWardIds } = await supabase
      .from('wards')
      .select('id')
      .eq('practice_id', practiceId);

    const wardIds = practiceWardIds?.map(w => w.id) || [];

    if (wardIds.length > 0) {
      const { data: allocations, error } = await supabase
        .from('bed_allocations')
        .select(`
          id,
          admission_id,
          bed_id,
          is_current,
          beds!inner(
            bed_number,
            rooms!inner(
              room_number,
              wards!inner(ward_name, practice_id)
            )
          )
        `)
        .eq('beds.rooms.wards.practice_id', practiceId)
        .limit(10);

      console.log(`Bed allocations for practice: ${allocations?.length || 0}`);

      if (allocations && allocations.length > 0) {
        console.log('\nSample allocations:');
        console.table(allocations.map(a => ({
          id: a.id,
          admission_id: a.admission_id,
          bed_id: a.bed_id,
          is_current: a.is_current,
          bed_number: a.beds?.bed_number || 'N/A',
          room_number: a.beds?.rooms?.room_number || 'N/A',
          ward_name: a.beds?.rooms?.wards?.ward_name || 'N/A'
        })));
      }
    } else {
      console.log('Bed allocations for practice: 0 (no wards exist)');
    }
  } catch (err) {
    console.error(`❌ Error checking bed allocations: ${err.message}`);
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('✅ VERIFICATION COMPLETE');
  console.log('='.repeat(80));
}

checkTables().catch(console.error);

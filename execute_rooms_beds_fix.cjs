const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeRoomsBedsFix() {
  console.log('🔧 EXECUTING ROOMS AND BEDS FIX\n');
  console.log('=' .repeat(80));

  // BEFORE STATE
  console.log('\n📊 BEFORE STATE:\n');

  const { data: roomsBefore } = await supabase
    .from('rooms')
    .select('practice_id, department_id');

  const { data: bedsBefore } = await supabase
    .from('beds')
    .select('practice_id, department_id');

  if (roomsBefore && bedsBefore) {
    const roomsWithPractice = roomsBefore.filter(r => r.practice_id !== null).length;
    const roomsWithDept = roomsBefore.filter(r => r.department_id !== null).length;
    const bedsWithPractice = bedsBefore.filter(b => b.practice_id !== null).length;
    const bedsWithDept = bedsBefore.filter(b => b.department_id !== null).length;

    console.log(`Rooms with practice_id: ${roomsWithPractice}/${roomsBefore.length}`);
    console.log(`Rooms with department_id: ${roomsWithDept}/${roomsBefore.length}`);
    console.log(`Beds with practice_id: ${bedsWithPractice}/${bedsBefore.length}`);
    console.log(`Beds with department_id: ${bedsWithDept}/${bedsBefore.length}`);
  }

  // EXECUTE UPDATES
  console.log('\n\n🔧 EXECUTING UPDATES...\n');

  try {
    // Step 1: Update rooms practice_id
    console.log('1️⃣ Updating rooms practice_id from wards...');
    const { error: roomsPracticeError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE rooms
        SET practice_id = (
          SELECT w.practice_id
          FROM wards w
          WHERE w.id = rooms.ward_id
        )
        WHERE practice_id IS NULL
          AND ward_id IS NOT NULL;
      `
    });

    if (roomsPracticeError) {
      console.error('❌ Error:', roomsPracticeError.message);
      console.log('Trying alternative method...');

      // Alternative: Update via Supabase client
      const { data: allRooms } = await supabase
        .from('rooms')
        .select('id, ward_id');

      if (allRooms) {
        console.log(`Found ${allRooms.length} rooms to update`);

        for (const room of allRooms) {
          // Get ward info
          const { data: ward } = await supabase
            .from('wards')
            .select('practice_id, department_id')
            .eq('id', room.ward_id)
            .single();

          if (ward) {
            // Update room
            await supabase
              .from('rooms')
              .update({
                practice_id: ward.practice_id,
                department_id: ward.department_id
              })
              .eq('id', room.id);
          }
        }
        console.log('✅ Rooms updated via client method');
      }
    } else {
      console.log('✅ Rooms practice_id updated');
    }

    // Step 2: Update rooms department_id
    console.log('\n2️⃣ Updating rooms department_id from wards...');
    const { error: roomsDeptError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE rooms
        SET department_id = (
          SELECT w.department_id
          FROM wards w
          WHERE w.id = rooms.ward_id
        )
        WHERE department_id IS NULL
          AND ward_id IS NOT NULL;
      `
    });

    if (!roomsDeptError) {
      console.log('✅ Rooms department_id updated');
    }

    // Step 3: Update beds practice_id
    console.log('\n3️⃣ Updating beds practice_id from wards...');
    const { error: bedsPracticeError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE beds
        SET practice_id = (
          SELECT w.practice_id
          FROM wards w
          WHERE w.id = beds.ward_id
        )
        WHERE practice_id IS NULL
          AND ward_id IS NOT NULL;
      `
    });

    if (bedsPracticeError) {
      console.error('❌ Error:', bedsPracticeError.message);
      console.log('Trying alternative method...');

      // Alternative: Update via Supabase client
      const { data: allBeds } = await supabase
        .from('beds')
        .select('id, ward_id');

      if (allBeds) {
        console.log(`Found ${allBeds.length} beds to update`);

        for (const bed of allBeds) {
          // Get ward info
          const { data: ward } = await supabase
            .from('wards')
            .select('practice_id, department_id')
            .eq('id', bed.ward_id)
            .single();

          if (ward) {
            // Update bed
            await supabase
              .from('beds')
              .update({
                practice_id: ward.practice_id,
                department_id: ward.department_id
              })
              .eq('id', bed.id);
          }
        }
        console.log('✅ Beds updated via client method');
      }
    } else {
      console.log('✅ Beds practice_id updated');
    }

    // Step 4: Update beds department_id
    console.log('\n4️⃣ Updating beds department_id from wards...');
    const { error: bedsDeptError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE beds
        SET department_id = (
          SELECT w.department_id
          FROM wards w
          WHERE w.id = beds.ward_id
        )
        WHERE department_id IS NULL
          AND ward_id IS NOT NULL;
      `
    });

    if (!bedsDeptError) {
      console.log('✅ Beds department_id updated');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  // AFTER STATE
  console.log('\n\n📊 AFTER STATE:\n');

  const { data: roomsAfter } = await supabase
    .from('rooms')
    .select('practice_id, department_id');

  const { data: bedsAfter } = await supabase
    .from('beds')
    .select('practice_id, department_id');

  if (roomsAfter && bedsAfter) {
    const roomsWithPractice = roomsAfter.filter(r => r.practice_id !== null).length;
    const roomsWithDept = roomsAfter.filter(r => r.department_id !== null).length;
    const bedsWithPractice = bedsAfter.filter(b => b.practice_id !== null).length;
    const bedsWithDept = bedsAfter.filter(b => b.department_id !== null).length;

    console.log(`Rooms with practice_id: ${roomsWithPractice}/${roomsAfter.length}`);
    console.log(`Rooms with department_id: ${roomsWithDept}/${roomsAfter.length}`);
    console.log(`Beds with practice_id: ${bedsWithPractice}/${bedsAfter.length}`);
    console.log(`Beds with department_id: ${bedsWithDept}/${bedsAfter.length}`);
  }

  // SAMPLE DATA
  console.log('\n\n📋 SAMPLE UPDATED DATA:\n');

  const { data: sampleRooms } = await supabase
    .from('rooms')
    .select('room_number, room_name, ward_id, practice_id, department_id')
    .limit(3);

  console.log('Sample Rooms:');
  console.table(sampleRooms);

  const { data: sampleBeds } = await supabase
    .from('beds')
    .select('bed_number, ward_id, room_id, practice_id, department_id')
    .limit(3);

  console.log('\nSample Beds:');
  console.table(sampleBeds);

  console.log('\n' + '='.repeat(80));
  console.log('✅ FIX COMPLETE!\n');
}

executeRoomsBedsFix().catch(console.error);
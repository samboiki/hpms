const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPracticeIds() {
  console.log('🔍 CHECKING PRACTICE IDs\n');

  // Check wards practice_id
  const { data: wards } = await supabase
    .from('wards')
    .select('id, ward_name, practice_id, department_id');

  console.log('📋 WARDS:');
  if (wards) {
    const wardsWithPractice = wards.filter(w => w.practice_id !== null).length;
    const wardsWithoutPractice = wards.filter(w => w.practice_id === null).length;

    console.log(`Total wards: ${wards.length}`);
    console.log(`With practice_id: ${wardsWithPractice}`);
    console.log(`Without practice_id: ${wardsWithoutPractice}`);

    console.log('\nSample wards:');
    wards.slice(0, 5).forEach(w => {
      console.log(`  - ${w.ward_name}: practice_id = ${w.practice_id || 'NULL'}`);
    });
  }

  // Check rooms practice_id
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_number, ward_id, practice_id, department_id')
    .limit(10);

  console.log('\n📋 ROOMS (Sample 10):');
  if (rooms) {
    const roomsWithPractice = rooms.filter(r => r.practice_id !== null).length;
    const roomsWithWard = rooms.filter(r => r.ward_id !== null).length;
    const roomsWithDept = rooms.filter(r => r.department_id !== null).length;

    console.log(`Sample size: ${rooms.length}`);
    console.log(`With practice_id: ${roomsWithPractice}/${rooms.length}`);
    console.log(`With ward_id: ${roomsWithWard}/${rooms.length}`);
    console.log(`With department_id: ${roomsWithDept}/${rooms.length}`);

    console.log('\nSample rooms:');
    rooms.slice(0, 3).forEach(r => {
      console.log(`  - ${r.room_number}:`);
      console.log(`    practice_id = ${r.practice_id || 'NULL'}`);
      console.log(`    ward_id = ${r.ward_id || 'NULL'}`);
      console.log(`    department_id = ${r.department_id || 'NULL'}`);
    });
  }

  // Check beds practice_id
  const { data: beds } = await supabase
    .from('beds')
    .select('id, bed_number, ward_id, room_id, practice_id, department_id')
    .limit(10);

  console.log('\n📋 BEDS (Sample 10):');
  if (beds) {
    const bedsWithPractice = beds.filter(b => b.practice_id !== null).length;
    const bedsWithWard = beds.filter(b => b.ward_id !== null).length;
    const bedsWithRoom = beds.filter(b => b.room_id !== null).length;
    const bedsWithDept = beds.filter(b => b.department_id !== null).length;

    console.log(`Sample size: ${beds.length}`);
    console.log(`With practice_id: ${bedsWithPractice}/${beds.length}`);
    console.log(`With ward_id: ${bedsWithWard}/${beds.length}`);
    console.log(`With room_id: ${bedsWithRoom}/${beds.length}`);
    console.log(`With department_id: ${bedsWithDept}/${beds.length}`);

    console.log('\nSample beds:');
    beds.slice(0, 3).forEach(b => {
      console.log(`  - ${b.bed_number}:`);
      console.log(`    practice_id = ${b.practice_id || 'NULL'}`);
      console.log(`    ward_id = ${b.ward_id || 'NULL'}`);
      console.log(`    room_id = ${b.room_id || 'NULL'}`);
      console.log(`    department_id = ${b.department_id || 'NULL'}`);
    });
  }

  // Get unique practice_ids
  console.log('\n📋 UNIQUE PRACTICE IDs IN SYSTEM:');
  const { data: practices } = await supabase
    .from('practices')
    .select('id, name')
    .limit(5);

  if (practices) {
    console.log('\nAvailable practices:');
    practices.forEach(p => {
      console.log(`  - ${p.name}: ${p.id}`);
    });
  }

  // Check if wards have practice_id
  if (wards && wards.length > 0 && wards[0].practice_id) {
    const practiceId = wards[0].practice_id;
    console.log(`\n✅ Wards have practice_id: ${practiceId}`);
    console.log('We can use this to update rooms and beds!');
  } else {
    console.log('\n⚠️ WARNING: Wards do not have practice_id set!');
  }
}

checkPracticeIds().catch(console.error);
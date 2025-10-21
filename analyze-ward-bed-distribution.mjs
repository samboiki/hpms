import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

console.log('🏥 WARD-BED DISTRIBUTION ANALYSIS');
console.log('='.repeat(80));

// Get all wards
const { data: wards, error: wardsError } = await supabase
  .from('hospital_wards')
  .select('*')
  .eq('practice_id', practiceId)
  .order('ward_name');

if (wardsError) {
  console.log('Error:', wardsError.message);
  process.exit(1);
}

console.log(`\nFound ${wards.length} wards:\n`);

// For each ward, get room and bed counts
for (const ward of wards) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📍 ${ward.ward_name} (${ward.ward_code})`);
  console.log(`   Ward ID: ${ward.id}`);
  console.log(`   Department: ${ward.department_id}`);
  console.log(`   Ward declares: ${ward.total_beds} total beds, ${ward.occupied_beds} occupied`);
  console.log(`${'='.repeat(80)}`);

  // Get rooms for this ward
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*')
    .eq('ward_id', ward.id)
    .eq('practice_id', practiceId);

  if (roomsError) {
    console.log(`   ❌ Error fetching rooms: ${roomsError.message}`);
    continue;
  }

  console.log(`\n   🚪 ROOMS: ${rooms?.length || 0} rooms found`);

  let totalRoomBeds = 0;

  if (rooms && rooms.length > 0) {
    rooms.forEach(room => {
      console.log(`      - ${room.room_number}: ${room.room_name}`);
      console.log(`        Type: ${room.room_type}, Status: ${room.room_status}`);
      console.log(`        Bed capacity: ${room.bed_count}, Occupied: ${room.occupied_beds}`);
      totalRoomBeds += room.bed_count || 0;
    });
  } else {
    console.log('      ⚠️ No rooms found for this ward');
  }

  // Get beds for this ward
  const { data: beds, error: bedsError } = await supabase
    .from('beds')
    .select('*')
    .eq('ward_id', ward.id)
    .eq('practice_id', practiceId);

  if (bedsError) {
    console.log(`   ❌ Error fetching beds: ${bedsError.message}`);
    continue;
  }

  console.log(`\n   🛏️  BEDS: ${beds?.length || 0} beds found`);

  if (beds && beds.length > 0) {
    const availableBeds = beds.filter(b => b.bed_status === 'Available').length;
    const occupiedBeds = beds.filter(b => b.bed_status === 'Occupied' || b.patient_id !== null).length;
    const maintenanceBeds = beds.filter(b => b.bed_status === 'Maintenance').length;

    console.log(`      Available: ${availableBeds}`);
    console.log(`      Occupied: ${occupiedBeds}`);
    console.log(`      Maintenance: ${maintenanceBeds}`);

    // Group beds by room
    const bedsByRoom = beds.reduce((acc, bed) => {
      const roomId = bed.room_id || 'no-room';
      if (!acc[roomId]) acc[roomId] = [];
      acc[roomId].push(bed);
      return acc;
    }, {});

    console.log(`\n      Beds by Room:`);
    Object.entries(bedsByRoom).forEach(([roomId, roomBeds]) => {
      const room = rooms?.find(r => r.id === roomId);
      const roomName = room ? `${room.room_number} (${room.room_name})` : 'Unknown Room';
      console.log(`        ${roomName}: ${roomBeds.length} beds`);
      roomBeds.forEach(bed => {
        console.log(`          - ${bed.bed_number}: ${bed.bed_status}${bed.patient_id ? ` (Patient: ${bed.patient_name})` : ''}`);
      });
    });
  } else {
    console.log('      ⚠️ No beds found for this ward');
  }

  // Summary
  console.log(`\n   📊 SUMMARY:`);
  console.log(`      Ward declares: ${ward.total_beds} beds`);
  console.log(`      Rooms capacity: ${totalRoomBeds} beds`);
  console.log(`      Actual beds created: ${beds?.length || 0} beds`);

  const discrepancy = ward.total_beds - (beds?.length || 0);
  if (discrepancy !== 0) {
    console.log(`      ⚠️ DISCREPANCY: ${discrepancy > 0 ? '+' : ''}${discrepancy} beds`);
  } else {
    console.log(`      ✅ Bed count matches!`);
  }
}

// Overall summary
console.log(`\n\n${'='.repeat(80)}`);
console.log('🎯 OVERALL SUMMARY');
console.log('='.repeat(80));

const totalWardBeds = wards.reduce((sum, w) => sum + (w.total_beds || 0), 0);
const totalOccupiedWards = wards.reduce((sum, w) => sum + (w.occupied_beds || 0), 0);

const { data: allRooms } = await supabase
  .from('rooms')
  .select('bed_count')
  .eq('practice_id', practiceId);

const totalRoomCapacity = allRooms?.reduce((sum, r) => sum + (r.bed_count || 0), 0) || 0;

const { data: allBeds } = await supabase
  .from('beds')
  .select('bed_status, patient_id')
  .eq('practice_id', practiceId);

const totalActualBeds = allBeds?.length || 0;
const totalAvailable = allBeds?.filter(b => b.bed_status === 'Available').length || 0;
const totalOccupied = allBeds?.filter(b => b.bed_status === 'Occupied' || b.patient_id !== null).length || 0;

console.log(`\n📊 PRACTICE-WIDE STATISTICS:`);
console.log(`   Wards: ${wards.length}`);
console.log(`   Ward declared total: ${totalWardBeds} beds`);
console.log(`   Ward declared occupied: ${totalOccupiedWards} beds`);
console.log(`   Room capacity: ${totalRoomCapacity} beds`);
console.log(`   Actual beds in system: ${totalActualBeds} beds`);
console.log(`   Currently available: ${totalAvailable} beds`);
console.log(`   Currently occupied: ${totalOccupied} beds`);

const overallDiscrepancy = totalWardBeds - totalActualBeds;
console.log(`\n⚠️ OVERALL DISCREPANCY: ${overallDiscrepancy > 0 ? '+' : ''}${overallDiscrepancy} beds`);
console.log(`   Ward declares ${totalWardBeds} beds but only ${totalActualBeds} exist in the system.`);

console.log(`\n✅ ANALYSIS COMPLETE\n`);
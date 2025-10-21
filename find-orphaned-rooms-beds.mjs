import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

console.log('🔍 FINDING ORPHANED ROOMS AND BEDS');
console.log('='.repeat(80));

// Get all wards
const { data: wards, error: wardsError } = await supabase
  .from('hospital_wards')
  .select('id, ward_name, ward_code')
  .eq('practice_id', practiceId);

console.log(`\n✅ Found ${wards?.length || 0} wards in hospital_wards table:`);
wards?.forEach(w => console.log(`   - ${w.ward_name} (${w.ward_code}): ${w.id}`));

// Get unique ward IDs from rooms
const { data: rooms, error: roomsError } = await supabase
  .from('rooms')
  .select('ward_id')
  .eq('practice_id', practiceId);

const uniqueRoomWardIds = [...new Set(rooms?.map(r => r.ward_id) || [])];

console.log(`\n🚪 Rooms reference these ward IDs (${uniqueRoomWardIds.length} unique):`);
uniqueRoomWardIds.forEach(wardId => {
  const ward = wards?.find(w => w.id === wardId);
  if (ward) {
    console.log(`   ✅ ${wardId} → ${ward.ward_name} (EXISTS)`);
  } else {
    console.log(`   ❌ ${wardId} → NOT FOUND IN WARDS TABLE`);
  }
});

// Get unique ward IDs from beds
const { data: beds, error: bedsError } = await supabase
  .from('beds')
  .select('ward_id')
  .eq('practice_id', practiceId);

const uniqueBedWardIds = [...new Set(beds?.map(b => b.ward_id) || [])];

console.log(`\n🛏️  Beds reference these ward IDs (${uniqueBedWardIds.length} unique):`);
uniqueBedWardIds.forEach(wardId => {
  const ward = wards?.find(w => w.id === wardId);
  if (ward) {
    console.log(`   ✅ ${wardId} → ${ward.ward_name} (EXISTS)`);
  } else {
    console.log(`   ❌ ${wardId} → NOT FOUND IN WARDS TABLE`);
  }
});

// Find rooms and beds for each referenced ward
console.log(`\n\n${'='.repeat(80)}`);
console.log('📊 ROOMS AND BEDS BY REFERENCED WARD ID');
console.log('='.repeat(80));

const allReferencedWardIds = [...new Set([...uniqueRoomWardIds, ...uniqueBedWardIds])];

for (const wardId of allReferencedWardIds) {
  console.log(`\n🏥 Ward ID: ${wardId}`);

  const ward = wards?.find(w => w.id === wardId);
  if (ward) {
    console.log(`   ✅ Ward exists: ${ward.ward_name} (${ward.ward_code})`);
  } else {
    console.log(`   ⚠️ Ward NOT found in hospital_wards table (orphaned data)`);
  }

  // Count rooms
  const { data: wardRooms } = await supabase
    .from('rooms')
    .select('id, room_number, room_name')
    .eq('ward_id', wardId)
    .eq('practice_id', practiceId);

  console.log(`   🚪 Rooms: ${wardRooms?.length || 0}`);
  wardRooms?.slice(0, 3).forEach(r => {
    console.log(`      - ${r.room_number}: ${r.room_name}`);
  });
  if (wardRooms && wardRooms.length > 3) {
    console.log(`      ... and ${wardRooms.length - 3} more`);
  }

  // Count beds
  const { data: wardBeds } = await supabase
    .from('beds')
    .select('id, bed_number, bed_status')
    .eq('ward_id', wardId)
    .eq('practice_id', practiceId);

  console.log(`   🛏️  Beds: ${wardBeds?.length || 0}`);
  wardBeds?.slice(0, 3).forEach(b => {
    console.log(`      - ${b.bed_number}: ${b.bed_status}`);
  });
  if (wardBeds && wardBeds.length > 3) {
    console.log(`      ... and ${wardBeds.length - 3} more`);
  }
}

// Summary
console.log(`\n\n${'='.repeat(80)}`);
console.log('🎯 SUMMARY');
console.log('='.repeat(80));

console.log(`\n📋 What's in hospital_wards table:`);
console.log(`   Total wards: ${wards?.length || 0}`);
wards?.forEach(w => {
  console.log(`   - ${w.ward_name} (${w.ward_code})`);
});

console.log(`\n📋 What rooms/beds are linked to:`);
console.log(`   Unique ward IDs in rooms: ${uniqueRoomWardIds.length}`);
console.log(`   Unique ward IDs in beds: ${uniqueBedWardIds.length}`);

const orphanedWardIds = allReferencedWardIds.filter(id => !wards?.find(w => w.id === id));
if (orphanedWardIds.length > 0) {
  console.log(`\n⚠️ ORPHANED DATA DETECTED:`);
  console.log(`   ${orphanedWardIds.length} ward ID(s) referenced by rooms/beds but not in hospital_wards table`);
  orphanedWardIds.forEach(id => console.log(`   - ${id}`));
} else {
  console.log(`\n✅ No orphaned data - all rooms/beds link to valid wards`);
}

const unusedWards = wards?.filter(w => !allReferencedWardIds.includes(w.id)) || [];
if (unusedWards.length > 0) {
  console.log(`\n⚠️ UNUSED WARDS:`);
  console.log(`   ${unusedWards.length} ward(s) exist but have no rooms or beds`);
  unusedWards.forEach(w => console.log(`   - ${w.ward_name} (${w.ward_code}): ${w.id}`));
}

console.log(`\n✅ ANALYSIS COMPLETE\n`);
#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixWardForeignKeys() {
  console.log('🔧 Fixing ward foreign keys in rooms and beds tables...\n');

  const wardMappings = [
    { old: '4e42221f-8d06-406c-ab5b-6fbd8357d72b', new: '4b6c4665-881c-4dbe-bf8c-f4f3d19a156b', code: 'GWA' },
    { old: '334fdafc-6a69-4a33-ab1b-95c2a870b47f', new: '7c241deb-24e9-46de-a4be-a9edecd541ff', code: 'ICU' },
    { old: 'aec8cb5c-56ad-4753-b0a0-549ab6c8df23', new: '70e35be8-d61f-48f2-9bbf-73cbf5a20a9d', code: 'PED' },
    { old: '96b8237f-0bfa-4d4c-947f-6ed6f97f7c96', new: '06c2d5a9-380a-4366-a482-2f3e05ad834c', code: 'MAT' },
    { old: '19d6282a-3758-4dbe-bae5-9666def525c1', new: 'c1d59866-aa7c-4276-bafd-5cce5a035c3a', code: 'EMG' }
  ];

  for (const mapping of wardMappings) {
    console.log(`\n📍 Processing ward: ${mapping.code}`);
    console.log(`   Old ID: ${mapping.old}`);
    console.log(`   New ID: ${mapping.new}`);

    // Update rooms
    const { data: roomsData, error: roomsError } = await supabase
      .from('rooms')
      .update({ ward_id: mapping.new })
      .eq('ward_id', mapping.old)
      .select('id');

    if (roomsError) {
      console.error(`   ❌ Rooms update error:`, roomsError);
    } else {
      console.log(`   ✅ Updated ${roomsData?.length || 0} rooms`);
    }

    // Update beds
    const { data: bedsData, error: bedsError } = await supabase
      .from('beds')
      .update({ ward_id: mapping.new })
      .eq('ward_id', mapping.old)
      .select('id');

    if (bedsError) {
      console.error(`   ❌ Beds update error:`, bedsError);
    } else {
      console.log(`   ✅ Updated ${bedsData?.length || 0} beds`);
    }
  }

  // Verification
  console.log('\n\n📊 VERIFICATION RESULTS:');
  console.log('=' .repeat(60));

  // Count rooms by ward
  const { data: roomCounts, error: roomCountsError } = await supabase
    .from('rooms')
    .select('ward_id')
    .order('ward_id');

  if (roomCountsError) {
    console.error('❌ Error counting rooms:', roomCountsError);
  } else {
    const roomGrouped = roomCounts.reduce((acc, room) => {
      acc[room.ward_id] = (acc[room.ward_id] || 0) + 1;
      return acc;
    }, {});

    console.log('\n🏠 ROOMS BY WARD:');
    Object.entries(roomGrouped).forEach(([wardId, count]) => {
      const mapping = wardMappings.find(m => m.new === wardId);
      console.log(`   ${mapping?.code || 'UNKNOWN'} (${wardId}): ${count} rooms`);
    });
  }

  // Count beds by ward
  const { data: bedCounts, error: bedCountsError } = await supabase
    .from('beds')
    .select('ward_id')
    .order('ward_id');

  if (bedCountsError) {
    console.error('❌ Error counting beds:', bedCountsError);
  } else {
    const bedGrouped = bedCounts.reduce((acc, bed) => {
      acc[bed.ward_id] = (acc[bed.ward_id] || 0) + 1;
      return acc;
    }, {});

    console.log('\n🛏️ BEDS BY WARD:');
    Object.entries(bedGrouped).forEach(([wardId, count]) => {
      const mapping = wardMappings.find(m => m.new === wardId);
      console.log(`   ${mapping?.code || 'UNKNOWN'} (${wardId}): ${count} beds`);
    });
  }

  // Check for orphaned records
  console.log('\n\n🔍 CHECKING FOR ORPHANED RECORDS:');
  const validWardIds = wardMappings.map(m => m.new);

  const { data: orphanedRooms, error: orphanedRoomsError } = await supabase
    .from('rooms')
    .select('id, ward_id')
    .not('ward_id', 'in', `(${validWardIds.join(',')})`);

  if (orphanedRoomsError) {
    console.error('❌ Error checking orphaned rooms:', orphanedRoomsError);
  } else if (orphanedRooms && orphanedRooms.length > 0) {
    console.log(`⚠️ Found ${orphanedRooms.length} orphaned rooms:`);
    orphanedRooms.forEach(room => {
      console.log(`   Room ${room.id} → Ward ${room.ward_id}`);
    });
  } else {
    console.log('✅ No orphaned rooms found');
  }

  const { data: orphanedBeds, error: orphanedBedsError } = await supabase
    .from('beds')
    .select('id, ward_id')
    .not('ward_id', 'in', `(${validWardIds.join(',')})`);

  if (orphanedBedsError) {
    console.error('❌ Error checking orphaned beds:', orphanedBedsError);
  } else if (orphanedBeds && orphanedBeds.length > 0) {
    console.log(`⚠️ Found ${orphanedBeds.length} orphaned beds:`);
    orphanedBeds.forEach(bed => {
      console.log(`   Bed ${bed.id} → Ward ${bed.ward_id}`);
    });
  } else {
    console.log('✅ No orphaned beds found');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Ward foreign key fix completed!\n');
}

fixWardForeignKeys().catch(console.error);
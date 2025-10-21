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

async function checkActualWards() {
  console.log('🔍 Checking actual wards in database...\n');

  // Get all wards
  const { data: wards, error: wardsError } = await supabase
    .from('wards')
    .select('*')
    .order('ward_code');

  if (wardsError) {
    console.error('❌ Error fetching wards:', wardsError);
    return;
  }

  console.log(`📊 Found ${wards.length} wards:\n`);

  wards.forEach((ward, index) => {
    console.log(`${index + 1}. Ward Code: ${ward.ward_code}`);
    console.log(`   ID: ${ward.id}`);
    console.log(`   Name: ${ward.ward_name}`);
    console.log(`   Department: ${ward.department_id || 'N/A'}`);
    console.log(`   Practice: ${ward.practice_id || 'N/A'}`);
    console.log('');
  });

  // Get orphaned rooms and beds ward IDs
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('ward_id')
    .order('ward_id');

  if (roomsError) {
    console.error('❌ Error fetching rooms:', roomsError);
    return;
  }

  const uniqueRoomWardIds = [...new Set(rooms.map(r => r.ward_id))];

  console.log('\n🏠 Unique Ward IDs in rooms table:');
  uniqueRoomWardIds.forEach(wardId => {
    const count = rooms.filter(r => r.ward_id === wardId).length;
    const matchingWard = wards.find(w => w.id === wardId);
    console.log(`   ${wardId} → ${count} rooms ${matchingWard ? `(${matchingWard.ward_code})` : '(ORPHANED)'}`);
  });

  const { data: beds, error: bedsError } = await supabase
    .from('beds')
    .select('ward_id')
    .order('ward_id');

  if (bedsError) {
    console.error('❌ Error fetching beds:', bedsError);
    return;
  }

  const uniqueBedWardIds = [...new Set(beds.map(b => b.ward_id))];

  console.log('\n🛏️ Unique Ward IDs in beds table:');
  uniqueBedWardIds.forEach(wardId => {
    const count = beds.filter(b => b.ward_id === wardId).length;
    const matchingWard = wards.find(w => w.id === wardId);
    console.log(`   ${wardId} → ${count} beds ${matchingWard ? `(${matchingWard.ward_code})` : '(ORPHANED)'}`);
  });

  // Identify orphaned ward IDs
  const orphanedWardIds = [...new Set([...uniqueRoomWardIds, ...uniqueBedWardIds])].filter(
    wardId => !wards.find(w => w.id === wardId)
  );

  console.log('\n\n⚠️ ORPHANED WARD IDs (not in wards table):');
  orphanedWardIds.forEach(wardId => {
    const roomCount = rooms.filter(r => r.ward_id === wardId).length;
    const bedCount = beds.filter(b => b.ward_id === wardId).length;
    console.log(`   ${wardId}: ${roomCount} rooms, ${bedCount} beds`);
  });

  console.log('\n📋 SUGGESTED MAPPING (based on ward codes):');
  const oldWardIds = [
    { id: '4e42221f-8d06-406c-ab5b-6fbd8357d72b', code: 'GWA' },
    { id: '334fdafc-6a69-4a33-ab1b-95c2a870b47f', code: 'ICU' },
    { id: 'aec8cb5c-56ad-4753-b0a0-549ab6c8df23', code: 'PED' },
    { id: '96b8237f-0bfa-4d4c-947f-6ed6f97f7c96', code: 'MAT' },
    { id: '19d6282a-3758-4dbe-bae5-9666def525c1', code: 'EMG' },
    { id: '66f8dd37-c435-40d4-93d8-8fa53a5dace4', code: 'SURG' },
    { id: '984baf55-4755-414c-b633-04c6de4b9785', code: 'ORTHO' },
    { id: '190e3184-0755-4ab9-995d-74387e51620b', code: 'CARD' }
  ];

  oldWardIds.forEach(oldWard => {
    const matchingCurrentWard = wards.find(w => w.ward_code === oldWard.code);
    if (matchingCurrentWard) {
      const roomCount = rooms.filter(r => r.ward_id === oldWard.id).length;
      const bedCount = beds.filter(b => b.ward_id === oldWard.id).length;
      if (roomCount > 0 || bedCount > 0) {
        console.log(`\n${oldWard.code}:`);
        console.log(`   Old ID: ${oldWard.id}`);
        console.log(`   New ID: ${matchingCurrentWard.id}`);
        console.log(`   Affected: ${roomCount} rooms, ${bedCount} beds`);
      }
    }
  });
}

checkActualWards().catch(console.error);
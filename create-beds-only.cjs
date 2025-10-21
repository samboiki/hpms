const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createBeds() {
  console.log('=== CREATING BEDS ===\n');

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*');

  console.log(`Found ${rooms.length} rooms\n`);

  let totalBeds = 0;

  // Process in batches of 10 rooms
  for (let i = 0; i < rooms.length; i += 10) {
    const batch = rooms.slice(i, i + 10);
    const bedsToCreate = [];

    for (const room of batch) {
      const bedCount = room.room_type === 'private' ? 1 : 2;
      for (let b = 1; b <= bedCount; b++) {
        bedsToCreate.push({
          room_id: room.id,
          ward_id: room.ward_id,
          bed_number: room.room_number + '-B' + b,
          bed_type: room.room_type,
          status: 'available',
          is_active: true
        });
      }
    }

    const { data, error } = await supabase
      .from('beds')
      .insert(bedsToCreate)
      .select();

    if (error) {
      console.error(`Batch ${i/10 + 1} error:`, error.message);
    } else {
      totalBeds += data.length;
      console.log(`Batch ${i/10 + 1}: Created ${data.length} beds`);
    }
  }

  const { count: finalCount } = await supabase.from('beds').select('*', { count: 'exact', head: true });
  console.log(`\n✓ Total beds created: ${totalBeds}`);
  console.log(`✓ Final bed count: ${finalCount}`);

  process.exit(0);
}

createBeds();

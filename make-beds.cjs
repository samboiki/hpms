const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createBeds() {
  const { data: rooms } = await supabase.from('rooms').select('*');
  const bedsToCreate = [];
  for (const room of rooms) {
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
  const { data, error } = await supabase.from('beds').insert(bedsToCreate).select();
  if (error) console.error('Error:', error.message);
  else console.log('Created', data.length, 'beds');
  const { count } = await supabase.from('beds').select('*', { count: 'exact', head: true });
  console.log('Total beds:', count);
  process.exit(0);
}
createBeds();

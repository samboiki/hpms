const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('=== CHECKING DATABASE STATE ===\n');

  // Check wards
  const { data: wards, count: wardCount } = await supabase
    .from('wards')
    .select('*', { count: 'exact' });

  console.log(`Wards: ${wardCount} records`);
  if (wards && wards.length > 0) {
    console.log('Sample ward:', {
      id: wards[0].id,
      name: wards[0].ward_name,
      code: wards[0].ward_code
    });
  }

  // Check rooms
  const { data: rooms, count: roomCount } = await supabase
    .from('rooms')
    .select('*', { count: 'exact' });

  console.log(`\nRooms: ${roomCount} records`);

  // Check beds
  const { data: beds, count: bedCount } = await supabase
    .from('beds')
    .select('*', { count: 'exact' });

  console.log(`Beds: ${bedCount} records`);
}

checkSchema().catch(console.error);

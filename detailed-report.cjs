const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function detailedReport() {
  console.log('=== INPATIENT MODULE DETAILED REPORT ===\n');

  const { data: wards } = await supabase.from('wards').select('*').order('ward_code');
  
  console.log('ALL WARDS:\n');
  for (const ward of wards) {
    const { count: roomCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('ward_id', ward.id);
    const { count: bedCount } = await supabase.from('beds').select('*', { count: 'exact', head: true }).eq('ward_id', ward.id);
    
    console.log(ward.ward_name + ' (' + ward.ward_code + ')');
    console.log('  Type: ' + ward.ward_type);
    console.log('  Capacity: ' + ward.capacity);
    console.log('  Floor: ' + (ward.floor_number || 'N/A'));
    console.log('  Rooms: ' + roomCount);
    console.log('  Beds: ' + bedCount);
    console.log('  Active: ' + (ward.is_active ? 'Yes' : 'No'));
    console.log('');
  }

  const { count: wardCount } = await supabase.from('wards').select('*', { count: 'exact', head: true });
  const { count: roomCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
  const { count: bedCount } = await supabase.from('beds').select('*', { count: 'exact', head: true });

  console.log('SUMMARY:');
  console.log('  Total Wards: ' + wardCount);
  console.log('  Total Rooms: ' + roomCount);
  console.log('  Total Beds: ' + bedCount);
  console.log('  Avg Rooms per Ward: ' + (roomCount / wardCount).toFixed(1));
  console.log('  Avg Beds per Ward: ' + (bedCount / wardCount).toFixed(1));
  console.log('  Avg Beds per Room: ' + (bedCount / roomCount).toFixed(1));

  process.exit(0);
}
detailedReport();

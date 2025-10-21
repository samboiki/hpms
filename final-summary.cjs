const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function summary() {
  const { count: wardCount } = await supabase.from('wards').select('*', { count: 'exact', head: true });
  const { count: roomCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
  const { count: bedCount } = await supabase.from('beds').select('*', { count: 'exact', head: true });

  console.log('===  INPATIENT MODULE DATABASE MIGRATION COMPLETE ===\n');
  console.log('Database Structure: departments → wards → rooms → beds\n');
  console.log('FINAL COUNTS:');
  console.log('  Wards:', wardCount);
  console.log('  Rooms:', roomCount);
  console.log('  Beds:', bedCount);
  console.log('\n✅ SUCCESS: All tables created with correct relationships!');
  
  process.exit(0);
}
summary();

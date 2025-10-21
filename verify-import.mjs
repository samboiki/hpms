import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function verify() {
  console.log('🔍 VERIFICATION REPORT\n');
  console.log('═══════════════════════════════════════════════════\n');

  // Count practices by status
  const { count: totalCount } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true });

  const { count: leadCount } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'lead');

  console.log(`📊 Total practices in database: ${totalCount}`);
  console.log(`🎯 Practices with status='lead': ${leadCount}\n`);

  // Get sample practices
  const { data: samples } = await supabase
    .from('practices')
    .select('id, name, contact_email, contact_phone, city, status, practice_type_id, settings')
    .eq('status', 'lead')
    .limit(5);

  console.log('📋 Sample imported practices:\n');
  samples.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   City: ${p.city || 'N/A'}`);
    console.log(`   Email: ${p.contact_email || 'N/A'}`);
    console.log(`   Phone: ${p.contact_phone || 'N/A'}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Discipline: ${p.settings?.discipline_name || 'N/A'}`);
    console.log(`   Practice Number: ${p.settings?.practice_number || 'N/A'}\n`);
  });

  // Count by practice type
  console.log('📈 Practices by type:\n');
  const { data: byType } = await supabase
    .from('practices')
    .select('practice_type_id, practice_types(name)')
    .eq('status', 'lead');

  const typeCounts = {};
  byType.forEach(p => {
    const typeName = p.practice_types?.name || 'Unknown';
    typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
  });

  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count} practices`);
    });

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Verification complete!');
}

verify();

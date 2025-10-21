import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyImport() {
  console.log('📊 Verifying client_leads import...\n');

  // Total count
  const { count } = await supabase
    .from('client_leads')
    .select('*', { count: 'exact', head: true });

  console.log(`✅ Total records: ${count}\n`);

  // Sample records
  console.log('📋 Sample records (first 5):');
  const { data: samples } = await supabase
    .from('client_leads')
    .select('*')
    .limit(5);

  samples?.forEach((record, i) => {
    console.log(`\n${i + 1}. ${record.practice_name}`);
    console.log(`   Practice #: ${record.practice_number}`);
    console.log(`   Discipline: ${record.discipline_name}`);
    console.log(`   Town: ${record.town}`);
    console.log(`   Email: ${record.email || 'N/A'}`);
  });

  // Statistics
  console.log('\n\n📊 Statistics:');

  const { data: disciplines } = await supabase
    .from('client_leads')
    .select('discipline_name');

  const disciplineCounts = disciplines?.reduce((acc, d) => {
    acc[d.discipline_name] = (acc[d.discipline_name] || 0) + 1;
    return acc;
  }, {});

  console.log('\nBy Discipline (Top 5):');
  Object.entries(disciplineCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([discipline, count]) => {
      console.log(`   ${discipline}: ${count}`);
    });

  const { data: towns } = await supabase
    .from('client_leads')
    .select('town');

  const townCounts = towns?.reduce((acc, t) => {
    acc[t.town] = (acc[t.town] || 0) + 1;
    return acc;
  }, {});

  console.log('\nBy Town (Top 5):');
  Object.entries(townCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([town, count]) => {
      console.log(`   ${town}: ${count}`);
    });

  // Check for specific practices
  console.log('\n\n🔍 Sample specific queries:');

  const { data: windhoekPractices } = await supabase
    .from('client_leads')
    .select('practice_name, discipline_name')
    .eq('town', 'Windhoek')
    .limit(3);

  console.log('\nWindhoek practices (sample):');
  windhoekPractices?.forEach(p => {
    console.log(`   - ${p.practice_name} (${p.discipline_name})`);
  });

  const { data: dentists } = await supabase
    .from('client_leads')
    .select('practice_name, town')
    .eq('discipline_name', 'DENTIST')
    .limit(3);

  console.log('\nDentists (sample):');
  dentists?.forEach(p => {
    console.log(`   - ${p.practice_name} in ${p.town}`);
  });

  console.log('\n✅ Verification complete!\n');
}

verifyImport().catch(console.error);

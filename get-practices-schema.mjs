import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjE3MTM5NCwiZXhwIjoyMDQ3NzQ3Mzk0fQ.h1fUmhypKdBa_pq01aYcxLYy2WnVWNr05r5Ip97LwQs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getPracticesSchema() {
  console.log('\n📊 FETCHING PRACTICES TABLE SCHEMA...\n');

  const { data: sample, error: sampleError } = await supabase
    .from('practices')
    .select('*')
    .limit(1)
    .single();

  if (sampleError) {
    console.error('❌ Sample Error:', sampleError);
  } else {
    console.log('✅ SAMPLE PRACTICE RECORD:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(sample, null, 2));
    console.log('='.repeat(80));

    console.log('\n✅ FIELD NAMES IN SAMPLE:');
    console.log(Object.keys(sample).join(', '));
  }

  const { data: allPractices, error: allError } = await supabase
    .from('practices')
    .select('id, name, type, email, phone, address, city, status, created_at')
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('❌ All Practices Error:', allError);
  } else {
    console.log(`\n✅ FOUND ${allPractices.length} PRACTICES:`);
    console.log('='.repeat(80));
    allPractices.forEach((p, idx) => {
      console.log(`\n[${idx + 1}] ID: ${p.id}`);
      console.log(`    Name: ${p.name || 'N/A'}`);
      console.log(`    Type: ${p.type || 'N/A'}`);
      console.log(`    Email: ${p.email || 'N/A'}`);
      console.log(`    Phone: ${p.phone || 'N/A'}`);
      console.log(`    Address: ${p.address || 'N/A'}`);
      console.log(`    City: ${p.city || 'N/A'}`);
      console.log(`    Status: ${p.status || 'N/A'}`);
      console.log(`    Created: ${p.created_at || 'N/A'}`);
    });
  }
}

getPracticesSchema().catch(console.error);

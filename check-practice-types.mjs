import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function checkTypes() {
  const { data: types } = await supabase
    .from('practice_types')
    .select('*')
    .order('name');

  console.log('\n📋 Practice Types in Database:\n');
  types.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} (${t.description})`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Active: ${t.is_active}`);
    console.log('');
  });
}

checkTypes();

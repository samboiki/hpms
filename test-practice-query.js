import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdDE6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery() {
  console.log('Testing the exact query from practiceDataService...\n');

  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

  // Test the exact query
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(id, first_name, last_name, cell_number, date_of_birth, gender),
      doctor:users!doctor_id(id, full_name, practice_id)
    `)
    .eq('practice_id', practiceId)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) {
    console.error('Query error:', error);
  } else {
    console.log(`Query returned ${appointments?.length || 0} appointments`);
    
    if (appointments && appointments.length > 0) {
      console.log('\nFirst appointment:', JSON.stringify(appointments[0], null, 2));
    }
  }

  // Test without the join
  console.log('\n\nTesting simple query without joins...');
  const { data: simpleAppts, error: simpleError } = await supabase
    .from('appointments')
    .select('*')
    .eq('practice_id', practiceId);

  if (simpleError) {
    console.error('Simple query error:', simpleError);
  } else {
    console.log(`Simple query returned ${simpleAppts?.length || 0} appointments`);
  }
}

testQuery();
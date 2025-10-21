const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkActualTables() {
  console.log('='.repeat(80));
  console.log('CHECKING ACTUAL TABLE AND COLUMN NAMES');
  console.log('='.repeat(80));

  // Check for inpatient-related tables
  const tablesToCheck = [
    'hospital_beds',
    'beds',
    'inpatient_beds',
    'patient_admissions',
    'admissions',
    'inpatient_admissions',
    'hospital_rooms',
    'rooms',
    'inpatient_rooms',
    'hospital_wards',
    'wards',
    'inpatient_wards'
  ];

  for (const tableName of tablesToCheck) {
    console.log(`\nChecking table: ${tableName}`);
    console.log('-'.repeat(80));

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Table does not exist or not accessible: ${error.message}`);
    } else {
      console.log(`✅ Table exists!`);
      if (data && data.length > 0) {
        console.log('Sample columns:', Object.keys(data[0]).join(', '));
      } else {
        console.log('Table is empty, fetching schema...');
        // Try to insert and rollback to see columns
        const { error: insertError } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);
        console.log('Table accessible but empty');
      }
    }
  }

  // Check wards in detail since we know they exist
  console.log('\n\n' + '='.repeat(80));
  console.log('DETAILED WARD INFORMATION');
  console.log('='.repeat(80));

  const { data: wards, error: wardsError } = await supabase
    .from('hospital_wards')
    .select('*')
    .limit(5);

  if (!wardsError && wards) {
    console.log('\nWard columns:', Object.keys(wards[0] || {}).join(', '));
    console.log('\nSample ward records:');
    console.log(JSON.stringify(wards, null, 2));
  }

  console.log('\n' + '='.repeat(80));
  console.log('CHECK COMPLETE');
  console.log('='.repeat(80));
}

checkActualTables();
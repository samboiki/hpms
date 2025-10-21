const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';
const projectUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';

async function executeSql(sql) {
  const response = await fetch(`${projectUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return await response.json();
}

async function fixFK() {
  try {
    console.log('🔧 Step 1: Dropping old FK constraint...');
    await executeSql('ALTER TABLE bed_allocations DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey CASCADE;');
    console.log('✅ Old constraint dropped');

    console.log('\n🔧 Step 2: Adding new FK constraint to beds table...');
    await executeSql('ALTER TABLE bed_allocations ADD CONSTRAINT bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE;');
    console.log('✅ New constraint added!');

    console.log('\n🎉 SUCCESS! bed_allocations now points to beds table!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixFK();

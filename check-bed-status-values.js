import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDg1NDY0NCwiZXhwIjoyMDUwNDMwNjQ0fQ.r3aWOEhKCTnuLzEumwKbQ2AXVVDvKh0xeQNlgVGPWYA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBedStatusValues() {
  console.log('🔍 Querying distinct bed_status values from beds table...\n');

  const { data, error } = await supabase
    .from('beds')
    .select('bed_status')
    .order('bed_status');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Get unique values
  const uniqueStatuses = [...new Set(data.map(row => row.bed_status))].sort();

  console.log('✅ DISTINCT BED_STATUS VALUES:');
  console.log('================================');
  uniqueStatuses.forEach((status, index) => {
    console.log(`${index + 1}. "${status}" (Type: ${typeof status})`);
  });
  console.log('================================\n');

  console.log('📊 TOTAL RECORDS:', data.length);
  console.log('📊 UNIQUE STATUSES:', uniqueStatuses.length);

  console.log('\n🔍 STATUS BREAKDOWN:');
  const statusCounts = data.reduce((acc, row) => {
    acc[row.bed_status] = (acc[row.bed_status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  "${status}": ${count} beds`);
  });
}

checkBedStatusValues().catch(console.error);
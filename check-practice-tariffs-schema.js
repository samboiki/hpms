import { createClient } from '@supabase/supabase-js';

// Use service role to check table schema
const serviceClient = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function checkSchema() {
  console.log('🔍 Checking practice_tariffs table schema...\n');
  
  try {
    // Get a sample record to see all columns
    const { data: sample, error: sampleError } = await serviceClient
      .from('practice_tariffs')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log('❌ Error getting sample:', sampleError.message);
      return;
    }
    
    if (sample && sample.length > 0) {
      console.log('✅ Sample record columns:');
      const columns = Object.keys(sample[0]);
      columns.forEach((col, idx) => {
        console.log(`  ${idx + 1}. ${col}: ${typeof sample[0][col]} = ${JSON.stringify(sample[0][col])}`);
      });
      
      console.log('\n📋 All available columns:');
      console.log(columns.join(', '));
      
      // Check for practice_type related columns
      const practiceTypeColumns = columns.filter(col => 
        col.toLowerCase().includes('practice') || 
        col.toLowerCase().includes('type') ||
        col.toLowerCase().includes('dental')
      );
      
      console.log('\n🏥 Practice/Type related columns:');
      console.log(practiceTypeColumns.length > 0 ? practiceTypeColumns.join(', ') : 'None found');
      
    } else {
      console.log('❌ No records found in practice_tariffs');
    }
    
    // Get count of records
    const { count } = await serviceClient
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Total records in practice_tariffs: ${count}`);
    
  } catch (err) {
    console.error('💥 Exception:', err.message);
  }
}

checkSchema();
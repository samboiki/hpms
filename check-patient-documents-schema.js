import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function checkSchema() {
  console.log('🔍 Checking patient_documents table schema...\n');
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'patient_documents' 
        ORDER BY ordinal_position;
      `
    });
    
    if (error) {
      console.log('❌ Error:', error);
    } else {
      console.log('📋 Current patient_documents schema:');
      console.log(data);
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

checkSchema();
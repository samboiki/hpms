// Simple script to add missing column
const { createClient } = require('@supabase/supabase-js');

async function fixSchema() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://txuykisvqfsjjclnxlmf.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseServiceKey) {
    console.log('❌ No service role key found');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔧 Adding is_processed column...');
    
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: 'ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT FALSE;'
    });
    
    if (error) {
      console.log('❌ Error:', error);
    } else {
      console.log('✅ Success:', data);
    }
  } catch (err) {
    console.log('❌ Catch error:', err.message);
  }
}

fixSchema();
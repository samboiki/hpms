import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 200) + (query.length > 200 ? '...' : ''));
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ SQL execution failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🔍 Investigating medical aid structure and billing logic...\n');

  // 1. Check medical_aid_providers table structure
  console.log('🏥 Checking medical_aid_providers table structure...');
  const providersStructureQuery = `
    SELECT 
      column_name, 
      data_type, 
      is_nullable, 
      column_default 
    FROM information_schema.columns 
    WHERE table_name = 'medical_aid_providers' 
    ORDER BY ordinal_position;
  `;
  await executeSql(providersStructureQuery);

  // 2. Get sample medical aid providers data
  console.log('📋 Getting sample medical aid providers...');
  const sampleProvidersQuery = `
    SELECT id, name, short_name, logo_url, is_active 
    FROM medical_aid_providers 
    WHERE is_active = true
    ORDER BY name
    LIMIT 10;
  `;
  await executeSql(sampleProvidersQuery);

  // 3. Check invoice services table structure
  console.log('💰 Checking invoice_services table structure...');
  const invoiceServicesStructureQuery = `
    SELECT 
      column_name, 
      data_type, 
      is_nullable, 
      column_default 
    FROM information_schema.columns 
    WHERE table_name = 'invoice_services' 
    ORDER BY ordinal_position;
  `;
  await executeSql(invoiceServicesStructureQuery);

  // 4. Check for sample invoice services with medical aid data
  console.log('🧾 Getting sample invoice services with billing data...');
  const sampleInvoiceServicesQuery = `
    SELECT 
      code, 
      description, 
      total_price, 
      medical_aid_covered, 
      patient_portion,
      created_at
    FROM invoice_services 
    WHERE medical_aid_covered > 0 OR patient_portion > 0
    ORDER BY created_at DESC
    LIMIT 10;
  `;
  await executeSql(sampleInvoiceServicesQuery);

  console.log('\n🎉 Medical aid investigation completed!');
}

main().catch(console.error);
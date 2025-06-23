import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
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
  console.log('🔍 DETAILED Medical Aid Billing Investigation...\n');

  // 1. Get medical aid providers structure and sample data
  console.log('🏥 Medical Aid Providers Table:');
  await executeSql(`
    SELECT name, short_name, logo_url 
    FROM medical_aid_providers 
    ORDER BY name 
    LIMIT 10;
  `);

  // 2. Get detailed invoice services structure
  console.log('\n💰 Invoice Services Fields:');
  await executeSql(`
    SELECT 
      column_name, 
      data_type, 
      column_default 
    FROM information_schema.columns 
    WHERE table_name = 'invoice_services' 
    AND column_name IN ('medical_aid_covered', 'patient_portion', 'total_price', 'code', 'description')
    ORDER BY column_name;
  `);

  // 3. Get actual billing data samples
  console.log('\n🧾 Recent Invoice Services with Billing Breakdown:');
  await executeSql(`
    SELECT 
      code, 
      description, 
      quantity,
      unit_price,
      total_price, 
      medical_aid_covered, 
      patient_portion,
      (total_price - medical_aid_covered - patient_portion) as calculation_check,
      created_at::date as invoice_date
    FROM invoice_services 
    ORDER BY created_at DESC
    LIMIT 15;
  `);

  // 4. Get medical aid details structure
  console.log('\n📝 Medical Aid Details Structure:');
  await executeSql(`
    SELECT 
      column_name, 
      data_type 
    FROM information_schema.columns 
    WHERE table_name = 'medical_aid_details' 
    ORDER BY ordinal_position;
  `);

  // 5. Check patients with medical aid and their billing patterns
  console.log('\n👥 Patients with Medical Aid and Their Recent Invoices:');
  await executeSql(`
    SELECT 
      p.first_name || ' ' || p.last_name as patient_name,
      mad.provider as medical_aid_provider,
      mad.membership_number,
      ie.invoice_number,
      ie.total,
      ie.medical_aid_total,
      ie.patient_total,
      CASE 
        WHEN ie.medical_aid_total > 0 THEN 'Medical Aid Coverage Applied'
        WHEN ie.patient_total = ie.total THEN 'Patient Pays Full Amount'
        ELSE 'Mixed Coverage'
      END as billing_type
    FROM patients p
    JOIN medical_aid_details mad ON mad.patient_id = p.id
    JOIN invoices_enhanced ie ON ie.patient_id = p.id
    ORDER BY ie.created_at DESC
    LIMIT 10;
  `);

  // 6. Analyze billing logic patterns
  console.log('\n📊 Billing Logic Analysis:');
  await executeSql(`
    SELECT 
      COUNT(*) as total_invoices,
      COUNT(CASE WHEN medical_aid_total > 0 THEN 1 END) as with_medical_aid,
      COUNT(CASE WHEN patient_total = total THEN 1 END) as patient_pays_all,
      ROUND(AVG(medical_aid_total), 2) as avg_medical_aid_amount,
      ROUND(AVG(patient_total), 2) as avg_patient_amount
    FROM invoices_enhanced 
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
  `);

  console.log('\n🎉 Detailed investigation completed!');
}

main().catch(console.error);
const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function debugBillingInsert() {
  try {
    console.log('🔍 Debugging billing insert...');

    // Test simple insert
    const { data: testInsert, error: testError } = await supabase
      .from('visit_services')
      .insert([{
        visit_id: '635be7a0-7a39-4844-85b9-143d91f8a521', // Known visit ID
        tariff_id: '018f2e8d-b4d5-7f11-88e7-b5a7e04ab6a4', // Known tariff ID  
        quantity: 1,
        unit_price: 100.00,
        total_price: 100.00,
        notes: 'Test service'
      }])
      .select();

    if (testError) {
      console.log('❌ Test insert failed:', testError);
    } else {
      console.log('✅ Test insert succeeded:', testInsert);
    }

    // Check if foreign keys exist
    const { data: visitCheck } = await supabase
      .from('visits')
      .select('id')
      .eq('id', '635be7a0-7a39-4844-85b9-143d91f8a521');
    
    console.log('Visit exists:', visitCheck?.length > 0);

    const { data: tariffCheck } = await supabase
      .from('practice_tariffs')
      .select('id')
      .eq('id', '018f2e8d-b4d5-7f11-88e7-b5a7e04ab6a4');
    
    console.log('Tariff exists:', tariffCheck?.length > 0);

    // Try to get actual IDs
    const { data: realVisit } = await supabase
      .from('visits')
      .select('id')
      .limit(1);
    
    const { data: realTariff } = await supabase
      .from('practice_tariffs')
      .select('id, price')
      .not('price', 'is', null)
      .gt('price', 0)
      .limit(1);

    console.log('Real visit ID:', realVisit?.[0]?.id);
    console.log('Real tariff ID:', realTariff?.[0]?.id);

    if (realVisit?.[0] && realTariff?.[0]) {
      console.log('\n🔄 Trying with real IDs...');
      
      const { data: realInsert, error: realError } = await supabase
        .from('visit_services')
        .insert([{
          visit_id: realVisit[0].id,
          tariff_id: realTariff[0].id,
          quantity: 1,
          unit_price: realTariff[0].price,
          total_price: realTariff[0].price,
          notes: 'Real test service'
        }])
        .select();

      if (realError) {
        console.log('❌ Real insert failed:', realError);
      } else {
        console.log('✅ Real insert succeeded:', realInsert);
      }
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugBillingInsert();
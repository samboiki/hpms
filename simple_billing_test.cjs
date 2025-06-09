const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function testBillingTables() {
  try {
    console.log('🧪 Testing billing tables...');

    // First check if we can read from all tables
    console.log('\n📖 Testing read access...');
    
    const { data: services, error: servicesError } = await supabase
      .from('visit_services')
      .select('*')
      .limit(1);
    console.log('visit_services read:', servicesError ? `❌ ${servicesError.message}` : '✅ Success');

    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices_enhanced')
      .select('*')
      .limit(1);
    console.log('invoices_enhanced read:', invoicesError ? `❌ ${invoicesError.message}` : '✅ Success');

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items_enhanced')
      .select('*')
      .limit(1);
    console.log('invoice_items_enhanced read:', itemsError ? `❌ ${itemsError.message}` : '✅ Success');

    // Get sample data we know exists
    const { data: visits } = await supabase
      .from('visits')
      .select('id, patient_id, visit_date')
      .limit(1);
    
    const { data: tariffs } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, price')
      .not('price', 'is', null)
      .gt('price', 0)
      .limit(1);

    if (!visits?.[0] || !tariffs?.[0]) {
      console.log('❌ Missing test data');
      return;
    }

    console.log(`\n🎯 Test data: Visit ${visits[0].id}, Tariff ${tariffs[0].id}`);

    // Test a minimal insert to check what's happening
    console.log('\n📝 Testing minimal insert...');
    
    try {
      // Try with minimal data
      const { data, error } = await supabase
        .from('visit_services')
        .insert({
          visit_id: visits[0].id,
          tariff_id: tariffs[0].id,
          quantity: 1,
          unit_price: 100,
          total_price: 100
        })
        .select()
        .single();

      if (error) {
        console.log('❌ Insert failed:', JSON.stringify(error, null, 2));
        
        // Let's try disabling RLS temporarily for testing
        console.log('\n🔧 Checking RLS status...');
        const { data: rlsStatus, error: rlsError } = await supabase.rpc('exec_sql', {
          sql: `SELECT 
            schemaname, 
            tablename, 
            rowsecurity 
          FROM pg_tables 
          WHERE tablename IN ('visit_services', 'invoices_enhanced', 'invoice_items_enhanced')`
        });
        
        if (!rlsError && rlsStatus) {
          console.log('RLS status:', rlsStatus);
        }
        
      } else {
        console.log('✅ Insert successful:', data);
        
        // Try creating an invoice
        console.log('\n💰 Testing invoice creation...');
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices_enhanced')
          .insert({
            invoice_number: `TEST${Date.now()}`,
            patient_id: visits[0].patient_id,
            visit_id: visits[0].id,
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            subtotal: 100,
            tax: 15,
            total: 115,
            patient_total: 115,
            balance_due: 115
          })
          .select()
          .single();

        if (invoiceError) {
          console.log('❌ Invoice creation failed:', JSON.stringify(invoiceError, null, 2));
        } else {
          console.log('✅ Invoice created:', invoiceData);
          
          // Try creating invoice item
          console.log('\n📄 Testing invoice item creation...');
          const { data: itemData, error: itemCreateError } = await supabase
            .from('invoice_items_enhanced')
            .insert({
              invoice_id: invoiceData.id,
              tariff_code_id: tariffs[0].id,
              code: tariffs[0].code,
              description: tariffs[0].description,
              quantity: 1,
              unit_price: 100,
              total_price: 100,
              patient_amount: 100
            })
            .select()
            .single();

          if (itemCreateError) {
            console.log('❌ Invoice item creation failed:', JSON.stringify(itemCreateError, null, 2));
          } else {
            console.log('✅ Invoice item created:', itemData);
          }
        }
      }
    } catch (insertError) {
      console.log('❌ Insert exception:', insertError);
    }

    console.log('\n✅ Billing system test completed');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testBillingTables();
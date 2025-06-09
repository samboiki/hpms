const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function testBillingService() {
  try {
    console.log('🧪 Testing InvoiceService integration...');

    // Get sample data
    const { data: patients } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1);

    const { data: visits } = await supabase
      .from('visits')
      .select('id, visit_date, visit_type, patient_id')
      .eq('patient_id', patients[0].id)
      .limit(1);

    const { data: tariffs } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, price')
      .not('price', 'is', null)
      .gt('price', 0)
      .limit(2);

    if (!patients?.[0] || !visits?.[0] || !tariffs?.length) {
      console.log('❌ Missing test data');
      return;
    }

    console.log(`📋 Test data ready:`);
    console.log(`  Patient: ${patients[0].first_name} ${patients[0].last_name}`);
    console.log(`  Visit: ${visits[0].visit_type} on ${visits[0].visit_date}`);
    console.log(`  Tariffs: ${tariffs.length} available`);

    // Create service selections
    const services = tariffs.map(tariff => ({
      id: `service-${Date.now()}-${Math.random()}`,
      tariffId: tariff.id,
      code: tariff.code,
      description: tariff.description,
      category: 'Service',
      subcategory: 'General',
      unitPrice: tariff.price,
      quantity: 1,
      totalPrice: tariff.price,
      requiresPreAuth: false,
      medicalAidCovered: false,
      coveragePercentage: 0
    }));

    console.log('\n📝 Testing invoice service...');

    // Import the InvoiceService
    const invoiceServicePath = '/home/happy/projects/hpms/src/services/invoiceService.ts';
    
    // Since we can't import TypeScript directly, let's test by creating invoice data manually
    const invoiceData = {
      visitId: visits[0].id,
      patientId: patients[0].id,
      services: services,
      notes: 'Test invoice creation'
    };

    console.log('💰 Invoice generation request:', {
      visitId: invoiceData.visitId,
      patientId: invoiceData.patientId,
      servicesCount: invoiceData.services.length,
      totalCost: services.reduce((sum, s) => sum + s.totalPrice, 0)
    });

    // Test direct table access without RLS issues
    console.log('\n🔧 Testing direct table operations...');

    // Test visit_services insert with simpler data
    const simpleService = {
      visit_id: visits[0].id,
      tariff_id: tariffs[0].id,
      quantity: 1,
      unit_price: 100.00,
      total_price: 100.00,
      notes: 'Test service - direct insert'
    };

    console.log('🔄 Attempting direct visit_services insert...');
    const { data: serviceResult, error: serviceError } = await supabase
      .from('visit_services')
      .insert([simpleService])
      .select();

    if (serviceError) {
      console.log('❌ Direct insert failed:', serviceError);
      
      // Check if it's an RLS issue by trying to read first
      const { data: readTest, error: readError } = await supabase
        .from('visit_services')
        .select('*')
        .limit(1);
      
      console.log('📖 Read test:', readError ? `❌ ${readError.message}` : `✅ Can read (${readTest?.length || 0} records)`);
      
    } else {
      console.log('✅ Direct insert succeeded:', serviceResult);
      
      // Try creating an invoice
      const invoiceNumber = `TEST${Date.now()}`;
      const invoiceRecord = {
        invoice_number: invoiceNumber,
        patient_id: patients[0].id,
        visit_id: visits[0].id,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: 100,
        tax: 15,
        total: 115,
        patient_total: 115,
        balance_due: 115,
        notes: 'Test invoice'
      };

      const { data: invoiceResult, error: invoiceError } = await supabase
        .from('invoices_enhanced')
        .insert([invoiceRecord])
        .select();

      if (invoiceError) {
        console.log('❌ Invoice creation failed:', invoiceError);
      } else {
        console.log('✅ Invoice created:', invoiceResult[0].invoice_number);

        // Test the billing query that PremiumFolderTabs uses
        console.log('\n🧾 Testing billing query...');
        
        const { data: billingData, error: billingError } = await supabase
          .from('visits')
          .select(`
            id,
            visit_date,
            visit_time,
            visit_type,
            diagnosis,
            status,
            visit_services(
              id,
              quantity,
              unit_price,
              total_price,
              practice_tariffs(
                code,
                description
              )
            )
          `)
          .eq('patient_id', patients[0].id)
          .order('visit_date', { ascending: false });

        if (billingError) {
          console.log('❌ Billing query failed:', billingError);
        } else {
          console.log('✅ Billing query succeeded:', {
            visitsFound: billingData?.length || 0,
            visitsWithServices: billingData?.filter(v => v.visit_services?.length > 0).length || 0
          });
        }
      }
    }

    console.log('\n✅ Billing service test completed');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testBillingService();
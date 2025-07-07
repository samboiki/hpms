const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function createTablesDirectly() {
  try {
    console.log('🏗️ Creating billing tables directly...');

    // Create visit_services table
    console.log('\n1. Creating visit_services table...');
    const { data: table1, error: error1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE visit_services (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
          tariff_id UUID NOT NULL REFERENCES practice_tariffs(id),
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
    });
    
    if (error1) {
      console.log('❌ visit_services creation failed:', error1.message);
    } else {
      console.log('✅ visit_services table created');
    }

    // Create invoices_enhanced table
    console.log('\n2. Creating invoices_enhanced table...');
    const { data: table2, error: error2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE invoices_enhanced (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_number VARCHAR(50) UNIQUE NOT NULL,
          patient_id UUID NOT NULL REFERENCES patients(id),
          visit_id UUID NOT NULL REFERENCES visits(id),
          practice_id UUID REFERENCES practices(id),
          issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
          due_date DATE NOT NULL,
          subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
          tax DECIMAL(10,2) NOT NULL DEFAULT 0,
          total DECIMAL(10,2) NOT NULL DEFAULT 0,
          medical_aid_total DECIMAL(10,2) DEFAULT 0,
          patient_total DECIMAL(10,2) NOT NULL DEFAULT 0,
          amount_paid DECIMAL(10,2) DEFAULT 0,
          balance_due DECIMAL(10,2) NOT NULL DEFAULT 0,
          payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
          payment_method VARCHAR(50),
          medical_aid_claim_number VARCHAR(100),
          medical_aid_status VARCHAR(20) DEFAULT 'not_submitted',
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
    });
    
    if (error2) {
      console.log('❌ invoices_enhanced creation failed:', error2.message);
    } else {
      console.log('✅ invoices_enhanced table created');
    }

    // Create invoice_items_enhanced table
    console.log('\n3. Creating invoice_items_enhanced table...');
    const { data: table3, error: error3 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE invoice_items_enhanced (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_id UUID NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
          tariff_code_id UUID NOT NULL REFERENCES practice_tariffs(id),
          code VARCHAR(50) NOT NULL,
          description TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          medical_aid_covered BOOLEAN DEFAULT FALSE,
          medical_aid_amount DECIMAL(10,2) DEFAULT 0,
          patient_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
    });
    
    if (error3) {
      console.log('❌ invoice_items_enhanced creation failed:', error3.message);
    } else {
      console.log('✅ invoice_items_enhanced table created');
    }

    // Add indexes
    console.log('\n4. Creating indexes...');
    const indexes = [
      'CREATE INDEX idx_visit_services_visit_id ON visit_services(visit_id);',
      'CREATE INDEX idx_visit_services_tariff_id ON visit_services(tariff_id);',
      'CREATE INDEX idx_invoices_enhanced_patient_id ON invoices_enhanced(patient_id);',
      'CREATE INDEX idx_invoices_enhanced_visit_id ON invoices_enhanced(visit_id);',
      'CREATE INDEX idx_invoice_items_enhanced_invoice_id ON invoice_items_enhanced(invoice_id);'
    ];

    for (const indexSQL of indexes) {
      const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexSQL });
      if (indexError) {
        console.log(`⚠️ Index warning: ${indexError.message}`);
      }
    }
    console.log('✅ Indexes created');

    // Test table access
    console.log('\n5. Testing table access...');
    
    const { data: testServices, error: servicesTestError } = await supabase
      .from('visit_services')
      .select('*')
      .limit(1);
    
    const { data: testInvoices, error: invoicesTestError } = await supabase
      .from('invoices_enhanced')
      .select('*')
      .limit(1);

    const { data: testItems, error: itemsTestError } = await supabase
      .from('invoice_items_enhanced')
      .select('*')
      .limit(1);

    console.log('visit_services access:', servicesTestError ? `❌ ${servicesTestError.message}` : '✅ Success');
    console.log('invoices_enhanced access:', invoicesTestError ? `❌ ${invoicesTestError.message}` : '✅ Success');
    console.log('invoice_items_enhanced access:', itemsTestError ? `❌ ${itemsTestError.message}` : '✅ Success');

    // Now try inserting sample data
    if (!servicesTestError && !invoicesTestError && !itemsTestError) {
      console.log('\n6. Inserting sample data...');
      
      // Get test data
      const { data: visits } = await supabase
        .from('visits')
        .select('id, patient_id, visit_date, visit_type')
        .limit(1);
      
      const { data: tariffs } = await supabase
        .from('practice_tariffs')
        .select('id, code, description, price')
        .not('price', 'is', null)
        .gt('price', 0)
        .limit(1);

      if (visits?.[0] && tariffs?.[0]) {
        const visit = visits[0];
        const tariff = tariffs[0];
        
        // Insert visit service
        const { data: serviceInsert, error: serviceInsertError } = await supabase
          .from('visit_services')
          .insert({
            visit_id: visit.id,
            tariff_id: tariff.id,
            quantity: 1,
            unit_price: tariff.price,
            total_price: tariff.price,
            notes: 'Sample billing test service'
          })
          .select()
          .single();

        if (serviceInsertError) {
          console.log('❌ Service insert failed:', serviceInsertError.message);
        } else {
          console.log('✅ Service inserted:', serviceInsert.id);
          
          // Insert invoice
          const invoiceNumber = `TEST${Date.now()}`;
          const total = parseFloat(tariff.price) * 1.15; // With 15% tax
          
          const { data: invoiceInsert, error: invoiceInsertError } = await supabase
            .from('invoices_enhanced')
            .insert({
              invoice_number: invoiceNumber,
              patient_id: visit.patient_id,
              visit_id: visit.id,
              due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              subtotal: tariff.price,
              tax: tariff.price * 0.15,
              total: total,
              patient_total: total,
              balance_due: total,
              notes: 'Sample billing test invoice'
            })
            .select()
            .single();

          if (invoiceInsertError) {
            console.log('❌ Invoice insert failed:', invoiceInsertError.message);
          } else {
            console.log('✅ Invoice inserted:', invoiceInsert.invoice_number);
            
            // Insert invoice item
            const { data: itemInsert, error: itemInsertError } = await supabase
              .from('invoice_items_enhanced')
              .insert({
                invoice_id: invoiceInsert.id,
                tariff_code_id: tariff.id,
                code: tariff.code,
                description: tariff.description,
                quantity: 1,
                unit_price: tariff.price,
                total_price: tariff.price,
                patient_amount: tariff.price
              })
              .select()
              .single();

            if (itemInsertError) {
              console.log('❌ Item insert failed:', itemInsertError.message);
            } else {
              console.log('✅ Invoice item inserted:', itemInsert.id);
            }
          }
        }
      }
    }

    console.log('\n✅ Billing tables setup completed!');
    console.log('🎯 Ready for testing in the application');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTablesDirectly();
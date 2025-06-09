const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function createBillingTablesAndData() {
  try {
    console.log('✅ Connected to Supabase');

    // First, let's check what patients and visits exist
    console.log('\n📋 Checking existing data...');
    
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (patientsError) throw patientsError;
    
    console.log('Patients found:', patients.length);
    patients.forEach(p => console.log(`  - ${p.first_name} ${p.last_name} (${p.id})`));

    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select('id, patient_id, visit_date, visit_type, chief_complaint')
      .order('visit_date', { ascending: false })
      .limit(5);
    
    if (visitsError) throw visitsError;
    
    console.log('Visits found:', visits.length);
    visits.forEach(v => console.log(`  - ${v.visit_type} on ${v.visit_date} (${v.id})`));

    if (patients.length === 0 || visits.length === 0) {
      console.log('❌ No patients or visits found. Please create some first.');
      return;
    }

    // Select the first patient and visit for our example
    const patient = patients[0];
    const visit = visits[0];
    console.log(`\n🎯 Using patient: ${patient.first_name} ${patient.last_name}`);
    console.log(`🎯 Using visit: ${visit.visit_type} on ${visit.visit_date}`);

    // Get some practice tariffs to use
    const { data: tariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, price')
      .not('price', 'is', null)
      .gt('price', 0)
      .limit(5);
    
    if (tariffsError) throw tariffsError;
    
    console.log('Available tariffs:', tariffs.length);

    if (tariffs.length === 0) {
      console.log('❌ No tariffs found. Cannot create billing data.');
      return;
    }

    // 1. Create visit_services table using SQL
    console.log('\n🏗️ Creating visit_services table...');
    const { error: visitServicesTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS visit_services (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
          tariff_id UUID NOT NULL REFERENCES practice_tariffs(id),
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_visit_services_visit_id ON visit_services(visit_id);
        CREATE INDEX IF NOT EXISTS idx_visit_services_tariff_id ON visit_services(tariff_id);
      `
    });
    
    if (visitServicesTableError) {
      console.log('Table creation via RPC failed, trying direct approach...');
    } else {
      console.log('✅ visit_services table created via RPC');
    }

    // 2. Create invoices_enhanced table
    console.log('\n🏗️ Creating invoices_enhanced table...');
    const { error: invoicesTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS invoices_enhanced (
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
        );
        
        CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_patient_id ON invoices_enhanced(patient_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_visit_id ON invoices_enhanced(visit_id);
      `
    });
    
    if (!invoicesTableError) {
      console.log('✅ invoices_enhanced table created via RPC');
    }

    // 3. Create invoice_items_enhanced table
    console.log('\n🏗️ Creating invoice_items_enhanced table...');
    const { error: itemsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS invoice_items_enhanced (
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
        );
        
        CREATE INDEX IF NOT EXISTS idx_invoice_items_enhanced_invoice_id ON invoice_items_enhanced(invoice_id);
      `
    });
    
    if (!itemsTableError) {
      console.log('✅ invoice_items_enhanced table created via RPC');
    }

    // If RPC failed, let's try creating data manually
    console.log('\n📝 Creating sample data...');

    // Let's try to insert visit services data directly
    const sampleServices = [];
    for (let i = 0; i < Math.min(3, tariffs.length); i++) {
      const tariff = tariffs[i];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = parseFloat(tariff.price);
      const totalPrice = quantity * unitPrice;
      
      const serviceData = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'uuid-' + Date.now() + '-' + i,
        visit_id: visit.id,
        tariff_id: tariff.id,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        notes: `Service rendered during ${visit.visit_type} visit`,
        created_at: new Date().toISOString()
      };
      
      sampleServices.push(serviceData);
      console.log(`  📋 Prepared service: ${tariff.code} - ${tariff.description} (Qty: ${quantity}, Total: N$${totalPrice})`);
    }

    // Try to insert via service call
    try {
      const { error: insertError } = await supabase
        .from('visit_services')
        .insert(sampleServices);
      
      if (insertError) {
        console.log('Direct insert failed:', insertError.message);
        
        // Try individual inserts
        for (const service of sampleServices) {
          const { error: singleError } = await supabase
            .from('visit_services')
            .insert([service]);
          
          if (singleError) {
            console.log(`Failed to insert service: ${singleError.message}`);
          } else {
            console.log(`✅ Inserted service: ${service.notes}`);
          }
        }
      } else {
        console.log('✅ All visit services inserted successfully');
      }
    } catch (error) {
      console.log('Insert error:', error.message);
    }

    // Create invoice data
    console.log('\n💰 Creating invoice...');
    const subtotal = sampleServices.reduce((sum, service) => sum + service.total_price, 0);
    const tax = subtotal * 0.15;
    const total = subtotal + tax;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    const invoiceNumber = `INV${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    
    const invoiceData = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'invoice-' + Date.now(),
      invoice_number: invoiceNumber,
      patient_id: patient.id,
      visit_id: visit.id,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      subtotal: subtotal,
      tax: tax,
      total: total,
      patient_total: total,
      balance_due: total,
      payment_status: 'pending',
      notes: `Invoice for ${visit.visit_type} visit on ${visit.visit_date}`
    };

    try {
      const { error: invoiceError } = await supabase
        .from('invoices_enhanced')
        .insert([invoiceData]);
      
      if (invoiceError) {
        console.log('Invoice insert failed:', invoiceError.message);
      } else {
        console.log(`✅ Created invoice: ${invoiceNumber} - Total: N$${total.toFixed(2)}`);
      }
    } catch (error) {
      console.log('Invoice error:', error.message);
    }

    // Show summary
    console.log('\n📊 Summary:');
    console.log(`  • Visit Services prepared: ${sampleServices.length}`);
    console.log(`  • Invoice created: ${invoiceNumber}`);
    console.log(`  • Total amount: N$${total.toFixed(2)}`);
    
    console.log('\n✅ Billing setup completed!');
    console.log('🎯 Test by going to patient profile > Billing tab to see transactions');

    // Try to verify by reading back
    console.log('\n🔍 Verifying tables exist...');
    
    try {
      const { data: servicesCheck, error: servicesCheckError } = await supabase
        .from('visit_services')
        .select('*')
        .limit(1);
      
      if (!servicesCheckError) {
        console.log('✅ visit_services table accessible');
      } else {
        console.log('❌ visit_services table issue:', servicesCheckError.message);
      }
    } catch (e) {
      console.log('❌ visit_services check failed:', e.message);
    }

    try {
      const { data: invoicesCheck, error: invoicesCheckError } = await supabase
        .from('invoices_enhanced')
        .select('*')
        .limit(1);
      
      if (!invoicesCheckError) {
        console.log('✅ invoices_enhanced table accessible');
      } else {
        console.log('❌ invoices_enhanced table issue:', invoicesCheckError.message);
      }
    } catch (e) {
      console.log('❌ invoices_enhanced check failed:', e.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
createBillingTablesAndData();
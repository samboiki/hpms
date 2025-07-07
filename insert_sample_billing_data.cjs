const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function insertSampleBillingData() {
  try {
    console.log('✅ Connected to Supabase');

    // Get sample patient
    const { data: patients } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(1);

    if (!patients || patients.length === 0) {
      console.log('❌ No patients found');
      return;
    }

    const patient = patients[0];
    console.log(`📋 Using patient: ${patient.first_name} ${patient.last_name}`);

    // Get sample visit
    const { data: visits } = await supabase
      .from('visits')
      .select('id, visit_date, visit_type')
      .eq('patient_id', patient.id)
      .limit(1);

    if (!visits || visits.length === 0) {
      console.log('❌ No visits found for patient');
      return;
    }

    const visit = visits[0];
    console.log(`📅 Using visit: ${visit.visit_type} on ${visit.visit_date}`);

    // Get sample tariffs
    const { data: tariffs } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, price')
      .not('price', 'is', null)
      .gt('price', 0)
      .limit(3);

    if (!tariffs || tariffs.length === 0) {
      console.log('❌ No tariffs found');
      return;
    }

    console.log(`💰 Found ${tariffs.length} tariffs to use`);

    // 1. Insert visit services
    console.log('\n📝 Creating visit services...');
    const visitServices = [];
    
    for (let i = 0; i < tariffs.length; i++) {
      const tariff = tariffs[i];
      const quantity = Math.floor(Math.random() * 2) + 1; // 1-2 quantity
      const totalPrice = tariff.price * quantity;
      
      const serviceData = {
        visit_id: visit.id,
        tariff_id: tariff.id,
        quantity: quantity,
        unit_price: tariff.price,
        total_price: totalPrice,
        notes: `Service rendered during ${visit.visit_type} visit`
      };
      
      const { data: insertedService, error } = await supabase
        .from('visit_services')
        .insert([serviceData])
        .select()
        .single();
      
      if (error) {
        console.log(`  ❌ Failed to insert service ${tariff.code}: ${error.message}`);
      } else {
        visitServices.push(insertedService);
        console.log(`  ✅ Added service: ${tariff.code} - N$${totalPrice} (Qty: ${quantity})`);
      }
    }

    if (visitServices.length === 0) {
      console.log('❌ No services were inserted');
      return;
    }

    // 2. Create invoice
    console.log('\n💰 Creating invoice...');
    const subtotal = visitServices.reduce((sum, service) => sum + parseFloat(service.total_price), 0);
    const tax = subtotal * 0.15; // 15% VAT
    const total = subtotal + tax;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from now
    
    const invoiceNumber = `INV${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    
    const invoiceData = {
      invoice_number: invoiceNumber,
      patient_id: patient.id,
      visit_id: visit.id,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      subtotal: subtotal,
      tax: tax,
      total: total,
      patient_total: total, // Patient pays full amount (no medical aid)
      balance_due: total, // Full balance due
      payment_status: 'pending',
      notes: `Invoice for ${visit.visit_type} visit on ${visit.visit_date}`
    };
    
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices_enhanced')
      .insert([invoiceData])
      .select()
      .single();
    
    if (invoiceError) {
      console.log(`❌ Failed to create invoice: ${invoiceError.message}`);
      return;
    }
    
    console.log(`✅ Created invoice: ${invoice.invoice_number} - Total: N$${total.toFixed(2)}`);

    // 3. Create invoice items
    console.log('\n📄 Creating invoice items...');
    for (const service of visitServices) {
      const tariff = tariffs.find(t => t.id === service.tariff_id);
      
      const itemData = {
        invoice_id: invoice.id,
        tariff_code_id: service.tariff_id,
        code: tariff.code,
        description: tariff.description,
        quantity: service.quantity,
        unit_price: service.unit_price,
        total_price: service.total_price,
        patient_amount: service.total_price // Patient pays full amount
      };
      
      const { error: itemError } = await supabase
        .from('invoice_items_enhanced')
        .insert([itemData]);
      
      if (itemError) {
        console.log(`  ❌ Failed to create item for ${tariff.code}: ${itemError.message}`);
      } else {
        console.log(`  ✅ Added invoice item: ${tariff.code} - N$${service.total_price}`);
      }
    }

    // 4. Create a second example with payment
    console.log('\n💳 Creating second example with payment...');
    
    // Get another visit for this patient or another patient
    const { data: otherVisits } = await supabase
      .from('visits')
      .select('id, visit_date, visit_type, patient_id')
      .neq('id', visit.id)
      .limit(1);
      
    if (otherVisits && otherVisits.length > 0) {
      const secondVisit = otherVisits[0];
      const secondTariff = tariffs[0]; // Use first tariff
      
      // Add service to second visit
      const { data: secondService, error: serviceError } = await supabase
        .from('visit_services')
        .insert([{
          visit_id: secondVisit.id,
          tariff_id: secondTariff.id,
          quantity: 1,
          unit_price: secondTariff.price,
          total_price: secondTariff.price,
          notes: 'Single service billing example'
        }])
        .select()
        .single();
      
      if (!serviceError) {
        // Create paid invoice
        const secondSubtotal = parseFloat(secondTariff.price);
        const secondTax = secondSubtotal * 0.15;
        const secondTotal = secondSubtotal + secondTax;
        const secondInvoiceNumber = `INV${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
        
        const { data: secondInvoice, error: secondInvoiceError } = await supabase
          .from('invoices_enhanced')
          .insert([{
            invoice_number: secondInvoiceNumber,
            patient_id: secondVisit.patient_id,
            visit_id: secondVisit.id,
            issue_date: new Date().toISOString().split('T')[0],
            due_date: dueDate.toISOString().split('T')[0],
            subtotal: secondSubtotal,
            tax: secondTax,
            total: secondTotal,
            patient_total: secondTotal,
            amount_paid: secondTotal, // Fully paid
            balance_due: 0, // No balance
            payment_status: 'paid',
            payment_method: 'cash',
            notes: 'Paid invoice example'
          }])
          .select()
          .single();
        
        if (!secondInvoiceError) {
          // Add invoice item
          await supabase
            .from('invoice_items_enhanced')
            .insert([{
              invoice_id: secondInvoice.id,
              tariff_code_id: secondTariff.id,
              code: secondTariff.code,
              description: secondTariff.description,
              quantity: 1,
              unit_price: secondTariff.price,
              total_price: secondTariff.price,
              patient_amount: secondTariff.price
            }]);
          
          console.log(`✅ Created paid invoice: ${secondInvoice.invoice_number} - N$${secondTotal.toFixed(2)} (PAID)`);
        }
      }
    }

    // 5. Final verification
    console.log('\n🔍 Final verification...');
    
    const { data: allServices, error: servicesError } = await supabase
      .from('visit_services')
      .select(`
        *,
        visits!inner(
          visit_date,
          visit_type,
          patients!inner(
            first_name,
            last_name
          )
        ),
        practice_tariffs!inner(
          code,
          description
        )
      `);
    
    const { data: allInvoices, error: invoicesError } = await supabase
      .from('invoices_enhanced')
      .select('*');
    
    const { data: allItems, error: itemsError } = await supabase
      .from('invoice_items_enhanced')
      .select('*');

    console.log(`\n📊 Summary:`);
    console.log(`  • Visit Services: ${allServices?.length || 0}`);
    console.log(`  • Invoices: ${allInvoices?.length || 0}`);
    console.log(`  • Invoice Items: ${allItems?.length || 0}`);
    
    if (allInvoices && allInvoices.length > 0) {
      const totalBilled = allInvoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
      const totalPaid = allInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0);
      const totalDue = allInvoices.reduce((sum, inv) => sum + parseFloat(inv.balance_due), 0);
      
      console.log(`\n💰 Financial Summary:`);
      console.log(`  • Total Billed: N$${totalBilled.toFixed(2)}`);
      console.log(`  • Total Paid: N$${totalPaid.toFixed(2)}`);
      console.log(`  • Balance Due: N$${totalDue.toFixed(2)}`);
    }

    console.log('\n✅ Sample billing data created successfully!');
    console.log('🎯 Test by going to patient profile > Billing tab to see transactions');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

insertSampleBillingData();
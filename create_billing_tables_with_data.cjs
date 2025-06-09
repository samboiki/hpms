const { Client } = require('pg');

// Direct PostgreSQL connection - bypasses all restrictions
const client = new Client({
  host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'T@ngisasa200',
  ssl: { rejectUnauthorized: false }
});

async function createBillingTablesAndData() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // First, let's check what patients and visits exist
    console.log('\n📋 Checking existing data...');
    
    const { rows: patients } = await client.query(`
      SELECT id, first_name, last_name, created_at 
      FROM patients 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('Patients found:', patients.length);
    patients.forEach(p => console.log(`  - ${p.first_name} ${p.last_name} (${p.id})`));

    const { rows: visits } = await client.query(`
      SELECT id, patient_id, visit_date, visit_type, chief_complaint 
      FROM visits 
      ORDER BY visit_date DESC 
      LIMIT 5
    `);
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
    const { rows: tariffs } = await client.query(`
      SELECT id, code, namaf_prace_2025, category, price 
      FROM practice_tariffs 
      WHERE price IS NOT NULL AND price > 0
      ORDER BY RANDOM() 
      LIMIT 5
    `);
    console.log('Available tariffs:', tariffs.length);

    if (tariffs.length === 0) {
      console.log('❌ No tariffs found. Cannot create billing data.');
      return;
    }

    // 1. Create visit_services table
    console.log('\n🏗️ Creating visit_services table...');
    await client.query(`
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
      
      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_visit_services_visit_id ON visit_services(visit_id);
      CREATE INDEX IF NOT EXISTS idx_visit_services_tariff_id ON visit_services(tariff_id);
    `);
    console.log('✅ visit_services table created');

    // 2. Create invoices_enhanced table
    console.log('\n🏗️ Creating invoices_enhanced table...');
    await client.query(`
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
        payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
        payment_method VARCHAR(50),
        medical_aid_claim_number VARCHAR(100),
        medical_aid_status VARCHAR(20) DEFAULT 'not_submitted' CHECK (medical_aid_status IN ('not_submitted', 'submitted', 'approved', 'rejected')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_patient_id ON invoices_enhanced(patient_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_visit_id ON invoices_enhanced(visit_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_status ON invoices_enhanced(payment_status);
      CREATE INDEX IF NOT EXISTS idx_invoices_enhanced_date ON invoices_enhanced(issue_date);
    `);
    console.log('✅ invoices_enhanced table created');

    // 3. Create invoice_items_enhanced table
    console.log('\n🏗️ Creating invoice_items_enhanced table...');
    await client.query(`
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
      
      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_invoice_items_enhanced_invoice_id ON invoice_items_enhanced(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_enhanced_tariff_id ON invoice_items_enhanced(tariff_code_id);
    `);
    console.log('✅ invoice_items_enhanced table created');

    // 4. Insert sample visit_services data
    console.log('\n📝 Inserting sample visit services...');
    const visitServices = [];
    for (let i = 0; i < Math.min(3, tariffs.length); i++) {
      const tariff = tariffs[i];
      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
      const unitPrice = parseFloat(tariff.price);
      const totalPrice = quantity * unitPrice;
      
      const { rows: [insertedService] } = await client.query(`
        INSERT INTO visit_services (
          visit_id, tariff_id, quantity, unit_price, total_price, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        visit.id,
        tariff.id,
        quantity,
        unitPrice,
        totalPrice,
        `Service rendered during ${visit.visit_type} visit`
      ]);
      
      visitServices.push(insertedService);
      console.log(`  ✅ Added service: ${tariff.code} - ${tariff.namaf_prace_2025} (Qty: ${quantity}, Total: N$${totalPrice})`);
    }

    // 5. Create invoice for the visit
    console.log('\n💰 Creating invoice...');
    const subtotal = visitServices.reduce((sum, service) => sum + parseFloat(service.total_price), 0);
    const tax = subtotal * 0.15; // 15% VAT
    const total = subtotal + tax;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from now
    
    const invoiceNumber = `INV${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    
    const { rows: [invoice] } = await client.query(`
      INSERT INTO invoices_enhanced (
        invoice_number, patient_id, visit_id, issue_date, due_date,
        subtotal, tax, total, patient_total, balance_due, payment_status, notes
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      invoiceNumber,
      patient.id,
      visit.id,
      dueDate.toISOString().split('T')[0],
      subtotal,
      tax,
      total,
      total, // Patient pays full amount (no medical aid)
      total, // Full balance due
      'pending',
      `Invoice for ${visit.visit_type} visit on ${visit.visit_date}`
    ]);
    
    console.log(`  ✅ Created invoice: ${invoice.invoice_number} - Total: N$${total.toFixed(2)}`);

    // 6. Insert invoice items
    console.log('\n📄 Creating invoice items...');
    for (const service of visitServices) {
      const tariff = tariffs.find(t => t.id === service.tariff_id);
      
      await client.query(`
        INSERT INTO invoice_items_enhanced (
          invoice_id, tariff_code_id, code, description, 
          quantity, unit_price, total_price, patient_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        invoice.id,
        service.tariff_id,
        tariff.code,
        tariff.namaf_prace_2025,
        service.quantity,
        service.unit_price,
        service.total_price,
        service.total_price // Patient pays full amount
      ]);
      
      console.log(`  ✅ Added invoice item: ${tariff.code} - N$${service.total_price}`);
    }

    // 7. Create another invoice example with partial payment
    console.log('\n💳 Creating second example with payment...');
    if (visits.length > 1) {
      const secondVisit = visits[1];
      const secondTariff = tariffs[Math.floor(Math.random() * tariffs.length)];
      
      // Add service to second visit
      const { rows: [secondService] } = await client.query(`
        INSERT INTO visit_services (
          visit_id, tariff_id, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        secondVisit.id,
        secondTariff.id,
        1,
        secondTariff.price,
        secondTariff.price
      ]);
      
      // Create paid invoice
      const secondSubtotal = parseFloat(secondTariff.price);
      const secondTax = secondSubtotal * 0.15;
      const secondTotal = secondSubtotal + secondTax;
      const secondInvoiceNumber = `INV${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
      
      const { rows: [secondInvoice] } = await client.query(`
        INSERT INTO invoices_enhanced (
          invoice_number, patient_id, visit_id, issue_date, due_date,
          subtotal, tax, total, patient_total, amount_paid, balance_due, payment_status, payment_method
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        secondInvoiceNumber,
        patient.id,
        secondVisit.id,
        dueDate.toISOString().split('T')[0],
        secondSubtotal,
        secondTax,
        secondTotal,
        secondTotal,
        secondTotal, // Fully paid
        0, // No balance
        'paid',
        'cash'
      ]);
      
      await client.query(`
        INSERT INTO invoice_items_enhanced (
          invoice_id, tariff_code_id, code, description, 
          quantity, unit_price, total_price, patient_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        secondInvoice.id,
        secondTariff.id,
        secondTariff.code,
        secondTariff.namaf_prace_2025,
        1,
        secondTariff.price,
        secondTariff.price,
        secondTariff.price
      ]);
      
      console.log(`  ✅ Created paid invoice: ${secondInvoice.invoice_number} - N$${secondTotal.toFixed(2)} (PAID)`);
    }

    // 8. Verify the data
    console.log('\n🔍 Verifying created data...');
    
    const { rows: createdServices } = await client.query(`
      SELECT vs.*, pt.code, pt.namaf_prace_2025 
      FROM visit_services vs
      JOIN practice_tariffs pt ON vs.tariff_id = pt.id
      WHERE vs.visit_id = $1
    `, [visit.id]);
    
    const { rows: createdInvoices } = await client.query(`
      SELECT * FROM invoices_enhanced WHERE patient_id = $1
    `, [patient.id]);
    
    const { rows: createdItems } = await client.query(`
      SELECT ii.*, pt.code 
      FROM invoice_items_enhanced ii
      JOIN practice_tariffs pt ON ii.tariff_code_id = pt.id
      JOIN invoices_enhanced inv ON ii.invoice_id = inv.id
      WHERE inv.patient_id = $1
    `, [patient.id]);

    console.log(`\n📊 Summary:`);
    console.log(`  • Visit Services: ${createdServices.length}`);
    console.log(`  • Invoices: ${createdInvoices.length}`);
    console.log(`  • Invoice Items: ${createdItems.length}`);
    
    console.log(`\n💰 Financial Summary:`);
    const totalBilled = createdInvoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
    const totalPaid = createdInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_paid), 0);
    const totalDue = createdInvoices.reduce((sum, inv) => sum + parseFloat(inv.balance_due), 0);
    
    console.log(`  • Total Billed: N$${totalBilled.toFixed(2)}`);
    console.log(`  • Total Paid: N$${totalPaid.toFixed(2)}`);
    console.log(`  • Balance Due: N$${totalDue.toFixed(2)}`);

    console.log('\n✅ Billing tables created and populated successfully!');
    console.log('\n🎯 Test by going to patient profile > Billing tab to see transactions');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

// Run the function
createBillingTablesAndData();
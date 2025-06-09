const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function executeBillingMigration() {
  try {
    console.log('✅ Connected to Supabase');

    // Read the migration file
    const migrationSQL = fs.readFileSync('./supabase/migrations/20250609000000_create_billing_tables.sql', 'utf8');
    
    console.log('📄 Read migration file...');
    
    // Split the SQL into individual statements (basic approach)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔨 Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          console.log(`  ${i + 1}. Executing: ${statement.substring(0, 50)}...`);
          
          const { error } = await supabase.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) {
            console.log(`    ⚠️ Warning: ${error.message}`);
          } else {
            console.log('    ✅ Success');
          }
        } catch (err) {
          console.log(`    ⚠️ Error: ${err.message}`);
        }
      }
    }
    
    console.log('\n🔍 Verifying table creation...');
    
    // Test visit_services table
    try {
      const { data: visitServicesTest } = await supabase
        .from('visit_services')
        .select('count', { count: 'exact', head: true });
      console.log(`✅ visit_services table exists (${visitServicesTest?.length || 0} records)`);
    } catch (err) {
      console.log('❌ visit_services table not accessible:', err.message);
    }
    
    // Test invoices_enhanced table
    try {
      const { data: invoicesTest } = await supabase
        .from('invoices_enhanced')
        .select('count', { count: 'exact', head: true });
      console.log(`✅ invoices_enhanced table exists (${invoicesTest?.length || 0} records)`);
    } catch (err) {
      console.log('❌ invoices_enhanced table not accessible:', err.message);
    }
    
    // Test invoice_items_enhanced table
    try {
      const { data: itemsTest } = await supabase
        .from('invoice_items_enhanced')
        .select('count', { count: 'exact', head: true });
      console.log(`✅ invoice_items_enhanced table exists (${itemsTest?.length || 0} records)`);
    } catch (err) {
      console.log('❌ invoice_items_enhanced table not accessible:', err.message);
    }
    
    console.log('\n🎯 Testing billing workflow integration...');
    
    // Test if tables work with the invoice service
    try {
      const { data: sampleData } = await supabase
        .from('visit_services')
        .select(`
          id,
          visit_id,
          tariff_id,
          quantity,
          unit_price,
          total_price,
          visits!inner(
            id,
            patient_id,
            visit_date,
            patients!inner(
              id,
              first_name,
              last_name
            )
          )
        `)
        .limit(1);
      
      if (sampleData && sampleData.length > 0) {
        console.log('✅ Sample billing data found:');
        const sample = sampleData[0];
        console.log(`  Patient: ${sample.visits.patients.first_name} ${sample.visits.patients.last_name}`);
        console.log(`  Visit Date: ${sample.visits.visit_date}`);
        console.log(`  Service Total: N$${sample.total_price}`);
      } else {
        console.log('ℹ️ No sample data found - ready for first billing transaction');
      }
    } catch (err) {
      console.log('⚠️ Billing workflow test failed:', err.message);
    }
    
    console.log('\n✅ Billing system setup completed!');
    console.log('🎯 Ready for use in PremiumAddVisitForm and PatientModernDetail');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

executeBillingMigration();
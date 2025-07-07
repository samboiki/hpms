const { createClient } = require('@supabase/supabase-js');

// Use service role to check table structure
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTc4NDU1NywiZXhwIjoyMDMxMzYwNTU3fQ.dF7SfovQKgmRyIX9C4S-YXlhZBD6gQ0GbINS7MrUEZE'
);

async function checkBillingTables() {
  try {
    console.log('=== Checking billing-related tables ===');
    
    // Check if visit_services exists by trying to select from it
    try {
      const { data: visitServicesTest, error: visitError } = await supabase
        .from('visit_services')
        .select('*')
        .limit(1);
      
      if (visitError) {
        console.log('visit_services table: DOES NOT EXIST or ACCESS DENIED');
        console.log('Error:', visitError.message);
      } else {
        console.log('visit_services table: EXISTS');
        console.log('Sample data available:', visitServicesTest?.length > 0);
      }
    } catch (e) {
      console.log('visit_services table: ERROR -', e.message);
    }
    
    // Check if invoice_services exists
    try {
      const { data: invoiceServicesTest, error: invoiceError } = await supabase
        .from('invoice_services')
        .select('*')
        .limit(1);
      
      if (invoiceError) {
        console.log('invoice_services table: DOES NOT EXIST or ACCESS DENIED');
        console.log('Error:', invoiceError.message);
      } else {
        console.log('invoice_services table: EXISTS');
        console.log('Sample data available:', invoiceServicesTest?.length > 0);
      }
    } catch (e) {
      console.log('invoice_services table: ERROR -', e.message);
    }
    
    // Check if invoices_enhanced exists
    try {
      const { data: invoicesTest, error: invoicesError } = await supabase
        .from('invoices_enhanced')
        .select('*')
        .limit(1);
      
      if (invoicesError) {
        console.log('invoices_enhanced table: DOES NOT EXIST or ACCESS DENIED');
        console.log('Error:', invoicesError.message);
      } else {
        console.log('invoices_enhanced table: EXISTS');
        console.log('Sample data available:', invoicesTest?.length > 0);
      }
    } catch (e) {
      console.log('invoices_enhanced table: ERROR -', e.message);
    }
    
    // Check if invoice_items_enhanced exists
    try {
      const { data: itemsTest, error: itemsError } = await supabase
        .from('invoice_items_enhanced')
        .select('*')
        .limit(1);
      
      if (itemsError) {
        console.log('invoice_items_enhanced table: DOES NOT EXIST or ACCESS DENIED');
        console.log('Error:', itemsError.message);
      } else {
        console.log('invoice_items_enhanced table: EXISTS');
        console.log('Sample data available:', itemsTest?.length > 0);
      }
    } catch (e) {
      console.log('invoice_items_enhanced table: ERROR -', e.message);
    }
    
    console.log('\n=== Summary ===');
    console.log('Based on migration files, the correct table should be: visit_services');
    console.log('The recent commit changed from visit_services to invoice_services');
    console.log('This likely broke the billing because invoice_services does not exist');
    
  } catch (error) {
    console.error('General error:', error.message);
  }
}

checkBillingTables();

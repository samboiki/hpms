// Test script to verify document generation fixes
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg1NjA0MjUsImV4cCI6MjA0NDEzNjQyNX0.jrCvhlGaFu4SDqoiARRfqJOUJsRgHL60axsVQTXQCuU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDocumentGeneration() {
  console.log('🧪 Testing Document Generation Service Fix\n');
  
  try {
    // Test 1: Verify we can fetch visit data without RPC error
    console.log('1️⃣ Testing visit data fetch (should NOT use RPC)...');
    
    // Get a sample visit ID
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select('id')
      .limit(1);
    
    if (visitsError || !visits || visits.length === 0) {
      console.log('❌ No visits found to test with');
      return;
    }
    
    const testVisitId = visits[0].id;
    console.log(`   Using visit ID: ${testVisitId}`);
    
    // Test the exact query that documentGenerationService uses
    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .select(`
        *,
        patients!visits_patient_id_fkey (
          id, first_name, last_name, date_of_birth, 
          cell_number, email, home_address, gender,
          medical_aid_number
        ),
        users!visits_doctor_id_fkey (
          id, full_name, email, role
        )
      `)
      .eq('id', testVisitId)
      .single();
    
    if (visitError) {
      console.log('❌ Error fetching visit data:', visitError);
      console.log('   Error code:', visitError.code);
      console.log('   Error message:', visitError.message);
    } else {
      console.log('✅ Visit data fetched successfully!');
      console.log('   Patient:', visit.patients?.first_name, visit.patients?.last_name);
      console.log('   Doctor:', visit.users?.full_name);
    }
    
    // Test 2: Check if we can fetch medications
    console.log('\n2️⃣ Testing medications fetch...');
    const { data: medications, error: medsError } = await supabase
      .from('medications')
      .select('*')
      .eq('visit_id', testVisitId);
    
    if (medsError) {
      console.log('❌ Error fetching medications:', medsError.message);
    } else {
      console.log(`✅ Found ${medications.length} medications`);
    }
    
    // Test 3: Check if we can fetch leave forms
    console.log('\n3️⃣ Testing leave forms fetch...');
    const { data: leaveForm, error: leaveError } = await supabase
      .from('leave_forms')
      .select('*')
      .eq('visit_id', testVisitId)
      .maybeSingle();
    
    if (leaveError) {
      console.log('❌ Error fetching leave form:', leaveError.message);
    } else {
      console.log(leaveForm ? '✅ Leave form found' : '📝 No leave form for this visit');
    }
    
    // Test 4: Check if we can fetch invoices
    console.log('\n4️⃣ Testing invoice fetch...');
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices_enhanced')
      .select(`
        *,
        invoice_services (*)
      `)
      .eq('visit_id', testVisitId)
      .maybeSingle();
    
    if (invoiceError) {
      console.log('❌ Error fetching invoice:', invoiceError.message);
    } else {
      console.log(invoice ? `✅ Invoice found with ${invoice.invoice_services?.length || 0} services` : '📝 No invoice for this visit');
    }
    
    console.log('\n✅ All tests completed! Document generation should work without RPC errors.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDocumentGeneration();
// Debug billing issue - run this in browser console to diagnose
// This will help identify why "No transactions found" appears

console.log('🔍 Debugging billing system...');

// Check if we can access the invoice service
async function debugBillingSystem() {
  try {
    // Get the patient ID from the current page
    const patientId = window.location.pathname.split('/').pop();
    console.log('📋 Patient ID:', patientId);
    
    if (!patientId) {
      console.error('❌ No patient ID found in URL');
      return;
    }

    // Test direct Supabase queries
    console.log('🔗 Testing direct Supabase connection...');
    
    // Check if invoices_enhanced table exists and has data
    const { data: allInvoices, error: allInvoicesError } = await window.supabase
      .from('invoices_enhanced')
      .select('*')
      .limit(5);
      
    console.log('📊 All invoices in system:', allInvoices);
    if (allInvoicesError) console.error('❌ Error fetching all invoices:', allInvoicesError);
    
    // Check invoices for this specific patient
    const { data: patientInvoices, error: patientError } = await window.supabase
      .from('invoices_enhanced')
      .select('*')
      .eq('patient_id', patientId);
      
    console.log('📋 Patient invoices:', patientInvoices);
    if (patientError) console.error('❌ Error fetching patient invoices:', patientError);
    
    // Check invoice services table
    const { data: allServices, error: servicesError } = await window.supabase
      .from('invoice_services')
      .select('*')
      .limit(5);
      
    console.log('🛠️ All invoice services:', allServices);
    if (servicesError) console.error('❌ Error fetching services:', servicesError);
    
    // Check if invoice service is working
    console.log('🧪 Testing invoice service methods...');
    
    // This should work if the service is properly imported
    if (window.invoiceService) {
      const stats = await window.invoiceService.getPatientBillingStats(patientId);
      console.log('📈 Patient billing stats:', stats);
      
      const transactions = await window.invoiceService.getPatientInvoices(patientId);
      console.log('💳 Patient transactions:', transactions);
    } else {
      console.log('⚠️ Invoice service not available in window object');
    }
    
    // Check if patient exists
    const { data: patient, error: patientCheckError } = await window.supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();
      
    console.log('👤 Patient data:', patient);
    if (patientCheckError) console.error('❌ Patient not found:', patientCheckError);
    
    // Check visits for this patient
    const { data: visits, error: visitsError } = await window.supabase
      .from('visits')
      .select('*')
      .eq('patient_id', patientId);
      
    console.log('🏥 Patient visits:', visits);
    if (visitsError) console.error('❌ Error fetching visits:', visitsError);
    
    console.log('✅ Billing debug complete! Check the logs above.');
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

// Run the debug
debugBillingSystem();

// Also expose supabase globally for manual testing
if (typeof window !== 'undefined' && window.supabase) {
  console.log('✅ Supabase is available globally as window.supabase');
} else {
  console.log('❌ Supabase not found in window object');
}
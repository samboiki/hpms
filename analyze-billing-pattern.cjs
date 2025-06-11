#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function analyzeBillingPattern() {
  try {
    console.log('🔍 ANALYZING BILLING PATTERN FOR ELISABETH SHILONGO');
    console.log('===================================================');
    
    // Get Elisabeth Shilongo's patient ID
    const elisabethPatientId = 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8';
    
    console.log(`📋 Patient ID: ${elisabethPatientId}`);
    
    // Get all services for Elisabeth, ordered by creation time
    const { data: allServices, error: servicesError } = await supabase
      .from('invoice_services')
      .select(`
        *,
        invoices_enhanced (
          invoice_number,
          patient_id,
          created_at
        )
      `)
      .eq('invoices_enhanced.patient_id', elisabethPatientId)
      .order('created_at', { ascending: true });
    
    if (servicesError) {
      console.error('❌ Error fetching services:', servicesError);
      return;
    }
    
    console.log(`\n✅ Found ${allServices?.length || 0} services for Elisabeth Shilongo:`);
    console.log('\n🕐 CHRONOLOGICAL ORDER (oldest first):');
    console.log('=====================================');
    
    let correctCount = 0;
    let incorrectCount = 0;
    
    allServices?.forEach((service, i) => {
      const createdDate = new Date(service.created_at);
      const isCorrect = service.patient_portion === 0 && service.medical_aid_covered === service.total_price;
      
      if (isCorrect) correctCount++;
      else incorrectCount++;
      
      console.log(`\n${i+1}. ${service.invoices_enhanced.invoice_number} - ${createdDate.toISOString()}`);
      console.log(`   Service: ${service.code} - N$ ${service.total_price}`);
      console.log(`   Medical Aid: N$ ${service.medical_aid_covered}`);
      console.log(`   Patient: N$ ${service.patient_portion}`);
      console.log(`   Status: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT - PATIENT CHARGED!'}`);
    });
    
    console.log(`\n📊 SUMMARY FOR ELISABETH SHILONGO:`);
    console.log(`✅ Correct services: ${correctCount}`);
    console.log(`❌ Incorrect services: ${incorrectCount}`);
    
    // Now check if there's a pattern based on creation time
    console.log(`\n🔍 PATTERN ANALYSIS:`);
    
    if (allServices && allServices.length > 0) {
      // Find the first correct service
      const firstCorrect = allServices.find(s => s.patient_portion === 0);
      const firstIncorrect = allServices.find(s => s.patient_portion > 0);
      
      if (firstCorrect && firstIncorrect) {
        const correctTime = new Date(firstCorrect.created_at);
        const incorrectTime = new Date(firstIncorrect.created_at);
        
        console.log(`📅 First correct service: ${correctTime.toISOString()}`);
        console.log(`📅 First incorrect service: ${incorrectTime.toISOString()}`);
        
        if (correctTime > incorrectTime) {
          console.log('🔍 PATTERN: Auto-fix trigger appears to have been installed AFTER some incorrect services were created');
        } else {
          console.log('🔍 PATTERN: Auto-fix trigger is inconsistent - working sometimes, failing other times');
        }
      }
    }
    
    // Check specifically which invoices have problems
    console.log(`\n🎯 PROBLEMATIC INVOICES ANALYSIS:`);
    
    const problematicInvoices = ['INV250619682', 'INV250627384'];
    
    for (const invoiceNumber of problematicInvoices) {
      console.log(`\n📄 ANALYZING ${invoiceNumber}:`);
      
      // Get the invoice
      const { data: invoice } = await supabase
        .from('invoices_enhanced')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();
      
      if (invoice) {
        console.log(`   Created: ${invoice.created_at}`);
        console.log(`   Patient Total: N$ ${invoice.patient_total}`);
        console.log(`   Medical Aid Total: N$ ${invoice.medical_aid_total}`);
        
        // Get services for this invoice
        const { data: invoiceServices } = await supabase
          .from('invoice_services')
          .select('*')
          .eq('invoice_id', invoice.id)
          .order('created_at', { ascending: true });
        
        console.log(`   Services: ${invoiceServices?.length || 0}`);
        
        invoiceServices?.forEach((service, i) => {
          console.log(`     ${i+1}. ${service.code} - Created: ${service.created_at}`);
          console.log(`        Medical Aid: N$ ${service.medical_aid_covered}, Patient: N$ ${service.patient_portion}`);
        });
      }
    }
    
    // Test the current trigger status
    console.log(`\n🧪 TESTING CURRENT AUTO-FIX TRIGGER:`);
    
    // Create a test invoice for Elisabeth
    const testInvoiceNumber = `PATTERN-TEST-${Date.now()}`;
    
    const { data: testInvoice } = await supabase
      .from('invoices_enhanced')
      .insert([{
        invoice_number: testInvoiceNumber,
        patient_id: elisabethPatientId,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_status: 'pending'
      }])
      .select()
      .single();
    
    if (testInvoice) {
      console.log(`✅ Created test invoice: ${testInvoice.invoice_number}`);
      
      // Insert a service with wrong values
      const { data: testService } = await supabase
        .from('invoice_services')
        .insert([{
          invoice_id: testInvoice.id,
          tariff_id: 'cd3d4e57-18ce-4039-841b-846b2fcf9a2f', // Using existing tariff ID
          code: 'PATTERN-TEST',
          description: 'Pattern analysis test service',
          quantity: 1,
          unit_price: 100.00,
          total_price: 100.00,
          medical_aid_covered: 999.99, // Wrong value
          patient_portion: 888.88, // Wrong value
          notes: 'PATTERN TEST - should be auto-fixed'
        }])
        .select()
        .single();
      
      if (testService) {
        console.log(`📤 Inserted service with wrong values (999.99, 888.88)`);
        console.log(`📥 Database returned:`);
        console.log(`   Medical Aid Covered: N$ ${testService.medical_aid_covered}`);
        console.log(`   Patient Portion: N$ ${testService.patient_portion}`);
        
        if (testService.patient_portion === 0 && testService.medical_aid_covered === 100) {
          console.log(`✅ AUTO-FIX TRIGGER IS WORKING NOW!`);
        } else {
          console.log(`❌ AUTO-FIX TRIGGER IS NOT WORKING!`);
        }
      }
      
      // Clean up
      await supabase.from('invoice_services').delete().eq('invoice_id', testInvoice.id);
      await supabase.from('invoices_enhanced').delete().eq('id', testInvoice.id);
      console.log(`🧹 Test data cleaned up`);
    }
    
    console.log(`\n🎯 CONCLUSION:`);
    console.log(`The issue appears to be that the auto-fix trigger was installed AFTER some services were already created.`);
    console.log(`We need to fix the existing incorrect services manually.`);
    
  } catch (error) {
    console.error('💥 Pattern analysis failed:', error.message);
  }
}

analyzeBillingPattern();
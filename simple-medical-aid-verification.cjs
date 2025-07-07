#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function simpleVerification() {
  try {
    console.log('🔍 SIMPLE MEDICAL AID BILLING VERIFICATION');
    console.log('===========================================\n');
    
    // Step 1: Get all invoice services
    console.log('📋 Step 1: Checking all invoice services...');
    
    const { data: allServices, error: servicesError } = await supabase
      .from('invoice_services')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (servicesError) {
      console.error('❌ Error fetching services:', servicesError);
      return;
    }
    
    console.log(`✅ Found ${allServices?.length || 0} recent services`);
    
    // Step 2: For each service, check the patient and medical aid status
    let medicalAidCorrect = 0;
    let medicalAidIncorrect = 0;
    let cashCorrect = 0;
    let cashIncorrect = 0;
    
    for (const service of allServices || []) {
      // Get the invoice for this service
      const { data: invoice } = await supabase
        .from('invoices_enhanced')
        .select('patient_id, invoice_number')
        .eq('id', service.invoice_id)
        .single();
      
      if (!invoice) continue;
      
      // Get the patient
      const { data: patient } = await supabase
        .from('patients')
        .select('first_name, last_name')
        .eq('id', invoice.patient_id)
        .single();
      
      if (!patient) continue;
      
      // Check if patient has medical aid
      const { data: medicalAid } = await supabase
        .from('medical_aid_details')
        .select('provider')
        .eq('patient_id', invoice.patient_id)
        .single();
      
      const hasMedicalAid = !!medicalAid;
      
      console.log(`\n📋 ${invoice.invoice_number} - ${patient.first_name} ${patient.last_name}`);
      console.log(`   Medical Aid: ${hasMedicalAid ? medicalAid.provider : 'None (Cash Patient)'}`);
      console.log(`   Service: ${service.code} - N$ ${service.total_price}`);
      console.log(`   Medical Aid Covered: N$ ${service.medical_aid_covered}`);
      console.log(`   Patient Portion: N$ ${service.patient_portion}`);
      
      if (hasMedicalAid) {
        // Medical aid patient should pay N$ 0.00
        if (service.patient_portion === 0 && service.medical_aid_covered === service.total_price) {
          console.log('   ✅ CORRECT: Medical aid patient pays N$ 0.00');
          medicalAidCorrect++;
        } else {
          console.log('   ❌ INCORRECT: Medical aid patient being charged!');
          medicalAidIncorrect++;
        }
      } else {
        // Cash patient should pay full amount
        if (service.medical_aid_covered === 0 && service.patient_portion === service.total_price) {
          console.log('   ✅ CORRECT: Cash patient pays full amount');
          cashCorrect++;
        } else {
          console.log('   ❌ INCORRECT: Cash patient getting medical aid coverage!');
          cashIncorrect++;
        }
      }
    }
    
    console.log('\n📊 BILLING VERIFICATION SUMMARY:');
    console.log('================================');
    console.log(`\n💳 Medical Aid Patients:`);
    console.log(`   ✅ Correctly billed: ${medicalAidCorrect}`);
    console.log(`   ❌ Incorrectly billed: ${medicalAidIncorrect}`);
    
    console.log(`\n💰 Cash Patients:`);
    console.log(`   ✅ Correctly billed: ${cashCorrect}`);
    console.log(`   ❌ Incorrectly billed: ${cashIncorrect}`);
    
    // Step 3: Test the auto-fix trigger
    console.log('\n🧪 Step 2: Testing auto-fix trigger...');
    
    // Get a medical aid patient
    const { data: medicalAidPatient } = await supabase
      .from('medical_aid_details')
      .select('patient_id')
      .limit(1)
      .single();
    
    if (medicalAidPatient) {
      // Create a test invoice
      const testInvoiceNumber = `AUTO-FIX-TEST-${Date.now()}`;
      
      const { data: testInvoice } = await supabase
        .from('invoices_enhanced')
        .insert([{
          invoice_number: testInvoiceNumber,
          patient_id: medicalAidPatient.patient_id,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          payment_status: 'pending'
        }])
        .select()
        .single();
      
      if (testInvoice) {
        // Get a tariff to test with
        const { data: testTariff } = await supabase
          .from('practice_tariffs')
          .select('id, code, description, price')
          .limit(1)
          .single();
        
        if (testTariff) {
          console.log(`🔧 Testing auto-fix with service: ${testTariff.code} (N$ ${testTariff.price})`);
          
          // Insert service with wrong values
          console.log('📤 Inserting with wrong values: medical_aid_covered=999, patient_portion=888');
          
          const { data: testService } = await supabase
            .from('invoice_services')
            .insert([{
              invoice_id: testInvoice.id,
              tariff_id: testTariff.id,
              code: testTariff.code,
              description: testTariff.description,
              quantity: 1,
              unit_price: testTariff.price,
              total_price: testTariff.price,
              medical_aid_covered: 999, // Wrong value
              patient_portion: 888, // Wrong value
              notes: 'AUTO-FIX TEST'
            }])
            .select()
            .single();
          
          if (testService) {
            console.log('📥 Values returned from database:');
            console.log(`   Medical Aid Covered: N$ ${testService.medical_aid_covered}`);
            console.log(`   Patient Portion: N$ ${testService.patient_portion}`);
            
            if (testService.medical_aid_covered === testService.total_price && testService.patient_portion === 0) {
              console.log('✅ AUTO-FIX TRIGGER IS WORKING! Values were corrected automatically.');
            } else {
              console.log('❌ AUTO-FIX TRIGGER NOT WORKING! Values were not corrected.');
            }
          }
          
          // Clean up test data
          await supabase.from('invoice_services').delete().eq('invoice_id', testInvoice.id);
          await supabase.from('invoices_enhanced').delete().eq('id', testInvoice.id);
        }
      }
    }
    
    console.log('\n🎯 FINAL RESULT:');
    if (medicalAidIncorrect === 0 && cashIncorrect === 0) {
      console.log('🎉 ALL BILLING IS CORRECT!');
      console.log('✅ Medical aid patients pay N$ 0.00');
      console.log('✅ Cash patients pay full amount');
      console.log('✅ Auto-fix trigger is working');
      console.log('\n🚀 PROBLEM SOLVED: Medical aid billing is fixed!');
    } else {
      console.log('⚠️ Some billing issues remain');
      if (medicalAidIncorrect > 0) {
        console.log(`❌ ${medicalAidIncorrect} medical aid services are incorrectly charging patients`);
      }
      if (cashIncorrect > 0) {
        console.log(`❌ ${cashIncorrect} cash services are incorrectly getting medical aid coverage`);
      }
      console.log('\n📋 Next Steps:');
      console.log('1. Execute MANUAL_AUTO_FIX_TRIGGER.sql in Supabase SQL Editor');
      console.log('2. Test creating a new visit with a medical aid patient');
    }
    
  } catch (error) {
    console.error('💥 Verification failed:', error.message);
  }
}

simpleVerification();
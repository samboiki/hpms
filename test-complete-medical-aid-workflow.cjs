#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function testCompleteWorkflow() {
  try {
    console.log('🧪 COMPREHENSIVE MEDICAL AID BILLING TEST');
    console.log('==========================================\n');
    
    // Step 1: Find a medical aid patient
    console.log('📋 Step 1: Finding medical aid patients...');
    
    const { data: medicalAidPatients, error: patientsError } = await supabase
      .from('patients')
      .select(`
        id,
        first_name,
        last_name,
        medical_aid_details (
          id,
          provider,
          membership_number
        )
      `)
      .not('medical_aid_details', 'is', null)
      .limit(3);
    
    if (patientsError) {
      console.error('❌ Error finding medical aid patients:', patientsError);
      return;
    }
    
    console.log(`✅ Found ${medicalAidPatients?.length || 0} medical aid patients`);
    medicalAidPatients?.forEach((patient, i) => {
      console.log(`   ${i+1}. ${patient.first_name} ${patient.last_name} (${patient.medical_aid_details?.[0]?.provider || 'Unknown provider'})`);
    });
    
    if (!medicalAidPatients || medicalAidPatients.length === 0) {
      console.log('⚠️ No medical aid patients found - creating a test patient');
      
      // Create a test medical aid patient
      const { data: newPatient, error: createError } = await supabase
        .from('patients')
        .insert([{
          first_name: 'TEST',
          last_name: 'MEDICAL AID',
          email: 'test.medicalaid@test.com',
          cell_number: '081234567',
          date_of_birth: '1980-01-01'
        }])
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating test patient:', createError);
        return;
      }
      
      // Add medical aid details
      const { error: medicalAidError } = await supabase
        .from('medical_aid_details')
        .insert([{
          patient_id: newPatient.id,
          provider: 'TEST MEDICAL AID',
          scheme_name: 'TEST SCHEME',
          member_number: 'TEST123456'
        }]);
      
      if (medicalAidError) {
        console.error('❌ Error creating medical aid details:', medicalAidError);
        return;
      }
      
      console.log('✅ Created test medical aid patient:', newPatient.first_name, newPatient.last_name);
      medicalAidPatients.push(newPatient);
    }
    
    const testPatient = medicalAidPatients[0];
    console.log(`\n🎯 Using patient: ${testPatient.first_name} ${testPatient.last_name} (ID: ${testPatient.id})`);
    
    // Step 2: Check existing invoices for this patient
    console.log('\n📋 Step 2: Checking existing invoices...');
    
    const { data: existingInvoices, error: invoicesError } = await supabase
      .from('invoices_enhanced')
      .select(`
        *,
        invoice_services (
          code,
          description,
          total_price,
          medical_aid_covered,
          patient_portion
        )
      `)
      .eq('patient_id', testPatient.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (invoicesError) {
      console.log('⚠️ Error fetching invoices:', invoicesError.message);
    } else {
      console.log(`✅ Found ${existingInvoices?.length || 0} existing invoices`);
      
      existingInvoices?.forEach((invoice, i) => {
        console.log(`   ${i+1}. ${invoice.invoice_number} - Total: N$ ${invoice.total || 0} - Patient: N$ ${invoice.patient_total || 0}`);
        
        invoice.invoice_services?.forEach(service => {
          console.log(`      - ${service.code}: N$ ${service.total_price} (Medical Aid: N$ ${service.medical_aid_covered}, Patient: N$ ${service.patient_portion})`);
          
          if (service.patient_portion > 0) {
            console.log(`        ❌ PROBLEM: Medical aid patient being charged N$ ${service.patient_portion}`);
          } else {
            console.log(`        ✅ CORRECT: Medical aid covers 100%`);
          }
        });
      });
    }
    
    // Step 3: Check what services are available
    console.log('\n📋 Step 3: Getting available tariff services...');
    
    const { data: tariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, price')
      .limit(5);
    
    if (tariffsError) {
      console.error('❌ Error fetching tariffs:', tariffsError);
      return;
    }
    
    console.log(`✅ Found ${tariffs?.length || 0} available services`);
    tariffs?.forEach((tariff, i) => {
      console.log(`   ${i+1}. ${tariff.code} - ${tariff.description} - N$ ${tariff.price}`);
    });
    
    if (!tariffs || tariffs.length === 0) {
      console.log('❌ No tariffs found - cannot continue test');
      return;
    }
    
    // Step 4: Skip TypeScript import - test directly with database
    console.log('\n🧪 Step 4: Testing database billing directly (skipping TypeScript import)...');
    
    // Step 5: Manual test - create a test invoice directly
    console.log('\n🔧 Step 5: Creating test invoice manually...');
    
    // Create a test visit first
    const { data: testVisit, error: visitError } = await supabase
      .from('visits')
      .insert([{
        patient_id: testPatient.id,
        visit_date: new Date().toISOString().split('T')[0],
        visit_time: '10:00:00',
        visit_type: 'consultation',
        chief_complaint: 'BILLING TEST - Medical aid patient should pay N$ 0.00',
        diagnosis: 'Test diagnosis',
        treatment_plan: 'Test treatment',
        status: 'completed'
      }])
      .select()
      .single();
    
    if (visitError) {
      console.error('❌ Error creating test visit:', visitError);
      return;
    }
    
    console.log('✅ Created test visit:', testVisit.id);
    
    // Create test invoice
    const invoiceNumber = `TEST-BILLING-${Date.now()}`;
    const { data: testInvoice, error: invoiceError } = await supabase
      .from('invoices_enhanced')
      .insert([{
        invoice_number: invoiceNumber,
        patient_id: testPatient.id,
        visit_id: testVisit.id,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_status: 'pending'
      }])
      .select()
      .single();
    
    if (invoiceError) {
      console.error('❌ Error creating test invoice:', invoiceError);
      return;
    }
    
    console.log('✅ Created test invoice:', testInvoice.invoice_number);
    
    // Add services to invoice (this is where the problem occurs)
    console.log('\n🛠️ Step 6: Adding services to test invoice...');
    
    const testService = tariffs[0];
    const serviceData = {
      invoice_id: testInvoice.id,
      tariff_id: testService.id,
      code: testService.code,
      description: testService.description,
      quantity: 1,
      unit_price: testService.price,
      total_price: testService.price,
      medical_aid_covered: 999.99, // Intentionally wrong - should be auto-fixed
      patient_portion: 888.88, // Intentionally wrong - should be auto-fixed
      notes: 'TEST SERVICE - values should be auto-corrected for medical aid patient'
    };
    
    console.log('📤 Inserting service with intentionally wrong values:', serviceData);
    
    const { data: insertedService, error: serviceError } = await supabase
      .from('invoice_services')
      .insert([serviceData])
      .select()
      .single();
    
    if (serviceError) {
      console.error('❌ Error creating service:', serviceError);
      return;
    }
    
    console.log('📥 Service inserted. Values received from database:', {
      code: insertedService.code,
      total_price: insertedService.total_price,
      medical_aid_covered: insertedService.medical_aid_covered,
      patient_portion: insertedService.patient_portion
    });
    
    // Check if auto-fix worked
    if (insertedService.medical_aid_covered === insertedService.total_price && insertedService.patient_portion === 0) {
      console.log('✅ AUTO-FIX WORKED! Medical aid covers 100%, patient pays N$ 0.00');
    } else {
      console.log('❌ AUTO-FIX FAILED! Medical aid patient is being charged:');
      console.log(`   - Medical aid covered: N$ ${insertedService.medical_aid_covered}`);
      console.log(`   - Patient portion: N$ ${insertedService.patient_portion}`);
      console.log(`   - Total price: N$ ${insertedService.total_price}`);
    }
    
    // Step 7: Test cash patient
    console.log('\n💰 Step 7: Testing cash patient...');
    
    const { data: cashPatients, error: cashError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .not('id', 'in', `(${medicalAidPatients.map(p => `'${p.id}'`).join(',')})`)
      .limit(1);
    
    let cashPatient = cashPatients?.[0];
    
    if (!cashPatient) {
      console.log('⚠️ No cash patients found - creating test cash patient');
      
      const { data: newCashPatient, error: createCashError } = await supabase
        .from('patients')
        .insert([{
          first_name: 'TEST',
          last_name: 'CASH PATIENT',
          email: 'test.cash@test.com',
          cell_number: '081234568',
          date_of_birth: '1985-01-01'
        }])
        .select()
        .single();
      
      if (createCashError) {
        console.error('❌ Error creating cash patient:', createCashError);
        return;
      }
      
      cashPatient = newCashPatient;
      console.log('✅ Created test cash patient:', cashPatient.first_name, cashPatient.last_name);
    }
    
    // Test cash patient billing
    const cashServiceData = {
      invoice_id: testInvoice.id, // Using same invoice for simplicity
      tariff_id: testService.id,
      code: 'CASH-TEST',
      description: 'Cash patient test service',
      quantity: 1,
      unit_price: 75.00,
      total_price: 75.00,
      medical_aid_covered: 999.99, // Should be auto-fixed to 0
      patient_portion: 0.01, // Should be auto-fixed to 75.00
      notes: 'CASH TEST - values should be auto-corrected for cash patient'
    };
    
    console.log('📤 Testing cash patient service...');
    
    // For this test, let's update the invoice to point to cash patient
    await supabase
      .from('invoices_enhanced')
      .update({ patient_id: cashPatient.id })
      .eq('id', testInvoice.id);
    
    const { data: cashService, error: cashServiceError } = await supabase
      .from('invoice_services')
      .insert([cashServiceData])
      .select()
      .single();
    
    if (cashServiceError) {
      console.error('❌ Error creating cash service:', cashServiceError);
    } else {
      console.log('📥 Cash service result:', {
        code: cashService.code,
        total_price: cashService.total_price,
        medical_aid_covered: cashService.medical_aid_covered,
        patient_portion: cashService.patient_portion
      });
      
      if (cashService.medical_aid_covered === 0 && cashService.patient_portion === cashService.total_price) {
        console.log('✅ CASH PATIENT CORRECT: Patient pays 100%, medical aid covers nothing');
      } else {
        console.log('❌ CASH PATIENT INCORRECT: Wrong billing values');
      }
    }
    
    // Step 8: Summary and cleanup
    console.log('\n📊 FINAL SUMMARY');
    console.log('================');
    
    const { data: finalCheck, error: finalError } = await supabase
      .from('invoice_services')
      .select(`
        code,
        description,
        total_price,
        medical_aid_covered,
        patient_portion,
        invoices_enhanced!inner (
          patient_id,
          patients!inner (
            first_name,
            last_name
          )
        )
      `)
      .eq('invoice_id', testInvoice.id);
    
    if (!finalError && finalCheck) {
      finalCheck.forEach(service => {
        const patient = service.invoices_enhanced.patients;
        console.log(`\n🧾 Service: ${service.code} (${patient.first_name} ${patient.last_name})`);
        console.log(`   Total: N$ ${service.total_price}`);
        console.log(`   Medical Aid: N$ ${service.medical_aid_covered}`);
        console.log(`   Patient: N$ ${service.patient_portion}`);
        
        if (service.patient_portion > 0 && patient.first_name.includes('MEDICAL AID')) {
          console.log('   ❌ PROBLEM: Medical aid patient being charged!');
        } else if (service.medical_aid_covered > 0 && patient.first_name.includes('CASH')) {
          console.log('   ❌ PROBLEM: Cash patient getting medical aid coverage!');
        } else {
          console.log('   ✅ CORRECT: Billing values are accurate');
        }
      });
    }
    
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    
    await supabase.from('invoice_services').delete().eq('invoice_id', testInvoice.id);
    await supabase.from('invoices_enhanced').delete().eq('id', testInvoice.id);
    await supabase.from('visits').delete().eq('id', testVisit.id);
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎯 CONCLUSION:');
    console.log('If medical aid patients show patient_portion > 0, the auto-fix trigger needs to be installed.');
    console.log('Use Supabase SQL Editor to execute: MANUAL_AUTO_FIX_TRIGGER.sql');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCompleteWorkflow();
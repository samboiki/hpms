#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function deepDiagnosis() {
  try {
    console.log('🔍 DEEP MEDICAL AID BILLING DIAGNOSIS');
    console.log('=====================================');
    console.log('📋 TRACKING EVERY STEP WHERE PATIENTS GET CHARGED\n');
    
    // Step 1: Find ALL medical aid patients
    console.log('🔎 STEP 1: Finding ALL medical aid patients...');
    
    const { data: medicalAidPatients, error: patientsError } = await supabase
      .from('medical_aid_details')
      .select(`
        patient_id,
        provider,
        membership_number,
        patients (
          first_name,
          last_name,
          email
        )
      `);
    
    if (patientsError) {
      console.error('❌ ERROR finding medical aid patients:', patientsError);
      return;
    }
    
    console.log(`✅ FOUND ${medicalAidPatients?.length || 0} medical aid patients:`);
    medicalAidPatients?.forEach((patient, i) => {
      console.log(`   ${i+1}. ${patient.patients.first_name} ${patient.patients.last_name} - ${patient.provider} (${patient.membership_number})`);
    });
    
    // Step 2: For EACH medical aid patient, check ALL their invoices
    console.log('\n🔎 STEP 2: Checking EVERY invoice for EVERY medical aid patient...\n');
    
    let totalMedicalAidPatients = 0;
    let totalIncorrectlyChargedPatients = 0;
    let totalIncorrectServices = 0;
    let totalIncorrectAmount = 0;
    
    for (const medicalAidRecord of medicalAidPatients || []) {
      const patient = medicalAidRecord.patients;
      totalMedicalAidPatients++;
      
      console.log(`\n👤 PATIENT: ${patient.first_name} ${patient.last_name}`);
      console.log(`   Medical Aid: ${medicalAidRecord.provider}`);
      console.log(`   Member Number: ${medicalAidRecord.membership_number}`);
      console.log(`   Patient ID: ${medicalAidRecord.patient_id}`);
      
      // Get ALL invoices for this patient
      const { data: patientInvoices, error: invoicesError } = await supabase
        .from('invoices_enhanced')
        .select('*')
        .eq('patient_id', medicalAidRecord.patient_id)
        .order('created_at', { ascending: false });
      
      if (invoicesError) {
        console.log(`   ❌ ERROR getting invoices: ${invoicesError.message}`);
        continue;
      }
      
      console.log(`   📋 Found ${patientInvoices?.length || 0} invoices`);
      
      if (!patientInvoices || patientInvoices.length === 0) {
        console.log(`   ✅ No invoices - nothing to check`);
        continue;
      }
      
      let patientHasIncorrectCharges = false;
      
      // Check each invoice
      for (const invoice of patientInvoices) {
        console.log(`\n   📄 INVOICE: ${invoice.invoice_number}`);
        console.log(`      Issue Date: ${invoice.issue_date}`);
        console.log(`      Invoice Total: N$ ${invoice.total || 0}`);
        console.log(`      Medical Aid Total: N$ ${invoice.medical_aid_total || 0}`);
        console.log(`      Patient Total: N$ ${invoice.patient_total || 0}`);
        
        if (invoice.patient_total > 0) {
          console.log(`      ❌ PROBLEM: Medical aid patient charged N$ ${invoice.patient_total}!`);
          patientHasIncorrectCharges = true;
        }
        
        // Get ALL services for this invoice
        const { data: invoiceServices, error: servicesError } = await supabase
          .from('invoice_services')
          .select('*')
          .eq('invoice_id', invoice.id)
          .order('created_at', { ascending: false });
        
        if (servicesError) {
          console.log(`      ❌ ERROR getting services: ${servicesError.message}`);
          continue;
        }
        
        console.log(`      🛍️ Found ${invoiceServices?.length || 0} services:`);
        
        for (const service of invoiceServices || []) {
          console.log(`\n         🔧 SERVICE: ${service.code} - ${service.description}`);
          console.log(`            Quantity: ${service.quantity}`);
          console.log(`            Unit Price: N$ ${service.unit_price}`);
          console.log(`            Total Price: N$ ${service.total_price}`);
          console.log(`            Medical Aid Covered: N$ ${service.medical_aid_covered}`);
          console.log(`            Patient Portion: N$ ${service.patient_portion}`);
          console.log(`            Created: ${service.created_at}`);
          
          if (service.patient_portion > 0) {
            console.log(`            ❌ INCORRECT: Medical aid patient charged N$ ${service.patient_portion}`);
            totalIncorrectServices++;
            totalIncorrectAmount += parseFloat(service.patient_portion);
            patientHasIncorrectCharges = true;
          } else {
            console.log(`            ✅ CORRECT: Patient pays N$ 0.00`);
          }
        }
      }
      
      if (patientHasIncorrectCharges) {
        totalIncorrectlyChargedPatients++;
        console.log(`   ❌ PATIENT SUMMARY: This medical aid patient is being charged!`);
      } else {
        console.log(`   ✅ PATIENT SUMMARY: This medical aid patient pays N$ 0.00 correctly`);
      }
    }
    
    // Step 3: Check if auto-fix trigger exists
    console.log('\n🔎 STEP 3: Checking if auto-fix trigger is installed...');
    
    const { data: triggerCheck, error: triggerError } = await supabase
      .rpc('execute_sql', {
        sql: `
          SELECT 
            trigger_name,
            event_manipulation,
            action_timing
          FROM information_schema.triggers 
          WHERE event_object_table = 'invoice_services'
          AND trigger_name LIKE '%medical_aid%';
        `
      });
    
    if (triggerError) {
      console.log('⚠️ Could not check trigger status');
    } else {
      console.log(`✅ Trigger check result: ${JSON.stringify(triggerCheck)}`);
      
      if (!triggerCheck || triggerCheck.length === 0) {
        console.log('❌ NO AUTO-FIX TRIGGER FOUND! This explains why patients are being charged.');
      } else {
        console.log('✅ Auto-fix trigger found, but may not be working correctly');
      }
    }
    
    // Step 4: Test creating a new service for a medical aid patient
    console.log('\n🔎 STEP 4: Testing live service creation for medical aid patient...');
    
    if (medicalAidPatients && medicalAidPatients.length > 0) {
      const testPatient = medicalAidPatients[0];
      console.log(`🧪 Using test patient: ${testPatient.patients.first_name} ${testPatient.patients.last_name}`);
      
      // Create test invoice
      const testInvoiceNumber = `DEEP-TEST-${Date.now()}`;
      
      console.log(`📝 Creating test invoice: ${testInvoiceNumber}`);
      
      const { data: testInvoice, error: invoiceError } = await supabase
        .from('invoices_enhanced')
        .insert([{
          invoice_number: testInvoiceNumber,
          patient_id: testPatient.patient_id,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          payment_status: 'pending'
        }])
        .select()
        .single();
      
      if (invoiceError) {
        console.log(`❌ ERROR creating test invoice: ${invoiceError.message}`);
      } else {
        console.log(`✅ Test invoice created: ${testInvoice.id}`);
        
        // Get a tariff to test with
        const { data: testTariff } = await supabase
          .from('practice_tariffs')
          .select('*')
          .limit(1)
          .single();
        
        if (testTariff) {
          console.log(`🔧 Using test tariff: ${testTariff.code} - N$ ${testTariff.price}`);
          
          // Test 1: Insert with correct values
          console.log('\n🧪 TEST 1: Inserting service with CORRECT values...');
          
          const correctServiceData = {
            invoice_id: testInvoice.id,
            tariff_id: testTariff.id,
            code: testTariff.code,
            description: testTariff.description + ' - CORRECT TEST',
            quantity: 1,
            unit_price: testTariff.price,
            total_price: testTariff.price,
            medical_aid_covered: testTariff.price, // Correct - medical aid covers 100%
            patient_portion: 0, // Correct - patient pays nothing
            notes: 'DEEP TEST - CORRECT VALUES'
          };
          
          console.log('📤 Inserting with correct values:', JSON.stringify(correctServiceData, null, 2));
          
          const { data: correctService, error: correctError } = await supabase
            .from('invoice_services')
            .insert([correctServiceData])
            .select()
            .single();
          
          if (correctError) {
            console.log(`❌ ERROR inserting correct service: ${correctError.message}`);
          } else {
            console.log('📥 Service inserted. Database returned:');
            console.log(`   Medical Aid Covered: N$ ${correctService.medical_aid_covered}`);
            console.log(`   Patient Portion: N$ ${correctService.patient_portion}`);
            
            if (correctService.patient_portion === 0) {
              console.log('✅ CORRECT VALUES MAINTAINED');
            } else {
              console.log('❌ CORRECT VALUES WERE CHANGED BY SYSTEM!');
            }
          }
          
          // Test 2: Insert with WRONG values to see if trigger fixes them
          console.log('\n🧪 TEST 2: Inserting service with WRONG values to test auto-fix...');
          
          const wrongServiceData = {
            invoice_id: testInvoice.id,
            tariff_id: testTariff.id,
            code: testTariff.code + '-WRONG',
            description: testTariff.description + ' - WRONG TEST',
            quantity: 1,
            unit_price: testTariff.price,
            total_price: testTariff.price,
            medical_aid_covered: 999.99, // WRONG - should be fixed to total_price
            patient_portion: 888.88, // WRONG - should be fixed to 0
            notes: 'DEEP TEST - WRONG VALUES THAT SHOULD BE AUTO-FIXED'
          };
          
          console.log('📤 Inserting with WRONG values:', JSON.stringify(wrongServiceData, null, 2));
          
          const { data: wrongService, error: wrongError } = await supabase
            .from('invoice_services')
            .insert([wrongServiceData])
            .select()
            .single();
          
          if (wrongError) {
            console.log(`❌ ERROR inserting wrong service: ${wrongError.message}`);
          } else {
            console.log('📥 Service inserted. Database returned:');
            console.log(`   Medical Aid Covered: N$ ${wrongService.medical_aid_covered}`);
            console.log(`   Patient Portion: N$ ${wrongService.patient_portion}`);
            
            if (wrongService.patient_portion === 0 && wrongService.medical_aid_covered === wrongService.total_price) {
              console.log('✅ AUTO-FIX TRIGGER WORKED! Wrong values were corrected.');
            } else {
              console.log('❌ AUTO-FIX TRIGGER FAILED! Wrong values were NOT corrected.');
              console.log('   This explains why medical aid patients are being charged!');
            }
          }
          
          // Clean up test data
          console.log('\n🧹 Cleaning up test data...');
          await supabase.from('invoice_services').delete().eq('invoice_id', testInvoice.id);
          await supabase.from('invoices_enhanced').delete().eq('id', testInvoice.id);
          console.log('✅ Test data cleaned up');
        }
      }
    }
    
    // Step 5: Final summary
    console.log('\n📊 COMPREHENSIVE DIAGNOSIS SUMMARY');
    console.log('===================================');
    console.log(`👥 Total Medical Aid Patients: ${totalMedicalAidPatients}`);
    console.log(`❌ Patients Being Incorrectly Charged: ${totalIncorrectlyChargedPatients}`);
    console.log(`🔧 Total Incorrect Services: ${totalIncorrectServices}`);
    console.log(`💰 Total Incorrect Amount: N$ ${totalIncorrectAmount.toFixed(2)}`);
    
    if (totalIncorrectlyChargedPatients > 0) {
      console.log('\n🚨 CRITICAL ISSUE CONFIRMED:');
      console.log(`   ${totalIncorrectlyChargedPatients} medical aid patients are being charged!`);
      console.log(`   ${totalIncorrectServices} services have incorrect billing`);
      console.log(`   Total overcharged amount: N$ ${totalIncorrectAmount.toFixed(2)}`);
      
      console.log('\n🔧 REQUIRED FIXES:');
      console.log('   1. Install/fix auto-fix trigger for new services');
      console.log('   2. Fix existing incorrect services in database');
      console.log('   3. Update invoice totals to reflect corrections');
      console.log('   4. Test frontend to ensure it creates correct values');
    } else {
      console.log('\n✅ NO ISSUES FOUND: All medical aid patients are correctly billed N$ 0.00');
    }
    
  } catch (error) {
    console.error('💥 DEEP DIAGNOSIS FAILED:', error.message);
    console.error('Stack:', error.stack);
  }
}

deepDiagnosis();
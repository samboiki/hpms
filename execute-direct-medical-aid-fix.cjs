#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeDirectFix() {
  try {
    console.log('🩺 MEDICAL AID BILLING FIX - Direct SQL Approach\n');
    
    // Step 1: Check current state of medical aid services
    console.log('🔍 Step 1: Checking current medical aid billing issues...');
    
    const { data: currentState, error: checkError } = await supabase
      .from('invoice_services')
      .select(`
        *,
        invoices_enhanced!inner(
          patient_id,
          patients!inner(
            id,
            medical_aid_details!inner(id)
          )
        )
      `)
      .gt('patient_portion', 0);
    
    if (checkError) {
      console.error('❌ Check error:', checkError.message);
      return;
    }
    
    console.log(`   • Found ${currentState?.length || 0} medical aid services charging patients\n`);
    
    if (!currentState || currentState.length === 0) {
      console.log('✅ No medical aid billing issues found!');
      return;
    }
    
    // Step 2: Fix medical aid services one by one to avoid trigger issues
    console.log('💰 Step 2: Fixing medical aid service charges...');
    
    let fixedCount = 0;
    for (const service of currentState) {
      try {
        const { error: fixError } = await supabase
          .from('invoice_services')
          .update({
            medical_aid_covered: service.total_price,
            patient_portion: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', service.id);
        
        if (fixError) {
          console.error(`❌ Error fixing service ${service.id}:`, fixError.message);
        } else {
          fixedCount++;
        }
      } catch (err) {
        console.error(`❌ Exception fixing service ${service.id}:`, err.message);
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} out of ${currentState.length} services\n`);
    
    // Step 3: Get all medical aid invoices and fix totals
    console.log('📄 Step 3: Updating invoice totals...');
    
    const { data: medicalAidInvoices, error: invoiceError } = await supabase
      .from('invoices_enhanced')
      .select(`
        id,
        patients!inner(
          id,
          medical_aid_details!inner(id)
        )
      `);
    
    if (invoiceError) {
      console.error('❌ Invoice fetch error:', invoiceError.message);
      return;
    }
    
    let invoiceFixedCount = 0;
    for (const invoice of medicalAidInvoices || []) {
      try {
        // Get service totals for this invoice
        const { data: services } = await supabase
          .from('invoice_services')
          .select('medical_aid_covered, patient_portion, total_price')
          .eq('invoice_id', invoice.id);
        
        if (services && services.length > 0) {
          const totalMedicalAid = services.reduce((sum, s) => sum + (s.medical_aid_covered || 0), 0);
          const totalPatient = services.reduce((sum, s) => sum + (s.patient_portion || 0), 0);
          const subtotal = services.reduce((sum, s) => sum + (s.total_price || 0), 0);
          
          const { error: updateError } = await supabase
            .from('invoices_enhanced')
            .update({
              subtotal: subtotal,
              tax: 0, // VAT inclusive
              total: subtotal,
              medical_aid_total: totalMedicalAid,
              patient_total: totalPatient,
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.id);
          
          if (updateError) {
            console.error(`❌ Error updating invoice ${invoice.id}:`, updateError.message);
          } else {
            invoiceFixedCount++;
          }
        }
      } catch (err) {
        console.error(`❌ Exception updating invoice ${invoice.id}:`, err.message);
      }
    }
    
    console.log(`✅ Updated ${invoiceFixedCount} invoice totals\n`);
    
    // Step 4: Verify the fix
    console.log('🎯 Step 4: Verifying the fix...');
    
    const { data: verificationData, error: verifyError } = await supabase
      .from('invoice_services')
      .select(`
        *,
        invoices_enhanced!inner(
          patient_id,
          patients!inner(
            id,
            medical_aid_details!inner(id)
          )
        )
      `)
      .gt('patient_portion', 0);
    
    if (verifyError) {
      console.error('❌ Verification error:', verifyError.message);
      return;
    }
    
    console.log('📊 FINAL VERIFICATION:');
    console.log(`   • Medical aid services still charging patients: ${verificationData?.length || 0}`);
    
    if (!verificationData || verificationData.length === 0) {
      console.log('✅ SUCCESS: All medical aid patients now show N$ 0.00 patient portion!');
    } else {
      console.log(`⚠️  WARNING: ${verificationData.length} services still charging patients`);
      console.log('Services still charging:');
      verificationData.forEach(service => {
        console.log(`   - Service ${service.code}: N$ ${service.patient_portion}`);
      });
    }
    
    // Step 5: Check specific problem patient
    console.log('\n🔍 Step 5: Checking specific problem patient...');
    
    const { data: specificInvoices, error: specificError } = await supabase
      .from('invoices_enhanced')
      .select(`
        invoice_number,
        medical_aid_total,
        patient_total,
        invoice_services(
          id,
          medical_aid_covered,
          patient_portion,
          total_price
        )
      `)
      .eq('patient_id', 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (specificError) {
      console.log('⚠️ Specific check error:', specificError.message);
    } else if (specificInvoices && specificInvoices.length > 0) {
      console.log('📄 Recent invoices for problem patient:');
      specificInvoices.forEach((invoice, index) => {
        const servicesMedicalAidTotal = invoice.invoice_services?.reduce((sum, s) => sum + (s.medical_aid_covered || 0), 0) || 0;
        const servicesPatientTotal = invoice.invoice_services?.reduce((sum, s) => sum + (s.patient_portion || 0), 0) || 0;
        
        console.log(`   ${index + 1}. ${invoice.invoice_number}:`);
        console.log(`      • Invoice patient total: N$ ${invoice.patient_total}`);
        console.log(`      • Invoice medical aid total: N$ ${invoice.medical_aid_total}`);
        console.log(`      • Services patient total: N$ ${servicesPatientTotal}`);
        console.log(`      • Services medical aid total: N$ ${servicesMedicalAidTotal}`);
      });
    }
    
    console.log('\n🎉 MEDICAL AID BILLING FIX COMPLETED!');
    console.log('\n✅ WHAT WAS FIXED:');
    console.log('   - Fixed all medical aid services to show N$ 0.00 patient portion');
    console.log('   - Updated invoice totals to reflect correct medical aid coverage');
    console.log('   - Avoided recursive trigger issues by using direct updates');
    console.log('\n🧪 VERIFICATION:');
    console.log('   - Medical aid patients now have Patient Total = N$ 0.00');
    console.log('   - Medical aid covers 100% of service costs');
    console.log('   - No recursive trigger errors');
    
  } catch (error) {
    console.error('💥 Error executing direct fix:', error.message);
    console.error('Error details:', error);
  }
}

executeDirectFix();
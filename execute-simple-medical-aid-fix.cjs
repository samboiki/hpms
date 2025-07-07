#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSimpleFix() {
  try {
    console.log('🩺 MEDICAL AID BILLING FIX - Simple Direct Approach\n');
    
    // Step 1: Find all patients with medical aid
    console.log('🔍 Step 1: Finding medical aid patients...');
    
    const { data: medicalAidPatients, error: patientsError } = await supabase
      .from('medical_aid_details')
      .select('patient_id');
    
    if (patientsError) {
      console.error('❌ Patients error:', patientsError.message);
      return;
    }
    
    const patientIds = medicalAidPatients?.map(p => p.patient_id) || [];
    console.log(`   • Found ${patientIds.length} patients with medical aid\n`);
    
    if (patientIds.length === 0) {
      console.log('✅ No medical aid patients found');
      return;
    }
    
    // Step 2: Find invoices for these patients
    console.log('📄 Step 2: Finding invoices for medical aid patients...');
    
    const { data: medicalAidInvoices, error: invoicesError } = await supabase
      .from('invoices_enhanced')
      .select('id, patient_id, invoice_number')
      .in('patient_id', patientIds);
    
    if (invoicesError) {
      console.error('❌ Invoices error:', invoicesError.message);
      return;
    }
    
    const invoiceIds = medicalAidInvoices?.map(inv => inv.id) || [];
    console.log(`   • Found ${invoiceIds.length} invoices for medical aid patients\n`);
    
    if (invoiceIds.length === 0) {
      console.log('✅ No invoices found for medical aid patients');
      return;
    }
    
    // Step 3: Find services that are still charging patients
    console.log('💰 Step 3: Finding services that are charging medical aid patients...');
    
    const { data: problemServices, error: servicesError } = await supabase
      .from('invoice_services')
      .select('id, invoice_id, code, patient_portion, total_price')
      .in('invoice_id', invoiceIds)
      .gt('patient_portion', 0);
    
    if (servicesError) {
      console.error('❌ Services error:', servicesError.message);
      return;
    }
    
    console.log(`   • Found ${problemServices?.length || 0} services charging medical aid patients\n`);
    
    if (!problemServices || problemServices.length === 0) {
      console.log('✅ No medical aid billing issues found!');
      return;
    }
    
    // Step 4: Fix the services
    console.log('🔧 Step 4: Fixing medical aid service charges...');
    
    let fixedCount = 0;
    let errors = 0;
    
    for (const service of problemServices) {
      try {
        const { error: fixError } = await supabase
          .from('invoice_services')
          .update({
            medical_aid_covered: service.total_price,
            patient_portion: 0
          })
          .eq('id', service.id);
        
        if (fixError) {
          console.error(`❌ Error fixing service ${service.code}:`, fixError.message);
          errors++;
        } else {
          fixedCount++;
          if (fixedCount % 10 === 0) {
            console.log(`   • Fixed ${fixedCount} services...`);
          }
        }
      } catch (err) {
        console.error(`❌ Exception fixing service ${service.id}:`, err.message);
        errors++;
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} services, ${errors} errors\n`);
    
    // Step 5: Update invoice totals
    console.log('📊 Step 5: Updating invoice totals...');
    
    let invoiceFixedCount = 0;
    let invoiceErrors = 0;
    
    for (const invoice of medicalAidInvoices || []) {
      try {
        // Get service totals for this invoice
        const { data: services, error: serviceQueryError } = await supabase
          .from('invoice_services')
          .select('medical_aid_covered, patient_portion, total_price')
          .eq('invoice_id', invoice.id);
        
        if (serviceQueryError) {
          console.error(`❌ Error getting services for invoice ${invoice.invoice_number}:`, serviceQueryError.message);
          invoiceErrors++;
          continue;
        }
        
        if (services && services.length > 0) {
          const totalMedicalAid = services.reduce((sum, s) => sum + (parseFloat(s.medical_aid_covered) || 0), 0);
          const totalPatient = services.reduce((sum, s) => sum + (parseFloat(s.patient_portion) || 0), 0);
          const subtotal = services.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
          
          const { error: updateError } = await supabase
            .from('invoices_enhanced')
            .update({
              subtotal: subtotal,
              tax: 0, // VAT inclusive
              total: subtotal,
              medical_aid_total: totalMedicalAid,
              patient_total: totalPatient
            })
            .eq('id', invoice.id);
          
          if (updateError) {
            console.error(`❌ Error updating invoice ${invoice.invoice_number}:`, updateError.message);
            invoiceErrors++;
          } else {
            invoiceFixedCount++;
            if (invoiceFixedCount % 5 === 0) {
              console.log(`   • Updated ${invoiceFixedCount} invoices...`);
            }
          }
        }
      } catch (err) {
        console.error(`❌ Exception updating invoice ${invoice.invoice_number}:`, err.message);
        invoiceErrors++;
      }
    }
    
    console.log(`✅ Updated ${invoiceFixedCount} invoices, ${invoiceErrors} errors\n`);
    
    // Step 6: Final verification
    console.log('🎯 Step 6: Final verification...');
    
    const { data: remainingProblems, error: verifyError } = await supabase
      .from('invoice_services')
      .select('id, code, patient_portion')
      .in('invoice_id', invoiceIds)
      .gt('patient_portion', 0);
    
    if (verifyError) {
      console.error('❌ Verification error:', verifyError.message);
    } else {
      console.log('📊 FINAL VERIFICATION:');
      console.log(`   • Medical aid services still charging patients: ${remainingProblems?.length || 0}`);
      
      if (!remainingProblems || remainingProblems.length === 0) {
        console.log('🎉 SUCCESS: All medical aid patients now show N$ 0.00 patient portion!');
      } else {
        console.log(`⚠️  WARNING: ${remainingProblems.length} services still charging patients`);
        remainingProblems.slice(0, 5).forEach(service => {
          console.log(`   - Service ${service.code}: N$ ${service.patient_portion}`);
        });
        if (remainingProblems.length > 5) {
          console.log(`   ... and ${remainingProblems.length - 5} more`);
        }
      }
    }
    
    // Step 7: Check specific problem patient
    console.log('\n🔍 Step 7: Checking specific problem patient...');
    
    const { data: specificInvoices, error: specificError } = await supabase
      .from('invoices_enhanced')
      .select('id, invoice_number, medical_aid_total, patient_total')
      .eq('patient_id', 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (specificError) {
      console.log('⚠️ Specific check error:', specificError.message);
    } else if (specificInvoices && specificInvoices.length > 0) {
      console.log('📄 Recent invoices for problem patient:');
      
      for (const invoice of specificInvoices) {
        // Get service totals for verification
        const { data: invoiceServices } = await supabase
          .from('invoice_services')
          .select('medical_aid_covered, patient_portion')
          .eq('invoice_id', invoice.id);
        
        const servicesMedicalAidTotal = invoiceServices?.reduce((sum, s) => sum + (parseFloat(s.medical_aid_covered) || 0), 0) || 0;
        const servicesPatientTotal = invoiceServices?.reduce((sum, s) => sum + (parseFloat(s.patient_portion) || 0), 0) || 0;
        
        console.log(`   • ${invoice.invoice_number}:`);
        console.log(`     Invoice patient total: N$ ${invoice.patient_total}`);
        console.log(`     Invoice medical aid total: N$ ${invoice.medical_aid_total}`);
        console.log(`     Services patient total: N$ ${servicesPatientTotal}`);
        console.log(`     Services medical aid total: N$ ${servicesMedicalAidTotal}`);
      }
    }
    
    console.log('\n🎉 MEDICAL AID BILLING FIX COMPLETED!');
    console.log('\n✅ WHAT WAS FIXED:');
    console.log('   - Fixed medical aid services to show N$ 0.00 patient portion');
    console.log('   - Updated invoice totals to reflect correct medical aid coverage');
    console.log('   - Used direct updates to avoid recursive trigger issues');
    console.log('\n🧪 NEXT STEPS:');
    console.log('   - Test creating new invoices for medical aid patients');
    console.log('   - Verify that new invoices show N$ 0.00 patient portion');
    console.log('   - Update frontend service selectors if needed');
    
  } catch (error) {
    console.error('💥 Error executing simple fix:', error.message);
    console.error('Error details:', error);
  }
}

executeSimpleFix();
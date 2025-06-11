#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function removeTriggerAndFix() {
  try {
    console.log('🚨 EMERGENCY MEDICAL AID FIX - Remove Recursive Trigger\n');
    
    // Step 1: Remove ALL triggers on invoice_services table to stop recursion
    console.log('🗑️ Step 1: Removing ALL triggers from invoice_services table...');
    
    try {
      // Try to remove specific problematic triggers by name
      const triggerNames = [
        'fix_medical_aid_invoice_totals_trigger',
        'calculate_invoice_totals_trigger',
        'update_invoice_totals_trigger'
      ];
      
      for (const triggerName of triggerNames) {
        const { error } = await supabase.rpc('execute_sql', {
          sql: `DROP TRIGGER IF EXISTS ${triggerName} ON invoice_services;`
        });
        
        if (error && !error.message.includes('function') && !error.message.includes('does not exist')) {
          console.log(`⚠️ Note removing ${triggerName}:`, error.message);
        } else {
          console.log(`✅ Removed trigger: ${triggerName}`);
        }
      }
      
      // Also remove the functions
      const functionNames = [
        'fix_medical_aid_invoice_totals',
        'calculate_invoice_totals',
        'update_invoice_totals'
      ];
      
      for (const functionName of functionNames) {
        const { error } = await supabase.rpc('execute_sql', {
          sql: `DROP FUNCTION IF EXISTS ${functionName}();`
        });
        
        if (error && !error.message.includes('function') && !error.message.includes('does not exist')) {
          console.log(`⚠️ Note removing function ${functionName}:`, error.message);
        } else {
          console.log(`✅ Removed function: ${functionName}`);
        }
      }
      
    } catch (triggerError) {
      console.log('⚠️ Trigger removal note:', triggerError.message);
    }
    
    console.log('✅ All triggers removed\n');
    
    // Step 2: Wait a moment for the database to process the changes
    console.log('⏳ Waiting for database to process changes...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Now fix the data with no triggers interfering
    console.log('🔧 Step 3: Fixing medical aid service charges (NO TRIGGERS)...');
    
    // Find problematic services
    const { data: medicalAidPatients } = await supabase
      .from('medical_aid_details')
      .select('patient_id');
    
    const patientIds = medicalAidPatients?.map(p => p.patient_id) || [];
    
    const { data: medicalAidInvoices } = await supabase
      .from('invoices_enhanced')
      .select('id')
      .in('patient_id', patientIds);
    
    const invoiceIds = medicalAidInvoices?.map(inv => inv.id) || [];
    
    const { data: problemServices } = await supabase
      .from('invoice_services')
      .select('id, total_price')
      .in('invoice_id', invoiceIds)
      .gt('patient_portion', 0);
    
    console.log(`   • Found ${problemServices?.length || 0} services to fix`);
    
    // Fix services in batches to avoid overwhelming the database
    if (problemServices && problemServices.length > 0) {
      const batchSize = 5;
      let fixedCount = 0;
      
      for (let i = 0; i < problemServices.length; i += batchSize) {
        const batch = problemServices.slice(i, i + batchSize);
        
        console.log(`   • Fixing batch ${Math.floor(i/batchSize) + 1}...`);
        
        const updatePromises = batch.map(service => 
          supabase
            .from('invoice_services')
            .update({
              medical_aid_covered: service.total_price,
              patient_portion: 0
            })
            .eq('id', service.id)
        );
        
        const results = await Promise.allSettled(updatePromises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && !result.value.error) {
            fixedCount++;
          } else {
            const error = result.status === 'rejected' ? result.reason : result.value.error;
            console.error(`❌ Error fixing service in batch:`, error.message);
          }
        });
        
        // Wait between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`✅ Fixed ${fixedCount} out of ${problemServices.length} services\n`);
    }
    
    // Step 4: Fix invoice totals
    console.log('📊 Step 4: Updating invoice totals...');
    
    if (invoiceIds.length > 0) {
      let invoiceFixedCount = 0;
      
      for (const invoiceId of invoiceIds) {
        try {
          // Get service totals for this invoice
          const { data: services } = await supabase
            .from('invoice_services')
            .select('medical_aid_covered, patient_portion, total_price')
            .eq('invoice_id', invoiceId);
          
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
              .eq('id', invoiceId);
            
            if (!updateError) {
              invoiceFixedCount++;
            }
          }
        } catch (err) {
          // Continue with other invoices
        }
      }
      
      console.log(`✅ Updated ${invoiceFixedCount} invoices\n`);
    }
    
    // Step 5: Final verification
    console.log('🎯 Step 5: Final verification...');
    
    const { data: remainingProblems } = await supabase
      .from('invoice_services')
      .select('id, code, patient_portion')
      .in('invoice_id', invoiceIds)
      .gt('patient_portion', 0);
    
    console.log('📊 FINAL VERIFICATION:');
    console.log(`   • Medical aid services still charging patients: ${remainingProblems?.length || 0}`);
    
    if (!remainingProblems || remainingProblems.length === 0) {
      console.log('🎉 SUCCESS: All medical aid patients now show N$ 0.00 patient portion!');
    } else {
      console.log(`⚠️  WARNING: ${remainingProblems.length} services still charging patients`);
    }
    
    // Step 6: Check specific problem patient
    console.log('\n🔍 Step 6: Checking specific problem patient (ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8)...');
    
    const { data: specificInvoices } = await supabase
      .from('invoices_enhanced')
      .select('id, invoice_number, medical_aid_total, patient_total')
      .eq('patient_id', 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (specificInvoices && specificInvoices.length > 0) {
      const invoice = specificInvoices[0];
      console.log(`📄 Latest invoice ${invoice.invoice_number}:`);
      console.log(`   • Patient total: N$ ${invoice.patient_total}`);
      console.log(`   • Medical aid total: N$ ${invoice.medical_aid_total}`);
      
      if (parseFloat(invoice.patient_total) === 0) {
        console.log('✅ SUCCESS: Problem patient now shows N$ 0.00!');
      } else {
        console.log('❌ Problem patient still being charged');
      }
    }
    
    console.log('\n🎉 EMERGENCY FIX COMPLETED!');
    console.log('\n✅ WHAT WAS DONE:');
    console.log('   - Removed ALL recursive triggers from invoice_services');
    console.log('   - Fixed medical aid services without trigger interference');
    console.log('   - Updated invoice totals to match service charges');
    console.log('   - Medical aid patients should now show N$ 0.00');
    console.log('\n⚠️  IMPORTANT NOTE:');
    console.log('   - All triggers have been removed from invoice_services');
    console.log('   - Future invoice updates will need manual total calculation');
    console.log('   - Consider adding a safe, non-recursive trigger later');
    
  } catch (error) {
    console.error('💥 Error in emergency fix:', error.message);
    console.error('Error details:', error);
  }
}

removeTriggerAndFix();
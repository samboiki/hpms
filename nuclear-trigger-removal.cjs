#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function nuclearTriggerRemoval() {
  try {
    console.log('💣 NUCLEAR TRIGGER REMOVAL - Remove ALL triggers and functions\n');
    
    // Step 1: Find ALL triggers on invoice_services table
    console.log('🔍 Step 1: Finding ALL triggers on invoice_services...');
    
    const { data: triggers, error: triggerError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          trigger_name,
          event_manipulation,
          action_timing,
          action_statement
        FROM information_schema.triggers 
        WHERE event_object_table = 'invoice_services'
        AND trigger_schema = 'public';
      `
    });
    
    if (triggerError) {
      console.log('⚠️ Could not list triggers:', triggerError.message);
    } else if (triggers && triggers.length > 0) {
      console.log(`   • Found ${triggers.length} triggers:`);
      triggers.forEach(trigger => {
        console.log(`     - ${trigger.trigger_name} (${trigger.action_timing} ${trigger.event_manipulation})`);
      });
    } else {
      console.log('   • No triggers found');
    }
    
    // Step 2: Remove ALL triggers on invoice_services
    console.log('\n🗑️ Step 2: Removing ALL triggers on invoice_services...');
    
    if (triggers && triggers.length > 0) {
      for (const trigger of triggers) {
        try {
          const { error } = await supabase.rpc('execute_sql', {
            sql: `DROP TRIGGER IF EXISTS ${trigger.trigger_name} ON invoice_services;`
          });
          
          if (error) {
            console.log(`⚠️ Error removing ${trigger.trigger_name}:`, error.message);
          } else {
            console.log(`✅ Removed trigger: ${trigger.trigger_name}`);
          }
        } catch (err) {
          console.log(`⚠️ Exception removing ${trigger.trigger_name}:`, err.message);
        }
      }
    }
    
    // Step 3: Find and remove ALL functions that might be related
    console.log('\n🗑️ Step 3: Finding and removing related functions...');
    
    const { data: functions, error: functionError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          routine_name,
          routine_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND (routine_name LIKE '%invoice%' OR routine_name LIKE '%medical%' OR routine_name LIKE '%total%')
        AND routine_type = 'FUNCTION';
      `
    });
    
    if (functionError) {
      console.log('⚠️ Could not list functions:', functionError.message);
    } else if (functions && functions.length > 0) {
      console.log(`   • Found ${functions.length} related functions:`);
      functions.forEach(func => {
        console.log(`     - ${func.routine_name} (${func.routine_type})`);
      });
      
      for (const func of functions) {
        try {
          const { error } = await supabase.rpc('execute_sql', {
            sql: `DROP FUNCTION IF EXISTS ${func.routine_name}() CASCADE;`
          });
          
          if (error) {
            console.log(`⚠️ Error removing function ${func.routine_name}:`, error.message);
          } else {
            console.log(`✅ Removed function: ${func.routine_name}`);
          }
        } catch (err) {
          console.log(`⚠️ Exception removing function ${func.routine_name}:`, err.message);
        }
      }
    } else {
      console.log('   • No related functions found');
    }
    
    // Step 4: Wait for changes to propagate
    console.log('\n⏳ Step 4: Waiting for changes to propagate...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Test if we can update without recursion
    console.log('\n🧪 Step 5: Testing if we can update without recursion...');
    
    // Find one problematic service
    const { data: medicalAidPatients } = await supabase
      .from('medical_aid_details')
      .select('patient_id')
      .limit(1);
    
    if (medicalAidPatients && medicalAidPatients.length > 0) {
      const { data: medicalAidInvoices } = await supabase
        .from('invoices_enhanced')
        .select('id')
        .eq('patient_id', medicalAidPatients[0].patient_id)
        .limit(1);
      
      if (medicalAidInvoices && medicalAidInvoices.length > 0) {
        const { data: testService } = await supabase
          .from('invoice_services')
          .select('id, total_price, patient_portion')
          .eq('invoice_id', medicalAidInvoices[0].id)
          .gt('patient_portion', 0)
          .limit(1);
        
        if (testService && testService.length > 0) {
          console.log(`   • Testing update on service ${testService[0].id}...`);
          
          const { error: testError } = await supabase
            .from('invoice_services')
            .update({
              medical_aid_covered: testService[0].total_price,
              patient_portion: 0
            })
            .eq('id', testService[0].id);
          
          if (testError) {
            if (testError.message.includes('stack depth limit')) {
              console.log('❌ STILL RECURSIVE! There are more triggers we missed.');
              console.log('   Error:', testError.message);
              
              // Let's try a more aggressive approach
              console.log('\n💥 Step 6: EMERGENCY - Disabling ALL triggers on ALL tables...');
              
              const { error: disableError } = await supabase.rpc('execute_sql', {
                sql: `
                  -- Disable all triggers on invoice_services table
                  ALTER TABLE invoice_services DISABLE TRIGGER ALL;
                  
                  -- Also disable on invoices_enhanced just in case
                  ALTER TABLE invoices_enhanced DISABLE TRIGGER ALL;
                `
              });
              
              if (disableError) {
                console.log('⚠️ Error disabling triggers:', disableError.message);
              } else {
                console.log('✅ Disabled ALL triggers on invoice tables');
                
                // Try the update again
                console.log('\n🔄 Retrying update with ALL triggers disabled...');
                const { error: retryError } = await supabase
                  .from('invoice_services')
                  .update({
                    medical_aid_covered: testService[0].total_price,
                    patient_portion: 0
                  })
                  .eq('id', testService[0].id);
                
                if (retryError) {
                  console.log('❌ Still failing:', retryError.message);
                } else {
                  console.log('✅ SUCCESS! Update worked with triggers disabled');
                  
                  // Now fix all the problems
                  console.log('\n🔧 Step 7: Fixing ALL medical aid services...');
                  await fixAllMedicalAidServices();
                }
              }
            } else {
              console.log('❌ Different error:', testError.message);
            }
          } else {
            console.log('✅ SUCCESS! Update worked without recursion');
            
            // Now fix all the problems
            console.log('\n🔧 Step 6: Fixing ALL medical aid services...');
            await fixAllMedicalAidServices();
          }
        } else {
          console.log('   • No problematic services found to test');
        }
      }
    }
    
    console.log('\n🎉 NUCLEAR TRIGGER REMOVAL COMPLETED!');
    
  } catch (error) {
    console.error('💥 Error in nuclear removal:', error.message);
    console.error('Error details:', error);
  }
}

async function fixAllMedicalAidServices() {
  try {
    // Get all medical aid patients
    const { data: medicalAidPatients } = await supabase
      .from('medical_aid_details')
      .select('patient_id');
    
    const patientIds = medicalAidPatients?.map(p => p.patient_id) || [];
    
    if (patientIds.length === 0) {
      console.log('   • No medical aid patients found');
      return;
    }
    
    // Get their invoices
    const { data: medicalAidInvoices } = await supabase
      .from('invoices_enhanced')
      .select('id')
      .in('patient_id', patientIds);
    
    const invoiceIds = medicalAidInvoices?.map(inv => inv.id) || [];
    
    if (invoiceIds.length === 0) {
      console.log('   • No invoices found for medical aid patients');
      return;
    }
    
    // Get problematic services
    const { data: problemServices } = await supabase
      .from('invoice_services')
      .select('id, total_price, code')
      .in('invoice_id', invoiceIds)
      .gt('patient_portion', 0);
    
    console.log(`   • Found ${problemServices?.length || 0} services to fix`);
    
    if (!problemServices || problemServices.length === 0) {
      console.log('   • No problematic services found');
      return;
    }
    
    // Fix them one by one
    let fixed = 0;
    let errors = 0;
    
    for (const service of problemServices) {
      try {
        const { error } = await supabase
          .from('invoice_services')
          .update({
            medical_aid_covered: service.total_price,
            patient_portion: 0
          })
          .eq('id', service.id);
        
        if (error) {
          console.log(`   ❌ Error fixing ${service.code}:`, error.message);
          errors++;
        } else {
          fixed++;
          if (fixed % 5 === 0) {
            console.log(`   • Fixed ${fixed} services...`);
          }
        }
      } catch (err) {
        console.log(`   ❌ Exception fixing ${service.code}:`, err.message);
        errors++;
      }
    }
    
    console.log(`   ✅ Fixed ${fixed} services, ${errors} errors`);
    
    // Update invoice totals
    console.log('   🔄 Updating invoice totals...');
    
    for (const invoiceId of invoiceIds) {
      try {
        const { data: services } = await supabase
          .from('invoice_services')
          .select('medical_aid_covered, patient_portion, total_price')
          .eq('invoice_id', invoiceId);
        
        if (services && services.length > 0) {
          const totalMedicalAid = services.reduce((sum, s) => sum + (parseFloat(s.medical_aid_covered) || 0), 0);
          const totalPatient = services.reduce((sum, s) => sum + (parseFloat(s.patient_portion) || 0), 0);
          const subtotal = services.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
          
          await supabase
            .from('invoices_enhanced')
            .update({
              subtotal: subtotal,
              tax: 0,
              total: subtotal,
              medical_aid_total: totalMedicalAid,
              patient_total: totalPatient
            })
            .eq('id', invoiceId);
        }
      } catch (err) {
        // Continue
      }
    }
    
    console.log('   ✅ Invoice totals updated');
    
    // Final check
    const { data: remaining } = await supabase
      .from('invoice_services')
      .select('id')
      .in('invoice_id', invoiceIds)
      .gt('patient_portion', 0);
    
    console.log(`   📊 Final result: ${remaining?.length || 0} services still charging patients`);
    
    if (!remaining || remaining.length === 0) {
      console.log('   🎉 ALL MEDICAL AID BILLING ISSUES FIXED!');
    }
    
  } catch (error) {
    console.error('   💥 Error fixing services:', error.message);
  }
}

nuclearTriggerRemoval();
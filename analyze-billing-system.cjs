const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeBillingSystem() {
  console.log('💰 Analyzing current billing system...\n');
  
  try {
    // Analyze Medical Aid Providers
    console.log('📋 MEDICAL AID PROVIDERS:');
    const { data: medicalAids } = await supabase
      .from('medical_aid_providers')
      .select('*');
    
    console.log('Medical Aid Providers:', medicalAids);

    // Analyze Practice Configuration
    console.log('\n🏥 PRACTICE CONFIGURATION:');
    const { data: practices } = await supabase
      .from('practices')
      .select('*');
    
    console.log('Practices:', practices);

    // Analyze Current Billing Tables
    const billingTables = ['invoices', 'invoice_items', 'visit_services', 'billing_transactions'];
    const billingAnalysis = {};

    for (const table of billingTables) {
      try {
        const { data, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .limit(5);
        
        billingAnalysis[table] = {
          sampleData: data || [],
          totalCount: count || 0
        };
        
        console.log(`\n📊 ${table.toUpperCase()}: ${count || 0} records`);
        if (data && data.length > 0) {
          console.log('Sample structure:', Object.keys(data[0]));
        }
      } catch (error) {
        console.log(`❌ Error analyzing ${table}:`, error.message);
        billingAnalysis[table] = { error: error.message };
      }
    }

    // Analyze Patient Medical Aid Details
    console.log('\n🏥 PATIENT MEDICAL AID ANALYSIS:');
    const { data: patientMedicalAids, count: medicalAidCount } = await supabase
      .from('medical_aid_details')
      .select(`
        *,
        patients (
          first_name,
          last_name,
          id_number
        )
      `, { count: 'exact' })
      .limit(10);

    console.log(`Total patients with medical aid: ${medicalAidCount}`);
    console.log('Sample medical aid details:', patientMedicalAids?.slice(0, 3));

    // Analyze Practice Tariffs
    console.log('\n💲 PRACTICE TARIFFS ANALYSIS:');
    const { data: tariffs, count: tariffsCount } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact' })
      .limit(10);

    console.log(`Total tariff codes: ${tariffsCount}`);
    if (tariffs && tariffs.length > 0) {
      console.log('Tariff structure:', Object.keys(tariffs[0]));
      console.log('Sample tariffs:', tariffs.slice(0, 3));
    }

    // Analyze Visit Services (Current Billing Items)
    console.log('\n🔧 VISIT SERVICES (Current Billing Items):');
    const { data: visitServices } = await supabase
      .from('visit_services')
      .select(`
        *,
        visits (
          visit_date,
          patients (
            first_name,
            last_name,
            medical_aid_details (
              provider,
              member_number
            )
          )
        )
      `)
      .limit(10);

    console.log('Visit services with patient and medical aid info:', visitServices?.slice(0, 3));

    // Check for existing batch-related tables
    console.log('\n🗂️ CHECKING FOR EXISTING BATCH TABLES:');
    const batchTables = ['batch_headers', 'batch_details', 'batch_trailer'];
    
    for (const table of batchTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${table}: Does not exist`);
        } else {
          console.log(`✅ ${table}: Exists with structure`, data ? Object.keys(data[0] || {}) : 'Empty');
        }
      } catch (error) {
        console.log(`❌ ${table}: Does not exist or access denied`);
      }
    }

    const billingSystemAnalysis = {
      timestamp: new Date().toISOString(),
      medicalAidProviders: medicalAids,
      practices: practices,
      billingTables: billingAnalysis,
      patientMedicalAids: {
        count: medicalAidCount,
        sampleData: patientMedicalAids?.slice(0, 3)
      },
      practiceTariffs: {
        count: tariffsCount,
        sampleData: tariffs?.slice(0, 3)
      },
      visitServices: visitServices?.slice(0, 3)
    };

    fs.writeFileSync('billing-system-analysis.json', JSON.stringify(billingSystemAnalysis, null, 2));
    console.log('\n💾 Billing system analysis saved to billing-system-analysis.json');

    return billingSystemAnalysis;

  } catch (error) {
    console.error('❌ Billing system analysis failed:', error);
    return null;
  }
}

analyzeBillingSystem();
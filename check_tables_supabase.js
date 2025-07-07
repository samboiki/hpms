#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function checkTablesStructure() {
  console.log('🔍 Checking database tables with service role...\n');
  
  try {
    // Test visit_services table
    console.log('1️⃣ Testing visit_services table...');
    const { data: visitServices, error: visitServicesError } = await supabase
      .from('visit_services')
      .select('*')
      .limit(1);
    
    if (visitServicesError) {
      console.log('❌ visit_services error:', visitServicesError.message);
      console.log('   Details:', visitServicesError.details);
      console.log('   Hint:', visitServicesError.hint);
    } else {
      console.log('✅ visit_services table exists and is accessible');
      console.log('   Sample structure:', Object.keys(visitServices[0] || {}));
    }
    
    // Test other billing tables
    const billingTables = [
      'invoices_enhanced',
      'invoice_items_enhanced', 
      'medical_aid_coverage',
      'payment_records',
      'practice_billing_settings'
    ];
    
    console.log('\n2️⃣ Testing other billing tables...');
    for (const table of billingTables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: Available (${data.length} sample records)`);
        if (data.length > 0) {
          console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    }
    
    // Test existing core tables
    console.log('\n3️⃣ Testing core tables...');
    const coreTables = ['patients', 'visits', 'practice_tariffs'];
    
    for (const table of coreTables) {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count} records`);
      }
    }
    
    // Test a basic billing query that should work
    console.log('\n4️⃣ Testing basic billing integration query...');
    const { data: testQuery, error: testError } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, price')
      .not('price', 'is', null)
      .limit(5);
    
    if (testError) {
      console.log('❌ Test query failed:', testError.message);
    } else {
      console.log('✅ Test query successful');
      console.log('   Available services for billing:');
      testQuery.forEach(tariff => {
        console.log(`   • ${tariff.code}: ${tariff.description} - N$${tariff.price}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkTablesStructure().catch(console.error);
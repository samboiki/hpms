#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function debugVisitServicesStructure() {
  console.log('🔍 Debugging visit_services table structure and data...\n');
  
  try {
    // 1. Check visit_services table structure by attempting to query with select *
    console.log('1️⃣ Testing visit_services table access...');
    const { data: visitServicesTest, error: vsError } = await supabase
      .from('visit_services')
      .select('*')
      .limit(5);
    
    if (vsError) {
      console.log('❌ visit_services error:', vsError.message);
      return;
    } else {
      console.log(`✅ visit_services accessible - ${visitServicesTest.length} records found`);
      if (visitServicesTest.length > 0) {
        console.log('📋 Existing records:');
        visitServicesTest.forEach((record, i) => {
          console.log(`   ${i+1}. ID: ${record.id}`);
          console.log(`      Visit: ${record.visit_id}`);
          console.log(`      Tariff: ${record.tariff_id}`);
          console.log(`      Price: N$${record.total_price}`);
        });
      }
    }
    
    // 2. Check what sample data we have
    console.log('\n2️⃣ Checking available sample data...');
    
    // Check visits
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select('id, patient_id, visit_date, diagnosis, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (visitsError) {
      console.log('❌ visits error:', visitsError.message);
    } else {
      console.log(`✅ Found ${visits.length} visits`);
      visits.forEach((visit, i) => {
        console.log(`   ${i+1}. ${visit.id.slice(0, 8)}... - ${visit.diagnosis} (${visit.visit_date})`);
      });
    }
    
    // Check tariffs
    const { data: tariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, namaf_prace_2025, price')
      .not('price', 'is', null)
      .order('price', { ascending: true })
      .limit(5);
    
    if (tariffsError) {
      console.log('❌ tariffs error:', tariffsError.message);
    } else {
      console.log(`\n✅ Found ${tariffs.length} priced tariffs`);
      tariffs.forEach((tariff, i) => {
        console.log(`   ${i+1}. ${tariff.code}: ${tariff.namaf_prace_2025 || tariff.description} - N$${tariff.price}`);
      });
    }
    
    // 3. Try to create a test visit_service record if we have data
    if (visits && visits.length > 0 && tariffs && tariffs.length > 0) {
      console.log('\n3️⃣ Testing visit_services insertion...');
      
      const testData = {
        visit_id: visits[0].id,
        tariff_id: tariffs[0].id,
        quantity: 1,
        unit_price: parseFloat(tariffs[0].price),
        total_price: parseFloat(tariffs[0].price),
        notes: 'Test billing record created for debugging'
      };
      
      console.log('📝 Attempting to insert:', JSON.stringify(testData, null, 2));
      
      const { data: insertResult, error: insertError } = await supabase
        .from('visit_services')
        .insert(testData)
        .select();
      
      if (insertError) {
        console.log('❌ Insert failed:', insertError.message);
        console.log('   Details:', insertError.details);
        console.log('   Hint:', insertError.hint);
        console.log('   Code:', insertError.code);
        
        // Let's check what the exact table structure expects
        console.log('\n🔧 Trying to understand the table structure...');
        
        // Try inserting minimal data to see what's required
        const minimalData = {
          visit_id: visits[0].id,
          tariff_id: tariffs[0].id
        };
        
        const { data: minimalResult, error: minimalError } = await supabase
          .from('visit_services')
          .insert(minimalData)
          .select();
        
        if (minimalError) {
          console.log('❌ Minimal insert also failed:', minimalError.message);
          
          // Maybe the foreign key references are wrong?
          console.log('\n🔍 Checking foreign key references...');
          
          // Check if the visit_id exists
          const { data: visitCheck } = await supabase
            .from('visits')
            .select('id')
            .eq('id', visits[0].id)
            .single();
          
          console.log('Visit exists:', visitCheck ? '✅' : '❌');
          
          // Check if the tariff_id exists  
          const { data: tariffCheck } = await supabase
            .from('practice_tariffs')
            .select('id')
            .eq('id', tariffs[0].id)
            .single();
          
          console.log('Tariff exists:', tariffCheck ? '✅' : '❌');
          
        } else {
          console.log('✅ Minimal insert worked!');
          // Clean up
          await supabase.from('visit_services').delete().eq('id', minimalResult[0].id);
        }
        
      } else {
        console.log('✅ Insert successful!');
        console.log('📋 Inserted record:', insertResult[0]);
        
        // Test a join query
        console.log('\n4️⃣ Testing join query...');
        const { data: joinResult, error: joinError } = await supabase
          .from('visit_services')
          .select(`
            *,
            visits(visit_date, diagnosis, patients(first_name, last_name)),
            practice_tariffs(code, namaf_prace_2025)
          `)
          .eq('id', insertResult[0].id);
        
        if (joinError) {
          console.log('❌ Join query failed:', joinError.message);
        } else {
          console.log('✅ Join query successful!');
          console.log('📋 Complete record:', JSON.stringify(joinResult[0], null, 2));
        }
        
        // Clean up
        await supabase.from('visit_services').delete().eq('id', insertResult[0].id);
        console.log('🧹 Test record cleaned up');
      }
    } else {
      console.log('\n❌ Not enough sample data to test insertion');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

debugVisitServicesStructure().catch(console.error);
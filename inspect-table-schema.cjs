#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function inspectTableSchema() {
  console.log('🔍 INSPECTING PRACTICE_TARIFFS TABLE SCHEMA...\n');
  
  try {
    // Let's try to understand what columns exist by making an insert with all potential fields
    const testData = {
      practice_id: 'e0716e54-f808-4905-a1f8-85090dd3d9e2',
      code: 9999,
      description: 'Test entry for schema inspection',
      price: 100.00,
      official_2025_price_nad: 100.00,
      on_2025_list: 'YES',
      found_in_claims: 'YES',
      requires_tooth_number: 'NO',
      can_be_multiplied: 'NO',
      business_rule_formula: 'Fixed price',
      example_calculation: '100.00 NAD',
      notes: 'Test',
      practice_type: 'dental',
      namaf_prace_2025: 'Test NAMAF value', // This seems to be the missing required field
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('🧪 Attempting test insert with all potential fields...');
    const { data: insertData, error: insertError } = await supabase
      .from('practice_tariffs')
      .insert([testData])
      .select();
    
    if (insertError) {
      console.log('❌ Test insert failed:', insertError.message);
      console.log('Error code:', insertError.code);
      console.log('Error details:', insertError.details);
      
      // If it's still a missing column, let's try to figure out what namaf_prace_2025 should be
      if (insertError.message.includes('namaf_prace_2025')) {
        console.log('\n🤔 The namaf_prace_2025 field is required but we don\'t know its expected format.');
        console.log('Let\'s try different values...');
        
        const testValues = [
          '100.00',
          'NAMAF_100.00', 
          '100.00_NAD',
          'N100.00',
          testData.price.toString(),
          'NAMAF_' + testData.price.toString()
        ];
        
        for (const testValue of testValues) {
          console.log(`\n🧪 Trying namaf_prace_2025 = "${testValue}"`);
          const { error: testErr } = await supabase
            .from('practice_tariffs')
            .insert([{...testData, namaf_prace_2025: testValue}]);
          
          if (!testErr) {
            console.log(`✅ SUCCESS! namaf_prace_2025 should be: "${testValue}"`);
            
            // Clean up and show the successful structure
            await supabase.from('practice_tariffs').delete().eq('code', 9999);
            
            console.log('\n📋 SUCCESSFUL FIELD MAPPING:');
            console.log('namaf_prace_2025:', testValue);
            console.log('Pattern detected:', typeof testValue);
            
            return testValue;
          } else {
            console.log(`❌ Failed with: ${testErr.message}`);
          }
        }
      }
    } else {
      console.log('✅ Test insert successful!');
      console.log('📋 Inserted data structure:', insertData[0]);
      
      // Clean up
      await supabase.from('practice_tariffs').delete().eq('code', 9999);
      
      return 'SUCCESS';
    }
    
  } catch (error) {
    console.error('❌ Schema inspection failed:', error.message);
  }
}

inspectTableSchema().then(result => {
  if (result && result !== 'SUCCESS') {
    console.log('\n🎯 RECOMMENDED PATTERN FOR namaf_prace_2025:', result);
  }
  console.log('\n✅ Schema inspection completed');
}).catch(console.error);
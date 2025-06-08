#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// 🔑 SERVICE ROLE CONFIGURATION
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function simplifyTariffsStructure() {
  console.log('🔧 SIMPLIFYING TARIFFS STRUCTURE\n');
  
  try {
    // Step 1: Get current data for analysis
    console.log('🔍 Analyzing current structure...');
    
    const { data: currentTariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('id, practice_id, code, namaf_prace_2025, price, practice_type')
      .limit(10);
    
    if (tariffsError) {
      throw new Error(`Failed to fetch current tariffs: ${tariffsError.message}`);
    }
    
    console.log('📋 Current structure (sample):');
    currentTariffs.forEach(tariff => {
      console.log(`   • ${tariff.code}: ${tariff.namaf_prace_2025} - Practice: ${tariff.practice_id?.slice(0,8)}... Type: ${tariff.practice_type}`);
    });
    
    // Step 2: Get unique codes (remove duplicates across practices)
    console.log('\n🔄 Getting unique dental codes...');
    
    const { data: allTariffs, error: allError } = await supabase
      .from('practice_tariffs')
      .select('code, namaf_prace_2025, price, practice_type, category, subcategory, unit, complexity, multiplication_rule, tooth_number_required')
      .eq('practice_type', 'dental')
      .order('code');
    
    if (allError) {
      throw new Error(`Failed to fetch all tariffs: ${allError.message}`);
    }
    
    // Remove duplicates by code
    const uniqueCodes = {};
    allTariffs.forEach(tariff => {
      if (!uniqueCodes[tariff.code]) {
        uniqueCodes[tariff.code] = tariff;
      }
    });
    
    const uniqueTariffs = Object.values(uniqueCodes);
    console.log(`✅ Found ${uniqueTariffs.length} unique dental codes`);
    
    // Step 3: Clear all existing tariffs
    console.log('\n🧹 Clearing existing tariffs...');
    
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      throw new Error(`Failed to clear tariffs: ${deleteError.message}`);
    }
    
    console.log('✅ All existing tariffs cleared');
    
    // Step 4: Insert unique tariffs without practice_id
    console.log('\n📊 Inserting simplified tariff structure...');
    
    const simplifiedTariffs = uniqueTariffs.map(tariff => ({
      code: tariff.code,
      namaf_prace_2025: tariff.namaf_prace_2025,
      price: tariff.price,
      practice_type: 'dental', // All current codes are dental
      category: tariff.category,
      subcategory: tariff.subcategory,
      unit: tariff.unit || 'per_visit',
      complexity: tariff.complexity || 'moderate',
      multiplication_rule: tariff.multiplication_rule || 'NO',
      tooth_number_required: tariff.tooth_number_required || false,
      is_active: true,
      effective_from: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
      // No practice_id - codes are now global
    }));
    
    // Insert in batches
    const batchSize = 20;
    let totalInserted = 0;
    
    for (let i = 0; i < simplifiedTariffs.length; i += batchSize) {
      const batch = simplifiedTariffs.slice(i, i + batchSize);
      
      const { data: insertedBatch, error: insertError } = await supabase
        .from('practice_tariffs')
        .insert(batch)
        .select('id');
      
      if (insertError) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, insertError.message);
      } else {
        totalInserted += insertedBatch.length;
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: ${insertedBatch.length} codes inserted`);
      }
    }
    
    // Step 5: Verify the new structure
    console.log('\n🔍 Verifying new structure...');
    
    const { data: verifyTariffs, error: verifyError } = await supabase
      .from('practice_tariffs')
      .select('code, namaf_prace_2025, price, practice_type, practice_id')
      .order('code')
      .limit(10);
    
    if (!verifyError && verifyTariffs) {
      console.log('📋 New structure (sample):');
      verifyTariffs.forEach(tariff => {
        console.log(`   • ${tariff.code}: ${tariff.namaf_prace_2025} - N$${tariff.price} (Type: ${tariff.practice_type}, Practice ID: ${tariff.practice_id || 'none'})`);
      });
    }
    
    // Step 6: Update NewCharm practice type
    console.log('\n🏥 Confirming practice types...');
    
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, practice_type');
    
    if (!practicesError && practices) {
      for (const practice of practices) {
        let shouldUpdate = false;
        let newType = practice.practice_type;
        
        // Ensure NewCharm is marked as dental
        if (practice.name.toLowerCase().includes('newcharm')) {
          newType = 'dental';
          shouldUpdate = practice.practice_type !== 'dental';
        }
        
        if (shouldUpdate) {
          const { error: updateError } = await supabase
            .from('practices')
            .update({ practice_type: newType })
            .eq('id', practice.id);
          
          if (!updateError) {
            console.log(`✅ Updated ${practice.name}: ${practice.practice_type} → ${newType}`);
          }
        } else {
          console.log(`✅ ${practice.name}: ${practice.practice_type} (correct)`);
        }
      }
    }
    
    // Step 7: Show final summary
    console.log('\n📊 FINAL SUMMARY:');
    console.log('================');
    
    const { data: finalCount, error: countError } = await supabase
      .from('practice_tariffs')
      .select('practice_type, count(*)')
      .eq('is_active', true);
    
    // Count manually since we can't use GROUP BY
    const { data: allFinal, error: allFinalError } = await supabase
      .from('practice_tariffs')
      .select('practice_type')
      .eq('is_active', true);
    
    if (!allFinalError && allFinal) {
      const typeCount = {};
      allFinal.forEach(item => {
        const type = item.practice_type || 'unknown';
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      
      console.log('📋 Tariff codes by type:');
      Object.entries(typeCount).forEach(([type, count]) => {
        console.log(`   • ${type}: ${count} codes`);
      });
    }
    
    console.log('\n✅ NEW SIMPLIFIED STRUCTURE:');
    console.log('   • Tariffs table: Contains unique codes with their service type');
    console.log('   • No practice_id: Codes are global, not practice-specific');
    console.log('   • Practice table: Determines facility type (dental, medical, aesthetic)');
    console.log('   • ServiceSelector: Filters codes by matching practice type to service type');
    
    console.log('\n🔧 How it works now:');
    console.log('   1. Practice table defines facility type (NewCharm = dental)');
    console.log('   2. Tariffs table contains all available codes with service types');
    console.log('   3. ServiceSelector shows codes where practice type matches service type');
    console.log('   4. No duplication - each code exists once in the system');
    
    console.log('\n🎉 SIMPLIFICATION COMPLETE!');
    console.log(`✅ ${totalInserted} unique dental codes available system-wide`);
    console.log('✅ NewCharm and other dental practices will see dental codes');
    console.log('✅ Medical practices will need medical codes added later');
    
  } catch (error) {
    console.error('❌ Simplification failed:', error.message);
  }
}

// Execute simplification
try {
  await simplifyTariffsStructure();
} catch (error) {
  console.error('Script error:', error.message);
}
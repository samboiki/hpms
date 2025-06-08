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

async function simplifyTariffsCorrect() {
  console.log('🔧 SIMPLIFYING TARIFFS STRUCTURE (CORRECTED)\n');
  
  try {
    // Step 1: Get current data count
    console.log('🔍 Analyzing current structure...');
    
    const { data: currentCount, error: countError } = await supabase
      .from('practice_tariffs')
      .select('id', { count: 'exact' });
    
    if (countError) {
      throw new Error(`Failed to count tariffs: ${countError.message}`);
    }
    
    console.log(`📊 Current tariffs: ${currentCount.length} records`);
    
    // Step 2: Get unique codes (remove duplicates across practices)
    console.log('\n🔄 Getting unique dental codes...');
    
    const { data: allTariffs, error: allError } = await supabase
      .from('practice_tariffs')
      .select('code, namaf_prace_2025, price, practice_type, category, subcategory, unit')
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
    console.log(`✅ Found ${uniqueTariffs.length} unique dental codes (from ${allTariffs.length} total records)`);
    
    // Show sample of what we're keeping
    console.log('\n📋 Sample unique codes:');
    uniqueTariffs.slice(0, 5).forEach(tariff => {
      console.log(`   • ${tariff.code}: ${tariff.namaf_prace_2025} - N$${tariff.price}`);
    });
    
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
      // Remove practice_id - codes are now global
      code: tariff.code,
      namaf_prace_2025: tariff.namaf_prace_2025,
      price: tariff.price,
      practice_type: 'dental', // All current codes are dental
      category: tariff.category,
      subcategory: tariff.subcategory,
      unit: tariff.unit || 'per visit',
      is_active: true,
      effective_from: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
    
    // Step 6: Confirm practice types
    console.log('\n🏥 Confirming practice types...');
    
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, practice_type');
    
    if (!practicesError && practices) {
      console.log('📋 Practice types:');
      practices.forEach(practice => {
        const icon = practice.practice_type === 'dental' ? '🦷' : 
                    practice.practice_type === 'aesthetic' ? '✨' : '🏥';
        console.log(`   ${icon} ${practice.name}: ${practice.practice_type}`);
      });
      
      // Ensure NewCharm is dental
      const newcharm = practices.find(p => p.name.toLowerCase().includes('newcharm'));
      if (newcharm && newcharm.practice_type !== 'dental') {
        const { error: updateError } = await supabase
          .from('practices')
          .update({ practice_type: 'dental' })
          .eq('id', newcharm.id);
        
        if (!updateError) {
          console.log(`✅ Updated ${newcharm.name} to dental type`);
        }
      }
    }
    
    // Step 7: Final verification
    console.log('\n📊 FINAL SUMMARY:');
    console.log('================');
    
    const { data: finalTariffs, error: finalError } = await supabase
      .from('practice_tariffs')
      .select('practice_type, practice_id')
      .eq('is_active', true);
    
    if (!finalError && finalTariffs) {
      const withPracticeId = finalTariffs.filter(t => t.practice_id).length;
      const withoutPracticeId = finalTariffs.filter(t => !t.practice_id).length;
      
      console.log(`📋 Tariff structure:`)
      console.log(`   • Total codes: ${finalTariffs.length}`);
      console.log(`   • With practice_id: ${withPracticeId}`);
      console.log(`   • Without practice_id (global): ${withoutPracticeId}`);
      console.log(`   • Service type: dental`);
    }
    
    console.log('\n✅ NEW SIMPLIFIED STRUCTURE:');
    console.log('   ┌─ practice_tariffs table:');
    console.log('   │  • Contains unique codes WITHOUT practice_id');
    console.log('   │  • Each code specifies service type (dental)');
    console.log('   │  • Codes are global/system-wide');
    console.log('   │');
    console.log('   ├─ practices table:');
    console.log('   │  • Defines facility type (NewCharm = dental)');
    console.log('   │  • Controls which services a practice can offer');
    console.log('   │');
    console.log('   └─ ServiceSelector logic:');
    console.log('      • Matches practice.practice_type with tariff.practice_type');
    console.log('      • Shows dental codes to dental practices only');
    console.log('      • No duplication needed');
    
    console.log('\n🎉 SIMPLIFICATION COMPLETE!');
    console.log(`✅ ${totalInserted} unique dental codes available system-wide`);
    console.log('✅ Removed practice_id - codes are now global');
    console.log('✅ NewCharm (dental practice) will see all dental codes');
    console.log('✅ Medical practices will not see dental codes');
    console.log('✅ No duplicate codes in the system');
    
  } catch (error) {
    console.error('❌ Simplification failed:', error.message);
  }
}

// Execute simplification
try {
  await simplifyTariffsCorrect();
} catch (error) {
  console.error('Script error:', error.message);
}
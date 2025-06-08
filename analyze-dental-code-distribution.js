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

async function analyzeCodeDistribution() {
  console.log('📊 ANALYZING DENTAL CODE DISTRIBUTION\n');
  
  try {
    // Get all dental records with detailed info
    const { data: allRecords, error: recordsError } = await supabase
      .from('practice_tariffs')
      .select('id, code, practice_id, namaf_prace_2025, price, created_at')
      .eq('practice_type', 'dental')
      .or('code.like.8%,code.like.9%')
      .order('code, practice_id');
    
    if (recordsError) {
      throw new Error(`Failed to fetch records: ${recordsError.message}`);
    }
    
    console.log(`📋 Total dental records: ${allRecords.length}`);
    
    // Get practice information
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name');
    
    if (practicesError) {
      throw new Error(`Failed to fetch practices: ${practicesError.message}`);
    }
    
    const practiceMap = {};
    practices.forEach(p => {
      practiceMap[p.id] = p.name;
    });
    
    console.log(`🏥 Total practices: ${practices.length}`);
    
    // Analyze unique codes
    const uniqueCodes = new Set();
    const codeFrequency = {};
    const practiceCodeCount = {};
    
    allRecords.forEach(record => {
      uniqueCodes.add(record.code);
      
      // Count frequency of each code
      codeFrequency[record.code] = (codeFrequency[record.code] || 0) + 1;
      
      // Count codes per practice
      const practiceId = record.practice_id;
      if (!practiceCodeCount[practiceId]) {
        practiceCodeCount[practiceId] = 0;
      }
      practiceCodeCount[practiceId]++;
    });
    
    console.log(`🦷 Unique dental codes: ${uniqueCodes.size}`);
    console.log(`📊 Expected total if no duplicates: ${uniqueCodes.size} codes × ${practices.length} practices = ${uniqueCodes.size * practices.length}`);
    console.log(`📊 Actual total: ${allRecords.length}`);
    
    // Check for actual duplicates (same code, same practice)
    console.log('\n🔍 Checking for true duplicates (same code + same practice):');
    
    const combinations = {};
    const trueDuplicates = [];
    
    allRecords.forEach(record => {
      const key = `${record.code}-${record.practice_id}`;
      if (!combinations[key]) {
        combinations[key] = [];
      }
      combinations[key].push(record);
    });
    
    Object.entries(combinations).forEach(([key, records]) => {
      if (records.length > 1) {
        trueDuplicates.push({ key, records });
      }
    });
    
    if (trueDuplicates.length > 0) {
      console.log(`❌ Found ${trueDuplicates.length} true duplicate combinations:`);
      trueDuplicates.slice(0, 10).forEach(dup => {
        const [code, practiceId] = dup.key.split('-');
        const practiceName = practiceMap[practiceId] || 'Unknown';
        console.log(`   • Code ${code} in ${practiceName}: ${dup.records.length} copies`);
        dup.records.forEach(record => {
          console.log(`     - ID: ${record.id}, Created: ${record.created_at}`);
        });
      });
    } else {
      console.log('✅ No true duplicates found (same code + same practice)');
    }
    
    // Show code frequency analysis
    console.log('\n📊 Code frequency analysis:');
    const sortedCodes = Object.entries(codeFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    console.log('   Top 10 most frequent codes:');
    sortedCodes.forEach(([code, count]) => {
      const expectedCount = practices.length;
      const status = count === expectedCount ? '✅' : count > expectedCount ? '❌ OVER' : '⚠️ UNDER';
      console.log(`   ${status} ${code}: ${count} times (expected: ${expectedCount})`);
    });
    
    // Show practice distribution
    console.log('\n🏥 Codes per practice:');
    Object.entries(practiceCodeCount).forEach(([practiceId, count]) => {
      const practiceName = practiceMap[practiceId] || 'Unknown';
      const expectedCount = uniqueCodes.size;
      const status = count === expectedCount ? '✅' : count > expectedCount ? '❌ OVER' : '⚠️ UNDER';
      console.log(`   ${status} ${practiceName}: ${count} codes (expected: ${expectedCount})`);
    });
    
    // Identify the issue
    console.log('\n🔍 DIAGNOSIS:');
    
    if (allRecords.length === uniqueCodes.size * practices.length) {
      console.log('✅ Perfect distribution: Each code appears exactly once per practice');
    } else if (allRecords.length > uniqueCodes.size * practices.length) {
      console.log('❌ Over-distribution: Some codes appear multiple times per practice');
      console.log(`   Excess records: ${allRecords.length - (uniqueCodes.size * practices.length)}`);
    } else {
      console.log('⚠️ Under-distribution: Some practices missing some codes');
      console.log(`   Missing records: ${(uniqueCodes.size * practices.length) - allRecords.length}`);
    }
    
    // Show sample of actual data structure
    console.log('\n📋 Sample records (first 10):');
    allRecords.slice(0, 10).forEach(record => {
      const practiceName = practiceMap[record.practice_id] || 'Unknown';
      console.log(`   ${record.code}: ${record.namaf_prace_2025} | ${practiceName} | N$${record.price}`);
    });
    
    console.log('\n🎯 RECOMMENDATIONS:');
    
    if (trueDuplicates.length > 0) {
      console.log('1. Remove true duplicates (same code + same practice)');
      console.log('2. Keep only the oldest record for each duplicate set');
    }
    
    if (allRecords.length !== uniqueCodes.size * practices.length) {
      console.log('3. Ensure each unique code appears exactly once per practice');
      console.log('4. Consider re-importing with proper deduplication');
    }
    
    if (trueDuplicates.length === 0 && allRecords.length === uniqueCodes.size * practices.length) {
      console.log('✅ No action needed - data is correctly distributed');
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

// Execute analysis
try {
  await analyzeCodeDistribution();
} catch (error) {
  console.error('Script error:', error.message);
}
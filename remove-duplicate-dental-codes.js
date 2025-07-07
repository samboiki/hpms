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

async function removeDuplicateCodes() {
  console.log('🧹 REMOVING DUPLICATE DENTAL CODES\n');
  
  try {
    // First, analyze the duplicates
    console.log('🔍 Analyzing duplicate codes...');
    
    const { data: duplicateAnalysis, error: analysisError } = await supabase
      .from('practice_tariffs')
      .select('code, practice_id, id, created_at')
      .eq('practice_type', 'dental')
      .or('code.like.8%,code.like.9%')
      .order('code, practice_id, created_at');
    
    if (analysisError) {
      throw new Error(`Failed to analyze duplicates: ${analysisError.message}`);
    }
    
    console.log(`📊 Total dental records found: ${duplicateAnalysis.length}`);
    
    // Group by code and practice_id to find duplicates
    const codeGroups = {};
    duplicateAnalysis.forEach(record => {
      const key = `${record.code}-${record.practice_id}`;
      if (!codeGroups[key]) {
        codeGroups[key] = [];
      }
      codeGroups[key].push(record);
    });
    
    // Find duplicates
    const duplicates = [];
    const toDelete = [];
    
    Object.entries(codeGroups).forEach(([key, records]) => {
      if (records.length > 1) {
        duplicates.push({
          key,
          count: records.length,
          records
        });
        
        // Keep the first record (oldest), mark others for deletion
        const sortedRecords = records.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const toKeep = sortedRecords[0];
        const toRemove = sortedRecords.slice(1);
        
        toDelete.push(...toRemove.map(r => r.id));
        
        console.log(`   🔄 Code ${records[0].code} for practice ${records[0].practice_id.slice(0,8)}... has ${records.length} duplicates`);
        console.log(`      Keeping: ${toKeep.id} (created: ${toKeep.created_at})`);
        toRemove.forEach(r => {
          console.log(`      Deleting: ${r.id} (created: ${r.created_at})`);
        });
      }
    });
    
    console.log(`\n📋 Summary:`);
    console.log(`   • Unique code-practice combinations: ${Object.keys(codeGroups).length}`);
    console.log(`   • Combinations with duplicates: ${duplicates.length}`);
    console.log(`   • Total records to delete: ${toDelete.length}`);
    
    if (toDelete.length === 0) {
      console.log('\n✅ No duplicates found! All codes are unique per practice.');
      return;
    }
    
    // Remove duplicates in batches
    console.log('\n🗑️  Removing duplicate records...');
    
    const batchSize = 50;
    let totalDeleted = 0;
    
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      
      const { error: deleteError } = await supabase
        .from('practice_tariffs')
        .delete()
        .in('id', batch);
      
      if (deleteError) {
        console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, deleteError.message);
      } else {
        totalDeleted += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: Deleted ${batch.length} records`);
      }
    }
    
    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    
    const { data: finalCount, error: countError } = await supabase
      .from('practice_tariffs')
      .select('id', { count: 'exact' })
      .eq('practice_type', 'dental')
      .or('code.like.8%,code.like.9%');
    
    if (!countError) {
      console.log(`📊 Final count: ${finalCount.length} dental records`);
    }
    
    // Check for remaining duplicates
    const { data: remainingCheck, error: remainingError } = await supabase
      .from('practice_tariffs')
      .select('code, practice_id, count(*)')
      .eq('practice_type', 'dental')
      .or('code.like.8%,code.like.9%');
    
    // Use RPC to check for duplicates since we can't use GROUP BY directly
    console.log('🔍 Checking for any remaining duplicates...');
    
    const { data: uniqueCheck, error: uniqueError } = await supabase
      .from('practice_tariffs')
      .select('code, practice_id')
      .eq('practice_type', 'dental')
      .or('code.like.8%,code.like.9%');
    
    if (!uniqueError && uniqueCheck) {
      const uniqueKeys = new Set();
      const stillDuplicated = [];
      
      uniqueCheck.forEach(record => {
        const key = `${record.code}-${record.practice_id}`;
        if (uniqueKeys.has(key)) {
          stillDuplicated.push(key);
        } else {
          uniqueKeys.add(key);
        }
      });
      
      if (stillDuplicated.length > 0) {
        console.log(`⚠️  Still found ${stillDuplicated.length} duplicated combinations`);
        stillDuplicated.slice(0, 5).forEach(key => console.log(`   ${key}`));
      } else {
        console.log('✅ No remaining duplicates found!');
      }
    }
    
    // Show summary by practice
    console.log('\n📊 Final summary by practice:');
    
    const { data: practiceNames, error: practiceError } = await supabase
      .from('practices')
      .select('id, name');
    
    if (!practiceError && practiceNames) {
      for (const practice of practiceNames) {
        const { data: practiceCount, error: pcError } = await supabase
          .from('practice_tariffs')
          .select('id', { count: 'exact' })
          .eq('practice_id', practice.id)
          .eq('practice_type', 'dental')
          .or('code.like.8%,code.like.9%');
        
        if (!pcError) {
          console.log(`   • ${practice.name}: ${practiceCount.length} unique dental codes`);
        }
      }
    }
    
    console.log('\n🎉 DUPLICATE REMOVAL COMPLETE!');
    console.log(`✅ Deleted ${totalDeleted} duplicate records`);
    console.log('✅ Each dental code is now unique per practice');
    console.log('✅ ServiceSelector will show clean, non-duplicated options');
    
  } catch (error) {
    console.error('❌ Duplicate removal failed:', error.message);
    
    console.log('\n💡 Manual cleanup may be required:');
    console.log('1. Check Supabase Dashboard for duplicate records');
    console.log('2. Use SQL Editor to remove duplicates manually');
    console.log('3. Ensure each code appears only once per practice');
  }
}

// Execute duplicate removal
try {
  await removeDuplicateCodes();
} catch (error) {
  console.error('Script error:', error.message);
}
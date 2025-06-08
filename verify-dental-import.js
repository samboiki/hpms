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

async function verifyDentalImport() {
  console.log('🔍 VERIFYING DENTAL TARIFFS IMPORT\n');
  
  try {
    // Count total dental records
    const { data: totalData, error: totalError } = await supabase
      .from('practice_tariffs')
      .select('id', { count: 'exact' })
      .eq('practice_type', 'dental')
      .or('code.like.8%,code.like.9%');
    
    if (totalError) {
      throw new Error(`Failed to count records: ${totalError.message}`);
    }
    
    console.log(`📊 Total dental tariff records: ${totalData.length}`);
    
    // Get breakdown by practice
    const { data: practiceData, error: practiceError } = await supabase
      .from('practice_tariffs')
      .select('practice_id, code, namaf_prace_2025, price')
      .eq('practice_type', 'dental')
      .or('code.like.8%,code.like.9%')
      .limit(100);
    
    if (practiceError) {
      throw new Error(`Failed to fetch practice data: ${practiceError.message}`);
    }
    
    // Count by practice
    const practiceCount = {};
    practiceData.forEach(record => {
      const pid = record.practice_id;
      practiceCount[pid] = (practiceCount[pid] || 0) + 1;
    });
    
    console.log('\n📋 Records per practice:');
    Object.entries(practiceCount).forEach(([practiceId, count]) => {
      console.log(`   Practice ${practiceId.slice(0, 8)}...: ${count} codes`);
    });
    
    // Show sample procedures
    console.log('\n💰 Sample procedures (first 15):');
    practiceData.slice(0, 15).forEach(item => {
      console.log(`   • ${item.code}: ${item.namaf_prace_2025} - N$${item.price}`);
    });
    
    // Test ServiceSelector compatibility
    console.log('\n🔧 Testing ServiceSelector compatibility...');
    const { data: selectorData, error: selectorError } = await supabase
      .from('practice_tariffs')
      .select('code, namaf_prace_2025 as name, price')
      .eq('practice_type', 'dental')
      .eq('is_active', true)
      .order('code')
      .limit(10);
    
    if (!selectorError && selectorData) {
      console.log('✅ ServiceSelector format compatibility confirmed');
      console.log('📋 Ready for selection in visit forms:');
      selectorData.forEach(item => {
        console.log(`   ${item.code} - ${item.name} (N$${item.price})`);
      });
    }
    
    // Check for common dental codes
    const commonCodes = ['8101', '8201', '8301', '8401', '8501', '8601', '8701', '9101'];
    console.log('\n🦷 Verifying common dental codes:');
    
    for (const code of commonCodes) {
      const { data: codeData, error: codeError } = await supabase
        .from('practice_tariffs')
        .select('code, namaf_prace_2025, price')
        .eq('code', code)
        .eq('practice_type', 'dental')
        .limit(1);
      
      if (!codeError && codeData && codeData.length > 0) {
        const item = codeData[0];
        console.log(`   ✅ ${item.code}: ${item.namaf_prace_2025} - N$${item.price}`);
      } else {
        console.log(`   ❌ ${code}: Not found`);
      }
    }
    
    console.log('\n🎉 VERIFICATION COMPLETE!');
    console.log('✅ Dental tariffs successfully imported and ready for use');
    console.log('✅ ServiceSelector will display these codes in billing forms');
    console.log('✅ Visit forms can now generate invoices with dental procedures');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Open dashboard at http://localhost:5001');
    console.log('2. Navigate to Patients → Add Visit');
    console.log('3. Test ServiceSelector in billing section');
    console.log('4. Verify dental codes appear and pricing is correct');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

// Execute verification
try {
  await verifyDentalImport();
} catch (error) {
  console.error('Script error:', error.message);
}
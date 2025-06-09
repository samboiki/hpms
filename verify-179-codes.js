import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function verify179Codes() {
  try {
    console.log('🔍 Verifying all 179 dental codes...\n');

    // Get all dental codes starting with 8
    const { data: allCodes, error } = await supabase
      .from('practice_tariffs')
      .select('*')
      .like('code', '8%')
      .order('code');

    if (error) {
      console.error('❌ Error fetching codes:', error);
      return;
    }

    console.log(`📊 Total dental codes found: ${allCodes.length}`);

    // Verify specific codes from your list
    const expectedCodes = [
      '8101', '8102', '8104', '8106', '8107', '8108', '8109', '8110',
      '8113', '8114', '8115', '8117', '8119', '8121', '8129', '8131'
    ];

    console.log('\n🔍 Checking first 16 expected codes:');
    expectedCodes.forEach(code => {
      const found = allCodes.find(c => c.code === code);
      console.log(`${code}: ${found ? '✅ Found' : '❌ Missing'}`);
    });

    // Show range statistics
    const codeNumbers = allCodes.map(c => parseInt(c.code));
    const minCode = Math.min(...codeNumbers);
    const maxCode = Math.max(...codeNumbers);
    
    console.log('\n📋 CODE RANGE:');
    console.log(`Min code: ${minCode}`);
    console.log(`Max code: ${maxCode}`);

    // Check data completeness
    let completeRecords = 0;
    allCodes.forEach(code => {
      if (code.description && code.price && code.official_2025_price_nad) {
        completeRecords++;
      }
    });

    console.log('\n📊 DATA QUALITY:');
    console.log(`Complete records: ${completeRecords}/${allCodes.length}`);
    console.log(`Completion rate: ${((completeRecords/allCodes.length) * 100).toFixed(1)}%`);

    // Show multiplied vs fixed codes
    const multipliedCodes = allCodes.filter(c => c.can_be_multiplied === 'YES');
    const fixedCodes = allCodes.filter(c => c.can_be_multiplied === 'NO');
    
    console.log('\n🔢 MULTIPLICATION RULES:');
    console.log(`Can be multiplied: ${multipliedCodes.length}`);
    console.log(`Fixed price: ${fixedCodes.length}`);

    // Show codes requiring tooth numbers
    const toothNumberCodes = allCodes.filter(c => c.requires_tooth_number === 'YES');
    console.log(`Require tooth number: ${toothNumberCodes.length}`);

    if (allCodes.length === 179) {
      console.log('\n🎉 SUCCESS! All 179 dental codes are correctly imported!');
    } else {
      console.log(`\n⚠️  Expected 179 codes but found ${allCodes.length}`);
    }

  } catch (error) {
    console.error('💥 Verification failed:', error);
  }
}

verify179Codes();
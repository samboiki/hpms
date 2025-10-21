import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

console.log('🔍 DEBUGGING WARDS QUERY\n');

async function checkWardsDetailed() {
  // First, let's get ALL wards without any filters
  console.log('1️⃣  ALL WARDS IN DATABASE:');
  console.log('='.repeat(80));
  const { data: allWards, error: e1 } = await supabase
    .from('wards')
    .select('*')
    .order('created_at', { ascending: false });

  if (e1) {
    console.error('Error:', e1);
  } else {
    console.log(`Total wards: ${allWards?.length || 0}`);
    if (allWards && allWards.length > 0) {
      console.table(allWards.map(w => ({
        id: w.id.substring(0, 8),
        ward_name: w.ward_name,
        ward_type: w.ward_type,
        practice_id: w.practice_id?.substring(0, 8) || 'NULL',
        is_active: w.is_active,
        total_beds: w.total_beds,
        occupied_beds: w.occupied_beds
      })));
    }
  }

  // Now filter by practice_id
  console.log('\n\n2️⃣  WARDS FOR SPECIFIC PRACTICE:');
  console.log('='.repeat(80));
  console.log(`Practice ID: ${practiceId}\n`);

  const { data: practiceWards, error: e2 } = await supabase
    .from('wards')
    .select('*')
    .eq('practice_id', practiceId);

  if (e2) {
    console.error('Error:', e2);
  } else {
    console.log(`Practice wards: ${practiceWards?.length || 0}`);
    if (practiceWards && practiceWards.length > 0) {
      console.table(practiceWards.map(w => ({
        id: w.id.substring(0, 8),
        ward_name: w.ward_name,
        ward_type: w.ward_type,
        practice_id: w.practice_id?.substring(0, 8),
        is_active: w.is_active,
        total_beds: w.total_beds,
        occupied_beds: w.occupied_beds
      })));
    } else {
      console.log('⚠️  No wards found - this is the issue!');
    }
  }

  // Let's check with select specific columns
  console.log('\n\n3️⃣  TRYING WITH SPECIFIC COLUMN SELECTION:');
  console.log('='.repeat(80));

  const { data: wardsWithCols, error: e3 } = await supabase
    .from('wards')
    .select('id, ward_name, ward_type, practice_id, is_active, total_beds, occupied_beds')
    .eq('practice_id', practiceId);

  if (e3) {
    console.error('Error:', e3);
  } else {
    console.log(`Wards found: ${wardsWithCols?.length || 0}`);
    if (wardsWithCols && wardsWithCols.length > 0) {
      console.table(wardsWithCols);
    } else {
      console.log('⚠️  Still no wards found!');
    }
  }

  // Check if it's a select(*) issue
  console.log('\n\n4️⃣  TRYING WITH SELECT(*):');
  console.log('='.repeat(80));

  const { data: wardsAll, error: e4 } = await supabase
    .from('wards')
    .select('*')
    .eq('practice_id', practiceId)
    .limit(10);

  if (e4) {
    console.error('Error:', e4);
  } else {
    console.log(`Wards found: ${wardsAll?.length || 0}`);
    if (wardsAll && wardsAll.length > 0) {
      console.log('\n✅ SUCCESS! Here are the wards:');
      console.table(wardsAll);
    } else {
      console.log('⚠️  No wards with select(*)');
    }
  }
}

checkWardsDetailed().catch(console.error);

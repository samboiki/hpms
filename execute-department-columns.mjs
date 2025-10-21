import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addDepartmentColumns() {
  try {
    console.log('🔍 Checking departments table structure...\n');

    // Check current departments to see what columns exist
    const { data: departments, error: fetchError } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (fetchError) {
      console.error('❌ Error fetching departments:', fetchError.message);
      return;
    }

    if (departments && departments.length > 0) {
      const dept = departments[0];
      const hasContactEmail = 'contact_email' in dept;
      const hasContactPhone = 'contact_phone' in dept;
      const hasDescription = 'description' in dept;

      console.log('📊 Current departments table columns:');
      console.log('-------------------------------------------');
      console.log('✅ Core columns present:');
      console.log('  - id:', 'id' in dept ? '✅' : '❌');
      console.log('  - name:', 'name' in dept ? '✅' : '❌');
      console.log('  - code:', 'code' in dept ? '✅' : '❌');
      console.log('  - practice_id:', 'practice_id' in dept ? '✅' : '❌');
      console.log('  - head_user_id:', 'head_user_id' in dept ? '✅' : '❌');
      console.log('  - color:', 'color' in dept ? '✅' : '❌');
      console.log('  - is_active:', 'is_active' in dept ? '✅' : '❌');

      console.log('\n📋 Fields we need to check:');
      console.log('  - description:', hasDescription ? '✅ EXISTS' : '❌ MISSING');
      console.log('  - contact_email:', hasContactEmail ? '✅ EXISTS' : '❌ MISSING');
      console.log('  - contact_phone:', hasContactPhone ? '✅ EXISTS' : '❌ MISSING');

      if (!hasContactEmail || !hasContactPhone) {
        console.log('\n⚠️  MISSING COLUMNS DETECTED!');
        console.log('The contact_email and/or contact_phone columns need to be added.');
        console.log('\n📋 Please run this SQL in your Supabase Dashboard:');
        console.log('-------------------------------------------');
        console.log('ALTER TABLE departments');
        console.log('ADD COLUMN IF NOT EXISTS contact_email TEXT,');
        console.log('ADD COLUMN IF NOT EXISTS contact_phone TEXT;');
        console.log('-------------------------------------------');
        console.log('\n🔗 Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql');
        console.log('    1. Click on "SQL Editor" in the sidebar');
        console.log('    2. Paste the SQL above');
        console.log('    3. Click "Run" to execute');
      } else {
        console.log('\n✅ ALL COLUMNS ARE PRESENT!');
        console.log('The departments table has all required columns.');
      }

      console.log('\n📝 Sample department data:');
      console.log('-------------------------------------------');
      console.log('Name:', dept.name || 'Not set');
      console.log('Code:', dept.code || 'Not set');
      console.log('Description:', dept.description || 'Not set');
      console.log('Contact Email:', dept.contact_email || 'Not set');
      console.log('Contact Phone:', dept.contact_phone || 'Not set');
    } else {
      console.log('⚠️  No departments found in the database');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

console.log('🚀 Checking Supabase Departments Table Structure');
console.log('================================================\n');
addDepartmentColumns();
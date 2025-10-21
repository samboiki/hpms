const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTY5OTI5NDcsImV4cCI6MjAzMjU2ODk0N30.ctHCMNs-t4XKy4RqDePTGfo5wDpLrw-ke2BI2lgqGck';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addDepartmentColumns() {
  try {
    // Try to update a department with the new columns to test if they exist
    const testDepartment = {
      contact_email: 'test@example.com',
      contact_phone: '+1234567890'
    };

    const { data, error } = await supabase
      .from('departments')
      .update(testDepartment)
      .eq('id', 'non-existent-id-for-testing')
      .select();

    if (error) {
      if (error.message.includes('column') && (error.message.includes('contact_email') || error.message.includes('contact_phone'))) {
        console.log('❌ Contact columns do not exist in the departments table');
        console.log('⚠️  The columns need to be added via Supabase Dashboard SQL Editor');
        console.log('\n📋 Please run this SQL in your Supabase Dashboard:');
        console.log('-------------------------------------------');
        console.log('ALTER TABLE departments');
        console.log('ADD COLUMN IF NOT EXISTS contact_email TEXT,');
        console.log('ADD COLUMN IF NOT EXISTS contact_phone TEXT;');
        console.log('-------------------------------------------');
        console.log('\n🔗 Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql');
      } else {
        console.log('✅ Columns might already exist or other error:', error.message);
      }
    } else {
      console.log('✅ Contact columns appear to be working in the departments table');
    }

    // Check current departments
    const { data: departments, error: fetchError } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (departments && departments.length > 0) {
      console.log('\n📊 Sample department record:');
      const dept = departments[0];
      console.log('- Has contact_email field:', 'contact_email' in dept ? '✅' : '❌');
      console.log('- Has contact_phone field:', 'contact_phone' in dept ? '✅' : '❌');
      console.log('- Has description field:', 'description' in dept ? '✅' : '❌');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

addDepartmentColumns();
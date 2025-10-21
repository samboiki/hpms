import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testDepartmentUpdate() {
  console.log('🧪 Testing department update operations...');

  try {
    // First, get a department to test with
    console.log('1. Getting existing department...');
    const { data: departments, error: fetchError } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (fetchError) {
      console.log('❌ Error fetching departments:', fetchError);
      return;
    }

    if (!departments || departments.length === 0) {
      console.log('⚠️  No departments found to test with');
      return;
    }

    const testDept = departments[0];
    console.log('✅ Found test department:', testDept.name, 'ID:', testDept.id);

    // Try different update operations to see what fails
    console.log('\n2. Testing different update operations...');

    // Test 1: Simple name update
    console.log('Test 1: Simple name update...');
    const { data: updateData1, error: updateError1 } = await supabase
      .from('departments')
      .update({ name: testDept.name + ' (test)' })
      .eq('id', testDept.id)
      .select();

    if (updateError1) {
      console.log('❌ Update Error 1:', updateError1);
    } else {
      console.log('✅ Update 1 successful');

      // Revert the change
      await supabase
        .from('departments')
        .update({ name: testDept.name })
        .eq('id', testDept.id);
    }

    // Test 2: Description update
    console.log('\nTest 2: Description update...');
    const { data: updateData2, error: updateError2 } = await supabase
      .from('departments')
      .update({ description: 'Test description update' })
      .eq('id', testDept.id)
      .select();

    if (updateError2) {
      console.log('❌ Update Error 2:', updateError2);
    } else {
      console.log('✅ Update 2 successful');

      // Revert the change
      await supabase
        .from('departments')
        .update({ description: testDept.description })
        .eq('id', testDept.id);
    }

    // Test 3: Multiple field update
    console.log('\nTest 3: Multiple field update...');
    const { data: updateData3, error: updateError3 } = await supabase
      .from('departments')
      .update({
        name: testDept.name + ' (multi-test)',
        description: 'Multi-field test update',
        updated_at: new Date().toISOString()
      })
      .eq('id', testDept.id)
      .select();

    if (updateError3) {
      console.log('❌ Update Error 3:', updateError3);
    } else {
      console.log('✅ Update 3 successful');

      // Revert the changes
      await supabase
        .from('departments')
        .update({
          name: testDept.name,
          description: testDept.description
        })
        .eq('id', testDept.id);
    }

    // Test 4: Check RLS policies by trying with regular user token
    console.log('\n3. Testing RLS policies...');

    // Create a regular client to test RLS
    const regularClient = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.0YHZfS6dTgTSIVPk1VN4FJ41qz7aCRt7gfCRc6zAT4c');

    const { data: anonData, error: anonError } = await regularClient
      .from('departments')
      .select('*')
      .limit(1);

    if (anonError) {
      console.log('❌ Anonymous access error:', anonError.message);
    } else {
      console.log('✅ Anonymous access successful');
    }

  } catch (error) {
    console.log('❌ Unexpected error:', error);
  }
}

testDepartmentUpdate().catch(console.error);
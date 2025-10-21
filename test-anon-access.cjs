const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, anonKey);

async function testAnonAccess() {
  try {
    console.log('🔍 Testing anonymous access to practice_settings...\n');

    // Try to read from practice_settings
    const { data, error } = await supabase
      .from('practice_settings')
      .select('*')
      .limit(5);

    if (error) {
      console.log('❌ Error accessing practice_settings:', error.message);
      console.log('Full error:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ Successfully accessed practice_settings!');
      console.log(`Found ${data?.length || 0} records`);
      if (data && data.length > 0) {
        console.log('Sample data:', JSON.stringify(data[0], null, 2));
      }
    }

    console.log('\n🔍 Testing anonymous access to practices table...\n');

    // Try to read from practices
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, practice_name, created_at')
      .limit(3);

    if (practicesError) {
      console.log('❌ Error accessing practices:', practicesError.message);
    } else {
      console.log('✅ Successfully accessed practices table!');
      console.log(`Found ${practices?.length || 0} records`);
      if (practices && practices.length > 0) {
        console.log('Sample practices:', JSON.stringify(practices, null, 2));
      }
    }

    console.log('\n🔍 Testing anonymous INSERT to practice_settings...\n');

    // Try to insert a test record
    const testPracticeId = '00000000-0000-0000-0000-000000000000';
    const { data: insertData, error: insertError } = await supabase
      .from('practice_settings')
      .insert({
        practice_id: testPracticeId,
        setting_key: 'test_key',
        setting_value: 'test_value'
      })
      .select();

    if (insertError) {
      console.log('❌ Insert failed (expected if practice_id doesn\'t exist):', insertError.message);
    } else {
      console.log('✅ Successfully inserted to practice_settings!');
      console.log('Inserted data:', JSON.stringify(insertData, null, 2));

      // Clean up
      if (insertData && insertData[0]?.id) {
        await supabase
          .from('practice_settings')
          .delete()
          .eq('id', insertData[0].id);
        console.log('✅ Test record cleaned up');
      }
    }

    console.log('\n✅ Anonymous access testing completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error);
  }
}

testAnonAccess();
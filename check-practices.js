import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function checkPractices() {
  console.log('🔍 Checking practices in database...\n');

  // Check practices table
  const { data: practices, error: practicesError } = await supabase
    .from('practices')
    .select('*')
    .order('name');

  console.log('📊 Practices query result:');
  console.log('Error:', practicesError);
  console.log('Data count:', practices?.length || 0);
  
  if (practices && practices.length > 0) {
    console.log('\n✅ Found practices:');
    practices.forEach((practice, index) => {
      console.log(`${index + 1}. ${practice.name} (${practice.id})`);
      console.log(`   Status: ${practice.status || 'unknown'}`);
      console.log(`   City: ${practice.city || 'unknown'}`);
      console.log(`   Email: ${practice.contact_email || 'unknown'}`);
      console.log('');
    });
  } else {
    console.log('❌ No practices found in database');
  }

  // Check the view that the admin dashboard is trying to use
  console.log('🔍 Checking admin_practice_overview view...');
  const { data: overviewData, error: overviewError } = await supabase
    .from('admin_practice_overview')
    .select('*')
    .order('name');

  console.log('📊 admin_practice_overview result:');
  console.log('Error:', overviewError);
  console.log('Data count:', overviewData?.length || 0);

  if (overviewError) {
    console.log('\n❌ admin_practice_overview view might not exist. Let\'s check available tables/views...');
    
    // Check what views exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .ilike('table_name', '%practice%');

    console.log('📊 Practice-related tables/views:');
    console.log('Error:', tablesError);
    if (tables) {
      tables.forEach(table => {
        console.log(`- ${table.table_name} (${table.table_type})`);
      });
    }
  }

  // Check practice_performance_dashboard view
  console.log('\n🔍 Checking practice_performance_dashboard view...');
  const { data: performanceData, error: performanceError } = await supabase
    .from('practice_performance_dashboard')
    .select('*')
    .limit(5);

  console.log('📊 practice_performance_dashboard result:');
  console.log('Error:', performanceError);
  console.log('Data count:', performanceData?.length || 0);
}

checkPractices().catch(console.error);
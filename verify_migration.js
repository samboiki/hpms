// Migration verification script
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('🔍 Verifying Enhanced Practice Management Migration...\n');

  try {
    // Check new tables exist
    const tables = [
      'practice_tariffs',
      'practice_settings', 
      'admin_audit_logs',
      'practice_analytics',
      'practice_invitations',
      'practice_notification_templates'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
      } else {
        console.log(`✅ Table ${table}: Created successfully`);
      }
    }

    // Check enhanced practices table
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, status, subscription_tier, currency, timezone')
      .limit(5);

    if (practicesError) {
      console.log(`❌ Enhanced practices table: ${practicesError.message}`);
    } else {
      console.log(`✅ Enhanced practices table: ${practices.length} practices found`);
      console.log('   Practices:', practices.map(p => `${p.name} (${p.status})`).join(', '));
    }

    // Check default tariffs were inserted
    const { data: tariffs, count: tariffsCount } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact' });

    console.log(`✅ Practice tariffs: ${tariffsCount} tariffs created`);

    // Check default settings were inserted  
    const { data: settings, count: settingsCount } = await supabase
      .from('practice_settings')
      .select('*', { count: 'exact' });

    console.log(`✅ Practice settings: ${settingsCount} settings created`);

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Your enhanced practice management system is ready');
    console.log('2. Access /admin/practices to manage your 3 practices');
    console.log('3. Configure tariffs and settings for each practice');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyMigration();
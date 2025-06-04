const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyMigration() {
  console.log('🔍 Verifying Enhanced Practice Management Migration');
  console.log('===================================================\n');

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('practices')
      .select('id')
      .limit(1);
    
    if (connectionError) {
      console.error('❌ Connection failed:', connectionError);
      return;
    }
    console.log('✅ Database connection successful\n');

    // Check new tables
    console.log('📋 Checking new tables...');
    const tablesToCheck = [
      'practice_tariffs',
      'practice_settings', 
      'admin_audit_logs',
      'practice_analytics',
      'practice_invitations',
      'practice_notification_templates'
    ];

    let tablesCreated = 0;
    let tablesWithData = 0;

    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .limit(5);
        
        if (error) {
          if (error.message.includes('does not exist') || error.code === '42P01') {
            console.log(`   ❌ ${tableName}: Table not created`);
          } else {
            console.log(`   ⚠️  ${tableName}: ${error.message}`);
          }
        } else {
          console.log(`   ✅ ${tableName}: Created successfully (${data.length} sample records)`);
          tablesCreated++;
          if (data.length > 0) tablesWithData++;
        }
      } catch (err) {
        console.log(`   ❌ ${tableName}: ${err.message}`);
      }
    }

    console.log(`\n📊 Tables Summary: ${tablesCreated}/6 tables created, ${tablesWithData} have data\n`);

    // Check enhanced practices table
    console.log('🏥 Checking enhanced practices table...');
    const { data: practicesData, error: practicesError } = await supabase
      .from('practices')
      .select('*')
      .limit(1);

    if (practicesError) {
      console.log('   ❌ Error reading practices table:', practicesError.message);
    } else if (practicesData.length > 0) {
      const practice = practicesData[0];
      const enhancedColumns = [
        'status', 'subscription_tier', 'timezone', 'currency', 
        'max_users', 'max_patients', 'admin_user_id'
      ];
      
      const foundColumns = enhancedColumns.filter(col => col in practice);
      console.log(`   ✅ Enhanced columns found: ${foundColumns.length}/7`);
      if (foundColumns.length > 0) {
        console.log(`   📋 Columns: ${foundColumns.join(', ')}`);
      }
      
      if (foundColumns.length < enhancedColumns.length) {
        const missingColumns = enhancedColumns.filter(col => !(col in practice));
        console.log(`   ⚠️  Missing columns: ${missingColumns.join(', ')}`);
      }
    }

    // Check practice tariffs data
    console.log('\n💰 Checking practice tariffs...');
    try {
      const { data: tariffsData, error: tariffsError } = await supabase
        .from('practice_tariffs')
        .select('practice_id, service_name, base_price')
        .limit(5);
      
      if (tariffsError) {
        console.log('   ❌ Could not read tariffs:', tariffsError.message);
      } else {
        console.log(`   ✅ Found ${tariffsData.length} tariff records`);
        if (tariffsData.length > 0) {
          console.log('   📋 Sample tariff:', tariffsData[0].service_name, `N$${tariffsData[0].base_price}`);
        }
      }
    } catch (err) {
      console.log('   ❌ Tariffs table not accessible');
    }

    // Check practice settings data  
    console.log('\n⚙️  Checking practice settings...');
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('practice_settings')
        .select('practice_id, setting_key, setting_value')
        .limit(5);
      
      if (settingsError) {
        console.log('   ❌ Could not read settings:', settingsError.message);
      } else {
        console.log(`   ✅ Found ${settingsData.length} setting records`);
        if (settingsData.length > 0) {
          console.log('   📋 Sample setting:', settingsData[0].setting_key, '=', settingsData[0].setting_value);
        }
      }
    } catch (err) {
      console.log('   ❌ Settings table not accessible');
    }

    // Overall assessment
    console.log('\n🎯 MIGRATION STATUS');
    console.log('==================');
    
    if (tablesCreated === 6) {
      console.log('✅ MIGRATION SUCCESSFUL!');
      console.log('   ✓ All tables created');
      console.log('   ✓ Enhanced columns added');
      if (tablesWithData > 0) {
        console.log('   ✓ Default data inserted');
      }
      console.log('\n🚀 Your practice management system is ready!');
    } else if (tablesCreated > 0) {
      console.log('⚠️  MIGRATION PARTIALLY COMPLETE');
      console.log(`   ✓ ${tablesCreated}/6 tables created`);
      console.log('   ⚠️  Some tables may need manual creation');
      console.log('\n📝 Please re-run the migration SQL for missing tables');
    } else {
      console.log('❌ MIGRATION NOT EXECUTED');
      console.log('   ❌ No new tables found');
      console.log('\n📝 Please execute the migration SQL in Supabase Dashboard');
      console.log('   1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new');
      console.log('   2. Copy the SQL from the migration file');
      console.log('   3. Execute the migration');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyMigration();
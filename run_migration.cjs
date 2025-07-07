const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql) {
  console.log(`   📝 ${sql.substring(0, 80)}${sql.length > 80 ? '...' : ''}`);
  
  try {
    // Try to execute via API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      console.log('   ✅ Executed successfully');
      return true;
    } else {
      console.log('   ⚠️  Response not OK, may need manual execution');
      return false;
    }
  } catch (error) {
    console.log('   ⚠️  Error (may need manual execution):', error.message);
    return false;
  }
}

async function executeMigration() {
  console.log('🚀 Starting Enhanced Practice Management Migration');
  console.log('=================================================\n');

  try {
    // Test connection
    console.log('🔍 Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('practices')
      .select('id, name')
      .limit(1);
    
    if (testError) {
      console.error('❌ Connection test failed:', testError);
      process.exit(1);
    }
    
    console.log(`✅ Connected! Found ${testData?.length || 0} practice(s)`);
    if (testData?.length > 0) {
      console.log(`   📋 Example practice: ${testData[0].name || 'Unnamed'}`);
    }
    console.log('');

    // Since direct DDL execution via API may be limited, let's provide instructions
    console.log('📋 MIGRATION EXECUTION PLAN');
    console.log('============================\n');

    console.log('Due to security restrictions, DDL operations (CREATE TABLE, ALTER TABLE)');
    console.log('typically need to be executed directly in Supabase. Here are your options:\n');

    console.log('🎯 RECOMMENDED APPROACH:');
    console.log('1. Copy the SQL from the migration file');
    console.log('2. Go to Supabase Dashboard → SQL Editor');
    console.log('3. Paste and execute the SQL directly');
    console.log('4. Or use the Supabase CLI\n');

    console.log('📂 Migration file location:');
    console.log('   /home/happy/projects/hpms/supabase/migrations/20250604000000_enhanced_practice_management.sql\n');

    // Let's at least verify we can read existing data
    console.log('🔍 CURRENT DATABASE STATE');
    console.log('=========================\n');

    // Check practices table structure
    console.log('📊 Checking practices table...');
    const { data: practicesData, error: practicesError } = await supabase
      .from('practices')
      .select('*')
      .limit(3);

    if (practicesError) {
      console.log('   ❌ Error reading practices:', practicesError.message);
    } else {
      console.log(`   ✅ Found ${practicesData.length} practice(s)`);
      if (practicesData.length > 0) {
        const firstPractice = practicesData[0];
        console.log('   📋 Sample practice columns:', Object.keys(firstPractice).join(', '));
        
        // Check if new columns exist
        const newColumns = ['status', 'subscription_tier', 'timezone', 'currency'];
        const existingNewColumns = newColumns.filter(col => col in firstPractice);
        
        if (existingNewColumns.length > 0) {
          console.log(`   ✅ Found existing enhanced columns: ${existingNewColumns.join(', ')}`);
        } else {
          console.log('   📝 Enhanced columns not yet added');
        }
      }
    }

    // Check if new tables might already exist
    console.log('\n📊 Checking for enhanced tables...');
    const tablesToCheck = [
      'practice_tariffs',
      'practice_settings', 
      'admin_audit_logs',
      'practice_analytics',
      'practice_invitations',
      'practice_notification_templates'
    ];

    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (error) {
          if (error.message.includes('does not exist') || error.code === '42P01') {
            console.log(`   📝 ${tableName}: Not yet created`);
          } else {
            console.log(`   ❓ ${tableName}: ${error.message}`);
          }
        } else {
          console.log(`   ✅ ${tableName}: Already exists!`);
        }
      } catch (err) {
        console.log(`   ❓ ${tableName}: Unable to check (${err.message})`);
      }
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('==============');
    console.log('1. Open Supabase Dashboard (https://supabase.com/dashboard)');
    console.log('2. Navigate to your project: jjxlfunlbyayxwvlpgwt');
    console.log('3. Go to SQL Editor');
    console.log('4. Create a new query');
    console.log('5. Copy and paste the entire migration file content');
    console.log('6. Execute the SQL');
    console.log('7. Verify the tables were created successfully\n');

    console.log('💡 Alternative: Use Supabase CLI');
    console.log('   npx supabase db push --local=false\n');

    console.log('✅ Migration analysis complete!');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

executeMigration();
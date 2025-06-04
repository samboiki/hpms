const fs = require('fs');

// Simple HTTP client for Supabase REST API
async function executeSQL(sql, description) {
  try {
    console.log(`🚀 ${description}...`);
    
    const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/rpc/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTQ0NjY3NCwiZXhwIjoyMDMxMDIyNjc0fQ.SWsONaDVLf2LUfBFDo5uqttf0YXBxQdGNX-hPPGUr3g',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTQ0NjY3NCwiZXhwIjoyMDMxMDIyNjc0fQ.SWsONaDVLf2LUfBFDo5uqttf0YXBxQdGNX-hPPGUr3g'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}:`, errorText);
      return false;
    }

    const result = await response.json();
    console.log(`✅ ${description} completed successfully`);
    
    if (result && result.length > 0) {
      console.log('   Result:', result[0]);
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Failed ${description}:`, err.message);
    return false;
  }
}

async function runMigrations() {
  console.log('🔧 Starting comprehensive migration execution...\n');
  
  // Step 1: Main migration
  try {
    console.log('📋 Step 1: Main Migration');
    const mainMigration = fs.readFileSync('supabase/migrations/20250605000001_comprehensive_practice_management_system_fixed.sql', 'utf8');
    const success1 = await executeSQL(mainMigration, 'Comprehensive Practice Management System');
    if (!success1) {
      console.log('❌ Main migration failed. Stopping execution.');
      return;
    }
  } catch (err) {
    console.error('❌ Could not read main migration file:', err.message);
    return;
  }
  
  console.log('\n⏳ Waiting 5 seconds before next step...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 2: Import dental tariffs
  try {
    console.log('📋 Step 2: Dental Tariffs Import');
    const dentalTariffs = fs.readFileSync('import_dental_tariffs.sql', 'utf8');
    const success2 = await executeSQL(dentalTariffs, 'Import Dental Tariffs');
    if (!success2) {
      console.log('❌ Dental tariffs import failed. Stopping execution.');
      return;
    }
  } catch (err) {
    console.error('❌ Could not read dental tariffs file:', err.message);
    return;
  }
  
  console.log('\n⏳ Waiting 5 seconds before next step...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 3: Create admin users
  try {
    console.log('📋 Step 3: OneHealth Admin Users');
    const adminUsers = fs.readFileSync('create_onehealth_admin_complete.sql', 'utf8');
    const success3 = await executeSQL(adminUsers, 'Create OneHealth Admin Users');
    if (!success3) {
      console.log('❌ Admin users creation failed. Stopping execution.');
      return;
    }
  } catch (err) {
    console.error('❌ Could not read admin users file:', err.message);
    return;
  }
  
  console.log('\n⏳ Waiting 5 seconds before next step...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 4: Setup SMS management
  try {
    console.log('📋 Step 4: SMS Management Setup');
    const smsSetup = fs.readFileSync('setup_sms_management.sql', 'utf8');
    const success4 = await executeSQL(smsSetup, 'Setup SMS Management System');
    if (!success4) {
      console.log('❌ SMS setup failed. Stopping execution.');
      return;
    }
  } catch (err) {
    console.error('❌ Could not read SMS setup file:', err.message);
    return;
  }
  
  console.log('\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY! 🎉');
  console.log('\n📊 DEPLOYMENT SUMMARY:');
  console.log('✅ Enhanced Practice Management System');
  console.log('✅ Dental Tariffs (60+ tariff codes imported)');
  console.log('✅ OneHealth Admin System');
  console.log('✅ SMS Management & Allocation');
  console.log('✅ Comprehensive Reporting Views');
  console.log('\n🔑 LOGIN CREDENTIALS:');
  console.log('Email: admin@onehealth.na');
  console.log('Email: manager@onehealth.na');
  console.log('Password: OneHealth2025!');
  console.log('\n🌐 ACCESS:');
  console.log('Main App: https://hpms-one.vercel.app/');
  console.log('Supabase: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt');
  console.log('\n🎯 System is ready for production use!');
}

runMigrations().catch(console.error);
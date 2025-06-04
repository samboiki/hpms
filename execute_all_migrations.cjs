const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTQ0NjY3NCwiZXhwIjoyMDMxMDIyNjc0fQ.SWsONaDVLf2LUfBFDo5uqttf0YXBxQdGNX-hPPGUr3g'
);

async function executeSQL(sql, description) {
  try {
    console.log(`🚀 ${description}...`);
    
    // Split SQL into statements and execute them
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length === 0) continue;
      
      console.log(`   Executing statement ${i + 1}/${statements.length}...`);
      
      const { data, error } = await supabase.rpc('query', { 
        query: statement + ';'
      });
      
      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error);
        return false;
      }
    }
    
    console.log(`✅ ${description} completed successfully`);
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
    const mainMigration = fs.readFileSync('supabase/migrations/20250605000001_comprehensive_practice_management_system_fixed.sql', 'utf8');
    const success1 = await executeSQL(mainMigration, 'Main Migration - Comprehensive Practice Management System');
    if (!success1) return;
  } catch (err) {
    console.error('❌ Could not read main migration file:', err.message);
    return;
  }
  
  console.log('\n⏳ Waiting 3 seconds before next step...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 2: Import dental tariffs
  try {
    const dentalTariffs = fs.readFileSync('import_dental_tariffs.sql', 'utf8');
    const success2 = await executeSQL(dentalTariffs, 'Import Dental Tariffs');
    if (!success2) return;
  } catch (err) {
    console.error('❌ Could not read dental tariffs file:', err.message);
    return;
  }
  
  console.log('\n⏳ Waiting 3 seconds before next step...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 3: Create admin users
  try {
    const adminUsers = fs.readFileSync('create_onehealth_admin_complete.sql', 'utf8');
    const success3 = await executeSQL(adminUsers, 'Create OneHealth Admin Users');
    if (!success3) return;
  } catch (err) {
    console.error('❌ Could not read admin users file:', err.message);
    return;
  }
  
  console.log('\n⏳ Waiting 3 seconds before next step...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 4: Setup SMS management
  try {
    const smsSetup = fs.readFileSync('setup_sms_management.sql', 'utf8');
    const success4 = await executeSQL(smsSetup, 'Setup SMS Management System');
    if (!success4) return;
  } catch (err) {
    console.error('❌ Could not read SMS setup file:', err.message);
    return;
  }
  
  console.log('\n🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY! 🎉');
  console.log('\n📋 SUMMARY:');
  console.log('✅ Comprehensive Practice Management System deployed');
  console.log('✅ Dental tariffs imported for all practices');
  console.log('✅ OneHealth admin users created');
  console.log('✅ SMS management system configured');
  console.log('\n🔑 LOGIN CREDENTIALS:');
  console.log('Super Admin: admin@onehealth.na');
  console.log('Practice Manager: manager@onehealth.na');
  console.log('Password: OneHealth2025!');
  console.log('\n🌐 ACCESS URLs:');
  console.log('Main App: https://hpms-one.vercel.app/');
  console.log('Supabase Dashboard: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt');
}

runMigrations().catch(console.error);
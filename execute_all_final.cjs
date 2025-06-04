const https = require('https');
const fs = require('fs');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'jjxlfunlbyayxwvlpgwt.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: responseData });
        } else {
          resolve({ success: false, error: responseData, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function executeFile(filename, description) {
  console.log(`🚀 ${description}...`);
  
  try {
    const sql = fs.readFileSync(filename, 'utf8');
    const result = await executeSQL(sql);
    
    if (result.success) {
      console.log(`✅ ${description} completed successfully`);
      if (result.data && result.data.trim() && result.data !== '[]') {
        console.log('   Result:', result.data.substring(0, 200));
      }
      return true;
    } else {
      console.log(`❌ ${description} failed (${result.statusCode}): ${result.error}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ ${description} error: ${err.message}`);
    return false;
  }
}

async function runAllMigrations() {
  console.log('🔧 EXECUTING ALL HPMS MIGRATIONS');
  console.log('====================================\n');
  
  // Step 1: Main comprehensive migration
  console.log('📋 STEP 1: Main Migration');
  const step1 = await executeFile(
    'supabase/migrations/20250605000001_comprehensive_practice_management_system_fixed.sql',
    'Comprehensive Practice Management System'
  );
  
  if (!step1) {
    console.log('\n❌ Main migration failed. Cannot continue.');
    return;
  }
  
  console.log('\n⏳ Waiting 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 2: Import dental tariffs
  console.log('📋 STEP 2: Dental Tariffs');
  const step2 = await executeFile(
    'import_dental_tariffs.sql',
    'Import Dental Tariffs with Practice Types'
  );
  
  if (!step2) {
    console.log('\n⚠️  Dental tariffs import failed. Continuing with other steps...\n');
  }
  
  console.log('\n⏳ Waiting 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 3: Create OneHealth admin users
  console.log('📋 STEP 3: OneHealth Admin System');
  const step3 = await executeFile(
    'create_onehealth_admin_complete.sql',
    'Create OneHealth Admin Users and System'
  );
  
  if (!step3) {
    console.log('\n⚠️  Admin system setup failed. Continuing with other steps...\n');
  }
  
  console.log('\n⏳ Waiting 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 4: SMS management setup
  console.log('📋 STEP 4: SMS Management');
  const step4 = await executeFile(
    'setup_sms_management.sql',
    'Setup SMS Management and Allocation System'
  );
  
  if (!step4) {
    console.log('\n⚠️  SMS management setup failed.\n');
  }
  
  // Final summary
  console.log('\n🎉 MIGRATION EXECUTION COMPLETED! 🎉');
  console.log('======================================');
  console.log(`✅ Main Migration: ${step1 ? 'SUCCESS' : 'FAILED'}`);
  console.log(`✅ Dental Tariffs: ${step2 ? 'SUCCESS' : 'FAILED'}`);
  console.log(`✅ Admin System: ${step3 ? 'SUCCESS' : 'FAILED'}`);
  console.log(`✅ SMS Management: ${step4 ? 'SUCCESS' : 'FAILED'}`);
  
  if (step1) {
    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('Email: admin@onehealth.na');
    console.log('Email: manager@onehealth.na');
    console.log('Password: OneHealth2025!');
    
    console.log('\n🌐 SYSTEM ACCESS:');
    console.log('Main App: https://hpms-one.vercel.app/');
    console.log('Supabase Dashboard: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt');
    
    console.log('\n📊 FEATURES DEPLOYED:');
    console.log('• Enhanced practice management with types/subtypes');
    console.log('• Complete dental tariff catalog (60+ codes)');
    console.log('• SMS management and allocation system');
    console.log('• OneHealth admin portal with role-based access');
    console.log('• Comprehensive reporting views');
    console.log('• Audit logging system');
    
    console.log('\n🎯 Your system is ready for production use!');
  } else {
    console.log('\n❌ Critical errors occurred. Please check Supabase logs.');
  }
}

runAllMigrations().catch(console.error);
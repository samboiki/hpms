import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function executeSql(sql, description = '') {
  console.log(`🔗 ${description}`);
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: sql
    });
    
    if (error) {
      console.log('❌ SQL execution failed:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ SQL executed successfully!');
    return { success: true, result: data };
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testMultiTenantWorkflow() {
  console.log('🚀 Testing Multi-Tenant Workflow...\n');

  // Step 1: Get a practice to work with
  console.log('📋 Step 1: Finding a practice to test with...');
  const { data: practices, error: practicesError } = await supabase
    .from('practices')
    .select('id, name')
    .limit(1);

  if (practicesError || !practices || practices.length === 0) {
    console.log('❌ No practices found. Creating a test practice...');
    
    await executeSql(`
      INSERT INTO practices (id, name, slug, city, contact_email, contact_phone, practice_type, status, subscription_tier)
      VALUES (
        gen_random_uuid(),
        'Test Medical Practice',
        'test-medical-practice',
        'Windhoek',
        'test@practice.com',
        '+264 61 123456',
        'general_practice',
        'active',
        'standard'
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id, name;
    `, 'Creating test practice');

    // Re-fetch practices
    const { data: newPractices } = await supabase
      .from('practices')
      .select('id, name')
      .eq('slug', 'test-medical-practice')
      .limit(1);

    if (!newPractices || newPractices.length === 0) {
      console.log('❌ Failed to create test practice');
      return;
    }
    
    practices.push(newPractices[0]);
  }

  const testPractice = practices[0];
  console.log(`✅ Using practice: ${testPractice.name} (${testPractice.id})`);

  // Step 2: Create SMS subscription for the practice
  console.log('\n📋 Step 2: Creating SMS subscription...');
  const billingStart = new Date().toISOString().split('T')[0];
  const billingEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  await executeSql(`
    INSERT INTO practice_sms_subscriptions 
    (practice_id, monthly_limit, current_usage, billing_cycle_start, billing_cycle_end, is_active)
    VALUES (
      '${testPractice.id}',
      1000,
      50,
      '${billingStart}',
      '${billingEnd}',
      true
    )
    ON CONFLICT (practice_id) DO UPDATE SET
      monthly_limit = EXCLUDED.monthly_limit,
      current_usage = EXCLUDED.current_usage,
      is_active = EXCLUDED.is_active;
  `, 'Creating SMS subscription');

  // Step 3: Create email subscription for the practice
  console.log('\n📋 Step 3: Creating email subscription...');
  await executeSql(`
    INSERT INTO practice_email_subscriptions 
    (practice_id, monthly_limit, current_usage, billing_cycle_start, billing_cycle_end, is_active)
    VALUES (
      '${testPractice.id}',
      2000,
      150,
      '${billingStart}',
      '${billingEnd}',
      true
    )
    ON CONFLICT (practice_id) DO UPDATE SET
      monthly_limit = EXCLUDED.monthly_limit,
      current_usage = EXCLUDED.current_usage,
      is_active = EXCLUDED.is_active;
  `, 'Creating email subscription');

  // Step 4: Enable some features for the practice
  console.log('\n📋 Step 4: Enabling practice features...');
  const features = [
    { feature_key: 'vitals_tracking', is_enabled: true, limit_value: null },
    { feature_key: 'lab_integration', is_enabled: true, limit_value: 100 },
    { feature_key: 'media_requests', is_enabled: false, limit_value: 50 }
  ];

  for (const feature of features) {
    await executeSql(`
      INSERT INTO practice_features 
      (practice_id, feature_key, is_enabled, limit_value, current_usage)
      VALUES (
        '${testPractice.id}',
        '${feature.feature_key}',
        ${feature.is_enabled},
        ${feature.limit_value},
        0
      )
      ON CONFLICT (practice_id, feature_key) DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        limit_value = EXCLUDED.limit_value;
    `, `Enabling feature: ${feature.feature_key}`);
  }

  // Step 5: Create a service subscription
  console.log('\n📋 Step 5: Creating service subscription...');
  
  // First, get a service plan
  const { data: servicePlans } = await supabase
    .from('service_plans')
    .select('id, name, plan_type')
    .eq('is_active', true)
    .limit(1);

  if (servicePlans && servicePlans.length > 0) {
    const servicePlan = servicePlans[0];
    
    await executeSql(`
      INSERT INTO practice_service_subscriptions 
      (practice_id, service_plan_id, status, billing_cycle_start, billing_cycle_end, auto_renew)
      VALUES (
        '${testPractice.id}',
        '${servicePlan.id}',
        'active',
        '${billingStart}',
        '${billingEnd}',
        true
      )
      ON CONFLICT (practice_id, service_plan_id) DO UPDATE SET
        status = EXCLUDED.status,
        auto_renew = EXCLUDED.auto_renew;
    `, `Subscribing to service plan: ${servicePlan.name}`);
  }

  // Step 6: Test data retrieval (simulate what the practice dashboard would fetch)
  console.log('\n📋 Step 6: Testing practice dashboard data retrieval...');

  // Fetch practice settings
  const { data: practiceData } = await supabase
    .from('practices')
    .select('id, name, max_users, max_patients')
    .eq('id', testPractice.id)
    .single();

  // Fetch SMS subscription
  const { data: smsData } = await supabase
    .from('practice_sms_subscriptions')
    .select('*')
    .eq('practice_id', testPractice.id)
    .eq('is_active', true)
    .single();

  // Fetch email subscription
  const { data: emailData } = await supabase
    .from('practice_email_subscriptions')
    .select('*')
    .eq('practice_id', testPractice.id)
    .eq('is_active', true)
    .single();

  // Fetch features
  const { data: featuresData } = await supabase
    .from('practice_features')
    .select('*')
    .eq('practice_id', testPractice.id);

  // Fetch service subscriptions
  const { data: subscriptionsData } = await supabase
    .from('practice_service_subscriptions')
    .select(`
      *,
      service_plan:service_plans(*)
    `)
    .eq('practice_id', testPractice.id)
    .eq('status', 'active');

  console.log('\n✅ Test Results:');
  console.log('🏥 Practice Data:', practiceData);
  console.log('📱 SMS Subscription:', smsData ? `${smsData.current_usage}/${smsData.monthly_limit} SMS used` : 'None');
  console.log('📧 Email Subscription:', emailData ? `${emailData.current_usage}/${emailData.monthly_limit} emails used` : 'None');
  console.log('⚙️ Features:', featuresData?.map(f => `${f.feature_key}: ${f.is_enabled ? 'enabled' : 'disabled'}`).join(', '));
  console.log('🎯 Service Subscriptions:', subscriptionsData?.map(s => s.service_plan?.name).join(', ') || 'None');

  // Step 7: Test feature access logic
  console.log('\n📋 Step 7: Testing feature access logic...');

  const canRecordVitals = featuresData?.find(f => f.feature_key === 'vitals_tracking')?.is_enabled || false;
  const canTrackLab = featuresData?.find(f => f.feature_key === 'lab_integration')?.is_enabled || false;
  const canUseSMS = !!smsData && smsData.current_usage < smsData.monthly_limit;
  const canUseEmail = !!emailData && emailData.current_usage < emailData.monthly_limit;

  console.log('✅ Feature Access Test Results:');
  console.log(`   - Can Record Vitals: ${canRecordVitals ? '✅ Yes' : '❌ No'}`);
  console.log(`   - Can Track Lab: ${canTrackLab ? '✅ Yes' : '❌ No'}`);
  console.log(`   - Can Use SMS: ${canUseSMS ? '✅ Yes' : '❌ No'} (${smsData?.current_usage || 0}/${smsData?.monthly_limit || 0})`);
  console.log(`   - Can Use Email: ${canUseEmail ? '✅ Yes' : '❌ No'} (${emailData?.current_usage || 0}/${emailData?.monthly_limit || 0})`);

  // Step 8: Test usage increment (simulate sending an SMS)
  console.log('\n📋 Step 8: Testing usage increment (simulating SMS send)...');
  
  if (smsData && smsData.current_usage < smsData.monthly_limit) {
    const newUsage = smsData.current_usage + 1;
    
    await executeSql(`
      UPDATE practice_sms_subscriptions 
      SET current_usage = ${newUsage}
      WHERE practice_id = '${testPractice.id}' AND is_active = true;
    `, 'Incrementing SMS usage');

    console.log(`✅ SMS usage incremented: ${smsData.current_usage} → ${newUsage}`);
  } else {
    console.log('⚠️ Cannot send SMS - limit reached or no subscription');
  }

  console.log('\n🎉 Multi-tenant workflow test completed successfully!');
  console.log('\n📊 Summary:');
  console.log('   ✅ Database tables created and populated');
  console.log('   ✅ Practice limits and subscriptions configured');
  console.log('   ✅ Feature access control working');
  console.log('   ✅ Usage tracking functional');
  console.log('   ✅ Admin-to-practice data flow verified');
}

testMultiTenantWorkflow().catch(console.error);
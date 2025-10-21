import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Create client with ANON key (same as frontend)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRegistration() {
  console.log('🧪 Testing Practice Registration Flow (ANON KEY)...\n');

  const testPractice = {
    name: 'Test Practice Registration',
    about_text: 'This is a test practice',
    practice_type: 'general',
    registration_number: 'TEST123',
    tax_number: 'TAX123',
    contact_email: 'test@practice.com',
    contact_phone: '+264811234567',
    address: '123 Test Street',
    city: 'Windhoek',
    country: 'Namibia',
    domain: 'test-practice.vercel.app',
    primary_color: '#01b9d5',
    secondary_color: '#0196be',
    subscription_tier: 'standard',
    max_users: 10,
    max_patients: 1000,
    is_follow_up_automation_enabled: true,
    status: 'active',
    number_of_branches: 1,
    branch_names: ['Main Branch'],
    professional_email_count: 0,
    professional_email_addresses: [],
    marketing_budget: 0,
    website_hosting_enabled: false,
    base_price: 1600,
    branches_cost: 0,
    website_cost: 0,
    emails_cost: 0,
    total_monthly_premium: 1600
  };

  console.log('📋 Test Practice Data:');
  console.log(JSON.stringify(testPractice, null, 2));
  console.log('\n🚀 Attempting INSERT...\n');

  const { data: practice, error: practiceError } = await supabase
    .from('practices')
    .insert([testPractice])
    .select()
    .single();

  if (practiceError) {
    console.error('❌ PRACTICE INSERT ERROR:');
    console.error(JSON.stringify(practiceError, null, 2));
    return;
  }

  console.log('✅ PRACTICE CREATED SUCCESSFULLY!');
  console.log('Practice ID:', practice.id);
  console.log('Practice Name:', practice.name);
  console.log('\n📊 Full Practice Data:');
  console.log(JSON.stringify(practice, null, 2));

  // Test branch creation
  console.log('\n🏢 Testing Branch Creation...');
  const branchData = {
    practice_id: practice.id,
    name: 'Main Branch',
    slug: 'main-branch',
    is_main_branch: true,
    monthly_cost: 0,
    is_active: true
  };

  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .insert([branchData])
    .select();

  if (branchError) {
    console.error('❌ BRANCH INSERT ERROR:');
    console.error(JSON.stringify(branchError, null, 2));
  } else {
    console.log('✅ BRANCH CREATED SUCCESSFULLY!');
    console.log(JSON.stringify(branch, null, 2));
  }

  // Test SMS subscription
  console.log('\n📱 Testing SMS Subscription Creation...');
  const { data: smsSub, error: smsError } = await supabase
    .from('practice_sms_subscriptions')
    .insert([{
      practice_id: practice.id,
      monthly_limit: 200,
      current_usage: 0
    }])
    .select();

  if (smsError) {
    console.error('❌ SMS SUBSCRIPTION ERROR:');
    console.error(JSON.stringify(smsError, null, 2));
  } else {
    console.log('✅ SMS SUBSCRIPTION CREATED!');
    console.log(JSON.stringify(smsSub, null, 2));
  }

  // Test Email subscription
  console.log('\n📧 Testing Email Subscription Creation...');
  const { data: emailSub, error: emailError } = await supabase
    .from('practice_email_subscriptions')
    .insert([{
      practice_id: practice.id,
      monthly_limit: 500,
      current_usage: 0
    }])
    .select();

  if (emailError) {
    console.error('❌ EMAIL SUBSCRIPTION ERROR:');
    console.error(JSON.stringify(emailError, null, 2));
  } else {
    console.log('✅ EMAIL SUBSCRIPTION CREATED!');
    console.log(JSON.stringify(emailSub, null, 2));
  }

  // Clean up
  console.log('\n🧹 Cleaning up test data...');
  if (smsSub) {
    await supabase.from('practice_sms_subscriptions').delete().eq('id', smsSub[0].id);
  }
  if (emailSub) {
    await supabase.from('practice_email_subscriptions').delete().eq('id', emailSub[0].id);
  }
  if (branch) {
    await supabase.from('branches').delete().eq('id', branch[0].id);
  }
  await supabase.from('practices').delete().eq('id', practice.id);
  console.log('✅ Test data cleaned up successfully!');
}

testRegistration().catch(console.error);
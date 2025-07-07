import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function getPracticeInfo() {
  console.log('🔍 PRACTICE SETTINGS & LIMITS INVESTIGATION');
  console.log('='.repeat(60));
  
  try {
    // 1. Get practices table structure and data
    console.log('\n📋 PRACTICES TABLE');
    console.log('-'.repeat(40));
    
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('*')
      .limit(3);
      
    if (practicesError) {
      console.error('❌ Practices error:', practicesError);
    } else {
      console.log(`Found ${practices.length} practices:`);
      practices.forEach(p => {
        console.log(`\n📌 ${p.name} (${p.slug})`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Email: ${p.contact_email}`);
        console.log(`   Phone: ${p.contact_phone}`);
        console.log(`   Max Users: ${p.max_users || 'Not set'}`);
        console.log(`   Max Patients: ${p.max_patients || 'Not set'}`);
        console.log(`   Status: ${p.status || 'Not set'}`);
        console.log(`   Tier: ${p.subscription_tier || 'Not set'}`);
      });
    }
    
    // 2. Check SMS subscriptions
    console.log('\n\n📱 SMS SUBSCRIPTIONS');
    console.log('-'.repeat(40));
    
    const { data: smsSubscriptions, error: smsError } = await supabase
      .from('practice_sms_subscriptions')
      .select('*')
      .limit(5);
      
    if (smsError) {
      console.error('❌ SMS subscriptions error:', smsError);
    } else {
      console.log(`Found ${smsSubscriptions.length} SMS subscriptions:`);
      smsSubscriptions.forEach(s => {
        console.log(`\n📱 Practice: ${s.practice_id}`);
        console.log(`   Monthly Limit: ${s.monthly_limit}`);
        console.log(`   Current Usage: ${s.current_usage}`);
        console.log(`   Additional SMS: ${s.additional_sms_purchased || 0}`);
        console.log(`   Active: ${s.is_active}`);
        console.log(`   Billing: ${s.billing_cycle_start} to ${s.billing_cycle_end}`);
      });
    }
    
    // 3. Check email subscriptions
    console.log('\n\n📧 EMAIL SUBSCRIPTIONS');
    console.log('-'.repeat(40));
    
    const { data: emailSubscriptions, error: emailError } = await supabase
      .from('practice_email_subscriptions')
      .select('*')
      .limit(5);
      
    if (emailError) {
      console.error('❌ Email subscriptions error:', emailError);
    } else {
      console.log(`Found ${emailSubscriptions.length} email subscriptions:`);
      emailSubscriptions.forEach(e => {
        console.log(`\n📧 Practice: ${e.practice_id}`);
        console.log(`   Monthly Limit: ${e.monthly_limit}`);
        console.log(`   Current Usage: ${e.current_usage}`);
        console.log(`   Additional Emails: ${e.additional_emails_purchased || 0}`);
        console.log(`   Active: ${e.is_active}`);
        console.log(`   Billing: ${e.billing_cycle_start} to ${e.billing_cycle_end}`);
      });
    }
    
    // 4. Check practice features
    console.log('\n\n⚙️  PRACTICE FEATURES');
    console.log('-'.repeat(40));
    
    const { data: practiceFeatures, error: featuresError } = await supabase
      .from('practice_features')
      .select('*')
      .limit(10);
      
    if (featuresError) {
      console.error('❌ Practice features error:', featuresError);
    } else {
      console.log(`Found ${practiceFeatures.length} practice features:`);
      practiceFeatures.forEach(f => {
        console.log(`\n⚙️  Practice: ${f.practice_id}`);
        console.log(`   Feature: ${f.feature_key}`);
        console.log(`   Enabled: ${f.is_enabled}`);
        console.log(`   Limit: ${f.limit_value || 'No limit'}`);
        console.log(`   Usage: ${f.current_usage || 0}`);
      });
    }
    
    // 5. Check service plans
    console.log('\n\n📦 SERVICE PLANS');
    console.log('-'.repeat(40));
    
    const { data: servicePlans, error: plansError } = await supabase
      .from('service_plans')
      .select('*')
      .limit(5);
      
    if (plansError) {
      console.error('❌ Service plans error:', plansError);
    } else {
      console.log(`Found ${servicePlans.length} service plans:`);
      servicePlans.forEach(sp => {
        console.log(`\n📦 ${sp.name}`);
        console.log(`   Type: ${sp.plan_type}`);
        console.log(`   Price: $${sp.price_monthly}/month`);
        console.log(`   Features: ${JSON.stringify(sp.features)}`);
        console.log(`   Limits: ${JSON.stringify(sp.limits)}`);
        console.log(`   Active: ${sp.is_active}`);
      });
    }

    // 6. Summary
    console.log('\n\n📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Practices: ${practices?.length || 0} found`);
    console.log(`📱 SMS Subscriptions: ${smsSubscriptions?.length || 0} found`);
    console.log(`📧 Email Subscriptions: ${emailSubscriptions?.length || 0} found`);
    console.log(`⚙️  Practice Features: ${practiceFeatures?.length || 0} found`);
    console.log(`📦 Service Plans: ${servicePlans?.length || 0} found`);
    
    console.log('\n🔗 KEY FLOWS:');
    console.log('1. Admin Portal (localhost:4000) -> Practices page -> Manage practice limits');
    console.log('2. Practice Settings (localhost:5000/settings) -> Practice tab -> Contact details');
    console.log('3. Database tables: practices, practice_sms_subscriptions, practice_email_subscriptions');
    console.log('4. Admin API: /api/admin/practices with updateSMSLimits/updateEmailLimits actions');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getPracticeInfo();
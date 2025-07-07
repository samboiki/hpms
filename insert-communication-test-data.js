#!/usr/bin/env node

/**
 * Insert test communication subscription data
 * This script creates sample SMS and Email subscription data for testing the communications card
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertTestCommunicationData() {
  try {
    console.log('🔍 Fetching practices...');
    
    // Get all practices to create subscriptions for them
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name')
      .limit(10);

    if (practicesError) {
      console.error('❌ Error fetching practices:', practicesError);
      return;
    }

    if (!practices || practices.length === 0) {
      console.log('❌ No practices found. Please create practices first.');
      return;
    }

    console.log(`✅ Found ${practices.length} practices`);

    for (const practice of practices) {
      console.log(`\n🏥 Creating subscriptions for practice: ${practice.name} (${practice.id})`);

      // Create SMS subscription for this practice
      const smsSubscriptionData = {
        practice_id: practice.id,
        plan_id: null, // Optional
        monthly_limit: 1000, // 1000 SMS per month
        additional_sms_purchased: 200, // 200 additional SMS purchased
        current_usage: Math.floor(Math.random() * 800) + 100, // Random usage between 100-900
        billing_cycle_start: new Date().toISOString().split('T')[0],
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_active: true,
        auto_renew: true
      };

      const { data: smsResult, error: smsError } = await supabase
        .from('practice_sms_subscriptions')
        .insert([smsSubscriptionData])
        .select()
        .single();

      if (smsError) {
        console.error(`❌ Error creating SMS subscription for ${practice.name}:`, smsError);
      } else {
        console.log(`✅ SMS subscription created: ${smsSubscriptionData.current_usage}/${smsSubscriptionData.monthly_limit} used`);
      }

      // Create Email subscription for this practice
      const emailSubscriptionData = {
        practice_id: practice.id,
        plan_id: null, // Optional
        monthly_limit: 500, // 500 emails per month
        additional_emails_purchased: 100, // 100 additional emails purchased
        current_usage: Math.floor(Math.random() * 300) + 50, // Random usage between 50-350
        billing_cycle_start: new Date().toISOString().split('T')[0],
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_active: true,
        auto_renew: true
      };

      // Try to create email subscription (table might not exist)
      try {
        const { data: emailResult, error: emailError } = await supabase
          .from('practice_email_subscriptions')
          .insert([emailSubscriptionData])
          .select()
          .single();

        if (emailError) {
          console.error(`❌ Error creating Email subscription for ${practice.name}:`, emailError);
        } else {
          console.log(`✅ Email subscription created: ${emailSubscriptionData.current_usage}/${emailSubscriptionData.monthly_limit} used`);
        }
      } catch (err) {
        console.log(`⚠️  Email subscription table may not exist yet for practice ${practice.name}`);
      }
    }

    console.log('\n🎉 Test communication data insertion completed!');
    console.log('\n📊 You should now see working charts in the Communications card on the dashboard');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
insertTestCommunicationData();
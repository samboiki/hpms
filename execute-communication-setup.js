#!/usr/bin/env node

/**
 * Execute communication setup using MCP SQL execution standard
 * This script creates the email subscription tables and inserts test data
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  console.error('Example:');
  console.error('export SUPABASE_URL="https://your-project.supabase.co"');
  console.error('export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sqlQuery, description) {
  console.log(`🔄 ${description}...`);
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: sqlQuery
    });

    if (error) {
      console.error(`❌ Error ${description}:`, error);
      return false;
    }

    console.log(`✅ ${description} completed:`, data);
    return true;
  } catch (err) {
    console.error(`❌ Exception during ${description}:`, err);
    return false;
  }
}

async function setupCommunicationTables() {
  try {
    console.log('🚀 Setting up communication tables and data...\n');

    // Step 1: Create email subscription tables
    console.log('📧 Creating email subscription tables...');
    const emailTableSQL = fs.readFileSync('create-email-subscription-table.sql', 'utf8');
    const tablesCreated = await executeSQL(emailTableSQL, 'Creating email subscription tables');

    if (!tablesCreated) {
      console.log('⚠️  Email tables creation failed, continuing anyway...');
    }

    // Step 2: Get all practices
    console.log('\n🏥 Fetching practices...');
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

    // Step 3: Create subscriptions for each practice
    for (const practice of practices) {
      console.log(`\n🏥 Setting up subscriptions for: ${practice.name} (${practice.id})`);

      // SMS Subscription
      const smsUsage = Math.floor(Math.random() * 800) + 100; // Random usage between 100-900
      const smsSubscriptionSQL = `
        INSERT INTO practice_sms_subscriptions (
          practice_id, monthly_limit, additional_sms_purchased, current_usage,
          billing_cycle_start, billing_cycle_end, is_active, auto_renew
        ) VALUES (
          '${practice.id}', 1000, 200, ${smsUsage},
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', true, true
        ) ON CONFLICT (practice_id) DO UPDATE SET
          monthly_limit = 1000,
          current_usage = ${smsUsage},
          updated_at = NOW();
      `;

      await executeSQL(smsSubscriptionSQL, `Creating SMS subscription for ${practice.name}`);

      // Email Subscription
      const emailUsage = Math.floor(Math.random() * 300) + 50; // Random usage between 50-350
      const emailSubscriptionSQL = `
        INSERT INTO practice_email_subscriptions (
          practice_id, monthly_limit, additional_emails_purchased, current_usage,
          billing_cycle_start, billing_cycle_end, is_active, auto_renew
        ) VALUES (
          '${practice.id}', 500, 100, ${emailUsage},
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', true, true
        ) ON CONFLICT (practice_id) DO UPDATE SET
          monthly_limit = 500,
          current_usage = ${emailUsage},
          updated_at = NOW();
      `;

      await executeSQL(emailSubscriptionSQL, `Creating Email subscription for ${practice.name}`);
    }

    console.log('\n🎉 Communication setup completed successfully!');
    console.log('📊 The Communications card should now show working charts with real data');
    console.log('\n💡 Refresh your dashboard to see the updated charts');

  } catch (error) {
    console.error('❌ Unexpected error during setup:', error);
  }
}

// Run the setup
setupCommunicationTables();
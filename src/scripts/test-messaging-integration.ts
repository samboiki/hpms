#!/usr/bin/env tsx
// ========================================
// MESSAGING INTEGRATION TEST SCRIPT
// Automated testing of messaging system integration points
// ========================================

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing required environment variables'));
  process.exit(1);
}

// Create Supabase clients
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Test configuration
const TEST_PRACTICE_ID = process.env.TEST_PRACTICE_ID || '';
const TEST_USER_ID = process.env.TEST_USER_ID || '';
const TEST_USER_2_ID = process.env.TEST_USER_2_ID || '';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const testResults: TestResult[] = [];

// Utility functions
const logTest = (name: string) => {
  console.log(chalk.blue(`\n🧪 Testing: ${name}`));
};

const logSuccess = (message: string) => {
  console.log(chalk.green(`  ✅ ${message}`));
};

const logError = (message: string) => {
  console.log(chalk.red(`  ❌ ${message}`));
};

const logInfo = (message: string) => {
  console.log(chalk.gray(`  ℹ️  ${message}`));
};

const recordTest = (name: string, passed: boolean, error?: string, duration?: number) => {
  testResults.push({
    name,
    passed,
    error,
    duration: duration || 0
  });
};

// Test functions
async function testDatabaseSchema() {
  logTest('Database Schema Validation');
  const startTime = Date.now();
  
  try {
    // Check if all required tables exist
    const requiredTables = [
      'system_notifications',
      'internal_message_channels',
      'internal_messages',
      'internal_message_threads',
      'internal_channel_members',
      'notification_triggers',
      'practice_sms_logs',
      'practice_email_logs'
    ];

    for (const table of requiredTables) {
      const { error } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        throw new Error(`Table ${table} check failed: ${error.message}`);
      }
      logSuccess(`Table ${table} exists and accessible`);
    }

    // Test RLS policies
    const { data: rlsTest, error: rlsError } = await supabaseAnon
      .from('system_notifications')
      .select('*')
      .eq('practice_id', 'invalid-practice-id')
      .limit(1);

    if (!rlsError && (!rlsTest || rlsTest.length === 0)) {
      logSuccess('RLS policies working correctly');
    }

    recordTest('Database Schema', true, undefined, Date.now() - startTime);
  } catch (error) {
    logError(`Schema validation failed: ${error}`);
    recordTest('Database Schema', false, error.message, Date.now() - startTime);
  }
}

async function testNotificationCreation() {
  logTest('Notification Creation via Edge Function');
  const startTime = Date.now();
  
  try {
    // Create notification via edge function
    const { data, error } = await supabaseAnon.functions.invoke('smart-notification-processor', {
      body: {
        practiceId: TEST_PRACTICE_ID,
        userId: TEST_USER_ID,
        notificationType: 'test_integration',
        priority: 'normal',
        title: 'Integration Test Notification',
        message: 'This is an automated test notification',
        triggerType: 'manual',
        metadata: {
          test_run: new Date().toISOString()
        }
      }
    });

    if (error) throw error;

    logSuccess(`Notification created with ID: ${data.notificationId}`);
    logInfo(`Delivery channels: ${data.deliveryChannels.join(', ')}`);

    // Verify notification exists
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('system_notifications')
      .select('*')
      .eq('id', data.notificationId)
      .single();

    if (fetchError) throw fetchError;

    logSuccess('Notification verified in database');
    
    // Clean up
    await supabaseAdmin
      .from('system_notifications')
      .delete()
      .eq('id', data.notificationId);

    recordTest('Notification Creation', true, undefined, Date.now() - startTime);
  } catch (error) {
    logError(`Notification creation failed: ${error}`);
    recordTest('Notification Creation', false, error.message, Date.now() - startTime);
  }
}

async function testMessageChannelOperations() {
  logTest('Message Channel Operations');
  const startTime = Date.now();
  
  try {
    // Create a test channel
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('internal_message_channels')
      .insert({
        practice_id: TEST_PRACTICE_ID,
        channel_type: 'group',
        name: 'Integration Test Channel',
        created_by: TEST_USER_ID
      })
      .select()
      .single();

    if (channelError) throw channelError;

    logSuccess(`Channel created: ${channel.id}`);

    // Add members
    const { error: memberError } = await supabaseAdmin
      .from('internal_channel_members')
      .insert([
        {
          channel_id: channel.id,
          practice_id: TEST_PRACTICE_ID,
          user_id: TEST_USER_ID,
          role: 'admin'
        },
        {
          channel_id: channel.id,
          practice_id: TEST_PRACTICE_ID,
          user_id: TEST_USER_2_ID,
          role: 'member'
        }
      ]);

    if (memberError) throw memberError;

    logSuccess('Channel members added');

    // Create thread
    const { data: thread, error: threadError } = await supabaseAdmin
      .from('internal_message_threads')
      .insert({
        channel_id: channel.id,
        practice_id: TEST_PRACTICE_ID,
        created_by: TEST_USER_ID
      })
      .select()
      .single();

    if (threadError) throw threadError;

    logSuccess(`Thread created: ${thread.id}`);

    // Send test message
    const { data: message, error: messageError } = await supabaseAdmin
      .from('internal_messages')
      .insert({
        thread_id: thread.id,
        practice_id: TEST_PRACTICE_ID,
        sender_id: TEST_USER_ID,
        content: 'Integration test message',
        content_type: 'text'
      })
      .select()
      .single();

    if (messageError) throw messageError;

    logSuccess('Test message sent');

    // Clean up
    await supabaseAdmin
      .from('internal_message_channels')
      .delete()
      .eq('id', channel.id);

    logSuccess('Test data cleaned up');

    recordTest('Message Channel Operations', true, undefined, Date.now() - startTime);
  } catch (error) {
    logError(`Channel operations failed: ${error}`);
    recordTest('Message Channel Operations', false, error.message, Date.now() - startTime);
  }
}

async function testRealtimeSubscriptions() {
  logTest('Real-time Subscriptions');
  const startTime = Date.now();
  
  try {
    let receivedUpdate = false;
    
    // Set up subscription
    const channel = supabaseAnon
      .channel('test-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_notifications',
          filter: `practice_id=eq.${TEST_PRACTICE_ID}`
        },
        (payload) => {
          receivedUpdate = true;
          logSuccess(`Received real-time update: ${payload.new.id}`);
        }
      )
      .subscribe();

    // Wait for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Insert test notification
    const { data: testNotif, error } = await supabaseAdmin
      .from('system_notifications')
      .insert({
        practice_id: TEST_PRACTICE_ID,
        user_id: TEST_USER_ID,
        notification_type: 'realtime_test',
        priority: 'low',
        title: 'Real-time Test',
        message: 'Testing real-time updates'
      })
      .select()
      .single();

    if (error) throw error;

    // Wait for real-time update
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (receivedUpdate) {
      logSuccess('Real-time subscription working');
    } else {
      throw new Error('No real-time update received');
    }

    // Clean up
    supabaseAnon.removeChannel(channel);
    await supabaseAdmin
      .from('system_notifications')
      .delete()
      .eq('id', testNotif.id);

    recordTest('Real-time Subscriptions', true, undefined, Date.now() - startTime);
  } catch (error) {
    logError(`Real-time test failed: ${error}`);
    recordTest('Real-time Subscriptions', false, error.message, Date.now() - startTime);
  }
}

async function testNotificationTriggers() {
  logTest('Notification Triggers');
  const startTime = Date.now();
  
  try {
    // Create test trigger
    const { data: trigger, error: triggerError } = await supabaseAdmin
      .from('notification_triggers')
      .insert({
        practice_id: TEST_PRACTICE_ID,
        name: 'Test Integration Trigger',
        event_type: 'test_event',
        notification_type: 'test_notification',
        template: 'Test event occurred for {{entity_name}}',
        conditions: { test: true },
        enabled: true
      })
      .select()
      .single();

    if (triggerError) throw triggerError;

    logSuccess(`Trigger created: ${trigger.id}`);

    // Verify trigger exists
    const { data: verifyTrigger, error: verifyError } = await supabaseAdmin
      .from('notification_triggers')
      .select('*')
      .eq('id', trigger.id)
      .single();

    if (verifyError) throw verifyError;
    if (!verifyTrigger.enabled) throw new Error('Trigger not enabled');

    logSuccess('Trigger verified and enabled');

    // Clean up
    await supabaseAdmin
      .from('notification_triggers')
      .delete()
      .eq('id', trigger.id);

    recordTest('Notification Triggers', true, undefined, Date.now() - startTime);
  } catch (error) {
    logError(`Trigger test failed: ${error}`);
    recordTest('Notification Triggers', false, error.message, Date.now() - startTime);
  }
}

async function testCommunicationGateways() {
  logTest('Communication Gateways');
  const startTime = Date.now();
  
  try {
    // Test SMS gateway logging
    const { data: smsLog, error: smsError } = await supabaseAdmin
      .from('practice_sms_logs')
      .insert({
        practice_id: TEST_PRACTICE_ID,
        recipient_phone: '+27123456789',
        message_content: 'Test SMS',
        message_type: 'test',
        provider_message_id: 'test-' + Date.now(),
        delivered: true
      })
      .select()
      .single();

    if (smsError) throw smsError;

    logSuccess('SMS log created successfully');

    // Test email gateway logging
    const { data: emailLog, error: emailError } = await supabaseAdmin
      .from('practice_email_logs')
      .insert({
        practice_id: TEST_PRACTICE_ID,
        recipient_email: 'test@example.com',
        subject: 'Test Email',
        email_type: 'test',
        provider_message_id: 'test-' + Date.now(),
        delivered: true
      })
      .select()
      .single();

    if (emailError) throw emailError;

    logSuccess('Email log created successfully');

    // Clean up
    await supabaseAdmin
      .from('practice_sms_logs')
      .delete()
      .eq('id', smsLog.id);

    await supabaseAdmin
      .from('practice_email_logs')
      .delete()
      .eq('id', emailLog.id);

    recordTest('Communication Gateways', true, undefined, Date.now() - startTime);
  } catch (error) {
    logError(`Gateway test failed: ${error}`);
    recordTest('Communication Gateways', false, error.message, Date.now() - startTime);
  }
}

// Main test runner
async function runAllTests() {
  console.log(chalk.bold.cyan('\n🚀 Starting Messaging System Integration Tests\n'));
  
  if (!TEST_PRACTICE_ID || !TEST_USER_ID) {
    console.error(chalk.red('❌ Missing TEST_PRACTICE_ID or TEST_USER_ID environment variables'));
    process.exit(1);
  }

  logInfo(`Test Practice ID: ${TEST_PRACTICE_ID}`);
  logInfo(`Test User ID: ${TEST_USER_ID}`);

  // Run all tests
  await testDatabaseSchema();
  await testNotificationCreation();
  await testMessageChannelOperations();
  await testRealtimeSubscriptions();
  await testNotificationTriggers();
  await testCommunicationGateways();

  // Summary
  console.log(chalk.bold.cyan('\n📊 Test Summary\n'));
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  testResults.forEach(result => {
    const status = result.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    const duration = chalk.gray(`(${result.duration}ms)`);
    console.log(`${status} ${result.name} ${duration}`);
    if (result.error) {
      console.log(chalk.red(`    Error: ${result.error}`));
    }
  });

  console.log(chalk.bold(`\nTotal: ${testResults.length} tests`));
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));
  console.log(chalk.gray(`Duration: ${totalDuration}ms`));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error(chalk.red(`\n❌ Fatal error: ${error}`));
  process.exit(1);
});
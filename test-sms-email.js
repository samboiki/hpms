// Simple test script for SMS and Email
// Run with: node test-sms-email.js

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test configuration
const TEST_PHONE = '+264812222331';
const TEST_EMAIL = 'ksnahol@gmail.com';
const PRACTICE_ID = '5da3896d-b9f3-4b0a-996a-3adca867cb30'; // Dr. Polina Aesthetic Clinic

async function testCommunication() {
  console.log('🚀 Testing Communication Gateway...\n');

  // Test SMS
  console.log('📱 Sending test SMS to', TEST_PHONE);
  try {
    const { data: smsData, error: smsError } = await supabase.functions.invoke('centralized-sms-gateway', {
      body: {
        practiceId: PRACTICE_ID,
        recipientPhone: TEST_PHONE,
        messageContent: `Test SMS from HPMS at ${new Date().toLocaleString()}. Your centralized SMS gateway is working!`,
        messageType: 'system',
        metadata: {
          source: 'test-sms-email.js',
          testRun: true
        }
      }
    });

    if (smsError) {
      console.error('❌ SMS Error:', smsError);
    } else {
      console.log('✅ SMS Result:', smsData);
    }
  } catch (error) {
    console.error('❌ SMS Exception:', error);
  }

  console.log('\n-------------------\n');

  // Test Email
  console.log('📧 Sending test email to', TEST_EMAIL);
  try {
    const { data: emailData, error: emailError } = await supabase.functions.invoke('centralized-email-gateway', {
      body: {
        practiceId: PRACTICE_ID,
        recipientEmail: TEST_EMAIL,
        recipientName: 'Test User',
        subject: 'Test Email from HPMS Centralized Gateway',
        htmlContent: `
          <h2>Test Email from HPMS</h2>
          <p>This is a test email sent at ${new Date().toLocaleString()}</p>
          <p>Your centralized email gateway is working correctly!</p>
        `,
        textContent: `Test Email from HPMS\n\nThis is a test email sent at ${new Date().toLocaleString()}\n\nYour centralized email gateway is working correctly!`,
        emailType: 'system',
        metadata: {
          source: 'test-sms-email.js',
          testRun: true
        }
      }
    });

    if (emailError) {
      console.error('❌ Email Error:', emailError);
    } else {
      console.log('✅ Email Result:', emailData);
    }
  } catch (error) {
    console.error('❌ Email Exception:', error);
  }

  console.log('\n-------------------\n');
  console.log('✅ Tests completed! Check your phone and email.');
  console.log('\n📊 Check logs in database:');
  console.log('SMS: SELECT * FROM practice_sms_logs ORDER BY created_at DESC LIMIT 5;');
  console.log('Email: SELECT * FROM practice_email_logs ORDER BY created_at DESC LIMIT 5;');
}

// Run the test
testCommunication().catch(console.error);
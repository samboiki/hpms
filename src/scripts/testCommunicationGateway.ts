import { communicationService } from '../services/communicationService';

// Test script for centralized communication gateway
async function testCommunicationGateway() {
  console.log('🚀 Testing Centralized Communication Gateway...\n');

  // Test configuration
  const testPhone = '+264812222331';
  const testEmail = 'ksnahol@gmail.com';
  
  // Using Dr. Polina Aesthetic Clinic for testing
  // You can change this to any valid practice ID from your database
  const practiceId = process.env.TEST_PRACTICE_ID || '5da3896d-b9f3-4b0a-996a-3adca867cb30';
  
  if (practiceId === 'YOUR_PRACTICE_ID_HERE') {
    console.error('❌ Please set a valid practice ID in the script or TEST_PRACTICE_ID environment variable');
    console.log('\nYou can find practice IDs by running:');
    console.log('SELECT id, name FROM practices;');
    return;
  }

  console.log(`📋 Test Configuration:`);
  console.log(`- Practice ID: ${practiceId}`);
  console.log(`- Test Phone: ${testPhone}`);
  console.log(`- Test Email: ${testEmail}`);
  console.log('\n-------------------\n');

  // Test 1: Send SMS
  console.log('📱 Test 1: Sending SMS...');
  try {
    const smsResult = await communicationService.sendSMS({
      practiceId: practiceId,
      recipientPhone: testPhone,
      messageContent: `Test SMS from HPMS Centralized Gateway. Time: ${new Date().toLocaleString()}. This confirms your SMS gateway is working correctly!`,
      messageType: 'system',
      metadata: {
        source: 'testCommunicationGateway',
        testRun: true,
        timestamp: new Date().toISOString()
      }
    });

    if (smsResult.success) {
      console.log('✅ SMS sent successfully!');
      console.log(`- Log ID: ${smsResult.logId}`);
      console.log(`- Message ID: ${smsResult.messageId || 'N/A'}`);
      console.log(`- Status: ${smsResult.status}`);
      if (smsResult.remainingCredits !== undefined) {
        console.log(`- Remaining Credits: ${smsResult.remainingCredits}`);
      }
    } else {
      console.error('❌ SMS failed:', smsResult.error);
    }
  } catch (error) {
    console.error('❌ SMS Error:', error);
  }

  console.log('\n-------------------\n');

  // Test 2: Send Email
  console.log('📧 Test 2: Sending Email...');
  try {
    const emailResult = await communicationService.sendEmail({
      practiceId: practiceId,
      recipientEmail: testEmail,
      recipientName: 'Test Recipient',
      subject: 'Test Email from HPMS Centralized Gateway',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Test Email from HPMS</h2>
          <p>This is a test email from the HPMS Centralized Communication Gateway.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p>If you're receiving this email, it means your email gateway is working correctly!</p>
          <hr />
          <p style="color: #666; font-size: 12px;">
            This email was sent through the centralized gateway which provides:
            <ul>
              <li>Complete audit trail</li>
              <li>Subscription management</li>
              <li>Delivery tracking</li>
              <li>Cost management</li>
            </ul>
          </p>
        </div>
      `,
      textContent: `Test Email from HPMS\n\nThis is a test email from the HPMS Centralized Communication Gateway.\n\nTimestamp: ${new Date().toLocaleString()}\n\nIf you're receiving this email, it means your email gateway is working correctly!`,
      emailType: 'system',
      metadata: {
        source: 'testCommunicationGateway',
        testRun: true,
        timestamp: new Date().toISOString()
      }
    });

    if (emailResult.success) {
      console.log('✅ Email sent successfully!');
      console.log(`- Log ID: ${emailResult.logId}`);
      console.log(`- Message ID: ${emailResult.messageId || 'N/A'}`);
      console.log(`- Status: ${emailResult.status}`);
    } else {
      console.error('❌ Email failed:', emailResult.error);
    }
  } catch (error) {
    console.error('❌ Email Error:', error);
  }

  console.log('\n-------------------\n');

  // Test 3: Check Subscription Status
  console.log('📊 Test 3: Checking Subscription Status...');
  try {
    const subscriptionStatus = await communicationService.checkSubscriptionStatus(practiceId);
    
    console.log('SMS Subscription:');
    console.log(`- Active: ${subscriptionStatus.sms.active ? '✅' : '❌'}`);
    console.log(`- Remaining: ${subscriptionStatus.sms.remaining}`);
    
    console.log('\nEmail Subscription:');
    console.log(`- Active: ${subscriptionStatus.email.active ? '✅' : '❌'}`);
    console.log(`- Remaining: ${subscriptionStatus.email.remaining}`);
  } catch (error) {
    console.error('❌ Subscription Check Error:', error);
  }

  console.log('\n-------------------\n');
  console.log('✅ Test completed! Check your phone and email for the test messages.');
  console.log('\n💡 You can also check the logs in your database:');
  console.log('- SMS Logs: SELECT * FROM practice_sms_logs ORDER BY created_at DESC LIMIT 5;');
  console.log('- Email Logs: SELECT * FROM practice_email_logs ORDER BY created_at DESC LIMIT 5;');
}

// Run the test
testCommunicationGateway().catch(console.error);
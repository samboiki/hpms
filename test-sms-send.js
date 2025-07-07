// Test script to send SMS via centralized gateway
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

async function sendTestSMS() {
  try {
    console.log('Sending welcome SMS to 0812222331...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/centralized-sms-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        practiceId: 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3',
        recipientPhone: '0812222331',
        messageContent: 'Dear S N Naholo Naholo, welcome to New Charm Dental Practice! We are excited to be your healthcare partner. Access your patient portal to manage appointments. Call +264 81 435 8843 for assistance.',
        messageType: 'automation',
        patientId: '37cfcc1a-22d1-4ef4-8cfa-142953c1802d',
        metadata: {
          automation_id: 'welcome-new-patient',
          automation_execution_id: '5071a573-9a54-420e-a712-f4e0b5291640',
          triggered_by: 'manual_test'
        }
      })
    });

    const result = await response.json();
    console.log('SMS Gateway response:', result);
    
    if (result.success) {
      console.log('✅ SMS sent successfully!');
      console.log('Log ID:', result.logId);
      console.log('Message ID:', result.messageId);
      console.log('Status:', result.status);
      console.log('Remaining credits:', result.remainingCredits);
    } else {
      console.error('❌ SMS sending failed:', result.error);
      console.error('Details:', result.details);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error calling SMS gateway:', error);
  }
}

// Run it
sendTestSMS();
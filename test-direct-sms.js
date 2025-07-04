// Direct SMS test
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjczMTMzNzcsImV4cCI6MjA0Mjg4OTM3N30.q6-a0gaVpGF1ZQRhmLgLkz5xGppXqz9v9xF4kLkyfGg';

async function testDirectSMS() {
  try {
    console.log('Testing direct SMS send...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/test-sms-send-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ SMS sent successfully!');
    } else {
      console.error('❌ SMS failed:', result.error);
      console.log('Has Client ID:', result.hasClientId);
      console.log('Has API Secret:', result.hasApiSecret);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run it
testDirectSMS();
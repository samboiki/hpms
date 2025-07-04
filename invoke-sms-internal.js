// Invoke the internal SMS sender
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjczMTMzNzcsImV4cCI6MjA0Mjg4OTM3N30.q6-a0gaVpGF1ZQRhmLgLkz5xGppXqz9v9xF4kLkyfGg';

async function invokeSmsInternal() {
  try {
    console.log('Invoking internal SMS sender...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-pending-sms-internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    console.log('Response:', result);
    
    if (result.success) {
      console.log('✅ SMS processing initiated successfully!');
    } else {
      console.error('❌ SMS processing failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error invoking internal SMS sender:', error);
  }
}

// Run it
invokeSmsInternal();
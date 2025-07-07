// Simple script to trigger the automation engine
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjczMTMzNzcsImV4cCI6MjA0Mjg4OTM3N30.q6-a0gaVpGF1ZQRhmLgLkz5xGppXqz9v9xF4kLkyfGg';

async function triggerAutomationEngine() {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/automation-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ trigger: 'manual' })
    });

    const result = await response.json();
    console.log('Automation engine response:', result);
    return result;
  } catch (error) {
    console.error('Error triggering automation engine:', error);
  }
}

// Run it
triggerAutomationEngine();
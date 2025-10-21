// 2025 Solution: Using Supabase Management API
const PROJECT_ID = 'jjxlfunlbyayxwvlpgwt';
const ACCESS_TOKEN = 'sbp_06ebe645acd5e8acbdf6adb17c635f317268ab0f';

async function executeViaManagementAPI() {
  console.log('🚀 2025 SOLUTION: Supabase Management API');
  console.log('================================================\n');

  try {
    // Execute SQL via Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          ALTER TABLE departments
          ADD COLUMN IF NOT EXISTS contact_email TEXT,
          ADD COLUMN IF NOT EXISTS contact_phone TEXT;
        `
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Management API response:', response.status, errorText);

      // Try alternative endpoint
      console.log('\n🔧 Trying alternative endpoint...');

      const altResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: `
            ALTER TABLE departments
            ADD COLUMN IF NOT EXISTS contact_email TEXT,
            ADD COLUMN IF NOT EXISTS contact_phone TEXT;
          `
        })
      });

      if (altResponse.ok) {
        const result = await altResponse.json();
        console.log('✅ SQL executed successfully via Management API!');
        console.log('Result:', result);
      } else {
        console.log('❌ Alternative endpoint also failed:', altResponse.status);
      }
    } else {
      const result = await response.json();
      console.log('✅ SQL executed successfully!');
      console.log('Result:', result);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

executeViaManagementAPI();
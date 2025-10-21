import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// Try multiple approaches to execute the SQL
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeSQL() {
  console.log('🚀 Attempting to execute SQL via multiple methods...\n');

  const sql = `
    ALTER TABLE departments
    ADD COLUMN IF NOT EXISTS contact_email TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT;
  `;

  // Method 1: Try direct REST API call
  try {
    console.log('🔄 Method 1: Direct REST API call...');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/sql',
        'Accept': 'application/json'
      },
      body: sql
    });

    if (response.ok) {
      console.log('✅ Method 1 successful!');
      const result = await response.text();
      console.log('Result:', result);
      return;
    } else {
      console.log('❌ Method 1 failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Method 1 error:', error.message);
  }

  // Method 2: Try with /rest/v1/rpc/exec
  try {
    console.log('\n🔄 Method 2: RPC exec...');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: sql
      })
    });

    if (response.ok) {
      console.log('✅ Method 2 successful!');
      const result = await response.json();
      console.log('Result:', result);
      return;
    } else {
      console.log('❌ Method 2 failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.log('❌ Method 2 error:', error.message);
  }

  // Final message
  console.log('\n🔧 Automatic execution failed. Please execute manually:');
  console.log('====================================================');
  console.log(sql);
  console.log('====================================================');
  console.log('\n📋 Instructions:');
  console.log('1. Go to https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Paste the SQL above');
  console.log('4. Click "Run"');
}

async function verifyColumns() {
  console.log('\n🔍 Verifying current table structure...');

  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error querying table:', error.message);
      return;
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log('📋 Current columns:', columns.join(', '));

      const hasContactEmail = columns.includes('contact_email');
      const hasContactPhone = columns.includes('contact_phone');

      console.log(`✅ contact_email: ${hasContactEmail ? 'EXISTS' : 'MISSING'}`);
      console.log(`✅ contact_phone: ${hasContactPhone ? 'EXISTS' : 'MISSING'}`);

      if (hasContactEmail && hasContactPhone) {
        console.log('🎉 Both columns exist! Migration completed.');
      }
    }
  } catch (error) {
    console.log('❌ Verification error:', error.message);
  }
}

async function main() {
  await verifyColumns();
  await executeSQL();
  await verifyColumns();
}

main().catch(console.error);
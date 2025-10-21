#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'jjxlfunlbyayxwvlpgwt';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkRpcFunctions() {
  console.log('🔍 Checking available RPC functions...\n');

  // Try to get schema info
  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/?apikey=${SERVICE_ROLE_KEY}`;

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const text = await response.text();
    console.log('API Root Response:', text.substring(0, 500));
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Try exec_raw_sql
  console.log('\n\n🔧 Trying exec_raw_sql with a simple SELECT...\n');
  const testUrl = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_raw_sql`;

  try {
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: 'SELECT 1 as test;' })
    });

    const responseText = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${responseText}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRpcFunctions();

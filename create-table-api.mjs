import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const createTableSQL = `
CREATE TABLE IF NOT EXISTS client_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_code TEXT,
  discipline_name TEXT,
  practice_number TEXT UNIQUE NOT NULL,
  practice_name TEXT,
  town TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_leads_practice_number ON client_leads(practice_number);
CREATE INDEX IF NOT EXISTS idx_client_leads_town ON client_leads(town);
CREATE INDEX IF NOT EXISTS idx_client_leads_discipline_name ON client_leads(discipline_name);

ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_leads'
    AND policyname = 'Service role has full access to client_leads'
  ) THEN
    CREATE POLICY "Service role has full access to client_leads"
      ON client_leads FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_leads'
    AND policyname = 'Authenticated users can read client_leads'
  ) THEN
    CREATE POLICY "Authenticated users can read client_leads"
      ON client_leads FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;
`.trim();

async function createTable() {
  console.log('📊 Creating client_leads table via Supabase Management API...\n');

  // Try using the Management API
  console.log('1️⃣ Attempting Management API approach...');

  try {
    // Use the Supabase Management API to execute SQL
    const managementUrl = `https://api.supabase.com/v1/projects/jjxlfunlbyayxwvlpgwt/database/query`;

    const response = await fetch(managementUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || supabaseServiceKey}`
      },
      body: JSON.stringify({
        query: createTableSQL
      })
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', responseText);

    if (response.ok) {
      console.log('✅ Table created successfully via Management API!');
      return true;
    } else {
      console.log('❌ Management API failed');
    }
  } catch (err) {
    console.log('❌ Management API error:', err.message);
  }

  // Try using direct database connection pooler
  console.log('\n2️⃣ Attempting direct REST API approach...');

  try {
    // Split SQL into individual statements
    const statements = createTableSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`   Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`\n   Statement ${i + 1}/${statements.length}:`);
      console.log(`   ${statement.substring(0, 60)}...`);

      // Try to execute via a custom RPC function (if it exists)
      const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ sql: statement })
      });

      if (rpcResponse.ok) {
        console.log(`   ✅ Statement ${i + 1} executed`);
      } else {
        const errorText = await rpcResponse.text();
        console.log(`   ⚠️  Statement ${i + 1} response: ${errorText.substring(0, 100)}`);
      }
    }
  } catch (err) {
    console.log('❌ Direct REST API error:', err.message);
  }

  // Final approach: Use PostgREST's built-in query capability
  console.log('\n3️⃣ Attempting PostgREST schema introspection...');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    console.log('PostgREST endpoint status:', response.status);

    if (response.ok) {
      const schema = await response.json();
      console.log('Available endpoints:', Object.keys(schema).slice(0, 10));
    }
  } catch (err) {
    console.log('❌ PostgREST error:', err.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('⚠️  MANUAL INTERVENTION REQUIRED');
  console.log('='.repeat(70));
  console.log('Please manually execute the SQL in your Supabase dashboard:');
  console.log('\n1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new');
  console.log('2. Copy and paste the SQL from: create-client-leads-table.sql');
  console.log('3. Run the SQL query');
  console.log('4. Then re-run the import script: node import-leads-final.mjs');
  console.log('='.repeat(70));

  return false;
}

createTable()
  .then(success => {
    if (success) {
      console.log('\n🎉 Table creation completed! You can now run the import script.');
      process.exit(0);
    } else {
      console.log('\n⏸️  Please create the table manually and then run the import.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

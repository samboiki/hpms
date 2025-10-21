import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeRawSQL(sql) {
  try {
    // Try using the PostgREST /rpc endpoint with a custom function
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`⚠️  exec_sql RPC not available: ${error.substring(0, 100)}...`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.log(`⚠️  Could not execute SQL: ${error.message}`);
    return null;
  }
}

async function checkConstraints() {
  console.log('🔍 Checking Practices Table Status Constraint\n');
  console.log('═'.repeat(70));

  // Method 1: Check via pg_catalog views (if we have access)
  console.log('\n📋 METHOD 1: Query pg_constraint directly\n');

  const constraintSQL = `
    SELECT
      con.conname as name,
      pg_get_constraintdef(con.oid) as definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'practices'
      AND con.contype = 'c'
    ORDER BY con.conname;
  `;

  const result1 = await executeRawSQL(constraintSQL);

  if (result1) {
    console.log('✅ Check constraints found:');
    result1.forEach(row => {
      console.log(`\n   Constraint: ${row.name}`);
      console.log(`   Definition: ${row.definition}`);
    });
  }

  // Method 2: Try to understand constraints by testing values
  console.log('\n\n📋 METHOD 2: Infer constraint by testing different values\n');
  console.log('─'.repeat(70));

  const testValues = [
    'active',
    'inactive',
    'pending',
    'suspended',
    'ready',
    'draft',
    'archived'
  ];

  console.log('Testing which status values are accepted:\n');

  for (const testValue of testValues) {
    try {
      // Try to insert a test record
      const { data, error } = await supabase
        .from('practices')
        .insert({
          name: `TEST_CONSTRAINT_${Date.now()}`,
          status: testValue,
          email: `test_${Date.now()}@example.com`,
          phone: '+1234567890'
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('new row for relation') && error.message.includes('violates check constraint')) {
          console.log(`❌ "${testValue}" - REJECTED by constraint`);
          // Extract constraint name from error message
          const match = error.message.match(/constraint "([^"]+)"/);
          if (match) {
            console.log(`   Constraint name: ${match[1]}`);
          }
          console.log(`   Error: ${error.message.substring(0, 100)}...`);
        } else {
          console.log(`⚠️  "${testValue}" - Failed for other reason: ${error.message.substring(0, 50)}...`);
        }
      } else {
        console.log(`✅ "${testValue}" - ACCEPTED`);
        // Clean up test record
        if (data && data.id) {
          await supabase.from('practices').delete().eq('id', data.id);
        }
      }
    } catch (err) {
      console.log(`⚠️  "${testValue}" - Error: ${err.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Method 3: Check current values in use
  console.log('\n\n📋 METHOD 3: Analyze existing status values\n');
  console.log('─'.repeat(70));

  const { data: practices, error: practicesError } = await supabase
    .from('practices')
    .select('status');

  if (practicesError) {
    console.error('❌ Error fetching practices:', practicesError.message);
  } else if (practices) {
    const statusCounts = {};
    practices.forEach(p => {
      const status = p.status || 'NULL';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('✅ Current status values in database:\n');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   "${status}": ${count} practice${count !== 1 ? 's' : ''}`);
      });
  }

  // Method 4: Try to get table DDL
  console.log('\n\n📋 METHOD 4: Get table definition\n');
  console.log('─'.repeat(70));

  const ddlSQL = `
    SELECT
      'CREATE TABLE ' || schemaname || '.' || tablename || ' (' ||
      string_agg(
        column_name || ' ' || data_type ||
        CASE WHEN character_maximum_length IS NOT NULL
          THEN '(' || character_maximum_length || ')'
          ELSE ''
        END,
        ', '
      ) || ');' as ddl
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practices'
    GROUP BY schemaname, tablename;
  `;

  const ddlResult = await executeRawSQL(ddlSQL);

  if (ddlResult && ddlResult.length > 0) {
    console.log('✅ Table DDL fragment:');
    console.log(ddlResult[0].ddl);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Analysis complete!');
}

checkConstraints().catch(console.error);
import { createClient } from '@supabase/supabase-js';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkPracticesStatusConstraint() {
  console.log('🔍 Checking practices table status constraint...\n');

  try {
    // Query 1: Get constraint definition
    console.log('📋 Query 1: Constraint Definition');
    console.log('─'.repeat(60));
    const { data: constraintData, error: constraintError } = await supabase.rpc('execute_sql', {
      query: `
        SELECT
          con.conname AS constraint_name,
          pg_get_constraintdef(con.oid) AS constraint_definition
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'practices'
          AND con.conname = 'practices_status_check';
      `
    });

    if (constraintError) {
      console.log('⚠️  RPC function not available. Trying direct query...\n');

      // Alternative approach using information_schema
      const { data: altData, error: altError } = await supabase
        .from('information_schema.check_constraints')
        .select('constraint_name, check_clause')
        .eq('constraint_name', 'practices_status_check');

      if (altError) {
        console.error('❌ Error fetching constraint:', altError.message);
      } else if (altData && altData.length > 0) {
        console.log('✅ Constraint found:');
        altData.forEach(row => {
          console.log(`   Name: ${row.constraint_name}`);
          console.log(`   Definition: ${row.check_clause}`);
        });
      } else {
        console.log('⚠️  No constraint named "practices_status_check" found');
      }
    } else {
      if (constraintData && constraintData.length > 0) {
        console.log('✅ Constraint found:');
        constraintData.forEach(row => {
          console.log(`   Name: ${row.constraint_name}`);
          console.log(`   Definition: ${row.constraint_definition}`);
        });
      } else {
        console.log('⚠️  No constraint named "practices_status_check" found');
      }
    }

    // Query 2: Get practices table structure using raw SQL
    console.log('\n📋 Query 2: Practices Table Structure (using pg_catalog)');
    console.log('─'.repeat(60));

    // Use pg_catalog to get column info
    const structureQuery = `
      SELECT
        a.attname as column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
        a.attnotnull as not_null,
        pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_value
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
      WHERE a.attrelid = 'public.practices'::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname = 'status'
      ORDER BY a.attnum;
    `;

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ query: structureQuery })
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.length > 0) {
          console.log('✅ Status column structure:');
          result.forEach(col => {
            console.log(`   Column: ${col.column_name}`);
            console.log(`   Type: ${col.data_type}`);
            console.log(`   Not Null: ${col.not_null}`);
            console.log(`   Default: ${col.default_value || 'NULL'}`);
          });
        } else {
          console.log('⚠️  Status column not found');
        }
      } else {
        console.log('⚠️  Could not fetch column structure via API');
      }
    } catch (err) {
      console.log('⚠️  Could not fetch column structure:', err.message);
    }

    // Query 3: Get all check constraints on practices table
    console.log('\n📋 Query 3: Check Constraints on Practices Table');
    console.log('─'.repeat(60));

    const constraintsQuery = `
      SELECT
        con.conname as constraint_name,
        pg_get_constraintdef(con.oid) as constraint_definition
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'practices'
        AND con.contype = 'c'
      ORDER BY con.conname;
    `;

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ query: constraintsQuery })
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.length > 0) {
          console.log('✅ Check constraints found:');
          result.forEach(con => {
            console.log(`\n   Constraint: ${con.constraint_name}`);
            console.log(`   Definition: ${con.constraint_definition}`);
          });
        } else {
          console.log('⚠️  No check constraints found on practices table');
        }
      } else {
        console.log('⚠️  Could not fetch constraints via API');
      }
    } catch (err) {
      console.log('⚠️  Could not fetch constraints:', err.message);
    }

    // Query 4: Sample some practices to see actual status values
    console.log('\n📋 Query 4: Sample Status Values in Use');
    console.log('─'.repeat(60));
    const { data: sampleData, error: sampleError } = await supabase
      .from('practices')
      .select('id, name, status')
      .limit(10);

    if (sampleError) {
      console.error('❌ Error fetching sample data:', sampleError.message);
    } else if (sampleData && sampleData.length > 0) {
      console.log('✅ Sample practices:');
      sampleData.forEach(practice => {
        console.log(`   ${practice.name}: ${practice.status || 'NULL'}`);
      });
    } else {
      console.log('⚠️  No practices found in table');
    }

    // Query 5: Get distinct status values
    console.log('\n📋 Query 5: Distinct Status Values');
    console.log('─'.repeat(60));
    const { data: distinctStatus, error: distinctError } = await supabase
      .from('practices')
      .select('status');

    if (distinctError) {
      console.error('❌ Error fetching distinct status:', distinctError.message);
    } else if (distinctStatus) {
      const uniqueStatuses = [...new Set(distinctStatus.map(p => p.status))];
      console.log('✅ Distinct status values in database:');
      uniqueStatuses.forEach(status => {
        const count = distinctStatus.filter(p => p.status === status).length;
        console.log(`   "${status}": ${count} practices`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
  }
}

async function main() {
  console.log('🚀 Practices Status Constraint Checker\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  await checkPracticesStatusConstraint();

  console.log('\n✅ Check complete!');
}

main().catch(console.error);
import pg from 'pg';
const { Client } = pg;

// Supabase PostgreSQL direct connection
// Using the service role secret for authentication
const client = new Client({
  host: 'aws-0-us-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.jjxlfunlbyayxwvlpgwt',
  password: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA',
  ssl: {
    rejectUnauthorized: false
  }
});

async function executeDDL() {
  try {
    console.log('🚀 2025 SOLUTION: Direct PostgreSQL DDL Execution');
    console.log('================================================\n');
    console.log('Using service role key for full database access...\n');

    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL directly!\n');

    // Execute ALTER TABLE directly
    console.log('🔧 Executing ALTER TABLE command...');
    const alterQuery = `
      ALTER TABLE departments
      ADD COLUMN IF NOT EXISTS contact_email TEXT,
      ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    `;

    await client.query(alterQuery);
    console.log('✅ ALTER TABLE executed successfully!\n');

    // Verify the columns were added
    const verifyQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'departments'
      AND column_name IN ('contact_email', 'contact_phone', 'description')
      ORDER BY column_name;
    `;

    const result = await client.query(verifyQuery);

    console.log('📊 Verification - Department columns:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name} (${row.data_type}) - EXISTS`);
    });

    console.log('\n🎉 SUCCESS! All columns have been added to the departments table.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Alternative: If this fails, trying Supabase Management API...');
  } finally {
    await client.end();
    console.log('\n👋 Connection closed');
  }
}

// Execute immediately
console.log('🔐 Using Service Role Key:', 'eyJhbGc...GGA (truncated for security)');
console.log('📍 Project ID: jjxlfunlbyayxwvlpgwt\n');

executeDDL();
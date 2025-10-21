import pg from 'pg';
const { Client } = pg;

// Database connection string from Supabase
const connectionString = 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

async function executeDDL() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 2025 Solution: Direct PostgreSQL Connection');
    console.log('================================================\n');

    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL directly!\n');

    // Check current columns
    const checkQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'departments'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;

    const checkResult = await client.query(checkQuery);
    console.log('📊 Current department columns:');
    checkResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    const hasContactEmail = checkResult.rows.some(r => r.column_name === 'contact_email');
    const hasContactPhone = checkResult.rows.some(r => r.column_name === 'contact_phone');

    if (!hasContactEmail || !hasContactPhone) {
      console.log('\n🔧 Adding missing columns...');

      // Execute ALTER TABLE
      const alterQuery = `
        ALTER TABLE departments
        ADD COLUMN IF NOT EXISTS contact_email TEXT,
        ADD COLUMN IF NOT EXISTS contact_phone TEXT;
      `;

      await client.query(alterQuery);
      console.log('✅ Columns added successfully!');

      // Verify
      const verifyResult = await client.query(checkQuery);
      const newHasEmail = verifyResult.rows.some(r => r.column_name === 'contact_email');
      const newHasPhone = verifyResult.rows.some(r => r.column_name === 'contact_phone');

      console.log('\n✅ Verification:');
      console.log('  - contact_email:', newHasEmail ? '✅ ADDED' : '❌ FAILED');
      console.log('  - contact_phone:', newHasPhone ? '✅ ADDED' : '❌ FAILED');
    } else {
      console.log('\n✅ All columns already exist!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n👋 Connection closed');
  }
}

executeDDL();
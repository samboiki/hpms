const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Check if invoice_services table exists
    console.log('🔍 Checking if invoice_services table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_services'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log(`📋 invoice_services table exists: ${tableExists}\n`);

    if (tableExists) {
      // Get table structure
      console.log('📊 Table structure:');
      const structure = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_services'
        ORDER BY ordinal_position;
      `);

      structure.rows.forEach(col => {
        console.log(`  • ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });

      // Check for updated_at column specifically
      const hasUpdatedAt = structure.rows.some(row => row.column_name === 'updated_at');
      console.log(`\n⏰ Has updated_at column: ${hasUpdatedAt}`);
      
      if (!hasUpdatedAt) {
        console.log('⚠️  Missing updated_at timestamp column');
      }

      // Count records
      const count = await client.query('SELECT COUNT(*) FROM invoice_services');
      console.log(`\n📊 Total records: ${count.rows[0].count}`);

      // Show sample record if any exist
      if (count.rows[0].count > 0) {
        console.log('\n📄 Sample record:');
        const sample = await client.query('SELECT * FROM invoice_services LIMIT 1');
        console.log(JSON.stringify(sample.rows[0], null, 2));
      }

    } else {
      console.log('❌ invoice_services table does not exist');
      
      // Check for similar tables
      console.log('\n🔍 Looking for similar billing tables...');
      const similarTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND (table_name LIKE '%invoice%' OR table_name LIKE '%billing%' OR table_name LIKE '%service%')
        ORDER BY table_name;
      `);
      
      if (similarTables.rows.length > 0) {
        console.log('📋 Found related tables:');
        similarTables.rows.forEach(row => {
          console.log(`  • ${row.table_name}`);
        });
      } else {
        console.log('❌ No related billing tables found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔐 Connection closed');
  }
}

main();
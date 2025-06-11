const { Client } = require('pg');

async function checkInvoiceServicesTable() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Check if invoice_services table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_services'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ invoice_services table does not exist');
      return;
    }

    console.log('✅ invoice_services table exists');

    // Get detailed table structure
    const tableStructure = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'invoice_services'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 invoice_services table structure:');
    console.log('==================================================');
    tableStructure.rows.forEach(col => {
      console.log(`Column: ${col.column_name}`);
      console.log(`  Type: ${col.data_type}`);
      console.log(`  Nullable: ${col.is_nullable}`);
      console.log(`  Default: ${col.column_default || 'None'}`);
      if (col.character_maximum_length) {
        console.log(`  Max Length: ${col.character_maximum_length}`);
      }
      if (col.numeric_precision) {
        console.log(`  Precision: ${col.numeric_precision}, Scale: ${col.numeric_scale}`);
      }
      console.log('');
    });

    // Check for constraints (primary keys, foreign keys, etc.)
    const constraints = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_name = 'invoice_services'
      AND tc.table_schema = 'public';
    `);

    console.log('🔗 Table constraints:');
    console.log('==================================================');
    constraints.rows.forEach(constraint => {
      console.log(`Constraint: ${constraint.constraint_name}`);
      console.log(`  Type: ${constraint.constraint_type}`);
      console.log(`  Column: ${constraint.column_name}`);
      if (constraint.foreign_table_name) {
        console.log(`  References: ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
      }
      console.log('');
    });

    // Check indexes
    const indexes = await client.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'invoice_services'
      AND schemaname = 'public';
    `);

    console.log('📊 Table indexes:');
    console.log('==================================================');
    indexes.rows.forEach(index => {
      console.log(`Index: ${index.indexname}`);
      console.log(`  Definition: ${index.indexdef}`);
      console.log('');
    });

    // Get sample data (first 3 rows)
    const sampleData = await client.query(`
      SELECT * FROM invoice_services 
      LIMIT 3;
    `);

    console.log('📄 Sample data (first 3 rows):');
    console.log('==================================================');
    if (sampleData.rows.length > 0) {
      console.log(JSON.stringify(sampleData.rows, null, 2));
    } else {
      console.log('No data found in table');
    }

    // Count total rows
    const rowCount = await client.query(`
      SELECT COUNT(*) as total_rows FROM invoice_services;
    `);

    console.log(`\n📊 Total rows in table: ${rowCount.rows[0].total_rows}`);

    // Check for missing common timestamp columns
    const columns = tableStructure.rows.map(row => row.column_name);
    const missingColumns = [];
    
    if (!columns.includes('created_at')) {
      missingColumns.push('created_at');
    }
    if (!columns.includes('updated_at')) {
      missingColumns.push('updated_at');
    }

    if (missingColumns.length > 0) {
      console.log('\n⚠️  Missing common timestamp columns:');
      missingColumns.forEach(col => console.log(`  - ${col}`));
    } else {
      console.log('\n✅ All common timestamp columns are present');
    }

    // Show CREATE TABLE statement for reference
    console.log('\n📝 Equivalent CREATE TABLE statement:');
    console.log('==================================================');
    let createTable = 'CREATE TABLE invoice_services (\n';
    tableStructure.rows.forEach((col, index) => {
      const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      const comma = index < tableStructure.rows.length - 1 ? ',' : '';
      createTable += `  ${col.column_name} ${col.data_type}${nullable}${defaultVal}${comma}\n`;
    });
    createTable += ');';
    console.log(createTable);

  } catch (error) {
    console.error('❌ Error checking invoice_services table:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.end();
    console.log('\n🔐 Database connection closed');
  }
}

// Run the function
checkInvoiceServicesTable()
  .then(() => {
    console.log('🎉 Table analysis completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Table analysis failed:', error);
    process.exit(1);
  });
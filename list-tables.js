import pg from 'pg';

const { Client } = pg;

async function listTables() {
  const client = new Client({
    host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'T@ngisasa200',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to HPMS database...');
    await client.connect();
    
    // Query to get all tables with row counts
    const tablesQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        obj_description(c.oid) as table_comment
      FROM 
        information_schema.tables t
        LEFT JOIN pg_catalog.pg_class c ON c.relname = t.table_name
        LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE 
        t.table_schema = 'public'
        AND t.table_type IN ('BASE TABLE', 'VIEW')
        AND n.nspname = 'public'
      ORDER BY 
        t.table_name;
    `;
    
    console.log('\n📊 Tables in HPMS Database:\n');
    const tablesResult = await client.query(tablesQuery);
    
    // Get row counts for each table
    for (const table of tablesResult.rows) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${table.table_name}`;
        const countResult = await client.query(countQuery);
        const count = countResult.rows[0].count;
        
        console.log(`📁 ${table.table_name}`);
        console.log(`   Type: ${table.table_type}`);
        console.log(`   Rows: ${count}`);
        if (table.table_comment) {
          console.log(`   Description: ${table.table_comment}`);
        }
        console.log('');
      } catch (err) {
        console.log(`📁 ${table.table_name}`);
        console.log(`   Type: ${table.table_type}`);
        console.log(`   Rows: Unable to count`);
        console.log('');
      }
    }
    
    // Get column information for core tables
    const coreTables = ['patients', 'visits', 'appointments', 'medical_records', 'users'];
    
    console.log('\n📋 Core Table Structures:\n');
    
    for (const tableName of coreTables) {
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM 
          information_schema.columns
        WHERE 
          table_schema = 'public'
          AND table_name = $1
        ORDER BY 
          ordinal_position;
      `;
      
      try {
        const columnsResult = await client.query(columnsQuery, [tableName]);
        if (columnsResult.rows.length > 0) {
          console.log(`\n🏥 ${tableName.toUpperCase()} table:`);
          console.log('─'.repeat(50));
          
          columnsResult.rows.forEach(col => {
            let type = col.data_type;
            if (col.character_maximum_length) {
              type += `(${col.character_maximum_length})`;
            }
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
            
            console.log(`  ${col.column_name}: ${type} ${nullable}${defaultVal}`);
          });
        }
      } catch (err) {
        console.log(`Error getting columns for ${tableName}: ${err.message}`);
      }
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

listTables();
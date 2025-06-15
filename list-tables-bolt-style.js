#!/usr/bin/env node

import pg from 'pg';

// 🔑 CONFIGURATION - Direct connection string format like bolt.new uses
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function listTablesLikeBolt() {
  console.log('🚀 Listing HPMS database tables using bolt.new style connection...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    // Query to get all tables
    const tablesQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)::regclass)) as size,
        obj_description(c.oid) as description
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
    
    console.log('📊 Tables in HPMS Database:\n');
    console.log('─'.repeat(80));
    
    const tablesResult = await client.query(tablesQuery);
    
    // Get row counts for each table
    for (const table of tablesResult.rows) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM "${table.table_name}"`;
        const countResult = await client.query(countQuery);
        const count = countResult.rows[0].count;
        
        console.log(`📁 ${table.table_name.padEnd(25)} | ${table.table_type.padEnd(10)} | ${count.toString().padStart(8)} rows | ${table.size.padStart(8)}`);
      } catch (err) {
        console.log(`📁 ${table.table_name.padEnd(25)} | ${table.table_type.padEnd(10)} | ${'-'.padStart(8)} rows | ${table.size.padStart(8)}`);
      }
    }
    
    console.log('─'.repeat(80));
    console.log(`\nTotal tables: ${tablesResult.rows.length}\n`);
    
    // Get detailed structure for core tables
    const coreTables = ['patients', 'visits', 'appointments', 'medical_records', 'users', 'medical_aid_details', 'vitals', 'lab_results'];
    
    console.log('\n📋 Core Table Structures:\n');
    
    for (const tableName of coreTables) {
      // Check if table exists in our results
      if (!tablesResult.rows.find(t => t.table_name === tableName)) {
        continue;
      }
      
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM 
          information_schema.columns
        WHERE 
          table_schema = 'public'
          AND table_name = $1
        ORDER BY 
          ordinal_position;
      `;
      
      const foreignKeysQuery = `
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = $1;
      `;
      
      try {
        const columnsResult = await client.query(columnsQuery, [tableName]);
        const fkeysResult = await client.query(foreignKeysQuery, [tableName]);
        
        if (columnsResult.rows.length > 0) {
          console.log(`\n🏥 ${tableName.toUpperCase()} table:`);
          console.log('─'.repeat(60));
          
          columnsResult.rows.forEach(col => {
            let type = col.data_type;
            if (col.character_maximum_length) {
              type += `(${col.character_maximum_length})`;
            } else if (col.numeric_precision) {
              type += `(${col.numeric_precision}${col.numeric_scale ? `,${col.numeric_scale}` : ''})`;
            }
            
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default.substring(0, 30)}...` : '';
            
            // Check if this column has a foreign key
            const fkey = fkeysResult.rows.find(fk => fk.column_name === col.column_name);
            const fkeyInfo = fkey ? ` → ${fkey.foreign_table_name}.${fkey.foreign_column_name}` : '';
            
            console.log(`  ${col.column_name.padEnd(30)} ${type.padEnd(20)} ${nullable}${fkeyInfo}`);
          });
          
          if (fkeysResult.rows.length > 0) {
            console.log(`\n  Foreign Keys: ${fkeysResult.rows.length}`);
          }
        }
      } catch (err) {
        console.log(`Error getting details for ${tableName}: ${err.message}`);
      }
    }
    
    // Get some statistics
    console.log('\n\n📈 Database Statistics:\n');
    console.log('─'.repeat(60));
    
    const statsQueries = [
      { name: 'Total Patients', query: 'SELECT COUNT(*) as count FROM patients' },
      { name: 'Total Visits', query: 'SELECT COUNT(*) as count FROM visits' },
      { name: 'Total Appointments', query: 'SELECT COUNT(*) as count FROM appointments' },
      { name: 'Total Users', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'Total Medical Records', query: 'SELECT COUNT(*) as count FROM medical_records' },
      { name: 'Total Lab Results', query: 'SELECT COUNT(*) as count FROM lab_results' }
    ];
    
    for (const stat of statsQueries) {
      try {
        const result = await client.query(stat.query);
        console.log(`  ${stat.name.padEnd(25)}: ${result.rows[0].count}`);
      } catch (err) {
        console.log(`  ${stat.name.padEnd(25)}: Error`);
      }
    }
    
    console.log('─'.repeat(60));
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Check if you have network connectivity');
    console.log('   2. Verify the database password is correct');
    console.log('   3. Ensure PostgreSQL is accepting connections');
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Execute the function
listTablesLikeBolt().catch(console.error);
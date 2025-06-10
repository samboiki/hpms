// EMERGENCY SCHEMA EXPORT - Using bolt.new style direct connection
const pg = require('pg');
const fs = require('fs');

async function emergencySchemaExport() {
  console.log('🚨 EMERGENCY SCHEMA EXPORT - Starting now...');
  
  const client = new pg.Client({
    host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'T@ngisasa200',
    ssl: false, // Try without SSL first
    connectionTimeoutMillis: 10000
  });

  try {
    console.log('🔗 Attempting direct PostgreSQL connection...');
    await client.connect();
    console.log('✅ Connected successfully!');

    let schema = `-- EMERGENCY SCHEMA EXPORT
-- Generated: ${new Date().toISOString()}
-- Connection: Direct PostgreSQL
-- Status: CRITICAL EXPORT

`;

    // 1. Get all tables with their complete structure
    console.log('📋 Fetching all tables...');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    console.log(`📊 Found ${tablesResult.rows.length} tables`);
    
    schema += `-- TABLES FOUND: ${tablesResult.rows.length}\n`;
    schema += `-- ${tablesResult.rows.map(r => r.table_name).join(', ')}\n\n`;

    // 2. For each table, get complete CREATE TABLE statement
    for (const table of tablesResult.rows) {
      console.log(`🔍 Analyzing table: ${table.table_name}`);
      
      try {
        // Get table structure
        const structureQuery = `
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            numeric_precision,
            numeric_scale,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position;
        `;
        
        const columns = await client.query(structureQuery, [table.table_name]);
        
        schema += `-- Table: ${table.table_name} (${columns.rows.length} columns)\n`;
        schema += `CREATE TABLE public.${table.table_name} (\n`;
        
        const columnDefs = columns.rows.map(col => {
          let def = `  ${col.column_name} ${col.data_type}`;
          
          if (col.character_maximum_length) {
            def += `(${col.character_maximum_length})`;
          } else if (col.numeric_precision && col.numeric_scale !== null) {
            def += `(${col.numeric_precision},${col.numeric_scale})`;
          } else if (col.numeric_precision) {
            def += `(${col.numeric_precision})`;
          }
          
          if (col.is_nullable === 'NO') {
            def += ' NOT NULL';
          }
          
          if (col.column_default) {
            def += ` DEFAULT ${col.column_default}`;
          }
          
          return def;
        });
        
        schema += columnDefs.join(',\n') + '\n);\n\n';

        // Get row count
        const countQuery = `SELECT COUNT(*) as count FROM public.${table.table_name};`;
        const countResult = await client.query(countQuery);
        schema += `-- Rows: ${countResult.rows[0].count}\n\n`;
        
      } catch (tableError) {
        console.log(`⚠️ Error with table ${table.table_name}:`, tableError.message);
        schema += `-- ERROR accessing table ${table.table_name}: ${tableError.message}\n\n`;
      }
    }

    // 3. Get all constraints
    console.log('🔑 Fetching constraints...');
    try {
      const constraintsQuery = `
        SELECT 
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public'
        GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
        ORDER BY tc.table_name, tc.constraint_type;
      `;
      
      const constraints = await client.query(constraintsQuery);
      
      schema += `\n-- CONSTRAINTS (${constraints.rows.length} found)\n`;
      constraints.rows.forEach(c => {
        schema += `-- ${c.constraint_type}: ${c.constraint_name} on ${c.table_name} (${c.columns?.join(', ') || 'N/A'})\n`;
      });
      schema += '\n';
      
    } catch (constraintError) {
      console.log('⚠️ Error fetching constraints:', constraintError.message);
      schema += `-- ERROR fetching constraints: ${constraintError.message}\n`;
    }

    // 4. Get foreign keys
    console.log('🔗 Fetching foreign keys...');
    try {
      const fkQuery = `
        SELECT 
          tc.table_name as source_table,
          kcu.column_name as source_column,
          ccu.table_name AS target_table,
          ccu.column_name AS target_column,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name;
      `;
      
      const foreignKeys = await client.query(fkQuery);
      
      schema += `\n-- FOREIGN KEYS (${foreignKeys.rows.length} found)\n`;
      foreignKeys.rows.forEach(fk => {
        schema += `-- ${fk.source_table}.${fk.source_column} -> ${fk.target_table}.${fk.target_column}\n`;
      });
      schema += '\n';
      
    } catch (fkError) {
      console.log('⚠️ Error fetching foreign keys:', fkError.message);
      schema += `-- ERROR fetching foreign keys: ${fkError.message}\n`;
    }

    // 5. Get functions
    console.log('⚙️ Fetching functions...');
    try {
      const functionsQuery = `
        SELECT 
          p.proname as function_name,
          pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname;
      `;
      
      const functions = await client.query(functionsQuery);
      
      schema += `\n-- FUNCTIONS (${functions.rows.length} found)\n`;
      functions.rows.forEach(f => {
        schema += `-- Function: ${f.function_name}\n`;
        schema += `${f.definition}\n\n`;
      });
      
    } catch (funcError) {
      console.log('⚠️ Error fetching functions:', funcError.message);
      schema += `-- ERROR fetching functions: ${funcError.message}\n`;
    }

    // 6. Get RLS policies
    console.log('🔒 Fetching RLS policies...');
    try {
      const rlsQuery = `
        SELECT 
          schemaname,
          tablename,
          policyname,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
      `;
      
      const policies = await client.query(rlsQuery);
      
      schema += `\n-- RLS POLICIES (${policies.rows.length} found)\n`;
      policies.rows.forEach(p => {
        schema += `-- Policy: ${p.policyname} on ${p.tablename}\n`;
        schema += `-- Command: ${p.cmd}\n`;
        if (p.qual) schema += `-- Using: ${p.qual}\n`;
        if (p.with_check) schema += `-- With Check: ${p.with_check}\n`;
        schema += '\n';
      });
      
    } catch (rlsError) {
      console.log('⚠️ Error fetching RLS policies:', rlsError.message);
      schema += `-- ERROR fetching RLS policies: ${rlsError.message}\n`;
    }

    // 7. Get current database state
    console.log('📊 Getting database statistics...');
    try {
      const statsQuery = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `;
      
      const stats = await client.query(statsQuery);
      
      schema += `\n-- DATABASE STATISTICS\n`;
      schema += `-- Table | Live Rows | Dead Rows | Inserts | Updates | Deletes\n`;
      stats.rows.forEach(s => {
        schema += `-- ${s.tablename} | ${s.live_rows} | ${s.dead_rows} | ${s.inserts} | ${s.updates} | ${s.deletes}\n`;
      });
      schema += '\n';
      
    } catch (statsError) {
      console.log('⚠️ Error fetching statistics:', statsError.message);
      schema += `-- ERROR fetching statistics: ${statsError.message}\n`;
    }

    // Write the schema
    const filename = `EMERGENCY_SCHEMA_${Date.now()}.sql`;
    fs.writeFileSync(filename, schema);

    console.log(`\n🚨 EMERGENCY EXPORT COMPLETE!`);
    console.log(`📄 File: ${filename}`);
    console.log(`💾 Size: ${(fs.statSync(filename).size / 1024).toFixed(2)} KB`);
    console.log(`📊 Tables: ${tablesResult.rows.length}`);

    return filename;

  } catch (error) {
    console.error('💥 EMERGENCY EXPORT FAILED:', error);
    
    // Try alternative connection without SSL
    if (error.message.includes('SSL') || error.message.includes('ssl')) {
      console.log('🔄 Retrying with SSL disabled...');
      
      const altClient = new pg.Client({
        host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'T@ngisasa200',
        ssl: { rejectUnauthorized: false }
      });
      
      try {
        await altClient.connect();
        console.log('✅ Alternative connection successful!');
        await altClient.end();
        return emergencySchemaExport(); // Retry with working connection
      } catch (altError) {
        console.error('💥 Alternative connection also failed:', altError.message);
      }
    }
    
    // Last resort - create emergency recovery commands
    const recoveryCommands = `-- EMERGENCY RECOVERY COMMANDS
-- Run these immediately if you have PostgreSQL client access:

-- 1. Quick schema export
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres --schema-only > emergency_schema.sql

-- 2. Critical tables backup
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres --data-only --table=practices --table=patients --table=appointments > critical_data.sql

-- 3. Full database backup
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres > full_backup.sql

-- Connection details:
-- PGPASSWORD=T@ngisasa200
-- Host: db.jjxlfunlbyayxwvlpgwt.supabase.co
-- Port: 5432
-- Database: postgres
-- User: postgres
`;

    const emergencyFile = `EMERGENCY_RECOVERY_${Date.now()}.sql`;
    fs.writeFileSync(emergencyFile, recoveryCommands);
    console.log(`🆘 Emergency recovery commands written to: ${emergencyFile}`);
    
    throw error;
  } finally {
    await client.end();
  }
}

emergencySchemaExport().catch(console.error);
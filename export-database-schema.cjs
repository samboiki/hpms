const { Client } = require('pg');
const fs = require('fs');

async function exportDatabaseSchema() {
  // Try different connection configurations
  const connectionConfigs = [
    {
      host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'T@ngisasa200',
      ssl: { rejectUnauthorized: false }
    },
    {
      connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
      ssl: { rejectUnauthorized: false }
    }
  ];

  let client;
  let connected = false;

  for (let i = 0; i < connectionConfigs.length && !connected; i++) {
    try {
      console.log(`🔄 Trying connection method ${i + 1}...`);
      client = new Client(connectionConfigs[i]);
      await client.connect();
      connected = true;
      console.log('🔗 Connected to database successfully');
    } catch (error) {
      console.log(`❌ Connection method ${i + 1} failed:`, error.message);
      if (client) {
        try { await client.end(); } catch (e) {}
      }
    }
  }

  if (!connected) {
    console.error('❌ All connection methods failed. Please check your network connection.');
    return;
  }

  try {

    let schemaExport = `-- ============================================
-- HPMS Database Schema Export
-- Generated on: ${new Date().toISOString()}
-- Database: PostgreSQL (Supabase)
-- ============================================

`;

    // 1. Export Tables Schema
    console.log('📋 Exporting table schemas...');
    const tablesQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        obj_description(c.oid) as table_comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE 'pg_%'
        AND t.table_name NOT LIKE 'sql_%'
      ORDER BY t.table_name;
    `;

    const tablesResult = await client.query(tablesQuery);
    
    schemaExport += `\n-- ============================================\n-- TABLES SCHEMA\n-- ============================================\n\n`;

    for (const table of tablesResult.rows) {
      console.log(`  📊 Exporting table: ${table.table_name}`);
      
      // Get CREATE TABLE statement
      const createTableQuery = `
        SELECT 
          'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || E'\n' ||
          array_to_string(
            array_agg(
              '  ' || column_name || ' ' || data_type || 
              CASE 
                WHEN character_maximum_length IS NOT NULL 
                THEN '(' || character_maximum_length || ')'
                WHEN numeric_precision IS NOT NULL AND numeric_scale IS NOT NULL
                THEN '(' || numeric_precision || ',' || numeric_scale || ')'
                WHEN numeric_precision IS NOT NULL
                THEN '(' || numeric_precision || ')'
                ELSE ''
              END ||
              CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END
              ORDER BY ordinal_position
            ), 
            ',' || E'\n'
          ) || E'\n);' as create_statement
        FROM information_schema.columns c
        LEFT JOIN pg_tables t ON t.tablename = c.table_name
        WHERE c.table_name = $1 AND c.table_schema = 'public'
        GROUP BY schemaname, tablename;
      `;

      try {
        const createResult = await client.query(createTableQuery, [table.table_name]);
        if (createResult.rows.length > 0) {
          schemaExport += `-- Table: ${table.table_name}\n`;
          if (table.table_comment) {
            schemaExport += `-- Description: ${table.table_comment}\n`;
          }
          schemaExport += createResult.rows[0].create_statement + '\n\n';
        }
      } catch (err) {
        console.log(`  ⚠️  Could not get CREATE statement for ${table.table_name}: ${err.message}`);
        
        // Fallback: Get column information manually
        const columnsQuery = `
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
        
        const columnsResult = await client.query(columnsQuery, [table.table_name]);
        
        schemaExport += `-- Table: ${table.table_name}\n`;
        schemaExport += `CREATE TABLE public.${table.table_name} (\n`;
        
        const columnDefs = columnsResult.rows.map(col => {
          let def = `  ${col.column_name} ${col.data_type}`;
          
          if (col.character_maximum_length) {
            def += `(${col.character_maximum_length})`;
          } else if (col.numeric_precision && col.numeric_scale) {
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
        
        schemaExport += columnDefs.join(',\n') + '\n);\n\n';
      }
    }

    // 2. Export Primary Keys and Constraints
    console.log('🔑 Exporting constraints...');
    schemaExport += `\n-- ============================================\n-- PRIMARY KEYS AND CONSTRAINTS\n-- ============================================\n\n`;

    const constraintsQuery = `
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        tc.is_deferrable,
        tc.initially_deferred,
        check_clause
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `;

    const constraintsResult = await client.query(constraintsQuery);
    
    for (const constraint of constraintsResult.rows) {
      if (constraint.constraint_type === 'PRIMARY KEY') {
        schemaExport += `ALTER TABLE public.${constraint.table_name} ADD CONSTRAINT ${constraint.constraint_name} PRIMARY KEY (${constraint.column_name});\n`;
      } else if (constraint.constraint_type === 'UNIQUE') {
        schemaExport += `ALTER TABLE public.${constraint.table_name} ADD CONSTRAINT ${constraint.constraint_name} UNIQUE (${constraint.column_name});\n`;
      } else if (constraint.constraint_type === 'CHECK') {
        schemaExport += `ALTER TABLE public.${constraint.table_name} ADD CONSTRAINT ${constraint.constraint_name} CHECK ${constraint.check_clause};\n`;
      }
    }

    // 3. Export Foreign Keys
    console.log('🔗 Exporting foreign key relationships...');
    schemaExport += `\n-- ============================================\n-- FOREIGN KEY RELATIONSHIPS\n-- ============================================\n\n`;

    const foreignKeysQuery = `
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;

    const foreignKeysResult = await client.query(foreignKeysQuery);
    
    for (const fk of foreignKeysResult.rows) {
      schemaExport += `ALTER TABLE public.${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
      schemaExport += `FOREIGN KEY (${fk.column_name}) REFERENCES public.${fk.foreign_table_name}(${fk.foreign_column_name})`;
      
      if (fk.update_rule !== 'NO ACTION') {
        schemaExport += ` ON UPDATE ${fk.update_rule}`;
      }
      if (fk.delete_rule !== 'NO ACTION') {
        schemaExport += ` ON DELETE ${fk.delete_rule}`;
      }
      schemaExport += ';\n';
    }

    // 4. Export Indexes
    console.log('📇 Exporting indexes...');
    schemaExport += `\n-- ============================================\n-- INDEXES\n-- ============================================\n\n`;

    const indexesQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `;

    const indexesResult = await client.query(indexesQuery);
    
    for (const index of indexesResult.rows) {
      schemaExport += `${index.indexdef};\n`;
    }

    // 5. Export Functions
    console.log('⚙️ Exporting functions...');
    schemaExport += `\n-- ============================================\n-- FUNCTIONS\n-- ============================================\n\n`;

    const functionsQuery = `
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition,
        obj_description(p.oid) as function_comment
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
      ORDER BY p.proname;
    `;

    const functionsResult = await client.query(functionsQuery);
    
    for (const func of functionsResult.rows) {
      schemaExport += `-- Function: ${func.function_name}\n`;
      if (func.function_comment) {
        schemaExport += `-- Description: ${func.function_comment}\n`;
      }
      schemaExport += `${func.function_definition}\n\n`;
    }

    // 6. Export Triggers
    console.log('🎯 Exporting triggers...');
    schemaExport += `\n-- ============================================\n-- TRIGGERS\n-- ============================================\n\n`;

    const triggersQuery = `
      SELECT 
        t.trigger_name,
        t.event_manipulation,
        t.event_object_table,
        t.action_statement,
        t.action_timing,
        t.action_orientation
      FROM information_schema.triggers t
      WHERE t.trigger_schema = 'public'
      ORDER BY t.event_object_table, t.trigger_name;
    `;

    const triggersResult = await client.query(triggersQuery);
    
    for (const trigger of triggersResult.rows) {
      schemaExport += `-- Trigger: ${trigger.trigger_name} on ${trigger.event_object_table}\n`;
      schemaExport += `CREATE TRIGGER ${trigger.trigger_name}\n`;
      schemaExport += `  ${trigger.action_timing} ${trigger.event_manipulation}\n`;
      schemaExport += `  ON public.${trigger.event_object_table}\n`;
      schemaExport += `  FOR EACH ${trigger.action_orientation}\n`;
      schemaExport += `  ${trigger.action_statement};\n\n`;
    }

    // 7. Export Views
    console.log('👁️ Exporting views...');
    schemaExport += `\n-- ============================================\n-- VIEWS\n-- ============================================\n\n`;

    const viewsQuery = `
      SELECT 
        table_name,
        view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    const viewsResult = await client.query(viewsQuery);
    
    for (const view of viewsResult.rows) {
      schemaExport += `-- View: ${view.table_name}\n`;
      schemaExport += `CREATE VIEW public.${view.table_name} AS\n${view.view_definition}\n\n`;
    }

    // 8. Export RLS Policies
    console.log('🔒 Exporting RLS policies...');
    schemaExport += `\n-- ============================================\n-- ROW LEVEL SECURITY POLICIES\n-- ============================================\n\n`;

    const rlsQuery = `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;

    const rlsResult = await client.query(rlsQuery);
    
    for (const policy of rlsResult.rows) {
      schemaExport += `-- RLS Policy: ${policy.policyname} on ${policy.tablename}\n`;
      schemaExport += `CREATE POLICY ${policy.policyname} ON public.${policy.tablename}\n`;
      schemaExport += `  AS ${policy.permissive} FOR ${policy.cmd}\n`;
      if (policy.roles && policy.roles.length > 0) {
        schemaExport += `  TO ${policy.roles.join(', ')}\n`;
      }
      if (policy.qual) {
        schemaExport += `  USING (${policy.qual})\n`;
      }
      if (policy.with_check) {
        schemaExport += `  WITH CHECK (${policy.with_check})\n`;
      }
      schemaExport += ';\n\n';
    }

    // Write to file
    const filename = `hpms_database_schema_${new Date().toISOString().split('T')[0]}.sql`;
    fs.writeFileSync(filename, schemaExport);
    
    console.log(`\n✅ Database schema exported successfully!`);
    console.log(`📄 File: ${filename}`);
    console.log(`📊 Tables: ${tablesResult.rows.length}`);
    console.log(`🔗 Foreign Keys: ${foreignKeysResult.rows.length}`);
    console.log(`📇 Indexes: ${indexesResult.rows.length}`);
    console.log(`⚙️ Functions: ${functionsResult.rows.length}`);
    console.log(`🎯 Triggers: ${triggersResult.rows.length}`);
    console.log(`👁️ Views: ${viewsResult.rows.length}`);
    console.log(`🔒 RLS Policies: ${rlsResult.rows.length}`);

  } catch (error) {
    console.error('❌ Error exporting database schema:', error);
  } finally {
    await client.end();
  }
}

exportDatabaseSchema();
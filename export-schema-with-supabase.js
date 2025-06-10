import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Use the same configuration as your app
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTUxOTI1NCwiZXhwIjoyMDMxMDk1MjU0fQ.eSzOcKJglgwlDEy4DIE5_k6hCkrtKUpb_rqSJb4JJVk'; // Service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function exportDatabaseSchema() {
  console.log('🔄 Starting database schema export...');
  
  let schemaExport = `-- ============================================
-- HPMS Database Schema Export
-- Generated on: ${new Date().toISOString()}
-- Database: Supabase PostgreSQL
-- ============================================

`;

  try {
    // 1. Get all tables
    console.log('📋 Fetching table information...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')
      .not('table_name', 'like', 'pg_%')
      .not('table_name', 'like', 'sql_%')
      .order('table_name');

    if (tablesError) {
      console.error('❌ Error fetching tables:', tablesError);
      return;
    }

    console.log(`📊 Found ${tables.length} tables`);
    schemaExport += `\n-- ============================================\n-- TABLES (${tables.length} found)\n-- ============================================\n\n`;

    for (const table of tables) {
      schemaExport += `-- Table: ${table.table_name}\n`;
    }

    // 2. Get columns for each table
    console.log('📋 Fetching column information...');
    schemaExport += `\n-- ============================================\n-- TABLE COLUMNS\n-- ============================================\n\n`;

    for (const table of tables) {
      console.log(`  📊 Processing table: ${table.table_name}`);
      
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select(`
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default,
          ordinal_position
        `)
        .eq('table_name', table.table_name)
        .eq('table_schema', 'public')
        .order('ordinal_position');

      if (!columnsError && columns) {
        schemaExport += `-- Table: ${table.table_name}\n`;
        schemaExport += `CREATE TABLE public.${table.table_name} (\n`;
        
        const columnDefs = columns.map(col => {
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

    // 3. Get constraints
    console.log('🔑 Fetching constraints...');
    const { data: constraints } = await supabase
      .from('information_schema.table_constraints')
      .select(`
        table_name,
        constraint_name,
        constraint_type
      `)
      .eq('table_schema', 'public')
      .in('constraint_type', ['PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY'])
      .order('table_name');

    if (constraints) {
      schemaExport += `\n-- ============================================\n-- CONSTRAINTS (${constraints.length} found)\n-- ============================================\n\n`;
      
      constraints.forEach(constraint => {
        schemaExport += `-- ${constraint.constraint_type}: ${constraint.constraint_name} on ${constraint.table_name}\n`;
      });
      schemaExport += '\n';
    }

    // 4. Export what we can get via Supabase client
    console.log('📋 Adding additional information...');
    schemaExport += `\n-- ============================================\n-- ADDITIONAL INFORMATION\n-- ============================================\n\n`;
    
    schemaExport += `-- Note: This export was generated using Supabase client\n`;
    schemaExport += `-- For complete schema including functions, triggers, and policies,\n`;
    schemaExport += `-- use direct PostgreSQL connection or Supabase Dashboard export\n\n`;

    schemaExport += `-- Tables exported: ${tables.map(t => t.table_name).join(', ')}\n\n`;

    // Write to file
    const filename = `hpms_schema_export_${new Date().toISOString().split('T')[0]}.sql`;
    fs.writeFileSync(filename, schemaExport);
    
    console.log(`\n✅ Database schema exported successfully!`);
    console.log(`📄 File: ${filename}`);
    console.log(`📊 Tables: ${tables.length}`);
    console.log(`🔑 Constraints: ${constraints?.length || 0}`);

    // Also create a summary file
    const summary = {
      export_date: new Date().toISOString(),
      database_url: supabaseUrl,
      tables_count: tables.length,
      tables: tables.map(t => ({
        name: t.table_name,
        type: t.table_type
      })),
      constraints_count: constraints?.length || 0
    };

    const summaryFilename = `hpms_schema_summary_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(summaryFilename, JSON.stringify(summary, null, 2));
    console.log(`📋 Summary: ${summaryFilename}`);

  } catch (error) {
    console.error('❌ Error exporting database schema:', error);
  }
}

exportDatabaseSchema();
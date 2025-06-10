// Generate PostgreSQL commands for schema export
// Since direct connection isn't working, this creates the commands you can run

const fs = require('fs');

function generateSchemaExportCommands() {
  const timestamp = new Date().toISOString().split('T')[0];
  const password = 'T@ngisasa200';
  const host = 'db.jjxlfunlbyayxwvlpgwt.supabase.co';
  const database = 'postgres';
  const user = 'postgres';
  
  let commands = `#!/bin/bash
# ============================================
# HPMS Database Schema Export Commands
# Generated on: ${new Date().toISOString()}
# ============================================

# Set password for non-interactive mode
export PGPASSWORD="${password}"

echo "🔄 Starting database schema export..."

# 1. Export complete schema structure (no data)
echo "📋 Exporting schema structure..."
pg_dump -h ${host} -U ${user} -d ${database} \\
  --schema-only \\
  --no-owner \\
  --no-privileges \\
  --verbose \\
  -f "hpms_schema_structure_${timestamp}.sql"

# 2. Export only table definitions
echo "📊 Exporting table definitions..."
pg_dump -h ${host} -U ${user} -d ${database} \\
  --schema-only \\
  --no-owner \\
  --no-privileges \\
  --table='public.*' \\
  -f "hpms_tables_only_${timestamp}.sql"

# 3. Export functions and procedures
echo "⚙️ Exporting functions..."
pg_dump -h ${host} -U ${user} -d ${database} \\
  --schema-only \\
  --no-owner \\
  --no-privileges \\
  --section=pre-data \\
  --section=post-data \\
  -f "hpms_functions_${timestamp}.sql"

# 4. Export data for specific tables (configuration tables only)
echo "💾 Exporting configuration data..."
pg_dump -h ${host} -U ${user} -d ${database} \\
  --data-only \\
  --no-owner \\
  --no-privileges \\
  --table=practices \\
  --table=practice_types \\
  --table=medical_aid_providers \\
  --table=dental_tariffs \\
  -f "hpms_config_data_${timestamp}.sql"

# 5. Export complete database (structure + data) - CAUTION: Large file
echo "💽 Exporting complete database..."
pg_dump -h ${host} -U ${user} -d ${database} \\
  --no-owner \\
  --no-privileges \\
  --verbose \\
  -f "hpms_complete_backup_${timestamp}.sql"

# 6. Create custom queries for detailed analysis
echo "🔍 Running custom analysis queries..."

# List all tables with row counts
psql -h ${host} -U ${user} -d ${database} -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
" > "hpms_table_sizes_${timestamp}.txt"

# List all constraints
psql -h ${host} -U ${user} -d ${database} -c "
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
" > "hpms_constraints_${timestamp}.txt"

# List all foreign key relationships
psql -h ${host} -U ${user} -d ${database} -c "
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
" > "hpms_foreign_keys_${timestamp}.txt"

# List all functions
psql -h ${host} -U ${user} -d ${database} -c "
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
" > "hpms_functions_list_${timestamp}.txt"

# List all triggers
psql -h ${host} -U ${user} -d ${database} -c "
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.event_object_table,
  t.action_timing
FROM information_schema.triggers t
WHERE t.trigger_schema = 'public'
ORDER BY t.event_object_table, t.trigger_name;
" > "hpms_triggers_${timestamp}.txt"

# List all RLS policies
psql -h ${host} -U ${user} -d ${database} -c "
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
" > "hpms_rls_policies_${timestamp}.txt"

echo "✅ Schema export completed!"
echo "📄 Files generated:"
echo "  - hpms_schema_structure_${timestamp}.sql (Complete schema structure)"
echo "  - hpms_tables_only_${timestamp}.sql (Tables only)"
echo "  - hpms_functions_${timestamp}.sql (Functions and procedures)"
echo "  - hpms_config_data_${timestamp}.sql (Configuration data)"
echo "  - hpms_complete_backup_${timestamp}.sql (Complete backup)"
echo "  - hpms_*_${timestamp}.txt (Analysis reports)"

# Cleanup
unset PGPASSWORD
`;

  // Also create a Windows batch file version
  let windowsCommands = `@echo off
REM ============================================
REM HPMS Database Schema Export Commands (Windows)
REM Generated on: ${new Date().toISOString()}
REM ============================================

set PGPASSWORD=${password}

echo Starting database schema export...

echo Exporting schema structure...
pg_dump -h ${host} -U ${user} -d ${database} --schema-only --no-owner --no-privileges --verbose -f "hpms_schema_structure_${timestamp}.sql"

echo Exporting table definitions...
pg_dump -h ${host} -U ${user} -d ${database} --schema-only --no-owner --no-privileges --table=public.* -f "hpms_tables_only_${timestamp}.sql"

echo Exporting functions...
pg_dump -h ${host} -U ${user} -d ${database} --schema-only --no-owner --no-privileges --section=pre-data --section=post-data -f "hpms_functions_${timestamp}.sql"

echo Exporting configuration data...
pg_dump -h ${host} -U ${user} -d ${database} --data-only --no-owner --no-privileges --table=practices --table=practice_types --table=medical_aid_providers --table=dental_tariffs -f "hpms_config_data_${timestamp}.sql"

echo Exporting complete database...
pg_dump -h ${host} -U ${user} -d ${database} --no-owner --no-privileges --verbose -f "hpms_complete_backup_${timestamp}.sql"

echo Schema export completed!

set PGPASSWORD=
`;

  // Create SQL commands that can be run directly in any PostgreSQL client
  let sqlCommands = `-- ============================================
-- HPMS Database Schema Export SQL Commands
-- Generated on: ${new Date().toISOString()}
-- Run these in your PostgreSQL client
-- ============================================

-- 1. List all tables with their columns
SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.character_maximum_length,
  c.is_nullable,
  c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 2. List all constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- 3. List all foreign key relationships
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

-- 4. List all functions
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 5. List all triggers
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.event_object_table,
  t.action_timing,
  t.action_statement
FROM information_schema.triggers t
WHERE t.trigger_schema = 'public'
ORDER BY t.event_object_table, t.trigger_name;

-- 6. List all RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. Get table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 8. List all indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
`;

  // Write all files
  fs.writeFileSync(`export_hpms_schema_${timestamp}.sh`, commands);
  fs.writeFileSync(`export_hpms_schema_${timestamp}.bat`, windowsCommands);
  fs.writeFileSync(`hpms_schema_queries_${timestamp}.sql`, sqlCommands);

  console.log('✅ Schema export command files generated!');
  console.log(`📄 Files created:`);
  console.log(`  - export_hpms_schema_${timestamp}.sh (Linux/Mac script)`);
  console.log(`  - export_hpms_schema_${timestamp}.bat (Windows script)`);
  console.log(`  - hpms_schema_queries_${timestamp}.sql (SQL commands)`);
  console.log('');
  console.log('📋 Instructions:');
  console.log('1. On Linux/Mac: chmod +x export_hpms_schema_*.sh && ./export_hpms_schema_*.sh');
  console.log('2. On Windows: Run export_hpms_schema_*.bat');
  console.log('3. Or execute the SQL commands in your PostgreSQL client');
  console.log('');
  console.log('⚠️  Requirements:');
  console.log('- PostgreSQL client tools (pg_dump, psql) must be installed');
  console.log('- Network access to Supabase database');
  console.log('- Proper firewall/security group settings');
  
  return timestamp;
}

generateSchemaExportCommands();
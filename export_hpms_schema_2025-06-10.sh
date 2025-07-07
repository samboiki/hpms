#!/bin/bash
# ============================================
# HPMS Database Schema Export Commands
# Generated on: 2025-06-10T20:58:36.501Z
# ============================================

# Set password for non-interactive mode
export PGPASSWORD="T@ngisasa200"

echo "🔄 Starting database schema export..."

# 1. Export complete schema structure (no data)
echo "📋 Exporting schema structure..."
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres \
  --schema-only \
  --no-owner \
  --no-privileges \
  --verbose \
  -f "hpms_schema_structure_2025-06-10.sql"

# 2. Export only table definitions
echo "📊 Exporting table definitions..."
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres \
  --schema-only \
  --no-owner \
  --no-privileges \
  --table='public.*' \
  -f "hpms_tables_only_2025-06-10.sql"

# 3. Export functions and procedures
echo "⚙️ Exporting functions..."
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres \
  --schema-only \
  --no-owner \
  --no-privileges \
  --section=pre-data \
  --section=post-data \
  -f "hpms_functions_2025-06-10.sql"

# 4. Export data for specific tables (configuration tables only)
echo "💾 Exporting configuration data..."
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres \
  --data-only \
  --no-owner \
  --no-privileges \
  --table=practices \
  --table=practice_types \
  --table=medical_aid_providers \
  --table=dental_tariffs \
  -f "hpms_config_data_2025-06-10.sql"

# 5. Export complete database (structure + data) - CAUTION: Large file
echo "💽 Exporting complete database..."
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres \
  --no-owner \
  --no-privileges \
  --verbose \
  -f "hpms_complete_backup_2025-06-10.sql"

# 6. Create custom queries for detailed analysis
echo "🔍 Running custom analysis queries..."

# List all tables with row counts
psql -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
" > "hpms_table_sizes_2025-06-10.txt"

# List all constraints
psql -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres -c "
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
" > "hpms_constraints_2025-06-10.txt"

# List all foreign key relationships
psql -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres -c "
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
" > "hpms_foreign_keys_2025-06-10.txt"

# List all functions
psql -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres -c "
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
" > "hpms_functions_list_2025-06-10.txt"

# List all triggers
psql -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres -c "
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.event_object_table,
  t.action_timing
FROM information_schema.triggers t
WHERE t.trigger_schema = 'public'
ORDER BY t.event_object_table, t.trigger_name;
" > "hpms_triggers_2025-06-10.txt"

# List all RLS policies
psql -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres -c "
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
" > "hpms_rls_policies_2025-06-10.txt"

echo "✅ Schema export completed!"
echo "📄 Files generated:"
echo "  - hpms_schema_structure_2025-06-10.sql (Complete schema structure)"
echo "  - hpms_tables_only_2025-06-10.sql (Tables only)"
echo "  - hpms_functions_2025-06-10.sql (Functions and procedures)"
echo "  - hpms_config_data_2025-06-10.sql (Configuration data)"
echo "  - hpms_complete_backup_2025-06-10.sql (Complete backup)"
echo "  - hpms_*_2025-06-10.txt (Analysis reports)"

# Cleanup
unset PGPASSWORD

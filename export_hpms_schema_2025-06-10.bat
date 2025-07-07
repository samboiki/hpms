@echo off
REM ============================================
REM HPMS Database Schema Export Commands (Windows)
REM Generated on: 2025-06-10T20:58:36.501Z
REM ============================================

set PGPASSWORD=T@ngisasa200

echo Starting database schema export...

echo Exporting schema structure...
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres --schema-only --no-owner --no-privileges --verbose -f "hpms_schema_structure_2025-06-10.sql"

echo Exporting table definitions...
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres --schema-only --no-owner --no-privileges --table=public.* -f "hpms_tables_only_2025-06-10.sql"

echo Exporting functions...
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres --schema-only --no-owner --no-privileges --section=pre-data --section=post-data -f "hpms_functions_2025-06-10.sql"

echo Exporting configuration data...
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres --data-only --no-owner --no-privileges --table=practices --table=practice_types --table=medical_aid_providers --table=dental_tariffs -f "hpms_config_data_2025-06-10.sql"

echo Exporting complete database...
pg_dump -h db.jjxlfunlbyayxwvlpgwt.supabase.co -U postgres -d postgres --no-owner --no-privileges --verbose -f "hpms_complete_backup_2025-06-10.sql"

echo Schema export completed!

set PGPASSWORD=

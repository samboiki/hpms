-- EMERGENCY RECOVERY COMMANDS
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

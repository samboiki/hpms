-- This file applies the multi-tenant migration to your Supabase database
-- Run this in the Supabase SQL editor

-- First, let's check if practices table already exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'practices') THEN
        RAISE NOTICE 'Creating practices table and multi-tenant structure...';
    ELSE
        RAISE NOTICE 'Practices table already exists, skipping creation...';
    END IF;
END $$;

-- Apply the migration
\i supabase/migrations/20250526_multi_tenant_practices.sql

-- Verify the migration
SELECT 'Practices created:' as info, count(*) as count FROM practices;
SELECT 'Patients with practice_id:' as info, count(*) as count FROM patients WHERE practice_id IS NOT NULL;
SELECT 'Appointments with practice_id:' as info, count(*) as count FROM appointments WHERE practice_id IS NOT NULL;
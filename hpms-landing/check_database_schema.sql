-- Check the actual schema of appointments and patients tables

-- Check appointments table columns
SELECT 'APPOINTMENTS TABLE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check patients table columns
SELECT 'PATIENTS TABLE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'patients' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check for unique constraints on patients table
SELECT 'PATIENTS CONSTRAINTS:' as info;
SELECT conname, contype, 
       pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE t.relname = 'patients' 
AND n.nspname = 'public';

-- Check for unique constraints on appointments table
SELECT 'APPOINTMENTS CONSTRAINTS:' as info;
SELECT conname, contype, 
       pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE t.relname = 'appointments' 
AND n.nspname = 'public';
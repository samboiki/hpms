-- Check the complete structure of visits table including all columns and constraints

-- 1. Show all columns with their data types and constraints
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'visits' 
ORDER BY ordinal_position;

-- 2. Show all check constraints on visits table
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
INNER JOIN pg_namespace nsp ON nsp.oid = con.connamespace
INNER JOIN pg_class cls ON cls.oid = con.conrelid
WHERE nsp.nspname = 'public'
    AND cls.relname = 'visits'
    AND con.contype = 'c';

-- 3. Show indexes on visits table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'visits'
ORDER BY indexname;

-- 4. Show foreign key constraints
SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'visits'
ORDER BY tc.constraint_name;
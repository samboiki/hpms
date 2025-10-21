-- ============================================================================
-- Get Practices Status Constraint Definition
-- ============================================================================
-- Run this SQL in Supabase SQL Editor to see the exact constraint definition
-- ============================================================================

-- Query 1: Get CHECK constraint definition
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition,
  con.contype AS constraint_type,
  rel.relname AS table_name
FROM pg_catalog.pg_constraint con
INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'practices'
  AND con.conname = 'practices_status_check';

-- Query 2: Get column details for status
SELECT
  a.attname AS column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
  a.attnotnull AS not_null,
  pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_value,
  col_description(a.attrelid, a.attnum) AS column_comment
FROM pg_catalog.pg_attribute a
LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
WHERE a.attrelid = 'public.practices'::regclass
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname = 'status';

-- Query 3: Get all CHECK constraints on practices table
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint con
INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'practices'
  AND con.contype = 'c'
ORDER BY con.conname;

-- ============================================================================
-- Expected Results Based on Testing:
-- ============================================================================
-- Constraint Name: practices_status_check
-- Expected Definition: CHECK ((status IN ('active', 'inactive', 'pending', 'suspended')))
-- ============================================================================
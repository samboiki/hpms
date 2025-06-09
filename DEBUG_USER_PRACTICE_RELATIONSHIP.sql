-- Debug script to check user and practice relationships
-- Execute this in Supabase SQL Editor while logged in

-- Check current user
SELECT 
  auth.uid() as current_user_id,
  'Current authenticated user' as description;

-- Check users table for current user
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.practice_id,
  u.role,
  'Users table info' as description
FROM users u 
WHERE u.id = auth.uid();

-- Check practice information
SELECT 
  p.id as practice_id,
  p.name as practice_name,
  'Practice info' as description
FROM practices p
INNER JOIN users u ON u.practice_id = p.id
WHERE u.id = auth.uid();

-- Check patients that should be accessible
SELECT 
  COUNT(*) as patient_count,
  'Accessible patients count' as description
FROM patients pt
WHERE EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() 
  AND u.practice_id IS NOT NULL
);

-- Check if the specific patient is accessible
-- Replace 'PATIENT_ID_HERE' with the actual patient ID you're trying to upload documents for
/*
SELECT 
  pt.id,
  pt.first_name,
  pt.last_name,
  'Target patient info' as description
FROM patients pt
WHERE pt.id = 'PATIENT_ID_HERE';
*/
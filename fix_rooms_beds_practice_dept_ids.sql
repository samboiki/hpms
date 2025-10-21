-- ====================================================================
-- FIX ROOMS AND BEDS: POPULATE practice_id AND department_id
-- ====================================================================
--
-- Problem: Rooms and beds have NULL practice_id and department_id
-- Impact: Frontend queries filtering by practice_id return 0 results
-- Solution: Inherit practice_id and department_id from parent ward
--
-- Generated: 2025-09-30
-- Project: Healthcare Practice Management System (HPMS)
-- ====================================================================

BEGIN;

-- ====================================================================
-- STEP 1: UPDATE ROOMS
-- ====================================================================

-- Update practice_id from ward
UPDATE rooms
SET practice_id = (
  SELECT w.practice_id
  FROM wards w
  WHERE w.id = rooms.ward_id
)
WHERE practice_id IS NULL
  AND ward_id IS NOT NULL;

-- Update department_id from ward
UPDATE rooms
SET department_id = (
  SELECT w.department_id
  FROM wards w
  WHERE w.id = rooms.ward_id
)
WHERE department_id IS NULL
  AND ward_id IS NOT NULL;

-- ====================================================================
-- STEP 2: UPDATE BEDS
-- ====================================================================

-- Update practice_id from ward
UPDATE beds
SET practice_id = (
  SELECT w.practice_id
  FROM wards w
  WHERE w.id = beds.ward_id
)
WHERE practice_id IS NULL
  AND ward_id IS NOT NULL;

-- Update department_id from ward
UPDATE beds
SET department_id = (
  SELECT w.department_id
  FROM wards w
  WHERE w.id = beds.ward_id
)
WHERE department_id IS NULL
  AND ward_id IS NOT NULL;

-- ====================================================================
-- STEP 3: VERIFICATION QUERIES
-- ====================================================================

-- Count rooms with practice_id
SELECT
  'Rooms with practice_id' as description,
  COUNT(*) FILTER (WHERE practice_id IS NOT NULL) as with_practice_id,
  COUNT(*) FILTER (WHERE practice_id IS NULL) as without_practice_id,
  COUNT(*) as total
FROM rooms;

-- Count rooms with department_id
SELECT
  'Rooms with department_id' as description,
  COUNT(*) FILTER (WHERE department_id IS NOT NULL) as with_department_id,
  COUNT(*) FILTER (WHERE department_id IS NULL) as without_department_id,
  COUNT(*) as total
FROM rooms;

-- Count beds with practice_id
SELECT
  'Beds with practice_id' as description,
  COUNT(*) FILTER (WHERE practice_id IS NOT NULL) as with_practice_id,
  COUNT(*) FILTER (WHERE practice_id IS NULL) as without_practice_id,
  COUNT(*) as total
FROM beds;

-- Count beds with department_id
SELECT
  'Beds with department_id' as description,
  COUNT(*) FILTER (WHERE department_id IS NOT NULL) as with_department_id,
  COUNT(*) FILTER (WHERE department_id IS NULL) as without_department_id,
  COUNT(*) as total
FROM beds;

-- Sample rooms with updated values
SELECT
  room_number,
  room_name,
  ward_id,
  practice_id,
  department_id
FROM rooms
LIMIT 5;

-- Sample beds with updated values
SELECT
  bed_number,
  ward_id,
  room_id,
  practice_id,
  department_id
FROM beds
LIMIT 5;

COMMIT;

-- ====================================================================
-- EXPECTED RESULTS:
-- - All 40 rooms should have practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
-- - All 72 beds should have practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
-- - All rooms should have department_id from their ward
-- - All beds should have department_id from their ward
-- ====================================================================
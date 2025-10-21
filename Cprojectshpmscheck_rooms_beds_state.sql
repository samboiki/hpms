-- Count total rooms
SELECT COUNT(*) as total_rooms FROM rooms;

-- Show sample rooms
SELECT * FROM rooms LIMIT 5;

-- Count total beds
SELECT COUNT(*) as total_beds FROM beds;

-- Show sample beds
SELECT * FROM beds LIMIT 5;

-- Check if rooms have ward_id populated
SELECT id, room_number, ward_id FROM rooms LIMIT 10;

-- Check if beds have room_id and ward_id populated
SELECT id, bed_number, room_id, ward_id FROM beds LIMIT 10;

-- Check departments table
SELECT id, name FROM departments LIMIT 5;

-- Check if wards have department_id linked
SELECT id, ward_name, department_id FROM wards LIMIT 10;

-- Additional diagnostic queries
SELECT 
  COUNT(DISTINCT r.id) as rooms_count,
  COUNT(DISTINCT b.id) as beds_count,
  COUNT(DISTINCT w.id) as wards_count,
  COUNT(DISTINCT d.id) as departments_count
FROM rooms r
FULL OUTER JOIN beds b ON b.room_id = r.id
FULL OUTER JOIN wards w ON w.id = r.ward_id
FULL OUTER JOIN departments d ON d.id = w.department_id;

-- Check ward-room-bed relationships
SELECT 
  w.id as ward_id,
  w.ward_name,
  w.department_id,
  COUNT(DISTINCT r.id) as rooms_in_ward,
  COUNT(DISTINCT b.id) as beds_in_ward
FROM wards w
LEFT JOIN rooms r ON r.ward_id = w.id
LEFT JOIN beds b ON b.ward_id = w.id
GROUP BY w.id, w.ward_name, w.department_id
LIMIT 10;

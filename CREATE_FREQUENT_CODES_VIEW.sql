-- SQL to create view for most frequently used codes
-- Execute this in Supabase SQL Editor

-- First, create a view for frequently used codes based on default dental codes
CREATE OR REPLACE VIEW frequent_tariff_codes AS
SELECT 
  pt.*,
  ptype.name as practice_type_name,
  ptype.description as practice_type_description,
  CASE 
    WHEN pt.code IN ('8346', '8369', '8109', '8110', '8161', '8370', '8145', '8101', '8368', '8159', '8151', '8155', '8167', '8367', '8104') 
    THEN 1 
    ELSE 0 
  END as is_frequent
FROM practice_tariffs pt
JOIN practice_types ptype ON pt.practice_type_id = ptype.id
WHERE pt.is_active = true 
  AND ptype.is_active = true
  AND pt.code IN ('8346', '8369', '8109', '8110', '8161', '8370', '8145', '8101', '8368', '8159', '8151', '8155', '8167', '8367', '8104')
ORDER BY 
  CASE pt.code
    WHEN '8346' THEN 1
    WHEN '8369' THEN 2
    WHEN '8109' THEN 3
    WHEN '8110' THEN 4
    WHEN '8161' THEN 5
    WHEN '8370' THEN 6
    WHEN '8145' THEN 7
    WHEN '8101' THEN 8
    WHEN '8368' THEN 9
    WHEN '8159' THEN 10
    WHEN '8151' THEN 11
    WHEN '8155' THEN 12
    WHEN '8167' THEN 13
    WHEN '8367' THEN 14
    WHEN '8104' THEN 15
    ELSE 999
  END;

-- Grant permissions
GRANT SELECT ON frequent_tariff_codes TO anon, authenticated;

-- Verify the view
SELECT code, description, practice_type_name 
FROM frequent_tariff_codes 
WHERE practice_type_name = 'dental';
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'lab_requests' 
ORDER BY ordinal_position;
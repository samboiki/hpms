# Update Visit Status in Database

To ensure all existing visits have the correct "incomplete" status by default, run this SQL in Supabase Dashboard > SQL Editor:

```sql
-- Update existing visits that have null or empty status to 'in-progress'
UPDATE visits 
SET status = 'in-progress' 
WHERE status IS NULL OR status = '';

-- Check the results
SELECT 
  CASE 
    WHEN status IS NULL THEN 'NULL'
    WHEN status = '' THEN 'EMPTY'
    ELSE status
  END as status_display,
  COUNT(*) as count
FROM visits 
GROUP BY status
ORDER BY status;
```

This will ensure all visit cards show "Pending" status by default and can be toggled to "Done".
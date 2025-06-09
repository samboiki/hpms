-- After running the main SQL, update the component to use the view
-- Replace the practice_tariffs query in EnhancedServiceSelector.tsx with:

-- FROM:
-- supabase.from('practice_tariffs').select('*')

-- TO:
-- supabase.from('practice_tariffs_with_types').select('*')

-- This will give you the joined data with practice_type_name included
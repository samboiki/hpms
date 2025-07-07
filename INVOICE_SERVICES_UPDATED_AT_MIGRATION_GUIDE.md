# Invoice Services Updated_At Column Migration Guide

## Problem
The `invoice_services` table is missing the `updated_at` column, which is needed for proper audit trails and change tracking.

## Solution
This migration adds the missing `updated_at` column and creates an automatic trigger to maintain it.

## Steps to Execute

### Option 1: Via Supabase SQL Editor (Recommended)
1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `EXECUTE_IN_SUPABASE_ADD_UPDATED_AT.sql`
4. Click "Run" to execute the migration

### Option 2: Via Local Database Connection
If you have direct database access, you can run:
```bash
psql "postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres" \
  -f ADD_UPDATED_AT_TO_INVOICE_SERVICES.sql
```

## What This Migration Does

1. **Adds `updated_at` Column**
   - Type: `TIMESTAMP WITH TIME ZONE`
   - Default: `NOW()`
   - Non-nullable

2. **Populates Existing Records**
   - Sets `updated_at = created_at` for all existing records
   - Ensures no NULL values

3. **Creates Trigger Function**
   - `update_invoice_services_updated_at()` function
   - Automatically sets `updated_at = NOW()` on every update

4. **Creates Trigger**
   - `tr_invoice_services_updated_at` trigger
   - Fires `BEFORE UPDATE` on every row
   - Calls the trigger function automatically

## Verification

After running the migration, you can verify it worked by:

```sql
-- Check the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoice_services' 
AND column_name IN ('created_at', 'updated_at')
ORDER BY column_name;

-- Check sample data
SELECT 
    id,
    code,
    created_at,
    updated_at
FROM invoice_services 
ORDER BY created_at DESC 
LIMIT 5;
```

## Benefits

✅ **Full Audit Trail**: Track when records were created and last modified
✅ **Automatic Maintenance**: No application code changes needed
✅ **Data Integrity**: Consistent timestamp handling across all updates
✅ **Performance**: Minimal overhead with database-level triggers
✅ **Compliance**: Better data governance and change tracking

## Application Impact

- **No Code Changes Required**: The trigger handles everything automatically
- **Existing Functionality**: All current invoice operations continue to work
- **New Functionality**: `updated_at` will be available in all future queries
- **Backward Compatibility**: No breaking changes to existing APIs

## Files Created

1. `ADD_UPDATED_AT_TO_INVOICE_SERVICES.sql` - Complete migration script with testing
2. `EXECUTE_IN_SUPABASE_ADD_UPDATED_AT.sql` - Simplified version for Supabase SQL Editor
3. `execute-add-updated-at-column.cjs` - Node.js automation script (optional)

## Next Steps

After running this migration:

1. ✅ **Verify** the column was added successfully
2. ✅ **Test** that updates automatically change the `updated_at` timestamp
3. ✅ **Update** any reporting queries to include the new timestamp
4. ✅ **Document** the change for your team

The `invoice_services` table will now have complete timestamp tracking for better data management and audit capabilities! 🎉
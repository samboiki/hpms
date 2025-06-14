# Financial Overview Batch Management Fixes

## Issues Identified

### 1. Users Table Column Mismatch
**Error**: `column users.first_name does not exist`
**Cause**: The `users` table has `full_name` column, but some queries expect `first_name` and `last_name`
**Impact**: Financial Overview cannot fetch practitioner/doctor information for batches

### 2. Batch Data Not Loading
**Cause**: Financial Overview was trying to filter batches by `practice_id`, but `batch_management_view` uses `practice_number`
**Impact**: Active batches don't appear in the Financial Overview

## Solutions Implemented

### 1. SQL Fixes (`fix-users-table-query.sql`)

Execute this SQL in your Supabase SQL Editor:

#### Create Users View with Name Compatibility
```sql
CREATE OR REPLACE VIEW users_with_names AS
SELECT 
    id, email, full_name,
    -- Split full_name into first_name and last_name
    CASE 
        WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
        THEN substring(full_name from 1 for position(' ' in full_name) - 1)
        ELSE full_name
    END as first_name,
    CASE 
        WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
        THEN substring(full_name from position(' ' in full_name) + 1)
        ELSE ''
    END as last_name,
    role, created_at, last_login, avatar, practice_id,
    is_super_admin, can_manage_practices, permissions,
    last_active_at, hpcsa_number
FROM users;
```

#### Ensure Practice Numbers Exist
```sql
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_number VARCHAR(15);

UPDATE practices 
SET practice_number = '54000113324' || ROW_NUMBER() OVER (ORDER BY created_at)
WHERE practice_number IS NULL;
```

#### Create Helper Functions
```sql
-- Simple function to get batches by practice_id
CREATE OR REPLACE FUNCTION get_practice_batches_simple(p_practice_id UUID)
RETURNS TABLE (/* ... batch fields ... */)
-- Returns batches directly from batch_headers with joins

-- Detailed function with doctor information
CREATE OR REPLACE FUNCTION get_practice_batches_with_doctors(p_practice_id UUID)
RETURNS TABLE (/* ... batch fields ... */)
-- Returns batches with practitioner details using users_with_names view
```

### 2. Frontend Fixes (`EnhancedFinancialModal.tsx`)

#### Improved Batch Fetching Strategy
1. **Method 1**: Try `get_practice_batches_simple()` (best compatibility)
2. **Method 2**: Try `get_practice_batches_with_doctors()` (detailed info)
3. **Method 3**: Try original `get_practice_batches()` (legacy)
4. **Method 4**: Practice number lookup + view query
5. **Method 5**: Direct `batch_headers` query by `practice_id`
6. **Method 6**: Practice number-based view query
7. **Method 7**: System-wide batch check (diagnostic)

#### Enhanced Error Handling
- Comprehensive logging for debugging
- Multiple fallback strategies
- Graceful degradation when functions don't exist

### 3. Invoice Service Fix

The `invoiceService.ts` was already correctly using `full_name` from the users table, so no changes needed there.

## Testing Steps

### 1. Run SQL Fixes
1. Open Supabase Dashboard → SQL Editor
2. Paste and execute `fix-users-table-query.sql`
3. Verify all queries complete successfully

### 2. Test Financial Overview
1. Log in to the application
2. Navigate to Dashboard
3. Click on the Finance card
4. Go to "Batch Management" tab
5. Toggle the "Active" filter
6. Check browser console for detailed logs

### 3. Expected Results
- Active batches should appear in the list
- No "column users.first_name does not exist" errors
- Batch cards show proper medical aid logos and information
- Submit functionality works for active batches

## Database Schema Understanding

### Key Tables
- **`users`**: Has `full_name` (not `first_name`/`last_name`)
- **`patients`**: Has `first_name` and `last_name` (correct structure)
- **`practices`**: Now has `practice_number` column
- **`batch_headers`**: Uses `practice_id` for relationships
- **`batch_management_view`**: Uses `practice_number` for filtering

### Key Relationships
```
practices.id → batch_headers.practice_id
practices.practice_number → batch_management_view.practice_number
users.id → invoices_enhanced.practitioner_id
patients.id → invoices_enhanced.patient_id
```

## Troubleshooting

### If Batches Still Don't Appear
1. Check if practice has `practice_number`:
   ```sql
   SELECT id, name, practice_number FROM practices WHERE id = 'your-practice-id';
   ```

2. Check if any batches exist:
   ```sql
   SELECT COUNT(*) FROM batch_headers;
   ```

3. Check batch status distribution:
   ```sql
   SELECT status, COUNT(*) FROM batch_headers GROUP BY status;
   ```

### If Users Error Persists
1. Verify view was created:
   ```sql
   SELECT * FROM users_with_names LIMIT 1;
   ```

2. Update any code still using `users` table directly to use `users_with_names`

## Files Modified
- ✅ `src/components/modals/EnhancedFinancialModal.tsx` - Enhanced batch fetching
- ✅ `src/services/invoiceService.ts` - Already correct (uses `full_name`)
- ✅ `fix-users-table-query.sql` - Database fixes
- ✅ `FINANCIAL_OVERVIEW_FIXES.md` - This documentation

## Next Steps
1. Execute the SQL fixes in Supabase
2. Test the Financial Overview functionality
3. Verify batch submission works
4. Monitor console logs for any remaining issues
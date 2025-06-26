# Fix Branches RLS Policy Issue

## Problem
Getting error: "new row violates row-level security policy for table branches"

## Solution

### Option 1: Run the SQL Migration in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the entire contents of: `/home/happy/projects/hpms/supabase/migrations/20250626_fix_branches_rls_complete.sql`
4. Click "Run" to execute the SQL

### Option 2: Check Current User Role

First, verify that your logged-in user has the correct role:

```sql
SELECT id, email, role, practice_id 
FROM users 
WHERE email = 'your-email@example.com';
```

Make sure the `role` is either 'admin' or 'doctor'.

### Option 3: Temporarily Disable RLS (Development Only)

If you need to test quickly in development:

```sql
-- DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
```

Then re-enable it after testing:

```sql
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
```

### Option 4: Manual Policy Creation

If the migration doesn't work, manually create policies:

```sql
-- First, check existing policies
SELECT * FROM pg_policies WHERE tablename = 'branches';

-- Drop any conflicting policies
DROP POLICY IF EXISTS "your_policy_name" ON branches;

-- Create a permissive policy for testing
CREATE POLICY "Allow all for authenticated users"
  ON branches FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

## Debugging Steps

1. Check your current user's role in the browser console:
   ```javascript
   const { data: { user } } = await supabase.auth.getUser();
   console.log('Current user:', user);
   ```

2. Check if the user exists in the users table with correct practice_id:
   ```javascript
   const { data } = await supabase
     .from('users')
     .select('*')
     .eq('id', user.id)
     .single();
   console.log('User data:', data);
   ```

3. Try a direct insert to test:
   ```javascript
   const { data, error } = await supabase
     .from('branches')
     .insert({
       name: 'Test Branch',
       slug: 'test-branch',
       practice_id: 'YOUR_PRACTICE_ID_HERE',
       is_active: true
     })
     .select();
   console.log('Result:', { data, error });
   ```

## Root Cause

The issue occurs when:
1. The RLS policy doesn't properly check for the user's role
2. The practice_id doesn't match between the user and the branch being created
3. The auth.uid() function returns null (user not properly authenticated)

## Permanent Fix

The migration file (`20250626_fix_branches_rls_complete.sql`) creates separate policies for each operation:
- SELECT: All users can view branches in their practice
- INSERT: Only admin and doctor roles can create branches
- UPDATE: Only admin and doctor roles can update branches
- DELETE: Only admin and doctor roles can delete branches

This ensures proper security while allowing doctors to manage branches.
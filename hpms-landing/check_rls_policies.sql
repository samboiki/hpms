-- Check RLS policies that might be blocking login

-- Check if RLS is enabled on users table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'users';

-- Show all policies on users table
SELECT 
    pol.polname as policy_name,
    pol.polcmd as command,
    pol.polroles::regrole[] as roles,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
WHERE c.relname = 'users';

-- If RLS is blocking, temporarily disable it (BE CAREFUL!)
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Or create a policy that allows authenticated users to read their own data
CREATE POLICY "Users can read their own profile" ON users
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- And allow reading any user in the same practice
CREATE POLICY "Users can read users in their practice" ON users
    FOR SELECT TO authenticated
    USING (
        practice_id IN (
            SELECT practice_id FROM users WHERE id = auth.uid()
        )
    );
-- ===================================================================
-- TEMPORARY FIX: Allow Anonymous Practice Registration
-- ===================================================================
-- WARNING: This is a temporary solution for development/admin portal
-- For production, implement proper authentication in the admin portal
-- ===================================================================

-- Allow anonymous users to INSERT practices (DEVELOPMENT ONLY)
DROP POLICY IF EXISTS "Allow anon to insert practices" ON practices;

CREATE POLICY "Allow anon to insert practices"
ON practices
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to SELECT all practices (for admin portal listing)
DROP POLICY IF EXISTS "Allow anon to select practices" ON practices;

CREATE POLICY "Allow anon to select practices"
ON practices
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to UPDATE practices (for admin portal editing)
DROP POLICY IF EXISTS "Allow anon to update practices" ON practices;

CREATE POLICY "Allow anon to update practices"
ON practices
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anonymous users to DELETE practices (for admin portal deletion)
DROP POLICY IF EXISTS "Allow anon to delete practices" ON practices;

CREATE POLICY "Allow anon to delete practices"
ON practices
FOR DELETE
TO anon
USING (true);

-- ===================================================================
-- BRANCHES TABLE: Also needs policies
-- ===================================================================

-- Allow anonymous users to work with branches
DROP POLICY IF EXISTS "Allow anon full access to branches" ON branches;

CREATE POLICY "Allow anon full access to branches"
ON branches
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ===================================================================
-- SMS/EMAIL SUBSCRIPTIONS: Also needs policies
-- ===================================================================

-- Allow anonymous users to work with SMS subscriptions
DROP POLICY IF EXISTS "Allow anon full access to sms subscriptions" ON practice_sms_subscriptions;

CREATE POLICY "Allow anon full access to sms subscriptions"
ON practice_sms_subscriptions
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Allow anonymous users to work with Email subscriptions
DROP POLICY IF EXISTS "Allow anon full access to email subscriptions" ON practice_email_subscriptions;

CREATE POLICY "Allow anon full access to email subscriptions"
ON practice_email_subscriptions
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ===================================================================
-- Verify policies
-- ===================================================================

SELECT
    tablename,
    policyname,
    cmd,
    roles::text[]
FROM pg_policies
WHERE tablename IN ('practices', 'branches', 'practice_sms_subscriptions', 'practice_email_subscriptions')
ORDER BY tablename, cmd;
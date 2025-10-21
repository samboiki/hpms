-- Fix RLS policies to allow anonymous practice registration
-- This enables the /onehealth registration form to work properly

-- ==================================================
-- PRACTICES TABLE - Allow anonymous access
-- ==================================================

DROP POLICY IF EXISTS "Allow anon to insert practices" ON practices;
CREATE POLICY "Allow anon to insert practices"
  ON practices
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon to select practices" ON practices;
CREATE POLICY "Allow anon to select practices"
  ON practices
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon to update practices" ON practices;
CREATE POLICY "Allow anon to update practices"
  ON practices
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon to delete practices" ON practices;
CREATE POLICY "Allow anon to delete practices"
  ON practices
  FOR DELETE
  TO anon
  USING (true);

-- ==================================================
-- BRANCHES TABLE - Allow anonymous access
-- ==================================================

DROP POLICY IF EXISTS "Allow anon full access to branches" ON branches;
CREATE POLICY "Allow anon full access to branches"
  ON branches
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ==================================================
-- SMS SUBSCRIPTIONS - Allow anonymous access
-- ==================================================

DROP POLICY IF EXISTS "Allow anon full access to sms subscriptions" ON practice_sms_subscriptions;
CREATE POLICY "Allow anon full access to sms subscriptions"
  ON practice_sms_subscriptions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ==================================================
-- EMAIL SUBSCRIPTIONS - Allow anonymous access
-- ==================================================

DROP POLICY IF EXISTS "Allow anon full access to email subscriptions" ON practice_email_subscriptions;
CREATE POLICY "Allow anon full access to email subscriptions"
  ON practice_email_subscriptions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ==================================================
-- VERIFICATION
-- ==================================================

-- Verify policies were created
DO $$
BEGIN
  RAISE NOTICE 'RLS policies for anonymous practice registration have been applied successfully!';
  RAISE NOTICE 'Anonymous users can now: INSERT, SELECT, UPDATE, DELETE on practices table';
  RAISE NOTICE 'Anonymous users can now: ALL operations on branches table';
  RAISE NOTICE 'Anonymous users can now: ALL operations on practice_sms_subscriptions table';
  RAISE NOTICE 'Anonymous users can now: ALL operations on practice_email_subscriptions table';
END $$;
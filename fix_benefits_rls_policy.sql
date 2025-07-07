-- Fix RLS policy on benefits table to allow INSERT operations
-- The current policy has a NULL with_check clause which blocks all inserts

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Admins can manage benefits" ON benefits;

-- Create a corrected policy with proper WITH CHECK clause for INSERT/UPDATE
CREATE POLICY "Admins can manage benefits" ON benefits
FOR ALL
TO public
USING (
    -- This controls which existing rows can be seen/updated/deleted
    EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
        AND users.practice_id = benefits.practice_id
        AND (users.role = 'admin' OR users.is_super_admin = true)
    )
)
WITH CHECK (
    -- This controls what new rows can be inserted or what values can be updated to
    EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
        AND users.practice_id = benefits.practice_id
        AND (users.role = 'admin' OR users.is_super_admin = true)
    )
);

-- Verify the fix by checking the policies
SELECT 
    policyname,
    cmd,
    qual as select_using_clause,
    with_check as insert_update_check_clause,
    CASE 
        WHEN with_check IS NULL AND cmd IN ('INSERT', 'UPDATE', 'ALL') 
        THEN 'PROBLEM: Missing WITH CHECK - will block operations'
        ELSE 'OK'
    END as status
FROM pg_policies
WHERE tablename = 'benefits'
ORDER BY policyname;
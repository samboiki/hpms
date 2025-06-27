-- Fix RLS policies for benefits, deductions, and bonus_configurations tables
-- The current policies have NULL for WITH CHECK which blocks all INSERTs

-- Fix benefits table RLS policy
DROP POLICY IF EXISTS "Admins can manage benefits" ON benefits;

CREATE POLICY "Admins can manage benefits" ON benefits
FOR ALL
TO authenticated
USING (
    practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'doctor')
    )
)
WITH CHECK (
    practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'doctor')
    )
);

-- Fix deductions table RLS policy
DROP POLICY IF EXISTS "Admins can manage deductions" ON deductions;

CREATE POLICY "Admins can manage deductions" ON deductions
FOR ALL
TO authenticated
USING (
    practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'doctor')
    )
)
WITH CHECK (
    practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'doctor')
    )
);

-- Fix bonus_configurations table RLS policy
DROP POLICY IF EXISTS "Admins can manage bonus configurations" ON bonus_configurations;

CREATE POLICY "Admins can manage bonus configurations" ON bonus_configurations
FOR ALL
TO authenticated
USING (
    practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'doctor')
    )
)
WITH CHECK (
    practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'doctor')
    )
);

-- Also add RLS policies for employee_salary_configurations if missing
CREATE POLICY IF NOT EXISTS "Users can view their own salary configurations" ON employee_salary_configurations
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    user_id IN (
        SELECT id FROM users 
        WHERE practice_id = (SELECT practice_id FROM users WHERE id = auth.uid()) 
        AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'doctor')
    )
);

CREATE POLICY IF NOT EXISTS "Admins can manage salary configurations" ON employee_salary_configurations
FOR ALL
TO authenticated
USING (
    user_id IN (
        SELECT id FROM users 
        WHERE practice_id = (SELECT practice_id FROM users WHERE id = auth.uid()) 
        AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'doctor')
    )
)
WITH CHECK (
    user_id IN (
        SELECT id FROM users 
        WHERE practice_id = (SELECT practice_id FROM users WHERE id = auth.uid()) 
        AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'doctor')
    )
);
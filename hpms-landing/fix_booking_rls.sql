-- Fix RLS policies to allow public booking submissions

-- Allow public (unauthenticated) users to insert patients for booking
CREATE POLICY "Allow public patient creation for booking" ON patients
  FOR INSERT TO anon WITH CHECK (true);

-- Allow public (unauthenticated) users to insert appointments for booking  
CREATE POLICY "Allow public appointment creation for booking" ON appointments
  FOR INSERT TO anon WITH CHECK (true);

-- Allow public users to read practices for booking widget
CREATE POLICY "Allow public practice reading" ON practices
  FOR SELECT TO anon USING (true);

-- Allow public users to read auth.users for doctor assignment (if needed)
-- Note: This might need to be handled differently for security
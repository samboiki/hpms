-- Allow public booking by updating RLS policies

-- Allow anonymous users to insert patients for booking purposes
CREATE POLICY "Allow public patient creation for booking" ON patients
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous users to insert appointments for booking purposes
CREATE POLICY "Allow public appointment creation for booking" ON appointments
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous users to read practices for the booking widget
CREATE POLICY "Allow public practice reading" ON practices
  FOR SELECT TO anon USING (true);
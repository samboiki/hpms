-- Create client_leads table
CREATE TABLE IF NOT EXISTS client_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_code TEXT,
  discipline_name TEXT,
  practice_number TEXT UNIQUE NOT NULL,
  practice_name TEXT,
  town TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_leads_practice_number ON client_leads(practice_number);
CREATE INDEX IF NOT EXISTS idx_client_leads_town ON client_leads(town);
CREATE INDEX IF NOT EXISTS idx_client_leads_discipline_name ON client_leads(discipline_name);

-- Add RLS policies
ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY IF NOT EXISTS "Service role has full access to client_leads"
  ON client_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY IF NOT EXISTS "Authenticated users can read client_leads"
  ON client_leads
  FOR SELECT
  TO authenticated
  USING (true);

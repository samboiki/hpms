-- Add branch support to practices
-- A practice can have multiple branches (e.g., CBD Windhoek, Otjomuise Windhoek)

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  business_hours JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint on slug within a practice
  UNIQUE(practice_id, slug)
);

-- Add branch_id to users table (which branch they work at)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS allowed_branches UUID[] DEFAULT '{}'; -- Doctors can work at multiple branches

-- Add branch_id to visits table (which branch the booking is for)
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_branches_practice_id ON branches(practice_id);
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_visits_branch_id ON visits(branch_id);

-- Create doctor branch schedules
CREATE TABLE IF NOT EXISTS doctor_branch_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate schedules
  UNIQUE(doctor_id, branch_id, day_of_week)
);

-- Create index for doctor schedules
CREATE INDEX IF NOT EXISTS idx_doctor_branch_schedules_doctor ON doctor_branch_schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_branch_schedules_branch ON doctor_branch_schedules(branch_id);

-- Update RLS policies for branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view branches of their practice"
  ON branches FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage branches"
  ON branches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      AND practice_id = branches.practice_id
    )
  );

-- Update RLS for doctor schedules
ALTER TABLE doctor_branch_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view doctor schedules"
  ON doctor_branch_schedules FOR SELECT
  USING (
    branch_id IN (
      SELECT b.id FROM branches b
      JOIN users u ON u.practice_id = b.practice_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage doctor schedules"
  ON doctor_branch_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN branches b ON b.practice_id = u.practice_id
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
      AND b.id = doctor_branch_schedules.branch_id
    )
  );

-- Add comment
COMMENT ON TABLE branches IS 'Practice branches/locations';
COMMENT ON COLUMN users.branch_id IS 'Primary branch where user works';
COMMENT ON COLUMN users.allowed_branches IS 'Additional branches where doctors can work';
COMMENT ON COLUMN visits.branch_id IS 'Branch where the visit/booking is scheduled';
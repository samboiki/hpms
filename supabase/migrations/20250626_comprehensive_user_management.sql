-- Comprehensive User Management, Payroll, Leave, and Timesheet System
-- This migration creates all necessary tables for a full HR management system

-- =====================================================
-- USER PROFILE EXTENSIONS
-- =====================================================

-- Add additional columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reporting_manager_id uuid REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_number text UNIQUE;

-- =====================================================
-- PAYROLL MANAGEMENT TABLES
-- =====================================================

-- Salary Components Table (flexible allowances/deductions)
CREATE TABLE IF NOT EXISTS salary_components (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id uuid REFERENCES practices(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('earnings', 'deductions')),
  category text NOT NULL CHECK (category IN ('basic', 'allowance', 'deduction', 'tax', 'insurance')),
  is_recurring boolean DEFAULT true,
  is_taxable boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(practice_id, name)
);

-- Employee Salary Configuration
CREATE TABLE IF NOT EXISTS employee_salaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  basic_salary numeric(12,2) NOT NULL,
  currency text DEFAULT 'NAD',
  effective_from date NOT NULL,
  effective_to date,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Employee Salary Components Assignment
CREATE TABLE IF NOT EXISTS employee_salary_components (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  component_id uuid REFERENCES salary_components(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  percentage numeric(5,2), -- Optional: for percentage-based components
  effective_from date NOT NULL,
  effective_to date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, component_id, effective_from)
);

-- Payslips Table
CREATE TABLE IF NOT EXISTS payslips (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  payment_date date NOT NULL,
  basic_salary numeric(12,2) NOT NULL,
  gross_earnings numeric(12,2) NOT NULL,
  total_deductions numeric(12,2) NOT NULL,
  net_pay numeric(12,2) NOT NULL,
  payment_method text CHECK (payment_method IN ('bank_transfer', 'check', 'cash')),
  bank_details jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pay_period_start, pay_period_end)
);

-- Payslip Line Items
CREATE TABLE IF NOT EXISTS payslip_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_id uuid REFERENCES payslips(id) ON DELETE CASCADE,
  component_id uuid REFERENCES salary_components(id),
  component_name text NOT NULL, -- Store name in case component is deleted
  type text NOT NULL CHECK (type IN ('earnings', 'deductions')),
  amount numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- LEAVE MANAGEMENT TABLES
-- =====================================================

-- Leave Types Configuration
CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id uuid REFERENCES practices(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  days_per_year numeric(5,2) NOT NULL,
  is_paid boolean DEFAULT true,
  carryover_allowed boolean DEFAULT false,
  max_carryover_days numeric(5,2) DEFAULT 0,
  requires_approval boolean DEFAULT true,
  min_notice_days integer DEFAULT 1,
  supporting_documents_required boolean DEFAULT false,
  description text,
  color text DEFAULT '#6B7280', -- For calendar display
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(practice_id, code)
);

-- Employee Leave Balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id uuid REFERENCES leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  entitled_days numeric(5,2) NOT NULL,
  used_days numeric(5,2) DEFAULT 0,
  carried_over_days numeric(5,2) DEFAULT 0,
  balance_days numeric(5,2) GENERATED ALWAYS AS (entitled_days + carried_over_days - used_days) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, leave_type_id, year)
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id uuid REFERENCES leave_types(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested numeric(5,2) NOT NULL,
  reason text NOT NULL,
  is_half_day boolean DEFAULT false,
  half_day_period text CHECK (half_day_period IN ('morning', 'afternoon')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id uuid REFERENCES users(id),
  approved_at timestamptz,
  approver_comments text,
  supporting_document_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Leave Request History (for audit trail)
CREATE TABLE IF NOT EXISTS leave_request_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  leave_request_id uuid REFERENCES leave_requests(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'approved', 'rejected', 'cancelled')),
  performed_by uuid REFERENCES users(id),
  comments text,
  old_status text,
  new_status text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- TIMESHEET MANAGEMENT TABLES
-- =====================================================

-- Timesheets
CREATE TABLE IF NOT EXISTS timesheets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_hours numeric(5,2) DEFAULT 0,
  regular_hours numeric(5,2) DEFAULT 0,
  overtime_hours numeric(5,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  approver_id uuid REFERENCES users(id),
  approved_at timestamptz,
  approver_comments text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, period_start, period_end)
);

-- Timesheet Entries
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  timesheet_id uuid REFERENCES timesheets(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  break_duration interval DEFAULT '0 hours',
  total_hours numeric(5,2) NOT NULL,
  project_code text,
  task_description text,
  is_overtime boolean DEFAULT false,
  is_holiday boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(timesheet_id, date)
);

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS hr_audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject')),
  performed_by uuid REFERENCES users(id),
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_id ON employee_salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_active ON employee_salaries(is_active);
CREATE INDEX IF NOT EXISTS idx_payslips_user_id ON payslips(user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_payment_date ON payslips(payment_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_user_id ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_period ON timesheets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_hr_audit_logs_table_record ON hr_audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_hr_audit_logs_performed_by ON hr_audit_logs(performed_by);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_audit_logs ENABLE ROW LEVEL SECURITY;

-- Salary Components Policies
CREATE POLICY "Admin and managers can view salary components" ON salary_components
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE practice_id = salary_components.practice_id 
      AND role IN ('admin', 'doctor')
    )
  );

CREATE POLICY "Only admins can manage salary components" ON salary_components
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE practice_id = salary_components.practice_id 
      AND role = 'admin'
    )
  );

-- Employee Salaries Policies
CREATE POLICY "Users can view own salary" ON employee_salaries
  FOR SELECT USING (
    user_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'doctor')
    )
  );

CREATE POLICY "Only admins can manage salaries" ON employee_salaries
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- Payslips Policies
CREATE POLICY "Users can view own payslips" ON payslips
  FOR SELECT USING (
    user_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'doctor')
    )
  );

CREATE POLICY "Only admins can manage payslips" ON payslips
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- Leave Requests Policies
CREATE POLICY "Users can view own leave requests" ON leave_requests
  FOR SELECT USING (
    user_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'doctor')
    )
  );

CREATE POLICY "Users can create own leave requests" ON leave_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending requests" ON leave_requests
  FOR UPDATE USING (
    user_id = auth.uid() AND status = 'pending'
  );

CREATE POLICY "Managers can approve/reject leave" ON leave_requests
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'doctor')
    )
  );

-- Timesheets Policies
CREATE POLICY "Users can view own timesheets" ON timesheets
  FOR SELECT USING (
    user_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'doctor')
    )
  );

CREATE POLICY "Users can manage own draft timesheets" ON timesheets
  FOR ALL USING (
    user_id = auth.uid() AND status = 'draft'
  );

CREATE POLICY "Managers can approve timesheets" ON timesheets
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'doctor')
    )
  );

-- Audit Logs Policy
CREATE POLICY "Only admins can view audit logs" ON hr_audit_logs
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate leave days between dates (excluding weekends)
CREATE OR REPLACE FUNCTION calculate_leave_days(start_date date, end_date date, is_half_day boolean)
RETURNS numeric AS $$
DECLARE
  days numeric := 0;
  current_date date := start_date;
BEGIN
  WHILE current_date <= end_date LOOP
    -- Exclude weekends (Saturday = 6, Sunday = 0)
    IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN
      days := days + 1;
    END IF;
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
  
  IF is_half_day THEN
    days := days - 0.5;
  END IF;
  
  RETURN days;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update leave balance when request is approved
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE leave_balances
    SET used_days = used_days + NEW.days_requested,
        updated_at = now()
    WHERE user_id = NEW.user_id 
    AND leave_type_id = NEW.leave_type_id
    AND year = EXTRACT(YEAR FROM NEW.start_date);
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
    UPDATE leave_balances
    SET used_days = used_days - NEW.days_requested,
        updated_at = now()
    WHERE user_id = NEW.user_id 
    AND leave_type_id = NEW.leave_type_id
    AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leave_balance_trigger
AFTER UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION update_leave_balance();

-- Trigger to calculate timesheet hours
CREATE OR REPLACE FUNCTION calculate_timesheet_hours()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time - NEW.break_duration)) / 3600;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_hours_trigger
BEFORE INSERT OR UPDATE ON timesheet_entries
FOR EACH ROW
WHEN (NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL)
EXECUTE FUNCTION calculate_timesheet_hours();

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Insert default leave types for each practice
INSERT INTO leave_types (practice_id, name, code, days_per_year, is_paid, color)
SELECT DISTINCT 
  p.id,
  lt.name,
  lt.code,
  lt.days_per_year,
  lt.is_paid,
  lt.color
FROM practices p
CROSS JOIN (VALUES
  ('Annual Leave', 'ANNUAL', 21, true, '#10B981'),
  ('Sick Leave', 'SICK', 10, true, '#EF4444'),
  ('Compassionate Leave', 'COMPASSIONATE', 3, true, '#6366F1'),
  ('Unpaid Leave', 'UNPAID', 0, false, '#6B7280'),
  ('Maternity Leave', 'MATERNITY', 120, true, '#EC4899'),
  ('Paternity Leave', 'PATERNITY', 10, true, '#3B82F6')
) AS lt(name, code, days_per_year, is_paid, color)
ON CONFLICT (practice_id, code) DO NOTHING;

-- Initialize leave balances for current year for all users
INSERT INTO leave_balances (user_id, leave_type_id, year, entitled_days)
SELECT 
  u.id,
  lt.id,
  EXTRACT(YEAR FROM CURRENT_DATE),
  lt.days_per_year
FROM users u
JOIN leave_types lt ON lt.practice_id = u.practice_id
WHERE u.is_active = true
ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
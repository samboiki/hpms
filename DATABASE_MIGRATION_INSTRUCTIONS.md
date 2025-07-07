# Database Migration Instructions for Comprehensive User Management

To enable the comprehensive User Management, Payroll, Leave, and Timesheet features, you need to run the following migration in your Supabase database.

## Steps to Execute the Migration

1. **Log in to your Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Create a New Query**
   - Click "New query" button

4. **Copy and Run the Migration**
   - Copy the entire contents of the file: `/supabase/migrations/20250626_comprehensive_user_management_fixed.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration
   
   **Note:** Use the `_fixed.sql` version which corrects the PostgreSQL syntax error with `current_date` variable naming.

## What This Migration Does

The migration creates the following tables and features:

### User Profile Extensions
- Adds additional columns to the `users` table:
  - `job_title` - Employee's job title
  - `start_date` - Employment start date
  - `reporting_manager_id` - Manager reference
  - `contact_number` - Phone number
  - `address` - Physical address
  - `is_active` - Active/inactive status
  - `department` - Department assignment
  - `employee_number` - Unique employee ID

### Payroll Management
- **salary_components** - Flexible salary components (allowances, deductions)
- **employee_salaries** - Employee salary configurations
- **employee_salary_components** - Component assignments
- **payslips** - Monthly payslips
- **payslip_items** - Payslip line items

### Leave Management
- **leave_types** - Leave type configurations
- **leave_balances** - Employee leave balances
- **leave_requests** - Leave request tracking
- **leave_request_history** - Audit trail

### Timesheet Management
- **timesheets** - Weekly/monthly timesheets
- **timesheet_entries** - Daily time entries

### Audit & Security
- **hr_audit_logs** - Comprehensive audit trail
- Row Level Security (RLS) policies for all tables
- Role-based access control

## Post-Migration Steps

1. **Verify the Migration**
   - Check that all tables were created successfully
   - Verify that RLS policies are enabled

2. **Initialize Leave Types**
   - The migration automatically creates default leave types for your practice

3. **Test the Features**
   - Navigate to Settings > User Management in your application
   - Test creating users, managing payroll, leave requests, and timesheets

## Troubleshooting

If you encounter any errors:

1. **Check for Existing Tables**
   - The migration uses `IF NOT EXISTS` clauses, so it's safe to run multiple times

2. **Verify Permissions**
   - Ensure you're using a database role with sufficient permissions

3. **Review Error Messages**
   - Supabase will display specific error messages if any part of the migration fails

## Need Help?

If you need assistance with the migration:
1. Check the Supabase logs for detailed error messages
2. Verify that all prerequisite tables (users, practices) exist
3. Contact support with the specific error message

## Additional Migration: Fix Users Table RLS

If you're having issues seeing other users in your practice, also run this migration:

```sql
-- Fix RLS policy for users table to allow practice members to see each other

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view users in their practice" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

-- Create new comprehensive policies

-- Policy 1: All authenticated users can view users in their practice
CREATE POLICY "Users can view practice members" ON users
  FOR SELECT
  USING (
    -- User can see themselves
    auth.uid() = id 
    OR
    -- User can see others in their practice
    practice_id IN (
      SELECT practice_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Admins and doctors can insert/update users in their practice
CREATE POLICY "Admins and doctors can manage practice users" ON users
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id 
      FROM users 
      WHERE practice_id = users.practice_id 
      AND role IN ('admin', 'doctor')
    )
  );

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```
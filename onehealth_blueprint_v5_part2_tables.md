# 🏥 ONEHEALTH SYSTEM BLUEPRINT V5.0 - PART 2: REMAINING TABLES
**Version**: 5.0  
**Last Updated**: 2025-01-11 20:30:00 UTC

---

## 💰 BILLING & FINANCIAL TABLES (8 tables)

### 4.1 `invoices_enhanced` - Comprehensive Invoice System
**Created**: 2024-06-01 14:20:00 UTC | **Last Modified**: 2025-01-08 16:45:00 UTC
```sql
CREATE TABLE public.invoices_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    system_transaction_number TEXT UNIQUE NOT NULL,
    
    -- Relations
    patient_id UUID REFERENCES patients(id) NOT NULL,
    visit_id UUID REFERENCES visits(id),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    generated_by UUID REFERENCES users(id) NOT NULL,
    
    -- Invoice Details
    invoice_type TEXT DEFAULT 'standard' CHECK (invoice_type IN (
        'standard', 'proforma', 'credit_note', 'debit_note', 'statement'
    )),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    service_date DATE,
    
    -- Medical Aid
    is_medical_aid BOOLEAN DEFAULT false,
    medical_aid_id UUID REFERENCES medical_aid_providers(id),
    medical_aid_scheme_id UUID REFERENCES medical_aid_schemes(id),
    medical_aid_plan TEXT,
    medical_aid_number TEXT,
    authorization_number TEXT,
    batch_id UUID REFERENCES batch_headers(id),
    
    -- Financial Details
    currency TEXT DEFAULT 'NAD',
    exchange_rate DECIMAL(10,6) DEFAULT 1.000000,
    subtotal DECIMAL(10,2) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 15,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    balance_due DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending', 'sent', 'viewed', 'partially_paid', 
        'paid', 'overdue', 'cancelled', 'refunded', 'written_off'
    )),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN (
        'unpaid', 'partial', 'paid', 'overpaid', 'refunded'
    )),
    
    -- Payment Information
    payment_terms TEXT DEFAULT 'immediate',
    payment_method TEXT,
    paid_at TIMESTAMPTZ,
    
    -- Notes
    internal_notes TEXT,
    customer_notes TEXT,
    terms_and_conditions TEXT,
    
    -- Submission
    submitted_to_medical_aid BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ,
    claim_number TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT
);

-- Indexes
CREATE INDEX idx_invoices_patient ON invoices_enhanced(patient_id);
CREATE INDEX idx_invoices_visit ON invoices_enhanced(visit_id);
CREATE INDEX idx_invoices_practice ON invoices_enhanced(practice_id);
CREATE INDEX idx_invoices_status ON invoices_enhanced(status);
CREATE INDEX idx_invoices_date ON invoices_enhanced(invoice_date DESC);
CREATE INDEX idx_invoices_unpaid ON invoices_enhanced(patient_id) WHERE balance_due > 0;
CREATE INDEX idx_invoices_batch ON invoices_enhanced(batch_id) WHERE batch_id IS NOT NULL;

-- Triggers
-- 1. assign_system_transaction_number_trigger (BEFORE INSERT)
-- 2. auto_assign_invoice_to_batch_trigger (AFTER INSERT WHERE is_medical_aid = true)
-- 3. calculate_invoice_totals_trigger (BEFORE INSERT, UPDATE)
-- 4. update_invoices_enhanced_updated_at (BEFORE UPDATE)
-- 5. audit_invoices_trigger (AFTER INSERT, UPDATE, DELETE)
-- 6. invoice_payment_status_trigger (AFTER UPDATE OF amount_paid)
```

### 4.2 `invoice_services` - Invoice Line Items
**Created**: 2024-06-01 15:00:00 UTC | **Last Modified**: 2024-12-15 11:30:00 UTC
```sql
CREATE TABLE public.invoice_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices_enhanced(id) ON DELETE CASCADE NOT NULL,
    
    -- Service Details
    service_code TEXT NOT NULL,
    service_name TEXT NOT NULL,
    service_category TEXT,
    tariff_id UUID REFERENCES practice_tariffs(id),
    
    -- Quantities & Amounts
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 15,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Medical Aid
    medical_aid_rate DECIMAL(10,2),
    medical_aid_units DECIMAL(10,2),
    patient_portion DECIMAL(10,2),
    medical_aid_portion DECIMAL(10,2),
    
    -- Details
    description TEXT,
    notes TEXT,
    service_date DATE,
    provider_id UUID REFERENCES users(id),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    sort_order INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_invoice_services_invoice ON invoice_services(invoice_id);
CREATE INDEX idx_invoice_services_tariff ON invoice_services(tariff_id);
CREATE INDEX idx_invoice_services_provider ON invoice_services(provider_id);

-- Triggers
-- 1. calculate_line_item_totals_trigger (BEFORE INSERT, UPDATE)
-- 2. update_invoice_totals_trigger (AFTER INSERT, UPDATE, DELETE)
```

### 4.3 `practice_tariffs` - Service Pricing
**Created**: 2024-05-20 09:00:00 UTC | **Last Modified**: 2025-01-10 10:30:00 UTC
```sql
CREATE TABLE public.practice_tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    
    -- Tariff Information
    tariff_code TEXT NOT NULL,
    tariff_name TEXT NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT,
    tariff_type TEXT DEFAULT 'service' CHECK (tariff_type IN (
        'service', 'product', 'package', 'consumable'
    )),
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    medical_aid_price DECIMAL(10,2),
    cash_price DECIMAL(10,2),
    
    -- Medical Aid
    nappi_code TEXT,
    icd10_codes TEXT[],
    medical_aid_units DECIMAL(10,2) DEFAULT 1,
    
    -- Tax
    is_taxable BOOLEAN DEFAULT true,
    tax_percentage DECIMAL(5,2) DEFAULT 15,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    
    -- Description
    description TEXT,
    duration_minutes INTEGER,
    requires_authorization BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_tariffs_practice ON practice_tariffs(practice_id);
CREATE INDEX idx_tariffs_code ON practice_tariffs(tariff_code);
CREATE INDEX idx_tariffs_category ON practice_tariffs(category);
CREATE INDEX idx_tariffs_active ON practice_tariffs(practice_id) WHERE is_active = true;

-- Unique constraint per practice
CREATE UNIQUE INDEX idx_tariffs_unique_code ON practice_tariffs(practice_id, tariff_code) WHERE is_active = true;

-- Triggers
-- 1. update_practice_tariffs_updated_at (BEFORE UPDATE)
-- 2. audit_tariffs_trigger (AFTER INSERT, UPDATE, DELETE)
```

### 4.4 `batch_headers` - Medical Aid Batch Claims
**Created**: 2024-07-01 08:30:00 UTC | **Last Modified**: 2025-01-05 14:20:00 UTC
```sql
CREATE TABLE public.batch_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number TEXT UNIQUE NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    medical_aid_id UUID REFERENCES medical_aid_providers(id) NOT NULL,
    
    -- Batch Details
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    
    -- Counts & Amounts
    total_invoices INTEGER DEFAULT 0,
    total_services INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'open' CHECK (status IN (
        'open', 'closed', 'submitted', 'acknowledged', 
        'processing', 'paid', 'rejected', 'partial'
    )),
    
    -- Submission
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    submitted_at TIMESTAMPTZ,
    submitted_by UUID REFERENCES users(id),
    submission_method TEXT,
    submission_reference TEXT,
    
    -- Response
    acknowledged_at TIMESTAMPTZ,
    acknowledgement_number TEXT,
    payment_date DATE,
    payment_reference TEXT,
    payment_amount DECIMAL(10,2),
    rejected_amount DECIMAL(10,2),
    rejection_reasons TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_batch_headers_practice ON batch_headers(practice_id);
CREATE INDEX idx_batch_headers_medical_aid ON batch_headers(medical_aid_id);
CREATE INDEX idx_batch_headers_status ON batch_headers(status);
CREATE INDEX idx_batch_headers_date ON batch_headers(batch_date DESC);

-- Triggers
-- 1. generate_batch_number_trigger (BEFORE INSERT)
-- 2. update_batch_totals_trigger (AFTER UPDATE)
-- 3. close_batch_validation_trigger (BEFORE UPDATE OF status)
```

### 4.5 `batch_details` - Batch Line Items
**Created**: 2024-07-01 09:00:00 UTC | **Last Modified**: 2024-12-20 10:15:00 UTC
```sql
CREATE TABLE public.batch_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES batch_headers(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices_enhanced(id) NOT NULL,
    
    -- Patient Info
    patient_name TEXT NOT NULL,
    patient_id_number TEXT,
    medical_aid_number TEXT NOT NULL,
    
    -- Amounts
    invoice_amount DECIMAL(10,2) NOT NULL,
    claimed_amount DECIMAL(10,2) NOT NULL,
    approved_amount DECIMAL(10,2),
    rejected_amount DECIMAL(10,2),
    patient_portion DECIMAL(10,2),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'submitted', 'approved', 'partial', 'rejected'
    )),
    rejection_codes TEXT[],
    rejection_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    line_number INTEGER
);

-- Indexes
CREATE INDEX idx_batch_details_batch ON batch_details(batch_id);
CREATE INDEX idx_batch_details_invoice ON batch_details(invoice_id);
CREATE INDEX idx_batch_details_status ON batch_details(status);
```

---

## 👥 HR & PAYROLL TABLES (19 tables)

### 5.1 `users` - System Users & Employees
**Created**: 2024-05-15 08:00:00 UTC | **Last Modified**: 2025-01-11 17:45:00 UTC
```sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    
    -- Personal Information
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    display_name TEXT,
    title TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    date_of_birth DATE,
    nationality TEXT,
    
    -- Contact
    phone TEXT,
    alternative_phone TEXT,
    personal_email TEXT,
    
    -- Professional
    professional_registration_number TEXT,
    professional_board TEXT,
    specialization TEXT,
    qualification TEXT,
    years_of_experience INTEGER,
    
    -- Employment
    employee_number TEXT UNIQUE,
    employment_status TEXT DEFAULT 'active' CHECK (employment_status IN (
        'active', 'on_leave', 'suspended', 'terminated', 'resigned'
    )),
    employment_type TEXT DEFAULT 'full_time' CHECK (employment_type IN (
        'full_time', 'part_time', 'contract', 'locum', 'intern'
    )),
    job_title TEXT,
    department_id UUID REFERENCES departments(id),
    reports_to UUID REFERENCES users(id),
    
    -- Access
    role TEXT NOT NULL CHECK (role IN (
        'super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 
        'billing', 'lab_tech', 'pharmacist', 'therapist', 'other'
    )),
    is_active BOOLEAN DEFAULT true,
    can_login BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    
    -- Dates
    hire_date DATE,
    confirmation_date DATE,
    resignation_date DATE,
    termination_date DATE,
    
    -- Settings
    preferred_language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'Africa/Windhoek',
    theme TEXT DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT true,
    
    -- Avatar
    avatar_url TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_employee_number ON users(employee_number);

-- Triggers
-- 1. generate_employee_number_trigger (BEFORE INSERT)
-- 2. update_users_updated_at (BEFORE UPDATE)
-- 3. audit_users_trigger (AFTER INSERT, UPDATE)
-- 4. sync_auth_user_trigger (AFTER INSERT, UPDATE)
```

### 5.2 `employee_salaries` - Salary Configuration
**Created**: 2024-08-01 10:00:00 UTC | **Last Modified**: 2024-12-20 15:30:00 UTC
```sql
CREATE TABLE public.employee_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Basic Salary
    base_salary DECIMAL(10,2) NOT NULL,
    salary_currency TEXT DEFAULT 'NAD',
    pay_frequency TEXT DEFAULT 'monthly' CHECK (pay_frequency IN (
        'weekly', 'bi_weekly', 'monthly'
    )),
    
    -- Allowances
    housing_allowance DECIMAL(10,2) DEFAULT 0,
    transport_allowance DECIMAL(10,2) DEFAULT 0,
    medical_allowance DECIMAL(10,2) DEFAULT 0,
    meal_allowance DECIMAL(10,2) DEFAULT 0,
    communication_allowance DECIMAL(10,2) DEFAULT 0,
    other_allowances DECIMAL(10,2) DEFAULT 0,
    
    -- Deductions
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    pension_rate DECIMAL(5,2) DEFAULT 0,
    pension_amount DECIMAL(10,2) DEFAULT 0,
    medical_aid_amount DECIMAL(10,2) DEFAULT 0,
    social_security_amount DECIMAL(10,2) DEFAULT 0,
    other_deductions DECIMAL(10,2) DEFAULT 0,
    
    -- Banking
    bank_name TEXT,
    bank_branch TEXT,
    account_number TEXT,
    account_type TEXT,
    branch_code TEXT,
    swift_code TEXT,
    
    -- Commission/Bonus
    commission_rate DECIMAL(5,2) DEFAULT 0,
    commission_structure JSONB DEFAULT '{}',
    bonus_structure JSONB DEFAULT '{}',
    
    -- Overtime
    overtime_rate DECIMAL(5,2) DEFAULT 1.5,
    weekend_rate DECIMAL(5,2) DEFAULT 2.0,
    holiday_rate DECIMAL(5,2) DEFAULT 2.5,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_employee_salaries_user ON employee_salaries(user_id);
CREATE INDEX idx_employee_salaries_practice ON employee_salaries(practice_id);
CREATE INDEX idx_employee_salaries_active ON employee_salaries(user_id) WHERE is_active = true;

-- Triggers
-- 1. calculate_salary_deductions_trigger (BEFORE INSERT, UPDATE)
-- 2. update_employee_salaries_updated_at (BEFORE UPDATE)
-- 3. audit_salary_changes_trigger (AFTER UPDATE)
```

### 5.3 `timesheets` - Timesheet Headers
**Created**: 2024-08-15 09:00:00 UTC | **Last Modified**: 2025-01-10 11:20:00 UTC
```sql
CREATE TABLE public.timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    pay_period TEXT,
    
    -- Hours Summary
    regular_hours DECIMAL(10,2) DEFAULT 0,
    overtime_hours DECIMAL(10,2) DEFAULT 0,
    weekend_hours DECIMAL(10,2) DEFAULT 0,
    holiday_hours DECIMAL(10,2) DEFAULT 0,
    sick_hours DECIMAL(10,2) DEFAULT 0,
    vacation_hours DECIMAL(10,2) DEFAULT 0,
    total_hours DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'submitted', 'approved', 'rejected', 'processed'
    )),
    
    -- Workflow
    submitted_at TIMESTAMPTZ,
    submitted_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    processed_at TIMESTAMPTZ,
    payslip_id UUID REFERENCES payslips(id),
    
    -- Notes
    employee_notes TEXT,
    manager_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_timesheets_user ON timesheets(user_id);
CREATE INDEX idx_timesheets_period ON timesheets(period_start, period_end);
CREATE INDEX idx_timesheets_status ON timesheets(status);
CREATE INDEX idx_timesheets_pending ON timesheets(user_id) WHERE status = 'submitted';

-- Unique constraint
CREATE UNIQUE INDEX idx_timesheets_unique_period ON timesheets(user_id, period_start, period_end);

-- Triggers
-- 1. calculate_total_hours_trigger (BEFORE INSERT, UPDATE)
-- 2. update_timesheets_updated_at (BEFORE UPDATE)
-- 3. timesheet_approval_notification_trigger (AFTER UPDATE OF status)
```

### 5.4 `timesheet_entries` - Daily Time Records
**Created**: 2024-08-15 09:30:00 UTC | **Last Modified**: 2025-01-10 11:45:00 UTC
```sql
CREATE TABLE public.timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timesheet_id UUID REFERENCES timesheets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    
    -- Date & Time
    work_date DATE NOT NULL,
    clock_in TIME,
    clock_out TIME,
    break_start TIME,
    break_end TIME,
    
    -- Hours Calculation
    regular_hours DECIMAL(10,2) DEFAULT 0,
    overtime_hours DECIMAL(10,2) DEFAULT 0,
    break_hours DECIMAL(10,2) DEFAULT 0,
    total_hours DECIMAL(10,2) DEFAULT 0,
    
    -- Type
    entry_type TEXT DEFAULT 'regular' CHECK (entry_type IN (
        'regular', 'overtime', 'weekend', 'holiday', 
        'sick', 'vacation', 'unpaid', 'other'
    )),
    
    -- Location
    work_location TEXT,
    branch_id UUID REFERENCES branches(id),
    is_remote BOOLEAN DEFAULT false,
    
    -- Tasks/Projects
    tasks_performed TEXT,
    project_codes TEXT[],
    
    -- Status
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    gps_clock_in JSONB,
    gps_clock_out JSONB
);

-- Indexes
CREATE INDEX idx_timesheet_entries_timesheet ON timesheet_entries(timesheet_id);
CREATE INDEX idx_timesheet_entries_user_date ON timesheet_entries(user_id, work_date);
CREATE INDEX idx_timesheet_entries_date ON timesheet_entries(work_date);

-- Triggers
-- 1. calculate_timesheet_hours (BEFORE INSERT, UPDATE) - Auto-calculates hours
-- 2. update_timesheet_totals_trigger (AFTER INSERT, UPDATE, DELETE)
-- 3. validate_clock_times_trigger (BEFORE INSERT, UPDATE)
```

### 5.5 `payslips` - Employee Payslips
**Created**: 2024-08-20 14:00:00 UTC | **Last Modified**: 2025-01-10 16:00:00 UTC
```sql
CREATE TABLE public.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Period
    pay_period TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payment_date DATE NOT NULL,
    
    -- Earnings
    basic_salary DECIMAL(10,2) NOT NULL,
    overtime_pay DECIMAL(10,2) DEFAULT 0,
    commission DECIMAL(10,2) DEFAULT 0,
    bonus DECIMAL(10,2) DEFAULT 0,
    allowances DECIMAL(10,2) DEFAULT 0,
    other_earnings DECIMAL(10,2) DEFAULT 0,
    gross_earnings DECIMAL(10,2) NOT NULL,
    
    -- Deductions
    income_tax DECIMAL(10,2) DEFAULT 0,
    social_security DECIMAL(10,2) DEFAULT 0,
    pension DECIMAL(10,2) DEFAULT 0,
    medical_aid DECIMAL(10,2) DEFAULT 0,
    loans DECIMAL(10,2) DEFAULT 0,
    other_deductions DECIMAL(10,2) DEFAULT 0,
    total_deductions DECIMAL(10,2) DEFAULT 0,
    
    -- Net Pay
    net_pay DECIMAL(10,2) NOT NULL,
    
    -- YTD Totals
    ytd_earnings DECIMAL(10,2) DEFAULT 0,
    ytd_deductions DECIMAL(10,2) DEFAULT 0,
    ytd_net_pay DECIMAL(10,2) DEFAULT 0,
    ytd_tax DECIMAL(10,2) DEFAULT 0,
    
    -- Leave Balances
    leave_taken_this_period JSONB DEFAULT '{}',
    leave_balance JSONB DEFAULT '{}',
    
    -- Payment
    payment_method TEXT DEFAULT 'bank_transfer',
    payment_reference TEXT,
    bank_details JSONB,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'approved', 'paid', 'cancelled', 'reversed'
    )),
    
    -- Workflow
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    is_final BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_payslips_user ON payslips(user_id);
CREATE INDEX idx_payslips_period ON payslips(period_start, period_end);
CREATE INDEX idx_payslips_payment_date ON payslips(payment_date);
CREATE INDEX idx_payslips_status ON payslips(status);

-- Triggers
-- 1. generate_payslip_number_trigger (BEFORE INSERT)
-- 2. calculate_payslip_totals_trigger (BEFORE INSERT, UPDATE)
-- 3. update_ytd_totals_trigger (AFTER INSERT)
-- 4. payslip_email_notification_trigger (AFTER UPDATE OF status)
```

### 5.6 `leave_requests` - Leave Applications
**Created**: 2024-09-01 10:00:00 UTC | **Last Modified**: 2025-01-10 13:15:00 UTC
```sql
CREATE TABLE public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Leave Details
    leave_type_id UUID REFERENCES leave_types(id) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    return_date DATE NOT NULL,
    days_requested DECIMAL(5,2) NOT NULL,
    
    -- Half Day Options
    is_half_day BOOLEAN DEFAULT false,
    half_day_period TEXT CHECK (half_day_period IN ('morning', 'afternoon')),
    
    -- Reason
    reason TEXT NOT NULL,
    supporting_documents JSONB DEFAULT '[]',
    
    -- Contact During Leave
    contact_number TEXT,
    contact_address TEXT,
    covering_employee_id UUID REFERENCES users(id),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'draft', 'pending', 'approved', 'rejected', 
        'cancelled', 'withdrawn'
    )),
    
    -- Approval Workflow
    submitted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_comments TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Balance Check
    balance_before DECIMAL(5,2),
    balance_after DECIMAL(5,2),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_emergency BOOLEAN DEFAULT false,
    is_paid BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_pending ON leave_requests(status) WHERE status = 'pending';

-- Triggers
-- 1. generate_leave_request_number_trigger (BEFORE INSERT)
-- 2. calculate_leave_days_trigger (BEFORE INSERT, UPDATE)
-- 3. check_leave_balance_trigger (BEFORE UPDATE OF status)
-- 4. update_leave_balance_trigger (AFTER UPDATE OF status)
-- 5. leave_approval_notification_trigger (AFTER UPDATE OF status)
```

### 5.7 `departments` - Department Structure
**Created**: 2024-07-20 11:00:00 UTC | **Last Modified**: 2024-11-15 14:30:00 UTC
```sql
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Department Info
    department_name TEXT NOT NULL,
    department_code TEXT UNIQUE,
    description TEXT,
    
    -- Hierarchy
    parent_department_id UUID REFERENCES departments(id),
    department_head_id UUID REFERENCES users(id),
    
    -- Configuration
    cost_center TEXT,
    budget_allocated DECIMAL(10,2),
    max_employees INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_departments_practice ON departments(practice_id);
CREATE INDEX idx_departments_head ON departments(department_head_id);
CREATE INDEX idx_departments_active ON departments(practice_id) WHERE is_active = true;

-- Triggers
-- 1. generate_department_code_trigger (BEFORE INSERT)
-- 2. update_departments_updated_at (BEFORE UPDATE)
```

---

## 📡 COMMUNICATION TABLES (23 tables)

### 6.1 `practice_sms_logs` - SMS Message History
**Created**: 2024-11-01 09:00:00 UTC | **Last Modified**: 2025-01-10 18:45:00 UTC
```sql
CREATE TABLE public.practice_sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Message Details
    recipient_phone TEXT NOT NULL,
    sender_phone TEXT DEFAULT 'ONEHEALTH',
    message_content TEXT NOT NULL,
    message_type TEXT DEFAULT 'general' CHECK (message_type IN (
        'general', 'appointment_reminder', 'appointment_confirmation',
        'visit_followup', 'birthday', 'marketing', 'payment_reminder',
        'lab_results', 'prescription', 'emergency'
    )),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'sent', 'delivered', 'failed', 
        'expired', 'rejected', 'blocked'
    )),
    
    -- Provider Details
    provider TEXT DEFAULT 'smsportal',
    provider_message_id TEXT,
    provider_response JSONB,
    delivery_report JSONB,
    delivery_status_code TEXT,
    
    -- Cost
    segments INTEGER DEFAULT 1,
    cost_per_sms DECIMAL(10,4) DEFAULT 0.50,
    total_cost DECIMAL(10,2),
    
    -- Relations
    patient_id UUID REFERENCES patients(id),
    appointment_id UUID REFERENCES visits(id),
    visit_id UUID REFERENCES visits(id),
    invoice_id UUID REFERENCES invoices_enhanced(id),
    user_id UUID REFERENCES users(id),
    
    -- Automation
    automation_execution_id UUID REFERENCES automation_executions(id),
    template_id UUID REFERENCES sms_templates(id),
    template_variables JSONB,
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Campaign
    campaign_id TEXT,
    batch_id TEXT,
    
    -- Metadata
    source TEXT DEFAULT 'manual',
    ip_address INET,
    user_agent TEXT
);

-- Indexes
CREATE INDEX idx_sms_logs_practice ON practice_sms_logs(practice_id);
CREATE INDEX idx_sms_logs_status ON practice_sms_logs(status);
CREATE INDEX idx_sms_logs_created ON practice_sms_logs(created_at DESC);
CREATE INDEX idx_sms_logs_patient ON practice_sms_logs(patient_id);
CREATE INDEX idx_sms_logs_phone ON practice_sms_logs(recipient_phone);
CREATE INDEX idx_sms_logs_failed ON practice_sms_logs(practice_id) WHERE status = 'failed';

-- Triggers
-- 1. calculate_sms_cost_trigger (BEFORE INSERT, UPDATE)
-- 2. update_sms_usage_trigger (AFTER INSERT WHERE status = 'sent')
-- 3. check_sms_balance_trigger (BEFORE UPDATE OF status)
```

### 6.2 `practice_sms_subscriptions` - SMS Package Subscriptions
**Created**: 2024-11-01 10:00:00 UTC | **Last Modified**: 2025-01-10 15:00:00 UTC
```sql
CREATE TABLE public.practice_sms_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) UNIQUE NOT NULL,
    
    -- Plan Details
    plan_type TEXT NOT NULL CHECK (plan_type IN (
        'starter', 'professional', 'enterprise', 'custom'
    )),
    plan_name TEXT NOT NULL,
    
    -- Credits
    monthly_credits INTEGER NOT NULL,
    credits_used INTEGER DEFAULT 0,
    credits_remaining INTEGER,
    bonus_credits INTEGER DEFAULT 0,
    rollover_credits INTEGER DEFAULT 0,
    
    -- Pricing
    monthly_fee DECIMAL(10,2) NOT NULL,
    cost_per_sms DECIMAL(10,4) NOT NULL,
    overage_rate DECIMAL(10,4),
    
    -- Billing
    billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN (
        'monthly', 'quarterly', 'annually'
    )),
    billing_day INTEGER DEFAULT 1,
    next_billing_date DATE,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'suspended', 'cancelled', 'expired', 'trial'
    )),
    
    -- Dates
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    trial_end_date DATE,
    suspended_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Usage
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    delivery_rate DECIMAL(5,2),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_reset_at TIMESTAMPTZ,
    notes TEXT
);

-- Indexes
CREATE INDEX idx_sms_subscriptions_practice ON practice_sms_subscriptions(practice_id);
CREATE INDEX idx_sms_subscriptions_status ON practice_sms_subscriptions(status);
CREATE INDEX idx_sms_subscriptions_billing ON practice_sms_subscriptions(next_billing_date);

-- Triggers
-- 1. calculate_remaining_credits_trigger (BEFORE UPDATE)
-- 2. reset_monthly_credits_trigger (CALLED BY CRON)
-- 3. suspend_on_zero_credits_trigger (AFTER UPDATE)
```

### 6.3 `sms_templates` - SMS Message Templates
**Created**: 2024-11-05 11:30:00 UTC | **Last Modified**: 2025-01-08 09:00:00 UTC
```sql
CREATE TABLE public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    
    -- Template Info
    template_name TEXT NOT NULL,
    template_code TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    message_type TEXT NOT NULL,
    
    -- Content
    message_content TEXT NOT NULL,
    character_count INTEGER,
    segment_count INTEGER DEFAULT 1,
    
    -- Variables
    available_variables TEXT[] DEFAULT ARRAY[
        '{{patientName}}', '{{appointmentDate}}', '{{appointmentTime}}',
        '{{doctorName}}', '{{practiceName}}', '{{amount}}', '{{link}}'
    ],
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_system_template BOOLEAN DEFAULT false,
    requires_approval BOOLEAN DEFAULT false,
    auto_translate BOOLEAN DEFAULT false,
    
    -- Language
    language TEXT DEFAULT 'en',
    parent_template_id UUID REFERENCES sms_templates(id),
    
    -- Usage
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_sms_templates_practice ON sms_templates(practice_id);
CREATE INDEX idx_sms_templates_category ON sms_templates(category);
CREATE INDEX idx_sms_templates_active ON sms_templates(practice_id) WHERE is_active = true;

-- Triggers
-- 1. calculate_character_count_trigger (BEFORE INSERT, UPDATE)
-- 2. update_sms_templates_updated_at (BEFORE UPDATE)
```

---

This is Part 2 covering Billing, HR/Payroll, and Communication tables. Continue with Part 3?
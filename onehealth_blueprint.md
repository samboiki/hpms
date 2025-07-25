# 🏥 ONEHEALTH SYSTEM BLUEPRINT - COMPLETE TECHNICAL REFERENCE
**Version**: 4.0  
**Last Updated**: 2025-01-11 19:00:00 UTC  
**Based on**: Commit b8d98e7 (Last Known Good State)

---

## 🚨 QUICK REFERENCE GUIDE

### Critical Tables for Common Tasks:
- **Appointments**: `visits` table (visit_date + visit_time for scheduling)
- **Patients**: `patients` table (system_patient_reference_number auto-generated)
- **SMS/Email**: `practice_sms_logs`, `practice_email_logs` (via edge functions)
- **Billing**: `invoices_enhanced` → `invoice_services` → `batch_headers`
- **HR/Payroll**: `employee_salaries` → `payslips` → `payslip_items`

### Critical Edge Functions:
- **SMS**: `centralized-sms-gateway` (SMSPortal integration)
- **Email**: `centralized-email-gateway` (Resend API)
- **Automation**: `process-automation-queue` (processes queue)

### Most Used Forms:
- **Patient Registration**: `ModernPatientRegistrationForm.tsx`
- **Appointment Scheduling**: `PremiumAppointmentScheduler.tsx`
- **Visit Recording**: `PremiumAddVisitForm.tsx`
- **Invoice Generation**: `InvoiceGenerationModal.tsx`

---

## 📋 TABLE OF CONTENTS

### PART A: DATABASE ARCHITECTURE
1. [Complete Database Schema](#a1-complete-database-schema)
2. [Database Triggers](#a2-database-triggers)
3. [Database Functions](#a3-database-functions)
4. [Views & Materialized Views](#a4-views--materialized-views)

### PART B: EDGE FUNCTIONS & APIS
5. [Edge Function Definitions](#b5-edge-function-definitions)
6. [API Endpoints](#b6-api-endpoints)
7. [External Integrations](#b7-external-integrations)

### PART C: FRONTEND COMPONENTS
8. [Forms & Modals](#c8-forms--modals)
9. [Page Components](#c9-page-components)
10. [Shared Components](#c10-shared-components)

### PART D: SYSTEM WORKFLOWS
11. [Authentication & Access](#d11-authentication--access)
12. [Patient Management](#d12-patient-management)
13. [Appointments & Scheduling](#d13-appointments--scheduling)
14. [Clinical Encounters](#d14-clinical-encounters)
15. [Communications & Automations](#d15-communications--automations)
16. [Billing & Invoicing](#d16-billing--invoicing)
17. [Laboratory & Imaging](#d17-laboratory--imaging)
18. [Queue Management](#d18-queue-management)
19. [HR & Payroll](#d19-hr--payroll)
20. [Batch Processing](#d20-batch-processing)
21. [Settings & Configuration](#d21-settings--configuration)

### PART E: SYSTEM HEALTH
22. [Active vs Unused Components](#e22-active-vs-unused-components)
23. [Performance Considerations](#e23-performance-considerations)
24. [Security & Compliance](#e24-security--compliance)

---

# PART A: DATABASE ARCHITECTURE

## A1. COMPLETE DATABASE SCHEMA

### 🏥 CORE PATIENT TABLES

#### `patients` - Core Patient Records
**Created**: 2024-05-15 | **Last Modified**: 2025-01-10
```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_patient_reference_number TEXT UNIQUE,
    government_id_number TEXT,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Namibia',
    occupation TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    blood_type TEXT,
    allergies TEXT,
    chronic_conditions TEXT,
    practice_id UUID REFERENCES practices(id),
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Triggers:
-- assign_system_patient_reference_number_trigger
-- update_patients_updated_at
-- audit_patients_trigger
```

#### `visits` - PRIMARY Appointment & Visit Table ⭐
**Created**: 2024-05-15 | **Last Modified**: 2025-01-11
```sql
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_number TEXT UNIQUE,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    doctor_id UUID REFERENCES users(id),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    
    -- CRITICAL: These fields handle BOTH appointments and visits
    visit_date DATE NOT NULL,  -- The appointment/visit date
    visit_time TIME,           -- The appointment/visit time
    
    -- Scheduling fields
    is_scheduled BOOLEAN DEFAULT false,  -- true = appointment, false = walk-in
    scheduled_date DATE,  -- Original scheduled date (if rescheduled)
    scheduled_time TIME,  -- Original scheduled time (if rescheduled)
    
    -- Visit details
    chief_complaint TEXT,
    visit_notes TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    follow_up_instructions TEXT,
    
    -- Status tracking
    status TEXT DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'confirmed', 'ready', 'in_progress', 
        'completed', 'cancelled', 'no_show', 'rescheduled'
    )),
    
    -- Billing
    total_amount DECIMAL(10,2) DEFAULT 0,
    invoice_id UUID REFERENCES invoices_enhanced(id),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id)
);

-- Triggers:
-- generate_visit_number
-- update_visits_updated_at
-- audit_visits_trigger
-- appointment_automation_trigger (NEW)
```

### 💊 CLINICAL TABLES

#### `vitals` - Patient Vital Signs
**Created**: 2024-05-20 | **Last Modified**: 2024-12-15
```sql
CREATE TABLE vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) NOT NULL,
    visit_id UUID REFERENCES visits(id),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Vital measurements
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    temperature DECIMAL(4,1),
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    bmi DECIMAL(4,1),
    blood_glucose DECIMAL(5,1),
    
    -- Additional notes
    notes TEXT,
    
    -- Metadata
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers:
-- update_vitals_updated_at
-- audit_vitals_trigger
```

### 💰 BILLING TABLES

#### `invoices_enhanced` - Comprehensive Invoice System
**Created**: 2024-06-01 | **Last Modified**: 2025-01-08
```sql
CREATE TABLE invoices_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    system_transaction_number TEXT UNIQUE,
    
    -- Relations
    patient_id UUID REFERENCES patients(id) NOT NULL,
    visit_id UUID REFERENCES visits(id),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    
    -- Medical aid
    medical_aid_id UUID REFERENCES medical_aid_providers(id),
    medical_aid_plan TEXT,
    medical_aid_number TEXT,
    batch_id UUID REFERENCES batch_headers(id),
    
    -- Financial details
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    balance_due DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending', 'partially_paid', 'paid', 
        'overdue', 'cancelled', 'refunded'
    )),
    payment_status TEXT DEFAULT 'unpaid',
    
    -- Dates
    invoice_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    paid_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Triggers:
-- assign_system_transaction_number_trigger
-- auto_assign_invoice_to_batch_trigger
-- update_invoices_enhanced_updated_at
```

### 📱 COMMUNICATION TABLES

#### `practice_sms_logs` - SMS Tracking System
**Created**: 2024-11-01 | **Last Modified**: 2025-01-10
```sql
CREATE TABLE practice_sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Message details
    recipient_phone TEXT NOT NULL,
    sender_phone TEXT,
    message_content TEXT NOT NULL,
    message_type TEXT DEFAULT 'general',
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'sent', 'delivered', 
        'failed', 'expired', 'rejected'
    )),
    
    -- Provider details
    provider TEXT DEFAULT 'smsportal',
    provider_message_id TEXT,
    provider_response JSONB,
    delivery_report JSONB,
    
    -- Cost tracking
    cost_per_sms DECIMAL(10,4) DEFAULT 0.50,
    total_cost DECIMAL(10,2),
    
    -- Relations
    patient_id UUID REFERENCES patients(id),
    appointment_id UUID REFERENCES visits(id),
    visit_id UUID REFERENCES visits(id),
    invoice_id UUID REFERENCES invoices_enhanced(id),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Automation
    automation_id TEXT,
    template_id UUID REFERENCES sms_templates(id)
);

-- Indexes:
CREATE INDEX idx_sms_logs_practice ON practice_sms_logs(practice_id);
CREATE INDEX idx_sms_logs_status ON practice_sms_logs(status);
CREATE INDEX idx_sms_logs_created ON practice_sms_logs(created_at);
```

### 🤖 AUTOMATION TABLES

#### `automation_queue` - Central Automation Queue
**Created**: 2024-11-15 | **Last Modified**: 2025-01-11
```sql
CREATE TABLE automation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Execution reference
    execution_id UUID REFERENCES automation_executions(id),
    
    -- Processing details
    status TEXT DEFAULT 'queued' CHECK (status IN (
        'queued', 'processing', 'completed', 'failed', 'cancelled'
    )),
    priority INTEGER DEFAULT 5,
    
    -- Scheduling
    scheduled_for TIMESTAMPTZ NOT NULL,
    process_after TIMESTAMPTZ,
    
    -- Processing results
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers:
-- notify_queue_webhook (attempts to notify webhook - currently broken)
```

### 👥 HR & PAYROLL TABLES

#### `employee_salaries` - Employee Compensation
**Created**: 2024-08-01 | **Last Modified**: 2024-12-20
```sql
CREATE TABLE employee_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Salary details
    base_salary DECIMAL(10,2) NOT NULL,
    housing_allowance DECIMAL(10,2) DEFAULT 0,
    transport_allowance DECIMAL(10,2) DEFAULT 0,
    medical_allowance DECIMAL(10,2) DEFAULT 0,
    other_allowances DECIMAL(10,2) DEFAULT 0,
    
    -- Deductions
    tax_rate DECIMAL(5,2) DEFAULT 0,
    pension_rate DECIMAL(5,2) DEFAULT 0,
    medical_aid_amount DECIMAL(10,2) DEFAULT 0,
    other_deductions DECIMAL(10,2) DEFAULT 0,
    
    -- Employment details
    employment_type TEXT DEFAULT 'full_time',
    pay_frequency TEXT DEFAULT 'monthly',
    bank_name TEXT,
    account_number TEXT,
    branch_code TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);
```

## A2. DATABASE TRIGGERS

### 🔄 ACTIVE TRIGGERS

#### 1. `assign_system_patient_reference_number_trigger`
**Table**: patients | **Created**: 2024-05-15 | **Status**: ✅ ACTIVE
```sql
-- Automatically assigns sequential patient reference numbers
-- Format: P000001, P000002, etc.
-- Fires: BEFORE INSERT on patients
-- Function: get_next_system_patient_reference_number()
```

#### 2. `appointment_automation_trigger`
**Table**: visits | **Created**: 2025-01-10 | **Status**: ✅ ACTIVE
```sql
-- Triggers automation for new appointments
-- Only fires when is_scheduled = true
-- Creates automation_execution and queues automation
-- Function: process_appointment_automation()
```

#### 3. `generate_visit_number`
**Table**: visits | **Created**: 2024-05-20 | **Status**: ✅ ACTIVE
```sql
-- Generates unique visit numbers
-- Format: V-YYYYMMDD-XXXX
-- Fires: BEFORE INSERT on visits
-- Function: generate_visit_number()
```

#### 4. `calculate_timesheet_hours`
**Table**: timesheet_entries | **Created**: 2024-08-15 | **Status**: ✅ ACTIVE
```sql
-- Auto-calculates hours worked from clock in/out times
-- Updates regular_hours, overtime_hours, total_hours
-- Fires: BEFORE INSERT OR UPDATE on timesheet_entries
-- Function: calculate_timesheet_entry_hours()
```

#### 5. `audit_[table]_trigger` (Multiple tables)
**Tables**: patients, visits, vitals, medical_aid_details | **Status**: ✅ ACTIVE
```sql
-- Creates audit trail for critical tables
-- Tracks all INSERT, UPDATE, DELETE operations
-- Stores in audit_logs table
-- Function: create_audit_entry()
```

### ⚠️ INACTIVE/BROKEN TRIGGERS

#### 1. `notify_queue_webhook`
**Table**: automation_queue | **Created**: 2024-11-20 | **Status**: ❌ BROKEN
```sql
-- Supposed to notify external webhook on queue inserts
-- Currently failing - no webhook listener configured
-- Uses pg_notify but no listener exists
-- Function: notify_queue_webhook()
```

## A3. DATABASE FUNCTIONS

### 🟢 CORE BUSINESS FUNCTIONS

#### `process_appointment_automation()`
**Created**: 2025-01-10 | **Status**: ✅ ACTIVE | **Used By**: appointment_automation_trigger
```sql
-- Creates automation for new appointments
-- Determines appropriate template and timing
-- Queues automation based on appointment time
-- Returns: automation_execution record
```

#### `queue_automation_intelligently()`
**Created**: 2025-01-08 | **Status**: ✅ ACTIVE | **Used By**: Multiple
```sql
-- Intelligent automation scheduling
-- Parameters: trigger_type, entity_id, practice_id, scheduled_date
-- Calculates optimal send time based on business rules
-- Creates automation_execution and queue entries
```

#### `check_and_queue_todays_birthdays()`
**Created**: 2025-01-07 | **Status**: ✅ ACTIVE | **Used By**: Cron job
```sql
-- Daily birthday check and automation
-- Runs at midnight to queue birthday messages
-- Sends at 9 AM on patient's birthday
-- Tracks sent messages to prevent duplicates
```

#### `add_invoice_to_batch()`
**Created**: 2024-07-01 | **Status**: ✅ ACTIVE | **Used By**: Batch processing
```sql
-- Adds medical aid invoice to batch
-- Parameters: invoice_id, batch_id
-- Validates invoice eligibility
-- Updates batch totals
```

### 🔴 UNUSED/DEPRECATED FUNCTIONS

#### `automation_queue_cron_processor()` ❌
**Created**: 2024-11-25 | **Status**: DEPRECATED
```sql
-- Original cron processor for automation queue
-- Replaced by edge function approach
-- Still in database but not called
-- Candidate for removal
```

#### `check_daily_birthdays()` ❌
**Created**: 2024-12-01 | **Status**: DEPRECATED
```sql
-- Old birthday checking function
-- Replaced by check_and_queue_todays_birthdays_v2
-- No longer referenced
-- Safe to remove
```

#### `send_sms()` ❌
**Created**: 2024-06-01 | **Status**: DEPRECATED
```sql
-- Direct SMS sending from database
-- Replaced by centralized-sms-gateway edge function
-- Security risk if used
-- Should be removed
```

## A4. VIEWS & MATERIALIZED VIEWS

### 📊 REPORTING VIEWS

#### `practice_performance_dashboard`
**Created**: 2024-09-01 | **Status**: ✅ ACTIVE
```sql
-- Real-time practice KPIs
-- Includes: appointment counts, revenue, patient stats
-- Refreshed: Real-time
-- Used by: Dashboard components
```

#### `batch_management_view`
**Created**: 2024-07-15 | **Status**: ✅ ACTIVE
```sql
-- Medical aid batch overview
-- Shows batch status, totals, submission history
-- Refreshed: Real-time
-- Used by: Billing workflow
```

---

# PART B: EDGE FUNCTIONS & APIS

## B5. EDGE FUNCTION DEFINITIONS

### 📱 COMMUNICATION GATEWAYS

#### `centralized-sms-gateway`
**Created**: 2024-11-01 | **Deployed**: ✅ ACTIVE | **Provider**: SMSPortal
```typescript
// Location: supabase/functions/centralized-sms-gateway/index.ts
// Purpose: Central SMS sending with full tracking and subscription management

interface SMSRequest {
  practiceId: string;
  recipientPhone: string;
  messageContent: string;
  messageType?: string;
  patientId?: string;
  appointmentId?: string;
  visitId?: string;
  invoiceId?: string;
}

// Key features:
// - Template variable replacement
// - Subscription limit checking
// - Full audit logging
// - Delivery tracking
// - Cost calculation
// - Retry logic
```

#### `centralized-email-gateway`
**Created**: 2024-11-15 | **Deployed**: ✅ ACTIVE | **Provider**: Resend
```typescript
// Location: supabase/functions/centralized-email-gateway/index.ts
// Purpose: Central email sending with templates and tracking

interface EmailRequest {
  practiceId: string;
  recipientEmail: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  emailType?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
  }>;
  patientId?: string;
  appointmentId?: string;
  invoiceId?: string;
}

// Key features:
// - HTML/Text email support
// - Template processing
// - Attachment handling
// - Open/click tracking ready
// - Subscription management
// - Full audit trail
```

### 🤖 AUTOMATION ENGINE

#### `process-automation-queue`
**Created**: 2025-01-10 | **Deployed**: ✅ ACTIVE
```typescript
// Location: supabase/functions/process-automation-queue/index.ts
// Purpose: Processes automation queue items

// Processing flow:
// 1. Fetch pending automations from queue
// 2. Load execution details and templates
// 3. Process each channel (SMS/Email)
// 4. Call respective gateways
// 5. Update execution status
// 6. Handle failures and retries

// Triggered by:
// - Frontend polling (currently broken due to auth)
// - Manual invocation
// - Should be cron-based
```

### 🌐 PUBLIC APIS

#### `online-booking-v2`
**Created**: 2024-12-01 | **Deployed**: ✅ ACTIVE
```typescript
// Location: supabase/functions/online-booking-v2/index.ts
// Purpose: Public appointment booking API

// Endpoints:
// GET /practices - List practices
// GET /practices/:id/availability - Check available slots
// POST /bookings - Create appointment
// GET /bookings/:reference - Check booking status
```

### ❌ DEPRECATED EDGE FUNCTIONS

#### `DEPRECATED_send-batch-email`
**Status**: DEPRECATED | **Replacement**: centralized-email-gateway
```
// Old batch email sending
// No longer maintained
// Remove after migration complete
```

---

# PART C: FRONTEND COMPONENTS

## C8. FORMS & MODALS

### 👤 PATIENT MANAGEMENT FORMS

#### `ModernPatientRegistrationForm.tsx`
**Location**: src/components/forms/ | **Created**: 2024-10-01 | **Status**: ✅ PRIMARY
```typescript
// Primary patient registration form
// Features:
// - Comprehensive patient data collection
// - ID number validation
// - Medical aid integration
// - Next of kin management
// - Auto-generates patient reference number

// Key dependencies:
// - Tables: patients, medical_aid_details, next_of_kin
// - Triggers: assign_system_patient_reference_number_trigger
// - Validation: Namibian ID format
```

#### `EditPatientForm.tsx`
**Location**: src/components/forms/ | **Created**: 2024-10-15 | **Status**: ✅ ACTIVE
```typescript
// Patient profile editing
// Features:
// - All patient fields editable
// - Change tracking
// - Audit trail via triggers
// - Medical aid updates
```

### 📅 APPOINTMENT FORMS

#### `PremiumAppointmentScheduler.tsx`
**Location**: src/components/appointments/ | **Created**: 2024-12-01 | **Status**: ✅ PRIMARY
```typescript
// Main appointment scheduling interface
// Features:
// - Calendar view with available slots
// - Doctor schedule integration
// - Real-time availability checking
// - Conflict prevention
// - Automation trigger on save

// Critical fields:
// - visit_date (NOT scheduled_date)
// - visit_time (NOT scheduled_time)
// - is_scheduled = true
// - status = 'scheduled'
```

### 🏥 VISIT FORMS

#### `PremiumAddVisitForm.tsx`
**Location**: src/components/forms/ | **Created**: 2024-11-01 | **Status**: ✅ PRIMARY
```typescript
// Comprehensive visit recording
// Features:
// - Chief complaint capture
// - Vital signs integration
// - Diagnosis recording
// - Treatment plan
// - Auto-generates visit number
// - Links to appointment if exists
```

### 💰 BILLING FORMS

#### `InvoiceGenerationModal.tsx`
**Location**: src/components/modals/ | **Created**: 2024-07-01 | **Status**: ✅ ACTIVE
```typescript
// Invoice creation interface
// Features:
// - Service selection from tariffs
// - Auto-calculation of totals
// - Medical aid integration
// - Batch assignment for claims
// - PDF generation ready
```

### 📱 COMMUNICATION FORMS

#### `SendMessageModal.tsx`
**Location**: src/components/modals/ | **Created**: 2024-11-01 | **Status**: ✅ ACTIVE
```typescript
// Manual SMS sending
// Features:
// - Template selection
// - Variable replacement preview
// - Character counting
// - Cost calculation
// - Delivery tracking

// Always uses:
// - Edge function: centralized-sms-gateway
// - Logs to: practice_sms_logs
```

---

# PART D: SYSTEM WORKFLOWS

## D11. AUTHENTICATION & ACCESS

### Complete Login & Session Management Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Step-by-Step Process:
1. **User navigates to `/login`**
   - **Component**: `LoginPage.tsx`
   - **Form**: Built-in login form
   - **Validation**: Email format, password requirements

2. **Submit Credentials**
   ```typescript
   // Frontend: src/pages/Login.tsx
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password
   })
   ```

3. **Backend Authentication**
   - **Table**: `auth.users` (Supabase Auth)
   - **Function**: Supabase built-in auth
   - **Response**: JWT token + user metadata

4. **Session Creation**
   - **Store**: `useAuthStore` (Zustand)
   - **Tables Updated**: 
     - `admin_sessions` INSERT
     - `audit_logs` INSERT (login event)
   - **Triggers**: None (handled by application)

5. **Role Loading**
   - **Query**: Join `users` → `admin_roles`
   - **Permissions**: Loaded into auth store
   - **Practice Context**: Set default practice

6. **Dashboard Redirect**
   - **Route Protection**: `ProtectedRoute.tsx`
   - **Component**: `Dashboard.tsx`
   - **Initial Data**: Practice stats loaded

#### Dependencies:
- **Tables**: auth.users, users, admin_roles, admin_sessions
- **Functions**: None (Supabase auth)
- **Components**: LoginPage, ProtectedRoute, Dashboard
- **Store**: useAuthStore

---

## D12. PATIENT MANAGEMENT

### Complete Patient Registration Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Step-by-Step Process:
1. **Navigate to Patients Page**
   - **Route**: `/patients`
   - **Component**: `PatientsPage.tsx`
   - **Initial Load**: Patient list with search

2. **Click "Add Patient"**
   - **Form**: `ModernPatientRegistrationForm.tsx`
   - **Modal**: Opens in modal overlay
   - **Tabs**: Basic Info, Contact, Medical Aid, Next of Kin

3. **Fill Patient Information**
   ```typescript
   // Critical fields
   {
     first_name: string (required)
     last_name: string (required)
     government_id_number: string (validated)
     date_of_birth: date (required)
     gender: 'male' | 'female' | 'other'
     phone: string
     email: string
     // system_patient_reference_number: AUTO-GENERATED
   }
   ```

4. **Database Insert**
   - **Table**: `patients`
   - **Trigger**: `assign_system_patient_reference_number_trigger`
   - **Function**: `get_next_system_patient_reference_number()`
   - **Result**: Patient gets ID like "P000123"

5. **Medical Aid (Optional)**
   - **Form**: `MedicalAidForm.tsx` (within registration)
   - **Table**: `medical_aid_details`
   - **Fields**: Provider, plan, member number

6. **Next of Kin**
   - **Form**: `NextOfKinForm.tsx` (within registration)
   - **Table**: `next_of_kin`
   - **Fields**: Name, relationship, phone

7. **Post-Registration**
   - **Trigger**: `audit_patients_trigger` (audit log)
   - **Real-time**: Updates patient list via subscription
   - **Navigation**: Can immediately schedule appointment

#### Dependencies:
- **Tables**: patients, medical_aid_details, next_of_kin, medical_aid_providers
- **Triggers**: assign_system_patient_reference_number_trigger, audit_patients_trigger
- **Functions**: get_next_system_patient_reference_number()
- **Forms**: ModernPatientRegistrationForm, MedicalAidForm, NextOfKinForm
- **Components**: PatientsPage, PatientList, PatientSearch

---

## D13. APPOINTMENTS & SCHEDULING

### Complete Appointment Scheduling Workflow ⭐
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Step-by-Step Process:
1. **Open Scheduler**
   - **Component**: `PremiumAppointmentScheduler.tsx`
   - **Location**: Dashboard or Appointments page
   - **View**: Calendar with available slots

2. **Select Date/Time**
   - **Component**: `Calendar` (react-big-calendar)
   - **Validation**: Check doctor availability
   - **Query**: `doctor_branch_schedules` for slots

3. **Choose Patient**
   - **Component**: `PatientSearchSelect.tsx`
   - **Search**: By name, ID, or phone
   - **Or**: Create new patient inline

4. **Fill Appointment Details**
   ```typescript
   // CRITICAL: Correct field mapping
   {
     patient_id: uuid (required)
     doctor_id: uuid (required)
     visit_date: date (required) // ⚠️ NOT scheduled_date
     visit_time: time (required) // ⚠️ NOT scheduled_time
     appointment_type: string
     notes: string
     is_scheduled: true // ⚠️ MUST be true
     status: 'scheduled'
   }
   ```

5. **Save to Database**
   - **Table**: `visits` (PRIMARY table)
   - **Triggers**:
     - `generate_visit_number` → "V-20250111-0001"
     - `appointment_automation_trigger` → Creates automation
   - **Function**: `process_appointment_automation()`

6. **Automation Creation**
   - **Table**: `automation_executions` (created)
   - **Function**: `queue_automation_intelligently()`
   - **Table**: `automation_queue` (queued)
   - **Timing**: Based on appointment time

7. **Real-time Updates**
   - **Subscription**: Calendar updates for all users
   - **Component**: `AppointmentCard.tsx` shows new appointment
   - **Notification**: Toast confirmation

#### Dependencies:
- **Tables**: visits, patients, users, doctor_branch_schedules
- **Triggers**: generate_visit_number, appointment_automation_trigger
- **Functions**: process_appointment_automation(), queue_automation_intelligently()
- **Forms**: PremiumAppointmentScheduler, PatientSearchSelect
- **Components**: Calendar, AppointmentCard, AppointmentDetailsModal

---

## D14. CLINICAL ENCOUNTERS

### Complete Visit Management Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Step-by-Step Process:
1. **Patient Arrives**
   - **Component**: `DoctorQueueManagement.tsx`
   - **Action**: Receptionist marks "Ready"
   - **Update**: `visits.status = 'ready'`

2. **Doctor Starts Visit**
   - **Component**: `PatientDetailQueue.tsx`
   - **Button**: "Start Visit"
   - **Updates**:
     - `visits.status = 'in_progress'`
     - `visits.started_at = NOW()`

3. **Record Vitals**
   - **Form**: `VitalsForm.tsx`
   - **Table**: `vitals`
   - **Fields**: BP, HR, Temp, Weight, etc.
   - **Link**: `vitals.visit_id` = current visit

4. **Clinical Documentation**
   - **Form**: `PremiumAddVisitForm.tsx` or `EditVisitForm.tsx`
   - **Fields**:
     ```typescript
     {
       chief_complaint: string
       visit_notes: string
       diagnosis: string
       treatment_plan: string
       follow_up_instructions: string
     }
     ```

5. **Order Tests (Optional)**
   - **Lab Orders**:
     - **Form**: `AddLabRequestForm.tsx`
     - **Table**: `lab_requests`
     - **Link**: To current visit
   - **Imaging**:
     - **Form**: `ImagingRequestForm.tsx`
     - **Table**: `imaging_requests`

6. **Complete Visit**
   - **Button**: "Complete Visit"
   - **Updates**:
     - `visits.status = 'completed'`
     - `visits.completed_at = NOW()`
     - `visits.completed_by = current_user`

7. **Generate Invoice**
   - **Modal**: `InvoiceGenerationModal.tsx`
   - **Table**: `invoices_enhanced`
   - **Trigger**: `assign_system_transaction_number_trigger`
   - **Services**: From `practice_tariffs`

#### Dependencies:
- **Tables**: visits, vitals, lab_requests, imaging_requests, invoices_enhanced
- **Triggers**: audit_visits_trigger, assign_system_transaction_number_trigger
- **Forms**: VitalsForm, PremiumAddVisitForm, AddLabRequestForm, InvoiceGenerationModal
- **Components**: DoctorQueueManagement, PatientDetailQueue

---

## D15. COMMUNICATIONS & AUTOMATIONS

### Complete SMS/Email Automation Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Automation Setup:
1. **Configure Automation Settings**
   - **Page**: Settings → System → Automation
   - **Component**: `AutomationSettings.tsx`
   - **Table**: `practice_automation_settings`
   - **Templates**: `automation_templates`

2. **Trigger Types**:
   ```typescript
   {
     'patient.created': 'Welcome message',
     'patient.birthday': 'Birthday wishes',
     'appointment.created': 'Appointment confirmation',
     'appointment.reminder': 'Appointment reminder',
     'appointment.no_show': 'Missed appointment',
     'visit.completed': 'Visit summary',
     'invoice.sent': 'Invoice notification',
     'payment.reminder': 'Payment due'
   }
   ```

#### Appointment Reminder Flow (Example):
1. **Trigger**: Appointment created
   - **Trigger**: `appointment_automation_trigger`
   - **Function**: `process_appointment_automation()`

2. **Execution Created**
   - **Table**: `automation_executions`
   - **Status**: 'pending'
   - **Template**: Selected based on trigger

3. **Queue Entry**
   - **Function**: `queue_automation_intelligently()`
   - **Table**: `automation_queue`
   - **Scheduled**: Day before at 2 PM

4. **Processing** (Currently broken)
   - **Edge Function**: `process-automation-queue`
   - **Issue**: Auth error from frontend
   - **Workaround**: Manual processing

5. **SMS Sending**
   - **Edge Function**: `centralized-sms-gateway`
   - **Provider**: SMSPortal API
   - **Template Processing**:
     ```
     Hi {{patientName}}, reminder: appointment 
     tomorrow at {{appointmentTime}} with 
     Dr {{doctorName}} at {{practiceName}}
     ```

6. **Logging**
   - **Table**: `practice_sms_logs`
   - **Status**: sent/failed
   - **Cost**: Calculated and logged

#### Manual SMS/Email:
1. **Open Modal**
   - **SMS**: `SendMessageModal.tsx`
   - **Email**: `SendEmailModal.tsx`

2. **Select Template**
   - **Table**: `sms_templates` or `email_templates`
   - **Preview**: With variable replacement

3. **Send**
   - **Always via**: Edge functions
   - **Never**: Direct from frontend

#### Dependencies:
- **Tables**: automation_*, practice_sms_logs, practice_email_logs
- **Edge Functions**: centralized-sms-gateway, centralized-email-gateway, process-automation-queue
- **Functions**: queue_automation_intelligently(), process_appointment_automation()
- **Forms**: SendMessageModal, SendEmailModal, AutomationSettings

---

## D16. BILLING & INVOICING

### Complete Invoice & Medical Aid Claims Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Invoice Generation:
1. **Trigger Invoice Creation**
   - **From**: Visit completion or manual
   - **Modal**: `InvoiceGenerationModal.tsx`
   - **Component**: `InvoiceForm.tsx`

2. **Select Services**
   - **Source**: `practice_tariffs`
   - **Component**: `ServiceSelector.tsx`
   - **Categories**: Consultation, procedures, etc.

3. **Create Invoice**
   ```typescript
   {
     patient_id: uuid
     visit_id: uuid
     services: [
       {
         tariff_code: string
         description: string
         quantity: number
         unit_price: decimal
         total: decimal
       }
     ]
     medical_aid_id: uuid (optional)
   }
   ```

4. **Database Operations**
   - **Table**: `invoices_enhanced`
   - **Trigger**: `assign_system_transaction_number_trigger`
   - **Table**: `invoice_services` (line items)
   - **Result**: Invoice number like "INV-2025-0001"

#### Medical Aid Claims:
1. **Auto-Assignment**
   - **Trigger**: `auto_assign_invoice_to_batch_trigger`
   - **Function**: `get_or_create_active_batch_id()`
   - **Table**: `batch_headers`

2. **Batch Processing**
   - **Component**: `BatchManagement.tsx`
   - **View**: `batch_management_view`
   - **Actions**:
     - Add/remove invoices
     - Generate submission file
     - Send to medical aid

3. **Submission**
   - **Table**: `batch_submissions`
   - **Edge Function**: Could use email gateway
   - **Format**: EDI or custom format

#### Payment Processing:
1. **Record Payment**
   - **Modal**: `PaymentModal.tsx`
   - **Table**: `payments`
   - **Update**: `invoices_enhanced.amount_paid`

2. **Payment Methods**
   - Cash
   - Card (POS integration ready)
   - EFT/Bank transfer
   - Medical aid payment

#### Dependencies:
- **Tables**: invoices_enhanced, invoice_services, batch_*, practice_tariffs, payments
- **Triggers**: assign_system_transaction_number_trigger, auto_assign_invoice_to_batch_trigger
- **Functions**: get_or_create_active_batch_id(), add_invoice_to_batch()
- **Forms**: InvoiceGenerationModal, ServiceSelector, PaymentModal
- **Views**: batch_management_view

---

## D17. LABORATORY & IMAGING

### Complete Lab & Imaging Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Lab Request Flow:
1. **Create Lab Request**
   - **Form**: `AddLabRequestForm.tsx`
   - **During**: Visit or standalone
   - **Fields**:
     ```typescript
     {
       patient_id: uuid
       visit_id: uuid (optional)
       tests_requested: string[]
       clinical_notes: string
       urgent: boolean
     }
     ```

2. **Generate Request**
   - **Table**: `lab_requests`
   - **Status**: 'pending'
   - **Print**: Lab request form

3. **Lab Processing**
   - External lab receives sample
   - Results returned (manual entry)

4. **Record Results**
   - **Form**: `LabResultsForm.tsx`
   - **Table**: `lab_results`
   - **Link**: To original request
   - **Notification**: Doctor notified

#### Imaging Workflow:
1. **Create Imaging Request**
   - **Form**: `ImagingRequestForm.tsx`
   - **Table**: `imaging_requests`
   - **Types**: X-ray, ultrasound, CT, MRI

2. **Image Upload**
   - **Component**: `ImageUploadModal.tsx`
   - **Storage**: Supabase storage
   - **Table**: `patient_media`

#### Dependencies:
- **Tables**: lab_requests, lab_results, imaging_requests, patient_media
- **Forms**: AddLabRequestForm, LabResultsForm, ImagingRequestForm
- **Storage**: Supabase buckets for images

---

## D18. QUEUE MANAGEMENT

### Doctor Queue System Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Daily Queue Flow:
1. **Morning Setup**
   - **Component**: `DoctorQueueManagement.tsx`
   - **Query**: Today's appointments
   - **Filter**: By doctor and branch

2. **Patient Check-in**
   - **Action**: Receptionist marks "Ready"
   - **Update**: `visits.status = 'ready'`
   - **Real-time**: Updates doctor's screen

3. **Queue Display**
   - **Stats**: Completed, In Queue, In Progress
   - **List**: Ordered by time and status
   - **Actions**: Start, Skip, Complete

4. **Doctor Workflow**
   - **Component**: `PatientDetailQueue.tsx`
   - **Shows**: "My Queue Today"
   - **Action**: "Start Next Visit" button
   - **Auto-navigation**: To next patient

5. **Real-time Sync**
   - **Subscription**: On visits table
   - **Updates**: All connected users
   - **Notifications**: Status changes

#### Dependencies:
- **Tables**: visits, patients, users
- **Components**: DoctorQueueManagement, PatientDetailQueue, QueueStatusCard
- **Real-time**: Supabase subscriptions

---

## D19. HR & PAYROLL

### Complete Payroll Processing Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Monthly Payroll Flow:
1. **Timesheet Capture**
   - **Component**: `TimesheetManagement.tsx`
   - **Table**: `timesheets`, `timesheet_entries`
   - **Trigger**: `calculate_timesheet_hours`
   - **Period**: Monthly cycles

2. **Leave Management**
   - **Component**: `LeaveManagement.tsx`
   - **Tables**: `leave_requests`, `leave_balances`
   - **Approval**: Manager workflow
   - **Deduction**: From salary if unpaid

3. **Salary Calculation**
   - **Base**: From `employee_salaries`
   - **Components**: `employee_salary_components`
   - **Additions**: Overtime, bonuses
   - **Deductions**: Tax, pension, medical aid

4. **Generate Payslips**
   - **Modal**: `PayslipGenerationModal.tsx`
   - **Function**: `generate_payslips()`
   - **Tables**: `payslips`, `payslip_items`
   - **PDF**: Generation ready

5. **Distribution**
   - **Email**: Via centralized-email-gateway
   - **Portal**: Employee self-service
   - **Banking**: Export file for payments

#### Dependencies:
- **Tables**: employee_salaries, payslips, timesheets, leave_*
- **Triggers**: calculate_timesheet_hours
- **Functions**: generate_payslips(), calculate_leave_accrual()
- **Forms**: TimesheetEntryModal, LeaveRequestForm, PayslipGenerationModal

---

## D20. BATCH PROCESSING

### Medical Aid Batch Claims Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Batch Creation:
1. **Automatic Assignment**
   - **Trigger**: When invoice has medical_aid_id
   - **Function**: `get_or_create_active_batch_id()`
   - **Result**: Invoice added to open batch

2. **Batch Management**
   - **Page**: `/billing/batches`
   - **Component**: `BatchManagement.tsx`
   - **View**: `batch_management_view`
   - **Actions**:
     - View batch contents
     - Add/remove invoices
     - Close batch

3. **Submission Process**
   ```typescript
   // Batch submission flow
   1. Close batch (no more additions)
   2. Generate submission file
   3. Create batch_trailer (summary)
   4. Record in batch_submissions
   5. Send to medical aid
   ```

4. **File Generation**
   - **Format**: EDI or CSV
   - **Contains**: Patient info, services, amounts
   - **Validation**: All required fields

5. **Tracking**
   - **Table**: `batch_submissions`
   - **Status**: submitted, accepted, rejected
   - **Responses**: From medical aid

#### Dependencies:
- **Tables**: batch_headers, batch_details, batch_submissions, batch_trailer
- **Functions**: get_or_create_active_batch_id(), add_invoice_to_batch()
- **Views**: batch_management_view, batch_submission_summary
- **Components**: BatchManagement, BatchDetailsModal

---

## D21. SETTINGS & CONFIGURATION

### Complete Settings Management Workflow
**Last Modified**: 2025-01-11 19:00:00 UTC

#### Settings Structure:
1. **Settings Page Tabs**
   - **Route**: `/settings`
   - **Component**: `SettingsPage.tsx`
   - **Tabs**: Account, Users, Practice, Documents, Social, System

#### Key Setting Workflows:

##### Practice Configuration:
1. **Basic Info**
   - **Component**: `PracticeSettings.tsx`
   - **Table**: `practices`
   - **Fields**: Name, type, registration, contact

2. **Branches**
   - **Component**: `BranchManagement.tsx`
   - **Table**: `branches`
   - **Features**: Multi-location support

3. **Tariffs**
   - **Component**: `TariffManagement.tsx`
   - **Table**: `practice_tariffs`
   - **Import**: Bulk tariff upload

##### User Management:
1. **Add Users**
   - **Modal**: `AddUserModal.tsx`
   - **Tables**: `users`, `practice_staff`
   - **Roles**: Admin, Doctor, Nurse, Receptionist

2. **Departments**
   - **Component**: `DepartmentManagement.tsx`
   - **Table**: `departments`
   - **Link**: Users to departments

##### Communication Settings:
1. **SMS/Email Subscriptions**
   - **Component**: `SubscriptionManagement.tsx`
   - **Tables**: `practice_sms_subscriptions`, `practice_email_subscriptions`
   - **Plans**: Starter, Professional, Enterprise

2. **Automation Configuration**
   - **Component**: `AutomationSettings.tsx`
   - **Table**: `practice_automation_settings`
   - **Triggers**: Enable/disable by type

3. **Templates**
   - **Component**: `MessageTemplates.tsx`
   - **Tables**: `sms_templates`, `email_templates`
   - **Variables**: {{patientName}}, {{appointmentTime}}, etc.

##### Integration Settings:
1. **Gmail OAuth**
   - **Component**: `GmailOAuthSettings.tsx`
   - **Table**: `practice_oauth_credentials`
   - **Edge Function**: `gmail-oauth-callback`

2. **Social Media**
   - **Component**: `SocialMediaSettings.tsx`
   - **Table**: `practice_social_accounts`
   - **Features**: Review management

#### Dependencies:
- **Tables**: practices, branches, practice_settings, practice_features, users, departments
- **Components**: All setting components listed above
- **Forms**: Various setting forms for each section

---

# PART E: SYSTEM HEALTH

## E22. ACTIVE VS UNUSED COMPONENTS

### ❌ UNUSED/DEPRECATED COMPONENTS

#### Database Functions to Remove:
1. **automation_queue_cron_processor()** - Replaced by edge function
2. **check_daily_birthdays()** - Replaced by v2
3. **send_sms()** - Security risk, use edge function
4. **send_email()** - Security risk, use edge function
5. **process_queue_item()** - Old queue processor

#### Deprecated Edge Functions:
1. **DEPRECATED_send-batch-email/** - Use centralized gateway
2. **DEPRECATED_send-individual-email/** - Use centralized gateway
3. **test-* functions** - Development only

#### Unused Triggers:
1. **notify_queue_webhook** - No listener exists
2. **auto_process_queue** - Replaced by edge function

#### Old Form Components:
1. **BasicPatientForm.tsx** - Replaced by ModernPatientRegistrationForm
2. **SimpleAppointmentForm.tsx** - Replaced by PremiumAppointmentScheduler
3. **OldVisitForm.tsx** - Replaced by PremiumAddVisitForm

---

## E23. PERFORMANCE CONSIDERATIONS

### Critical Performance Points:

1. **Patient Search**
   - **Index**: On government_id_number, phone
   - **Optimization**: Full-text search on names

2. **Appointment Queries**
   - **Index**: On visit_date, doctor_id, status
   - **Cache**: Today's appointments in memory

3. **SMS/Email Processing**
   - **Batch**: Process multiple messages together
   - **Async**: Don't block UI during send

4. **Real-time Subscriptions**
   - **Filter**: By practice_id to reduce data
   - **Throttle**: Updates to prevent flooding

---

## E24. SECURITY & COMPLIANCE

### Critical Security Updates (2025-01-12):

#### 🚨 FIXED: Cross-Practice Data Access Vulnerability
- **Issue**: Hardcoded fallback practice IDs allowed users to see data from other practices
- **Resolution**: 
  - Removed ALL hardcoded practice ID fallbacks
  - Added strict practice validation in all patient data access
  - Updated RLS policies to enforce practice isolation
  - Created `practiceValidation.ts` utility for consistent validation

### Security Measures:

1. **Row Level Security (RLS)**
   - **patients** table: Strict practice-based policies (updated 2025-01-12)
     - `Users can view patients from their practice only`
     - `Users can insert patients to their practice only`
     - `Users can update patients from their practice only`
     - `Users can delete patients from their practice only`
   - **visits** table: Practice-based access control
   - All sensitive tables filtered by practice_id
   - NO overly permissive policies allowed

2. **Practice Validation**
   - **NEVER** use hardcoded practice IDs as fallbacks
   - **NEVER** use localStorage for practice ID storage
   - **ALWAYS** validate practice context from authenticated user
   - RPC functions validate user belongs to requested practice
   - Frontend validates resource access before display

3. **Audit Trails**
   - Critical tables have audit triggers
   - All changes logged with user/timestamp
   - Practice access attempts logged

4. **Data Encryption**
   - Passwords: Bcrypt hashed
   - Sensitive data: Encrypted at rest
   - JWT tokens for authentication

5. **API Security**
   - Edge functions require valid JWT
   - Service role key never exposed to frontend
   - Practice ID validation in all API calls
   - RPC functions validate practice access

6. **HIPAA Considerations**
   - Patient data access logged
   - Encryption in transit (HTTPS)
   - Regular backups
   - Access controls enforced at database level
   - Practice isolation ensures data segregation

### Critical Security Functions:
```typescript
// Always use these validation functions:
import { getValidatedPracticeContext, validateResourceAccess, getSafePracticeId } from '@/utils/practiceValidation';

// NEVER do this:
const practiceId = user?.practice_id || 'some-hardcoded-id'; // ❌ SECURITY BREACH

// ALWAYS do this:
const practiceId = getSafePracticeId(user); // ✅ SECURE
```

---

## 📝 CHANGE LOG

### Version 4.1 (2025-01-12)
- **CRITICAL SECURITY FIX**: Fixed cross-practice data access vulnerability
- Removed all hardcoded practice ID fallbacks
- Updated RLS policies to enforce strict practice isolation
- Added practice validation utility functions
- Updated RPC functions with practice access validation
- Enhanced security documentation

### Version 4.0 (2025-01-11)
- Added complete database schema with all tables
- Documented all triggers and functions
- Listed all edge functions with purposes
- Mapped all forms to workflows
- Added comprehensive workflow details
- Highlighted unused/deprecated components
- Added performance and security sections

### Version 3.0 (2025-01-11)
- Initial comprehensive blueprint
- Basic workflow documentation

---

## 🚀 QUICK DEBUGGING REFERENCE

### Common Issues:

1. **"SMS not sending"**
   - Check: `practice_sms_subscriptions` for credits
   - Check: `practice_sms_logs` for errors
   - Verify: Edge function deployed
   - Test: Direct edge function call

2. **"Automation not triggering"**
   - Check: `practice_automation_settings` enabled
   - Check: `automation_queue` entries
   - Issue: Frontend auth error (known bug)
   - Workaround: Manual processing

3. **"Appointment not showing"**
   - Check: `is_scheduled = true`
   - Check: `visit_date` not `scheduled_date`
   - Check: Doctor assigned
   - Check: Branch context

4. **"Invoice batch not working"**
   - Check: Medical aid assigned
   - Check: Batch not closed
   - Check: `batch_headers` status
   - Run: `add_invoice_to_batch()` manually

---

## 🎨 UI DESIGN PATTERNS & STYLING GUIDELINES

### Component Styling Standards (Updated 2025-01-25)

#### Section Backgrounds
**Standard**: Use consistent gray gradient backgrounds for all form sections
```css
/* Primary section background */
bg-gradient-to-br from-gray-50 to-gray-100/30

/* Section borders */
border border-gray-200/50

/* Section padding */
p-6 rounded-xl
```

#### Form Section Headers
**Standard**: Gray text with colored icons
```tsx
// Example header structure
<h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
  <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-blue-500" />
  Section Title
</h4>
```

#### Clean Professional Styling
- **Avoid**: Colorful gradient backgrounds (blue-50, purple-50, green-50, etc.)
- **Use**: Gray tones with accent colors only in icons and buttons
- **Reference**: General tab in AddVisitTabs.tsx and EditVisitTabs.tsx

#### Radio/Toggle Options
```css
/* Selected state */
border-gray-300 bg-gray-50

/* Unselected state */
border-gray-200 bg-white hover:border-gray-300

/* Icons retain their semantic colors */
text-red-600, text-yellow-600, text-green-600 (for status indicators)
```

#### Consistency Rules
1. All form sections use gray-based backgrounds
2. Section headers use gray-700 text with colored icons
3. Interactive elements use subtle gray hovers
4. Semantic colors only in icons and status indicators
5. Professional, healthcare-appropriate appearance

---

**END OF BLUEPRINT v4.0**

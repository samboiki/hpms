# 🏥 ONEHEALTH SYSTEM BLUEPRINT - COMPLETE TECHNICAL REFERENCE
**Version**: 4.1  
**Last Updated**: 2025-01-25  
**Based on**: Commit b8d98e7 (Last Known Good State) + Recent Updates

---

## 📋 RECENT UPDATES

### Print Buttons on Handoff Cards (commit: a886471) - 2025-01-25
- **Issue**: Users needed quick access to print documents from dashboard handoff cards
- **Solution**:
  - Created `HandoffCardPrintButtons` component with prescription, leave form, and invoice buttons
  - Integrated into FloatingVisitTracker handoff card section
  - Documents are generated on-demand or opened if already exists
  - Added database indexes to optimize query performance
- **Features**:
  - Smart button states (loading spinner during generation)
  - Green dot indicator for existing documents
  - Error handling with user-friendly toast messages
  - Only shows buttons for documents with available data

### Enhanced Print Buttons UI - 2025-01-25
- **Dashboard Handoff Cards (`PremiumAppointmentScheduler.tsx`)**:
  - Print buttons moved to new row below grey divider
  - Added text labels: "Prescription", "Leave Form", "Invoice"
  - Solar Bold Duotone icons: medical-kit, document-text, wallet
  - Buttons have colored backgrounds and animate with pulse effect only when data available
  - "Ready for checkout" badge on same row as print buttons (no animation)
  - Purple background row for better visual separation
  - Complete button uses #00a7ad color
  
- **Floating Visit Tracker - Professional Redesign**:
  - **Card Layout**:
    - Card number badge (40x40) on left with proper padding
    - Time on first row (bold, standalone)
    - Patient name on second row
    - Visit details on third row
    - Status/actions integrated within card content area
    - Professional spacing throughout (no cramping)
  - **Print Buttons**:
    - ONLY appear on handoff cards (removed from ALL other sections)
    - Completely removed from in-progress, scheduled, completed, cancelled cards
    - Handoff cards have special purple background section
  - **Handoff Cards Special Section**:
    - Purple tinted background (purple-50/20)
    - "Ready for checkout" badge on its own row
    - Print buttons (icons only) and Complete button on action row
    - Complete button uses #00a7ad color
    
- **`HandoffCardPrintButtons` Component**:
  - Added `showLabels` prop for conditional text display
  - Smart data checking: buttons grey out when no data available
  - Disabled buttons don't animate (no pulsing)
  - Enhanced button styling with hover effects
  - Uses @iconify/react for Solar icon integration

### Leave Form & PDF Generation Updates (commit: fd0b3a7) - 2025-01-25
- **Leave Form UI (`LeaveFormTab.tsx`)**:
  - Removed Special Instructions/Restrictions field
  - Removed Additional Notes field
  - Added CRUD table similar to medications table
  - Users can now add, edit, and delete multiple leave forms per visit
  - Table shows: Form #, Period, Days, Diagnosis, Status, Actions
  - Collapsible form for adding/editing leave forms

- **PDF Generation Improvements**:
  - **Banking Details**: Now matches invoice format exactly - plain text, no backgrounds
  - **Signature Section**: Copied from prescription format with "Prescribing Physician" label
  - **Automatic Generation**: PDFs generate automatically on visit save (no manual generation needed)
  - **Dashboard Buttons**: Only show colored/enabled when PDFs are ready (grey/disabled otherwise)
  - **Polling Mechanism**: Checks for generated documents every 5 seconds
  - **Single Click**: Click once to view PDF (removed two-step generate then view process)

### IntegrationsSlider Component Fixed - 2025-01-28
- **Issue**: Second row of integration icons was being cut off at bottom
- **Solution**:
  - Increased container height from 200px to 280px to accommodate both rows
  - Changed from absolute positioning to flexbox layout with proper gap
  - Split integrations into two arrays for equal distribution across rows
  - Made all icon boxes consistent 100px x 100px with larger icons (8x8)
  - Added smooth fade gradients at edges instead of hard cutoff
  - Gradients now match the background colors (purple-50 on left, blue-50 on right)
  - Increased spacing between icons from gap-3 to gap-4
- **Features**:
  - Two-row infinite scrolling animation
  - Top row scrolls forward, bottom row scrolls in reverse
  - Hover effects with scale and elevation changes
  - Professional fade transitions at edges
  - Equal distribution of 39 integrations across both rows

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

### Version 4.2 (2026-10-06)
- Payroll: Labour Act hours (45 h week; 9 or 8 h day; overtime 1.5x, max 3 h a day and 10 h a week; Sunday 2x; public holidays; night work) and NamRA PAYE and Social Security (ceiling N$11,000) in src/utils/hr
- Billing: invoice locks (paid, claim sent, in an open batch) block reopening a visit and rewriting its lines; marking paid records the payment method
- Finance: 12 reports (cash-up, aging, fund debtors, revenue by tariff, payer mix, doctor productivity, attendance, payroll vs revenue, PAYE/SSC, expenses, stock); /finance?tab=batch-management opens Batches
- Encounters: newest-first list with server-side status and branch filters and "Load older visits" (it stopped at 1,000 rows)
- Demo data: scripts/seed-demo/demoSeed.ts, demo practices only, every id starts with 5eed (removeDemoSeed() deletes it)
- Invented numbers and mock fallbacks removed from dashboards, services, forms and invoice PDFs
- centralized-sms-gateway: numbers saved without the leading 0 now go to +264, not +81 (needs a function deploy)
- Visits: administrators get "Delete Booking" in the visit actions until check-in (needs the DELETE policy in proposals/2026-10-06-data-fixes.sql, section 8); a refused delete now says so instead of hiding the visit

### Version 4.3 (2026-10-07)
- Owner's printouts and Billing tab restored (15 Oct, agent restore, owner: "please do not touch that format", then approved "Yes they do"; no SQL). His answers the same day: the Billing tab is exactly his design and the account extras move to a new Account tab; the invoice gets the practice number, HPCNA number and an ICD-10 column in his style; the prescription prints without the allergy line and allergies show on screen in the visit's Vitals tab; emailed sick notes use his leave form; his statement and the ledger statement both stay. In detail, the patient file's Billing tab is his own invoice table only, exactly as in git bd02f25 (src/components/patients/PatientBillingTab.tsx: CleanInvoiceTable with his dates "Oct 07, 2026" and amounts "N$ 1440.90"; no Delete, owner 13 Oct), and everything added since (claims to follow up, the account with balance, payments, statement, plans, packages, referrals, authorisations, injury cases and price rate, and quotes) is on a new Account tab next to Billing (PatientAccountTab.tsx; ?tab=account through patientAccountLink in invoiceLinks.ts: account alerts, credit-control notes, Debtors' "Open the patient file" and small balances, a receipt's patient, Finance report rows, and the injury-case and handed-over special lists open it; links about invoices still open Billing). Every invoice PDF of the app (Billing tab, visit screen, Finance, emails, visit documents) is his MEDICAL INVOICE again, with the practice logo top left (src/components/billing/ownerInvoicePrint.ts through invoiceDocumentService.makeInvoicePdf; the receipt too); content changes: TAX INVOICE, the VAT number and the VAT inside VAT-able stock lines for a VAT-registered practice, amounts added in cents, the invoice's own due date, no "null" for missing details, typed text escaped, RECEIPT DATE and the recorded payment method on receipts, the totals moved to their own page when his page breaks cut them off (14 lines, or more than 12 on a later page), and, at his request, NAMAF rule 008 in his style on invoices only: "Practice No: … • HPCNA No: …" on one line under the contact details and an ICD-10 column after Code when the lines have codes (withRuleEightDetails). The prescription and leave form are his templates (no allergy line: "Please remove allergy, keep it on in vitals"; the visit screen's red allergy strip already sits above every tab, Vitals included), and an issued sick note in the Sick notes tab prints and emails as his leave form (documentGenerationService.openVisitDocument, visitDocumentBase64; LetterActions onPrint and emailPdf); the timesheet has his footer date again; his statement opens from his table again with his footer wording (kept: the practice's own bank account, "Total Invoiced") and the ledger statement stays on the Account tab. The Settings rule for day-first dates excuses only his timesheet footer line (hrMoneyAndDates.test.ts). Tests pin each format (ownerInvoicePrint, PatientBillingTab, documentGenerationService.printFormats, TimesheetPDFFormat, PrintStatementModal.format, invoiceDocumentService.ownerPrint, LetterActions.print, CleanInvoiceTable).
- Install and update (15 Oct, agent app-update; no SQL): the owner's phone screenshot that looked like an old copy was the current build with the whole page scrolled up by one browser toolbar (about 57 CSS px): the app bar with the practice name and the menu button sat above the screen and a blank strip showed at the bottom (the Dashboard heading is the current 20 px, the side gutters 16 px and there is no in-page menu button; a reload keeps the scroll position, so "refresh" changed nothing). Cause: index.html gave html and body min-height 100vh (the screen with the toolbar tucked away) while the app fills 100dvh, so wherever the toolbar stays (a link opened inside WhatsApp, an installed app) the page was a toolbar taller than the screen and could be scrolled; it is now min-height 100dvh (100vh stays as the fallback). Updates: a new release is looked for when the app comes back to the screen, when the connection returns and every 5 minutes (src/pwa/updateChecks.ts), and the "A new version of OneHealth is ready" bar (src/pwa/UpdateBar.tsx, state in appUpdate.ts; in the browser's top layer so no window covers it; shown on every screen, sign-in included) offers Update and Later. Update asks first when something is typed or a full-screen window is open (unsavedEdits.ts); a page opened afresh switches to a waiting version by itself (updateHandlers.ts); if the new version has not taken over after 8 seconds the app forgets its saved files and loads from the server (forceFreshStart). "Install app" is in the Dashboard's avatar menu and the shared profile menu, on phones and tablets only (src/pwa/installApp.ts keeps the browser's single-use install prompt for it and for the banner; InstallAppMenuItem.tsx, InstallAppDialog.tsx): one tap on Chrome, Samsung Internet and Edge for Android, Share > Add to Home Screen steps with a small picture on iPhone and iPad, the browser-menu steps before the prompt arrives or inside another app's tab, and "open it in Chrome or Safari" (an Open in Chrome link and Copy address) for other browsers; hidden once installed or over plain http. All icons are Solar Bold Duotone. The browser toolbar colour (index.html theme-color and the manifest theme_color) is now white like the app bar and the store apps' status bar. Tests: src/pwa/__tests__ (including the 100dvh rule, the manifest's install fields and the icon sizes).
- Dashboard cards the same at every width (15 Oct, agent cards, owner decision "like the phone"; no SQL): the four number cards (Patients, Communication, Encounters, Finance; src/components/dashboard/PremiumStatCard.tsx) are the plain light card the phone showed on every screen, so the purple, orange, blue and green wash of laptops, desktops and TVs is gone; the icon tile, small coloured lines and dots, divider, mini bars and bottom accent are as on the phone. Cause: two global rules for screens up to 768 px (index.css and styles/mobile-performance.css) hid the card's tint layer, swapped its shadow for a lighter one and padded the tiny dot whose class contains "p-6" (top-6) into a soft 1rem dot, so only phones and small tablets ever showed the plain card. The card no longer has a tint layer, writes out the phone's shadow and sizes that dot itself, so it does not depend on those rules (they stay for other pages, where the same phone-versus-desktop surprise can still happen). Size, layout, text, hover, click, the Finance overview button and every data-tour attribute are unchanged; the phone card is pixel-identical to before (old and new card side by side at 768 px: 0 pixels differ) and the new card is identical on both sides of the 768 px line. The app has no dark mode (the cards look the same in every theme and with the device set to dark), so there is no separate dark card. Test: src/components/dashboard/__tests__/PremiumStatCardLook.test.tsx
- Black is the main colour (14 Oct, agent theme, owner decision "the black one, not the orange one"; proposals/2026-10-14-monochrome-default-theme.sql, applied as monochrome_default_theme_2026_10_14, md5-verified): the theme a browser starts with and "reset" returns to is Monochrome (src/stores/themeStore.ts, DEFAULT_THEME_ID; Sunset stays in the list, which keeps its order), practices.theme_id now defaults to 'monochrome', and the 872 practices that sat on Sunset moved to it (874 on Monochrome, none on Sunset; staff already on Monochrome see no change). A practice's saved theme still wins at sign-in (ThemeProvider reads it and it replaces whatever the browser remembered), so a practice can pick Sunset again in Settings and keeps it. practices_protected_columns lets a theme_id change through; updated_at moved on the 872 changed rows (nothing reads it). Tests: src/stores/__tests__/themeStore.default.test.ts, src/components/providers/__tests__/ThemeProvider.signIn.test.tsx
- Billing fallbacks (wave 12, 14 Oct, owner decisions, agent billing-fallbacks; no SQL): a night in a bed with no daily rate is billed at the amount the ward's bed-day code has on the price list for that night's date (NAMAF's ward fee, e.g. 57007 day admission N$ 2,914.10; the practice's own price wins when it has one; a NAMAF list's version is picked by the night's date), and where there is none the billing sheet asks for the amount in plain words, per bed, instead of blocking or billing N$ 0 (stayBill asks/typedAmounts/sources in src/utils/inpatient/inpatientRules.ts, wardTariffLookup in src/components/inpatient/useWardTariffs.ts; BillStaySheet shows "bed rate", "NAMAF 2026", "price list" or "typed in" on every line; a bed rate of exactly N$ 0 still counts as a rate; a daily code with no amount asks the same way). Saved code bundles (src/components/quotes/bundles.ts amountsNeeded, BundleMenu): a NAMAF code with no fixed amount inside a bundle asks for its amount per unit when the bundle is used, on visits and quotes alike (a bundle line's own fee above N$ 0 counts as the amount, a fee of N$ 0 does not), and is never added at N$ 0; the bundle list shows "Asks for an amount".
- ICD-10 suggestions per tariff code (14 Oct, agent icd10; proposals/2026-10-14-tariff-icd10-suggestions.sql, applied as tariff_icd10_suggestions_2026_10_14): researched first, and no official NAMAF or fund table links tariff codes to ICD-10 codes (NAMAF Circular 4 of 2025: at least one 3-character code from the national ICD-10 Master Industry Table on every claim, "no ICD-10 code, no pay" from 1 July 2025, and a referral diagnosis, a sign or symptom code or a Z code encouraged for providers who do not diagnose), so the billing line's ICD-10 box (Change > ICD-10 code) now OFFERS suggestions for the line's tariff code, each with a one-line reason and none filled in: the practice's usual code (Admin > Tariffs), then the codes the practice itself billed most with that code in the last 24 months (learned_tariff_icd10: own practice only, counts only, no patient or invoice ids, only codes the medical aids' list accepts as a main code), then OneHealth's reviewed starter list (namaf_tariff_icd10_suggestions: 275 rows for 61 NAMAF disciplines, only where the code's own wording names the situation; 60 follow the published South African ICD-10 Coding Standards (Version 2, 2008: appointment not kept Z53.2/Z53.9, antenatal and childbirth classes Z71.8, spectacle repairs and adjustments Z46.0, vision therapy Z50.6, routine dental examination Z01.2) and say "South African coding standard", the rest are OneHealth's own reasoning, e.g. antenatal visit Z34.9, immunisation with no vaccine named Z26.9 because Z23 itself is a category heading the funds reject, hearing test Z01.1, eye examination Z01.0, pre-anaesthetic assessment Z01.8, contraceptive device Z30.1/Z30.9, nutritional counselling Z71.3); dentists' 4-digit codes stay with the owner's dental sheet; follow-up proposals/2026-10-14-tariff-icd10-suggestions-standards.sql (applied as tariff_icd10_suggestions_standards_2026_10_14); src/utils/billing/tariffIcd10Suggestions.ts, src/services/tariffIcd10SuggestionService.ts, src/hooks/useTariffIcd10Suggestions.ts
- More ICD-10 suggestions: wording rules and common diagnoses (14 Oct, agent icd10-engine; proposals/2026-10-14-icd10-rules.sql applied as icd10_rules_2026_10_14, proposals/2026-10-14-icd10-rule-functions.sql applied as icd10_rule_functions_2026_10_14_b): the owner found 275 links far too few. Two tables of reference data that only the database owner loads (staff read, nobody writes through the API; a trigger refuses an ICD-10 code the medical aids' list does not accept as a main code, a pattern that is not a valid regular expression or that matches every line, and a discipline that is not in the NAMAF list): namaf_icd10_rules (a case-insensitive pattern on the NAMAF wording, an optional exclude pattern, 1 to 6 codes most likely first, a plain reason, author, reviewed) and namaf_discipline_common_icd10 (20 to 40 diagnoses per discipline with rank, reason, the published list it comes from, reviewed). icd10_rule_suggestions(discipline, tariff code) and icd10_discipline_common(discipline) (staff only; a sub-type such as 014003 also reads its main discipline's rules and common list) feed the billing line's ICD-10 box after the practice's usual code, what it billed and the starter list: "procedure" codes (at most 5, the rule written for the exact discipline first) and codes common in the practice's kind of practice (at most 5), each with its reason, marked Suggested, never filled in; a row nobody has reviewed shows its reason only (the database passes a source on for reviewed rows alone, and those say "published list"); missing tables or functions give no suggestions and no error. icd10_suggestion_coverage(discipline) (OneHealth support only) reports per discipline the codes, those matched by a rule, the share, those with a starter link and the size of the common list (one discipline up to 2.6 s, all 144 about 30 s with the 1,479 rules loaded on 14 Oct: a screen asks for one discipline at a time). Owner decision 14 Oct, the app suggests and the practitioner confirms: the visit's Billing tab no longer fills in or saves a code by itself. The practice's usual code, the codes written in the visit's diagnosis and a dental practice's built-in codes are offered first in the line's ICD-10 box with their reason; a medical aid line without a code says "Needs ICD-10: the medical aid needs a diagnosis code" in the screen's amber (a line the patient pays all of, and a private patient's line, do not); codes a person chose, and codes confirmed at claim review, are kept; claim review still stops the sending. src/utils/billing/tariffIcd10Suggestions.ts, src/services/tariffIcd10SuggestionService.ts, src/hooks/useTariffIcd10Suggestions.ts, src/hooks/useIcd10Search.ts, src/components/visits/useVisitBilling.ts, BillingLineDetails.tsx. Tests: new cases in tariffIcd10Suggestions, tariffIcd10SuggestionService, Icd10SearchInput.suggestions and BillingLineDetails, and useVisitBilling.icd10 (8).
- Owner database and deploy decisions carried out (13 Oct, agent dbops; each migration rehearsed with simulated logins in a rolled-back transaction and md5-verified): payslips_admin_or_own (doctors no longer read colleagues' payslips), admin_only_money_corrections (refunds, receipt/allocation reversals and credit notes administrators only, no new discounts, no invoice deletes), cashier_cash_ups (fixed: the history guard now lists the generated "difference" column, else a recount failed), patient_photo_and_referral_source, meta_connections, clear_stock_avatars (12 staff records), claims_standards, finance_ledger (reworked: posts from receipts and invoice_adjustments instead of the superseded receipt tables, books for administrators only, internal posting functions closed, 3 practices backfilled, 5,938 balanced entries), public_practice_listing (practice_listing view; hpms-landing reads it; proposals/2026-10-13-close-practice-bank-fields.sql closes anon reads of practices once the websites are redeployed), scheduler (pg_cron + pg_net on, practices' automatic sends switched off, scheduler_start() schedules the 15-minute runs once the service role key is in Vault). Deployed ai-assist, invite-staff, process-automation-queue, send-appointment-reminders, sms-reply-webhook and auth-sms-hook (verify_jwt off: they check their own secret/signature), patient-portal, patient-list-automations (dry run until PATIENT_LISTS_DRY_RUN=false); 31 unreviewed or unsafe functions (execute-sql, sms-gateway-public, the old OAuth callbacks, test tools, old SMS/automation senders) replaced by a 410 "retired" stub until the owner deletes them. The dead "Process Queue" button left Encounters > Automations.
- Finance owner decisions and optometry in Stock (wave 11, 13 Oct, w11-finance; no SQL applied): refunds, receipt and payment reversals and credit notes are for administrators only (hidden for others, refused in src/services/ledger/moneyRights.ts via arService/creditNoteService; proposals/2026-10-13-admin-only-money-corrections.sql makes the RPCs check it, refuses new discounts and revokes DELETE on invoices_enhanced); invoices can no longer be deleted (CleanInvoiceTable, cancel or credit instead); no discount controls (visit line discount field and the invoice Discount action removed, older discounts still show and count); VAT: Settings > Practice > VAT (registered yes/no + VAT number, practice_settings 'vat_settings', src/utils/billing/vat.ts), VAT only on VAT-able stock items (Stock item "VAT when sold"; services exempt), no VAT until registered (stock price rule, gross profit and frame reports follow it), tax invoice with VAT number and VAT included on the PDF, VAT number on statements; statement-run emails carry the statement as a plain PDF (no password); debit order dropped from new receipts and refunds (method + reference kept); cash-up per cashier with own float (Finance > Payments > Day end: own count by cash, card, EFT against own receipts, float in/out; administrator sees every cashier and alone closes the day; src/services/ledger/cashierCashUp.ts, proposals/2026-10-13-cashier-cash-ups.sql, "not set up yet" until applied); the Optometry page merged into Stock for optometry practices (Stock > Frames, Stock > Lens orders with benefit notes, optometry reports under Stock > Reports; the eye exam stays in the visit), sidebar entry and page removed, /optometry redirects to the same part of Stock.
- Settings made real (wave 11, 13 Oct, owner decisions): Account > Security has working two-step sign-in (Supabase Auth TOTP: QR code, confirm, turn off; sign-in then asks for the app's code, src/services/mfaService.ts, src/components/auth/TotpSignInStep.tsx) and "Sign out of all other devices" (scope others); the invented session list and the always-"enabled" 2FA block are gone. System > Company details: the practice's own name, registration number, VAT/tax number (printed on invoices), phone, email, address and website on its practices row (administrators edit; src/components/settings/PracticeCompanyDetails.tsx), replacing the invented OneHealth block. Notification settings (chat) are the ones the app honours: on/off and six kinds, applied to the notification lists, the Dashboard panel and the unread counts (emergencies and urgent always show; src/utils/notifications/notificationPreferences.ts); email/SMS/push, quiet hours and thread/mention/reaction switches nothing used were removed. Timesheet standard hours are saved per practice (practice_settings 'timesheet_standard_hours') and hours above the standard day are overtime on the timesheet and in payroll (Labour Act caps and warnings still apply). Staff without a photo show initials, never stock photos. Finance loads payroll for administrators only. Social: Gmail plus the practice's own Facebook page / Instagram business account (meta-oauth scaffold in supabase/functions-proposals, not deployed; "Not set up yet" until the Meta app keys are in Supabase secrets); other platforms, "Coming Soon" and the Gmail debug button removed. Proposals: 2026-10-13-payslips-admin-or-own.sql, 2026-10-13-meta-connections.sql, 2026-10-13-clear-stock-avatars.sql.
- Settings > Practice and plain-word errors (wave 11, 13 Oct, owner decisions; no SQL): edit controls (logo, profile sections, branches, departments, overhead, inventory) show only to administrators and doctors (the database's rls_is_practice_admin), others read the same page; practice type and the new "Claim batches" field stay role admin only. Overhead tiles add up this month by default with a month picker, the financial year (1 March) or all time; administrators save the default (practice_settings overhead_default_period). A practice on type 'general' or none is asked to choose a type, and the Tariffs page and the code picker link there. "Last batch number sent from Eminance" sets practices.claim_batch_number_start (next batch = max(highest + 1, start), as assign_claim_batch_number does). One error rule: src/utils/plainErrors.ts (formErrors.errorMessage and describeDbError use it; every error toast passes through it via ToastLayer; 319 screen sites that showed error.message now show plainWords); the database's own wording goes to the console.
- Registration (13 Oct, A12/R26): patient photo taken with the camera (phone/tablet camera, desktop webcam) or uploaded, made small in the browser (512 px JPEG) and kept in the private "records" bucket (<practice>/patient-media/<patient>/photo-*.jpg, short-lived links); shown in the patient file header (tap to take, upload or remove), the Patients list, the diary day view and the visit tracker, initials or icons as before when there is none (src/components/patients/photo/*). Optional "How did you hear about us?" at registration and on the patient form; Reports > Demographics > "Heard about us" counts new patients per month by answer (src/utils/patients/referralSource.ts). Columns patients.photo_path, referral_source, referral_source_other: proposals/2026-10-13-patient-photo-and-referral-source.sql (not applied; until then no photo controls and no question)
- Claims standard (13 Oct, researched, sources in src/utils/billing/fundRules.ts): NHP and NAMMED claims count to the last day of the 4th month after the service month (their published rules; NAMMED now confirmed), NMC 120 and PSEMAS 180 calendar days (Methealth), Prosperity 4 months still unconfirmed (flag only); member-number lengths PSEMAS 9 or 13-14 and Prosperity 6 added as warnings only; claim screens say "to the end of the 4th month after the service month". Fund-master rows: proposals/2026-10-13-claims-standards.sql (not applied).
- Speed (13 Oct, no visual change): the sign-in screen no longer downloads the staff app (src/StaffApp.tsx loads after sign-in and is warmed while the form is in use; dev 249 -> 57 modules, production first download about 536 -> 176 kB gzip); paged reads (src/lib/pagedRows.ts) fetch the pages after the first together (Finance's year of invoices, receipts, balances, debtors, company accounts); one Finance load per practice and period at a time (useFinanceWorkspace); RoutePrefetcher (all patients plus 20 counts thrown away on every visit) unmounted; the patient file loads once on opening (was twice); the diary and visit tracker share one load of the day; Dashboard, Patients and the handoff print buttons ask independent questions together; sidebar links download their page on hover or focus (src/pageLoaders.ts); patient search filters from a deferred, memoised list; dev server: no file polling, no forced dependency re-bundle, warm-up of the main files
- Two-way SMS: sms-reply-webhook edge function (SMSPortal reply webhook, shared-secret URL), reply intents in English, Afrikaans and Oshiwambo (confirm, cancel, reschedule, book, stop, start, help, ratings), SMS Replies inbox tab in Communications; SQL in proposals/2026-10-07-two-way-sms.sql
- Staff invitations: invite-staff edge function (practice administrators for their own practice, super admins, the platform) creates the login and staff record and emails a one-time link through centralized-email-gateway; "resend" sends a new link; /set-password lets the person choose their own password. Needs a deploy and APP_URL/set-password in Supabase Auth redirect URLs
- Automation lists: "Recall by treatment" smart list (last billed tariff code, e.g. 8159 scale and polish 6+ months ago, nothing booked; patient_list_facts returns last_billed_by_code)
- Automation lists: hand-picked and smart lists (birthdays, recall due, lapsed, outstanding balance, missed appointment, follow-up due), "Add to list" from Patients and the patient file, Lists tab in Communications, scheduled sender proposal; SQL in proposals/2026-10-07-patient-lists.sql
- centralized-sms-gateway: callers must be the platform's own functions or signed-in staff of the practice being charged (the public anon key was enough before); opted-out patients get essential messages only; phone numbers use the app's normalizePhoneNumber
- AI assist: Gemini calls moved to the ai-assist edge function (key GEMINI_API_KEY stays on the server); turn the buttons on with VITE_AI_ASSIST_ENABLED=true
- Installable app (PWA): manifest, OneHealth icons, offline start, "new version ready" prompt, install banner
- Responsive pass: visit tracker docked in the sidebar / app bar, app bar with menu on every page below 1024 px, PageTabs, stacked page headers, phone bottom-sheet modals, no clipped tables or tiles at 375/768/1366 px
- Deploys: .gitignore ignored src/lib (every Vercel build since 2025-08-04 failed); now /lib/ only, and .env is no longer tracked
- Patient app (/me, same sign-in screen, "Patient" tab): cell number + 6-digit SMS code (Supabase Auth phone OTP; the auth-sms-hook edge function sends codes through the SMS gateway, only to numbers on a patient file, with caps); each file is linked after the person confirms its ID number or date of birth (children under 18 by a parent); appointments (request a booking or another time, cancel up to 2 hours before), invoices with bank details and payment reference, lab results only after "Release to patient" on the lab results screen, medicines, details; reception answers requests in Communications > App requests; patient-portal edge function; SQL in proposals/2026-10-07-patient-portal.sql (also a staff-only guard on every table: logins without a staff profile read only their own linked records)
- Medical aid claims checked against 12,527 lines the funds accepted from the previous software: MAG1 is PSEMAS (180-day deadline, not the 120-day fallback); field 24 sends at most 8 characters (claimInvoiceReference, also for remittance matching); teeth written without separators; primary + secondary ICD-10 codes; spec field lengths; a missing patient ID number warns instead of blocking; a spouse or child is claimed under the main member's surname and initials; NAMAF rule checks per line before submission (tariffRules.ts: 8155 with 8159, 8107 above 7 films, 8145 per visit, 8304 per arch, 8101 with 8104, 8346 after its restoration on the same tooth, posterior restorations once per tooth, laboratory items); each code's usual ICD-10 (Z01.2 for 8101/8109/8110, Z29.8 fluoride, K03.6 scaling, ...) is offered for the doctor to confirm. SQL in proposals/2026-10-07-fund-codes.sql, -claim-batch-numbers.sql (one batch number sequence per practice number, starting above the old software's last run), -tariff-tooth-flags.sql and -dependant-code.sql
- Edge function caller checks (supabase/functions/_shared/callerAccess.ts, unit tested): functions the app calls (ai-search-patients, optimized-data-fetcher, centralized-email-gateway, get-medical-aid, generate-ai-insights, extract-text, generate-follow-up-templates, test-gmail-connection, exchange-oauth-code) need signed-in, active staff of the practice in the request, or their own practice when none is named (the public anon key and patient app logins are refused); queue and scheduled functions (process-automation-queue, follow-up-automation-engine, send-appointment-reminders, send-gmail-smtp) and the old or debug tools (execute-sql, create-test-user, check-env, test-sms-debug, test-gmail-auth, email-gateway-v2, DEPRECATED_send-individual-email) accept only the service role key; the Gmail OAuth callbacks redirect only to the app's own origins. Each changed function needs a deploy, and n8n or cron callers must send the service role key
- Diary: "Block time" (a practitioner on leave, in a meeting or at lunch every weekday, or the practice or a branch closed; greyed on the day and week grids), Namibian public holidays on the grids (the payroll list, Genocide Remembrance Day from 2025 per Proclamation 19 of 2024), and a check before saving that lists the practitioner's overlapping bookings, the patient's other booking that day, blocked time, holidays and closed days with "Book anyway" (booked times can be picked; nothing is refused or saved silently); "Next free slot" and the patient's recent no-shows in the booking form; reminder and SMS-confirmation status on each booking (practice_sms_logs, practice_sms_replies). Rules in src/utils/diary (unit tested); SQL in proposals/2026-10-07-diary.sql (until applied, blocked time shows "not switched on yet")
- Remittance import (Finance > Remittances): reads Methealth statements (NMC, PSEMAS), Medscheme advices and monthly statements (NHP, NAMMED), the NMC claim response CSV, SwitchOn status CSVs and NHP batch acknowledgements in the browser (pdfjs-dist; src/utils/remittance, any discipline), posts nothing unless the document adds up, matches lines to the claims sent (reference, member number, date, code and amount; quantity splits, add-on lines, family members, later payments of rejected lines), posts one receipt per payment through ar_post_receipt with shortfalls and write-offs by reason code (202 is never billed to the patient) and queues unpaid lines (fix and resubmit with field 32, bill the patient, write off, wait); needs proposals/2026-10-07-remittances.sql after the receipts proposal
- Fund tariff schedules: a medical aid patient is billed the fund's own price where its schedule has the code (fund_tariffs, per practice type, with effective dates and plan-option overrides; contracts as a % of a schedule in fund_tariff_contracts), otherwise the practice tariff; one rule, fundPriceFor (src/utils/billing/fundPricing.ts), prices the visit screens, the service selectors, quotes and quote conversion, and 8346 follows its restoration's fund price. PSEMAS (MAG1) dental schedule seeded from the claim history (31 codes). 8109 billed per clinical staff member (1-3, practice setting infection_control_staff). Dental-only rules (8109, 8346, restorations, tooth prompts) apply to dental practice types only; the code lists live in tariffRules.ts. Admin > Tariffs rebuilt: fund prices by date, NAMAF/fund schedule import (xlsx/csv, any discipline, column mapping preview, start date from the file), contracts, 8109 setting. The quotes estimate uses the fund schedule instead of medical_aid_service_prices. SQL in proposals/2026-10-07-fund-tariffs.sql
- Patient safety and the patient file: one alert strip under the patient's name and on the visit screen (allergies with reaction, severity and who verified them, an explicit "no known allergies", a short clinical alert note, active problems; details one tap away); adding a medicine that matches a recorded allergy by name or drug group (Augmentin for penicillin, Bactrim for sulfa, Ubistesin for a local anaesthetic) asks for a reason, which is kept; problem list with ICD-10 codes, a visit's diagnosis added in one tap; registration fills the date of birth from an 11-digit Namibian ID number (no sex is read from it: nothing public says a digit encodes it), checks for an existing file (same ID, same name and birth date, same cell and birth date: "Use this patient" or "Save as a new patient"), and explains an ID already registered at another practice; medical aid captures the main member's surname, initials and ID for dependants ("Surname, J N", read right by the claim builder), the dependant code once the column exists, a per-fund membership number hint (NMC 9, NHP/NAMMED 11 digits), and "Make main member" for a family; the visit's "Letters" tab prints and emails sick notes, referral letters and other letters on the letterhead (text PDFs, through centralized-email-gateway), listed on the file with the messages sent. Rules in src/utils/clinical and src/utils/patients (unit tested); SQL in proposals/2026-10-07-patient-safety.sql (until applied, the strip says "not switched on yet")
- Invoicing: reception (any active administrator, doctor, nurse or receptionist) raises invoices, recorded apart from the treating practitioner (the visit's, with each line's own date and practitioner for claims, and a discount for private patients); per-fund co-payments split each line between the medical aid and the patient (Admin > Tariffs > Contracts and settings); a warning when the same code, date and tooth is already on another invoice; one text invoice PDF in the NAMAF rule-008 layout (practice and HPCNA numbers, member and patient, per-line date, ICD-10, code and tooth, both portions, benchmark statement; src/components/billing/invoiceDocument.ts, invoicePdf.ts; seven unused PDF components retired); batch review adds the checks learned from the funds' answers (already paid, dependant code, membership number, final rejections, refused combinations and quantities); links between invoice, visit, patient billing, claim batch, fund answers and quote. Sequential numbers per practice (INV-000001, gapless), the co-payment split kept by the database, created_by and the invoice change history need proposals/2026-10-07-invoicing.sql
- Diary part 2: SMS reminders that run (day before at the practice's time, optionally N hours before, never 20:00-07:00, never twice for the same booking and slot, not to patients who replied STOP; sent through centralized-sms-gateway with the visit id so the diary icon and 1/2/3 replies attach to the booking; send-appointment-reminders now reads visits, service role only, run every 15 minutes once a scheduler runs it (pg_cron is not installed yet: until OneHealth support starts one, only "Remind patients" sends)) and "Remind patients" with a preview and count; booking lengths stored (visits.duration_minutes, defaults per visit type in Diary settings) and used by the grids, clash check, next free slot and time list; practitioner working hours with breaks (warn only); week and month views that load their whole range; repeat bookings with one warning list for the series; diary report (bookings, no-show and cancellation rates, utilisation, each number opens its bookings); booking links to the patient file and invoice; SQL in proposals/2026-10-07-diary-2.sql
- Debtors and daily controls (proposals/2026-10-07-debtors-and-controls.sql, applied after receipts-and-allocations): age analysis current to 180+ days by account (a family under whoever pays), patient, fund, administrator or option, with unallocated credit, filters, CSV and print; Payments > Day end (cashier report per user and method, cash count, deposit slips marked deposited with the bank reference, day sheet with month to date) and Payments > Daybook (numbered, append-only, reprints marked); month-end close on Reports (receipts allocated or explained, a cash-up for every day, control totals that reconcile to the ledger and to the previous close; a closed month refuses back-dated entries in the database; only admins close and reopen, with a reason; the month-end pack is kept with the close); account flags (cash only, no claims, dispute, handed over, credit limit, no statements, statement language, account alert; "no SMS" is patients.sms_opt_out) for any screen through useAccountFlags and AccountFlagBadges; family accounts (one account holder pays for the family, linked both ways, shown on the patient's Billing tab); credit control work list with contact notes, promises to pay (broken ones first) and the debt collector CSV; statement runs (saved criteria, preview, print, email and SMS through communicationService, English or Afrikaans, no password from a date of birth); interest runs (off by default, admins only, simple interest, never more than the capital, reversible). The Debtors tab (src/components/finance/debtors/DebtorsTab.tsx) still has to be added to the Finance tab bar
- Practice isolation (proposals/2026-10-07-practice-isolation.sql, applied as migration practice_isolation_2026_10_07): the 28 tables still open to any signed-in login (invoices and lines, lab requests and results, documents, inventory, messages, subscriptions, users, practices, ...) and medications are limited to staff of the row's practice; super admins read everything again (admin "recent appointments", appointments and patient views) and write only practices, users, reference tables and service subscriptions; staff can no longer change their own role, practice or super-admin flag, and admins manage only their own practice's staff; medications_with_details and sms_analytics run with the caller's rights; messages gained practice_id
- Dental tooth chart (dental practices only, isDentalPractice): patient file > Teeth shows an FDI chart (adult, child or mixed teeth) built from every billed line with a tooth number plus what is charted (fillings with their surfaces, crowns, root canals, implants, bridges, missing teeth; existing or defective) and planned work. One tap on a tooth gives its state, its history (linked to the invoices and visits) and its planned work. The treatment plan groups work into visits priced exactly as their quotes and invoices will be (fund prices, 8109 once per visit, 8346 with each restoration), says in plain words what a fund would refuse (the tariffRules.ts checks, a code that does not fit the tooth or its surfaces, work on an extracted tooth, a second posterior restoration within a year) and makes a draft quote per visit through the quotes module; work leaves the plan by itself once it is invoiced. "Teeth" on the visit screen, "Teeth chart" on quotes and invoices. Recording and planning need proposals/2026-10-07-dental-chart.sql (applied 2026-10-08 as dental_chart_2026_10_07); until then the view shows the billed history and says charting is not set up yet. Code: src/utils/dental, src/services/dental, src/components/dental
- Moving over from Eminance (Settings > Move over from Eminance, practice administrators only): upload Eminance's patient list, age analysis (once per portion, or both together with a choice of who owes), recall list and .Dat claim files; columns are recognised from Eminance's headings (manual matching otherwise); a check step shows new files, files already in OneHealth (same ID number, or name and date of birth), rows left out and why, unknown medical aids to map to funds, sex or relationship codes, accounts without a main member and accounts in credit; the import (chunked, legacy_import_continue) creates patients with the Eminance account number (patients.legacy_account_number, searchable on Patients and shown under the name in the patient file, which opens the read-only claim history), medical aid details with dependant code, family accounts (dc_link_account_holder), the alert note as an account alert, one opening-balance invoice per age band per account holder (OB-<account>-<band>, dated back from the "balances as at" day, moved to the first open day of a closed month, credit set off oldest first; accounts left in credit are listed, not imported), recalls on "Eminance recalls: <month>" patient lists and claim history lines (legacy_claim_lines); no SMS or email is sent; the whole import can be undone until anyone works with the imported records. Private invoice and payment history is not imported (Eminance exports none). SQL: proposals/2026-10-07-eminance-import.sql, applied 2026-10-08 as migration eminance_import_2026_10_07 (without it the tab says it is not set up yet). Code: src/utils/import, src/services/import, src/components/import
- Stock and dispensing (proposals/2026-10-07-dispensing-and-stock.sql, applied 2026-10-08 as dispensing_and_stock_2026_10_07): a Stock page (/stock) for every practice's medicines and consumables: items with NAPPI code, barcode, group, billing code and VAT; deliveries against a supplier invoice with batch and expiry (the supplier's payable goes into practice expenses) and returns; adjustments with a reason; stock takes with a variance report; the reorder report and printable supplier orders; valuation now and kept at each month-end close; the scheduled-medicine register. On hand is the sum of an append-only ledger: billing an item takes it off stock, cancelling or crediting the invoice puts it back. With "We dispense medicine" on (Stock > Settings, with the practice's own markup and dispensing fee), the visit's Medications tab dispenses prescribed medicines and repeats (shorthand such as "1 tds" printed in full on a label, an on-hand check, the line on the bill with its NAPPI code), the patient file lists scripts and repeats, and patient lists gain "Repeat medicine due". Until the SQL is applied the page says it is not set up and Settings > Practice > Inventory works as before. Code: src/utils/stock, src/services/stock, src/components/stock
- Claims and remittances: "Do not claim" (account flag) keeps a patient's invoices out of claim batches (sync_invoice_to_batch skips them, the unbatched list leaves them out, the batch review refuses a flagged line); sync_invoice_to_batch can no longer be called by app users; a fund payment dated in a closed month is posted on the first open day and Remittances says which month was closed (proposals/2026-10-07-claims-flags-and-closed-months.sql)
- Patient file > Billing shows the patient's medical aid claims a fund did not pay that still need someone (count, amount at stake, first resubmission deadline) and opens the rejection queue filtered to that patient; a rejection links to the patient's file and the invoice
- Fixed on the live database: marking a visit ready or cancelling it failed in the notification trigger (patients.full_name, enum casts, RLS on RETURNING; proposals/2026-10-07-visit-notifications-fix.sql); sent emails stayed "pending" (broken usage trigger dropped; proposals/2026-10-07-email-log-status-fix.sql); bookings without a length took 30 minutes instead of the type's length (visits.duration_minutes default dropped, diary-2 file)
- Security: the public key reads only the staff columns practice websites show (no bank details; proposals/2026-10-07-anon-staff-columns.sql); only practice administrators change the practice's name, numbers and bank details and only OneHealth support changes plans and limits (trigger practices_protected_columns; proposals/2026-10-07-practice-protected-columns.sql)
- Communications > Automations: the appointment reminder card shows and opens the diary's reminder settings (one reminder system); crowns, implants, bridges and amalgam fillings ask for a tooth number (NAMAF 2025 marks them T; proposals/2026-10-07-tooth-flags-2.sql)
- Stock in the sidebar (next to Finance); medicine lines billed from stock are claimed with their NAPPI code in field 26 (sync_invoice_to_batch copies invoice_services.nappi_code; proposals/2026-10-08-claim-nappi.sql)
- Communications > Automations is honest: only the welcome for new patients and the booking confirmation have a switch (practice administrators) and send, through one engine (patients / visits trigger -> automation_queue -> process-automation-queue, run by the scheduler with the service role key -> SMS / email gateways); the reminder, birthday, missed-appointment, follow-up, recall, repeat-medicine, remittance, batch and payroll cards open the place that does the job; lab, imaging, review, invoice, sick-note, prescription and bank cards say "Not available yet" (no switch, never active). The screen shows when the sender last ran and last processed, and says "Automations are switched on but not running yet: OneHealth support must start the scheduler" when it has not run for a day. Fixed: two welcomes per patient, processing inside patient and booking saves (items stuck in 'processing'), reminders queued beside the diary's, the missing trigger_automation_engine(), 25 automation functions callable without signing in, two that faked "sent". SQL: proposals/2026-10-08-automations.sql (applied 2026-10-08 as automations_2026_10_08). Code: src/utils/automations, src/services/automations, src/components/messages/automations, supabase/functions/process-automation-queue
- Optometry (optometry practices only, isOptometryPractice): patient file > Eyes (current spectacle prescription per eye with what changed since the last one, printed prescription with practice, dates, valid-until and the practitioner's HPCNA number, history with corrections and "entered in error", lab orders with their steps ordered / back from the lab / fitted / collected / remake with reason / cancelled and a printable lab slip, contact lenses with the day they run out, eye exams); the visit's "Eye exam" section (vision unaided and with own glasses, refraction compared with the last prescription and transposable, IOP with method and time, visual fields, contact-lens fit) suggests ICD-10 H52.0-H52.4 from the refraction, added to the diagnosis only when ticked; frames are stock items in the Frames group (brand, model, colour, size, barcode, billed under a code from the practice's own tariff list; status in stock / on order for a patient / sold from stock movements and open orders); the practice's own optical benefit note per fund shows on the Eyes tab and the lab order (no benefit tables); "Contact lenses running out" ready-made patient list; claim fields 45-47 (reading additions, lens prescription, tint) filled from the visit's lab order or prescription in the QEDI format and sent only in that format; a practice view with all open lab orders, frames, the report (frames sold, presbyopic patients by age, lab turnaround and remakes) and the benefit notes. SQL: proposals/2026-10-08-optometry.sql (applied 2026-10-08 as optometry_2026_10_08). Code: src/utils/optometry, src/services/optometry, src/components/optometry
- Security and claims fixes after the 2026-10-08 audit: the public key can no longer run raw SQL (the deployed execute-sql and ai-search-patients fail closed) or any owner-rights function, nor list, replace or delete files in the documents bucket; "Mark No Show" works (visits_status_check); medicines billed from stock are claimed as GMED with type M/R/D and their NAPPI code, materials as 0201 (claim specification p. 7), optometrists send E in field 39; an invoice in a sent claim batch is never rewritten or claimed twice; a claim line names ICD-10 codes beyond the 5 that fit (proposals/2026-10-08-close-public-functions.sql, -documents-bucket.sql, -visit-no-show.sql, -claim-medicines.sql, -claim-sent-batches.sql)
- Honest switches and money fixes (2026-10-08 audit, items 11, 12, 15, 16, 23 and the claimed-invoice edit): reminders, booking confirmations and the welcome ask for a reply ("Reply 1/2/3", "Reply STOP") only once OneHealth support switches the practice's practice_features 'sms_replies' on (staff cannot; until then the SMS Replies tab says replies are not collected); the diary's reminder switch, the Automations reminder card and Lists' automatic sending say "On, but not running yet: OneHealth support must start the scheduler" until a run is recorded (one rule, scheduleState); Finance "Claims sent, awaiting payment" is what funds still owe on sent claims (paid claims drop out); the debt reminder SMS and promises ask only for the patient's own portion (as the work list); Settings > Practice > Practice type (administrators) writes practice_type and practice_type_id together; the visit editor says when its invoice is already claimed in a sent batch, with links to the batch, credit note and rejections. No SQL
- Practice isolation 2 (proposals/2026-10-08-practice-isolation-2.sql, applied 2026-10-08 as practice_isolation_2_2026_10_08): medical aid details, patient media, imaging and lab files and imaging requests are reached by staff of the patient's practice only (super admins read); the audit trail by the practice's administrators (and super admins), so the patient file's history tab is empty for other roles; payroll and HR rows by the employee's practice: the employee reads their own, the practice's administrators manage them, doctors read payslips for Finance, and anyone can submit their own draft timesheet or cancel their own pending leave; OAuth apps and social accounts by the practice's administrators and doctors; the documents bucket by the practice, patient, staff member or visit in the file's path (invoices/ and leave_forms/ have none: still any staff member); 19 owner-rights functions (claim batches, SMS logs, statistics, insights, internal messages, templates, notification counts) refuse another practice's id (42501)
- Front desk (parity A1, A9, A11): title (Mr, Mrs, Ms, Miss, Dr, Prof, Rev) and initials (filled from the first names, editable) at registration and on edit, shown as "Mrs N M Shilongo" under the name in the patient file; employer asked at registration; the booking form's "New patient: name and cell" checks the practice for the same name or cell number ("Use this patient") and otherwise opens a temporary file with the website bookings' marker (TEMP- ID number, placeholder birth date and gender; src/utils/patients/temporaryPatient.ts), which the visit actions, the patient header and the Patients list flag "File not complete" with one tap to the edit form (ID number, date of birth from a Namibian ID, gender, medical aid), and which a full registration of the same caller finds by cell number ("Complete this file" fills it with what was typed instead of opening a second file); claims refuse a file that is not complete in plain words, and the placeholders are never shown or printed as an age, birthday, gender or ID; the edit form saves a blank marital status or home language as nothing (the database refused ''). Patient search (Patients, the patient file's list, the booking form) finds the ID number, the OneHealth reference (1234 or 0001234) and cell numbers in any format, and lists exact matches first, then starts-with, then contains (src/utils/patientSearch.ts). The booking form and the website-request window list the diary's practitioners (src/components/forms/bookingPractitioners.ts over diaryPractitioners: active doctors, anyone with working hours, plus the one the form was opened for, so a booking in a nurse's column shows her name), and the practitioner a form was opened with can be changed (it snapped back before). SQL: proposals/2026-10-08-patient-title-initials.sql (applied 2026-10-08 as patient_title_initials_2026_10_08; without it the forms hide title and initials)
- Support switch and Gmail secrets: Practice Management (/admin/practices) lists practices again (the admin_practice_overview view no longer existed; src/services/practiceOverviewService.ts reads practices without bank, Gmail or password columns) and gives OneHealth support (super admins only) "Patients' SMS replies are collected" per practice where staff work, through set_practice_feature (proposals/2026-10-08-practice-features-switch.sql, applied 2026-10-08 as practice_features_switch_2026_10_08: super admins only, known keys only, every change in audit_logs). Gmail connect: the browser no longer reads the Google client secret or the account's tokens; exchange-oauth-code builds the Google sign-in address with a signed state (practice, person, return address, 10 minutes; supabase/functions/_shared/oauthState.ts) and exchanges the code with the stored secret (code only, ships with the next release); Settings, the Gmail window and the callback page read named non-secret columns (src/services/gmailConnectService.ts). proposals/2026-10-08-oauth-secrets-columns.sql takes SELECT on the secret columns from signed-in users: apply only after that release
- Private records bucket (proposals/2026-10-08-records-bucket.sql, applied 2026-10-08 as records_bucket_2026_10_08): prescriptions, sick notes, visit invoices, patient documents and photos, lab and imaging results, practice documents, timesheets and leave documents are uploaded to the private bucket "records" under <practice id>/<kind>/... (that practice's staff read and write, super admins read, nobody else) and opened through a link made when someone opens the file, which works for 10 minutes; rows keep the path, never a link, and rows written before still open. Logos, avatars and signatures stay public. The 128 existing record files move at release time with node scripts/storage/move-records.ts --apply (without --apply it only prints the plan in counts). Code: src/services/recordPaths.ts, recordFiles.ts, src/components/uploads/RecordImage.tsx
- Diary columns and hours (parity B1, B6): the diary opens in time slots (each user's last choice of "Time slots" or "Cards" is remembered in the browser) with a column for every active doctor, anyone given working hours in Diary settings (an administrator can give any staff member hours: no role setting) and anyone with a booking in the days shown, plus a "No practitioner yet" column for website requests; choosing a practitioner shows that column alone. The grids run from the earliest opening or starting time to the latest closing or finishing time of the days shown (08:00-17:00 when nobody works), always far enough to show every booking; time a practitioner is not working (outside their hours, breaks, a day off; the practice's opening hours when they saved none) is hatched, named for screen readers and written under their name; booking there still works with the usual warning. Clicking a booking on a grid opens the visit actions (a website request its confirmation), like its card. Code: src/utils/diary/diaryPractitioners.ts, gridHours.ts, diaryViewChoice.ts, src/components/appointments/diary/OffHoursShade.tsx
- Daily money (parity D9, H16, A7, H9): "Invoice and take payment" on a visit's Billing tab (new and existing visits) saves the visit with its invoice exactly as the save does, then opens Receive payment for that invoice over the visit, prefilled with what the patient owes now (the patient portion; nothing for a fund-only invoice); offered only to staff who may invoice and record receipts for the practice (takePaymentProblem in src/utils/billing/invoiceRights.ts) and not for a paid invoice. The patient's Billing summary shows unallocated credit and the last payment (amount and day). Beside the patient's name the file shows a promise to pay still open (overdue in amber, with what is short) and "Credit-control notes", from one request (loadAccountAlerts), each one tap to the account on Billing. Finance > Debtors > Small balances: accounts (a family under whoever pays) owing at most a chosen amount with every part at least a chosen age, leaving out disputed, handed-over, in-credit and fund-not-yet-paid accounts; staff untick any and write them off with one reason, one write-off per balance through ar_post_adjustment (administrators and doctors; tagged external_ref small-balance:run:invoice so a retry never writes off twice), refusals listed with the database's reason and retried; runs listed afterwards with links to each patient and invoice. No SQL. Code: src/services/ledger/takePayment.ts, accountSummary.ts, smallBalances.ts, src/components/visits/VisitTakePayment.tsx, src/components/finance/debtors/SmallBalancesPanel.tsx
- Checks and clean-up after the 2026-10-08 agent waves: the public key can no longer list or read the 17 orphaned files in the "media" bucket (proposals/2026-10-08-media-bucket.sql, applied 2026-10-08 as media_bucket_2026_10_08; the bucket stays public for known links until the release); exchange-oauth-code now replaces a practice's previous Gmail address when another one is connected (the email gateway reads the practice's single Google connection and would otherwise fall back to Resend); 19 files nothing imported were deleted (GmailDirectTest, GmailDebugPanel, UniversalOAuthSettings, OAuthAppsManagement, DirectOAuthHandler and the Next-style src/pages/api pages, which read the Google client secret in the browser; DocumentUpload, DocumentUploadModal, EnhancedMediaUpload, EditVisitForm, LabRequestSimple, LabRequestUltraSimple, LabResultsSimple, LabResultsUltraSimple and the three Timesheet*PDFGenerator screens, which still put records in the public bucket)
- Dead code, second pass (2026-10-09): 181 more source files that nothing in the app opens were deleted with the 11 tests that covered only them (7 of those tests already failed), found with an import scan from src/main.tsx and checked with the TypeScript resolver, GitNexus and the route table: the visit forms and dental service picker the tooth chart replaced (PremiumAddVisitForm, PremiumEditVisitForm, EnhancedDentalServiceSelector), the Messages page (never routed) and its screens, older appointment, patient, dashboard, billing, receipt, settings, timesheet and automation screens with their hooks, stores and services (among them the DEPRECATED_* services that called Resend and SMSPortal straight from the browser), the cursor experiments, the one-off scripts in src/scripts and the manual test screens in src/test. Kept on purpose: src/utils/optometry/claimFields.ts, the tested twin of the database's optometry_claim_fields()
- Screen access (parity Q1): Settings > Users > Screen access lets practice administrators choose which roles open Finance and Stock (a box per role the practice's active staff have; administrators and OneHealth support always can; every box starts ticked, so nothing changes until an administrator unticks one, and all boxes ticked opens the screen to every role again). The sidebar hides a closed screen; its route, and every link into it from another screen, shows "Ask your practice administrator for access to Finance" with Go back. Stored per practice in practice_settings 'screen_access', written only through set_screen_access (active administrators of the practice or support, each change in audit_logs; restrictive policies stop direct writes). The database still lets every staff member read finance and stock data and record receipts. SQL: proposals/2026-10-08-screen-access.sql (applied 2026-10-09 as screen_access_2026_10_08). Code: src/utils/auth/screenAccess.ts, src/services/screenAccessService.ts, src/hooks/useScreenAccess.ts, src/components/access/ScreenAccessNotice.tsx, src/components/settings/ScreenAccessSettings.tsx
- Patient notes and follow-ups (parity C1, B22): patient file > Overview > Notes: typed notes (clinical, account, call or SMS, general) newest first with a filter, a header (left blank, the start of the note is used), who wrote it and when, an optional follow-up (day and who, or anyone) and an optional lock (clinical notes start locked). A locked note never changes: later changes are dated addenda, and the lock is never taken off (a trigger refuses it). Clinical notes for doctors, nurses and anyone with a practitioner registration number (an owner-practitioner who is the administrator: Settings > Users, Professional Registration No.; proposals/2026-10-08-patient-notes-practitioners.sql, applied 2026-10-09), account notes for staff with billing rights, the rest for all staff; the same rule decides who may follow one up. Credit-control notes are listed read-only beside the account notes, each opening Billing > Account; visit notes stay on the visits (link to Encounters). Dashboard "To Dos" (was disabled) opens the follow-ups due today and overdue, yours first, with a count; each opens the patient file at its note (?noteId=, "Back to dashboard") or is marked done there. SQL: proposals/2026-10-08-patient-notes.sql (applied 2026-10-09 as patient_notes_2026_10_08; writes only through patient_note_save, patient_note_follow_up_done and patient_note_add_addendum). Code: src/components/patients/notes/*, src/services/patientNotesService.ts, src/components/dashboard/FollowUpsDueDialog.tsx, useFollowUpsDue.ts
- Dental billing by tooth and new tooth drawings (parity D5): in dental practices (isDentalPractice) the visit's Billing tab shows the patient's tooth chart (adult, child or mixed teeth, chosen by age); staff tap one or more teeth, then the work. A code that needs a tooth gets one line per tooth through the line builder quotes and bundles use (addTariffLines: the tariff's price and quantity rule, fund prices, 8109 once per visit, each restoration with its own 8346); codes planned on those teeth come first, then the practice's most used; a code already on the visit for a tooth is marked, and a once-per-visit code the visit has is not offered again. A code picked from "Add a service" that needs a tooth opens the same chart (milk teeth, several teeth at once) and cannot be added without a tooth. The teeth are drawn anew wherever they appear (Billing tab, the visit's "Teeth", patient file > Teeth, the tooth picker): crown and roots shaped by tooth kind (upper molars three roots, lower molars two, milk teeth smaller) with the biting surface beside each; work on the tooth solid blue, defective work red and cross-hatched, work to do amber and striped, a missing tooth faded with a grey cross, root canals dashed when planned; a chosen tooth has a ring and a tick; the chart is one Tab stop with arrow keys, and each tooth's button says its state in words. "Add a service" (every discipline) is calmer: search on top (Enter takes the best match), the most used codes first, plain cards with price and "Per tooth"; 8346 is no longer offered by hand; Escape closes the picker, not the visit. Code: src/components/dental (Odontogram, ToothGlyph, toothShapes, TeethBillingPanel, ToothPickerDialog, toothBilling, useToothChart, ChartLegend), src/components/billing (VisitServiceSelector, PickerDialog, serviceOrder)
- One look on every page: section colours are defined once in src/config/sectionColors.ts (Patients purple, Encounters blue, Messages orange, Finance green, Stock slate, a steel blue-grey that cannot be mistaken for the red of expired stock) and read by the sidebar, the dashboard tiles (PremiumStatCard; the ignored gradient props on the Dashboard are gone) and each section page's header icon and selected tab, so Finance's page is green like its tile (it was blue and cyan) and Stock has its own colour (header, tabs, card icons, its tiles, the dispensing panels in the visit and patient file). Stock is full width with the standard header: src/components/layout/PageHeader.tsx (PageShell, PageHeader) and ProfileMenu.tsx (the user's photo or initials, name, role and Sign out at every width), which Finance's header uses too. Number tiles have no borders: one StatTile (src/components/ui/StatTile.tsx; FinanceUI's StatTile and MiniStat wrap it; Finance's invoice status tiles use it). Finance shows each medical aid's logo wherever it names a fund (payer mix, debtors by fund or option, the invoices list and invoice, receivables by fund): MedicalAidLogo with useMedicalAidLogo (medical_aid_providers read once per session, matched by fund code so MAG1 is PSEMAS; resolveMedicalAidLogo in src/utils/medicalAidLogos.ts; no logo shows a plain shield). The standard for new pages is the onehealth-page-standard skill
- Diary copy, paste, move and default practitioner (parity B8, Q9): visit actions offer "Book Again" (the booking form with the same patient, practitioner, type, length and reason at the practitioner's next free time from the day after the booking, or no date when the next 4 weeks are full) and "Copy" (a banner "Copied: Anna, 30 min. Choose a free time, or press Esc."; the free time clicked in the day or week grid opens the form with that date, time and column practitioner, and the copy ends once booked); both run the usual booking checks with "Book anyway" (src/utils/diary/bookingCopy.ts). Bookings drag to another day or time in the week grid with the day grid's checks and question (one hook, src/components/appointments/diary/useBookingMove.ts; the drag picture no longer reads patient names as HTML). A doctor's diary opens on their own column, everyone else's on all practitioners, and the practitioner filter shows one, several or all; each user can save a default ("Open the diary on ..." in the filter, "Remember as my default" in the booking form) kept on users.diary_practitioner_ids (proposals/2026-10-08-diary-default-practitioner.sql, applied 2026-10-09 as diary_default_practitioner_2026_10_08), which wins over the role and which the booking form starts with unless it was opened from a column or slot (src/utils/diary/diaryDefaultView.ts). The doctor's own-column default now also works when the sign-in loads after the diary, and rescheduling no longer copies the automatic "Appointment scheduled for ..." line into the reason
- Claims follow-up (parity F2, F6, G1; proposals/2026-10-08-claims-follow-up.sql, applied 2026-10-09 as claims_follow_up_2026_10_08): a printable claim report per claim file (a batch's "Claim report", History > Report, or from the file preview): practice, fund, batch number, file name, date sent, line count and total, then each line's patient, account, date, code, amount and invoice (linked), read from the claim file itself (the stored file when the batch kept it) so it always matches what was sent (claims/claimReport.ts). A sent batch's status now moves with what the funds answer, from remittances and keyed payments (Acknowledged, Partly paid, Paid, Some not paid, Not paid: claim_line_outcomes and claim_batch_refresh_status, called by remittance_post_document with every guard kept); a sent batch shows each line's answer as a word, icon and colour with counts that filter the lines, and Batches lists "Funds that have not answered" (sent longer ago than the practice's wait for that fund, nothing back, money still owed; 30 days and PSEMAS 60 unless administrators change them beside the alert, kept in practice_settings 'silent_fund_days'; claims/batchFollowUp.ts). Payments > Medical aid payment keys a fund's payment per claim line against the amount received ("Paid in full", 0.00 for a line not paid, "Patient pays the rest", money kept as credit on purpose) and posts one receipt only when it balances; it can be saved part way and carried on by anyone (fund_payment_drafts, with a version check against overwriting a colleague; receipts/fundPaymentKeying.ts, FundPaymentSheet.tsx), and funds are grouped by fund code (MAG1 PSEMAS, NMC1, NHPM, NAMM, PROS), also when a fund's credit is allocated. The dashboard's "Claims in progress" is what the funds still owe on sent claims. Fund logos (MedicalAidLogo) on batches, claim reports, remittance documents, rejections and the fund payment keying. Claim review suggests the practice's usual ICD-10 code per tariff code, and codes saved there also go onto the invoice lines, unless that could change a sent batch or move the invoice out of the batch (claims/reviewCodes.ts)
- Invoice lines (parity D1, D2, E8): on the visit's Billing tab each line shows the ICD-10 codes it will be claimed with (its own; else the codes confirmed at claim review; else the practice's usual code for the tariff code, the dental built-ins or the codes written in the diagnosis, one rule in src/utils/billing/icd10Defaults.ts that claim review uses too), at most 5 because claim field 33 carries 5 (the picker stops there and says why); a fee changed from the price list with a reason, kept with the price before, who and when (staff with billing rights; the claim sends the charged fee); and a note printed under the line on the invoice. "Generate invoice automatically" is on for new visits. A dental visit is not saved while a line whose code needs a tooth has none: the save names the codes ("Choose the tooth for 8341 before saving") and opens the Billing tab (toothSaveProblem, reusing linesWithoutTooth). Admin > Tariffs > Practice tariff has a "Usual ICD-10" column practice administrators set for any discipline (dental practices see the built-in suggestion until then). sync_invoice_to_batch copies each line's codes into its claim line, keeping every guard (proposals/2026-10-08-invoice-line-codes.sql and 2026-10-08-tariff-icd10-defaults.sql, applied 2026-10-09)
- Patient Journey (patient file > Encounters) redesigned: each visit is a calm card on a thin timeline line with a small marker in its status colour (the numbered circles, check-mark watermark, corner tag, coloured action buttons and floating blobs are gone): date and time day first ("9 Oct 2026, 08:30", Today, Visit #), why the patient came and the visit type, the practitioner, a status in words (Done, Pending, Scheduled, Cancelled, No-show, from utils/visitStage; cancelled and missed bookings no longer read Pending), diagnosis, plan and the latest blood pressure (flagged High by the shared limits; vitals arrive as a list per visit, so it never showed before), and one row of the app's shared buttons: Open visit (Billing instead for a done visit with no bill), Billing with the invoice total and Paid, Unpaid, Part paid or Overdue (the patient Billing tab's status rules; "Not billed" only once the visit is done), then Medications, Lab, Imaging and Media with a count where something exists; Letters, Create follow-up and Reopen visit under More (arrows, Escape). "Mark as done" is a button beside the status that asks first, offered for open visits and for bookings dated today or earlier. Every action opens the visit tab it opened before. The lab, imaging and media counts never showed because get_visit_counts_batch does not exist in the database: fetchPatientDetailsOptimized now uses queryOptimization.getVisitCounts, and closing a visit refreshes the counts and bills in the background. Journey Progress is unchanged. No SQL. Code: src/components/patients/journey (visitJourney.ts, unit tested; JourneyVisitCard.tsx, VisitMoreMenu.tsx), EncounterTimeline.tsx
- Claim corrections after sending (parity D24, F16, D23, F9; proposals/2026-10-09-claim-corrections.sql, applied 2026-10-09 as claim_corrections_2026_10_09, and proposals/2026-10-12-claim-correction-authorisation.sql, applied 2026-10-12): a credit note credits chosen invoice lines and amounts with one reason (each line's credit follows its own fund/patient split, one CN- per portion, a line credited in full returns its stock; "Credit an amount instead" keeps the note per portion) and prints like the invoice (Credit note PDF, naming the invoice); a medical-aid credit on a line the fund was already sent queues a reversal, shown on the credit note and on both batches, and Claims > Open batches > "Reversals to send" puts it in the fund's credit file (header transaction type C, its own batch number, sent like any batch; status ready, never active, so the automatic batching cannot add claims to it); on a sent batch "Correct and send again" fixes a line's date, family member, ICD-10 codes, practitioner or authorisation number (the invoice line follows; the invoice history records claim_corrected) and copies it into the fund's open batch with field 32 R; Claims > Unpaid lines lists sent lines a fund has neither paid nor refused after its wait (silent_fund_days: 30 days, PSEMAS 60) and sends the chosen ones again (field 32 R, claim_resent in the history); one SQL rule decides whether a line may go again (claim_line_resend_blocker), claim_rejection_act('resubmit') uses the same resend, never twice for a line in one open batch, and sent batches are never rewritten.
- Pricing gaps (parity E13, D12, D8; proposals/2026-10-09-practice-own-tariffs.sql, -bundle-extras.sql and -line-portions.sql, applied 2026-10-09): practice administrators add or change a single code at Admin > Tariffs > Practice tariff (description, price from a date, once per line or per unit, needs a tooth in dental practices) in the practice's own list (practice_own_tariffs, save_practice_tariff / remove_practice_tariff, admin-only), which wins over the shared list of the practice type from its start date (practiceTariffs.ts mergeOwnTariffs; loadPracticeTariffRows feeds the visit screens, quotes, dental chart and optometry); every practice administrator now has a "Tariffs" link in the sidebar. Code bundles carry a fixed ICD-10 code and a fee per line (recorded as a changed fee naming the bundle), stock items (priced as "From stock") and "needs an authorisation number" (asked once on a medical aid visit, put on every added line and carried into claim field 31). Co-payments are a percentage or a fixed amount per line, plus a levy once per visit taken off the fund's share (lineSplit.ts applyLevy, buildInvoiceLineRows); each code has a default "who pays" (practice_settings tariff_portions) and each line can be "patient pays all": invoice_services.paid_by = 'patient' lines are all the patient's (invoice_services_fill_split) and never reach a claim (sync_invoice_to_batch and add_invoice_to_batch skip them, every earlier guard kept). The visit's Billing tab and the printed invoice show the fund's and the patient's share, the levy, lines not claimed and authorisation numbers; administrators get a "Co-payment and levy settings" link (/admin/tariffs?tab=contracts).
- Page standard finished (2026-10-12): Settings, Encounters, Messages (/communications, now titled Messages like its sidebar link), Patients and the Dashboard use PageShell and PageHeader (full width; the Dashboard and Settings, which are not sections, wear the app purple, APP_COLOR in src/config/sectionColors.ts) instead of their own headers; every profile menu also opens Settings, as the Dashboard's did, and Messages uses the standard PageTabs (a tab can show a count, e.g. unread messages). Number boxes are the shared borderless StatTile (a compact tile can show a caption): the Dashboard's section tiles (src/components/dashboard/DashboardStatTiles.tsx; PremiumStatCard deleted), the Encounters analytics (quick stats beside each view, chart, heatmap, geographic and AI summaries; its columns stack on phones and tablets), the Messages analytics and delivery tracking, and in Settings the overheads, team, user, leave, payroll, branch and inventory figures (Settings > Practice and > Users stack on phones instead of running off the screen). Money follows Finance's screen access (seesFinanceFigures in src/utils/auth/screenAccess.ts, useSeesFinanceFigures): a role the practice keeps out of Finance sees no revenue tile on the Dashboard, no revenue in the Encounters analytics, and in Settings > Practice > Overhead an "Ask your practice administrator" note instead of the figures (src/components/access/FinanceFiguresGate.tsx, which does not even load them). The visit tracker always floats, so its unused dock slots are gone (src/components/layout/dockSlots.ts deleted), and src/index.css lost the rules nothing used (the old Patient Journey card buttons, the desktop button container, day picker, layout and modal transition classes, seven animations). No SQL. Tests: section colours, PageHeader, PageTabs, StatTile, screen access rule and hook, DashboardStatTiles, FinanceFiguresGate.
- Change history (parity B18 and the patient's history): the patient file's "Audit Log" tab is now "Change history" (src/components/patients/PatientChangeHistory.tsx; tab id still 'audit'). For practice administrators only (isStaffAdmin, as the audit_logs policy; others see one sentence) it lists, newest first and 50 at a time with "Show more", who (name and role, or "OneHealth (automatic)") changed what and when in Windhoek time: "Cell number changed", "Visit added for 9 Oct 2026", "Visit of 9 Oct 2026 moved and confirmed", "Blood pressure, pulse and temperature recorded", "Medical aid: membership number changed". Values (personal data) appear only when a change is tapped, before and after, with the fund's logo. Filters by what changed (Patient file, Visits, Medical aid, Vital signs). A visit entry opens the visit. The trigger keeps no "before" for a change, so a change is compared with the record's previous entry in this patient's own history (looked up when not on the page) and says so when there is none; saves that changed nothing staff care about are left out. The query keeps the file's filter (record_id, new/old_values patient_id) and adds the vitals of the patient's own visits (vitals rows name only their visit); every row is checked against the same rule again before it is shown. Pure rules in src/components/patients/changeHistory.ts. PremiumFolderTabs.tsx (never rendered) deleted. No SQL. Tests: changeHistory (19), PatientChangeHistory (3), the dental and optometry tab gating tests.
- Account flags where people bill, and what each payment covered (parity A8, H2; proposals/2026-10-09-account-flags-billing.sql and -allocation-lines.sql, applied 2026-10-09; proposals/2026-10-12-allocation-lines-credits.sql, applied 2026-10-12): the flags that matter at the desk (alert, handed over, dispute, cash only, credit limit, do not claim, lay-bye) show on the visit's Billing tab, on Finance's invoice view and as one small icon on day and week diary cards (named for screen readers); invoicing a "Cash only" account asks to confirm and bills the whole invoice to the patient (nothing claimed); an invoice that takes an account above its credit limit stops reception, and an administrator goes on only with a reason, kept as a credit-control note (dc_record_credit_limit_override). New "No interest" (administrator or doctor) and "Lay-bye" flags: interest runs leave both out (planInterestRun, dc_post_interest_run); a lay-bye's statement says it is paid off as agreed instead of showing an age table, and a run's minimum age does not skip it. Every allocation is split over its invoice's lines (receipt_allocation_lines: automatic, oldest line first and each line's own portion first, credit-noted lines left out; the 2,517 existing allocations mapped); Receive payment says what a payment covers and "Choose lines" pays chosen lines (ar_insert_allocations takes "lines"); the receipt, the invoice's payments and statements say what each payment covered. A line credited by a credit note (credit_note_lines) has only the rest left to pay: nothing when credited in full, and no payment, automatic or chosen, goes beyond it. A cash-only invoice that is already wholly the patient's is saved again without asking again. Tests: ledgerService.flagsAndLines (30), documentsCoversAndLayBye (5), InvoiceFlagCheck (8), allocationLines (6), diaryAccountFlags (3).
- Duplicate files and patient numbers (parity A18, A4; proposals/2026-10-09-patient-merge.sql, applied 2026-10-09 as patient_merge_2026_10_09): registration also warns about a file of the practice with the same medical aid membership (fund, number and dependant code; without a dependant code the first name or birthday must agree, so a child is not taken for the parent) or the same old file number, with "Use this patient" or "Save as a new patient". Patients > More > Possible duplicates (practice administrators): pairs sharing an ID number, a membership, or a name with a birth date or cell number, why they matched and each file's visits, invoices and claims; "Merge these files" asks which file stays (suggested: the one with more history) and merge_patients moves every row of every table that references patients to it in one transaction (tables read from the foreign keys when it runs; claim lines of sent batches, the daybook, audit trails and the import's records stay as written; a second medical aid or next of kin, and rows the kept file already has, stay with the archived file), archives the other file (no practice, merged_into_patient_id) and keeps a record (patient_merges: who, when, counts, ids) that Merges can undo while nothing new was added to the kept file. The ID number is unique per practice, so a person can be a patient at several practices (the Eminance import checks within the practice too). The OneHealth reference shows in the Patients list and on the patient file, which also shows the old file number and, when there is one, the Eminance claim history; registration and Edit patient take an old file number for patients who were not imported (an imported one stays read-only). The unused "Patient ID Format" setting was removed (Settings > Patient numbers explains both numbers). The patient-portal edge function skips archived files (takes effect at its next deploy). Code: src/utils/patients/duplicatePatients.ts, duplicatePairs.ts, patientMerge.ts, patientNumbers.ts, src/services/patientMergeService.ts, src/components/patients/duplicates/*, PatientFileNumbers.tsx, src/components/ui/MoreMenu.tsx. Tests: 66 new (rules, finder, merge labels, numbers, services, finder dialog, header numbers, both forms).
- The full ICD-10 list (parity E14; proposals/2026-10-12-icd10-master.sql, applied 2026-10-12 as icd10_master_2026_10_12 and icd10_master_search_2026_10_12): icd10_codes holds the South African ICD-10 Master Industry Table 2021 the medical aids validate claims against (41,008 codes: chapter, group, the clinical-use, main-diagnosis, asterisk, dagger and sequelae flags, age range, sex, SA status and dates; signed-in staff read, nobody writes but migrations and the service key), loaded with npx tsx scripts/db/load-icd10-mit.ts <MIT .xlsx> (checks every row before writing, upserts by code, counts only; reusable for a newer MIT; the 2021 workbook counts dates from 1904). One code search wherever a code is chosen (Icd10SearchInput over search_icd10_codes; src/hooks/useIcd10Search.ts, src/services/icd10Service.ts): the visit Billing tab's line codes, claim review (the line box and "More"), "Correct and send again", the visit diagnosis ("Add an ICD-10 code" writes "J06.9 Acute upper respiratory infection, unspecified" into it, where billing and the problem list pick it up), the problem list, code bundles and the usual ICD-10 codes on Admin > Tariffs. It takes a code with or without its dot ("a000" finds A00.0) or words of the description, puts the exact code first and the line's suggested and the practice's usual codes before the rest ("Suggested"), and marks a category heading, an asterisk code or a code that may not be the main diagnosis where it goes, and a discontinued code (shown only when typed in full); morphology (M8000/0) and X-placeholder (M45.X0) codes are left out because claim lines cannot carry them. The 45-code datalists are gone. Claim review (claimValidation.ts with the rules in src/utils/billing/icd10Master.ts; the batch's codes read in one query) refuses a category heading, an asterisk code first, a discontinued code and a code not in the list, and warns about a code that may not come first or is meant for the other sex or another age; a reversal is not held up, and the line's code entry shows the same messages as codes are typed. Tests: icd10Master (24), icd10Mit (8), icd10Service (7), claimValidation (5 new), Icd10SearchInput (9).

- Encounters analytics made honest (2026-10-12): every figure on Encounters > Analytics is counted from the practice's own rows for the chosen period (7 days, 30 days, 3 or 6 months; kept in the address with the view, /encounters?tab=analytics&view=visits&period=30d) and opens what it counts. Visits: by status (Seen, No-shows, Cancelled, plus Not marked and Still to come when there are some; the diary report's rule), per day (per week for 3 and 6 months), by practitioner and by visit type, each adding up to Visits. A status, practitioner, type or week opens exactly its visits in the encounters list (a banner names them, with Back to analytics and Show all visits); a day opens the diary at that day with "Back to Encounters analytics" (returnTo, accepted only into /encounters). Diagnoses and follow-ups (was Insights; it now has the same tab bar as Visits): the top ICD-10 codes on the lines of invoices dated in the period (cancelled invoices left out, a visit counted once per code, names from icd10_codes; empty until invoice lines carry codes) open their visits; follow-up visits due (seen visits whose follow-up date has come while the patient has nothing booked or seen since) open the patient over the page with Back to analytics. Removed: the invented procedures chart and status pie labelled "Live data", fixed busiest-time tiles, random efficiency, satisfaction and utilisation scores, made-up gender and age percentages, the Geographic view, the "AI-Generated Practice Insights" (edge function generate-ai-insights, now unused), revenue figures and the page's 12-query load. Not shown: time from check-in to done (visits keep no check-in or done times). Rules in src/utils/encounters/encounterAnalytics.ts and encounterLinks.ts, reads in src/services/encounterAnalyticsService.ts; a test fails if any figure is a constant or a random number.
- Dental ICD-10 suggestions and the tooth check (2026-10-12): the dental code sheet (src/utils/billing/dentalIcd10Map.ts) was checked against icd10_codes. 106 suggestions used US ICD-10-CM codes (M26.4, M26.6, M27.2, M27.8) or category headings (S02.4, S02.5, M86.2) that the funds reject; 103 now carry a valid main code with the same meaning (TMJ and occlusion K07.6, reducing a dislocated jaw S03.0, orthodontics and orthognathic surgery K07.4, jaw bone grafts K10.8, ridge augmentation and sinus lift K08.2, osteomyelitis of the jaw K10.2, maxillary and zygoma fractures S02.40, mandibular fractures S02.60 or S02.61, splinting S02.50, an avulsed tooth S03.2, soft-tissue injuries S01.5), and 8973, 8975 and 8977 (tumour surgery, major jaw repair) suggest nothing. Claim review's tooth check uses the visit's rule (toothRuleFor in practiceTariffs.ts: the practice's own "needs a tooth" for a code it overrides at Admin > Tariffs, else the shared list's, for the version billed on the line's date; dental practices only), as does the auto-submit proposal. Admin > Tariffs is on PageShell, PageHeader and PageTabs. Tests: dentalIcd10Map (4 new, with the list's rows for the 44 codes used), buildClaimLines (4), practiceTariffs (1), TariffManagement (3).
- Diary statuses, appointment types and slots (parity B3, B6, B15; proposals/2026-10-12-diary-statuses-and-types.sql, applied 2026-10-12 as diary_statuses_and_types_2026_10_12, and proposals/2026-10-12-diary-free-slots.sql, applied as diary_free_slots_2026_10_12): Diary settings > Statuses lets an administrator name the practice's own booking statuses ("Waiting for X-ray", "Called, no answer"), each in one of 9 colours and belonging to one fixed stage (src/utils/visitStage.ts); visit actions offer the statuses of the booking's current stage, the diary cards show the status in its colour and words, and the diary report counts bookings per status (visits.status, billing and reminders keep the fixed stages; visits.diary_status_id holds the status). Diary settings > Appointment types adds the practice's own types ("New patient, 45 min, at most 4 a day"), each booked and billed as one of the four visit types; the booking form offers them first, sets the length and warns with "Book anyway" when the practitioner already has the type's daily limit that day (also for repeat bookings and drags). Diary settings > Working hours gives each practitioner a diary slot (10, 15, 20, 30 or 60 minutes) for the day and week grids' rows (each day column at its own slot), the booking form's start times and "Next free slot"; without one the diary keeps 30-minute rows and 15-minute start times. diary_free_slots() works out the free start times per practitioner and appointment type on the server, for signed-in staff only (the website widget's next step).
- Long-failing tests made meaningful, and the last bordered number tiles (2026-10-12): the full vitest run is green (361 files, 15,861 tests; the 34 failures and 10 load errors of 7 Oct are gone). Rewritten for what the screens do now: AddVisitTabs.test (a new visit starts empty, each tab the window sends opens its panel, Cancel saves nothing, no save without complaint, diagnosis and plan, one visit per click for this patient and practice, the chosen visit type, BMI and vitals saved), Settings.test (vitest; own name, email and role read-only, password rules and the current-password check on a client that keeps no session, Eminance import for administrators only, "My HR" for other staff, ?tab= links, the practice theme) and medication-save.test.tsx (medicines saved with the visit; Update Visit checks them before writing). Known bug pinned by an it.fails test, not fixed: Create Visit (AddVisitTabs.saveNewVisit) writes the visit and its invoice before checking the medicines, so a medicine without its frequency is dropped and, when it was the only one, the window stays open and a second Create Visit saves a second visit. Deleted (copies in the scratchpad's deleted-dead-code): database-analysis-suite.test.js (tested only objects it defined itself) and EnhancedFinancialModal.test.tsx (Dashboard never opens that modal; the figures moved to Finance). vitest.config.ts leaves out hpms-landing/ and onehealth/ (separate Next.js apps; their "@/" is their own src). PatientAnalytics, BillingWorkflow, BatchReview, DocumentReview, InvoicePreviewModal, the patient file's Billing summary (PatientBillingPanel, CleanInvoiceTable) and the patient app's Home (next appointment, still a link) and Invoices ("You owe") use the shared StatTile (compact inside cards, FinanceUI MiniStat in Finance); portalFigures.test checks the patient app's figures.
- Fund master (parity E10, F11, A6; proposals/2026-10-12-fund-master.sql, applied 2026-10-12 as fund_master_2026_10_12, replacing section 3 of 2026-10-claims.sql): each fund's claim rules live in medical_aid_fund_rules (claim deadline in days or months from the service date and whether it is confirmed with the fund, claims portal, membership-number lengths and a hint for reception, dependant code needed, payment terms), seeded with the values the app used (NHP 4 months, NMC 120 days, PSEMAS 180 days confirmed; NAMMED and Prosperity 120 days NOT confirmed; NMC 9 digits, NHP and NAMMED 11; PSEMAS pays within 60 days, the rest 30). Administration > Medical aid funds (/admin/funds, src/pages/admin/FundMaster.tsx, components/funds): OneHealth support changes a fund's name, claims email, portal, logo and rules through save_fund_rule (super admins only; every change kept in medical_aid_fund_rule_changes with who, when, before and after, shown as "Changes to this fund"); practice administrators read every fund and keep their practice's own note per fund (practice_fund_notes, save_practice_fund_note). src/utils/billing/fundRules.ts is the one reader: the claims and remittance screens load the table once per session (services/fundMasterService.ts) and its built-in values stay the fallback, so claims work without the table. A line past a confirmed deadline is blocked; past an unconfirmed or assumed one it is only flagged (validation, Unpaid lines, debtors); the membership check before sending uses the fund's lengths and hint (the registration hint too, once the session has read the rules); the dependant-code warning follows the fund; "Funds that have not answered" waits for the fund's payment terms unless the practice set its own silent_fund_days (which still wins); the submit dialog shows a fund's claims portal.
- Tooth surfaces and quadrants, partners' own practice numbers and rates, and Create Visit saving once (parity D5, D31; proposals/2026-10-12-line-teeth-and-billing-practitioners.sql, applied 2026-10-12 as line_teeth_and_billing_practitioners_2026_10_12): invoice lines keep the surfaces of their one tooth (invoice_services.tooth_surfaces, the chart's order) and the quadrant of a code billed per quadrant (tooth_quadrant, 8182 and 8185 get one line per quadrant on the chart, never one per tooth); with one tooth chosen the visit's chart and tooth picker take the surfaces of a filling and refuse a code for another number of surfaces, naming the one that fits (surfaceCodeProblem, also a warning on the line and at claim review); the invoice prints "46, MO" or "Q1" in the tooth column and the claim description starts "TOOTH: 46 MO" or "QUAD: 1" (sync_invoice_to_batch and add_invoice_to_batch, edited in place). Each claim line now carries its own treating practitioner's HPCNA number (none: claim review stops the line, naming the practitioner; it was claimed under the invoice practitioner's number) and bills under that practitioner's own practice number when an administrator set one on their staff profile (practitioner_billing, set_practitioner_billing; claim field 29, the file header keeps the practice's), with their optional rate as a % of the practice's price list pricing their lines on the visit's Billing tab (never a fund's own price; a hand-changed fee stays). The invoice and claim review say who treated and who bills each line. Create Visit checks medicines, teeth, invoice lines and account flags before anything is written and saves one at a time (a double click or a retry after a failed step never writes a second visit or invoice); Update Visit checks its invoice lines first too and saves one at a time.
- Finance number cards redesigned at the owner's request (2026-10-12): the headline cards on Finance > Overview and Payments and the status cards on Invoicing keep their layout (icon, figure, label, change vs the previous period). The amount is drawn as a quiet N$, big dollars and quiet cents (screen readers get it as one figure), a negative amount is red with a minus sign, Collected and Outstanding show the part their caption names as a thin bar, a card that opens another view shows an arrow on hover, and longer amounts step down a size so millions fit four to a row at 1280px with the menu open. Only FinanceUI's StatTile changed (MiniStat, the Stock tiles and the shared StatTile are as they were); tests in src/components/finance/__tests__/FinanceStatTile.test.tsx.
- Referrals, authorisations, a visit's claim details and the people on a line (parity C10, D7, D15, F18, F19; proposals/2026-10-12-referrals-and-authorisations.sql, applied 2026-10-12 as referrals_and_authorisations_2026_10_12): the patient file's Billing tab keeps a register of referral letters (referring practitioner, practice and HPCNA numbers, referral number, letter date, last day, reason, the letter in the private records bucket) and of fund authorisations (fund, number, first and last day, codes or all codes, visits allowed), with "Write a referral letter" opening the practice's letters for referring a patient elsewhere; saving an authorisation numbers the patient's lines already billed in its window (never a sent line, within the visits allowed), and on the visit's Billing tab each medical aid line without its own number takes the register's (shown as such, editable, "Not on this line"), with a warning when an authorisation ended, has not started or is used up; a quote's pre-authorisation number becomes a register entry from the quote. The visit's Billing tab has "Referral and hospital details" (pick a referral from the register to fill the claim fields, or type them; in hospital with admission and discharge dates; the place of service code), saved with the visit, and a line's editor names its assistant, anaesthetist and own referral. sync_invoice_to_batch and add_invoice_to_batch put the referral (fields 25, 43, 44), "H" (30) and the place of service (42) on every claim line (add_invoice_to_batch now also the authorisation number), every earlier guard kept; correcting a sent line's practitioner also moves its practice number (claim_line_correct, the partner-billing rule). Rules in src/utils/billing/referrals.ts, authorisations.ts, visitClaimDetails.ts; reads and saves in src/services/claimRegistersService.ts.
- Original looks put back on Finance's header, claims, billing and the patient app (2026-10-12; the owner did not ask for the 9-12 Oct restyle): Finance's header is its own again (icon, title, period, refresh and profile picture, as at release 645b348) with the one change the owner asked for, the icon and the selected tab in Finance's green like its dashboard tile; the batch review's four bordered number boxes, the remittance review's own tinted boxes, the invoice preview's Financial Summary, the patient file's Billing summary cards and invoice-table figures, the Billing Workflow cards, the patient app's next-appointment card and "You owe" banner, and Admin > Tariffs' white header bar and own section buttons are as they were; Administration > Medical aid funds wears the same admin look. Every later feature stays (credit files, corrections, the funds' answers, fund logos, receipts and credit, ?tab= links). Finance's number cards are left to their own redesign. Tests: TariffManagement (3, now for its own header and buttons), FundMaster (+1, frame and Try again).
- Letters, templates, emailed documents and the message log (parity C15, O8, P11, P6, P4; proposals/2026-10-12-letter-templates.sql, applied 2026-10-12 as letter_templates_2026_10_12): Messages > Templates is one place for the practice's letter, SMS and email templates with the same {{merge fields}} (src/utils/templates/mergeFields.ts, the camelCase names the reminders and automations already fill: {{patientName}}, {{patientIdNumber}}, {{visitDate}}, {{practitionerName}}, {{practiceName}}, {{diagnosis}}, {{daysOff}}...), inserted with a tap and previewed with an invented patient; practice administrators keep the letter templates (letter_templates through save_letter_template and archive_letter_template), the roles message_templates' policy allows keep the SMS and email ones, and the automatic messages are listed as used by automations. A visit or the patient file makes a letter "From a template" (what the file does not hold is asked for, never printed blank; kept in patient_letters with its template_id); the practice's sick note template words every sick note printed from a visit (the note itself stays in leave_forms). Messages > Lists > a list > Letters merges a template for everyone on the list (one PDF to print, or a PDF per patient; a patient whose letter would have a gap is left out with the reason; each letter kept on the file). Email on an invoice, statement, quote and receipt sends the PDF through centralized-email-gateway to the account holder or the patient, with a message staff can change, kept with the patient's messages. Messages > Message log lists every SMS and email (search, channel, outcome, the full text one tap away); the patient file's Messages sent has Show all. New parts copy the look of the page they sit in.
- Original looks put back on the Dashboard, Settings, Patients, Messages and Encounters (2026-10-12; the owner did not ask for the 9-12 Oct restyle, so the "Page standard finished" move above is undone for these pages): each page has its own header again (icon, title, profile picture with its own menu; Messages is the "Communications Center" again with its own tab bar), the Dashboard's four cards are PremiumStatCard again (DashboardStatTiles removed), the Settings tiles (branches, staff, expenses, inventory, leave, payroll, team and user overviews), Patients > Analytics' overview cards and the Messages dashboards' figures look as they did at release 645b348, and src/index.css has every rule removed since then again. Encounters > Analytics wears its original layout and chart styles (Quick Stats on the left, the header with the views' tab bar, Daily Visit Trends, a bar and a ring chart, the Date Range card on the right) on the honest figures. Every later feature stays: screen access (a role kept out of Finance gets no Finance card), the diary changes, the Eminance import tab, App Requests, the Patient ID format removal, and every figure still opens what it counts (keyboard and screen-reader users get the same figures as buttons). A profile picture without a photo shows the person's initials, never a stock photo of a stranger. Tests: Dashboard cards (3, new: the Finance card and screen access), Encounters analytics (9, +1 for the Date Range card), section colours (Finance's dashboard card).
- Recalls, no-shows, diary billing badges, moving a family account and the practitioner on payments (parity O3, O5, B13, A3, H4; proposals/2026-10-12-patient-recalls.sql, 2026-10-12-family-account-move.sql and 2026-10-12-allocation-practitioner.sql, applied 2026-10-12 as patient_recalls_2026_10_12, family_account_move_2026_10_12 and allocation_practitioner_2026_10_12): a recall date and reason per patient is set on the patient file (Lists > Recall, and a "Recall" chip beside the list notices) or from a visit ("Set Recall" in the booking's actions). It is done once a matching booking is made (public.patient_recall_status, the one place the rule lives: a booking for a day after it was set, no earlier than 30 days before its date, not cancelled or missed; a missed booking opens it again), and "Recall due" calls a patient on their own recall date instead of the months rule. The diary report adds "No-shows by patient" (who, when, missed N of M) and "Recalled but not seen", each with "Move to a recall list". Diary day, week and card views show "Invoiced" or "Paid" in words, read once for all cards on screen. "Make main member" and Finance's Family sheet ("Make account holder") move the whole billing account in one step with a reason kept on every closed link (dc_move_account_holder). Each part of a payment carries the practitioner of the line it paid (receipt_allocation_lines.practitioner_id: the line's own, else the invoice's, the claims rule) and the receipt names it. Practice expenses ask for the date instead of failing the save. No existing page was restyled; the new parts copy their page's look.
- Finance > Reports, the claims dashboard, a claim line's story and who did what (parity R5, R7, R18, R20, R30, G10, F10, R17, Q8; proposals/2026-10-12-finance-reports.sql, applied twice, last as finance_reports_stored_practitioner_2026_10_12, 2026-10-12-claims-dashboard-and-story.sql and 2026-10-12-who-did-what.sql, applied 2026-10-12): seven new cards on the Reports grid in its existing card look (practice transactions by type and practitioner, cash flow per practitioner by payment date, invoices per fund for a day, a fund's patients with balances, ICD-10 diagnoses by practitioner with main diagnosis against all codes, the claims dashboard, who did what), each opening a report with filters, CSV and print where every row opens what it counts (patient, invoice, payment, batch, claim lines, visits). Cash per practitioner sums the practitioner stored with each part of a payment, so it agrees with the receipt. The claims dashboard compares claimed with paid per month and fund, with days to pay, refusals by reason and the funds that have not answered. A claim line's story (sent, answered, corrected, sent again, reversed, paid) opens from a sent batch's line, an invoice and a rejection. Who did what is for administrators only and says what is not recorded (reading, sign-ins, other downloads); every Finance report download and print is now recorded (report_exports). The age analysis takes a fund filter.
- Tariff code rules, linked codes, the yearly increase and the recall offer (parity E9, D13, E3, O2; proposals/2026-10-13-tariff-code-rules.sql, applied 2026-10-13 as tariff_code_rules_2026_10_13): Admin > Tariffs > Practice tariff has a "When billed" column per code, for every discipline (practice_tariff_rules, practice administrators): needs the fund's authorisation number (a medical aid line without one is flagged on the visit's Billing tab), includes lab work or charged by time (the line asks for the lab and its slip, or the time taken, in its note, which prints on the invoice), do not claim (saved as the code's existing "Who pays: patient pays all", which sync_invoice_to_batch already leaves out; no second mechanism), a recall after 1-60 months (once the visit is invoiced staff get a toast to set the patient's recall from that visit, date filled from the interval: one tap sets it through set_patient_recall, one skips), a default place of service (fills the visit's empty place of service) and linked codes with quantities (added with the code however it is added, marked "Added with ...", removable before saving; dental keeps its built-in 8346 and 8109 exactly as before). "Yearly increase" puts all codes or a range up by a percentage from a date, rounded to the cent, N$ 1, N$ 5 or N$ 10, previews each code's price now and new price (unticked where another price already applies from that date), and saves a dated version per code through save_practice_tariff in one all-or-nothing step (apply_practice_tariff_increase); earlier prices stay. Code: src/utils/billing/codeRules.ts and tariffIncrease.ts, src/services/codeRulesService.ts, src/components/tariffs/CodeRulesForm.tsx and TariffIncreaseForm.tsx, src/components/visits/useCodeRulesOnVisit.ts, linkedCodeLines.ts and recallOffer.tsx; the rules ride on the tariff rows loadPracticeTariffRows reads.
- Claims consistency and the fund statement (parity F22; proposals/2026-10-13-claims-consistency.sql, applied 2026-10-13 as claims_consistency_2026_10_13; undo in proposals/2026-10-13-claims-consistency-undo.sql): the claim rules live in one database function, claim_invoice_into_batch, used by the automatic batching (sync_invoice_to_batch, whose output is unchanged: every open batch rebuilt byte for byte the same) and by Finance > Batches > Not yet batched (add_invoice_to_batch). An invoice added by hand now gets GMED with M/R/D and the NAPPI code, 0201 for materials and each line's ICD-10 codes, and is refused in words, with nothing changed, when the patient is marked "Do not claim", nothing is for the fund to pay, it was already sent, the batch was sent or is a credit file, the batch is another fund's or the patient's fund has no claim code (it used to claim these, or add the lines twice). A corrected sent line (claim_line_correct and "Correct and send again") starts from the practitioner it was claimed under, the line's else the invoice's, no longer the visit's doctor. Finance > Batches > Fund statement prints or downloads (CSV) what each fund still owes on claims sent to it, by batch and patient, with totals and ages; all funds together equal the Overview's "Claims sent, awaiting payment" (one classification, fundDebtorItems, shared with debtorsByFund); prints and downloads are recorded for Who did what.
- Dental lab work: lab orders, the 8099 lab slip and lab tracking (parity N5, D28, R36; proposals/2026-10-13-dental-lab-work.sql, applied 2026-10-13 as dental_lab_work_2026_10_13), dental practices only (isDentalPractice; the database refuses other practices too): patient file > Teeth > Lab work lists the patient's orders (open first, earlier one tap away), each numbered per practice with the lab (a stock supplier), the work (crown, bridge, veneer, inlay, implant crown, dentures, repair, guard, appliance, other), the teeth tapped on the chart and/or the jaw, the shade, notes, the day it went and the day it is due (late in red, due today in amber); its steps are at the lab, back from the lab, fitted, sent back to be remade (why, and the lab's new date) or cancelled (why), each with who and when; "Slip for the lab" prints the order and, once typed in, the lab's invoice. Orders start from "New lab order", from "Send to the lab" on a tooth, or from a visit's Teeth button (started at that visit; practitioners, nurses and practice admins order, any staff member moves work on and types the lab's invoice). "All lab work" shows the practice's open work by lab, overdue first, each row opening its order and linking to the patient's file at that order. The lab's invoice (its number and lines: code, what was made, amount) is billed under 8099: the visit's Billing tab card bills an order back from the lab in one tap (an 8099 line at the invoice total, the fee change reason and a printed note recorded), says whether each 8099 line carries an invoice that adds up and puts the total on the line. Claim review stops a dental batch whose 8099 line has no lab invoice billed at its visit, or one that does not add up, and the claim file writes the invoice's lines straight after the 8099 line as type L records (numbered after the batch's last line, the lab's invoice number in field 24); the trailer counts every record while the report, the stored file's totals and the matching of fund answers count claim lines only. Code: src/utils/dental/labOrders.ts, labSlips.ts and labOrderRecords.ts, src/services/dental/labOrderService.ts, src/components/dental/LabWorkSection.tsx, DentalLabOrderCard.tsx, DentalLabOrderSheet.tsx, LabSlipSheet.tsx, LabWorkTracking.tsx, LabWorkBillingCard.tsx, labSlipPrint.ts and useBatchLabSlips.ts; claimFile.labDetailFields.
- Patient file extras: private practitioner notes, the pregnancy due date and due-dates list, consent forms signed on the screen, and the record export (parity C8, A20, C14, C17; proposals/2026-10-13-patient-file-extras.sql, applied 2026-10-13 as patient_file_extras_2026_10_13). The patient file's Overview has "My private notes" for practitioners and nurses (patient_private_notes: the database lets only the author read a note, while staff of its practice; no colleague, practice administrator or OneHealth support login reads one; written, changed and deleted through save_private_note and delete_private_note). It has the pregnancy due date (patients.pregnancy_due_date, not in dental or optometry practices): typed or worked out from the first day of the last period, weeks pregnant shown, cleared when the pregnancy ends, each change in the change history; Messages > Lists > Due dates lists who is due in the next 4 weeks, this or next month, the next 3 months, chosen dates, or past the due date and not cleared, each name opening the file. Consent forms: letter templates of the new kind "Consent form" (Messages > Templates, two examples, a {{procedure}} field), filled from the file and the visit with the practitioner who treats, read and signed with a finger or mouse by the patient, a parent or guardian or someone else for the patient, the signed-in staff member as witness; kept as a PDF in the records bucket and once in patient_consents (never changed, with the PDF's SHA-256) through record_patient_consent; the PDF is uploaded once into the patient's consents folder and no staff login can delete, replace or move it (two RESTRICTIVE storage policies for that folder only; proposals/2026-10-13-consent-files-locked.sql, applied as consent_files_locked_2026_10_13); listed on the Overview and on the visit's Letters tab; consent templates are not offered as letters or list letters. "Export the record" saves a summary PDF (details, medical aid, next of kin, alerts, visits with notes, diagnoses, ICD-10 and vital signs, medicines, results, letters and consent forms, notes, invoices, payments, the documents, who made it) alone or in a ZIP with every stored document, holding what the person exporting may see: other practitioners' private notes never, their own only when asked. Exports call log_record_access with the event 'record_exported', which the access log does not accept yet. Code: src/utils/clinical/pregnancy.ts and consent.ts, src/utils/export/zipStore.ts and patientRecord.ts, src/services/pregnancyService.ts, privateNotesService.ts, patientConsentsService.ts and patientRecordExportService.ts, src/components/patients/pregnancy/*, privateNotes/* and export/*, src/components/consents/*.
- Invoice discounts, the discount listing and statement extras (parity D19, R3, D15 statements, D26, I8, D22; proposals/2026-10-13-discounts-and-statements.sql, applied 2026-10-13 as discounts_and_statements_2026_10_13): Finance > an invoice > Payments and adjustments > Discount takes an amount or a percentage off what the PATIENT pays (a reason from a short list plus a note; practice administrators and practitioners only, as for write-offs), as its own entry DS-000001 (invoice_adjustments kind 'discount' with its percentage): the invoice and its claim lines never change, so a medical aid is always claimed as billed (to charge a fund less the claim is corrected with a credit note); never more than the patient still owes; a percentage is of what the patient was charged (their portion plus a shortfall moved to them), to the cent, checked again by the database; taken back with a reason by the same people. Discounts come off ar_invoice_balances, show on the invoice PDF ("Discount DS-...", "Patient pays after discount", the percentage and reason below, and that the claim is unchanged), on statements, in the daybook, in the control totals and the month end ("Discounts given") and in Finance > Reports > Discounts given (every discount of the period, also private patients' line discounts typed while billing, per practitioner and per reason; each row opens its invoice). Statements (runs, the account sheet, the emailed PDF and the patient file's statement) show the fund's authorisation numbers with each invoice (from invoice_services.authorisation_number), can leave settled items off (a paid invoice and what settled it, only when that adds up to nothing, so every balance is the same; a practice default under Finance > Debtors > Statements > Messages and settings, and a choice on each run), print the account's own "Statement message" flag (any staff member, kept on whoever pays) and the practice's message, which administrators set once and print on invoices, quotes and/or statements (practice_settings 'document_settings'). Code: src/services/ledger/discounts.ts and settledItems.ts, src/utils/billing/documentSettings.ts, src/services/discountService.ts and documentSettingsService.ts, src/components/finance/receipts/DiscountDialog.tsx, src/components/finance/debtors/DocumentSettingsSheet.tsx, src/components/finance/practiceReports/discountListing.ts, discountReportService.ts and DiscountsReport.tsx.
- "Someone else changed this first" and the record-access log (parity Q12, Q8; proposals/2026-10-13-record-versions.sql, applied 2026-10-13 as record_versions_2026_10_13, proposals/2026-10-13-access-log.sql, applied as access_log_2026_10_13, and proposals/2026-10-13-access-log-exports.sql, applied as access_log_exports_2026_10_13): every change to a patient, a visit or an invoice moves its updated_at and records who made it (updated_by, set by a BEFORE UPDATE trigger on each of the three tables; invoice line changes stamp their invoice); the patient form (from all four places that open it), the visit screen (the visit, and its invoice when the save rewrites the lines) and a booking being edited compare the version they opened before writing, and when someone else changed it a sheet says who and when and offers Reload their version, Save mine anyway (saying whose change is lost) or Back (src/services/recordVersion.ts, src/components/records/RecordChangeGuard.tsx). Opening a patient's file (the patient file, a visit, a link to a visit), every export of a patient's record, signing in and signing out are recorded in record_access_log through log_record_access (who, which patient, when, which screen, never values; one entry per person and file opened per 10 minutes; never waited for and never shown as an error; src/services/recordAccessLog.ts, src/hooks/usePatientFileAccessLog.ts, authStore) and listed for administrators in Finance > Reports > Who did what, whose notes say plainly what is still not recorded
- Claims consistency follow-up (proposals/2026-10-13-claims-consistency-followup.sql, applied 2026-10-13 as claims_consistency_followup_2026_10_13; undo in proposals/2026-10-13-claims-consistency-followup-undo.sql): the claim file (Finance > Batches and the auto-submit function) names each line's own practitioner, else the invoice's, by the one rule the database and "Correct and send again" use (claimedPractitionerOf in src/utils/billing/claimLine.ts; claimPractitioner.test.ts fails if the database's rule and the app's ever differ), no longer the visit's doctor. An invoice whose patient's medical aid no longer names a fund with a claim code leaves its never-sent batch and comes back to "Not yet batched" with the reason and a link to the patient's file, instead of showing nowhere; a sent batch is never touched. Two saves for the same batch number their claim lines one after the other (the batch is locked before its last line number is read, as claim_line_copy does), so no line number appears twice. Two saves at the moment a fund has no open batch open one batch between them, not two: before opening one, get_or_create_active_batch_id waits on the practice's batch-number lock and looks again (proposals/2026-10-13-claims-open-batch-lock.sql, applied as claims_open_batch_lock_2026_10_13; undo in proposals/2026-10-13-claims-open-batch-lock-undo.sql).
- Only signed-in staff may call get_or_create_active_batch_id (2026-10-13; proposals/2026-10-13-batch-function-grants.sql, applied as batch_function_grants_2026_10_13): EXECUTE revoked from PUBLIC and anon; signed-in users, the service role and the claim functions (run as their owner) keep it. The shared test setup (src/test/setup.ts) now stubs Iconify's Icon for every test file (a file's own mock still wins), which stops the "window is not defined" errors Iconify's timers caused after a full run.
- Finance > Reports: payments by age of debt, year to date, demographics and new patients, spend and patients by town, stock movement, gross profit and Build a report (parity R1, R21, R26, R28, R8, R9, R22; proposals/2026-10-13-report-builder.sql, applied 2026-10-13 as report_builder_2026_10_13): seven cards on the Reports grid, each after the report it belongs with, in the existing report frame (filters, CSV, print; downloads and prints recorded for Who did what). Payments by age of debt puts each part of the money received in the period in the age band (current to 180+, as in the age analysis) of the invoice it paid on the day it came in, with unallocated and refunded money as rows of their own so the total is Collections'; a band lists its allocations, each opening its payment. Year to date: billed from 1 January to the period's last day per tariff code, fund or practitioner, one column per month, built month by month from Revenue by tariff code, Payer mix and Doctor productivity so the figures are theirs. Demographics and new patients: new or all patients by home language, town, region and how they came (a referral letter on file, a booking on the website, an old file number; registration does not ask), new files per month, and the list to export. Spend and patients by town: billed per patient and per town with patients on file, patients billed and the average per patient (the total is Overview's billed). The town is the one on the file (patients.town, once proposals/2026-10-13-patient-town.sql is applied), else read from the address with the Namibian towns list (src/utils/address/namibianTowns.ts); the region is the file's, else the town's. Stock movement per group, from the stock ledger: per stock group (else category) the value at the start, in, used, adjusted and at the end (start + in - used + adjusted = end; transfers between stores net out), fast movers with days of stock left and slow movers (unused stock tying up the most money first); an item opens in Stock. Gross profit: the stock lines of uncancelled invoices against what the stock ledger took off for them, VAT taken off at the item's rate else the practice's (the stock price rule's own split), per item, practitioner and month, each line opening its invoice; lines whose stock came back after a full credit note or that were never taken off stock are counted in the notes. Build a report: invoices, payments or visits of the period with the columns, filters, search, minimum amount and grouping a practice chooses, read with the person's own rights through a fixed list of fields (practiceReports/reportBuilder.ts), never SQL; cancelled invoices are left out unless asked for, so totals are Finance's billed; saved per practice in report_queries (a name and a definition only; report_query_save and report_query_archive check the practice and Finance access, report_query_problem checks the shape; staff read, portal_staff_only)
- Payment plans, prepaid packages, promotions, material and medicine pricing, and emailing the fund statement (parity D16, D17, D18, D29, E7, F22; proposals/2026-10-13-billing-extras.sql, applied 2026-10-13 as billing_extras_2026_10_13): patient file > Billing > Payment plans: "New payment plan" (what it is for, the total, an optional deposit, the number of monthly payments, the start day, the practitioner, a note; the schedule is shown before saving and adds up to the total to the cent). Each instalment goes on the account on its date as an invoice of its own to the patient (code PLAN, "Payment plan: Braces, instalment 3 of 12", never claimed). There is no overnight run yet: due instalments are posted when someone who bills opens the patient's Billing tab, or with "Post due instalments" in Finance > Overview's daily controls (the line shows only while some are due); one due in a closed month goes on the first open day; a plan is stopped with a reason and what was posted stays. Prepaid packages: practice administrators set them up under Admin > Tariffs > Contracts and co-payments (name, codes, sessions, price, months valid; stop selling); "Sell a package" on the patient's Billing tab puts the sale on an invoice (code PKG, paid by the patient, never claimed); at billing a line whose code a package covers is paid from it (N$ 0.00, invoice_services.package_id) with what is left and the expiry shown ("6 of 10 left, until 1 Apr 2027 after this visit", "Bill it normally" undoes it), as on the patient file; use is counted from the lines of invoices that are not cancelled, so saving a visit again never counts twice; administrators and doctors cancel a package with a reason. Promotions (administrators, same place): a percentage or an amount off chosen codes between two dates (a second promotion on the same code and days is refused), ended early with End now; at billing a private patient's line gets the discount with the promotion named (invoice_services.promotion_id; "Remove the promotion", "Apply it"; never for medical aid patients, as for line discounts), and Finance > Reports > Discounts given lists it with the promotion's name as the reason. Stock > Settings: "Medicine price tiers" (dispensing practices; medical aid patients, private patients and staff, each a markup on cost plus a dispensing fee) and "Materials" (cost plus a handling fee; "Fill in the NAMAF 2025 figures" gives rule 013: 35% of the cost up to N$ 4,240.20, 10% above, at most N$ 8,016.80) are separate rules (stock_pricing_rules) and both start off, so every price stays what it was until a practice switches one on. A medicine's item details hold a fund reference price (stock_reference_prices; administrators, doctors and nurses): a medical aid patient is billed at most that unless "Bill the full price" is ticked in From stock, where "Staff price" uses the staff tier; a material asks which procedure it was used for and goes on the bill straight under that line with its date, practitioner and teeth ("Used for 8341, tooth 16"). Finance > Batches > Fund statement > "Email to the fund" sends the statement as a PDF through centralized-email-gateway (communicationService.sendEmail) to the fund's claims address from the fund master, after a tick to confirm, logged in practice_email_logs like other emails (counts and fund codes only in its details). The new tables are read by the practice's staff and changed only through functions that check the role; invoice_services only gained the two nullable columns; before the SQL every new part says it is not set up yet. Code: src/utils/billing/paymentPlans.ts, packages.ts, promotions.ts, codeList.ts and lineExtras.ts, src/utils/stock/pricingRules.ts and materialLines.ts, src/services/billing/billingExtrasService.ts, src/services/stock/pricingRulesService.ts, src/components/billingExtras/, src/components/stock/PricingRulesCards.tsx and ReferencePriceFact.tsx, src/components/finance/claims/fundStatementPdf.ts, fundStatementEmail.ts and FundStatementEmailSheet.tsx. Follow-up (proposals/2026-10-13-billing-extras-followup.sql, applied 2026-10-13 as billing_extras_followup_2026_10_13; undo in -followup-undo.sql): the rows that only carry invoices (payment plans, packages and Eminance opening balances: cancelled, "Not a consultation", automation_source 'system') are not visits wherever visits are counted. One rule, public.visit_is_carrier in the database and src/utils/carrierVisits.ts in the app (a test keeps them the same and fails on a copy), used by the dashboard's figures (get_dashboard_stats and the encounter, active-patient and visit cards), Encounters > Analytics and the Encounters list (encounters_view), Finance > Reports (appointments and attendance, Build a report), support's practice list, the patient file (visits on record, the Encounters tab and its count; the Billing tab still shows each invoice's row), patient search, the merge screen (patient_record_counts), the data fetcher's visit counts, the patient app's appointments, the appointments view and visit numbers (such a row gets none, so the next visit keeps the sequence); recalls ("recalled but not seen"), smart lists, no-shows, the diary and its report already left cancelled visits out.
- Optometry: the full eye exam, a barcode per frame, the Optometry page and reports, consignment frames, and the register of all scheduled medicines (parity M2, M7, M12, R34, L11, R32; proposals/2026-10-13-optometry-frames-and-exam.sql, applied 2026-10-13 as optometry_frames_and_exam_2026_10_13; undo in its header): the visit's Eye exam also keeps the case history, keratometry (dioptres, or the radius in mm), the health of the front and back of the eye ("All normal" per part, cup-to-disc, how the back was seen, dilated) and how each contact lens fits; every frame on the wall has its own barcode (scanned when received or given the practice's FR numbers, labels through the label printer) and a status with who changed it and when (in stock, reserved, sold, back to the supplier, lost or damaged), kept in step with the stock ledger by the database; the Optometry page (/optometry, in the sidebar of optometry practices only) holds the lab orders, frames, reports (job costing, frames sold with salespeople, frames by barcode, presbyopic patients by name, consignment) and benefit notes, money reports following Finance access; a consignment frame carries no stock value and each one sold is owed to its supplier until the supplier's invoice is recorded as a payable; Stock > Reports > Scheduled register > All scheduled medicines prints every scheduled medicine's register for a period with the script, prescriber and branch of each issue
- Video consultations, the diary's waiting list, questions before the visit, drawings on body and tooth charts, and radiology reports and labels (parity B16, B21, B17, C9, C12; proposals/2026-10-13-video-bookings.sql, 2026-10-13-video-link-in-confirmations.sql, 2026-10-13-diary-waiting-list.sql, 2026-10-13-previsit-questionnaire.sql and 2026-10-13-imaging-reports.sql, applied 2026-10-13 as video_bookings_2026_10_13, video_link_in_confirmations_2026_10_13, diary_waiting_list_2026_10_13, previsit_questionnaire_2026_10_13 and imaging_reports_2026_10_13): the booking form's "Video consultation" keeps the room link (typed, the practice's link from Diary settings > Appointment types > Video consultations, or a new private OneHealth room) in visits.video_link (https only); diary cards and the booking window show "Video" with Copy link and Join the call; {{videoLink}} fills message templates (the next booking's own room), "Remind patients" and, once send-appointment-reminders and process-automation-queue are deployed, the automatic reminders and the booking confirmation (automation_queue_claim already passes the link); a line holding only {{videoLink}} is left out for a booking in the rooms. Diary > More > Waiting list (diary_waiting_list, changed only through save_waiting_list_entry, record_waiting_list_offer and close_waiting_list_entry): the patient, a practitioner or any, the type and length, the days and times that suit, until when, the booking to move earlier and a note; Find a time (diary_free_slots and those wishes) and Book a time (the booking form filled in; the entry closes as booked once saved); a cancelled booking or a clicked free time shows who on the list could take it, first come first served, and "Offer by SMS" shows the number and the text and sends only on Send SMS, through centralized-sms-gateway (communicationService) as a waitlist_offer message, so YES or NO arrives in SMS replies for staff and never books or confirms anything. A patient who replied STOP (patients.sms_opt_out, the flag every SMS honours) never gets an offer by SMS: the diary shows "Asked for no SMS" in place of Offer by SMS (reception phones them and notes the call in their entry), and the gateway refuses the waitlist_offer type to any number that replied STOP. Diary settings > Questions (practice administrators and practitioners; previsit_questionnaires): yes/no or own-words questions, needed or not, four examples to start from; the booking window says whether they were answered and offers Answer on this tablet (a full-screen page in the signed-in session, "Reception: close" to leave), Send the link by SMS (shown first, through the gateway) and Copy the link; the answers (previsit_answers, kept once) show on the visit's General tab. The link /q/<22-character code> opens without signing in and reaches only previsit_questionnaire, the one function granted to anon: only the code's SHA-256 is stored, it shows that booking's questions only, takes the answers once and ends at the end of the visit's day (at most 30 days, or when a new link is made, the visit is cancelled or seen, or the questions are answered); the page needs the app with this route deployed. The visit's General tab has Drawings (a saved visit): a body chart front and back, an adult or child tooth chart (dental practices only) or a blank page, three pens, two thicknesses, Undo, Clear and a caption, saved as a PNG in the records bucket with a patient_media row (subcategory drawing), so the patient file's Media tab lists it. The visit's Imaging tab shows each request's radiology report under it, and practitioners, nurses and practice administrators add or change it (save_imaging_report: the report, the radiologist and the date on the report; the request becomes completed); the patient file's Imaging tab adds Requests and Reports (every request with its report, a row opening its visit) and prints a request's label (patient, ID number or date of birth, examination, request date and reference, practice) through the label printer. PACS is not included. Code: src/utils/diary/videoBookings.ts and waitingList.ts, src/utils/clinical/previsitQuestions.ts, drawings.ts and imagingReports.ts, src/services/videoBookingService.ts, waitingListService.ts, previsitService.ts, drawingService.ts and imagingReportService.ts, src/components/appointments/diary/Video*.tsx, Waiting*.tsx and useDiaryWaitingList.tsx, src/components/previsit/, src/pages/PrevisitQuestionnairePage.tsx, src/components/drawings/, src/components/requests/ImagingReport*.tsx.
- Stores and transfers, the supplier ledger, stock lists, creditors reports and one label printer (parity L10, L12, L14, O9, R24, R33; proposals/2026-10-13-stock-stores-and-suppliers.sql, applied 2026-10-13 as stock_stores_and_suppliers_2026_10_13; undo in its header): practice administrators add stores at Stock > Settings > Stores (a branch's store supplies that branch's billing and dispensing); deliveries, returns, adjustments and stock takes then choose the store, Items shows stock per store ("Stock at") and an item where it is, and Stock > Transfers sends stock from one store to another (who sent and received it and when; "On the way" until the other store receives it, or cancelled with a reason); a practice with one store sees no change, and totals, average cost and the stock value stay practice-wide. Suppliers keep a postal address and an account: their invoices are the deliveries received on account, their credits the returns; Pay (practice administrators and doctors) pays the ticked invoices oldest first, credit first, keeps the rest on account, marks an invoice paid in full as paid in Finance's payables too, prints a payment advice and can be reversed with a reason; a supplier's statement for a period prints or downloads. Stock > Reports > Creditors: supplier age analysis, transactions of a period and VAT on purchases (the VAT typed from supplier invoices only: patient invoices do not record VAT yet, owner decision J4, so it is not a VAT return); Stock > Reports > Stock lists: price list, count sheet, sales, usage, goods received and returned, and transfers (practices with stores), each printed or as CSV. One label printer (src/components/labels/LabelPrintSheet.tsx, src/utils/labels/): A4 label sheets or a label printer, where to start on a used sheet, copies and lining up; Code 128 barcode and shelf price labels from Stock > Items (scanning one finds the item), frame tags for optometry, and mailing labels from Messages > Lists > a list > Labels (one per address if wanted; patients without an address are named). Code: src/utils/stock/stores.ts, supplierLedger.ts, stockReports.ts and creditorsReports.ts, src/services/stock/storeService.ts and supplierLedgerService.ts, src/services/labels/mailingLabelsService.ts, src/components/stock/TransfersTab.tsx, StoresCard.tsx, SupplierAccountSection.tsx, PaySupplierSheet.tsx, CreditorsReports.tsx, StockListsReport.tsx and StockLabelsSheet.tsx, src/components/patientLists/ListLabelsSheet.tsx.
- Company accounts, injury and accident cases, moving patients to another fund, the town picker and special lists (parity A14, A19, A21, A16, R29; proposals/2026-10-13-patient-town.sql, -company-accounts-and-injury-cases.sql and -fund-moves.sql, applied 2026-10-13 as patient_town_2026_10_13, company_accounts_and_injury_cases_2026_10_13 and fund_moves_2026_10_13): patients.town and patients.region (the 14 regions; nullable, policies unchanged) are filled by a town picker at registration and on edit (180 Namibian towns, villages and settlements with their region and other spellings, src/utils/address/namibianTowns.ts; picking a town fills its region; postal codes stay a free field, since NamPost's codes name the post office of a PO Box, not a street). Finance > Debtors > Companies: employers, the Employees' Compensation Fund (Social Security Commission), the MVA Fund and other payers as accounts (AC-0001), each with its employees, its invoices, age bands, a printed statement and CSV, payments allocated oldest first (post_payer_account_receipt through ar_post_receipt; no second ledger) and closing once it owes nothing. Patient file > Billing: injury on duty, occupational disease and motor vehicle accident cases (employer, employee number, date, claim number, who pays: the fund, the employer, another account or the patient) and the company accounts the patient is on. The visit's Billing tab asks who pays (the patient, a company the patient is on or an open case; saved before the invoice): a visit billed to an account makes all of its invoice the account's (paid_by 'patient', nothing claimed; set_visit_payer refuses invoices already sent, paid, credited or in a closed month, and billing back to the patient restores each line's split and claims it again); the printed invoice then names the account and the case instead of the medical aid. The patient's own balance, statements, payments, reminders, interest, small balances and statement runs leave such invoices out (accountBilledInvoices.ts, withoutAccountInvoices); the age analysis shows each account on its own row. Patients > More > Move to another fund (administrators): choose the fund and options, main members or dependants and a name, untick anyone, choose the new fund and option and give the reason; apply_fund_move moves only files still as shown, sends claims not yet sent to the new fund's batch, never touches sent claims, and each patient's change history shows the reason. Messages > Lists > Special lists: injury and accident cases, accounts handed over and referred patients, each with a CSV. No claim file is made for the compensation or MVA fund. Follow-up (proposals/2026-10-13-company-accounts-followup.sql, applied 2026-10-13 as company_accounts_followup_2026_10_13): every age analysis, the month-end pack, the fund patients report, the receivables report and Overview's "who owes" sentence count an account's invoices under the account (one map, FinanceWorkspace.payers, through ageContext and receivablesByDebtor) and still add up to the receivables, and ar_patient_balances leaves them out, so the accounts handed over list, the credit limit and its override note show what the patient owes themselves. Files: src/utils/accounts/, src/utils/address/, src/services/payerAccountService.ts, fundMoveService.ts, specialListsService.ts, accountBilledInvoices.ts, src/components/finance/companies/, src/components/patients/payers/, src/components/patients/fundMove/, src/components/address/TownPicker.tsx, src/components/visits/VisitPayerCard.tsx and useVisitPayer.ts, src/components/patientLists/special/.
- Security sweep (2026-10-13; proposals/2026-10-13-security-sweep.sql, applied as security_sweep_2026_10_13): the public key (anon) now runs one OneHealth function, previsit_questionnaire (the patient's pre-visit link); EXECUTE was taken from PUBLIC and anon on the 92 others it could run (dashboard counts, visit state changes, queue processors, clean-ups, test helpers, 45 trigger functions). Signed-in users and the service key keep every grant they had, triggers still fire (they need no EXECUTE), and the 11 functions of the other apps sharing the database are untouched. Every table added since 7 October has row security, no anon rights and a staff-of-the-practice read policy; patient_merges, practitioner_billing and report_exports gained the patient app's staff-only guard, and app logins lost TRUNCATE (which skips row security), TRIGGER and REFERENCES on 14 of them. dashboard_stats_mv, patient_location_density, patient_visit_stats and today_visits_view (materialized views: no row security, so any login read every practice's rows, today's visits with patient contact details) are for the service key only, and 45 owner-rights functions got a fixed search path (public, extensions). Security advisors: 471 findings before, 424 after; the rest are the other apps' tables and views, Auth settings and the Postgres upgrade for the owner, and the signed-in RPCs the app needs.
- Leftovers of 13 October (wave 7; proposals/2026-10-13-recall-offer-skips.sql and -patient-price-rates.sql, applied 2026-10-13 as recall_offer_skips_2026_10_13 and patient_price_rates_2026_10_13): rows that only carry invoices (src/utils/carrierVisits.ts) are no longer offered as a visit to pick (lab and imaging requests, the visit a quote is invoiced at, optical lab orders) nor listed in the record export, the patient page's visit timeline or the history beside a visit, and vitals recorded from the patient file go on the latest real visit. Quotes add the practice's linked codes as visits do ("Added with 0300" on the line, a toast saying what came with what; removing the code before saving takes them away). A skipped recall offer is kept per visit and code (visit_recall_offer_skips, written by skip_visit_recall_offers for any staff member of the practice), so no other computer offers it again. Codes charged by time: claim field 18 (the number of services) carries the minutes noted on the line, as the claim specification asks for time-based lines (src/utils/billing/serviceTime.ts; funds refuse such a line without them, QEDI D036); the claim check warns when a line does not say how long it took, and the rule's hint on Admin > Tariffs says claims send the minutes; field 49 (service time) is a time of day and stays as stored. Patient price rate (R28): patient file > Billing > Price rate, a private, staff or contract rate as a percentage of the usual price (10% to 500%; practice administrators and practitioners set it through set_patient_price_rate, everyone sees it). It prices the codes billed at the practice's price list on visits, the Record Visit form, quotes and the dental treatment plan: the usual price (the practice tariff at the treating practitioner's own rate) times the patient's rate; a medical aid's own price is never changed; a staff rate also starts From stock at the staff medicine price; the Billing tab says when a rate applies. Code: src/utils/billing/patientRates.ts, src/services/patientRateService.ts and recallOfferSkipService.ts, src/components/patients/PatientPriceRatePanel.tsx, src/components/quotes/quoteLinkedCodes.ts.
- Integration review of 7-13 October (wave 7): links both ways, and buttons that did nothing, fixed in place. Messages keeps its tab in the address (Back from a patient opened from a list, a reply or the log returns to it; an open list is ?list=), a list's names open the patient file and the file's Lists sheet opens each list; "Configure Templates" opens Templates, failed SMS and emails link to the Message log, SMS replies and app requests open their booking (and the diary on the day asked for), the Message log opens a message's visit and leads back to the file; Telemedicine's Start Call joins a video booking's own room without a check-in; the sidebar's Messages opens Messaging while staff messages are unread; mailing labels, letters and {{patientAddress}} carry the town from the town picker. Finance keeps the chosen tab in the address (a report row opening an invoice no longer jumped back to an older link's tab) and reads ?view= and ?account= (the patient file's "Account in Finance" opens that company account, Stock's "Payables in Finance" opens Ledgers > Expenses, "Follow up" on promises opens Credit control, a company's own age-analysis row opens it); a receipt links to the invoices it paid and the patient's billing, an invoice's payments open their receipt, "Fund answers" lists the invoice's claim lines with each answer, and Not yet batched, the Daybook, a company's invoices and employees and a remittance's lines open their records; claim dates are day first; the month end's Close is for administrators only; a linked invoice that is not there and a controls check that failed say so; Batches and the dashboard's finance window no longer call three database functions that do not exist. The patient file's invoices open in Finance (for staff with Finance access); its bookings open their visit and Billing tab every time and name the practitioner; letters, sick notes, consents, medicines, media, lab and imaging rows open their visit on the tab that holds them; the visit's "Who pays" is read again at save when it could not be read on opening (an account's visit was rebuilt as a medical aid invoice) and says so on the card; the Dashboard's visit tracker opens the patient; the Encounters list's two row buttons open the visit and the patient file, a failed load says so and an export takes the ticked visits; Process Queue says OneHealth's scheduler runs the queue; Delete Booking offers the freed time to the waiting list; Diary settings and stage changes show plain errors. Stock opens a linked delivery older than its list and a linked supplier once; frames are added and changed only by the roles that may; the optometry report's costs follow Finance access; Stock's prints say when the browser blocks them; the NAMAF materials button says it holds the dental figures; the Optometry page's lab slips carry the date of birth; upload failures are in plain words. Tests: 71 new in 40 files. No SQL.
- Visits and quotes (wave 8, 13 October; no database change): the visit screen asks before throwing away what was typed: its X, and any link that opens another page (the invoice, claim batch or rejections on the Billing tab, a medicine in stock, the links in the Teeth sheet), ask "Leave it anyway?" once something was typed; a new tab or nothing typed never asks, and the form's Cancel stays a deliberate discard. A service, tooth line or medicine added or removed only by clicking counts as a change too, through the same edit flag (EditVisitTabs reports it, src/components/visits/visitEdits.ts), while opening the visit, prices arriving and the 8109 a dental Billing tab adds by itself do not. "Edit medication" on a new visit works as on Update Visit (the medicine goes back into the add form and off the list; one rule in src/components/visits/medicineEdit.ts). The "AI-Powered Prescription Assistant" button is hidden on both visit screens until a service exists behind it (ai-assist only searches patients and reads lab results). Dates on the visit screens are day first (Encounter Date, the add and edit headers, "Generated" on hand-off documents) through formatServiceDate. Quotes: the Tooth field (QuoteEditor) and the PDF's Tooth column (quotePdf, from the practice type now read with the letterhead) show for dental practices only; the patient's name in the quote viewer opens the patient file; a quote made from the dental treatment plan holds the practice's linked codes with each piece of work (priceVisit uses withLinkedCodes, so the plan's price stays its quote's price) and a toast says which came. Tests: FullScreenEditVisitModal.leave (12), visitEdits (5), EditVisitTabs.lineEdits (3), AddVisitTabs.medicines (3), medicineEdit (3), QuoteEditor.tooth (2), quotePdf (+2), QuoteViewer.patientLink (1), planPricing (+3), makePlanQuote (1).
- Recalls, messages and diary (wave 8, 13 October; proposals/2026-10-13-eminance-recalls.sql, applied 2026-10-13 as eminance_recalls_2026_10_13): recalls brought over from Eminance and the diary report's "Move to a recall list" now also set each patient's own recall (through set_patient_recall and its rules), so they come due on the "Recall due" list and close when the patient books. No-shows get a recall for today ("Missed appointment on 7 Oct 2026"), recalls that passed unseen move to today, and an Eminance recall whose date has passed is due on the import day with the Eminance date in its reason; the import's undo removes the recalls it set, and earlier imports were backfilled (none had run). List SMS accept the template names ({{patientFirstName}}, {{patientName}}, {{practiceName}}, {{appointmentDate}} ...) as well as the list names the editor's buttons add ({{first_name}} ...), through one mapping in listMessages.ts. Diary links from the patient file, the diary report and Encounters carry the booking's practitioner (and the "Cancelled" filter for a cancelled booking), so a doctor's own-column diary still shows it; the time grid draws cancelled bookings under that filter. Cancel Appointment in the Reschedule form offers the freed time to the waiting list, as Cancel Visit and Delete Booking do.
- Stock and optometry (wave 8, 13 October; proposals/2026-10-13-consignment-supplier-ledger.sql, applied 2026-10-13 as consignment_supplier_ledger_2026_10_13): a consignment supplier invoice (Optometry > Reports > Consignment > Supplier's invoice) is now also the supplier's CSG invoice on its account, so what the practice owes a frame supplier is one figure on Stock > Suppliers (account, statement, age analysis, transactions, VAT on purchases, Pay, payment advice); reversing it on Stock > Deliveries puts its frames back to owed; consignment invoices recorded earlier were added; every other supplier's figures stayed the same (proven in the rehearsal). A posted or cancelled stock count opens read only from Stock take's earlier counts and from an item's history (?count=): its lines, the differences valued as posted, who started it and who posted or cancelled it and when, and its variance report to print again. Transfers link both ways: an item's history opens the transfer (?transfer=, its id or TRF number), a transfer opens the sending and the receiving store's stock (Items ?store=), and a store's stock opens its transfers (Transfers ?store=). The Optometry page follows Stock access (its route, the sidebar and the patient file's practice view; a role kept out is told so under the Optometry name), and its money reports still follow Finance. Code: src/utils/stock/supplierLedger.ts, stockTake.ts, stores.ts; src/components/stock/CountDetailSheet.tsx, StockTakeTab.tsx, TransfersTab.tsx, ItemDetailSheet.tsx, StockItemsTab.tsx, DeliveriesTab.tsx; src/components/optometry/ConsignmentView.tsx; src/utils/auth/screenAccess.ts (OPTOMETRY_FOLLOWS); tests beside each.
- Finance (wave 8, 13 October; no database change): Ledgers > Inventory, the stock valuation report and the month-end pack value stock from Stock's own ledger (on hand and value per item from stock_item_levels, at the average cost of what is on hand, excluding VAT), the same figures as Stock > Reports > Stock value to the cent; equipment is a stock item in that ledger (there is no other equipment record) and is still shown apart; before the stock update the old inventory list still counts; "Manage inventory" opens Stock > Items and each item row opens that item on the Stock page (src/components/finance/stockInventory.ts). The patient's Billing tab has one statement: once receipts are in use, Manage invoices > Statement opens the ledger statement (part payments, receipts, credit notes and discounts in every total), and before that the older invoice statement stays (src/components/finance/receipts/PatientStatementChooser.tsx). Statement lines open their record: a payment its receipt (over the statement; a refund or reversal there reloads the statement and the account), an invoice, credit note or discount its invoice (in Finance for staff with Finance access, else the invoice's details). The older Finance > Reports cards drill down like the newer ones: every row opens what it counts (a day of takings or a payment method its payments, an unpaid invoice itself, a fund its unpaid invoices, a tariff code, payer or practitioner their invoices, a month its appointments or payslips, an expense category its expenses, a stock category its items on the Stock page), and each list adds up to its row (src/components/finance/reportRecords.ts, practiceReports/RecordListSheet.tsx); "Age analysis" and "Medical aid age analysis" open Debtors > Age analysis on their grouping once Debtors is in use. Saves on Batches, Quotes and Remittances, and Overview's "Post due instalments", reload Finance's figures at once. A ?batch= link to a batch older than the newest 300 opens it (read by id and kept through reloads; one that is not the practice's says so). The old batch screen in src/pages/Finance.tsx, never shown but still loading on the Batches tab, is removed (1,824 lines to 91). Wording: "Practitioner productivity", "Practitioner" columns, names as the staff list has them (no "Dr." added); every Finance amount in the app's one N$ format (formatNad, "N$ 1,234.50"); the number cards look as they did. Tests: 66 new in 16 files.
- Faster first screen on mobile data (wave 9, 13 October; no database change, nothing looks different): staff pages load when first opened (React.lazy in src/App.tsx: Patients, the older patient visit page, Encounters, Communications, Finance, Billing workflow, Practice profile, the four admin pages and Settings), each showing the page spinner Stock and Optometry already used while its code arrives, and inside its route guard, so a role the practice keeps out never downloads the page; every address, guard and the old /patients/<id> link are unchanged. The Dashboard's visit screen and its (never opened) financial window, and the visit tracker's patient file and visit screen, load when first opened; the spreadsheet library loads when an Excel file is read (Eminance import) and the PDF libraries when a prescription, sick note or invoice is made from the tracker's print buttons. The main file a phone downloads before the first screen went from 14.2 MB (2.84 MB compressed) to 3.7 MB (0.76 MB compressed); the installable app still keeps every page for offline start (precache 138 files, 18.1 MB, strategy unchanged). Tests: src/__tests__/lazyScreens.test.tsx opens every staff address through the route table with an empty database (plus the guards, the old link and the spinner while a page loads); the Dashboard, visit tracker, Eminance import and document suites check the windows still open and the libraries load only when used. If a page's code does not arrive (a dropped connection, or a release that went live meanwhile), it is fetched again under a new address (Chrome keeps a failed file failed until the app is reopened), and if it still fails the page area says "This page could not load. Check the connection and try again." with Try again, which loads it again without reloading the app, and Open the dashboard (patient screens: Try again only; windows: Try again and Close; src/components/layout/lazyScreen.tsx, src/utils/loadWithRetry.ts), never an empty screen.
- Second integration review (wave 10, 13 October; older screens; no database change, no page looks different): a change the database refuses is never reported as saved (rows checked: Patients > Settings, the practice profile, branches, departments and a department rename that now takes its staff along, overhead expenses, benefits / deductions / bonuses, payroll item and department pickers, documents, Gmail, social accounts, chat members, follow-up templates), and database wording became plain messages (tariffs, funds, practice type, HR dialogs, password change: only a refused password says "incorrect"). Settings links open the named part (?section=) and Settings writes ?tab=; Escape closes the HR, practice, chat, tracker and form windows (src/hooks/useEscapeToClose.ts, only the top window). Business hours closing before they open are refused (Settings > Practice and branches); documents and emails print the website typed in Settings (src/utils/practiceWebsite.ts). Patients: the export carries Reference / Old File Number / ID Number (never the internal id) and no always-blank columns; bulk SMS tells "replied STOP" and "SMS limit reached" apart from failures and stops at the limit; the branch window's practice choice and counts follow the filter (branchFilter.ts); smart search asks in chunks and says when it could not run. Encounters lists one row per visit; the patient app says when it could not load or is not switched on; the chat list shows the day of older messages and the collapsed sidebar names the unread count. Owner decisions are listed in the review tracker.
- Release prep (13 October): production builds are minified (vite.config.ts build.minify; first screen about 0.48 MB compressed, offline copy 10 MB instead of 18 MB); vercel.json sends every address to index.html so reloading any page no longer gives 404; the Dashboard's financial window opens from a small chart button by the Finance card's title (PremiumStatCard onDetails, "Open Finance overview"; clicking the card still opens Finance); Finance number cards follow the Dashboard cards' look (FinanceUI StatTile). Speed: the sign-in screen loads 57 modules instead of 249 (staff app in src/StaffApp.tsx, prefetched while signing in), sidebar links prefetch their page (src/pageLoaders.ts), paged lists fetch three pages at a time (src/lib/pagedRows.ts), duplicate Finance loads share one request, the unused background patient prefetcher is removed, and the per-request console log runs in development only.
- Cleanup and speed (wave 11, 13 October; owner decisions; no database change, no page looks different): removed what nothing opened: the /billing/workflow and /practice-profile pages (now "Page not found"; nothing linked to them) and the old patient page /patients/<id>/visit/<id> (its address now opens that patient's visit on the Patients page, like /patients/<id>?visit=), the Dashboard's never-opened windows (detailed report, appointment details / reschedule / actions / approval, the appointment grid, "Schedule New Appointment" and "Schedule New Visit") and the files only they used, and the five Patients > Settings options nothing read (default country, default language, consent, export requests, anonymising; the inactive-patient threshold stays). The Dashboard's financial window stays (Finance card's "Open Finance overview"). Speed: React Query keeps a screen for 5 minutes and reads it again only when older (src/lib/queryClient.ts; refetchOnMount was 'always'); saves refresh what they change through refreshAfterSave (staff, salary, payslips, practice), the patient file reads itself again after each save in it and on opening, and the practice row is one shared cached read for the menu, practice colours, tariff list and diary hours (src/lib/practiceRow.ts). The Dashboard's today's appointments match the practice through the patient in one request (no list of every patient id, which failed past about 1,000 patients); the notifications panel is on the page once (src/hooks/useMediaQuery.ts) and loads the newest 50; the Patients list is read once when the page opens (no second read a second later), page by page past 1,000 patients, and an older load can no longer replace a newer one.
- Inpatient (13 October; proposals/2026-10-13-inpatient-access.sql applied as inpatient_access_2026_10_13, then proposals/2026-10-13-inpatient-module.sql applied as inpatient_module_2026_10_13): the ward tables of the earlier module (hospital_wards, ward_beds, patient_admissions, bed_allocations, bed_transfer_history, ward_rounds, nursing_care_records, inpatient_medications, visitor_logs) were open to the public key; they are now read by the practice's staff only and changed only through inpatient_* functions that check the role (ward setup: administrators; rounds and prescribing: doctors; nursing records and doses: nurses and doctors; discharge: doctors, nurses, administrators). New sidebar entry Inpatient (before Stock, its own rose colour, Settings > Users > Screen access like Finance and Stock): a live bed board per ward (free, occupied, needs cleaning, out of use, reserved), admit (patient, free bed, visit, reason, admitting and attending doctor, ICD-10 diagnosis, the fund authorisation from the patient's register, fall-risk, allergy and isolation flags), move bed (old bed to cleaning, move kept), ward rounds, nursing records per shift linked to the visit's vitals, a medication chart (prescribe, doses given, missed, refused or held, stop with a reason), a visitor log (visiting hours and visitors at a time are warnings), discharge with a printable summary, and Bill the stay (one line per night at the bed's daily rate under the ward's bed-day code plus the ward's daily codes, through the invoice service, linked to the stay both ways). "Admit" on the patient file and the visit screen in practices with a ward. Rules: src/utils/inpatient/inpatientRules.ts (tested); screens: src/components/inpatient/*.
- NAMAF 2026 benchmark tariffs for every discipline, linked to the practice type (14 October; proposals/2026-10-13-namaf-tariffs.sql applied as namaf_tariffs_2026_10_13, then proposals/2026-10-14-practice-type-disciplines.sql applied as practice_type_disciplines_2026_10_14): the owner's NAMAF list in force on 13 Oct 2026 is in the database (namaf_tariffs: 43,985 lines in 144 disciplines, 33,017 with an amount; the others are priced by rule, at cost or by arrangement, so staff type the amount). The rows came from the owner's file only, were checked against it discipline by discipline (count and a fingerprint of every field) before they were kept, and are not in git. Each practice type now knows its discipline (practice_types.namaf_discipline_code: medical 014, dental 054, optometry 070, physiotherapy 072, psychology 086, nursing 088, dermatology 012, ENT 030 and so on; aesthetic has none), and 11 practice types were added for disciplines that had none (anaesthetics 010, internal medicine 018, psychiatry 022, general surgery 042, urology 046, occupational therapy 066, speech therapy and audiology 082000, dietetics 084, biokinetics 091, private hospital 057, day clinic 076); Settings > Practice offers them in plain words and 'general' still asks the practice to choose. A practice so finds its codes with no setup: visit billing (Add a service draws the first 120 codes and finds the rest by searching) and quotes offer the discipline's codes with NAMAF's amount as the default price; a fund's own price (PSEMAS), the practice's own price and the shared list of the practice type come first. A code with no fixed amount stays selectable and asks for the amount ('Amount when billed' on a visit, 'Amount when quoted' on a quote, where the typed amount is kept when the quote becomes an invoice). An administrator can still choose another discipline for one practice on Admin > Tariffs > Practice tariff (an orthodontist, an anaesthetist). Inpatient > Wards and beds suggests the private hospital's per-day ward codes (57001 surgical to 57007 day admission) for a ward's bed-day code, and the bed's daily rate supplies their amount. Optometry's 7,168 codes, the lens products among them, are searchable. Before the SQL is applied the app uses the earlier lists, and without the new column its built-in copy of the links (a test keeps that copy equal to the migration's list). Code: src/utils/billing/namafTariffs.ts, src/services/namafTariffService.ts, src/components/tariffs/NamafListNote.tsx, src/components/quotes/. The statement dialog's links test no longer calls the live database, so it passes in a full run.
- Dental specialists work like dental, and a practice type for every NAMAF discipline with a code list (14 October; proposals/2026-10-14-more-practice-types.sql applied as more_practice_types_2026_10_14): orthodontist, maxillo-facial and oral surgeon, periodontist (oral medicine), prosthodontist and dental therapist are practice types of their own, each billing from its own NAMAF list (064, 062, 092, 094, 095), and they get everything a dental practice gets: the tooth chart on the visit's Billing tab and the patient's Teeth tab, the NAMAF dental claim checks, the quote's Tooth column, dental lab orders and the dental code rules. Every one of those asks one helper, isDentalPractice (src/utils/billing/tariffRules.ts, its list in practiceTypeNames.ts), and the database's lab-order check asks public.is_dental_practice_type, the same list (a test keeps them equal); the dental technician's laboratory (093) has a type but no tooth chart. Another 49 types were added so a practice is given its codes by choosing its type: family medicine, pulmonologist, gastroenterologist, medical oncologist, neurosurgeon, nuclear physician, clinical haematologist, rheumatology (its list has only 3 lines), paediatric cardiologist, physical medicine, emergency medicine, plastic surgeon, radiation oncologist, thoracic surgeon, paediatric surgeon; medical technology laboratory, radiographer, sonographer, art therapist, podiatrist, medical scientist, orthoptist, clinical technologist, hearing aid acoustician, orthotist and prosthetist, social worker, psychological counsellor; chiropractor, homeopath, naturopath, acupuncturist, Chinese medicine practitioner, phytotherapist; ambulance service (three levels), blood transfusion service, hospice, nursing agency, sub-acute facility, rehabilitation hospital, mental health institute, provincial hospital, drug and alcohol treatment, clinical and support services, stand-alone oncology unit, and the second private hospital list (B tariff, so the first is now labelled A tariff) and day clinic list 077; 29 types became 83, 82 with a discipline (disciplines whose list is one administrative line got none). Settings > Practice lists the types under six headings (the look of the page is unchanged). The one practice typed 'dental_practice', which matches no type, is read as 'dental' wherever the app reads the type (price lists, the tooth chart, claim checks); its stored text is not changed and one save of the type in Settings tidies it. The automatic 8109 line stays with NAMAF's dentist schedule (8xxx codes): a dentist's or dental specialist's list that cannot bill 8109 still tells staff, while the dental therapist's list (095: codes 001-071, its own infection control code 009) gets no 8109 and no false error; the dentist starter bundles stay with the dentist list.
- Claims safety (14 October; proposals/2026-10-14-claims-need-icd10.sql applied as claims_need_icd10_2026_10_14): NAMAF Circular 4 of 2025 (since 1 July 2025 a claim line without an ICD-10 code is not paid) is now kept by the database as well as by claim review. The Dashboard's financial window no longer sends anything: its Submit and Submit All Active open that batch's claim review, or the open batches, in Finance > Batches (src/components/modals/EnhancedFinancialModal.tsx; a test keeps every call that could send or change a row out of it), and the send-batch-email edge function it called (a file built in the database with no ICD-10 check, EMINANCE as the software name, a made-up address for a fund with no email) was replaced by a 410 "retired" stub. A batch that is not sent yet cannot change to sent while any of its lines has no usable main ICD-10 code saved: a trigger on batch_headers asks claim_batch_icd10_gaps, which applies what claim review treats as errors (the code's shape, not an external cause code, in the medical aids' list, not a category heading, not an asterisk code, not discontinued; a code the list marks "not valid as main" still only warns), and submitBatch asks it before it emails anything, so a file never goes out that cannot then be recorded as sent; Submit also waits until confirmed codes are saved. Download of an open batch's claim file is off while the batch has errors (the preview still opens as a draft with its Download off; a sent batch's file stays available; src/components/finance/claims/fileDownloadGate.ts). prepare_batch_for_sending is closed to app logins (the service key keeps it). No existing row was changed: the 8 open batches (70 lines, none with a code) cannot be sent until their codes are saved in Finance > Batches (the guard's refusal first said "Finance > Claims", a tab Finance does not have; proposals/2026-10-14-claims-guard-wording.sql, applied as claims_guard_wording_2026_10_14, replaced its words in place).
- Dental specialists ask for a tooth where the dentist does (14 October; owner decision "copy the dentist flags"; no database change): NAMAF's file does not say which codes need a tooth number, so every NAMAF row asked for none, and an orthodontist, maxillo-facial and oral surgeon, periodontist, prosthodontist or dental therapist, who bills from NAMAF's list alone, was never asked for the tooth of a filling or an extraction. The dentist's shared list (practice_tariffs, practice type 'dental') knows it for 51 of its 179 codes, so a specialist's code with the same number is now flagged from it (orthodontist 4 of its 169 codes, maxillo-facial 6 of 450, periodontist 16 of 168, prosthodontist 26 of 334; the dental therapist's list is numbered 001-071 and shares none). The visit's Billing tab, quotes, the Tariffs page (its Tooth column) and claim review (a claim line of such a code with no tooth is an error) all ask the same question (withDentistToothFlags in src/utils/billing/namafTariffs.ts, applied by loadPracticeNamaf in src/services/namafTariffService.ts, and by toothRuleFor for claim review). It is read from the dentist's list, not copied into the database, so it follows that list (a session keeps what it read for half an hour). An administrator can still change it per code on Admin > Tariffs > Practice tariff: the practice's own version of a code wins, for billing and for claim review, and a shared row of the specialist's own type would win over the copy too. If the dentist's list cannot be read the list is offered without the rule, as before; claim review says so in its notices, and the visit and quote screens log the reason to the console. The dentist's own practice (and the practice typed 'dental_practice') reads its flags from its shared list as before and reads nothing more.
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

### Automatic Document Generation System (Added 2025-07-26)

#### Overview
The system now automatically generates printable PDF documents when visits are created or updated. This includes prescriptions, leave forms, and invoices in A5 and A4 formats.

#### Components

##### 1. Document Generation Service
**Location**: `src/services/documentGenerationService.ts`
**Features**:
- Generates prescriptions from visit prescription data
- Creates medical leave certificates from leave_forms table
- Produces professional invoices from invoice data
- Uses html2canvas and jsPDF for client-side PDF generation
- Stores PDFs in Supabase storage buckets
- Tracks documents in visit_documents table

##### 2. HandoffCard Component
**Location**: `src/components/visits/HandoffCard.tsx`
**Features**:
- Displays all generated documents for a visit
- Print button to open PDF in new tab
- Download button for offline access
- Manual "Generate Documents" button
- Shows document type with appropriate icons
- Real-time status updates

##### 3. Visit Forms Integration
**Modified Files**:
- `src/components/visits/EditVisitTabs.tsx`
- `src/components/visits/AddVisitTabs.tsx`

**Automatic Generation Triggers**:
- On visit creation (AddVisitTabs)
- On visit update (EditVisitTabs)
- Checks for presence of:
  - Medications → Generates prescription
  - Leave form data → Generates leave certificate
  - Invoice services → Generates invoice

#### Database Structure

##### visit_documents Table
```sql
CREATE TABLE visit_documents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    document_type varchar CHECK (document_type IN ('prescription', 'leave_form', 'invoice', 'receipt', 'other')),
    document_name varchar NOT NULL,
    file_path text NOT NULL,
    storage_bucket varchar DEFAULT 'documents',
    file_size integer,
    file_type varchar,
    generated_at timestamp with time zone DEFAULT now(),
    generated_by uuid REFERENCES users(id),
    status varchar DEFAULT 'active',
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
```

#### Storage Structure
- Bucket: `documents`
- Folders:
  - `/prescriptions/` - Prescription PDFs
  - `/leave_forms/` - Leave certificate PDFs
  - `/invoices/` - Invoice PDFs

#### PDF Templates

##### Prescription (A5)
- Practice header with logo
- ℞ symbol
- Patient information
- Medication list with dosage
- Doctor signature line
- Professional gray color scheme

##### Leave Form (A5)
- Medical certificate header
- Patient employment details
- Diagnosis and ICD-10 code
- Leave period dates
- Fitness status
- Doctor signature
- Form number tracking

##### Invoice (A4)
- Full practice branding
- Patient billing information
- Service line items
- Medical aid coverage breakdown
- Tax calculations
- Payment terms
- Banking details

#### Usage Flow
1. User creates/updates visit with relevant data
2. System automatically generates applicable PDFs
3. PDFs stored in Supabase storage
4. References saved to visit_documents table
5. HandoffCard displays available documents
6. User can print or download as needed

#### Tab Integration
New "Documents" tab added to visit forms:
- Icon: `solar:hand-shake-bold-duotone`
- Color: Green (#4caf50)
- Shows HandoffCard component
- Available in both Add and Edit visit modals

---

**END OF BLUEPRINT v4.1**

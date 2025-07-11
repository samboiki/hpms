# 🏥 ONEHEALTH SYSTEM BLUEPRINT - MASTER REFERENCE
**Version**: 3.0  
**Last Updated**: 2025-01-11 17:30:00 UTC  
**Based on**: Commit b8d98e7 (Last Known Good State)

---

## 📋 TABLE OF CONTENTS

### 1. [AUTHENTICATION & ACCESS](#1-authentication--access)
   - 1.1 [User Login Workflow](#11-user-login-workflow)
   - 1.2 [Role-Based Access Control](#12-role-based-access-control)
   - 1.3 [Practice Switching](#13-practice-switching)

### 2. [PATIENT MANAGEMENT](#2-patient-management)
   - 2.1 [Adding a New Patient](#21-adding-a-new-patient)
   - 2.2 [Editing Patient Information](#22-editing-patient-information)
   - 2.3 [Patient Search & Listing](#23-patient-search--listing)

### 3. [APPOINTMENTS & SCHEDULING](#3-appointments--scheduling)
   - 3.1 [Scheduling a Patient Appointment](#31-scheduling-a-patient-appointment)
   - 3.2 [Appointment Check-in Process](#32-appointment-check-in-process)
   - 3.3 [Rescheduling Appointments](#33-rescheduling-appointments)
   - 3.4 [Appointment Cancellation](#34-appointment-cancellation)

### 4. [CLINICAL ENCOUNTERS (VISITS)](#4-clinical-encounters-visits)
   - 4.1 [Starting a Visit](#41-starting-a-visit)
   - 4.2 [Recording Vitals](#42-recording-vitals)
   - 4.3 [Clinical Documentation](#43-clinical-documentation)
   - 4.4 [Completing a Visit](#44-completing-a-visit)

### 5. [COMMUNICATIONS & AUTOMATIONS](#5-communications--automations)
   - 5.1 [Appointment Reminder Automation](#51-appointment-reminder-automation)
   - 5.2 [Manual SMS Sending](#52-manual-sms-sending)
   - 5.3 [Email Communications](#53-email-communications)
   - 5.4 [Automation Settings Management](#54-automation-settings-management)

### 6. [BILLING & INVOICING](#6-billing--invoicing)
   - 6.1 [Creating an Invoice](#61-creating-an-invoice)
   - 6.2 [Payment Processing](#62-payment-processing)
   - 6.3 [Medical Aid Claims](#63-medical-aid-claims)
   - 6.4 [Statement Generation](#64-statement-generation)

### 7. [LABORATORY & IMAGING](#7-laboratory--imaging)
   - 7.1 [Ordering Lab Tests](#71-ordering-lab-tests)
   - 7.2 [Recording Lab Results](#72-recording-lab-results)
   - 7.3 [Imaging Requests](#73-imaging-requests)

### 8. [QUEUE MANAGEMENT](#8-queue-management)
   - 8.1 [Doctor Queue Workflow](#81-doctor-queue-workflow)
   - 8.2 [Patient Flow Management](#82-patient-flow-management)

### 9. [REPORTING & ANALYTICS](#9-reporting--analytics)
   - 9.1 [Dashboard Metrics](#91-dashboard-metrics)
   - 9.2 [Financial Reports](#92-financial-reports)

### 10. [SYSTEM ADMINISTRATION](#10-system-administration)
   - 10.1 [Practice Management](#101-practice-management)
   - 10.2 [User Management](#102-user-management)
   - 10.3 [Tariff Management](#103-tariff-management)

---

## 1. AUTHENTICATION & ACCESS

### 1.1 User Login Workflow
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Step-by-Step Process:
1. **User navigates to `/login`**
   - Component: `LoginPage.tsx`
   - Route: Public route (no auth required)

2. **User enters credentials**
   - Email and password input
   - Form validation (email format, password length)

3. **Submit login request**
   ```javascript
   // Frontend Action
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password
   })
   ```

4. **Backend Processing**
   - **Table**: `auth.users` (Supabase Auth)
   - **Function**: Supabase built-in auth
   - **Response**: JWT token + user data

5. **Success Flow**
   - **Store Update**: `useAuthStore` saves user data
   - **Tables Updated**: 
     - `admin_sessions` INSERT (session tracking)
     - `audit_logs` INSERT (login event)
   - **Redirect**: To dashboard based on role

6. **Error Handling**
   - Invalid credentials → Show error message
   - Account locked → Show lockout message
   - Network error → Show retry option

#### Dependencies:
- **Components**: `LoginPage.tsx`, `useAuthStore`
- **Tables**: `auth.users`, `admin_users`, `admin_sessions`
- **Functions**: 
  - `create_session()` - Creates session record (Modified: 2025-06-10)
  - `log_audit_trail()` - Logs login event (Modified: 2025-06-15)
- **External**: Supabase Auth Service

### 1.2 Role-Based Access Control
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:
1. **After login, check user role**
   - **Table**: `admin_users` JOIN `admin_roles`
   - **Function**: `get_user_permissions()` (Modified: 2025-06-20)
   
2. **Load permissions**
   ```sql
   -- Query executed
   SELECT ar.* FROM admin_roles ar
   JOIN admin_users au ON au.role_id = ar.id
   WHERE au.user_id = $1
   ```

3. **Apply route protection**
   - Component: `ProtectedRoute.tsx`
   - Check: User has required permission
   - Redirect: To unauthorized page if lacking permission

#### Dependencies:
- **Tables**: `admin_users`, `admin_roles`, `role_permissions`
- **Functions**: `check_user_permission()` (Modified: 2025-06-20)

### 1.3 Practice Switching
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:
1. **User clicks practice selector**
   - Component: `PracticeSelector.tsx`
   - Location: Header dropdown

2. **Load available practices**
   ```sql
   SELECT p.* FROM practices p
   JOIN user_practices up ON up.practice_id = p.id
   WHERE up.user_id = $1 AND up.is_active = true
   ```

3. **Switch practice**
   - **Store Update**: `usePracticeStore.setCurrentPractice()`
   - **Local Storage**: Save selected practice ID
   - **Tables Updated**: 
     - `admin_sessions` UPDATE (current_practice_id)
     - `audit_logs` INSERT (practice switch event)

4. **Reload dashboard data**
   - All queries now filtered by new practice_id
   - Components re-render with new data

#### Dependencies:
- **Tables**: `practices`, `user_practices`, `admin_sessions`
- **Store**: `usePracticeStore`
- **Functions**: `switch_user_practice()` (Modified: 2025-06-25)

---

## 2. PATIENT MANAGEMENT

### 2.1 Adding a New Patient
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Complete Workflow:

1. **Navigate to Patients Page**
   - Route: `/patients`
   - Component: `PatientsPage.tsx`
   - Permission Required: `patient.create`

2. **Click "Add Patient" Button**
   - Opens: `ModernPatientRegistrationForm.tsx`
   - Modal: Full-screen overlay

3. **Fill Patient Information**
   ```typescript
   // Form Fields
   {
     // Personal Information
     first_name: string (required)
     last_name: string (required)
     id_number: string (unique, validated)
     date_of_birth: date (required)
     gender: 'male' | 'female' | 'other'
     
     // Contact Information
     cell_number: string (validated format)
     email: string (optional, validated)
     address: string
     
     // Medical Information
     blood_type: string
     allergies: string[]
     chronic_conditions: string[]
   }
   ```

4. **Backend Processing - Patient Creation**
   ```sql
   -- Step 1: Insert patient
   INSERT INTO patients (
     practice_id, first_name, last_name, id_number, 
     date_of_birth, gender, cell_number, email, address,
     blood_type, allergies, chronic_conditions
   ) VALUES ($1, $2, ...) RETURNING *;
   ```
   
   **Triggers Fired**:
   - `generate_patient_reference()` BEFORE INSERT
     - Creates unique reference: P-YYYYMMDD-XXXX
     - Modified: 2025-06-15
   - `update_updated_at_column()` BEFORE UPDATE
     - Sets updated_at timestamp
     - Modified: 2025-06-01
   - `log_audit_trail()` AFTER INSERT
     - Records patient creation
     - Modified: 2025-06-15

5. **Optional: Add Medical Aid**
   - Component: `MedicalAidForm.tsx`
   - Table: `medical_aid_details`
   ```sql
   INSERT INTO medical_aid_details (
     patient_id, scheme_name, member_number, 
     principal_member, dependent_code
   ) VALUES ($1, $2, ...) RETURNING *;
   ```

6. **Optional: Add Next of Kin**
   - Component: `NextOfKinForm.tsx`
   - Table: `next_of_kin`
   ```sql
   INSERT INTO next_of_kin (
     patient_id, first_name, last_name, 
     relationship, cell_number
   ) VALUES ($1, $2, ...) RETURNING *;
   ```

7. **Automation Triggered**
   - **Function**: `process_patient_automation()` (Modified: 2025-07-10)
   - **Creates**: Welcome SMS/Email automation
   ```sql
   -- In automation_queue
   INSERT INTO automation_queue (
     trigger_type, trigger_data, scheduled_for, status
   ) VALUES (
     'patient.created',
     jsonb_build_object('patient_id', $1, ...),
     NOW(),
     'queued'
   );
   ```

8. **Success Response**
   - Toast notification: "Patient created successfully"
   - Redirect to patient detail page
   - Real-time update in patient list

#### Tables Involved:
- `patients` - Core patient data
- `medical_aid_details` - Insurance information
- `next_of_kin` - Emergency contacts
- `automation_queue` - Welcome message queue
- `audit_logs` - Creation tracking

#### Dependencies:
- **Components**: `ModernPatientRegistrationForm`, `MedicalAidForm`, `NextOfKinForm`
- **Functions**: 
  - `generate_patient_reference()` (Modified: 2025-06-15)
  - `process_patient_automation()` (Modified: 2025-07-10)
  - `validate_id_number()` (Modified: 2025-06-20)
- **Permissions**: `patient.create`
- **External**: ID number validation service (if configured)

### 2.2 Editing Patient Information
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Navigate to Patient Detail**
   - Route: `/patients/:id`
   - Component: `PatientDetailPage.tsx`

2. **Click Edit Button**
   - Opens: `EditPatientForm.tsx`
   - Pre-fills: Current patient data

3. **Modify Information**
   - Validation: Same as creation
   - Track changes: For audit log

4. **Submit Changes**
   ```sql
   UPDATE patients SET
     first_name = $2,
     last_name = $3,
     -- other fields
     updated_at = NOW()
   WHERE id = $1 AND practice_id = $practice_id
   RETURNING *;
   ```

5. **Triggers Fired**:
   - `update_updated_at_column()` - Updates timestamp
   - `log_audit_trail()` - Records changes
   - `check_patient_data_changes()` - Validates critical changes

#### Dependencies:
- **Tables**: `patients`, `audit_logs`
- **Functions**: `validate_patient_update()` (Modified: 2025-06-25)
- **Permissions**: `patient.update`

### 2.3 Patient Search & Listing
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Load Patient List**
   - Component: `PatientsList.tsx`
   - Default: 20 patients per page, ordered by created_at DESC

2. **Search Functionality**
   ```sql
   SELECT * FROM patients
   WHERE practice_id = $1
     AND (
       first_name ILIKE $2 OR
       last_name ILIKE $2 OR
       id_number ILIKE $2 OR
       cell_number ILIKE $2
     )
   ORDER BY created_at DESC
   LIMIT 20 OFFSET $3;
   ```

3. **Real-time Updates**
   - Subscription: `patients` table changes
   - Filter: Only current practice
   - Update: List refreshes automatically

#### Dependencies:
- **Tables**: `patients`
- **Indexes**: 
  - `idx_patients_practice_id` (Modified: 2025-06-15)
  - `idx_patients_search` (first_name, last_name) (Modified: 2025-06-20)
- **Real-time**: Supabase subscriptions

---

## 3. APPOINTMENTS & SCHEDULING

### 3.1 Scheduling a Patient Appointment
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Complete Workflow:

1. **Open Appointment Scheduler**
   - Component: `PremiumAppointmentScheduler.tsx`
   - Location: Dashboard or Appointments page

2. **Select Date and Time**
   - Calendar view shows availability
   - Check doctor schedule:
   ```sql
   SELECT * FROM doctor_schedules
   WHERE doctor_id = $1 
     AND day_of_week = EXTRACT(DOW FROM $2::date)
     AND is_active = true;
   ```

3. **Select/Search Patient**
   - Component: `PatientSearchDropdown.tsx`
   - Search as you type functionality

4. **Fill Appointment Details**
   ```typescript
   {
     patient_id: uuid (required)
     doctor_id: uuid (required)
     visit_date: date (required) // CRITICAL: This is the appointment date
     visit_time: time (required) // CRITICAL: This is the appointment time
     visit_type: string (consultation, follow-up, etc.)
     notes: string (optional)
     status: 'scheduled' // Always starts as scheduled
     is_scheduled: true // Indicates it's an appointment
   }
   ```

5. **Create Appointment (Visit Record)**
   ```sql
   INSERT INTO visits (
     patient_id, doctor_id, practice_id, branch_id,
     visit_date, visit_time, -- CRITICAL: Appointment datetime
     visit_type, notes, status, is_scheduled
   ) VALUES (
     $1, $2, $3, $4,
     '2025-07-12', '14:00:00', -- Example: Tomorrow at 2 PM
     'consultation', $notes, 'scheduled', true
   ) RETURNING *;
   ```

6. **Triggers Fired**:
   - `generate_visit_number()` BEFORE INSERT
     - Format: V-YYYYMMDD-XXXX
     - Modified: 2025-06-20
   
   - `appointment_automation_trigger()` AFTER INSERT
     - Checks: status='scheduled' AND is_scheduled=true
     - Calls: `queue_appointment_automation()`
     - Modified: 2025-07-11

7. **Automation Queue Creation**
   ```sql
   -- Inside queue_appointment_automation()
   SELECT queue_automation_intelligently(
     'appointment.scheduled',
     jsonb_build_object(
       'visit_id', NEW.id,
       'patient_id', NEW.patient_id,
       'patientName', p.first_name || ' ' || p.last_name,
       'appointmentDate', TO_CHAR(NEW.visit_date, 'Day, DD Month YYYY'),
       'appointmentTime', TO_CHAR(NEW.visit_time, 'HH12:MI AM'),
       'doctorName', u.full_name,
       'practiceName', pr.name,
       'practicePhone', pr.contact_phone
     ),
     (NEW.visit_date + NEW.visit_time)::timestamptz
   );
   ```

8. **Check Practice Automation Settings**
   ```sql
   SELECT * FROM practice_automation_settings
   WHERE practice_id = $1
     AND automation_id = 'appointment-reminder'
     AND enabled = true
     AND is_active = true;
   ```

9. **Create Automation Queue Entries**
   - Based on timing settings (e.g., 1 hour before)
   ```sql
   INSERT INTO automation_queue (
     practice_id, trigger_type, trigger_data,
     scheduled_for, status, priority
   ) VALUES (
     $practice_id, 'appointment.scheduled', $data,
     $appointment_time - INTERVAL '1 hour', -- 1 hour before
     'queued', 1
   );
   ```

10. **Success Response**
    - Calendar updates with new appointment
    - Toast: "Appointment scheduled successfully"
    - Patient receives confirmation (if immediate automation configured)

#### Tables Involved:
- `visits` - Appointment/visit records
- `patients` - Patient information
- `users` - Doctor information
- `doctor_schedules` - Availability
- `practice_automation_settings` - Automation config
- `automation_queue` - Pending automations

#### Dependencies:
- **Components**: `PremiumAppointmentScheduler`, `AppointmentCalendar`
- **Functions**:
  - `generate_visit_number()` (Modified: 2025-06-20)
  - `queue_appointment_automation()` (Modified: 2025-07-11)
  - `queue_automation_intelligently()` (Modified: 2025-07-11)
  - `check_doctor_availability()` (Modified: 2025-06-25)
- **Edge Functions**: None directly (automations processed by n8n)
- **Permissions**: `appointment.create`

### 3.2 Appointment Check-in Process
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Patient Arrives at Practice**
   - Receptionist opens appointments view
   - Component: `AppointmentsList.tsx`

2. **Find Patient Appointment**
   - Filter: Today's appointments
   - Status: 'scheduled'

3. **Mark as Ready**
   ```sql
   UPDATE visits SET
     status = 'ready',
     updated_at = NOW()
   WHERE id = $1 
     AND practice_id = $practice_id
     AND status = 'scheduled';
   ```

4. **Doctor Queue Update**
   - Real-time subscription updates doctor's queue
   - Component: `DoctorQueueManagement.tsx`
   - Patient appears in "Ready" section

#### Dependencies:
- **Tables**: `visits`, `audit_logs`
- **Real-time**: Supabase subscriptions on visits table
- **Permissions**: `appointment.checkin`

### 3.3 Rescheduling Appointments
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Open Existing Appointment**
   - Component: `AppointmentDetailsModal.tsx`
   - Click "Reschedule" button

2. **Select New Date/Time**
   - Component: `RescheduleAppointmentModal.tsx`
   - Check new slot availability

3. **Update Appointment**
   ```sql
   UPDATE visits SET
     visit_date = $2,  -- New appointment date
     visit_time = $3,  -- New appointment time
     updated_at = NOW(),
     notes = notes || E'\\nRescheduled from: ' || $old_datetime
   WHERE id = $1 AND status = 'scheduled';
   ```

4. **Automation Update**
   - Cancel old reminder automations
   - Create new reminder automations
   ```sql
   -- Cancel old automations
   UPDATE automation_queue SET
     status = 'cancelled'
   WHERE trigger_data->>'visit_id' = $1
     AND status = 'queued';
   
   -- Trigger will create new automations
   ```

#### Dependencies:
- **Functions**: `reschedule_appointment()` (Modified: 2025-07-05)
- **Triggers**: `appointment_automation_trigger` (re-fires on UPDATE)

### 3.4 Appointment Cancellation
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Select Appointment to Cancel**
   - From calendar or appointment list

2. **Confirm Cancellation**
   - Modal: `CancelAppointmentModal.tsx`
   - Optional: Add cancellation reason

3. **Update Status**
   ```sql
   UPDATE visits SET
     status = 'cancelled',
     cancelled_at = NOW(),
     cancellation_reason = $2,
     updated_at = NOW()
   WHERE id = $1 AND status = 'scheduled';
   ```

4. **Cancel Automations**
   ```sql
   UPDATE automation_queue SET
     status = 'cancelled',
     updated_at = NOW()
   WHERE trigger_data->>'visit_id' = $1
     AND status = 'queued';
   ```

5. **Optional: Send Cancellation Notice**
   - If configured, send SMS/Email about cancellation

#### Dependencies:
- **Tables**: `visits`, `automation_queue`
- **Functions**: `cancel_appointment()` (Modified: 2025-07-05)

---

## 4. CLINICAL ENCOUNTERS (VISITS)

### 4.1 Starting a Visit
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Complete Workflow:

1. **Doctor Views Queue**
   - Component: `DoctorQueueManagement.tsx`
   - Shows patients marked as "ready"

2. **Click "Start Visit"**
   - Button on patient card in queue
   - Or from patient detail page

3. **System Creates/Updates Visit**
   ```sql
   -- For scheduled appointment
   UPDATE visits SET
     status = 'in_progress',
     started_at = NOW(),
     actual_start_time = CURRENT_TIME,
     updated_at = NOW()
   WHERE id = $1 AND status IN ('scheduled', 'ready');
   
   -- For walk-in (creates new visit)
   INSERT INTO visits (
     patient_id, doctor_id, practice_id,
     visit_date, visit_time, -- Set to current date/time for walk-ins
     status, is_scheduled, visit_type
   ) VALUES (
     $1, $2, $3,
     CURRENT_DATE, CURRENT_TIME,
     'in_progress', false, 'consultation'
   );
   ```

4. **Navigate to Patient Profile**
   - Auto-redirect to patient detail page
   - Visit context loaded in store

5. **Queue Updates**
   - Real-time update removes patient from "ready" queue
   - Moves to "in progress" section

#### Dependencies:
- **Tables**: `visits`
- **Components**: `DoctorQueueManagement`, `PatientDetailPage`
- **Store**: `useVisitStore` - maintains current visit context
- **Permissions**: `visit.start`

### 4.2 Recording Vitals
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Open Vitals Form**
   - Tab: "Vitals" on patient detail page
   - Component: `VitalsForm.tsx`

2. **Enter Vital Signs**
   ```typescript
   {
     blood_pressure_systolic: number
     blood_pressure_diastolic: number
     heart_rate: number
     temperature: number
     respiratory_rate: number
     oxygen_saturation: number
     weight: number
     height: number
     bmi: number (auto-calculated)
   }
   ```

3. **Save Vitals**
   ```sql
   INSERT INTO vitals (
     patient_id, visit_id, 
     blood_pressure_systolic, blood_pressure_diastolic,
     heart_rate, temperature, respiratory_rate,
     oxygen_saturation, weight, height, bmi,
     recorded_by, recorded_at
   ) VALUES ($1, $2, ..., $user_id, NOW());
   ```

4. **Link to Current Visit**
   - If visit in progress, auto-link
   - Otherwise, can link later

#### Dependencies:
- **Tables**: `vitals`, `visits`
- **Functions**: `calculate_bmi()` (Modified: 2025-06-20)
- **Validation**: Normal ranges for vital signs

### 4.3 Clinical Documentation
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Add Clinical Notes**
   - Component: `ClinicalNotesEditor.tsx`
   - Rich text editor with templates

2. **Document Chief Complaint**
   ```sql
   UPDATE visits SET
     chief_complaint = $2,
     symptoms = $3,
     updated_at = NOW()
   WHERE id = $1;
   ```

3. **Add Diagnosis**
   ```sql
   INSERT INTO medical_records (
     visit_id, patient_id, record_type,
     diagnosis_code, diagnosis_description,
     notes, created_by
   ) VALUES (
     $1, $2, 'diagnosis',
     $icd_code, $description,
     $notes, $user_id
   );
   ```

4. **Create Prescription**
   ```sql
   INSERT INTO prescriptions (
     visit_id, patient_id,
     medication, dosage, frequency,
     duration, instructions,
     prescribed_by, prescribed_at
   ) VALUES ($1, $2, ..., $user_id, NOW());
   ```

5. **Order Lab Tests**
   - Component: `AddLabRequestForm.tsx`
   ```sql
   INSERT INTO lab_requests (
     visit_id, patient_id,
     tests_requested, urgency,
     clinical_notes, requested_by
   ) VALUES ($1, $2, $tests::jsonb, $urgency, $notes, $user_id);
   ```

#### Dependencies:
- **Tables**: `visits`, `medical_records`, `prescriptions`, `lab_requests`
- **Components**: Various clinical forms
- **Functions**: `validate_prescription()` (Modified: 2025-07-01)

### 4.4 Completing a Visit
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Click "Complete Visit"**
   - Button in visit actions
   - Validates required documentation

2. **Update Visit Status**
   ```sql
   UPDATE visits SET
     status = 'completed',
     completed_at = NOW(),
     treatment_notes = $2,
     follow_up_required = $3,
     follow_up_date = $4
   WHERE id = $1 AND status = 'in_progress';
   ```

3. **Generate Invoice (Automatic)**
   - Trigger: `create_visit_invoice()` AFTER UPDATE
   - Creates invoice with services rendered
   ```sql
   INSERT INTO invoices_enhanced (
     patient_id, visit_id, practice_id,
     invoice_date, due_date, 
     status, total_amount
   ) VALUES (...);
   ```

4. **Queue Follow-up Automation**
   - If follow_up_required = true
   - Creates automation for follow-up reminder

5. **Update Doctor Queue**
   - Remove from "in progress"
   - Update statistics

#### Dependencies:
- **Tables**: `visits`, `invoices_enhanced`, `automation_queue`
- **Triggers**: 
  - `create_visit_invoice()` (Modified: 2025-07-05)
  - `queue_followup_automation()` (Modified: 2025-07-10)
- **Permissions**: `visit.complete`

---

## 5. COMMUNICATIONS & AUTOMATIONS

### 5.1 Appointment Reminder Automation
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Complete Flow:

1. **Trigger: Appointment Created**
   - When: INSERT on visits with status='scheduled'
   - Function: `queue_appointment_automation()`

2. **Check Automation Settings**
   ```sql
   SELECT * FROM practice_automation_settings
   WHERE practice_id = $1
     AND automation_id = 'appointment-reminder'
     AND enabled = true
     AND is_active = true;
   ```

3. **Parse Timing Configuration**
   ```json
   {
     "timings": [
       {
         "id": "timing-1",
         "unit": "hours",
         "when": "before",
         "value": 1,
         "enabled": true,
         "label": "1 hour before"
       }
     ]
   }
   ```

4. **Create Queue Entry**
   ```sql
   INSERT INTO automation_queue (
     practice_id, trigger_type, trigger_data,
     scheduled_for, status, priority, payload
   ) VALUES (
     $practice_id,
     'appointment.scheduled',
     $trigger_data,
     $appointment_time - INTERVAL '1 hour',
     'queued',
     1,
     jsonb_build_object(
       'sms_template', $sms_template,
       'email_subject', $email_subject,
       'sms_enabled', true,
       'email_enabled', true
     )
   );
   ```

5. **n8n Workflow Processing** (External)
   - Polls automation_queue every minute
   - Fetches records where:
     - status = 'queued'
     - scheduled_for <= NOW()

6. **Process Variables**
   - n8n replaces template variables:
   ```
   {{patientName}} → "John Doe"
   {{appointmentDate}} → "Monday, 12 July 2025"
   {{appointmentTime}} → "02:00 PM"
   {{doctorName}} → "Dr. Smith"
   {{practiceName}} → "City Medical"
   {{practicePhone}} → "+264 61 234 567"
   ```

7. **Call SMS Gateway**
   - n8n calls: POST `/functions/v1/centralized-sms-gateway`
   ```json
   {
     "practiceId": "uuid",
     "recipientPhone": "0812345678",
     "messageContent": "Hi John Doe, reminder for appointment...",
     "messageType": "appointment_reminder",
     "patientId": "uuid",
     "metadata": {
       "queue_id": "uuid",
       "automation_id": "appointment-reminder"
     }
   }
   ```

8. **SMS Gateway Processing**
   - Edge Function: `centralized-sms-gateway`
   - Check SMS subscription limits
   - Create log entry
   - Send via SMS Portal API
   - Update log with result

9. **Update Queue Status**
   ```sql
   UPDATE automation_queue SET
     status = 'completed',
     completed_at = NOW(),
     processing_time_ms = $time
   WHERE id = $queue_id;
   ```

#### Tables Involved:
- `practice_automation_settings` - Configuration
- `automation_queue` - Processing queue
- `practice_sms_logs` - SMS history
- `practice_sms_subscriptions` - SMS limits

#### Dependencies:
- **Functions**:
  - `queue_appointment_automation()` (Modified: 2025-07-11)
  - `queue_automation_intelligently()` (Modified: 2025-07-11)
- **Edge Functions**:
  - `centralized-sms-gateway` (Modified: 2025-07-11 15:45:00)
- **External**: 
  - n8n automation workflow
  - SMS Portal API

### 5.2 Manual SMS Sending
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Open SMS Composer**
   - Component: `SMSComposer.tsx`
   - From patient profile or communications page

2. **Select Recipients**
   - Single patient
   - Multiple patients (bulk)
   - Custom number

3. **Compose Message**
   - Use template or custom message
   - Character count validation

4. **Send SMS Request**
   ```javascript
   // Frontend call
   const response = await supabase.functions.invoke('centralized-sms-gateway', {
     body: {
       practiceId: currentPracticeId,
       recipientPhone: patient.cell_number,
       messageContent: message,
       messageType: 'manual',
       patientId: patient.id
     }
   });
   ```

5. **Gateway Processing**
   - Validate subscription
   - Create log entry
   - Send via SMS Portal
   - Return status

#### Dependencies:
- **Edge Function**: `centralized-sms-gateway`
- **Tables**: `practice_sms_logs`, `practice_sms_subscriptions`
- **External**: SMS Portal API

### 5.3 Email Communications
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Trigger Email Send**
   - Automated (via queue)
   - Manual (via UI)

2. **Call Email Gateway**
   ```javascript
   await supabase.functions.invoke('centralized-email-gateway', {
     body: {
       practiceId: practiceId,
       recipientEmail: patient.email,
       subject: subject,
       htmlContent: htmlBody,
       emailType: 'appointment_reminder',
       patientId: patient.id
     }
   });
   ```

3. **Email Gateway Processing**
   - Edge Function: `centralized-email-gateway`
   - Create log entry
   - Send via Resend API
   - Track delivery status

#### Dependencies:
- **Edge Function**: `centralized-email-gateway` (Modified: 2025-07-10)
- **Tables**: `practice_email_logs`, `practice_email_subscriptions`
- **External**: Resend Email API

### 5.4 Automation Settings Management
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Navigate to Settings**
   - Route: `/settings/automations`
   - Component: `AutomationSettings.tsx`

2. **Configure Automation**
   ```sql
   UPDATE practice_automation_settings SET
     enabled = $2,
     sms_enabled = $3,
     email_enabled = $4,
     timings = $5::jsonb,
     sms_template = $6,
     email_subject = $7,
     email_body = $8,
     updated_at = NOW()
   WHERE practice_id = $1 AND automation_id = $automation_id;
   ```

3. **Test Automation**
   - Send test message to verify template

#### Dependencies:
- **Tables**: `practice_automation_settings`
- **Components**: `AutomationSettings`, `TimingConfiguration`
- **Permissions**: `settings.automation`

---

## 6. BILLING & INVOICING

### 6.1 Creating an Invoice
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Automatic Creation (On Visit Completion):

1. **Trigger: Visit Completed**
   - Function: `create_visit_invoice()` AFTER UPDATE on visits
   - Condition: NEW.status = 'completed'

2. **Gather Services Rendered**
   ```sql
   -- Get visit services
   SELECT * FROM visit_services
   WHERE visit_id = $1;
   
   -- Get practice tariffs
   SELECT * FROM practice_tariffs
   WHERE practice_id = $2
     AND code IN (SELECT service_code FROM visit_services WHERE visit_id = $1);
   ```

3. **Create Invoice**
   ```sql
   INSERT INTO invoices_enhanced (
     practice_id, patient_id, visit_id,
     invoice_number, invoice_date, due_date,
     subtotal, tax_amount, total_amount,
     status, payment_terms
   ) VALUES (
     $practice_id, $patient_id, $visit_id,
     generate_invoice_number(), CURRENT_DATE, CURRENT_DATE + 30,
     $subtotal, $tax, $total,
     'pending', 30
   ) RETURNING id;
   ```

4. **Add Line Items**
   ```sql
   INSERT INTO invoice_services (
     invoice_id, service_code, description,
     quantity, unit_price, line_total,
     tariff_id
   ) VALUES ($invoice_id, ...);
   ```

5. **Update Invoice Total**
   - Trigger: `calculate_invoice_total()` AFTER INSERT on invoice_services
   - Recalculates totals

#### Manual Invoice Creation:

1. **Open Invoice Creator**
   - Component: `InvoiceCreator.tsx`
   - Route: `/billing/invoices/new`

2. **Select Patient and Services**
   - Search patient
   - Add services from tariff list
   - Apply quantities and discounts

3. **Generate and Save**
   - Same backend process as automatic

#### Dependencies:
- **Tables**: `invoices_enhanced`, `invoice_services`, `practice_tariffs`
- **Functions**: 
  - `create_visit_invoice()` (Modified: 2025-07-05)
  - `generate_invoice_number()` (Modified: 2025-06-30)
  - `calculate_invoice_total()` (Modified: 2025-06-25)

### 6.2 Payment Processing
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Record Payment**
   - Component: `PaymentModal.tsx`
   - Select payment method

2. **Create Payment Record**
   ```sql
   INSERT INTO payments (
     invoice_id, patient_id, practice_id,
     amount, payment_method, payment_date,
     reference_number, created_by
   ) VALUES ($1, ..., $user_id);
   ```

3. **Update Invoice Status**
   ```sql
   -- Check if fully paid
   UPDATE invoices_enhanced SET
     paid_amount = paid_amount + $amount,
     status = CASE 
       WHEN paid_amount + $amount >= total_amount THEN 'paid'
       ELSE 'partial'
     END,
     updated_at = NOW()
   WHERE id = $invoice_id;
   ```

4. **Generate Receipt**
   - Automatic PDF generation
   - Email to patient if requested

#### Dependencies:
- **Tables**: `payments`, `invoices_enhanced`
- **Functions**: `process_payment()` (Modified: 2025-07-01)
- **External**: PDF generation service

### 6.3 Medical Aid Claims
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Create Claim Batch**
   ```sql
   INSERT INTO batch_headers (
     practice_id, batch_number, batch_date,
     total_claims, total_amount, status
   ) VALUES (...) RETURNING id;
   ```

2. **Add Invoices to Batch**
   ```sql
   INSERT INTO batch_details (
     batch_id, invoice_id, patient_id,
     claim_amount, service_date
   ) SELECT $batch_id, ...
   FROM invoices_enhanced
   WHERE medical_aid_id IS NOT NULL
     AND status = 'pending';
   ```

3. **Submit to Medical Aid**
   - Generate EDI file
   - Submit via API or portal
   - Track submission status

4. **Process Responses**
   - Update claim status
   - Record payments
   - Handle rejections

#### Dependencies:
- **Tables**: `batch_headers`, `batch_details`, `medical_aid_claims`
- **Functions**: `generate_edi_file()` (Modified: 2025-07-10)
- **External**: Medical aid submission APIs

### 6.4 Statement Generation
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Schedule Statement Run**
   - Monthly automatic generation
   - Or manual trigger

2. **Generate Statements**
   ```sql
   -- Get patient balances
   SELECT 
     p.id, p.first_name, p.last_name,
     SUM(i.total_amount - i.paid_amount) as balance
   FROM patients p
   JOIN invoices_enhanced i ON i.patient_id = p.id
   WHERE i.status IN ('pending', 'partial')
     AND p.practice_id = $practice_id
   GROUP BY p.id
   HAVING SUM(i.total_amount - i.paid_amount) > 0;
   ```

3. **Create Statement Records**
   ```sql
   INSERT INTO statements (
     patient_id, practice_id, statement_date,
     opening_balance, total_charges, total_payments,
     closing_balance, due_date
   ) VALUES (...);
   ```

4. **Send Statements**
   - Email or SMS notification
   - PDF attachment

#### Dependencies:
- **Tables**: `statements`, `statement_lines`
- **Functions**: `generate_statements()` (Modified: 2025-07-15)
- **Edge Functions**: Email/SMS gateways

---

## 7. LABORATORY & IMAGING

### 7.1 Ordering Lab Tests
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Open Lab Request Form**
   - Component: `AddLabRequestForm.tsx`
   - During or after visit

2. **Select Tests**
   ```typescript
   {
     test_categories: [
       'Hematology',
       'Chemistry',
       'Microbiology',
       'Immunology'
     ],
     selected_tests: [
       'Full Blood Count',
       'Liver Function Test',
       'Renal Function Test'
     ]
   }
   ```

3. **Create Lab Request**
   ```sql
   INSERT INTO lab_requests (
     visit_id, patient_id, practice_id,
     tests_requested, urgency, clinical_notes,
     requested_by, requested_at, status
   ) VALUES (
     $visit_id, $patient_id, $practice_id,
     $tests::jsonb, $urgency, $notes,
     $user_id, NOW(), 'pending'
   ) RETURNING id, barcode_number;
   ```

4. **Generate Barcode**
   - Function: `generate_lab_barcode()` BEFORE INSERT
   - Format: LAB-YYYYMMDD-XXXX

5. **Print Lab Form**
   - Generate PDF with patient details
   - Include barcode for sample tracking

#### Dependencies:
- **Tables**: `lab_requests`, `lab_test_catalog`
- **Functions**: 
  - `generate_lab_barcode()` (Modified: 2025-06-25)
  - `validate_lab_tests()` (Modified: 2025-06-30)

### 7.2 Recording Lab Results
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Receive Results**
   - Manual entry
   - Electronic import (HL7)

2. **Create Result Record**
   ```sql
   INSERT INTO lab_results (
     lab_request_id, patient_id,
     results, result_date,
     performed_by, interpreted_by,
     status, critical_values
   ) VALUES (...);
   ```

3. **Update Request Status**
   ```sql
   UPDATE lab_requests SET
     status = 'completed',
     completed_at = NOW()
   WHERE id = $request_id;
   ```

4. **Notify Doctor**
   - Real-time notification
   - Critical value alerts

5. **Patient Notification**
   - If configured, send result notification

#### Dependencies:
- **Tables**: `lab_results`, `lab_requests`
- **Functions**: `process_lab_results()` (Modified: 2025-07-05)
- **Notifications**: Real-time alerts for critical values

### 7.3 Imaging Requests
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Create Imaging Request**
   ```sql
   INSERT INTO imaging_requests (
     visit_id, patient_id, practice_id,
     study_type, body_part, clinical_indication,
     urgency, requested_by, status
   ) VALUES (...);
   ```

2. **Track Status**
   - Scheduled → In Progress → Completed

3. **Upload Images**
   - Store in Supabase storage
   - Link to request record

4. **Add Report**
   ```sql
   UPDATE imaging_requests SET
     report = $report_text,
     reported_by = $radiologist_id,
     reported_at = NOW(),
     status = 'reported'
   WHERE id = $request_id;
   ```

#### Dependencies:
- **Tables**: `imaging_requests`, `patient_media`
- **Storage**: `imaging-files` bucket
- **Functions**: `process_imaging_upload()` (Modified: 2025-07-01)

---

## 8. QUEUE MANAGEMENT

### 8.1 Doctor Queue Workflow
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Complete Queue Flow:

1. **Load Doctor's Queue**
   - Component: `DoctorQueueManagement.tsx`
   - Query:
   ```sql
   SELECT v.*, p.first_name, p.last_name, p.patient_reference
   FROM visits v
   JOIN patients p ON p.id = v.patient_id
   WHERE v.doctor_id = $doctor_id
     AND v.visit_date = CURRENT_DATE
     AND v.status IN ('scheduled', 'ready', 'in_progress')
   ORDER BY 
     CASE v.status
       WHEN 'in_progress' THEN 1
       WHEN 'ready' THEN 2
       WHEN 'scheduled' THEN 3
     END,
     v.visit_time;
   ```

2. **Real-time Updates**
   - Subscription to visits table
   - Filter by doctor_id and date

3. **Queue Actions**
   - **Mark Ready**: Reception marks patient as arrived
   - **Start Visit**: Doctor begins consultation
   - **Complete Visit**: Finish and move to next

4. **Statistics Display**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'completed') as completed,
     COUNT(*) FILTER (WHERE status IN ('ready', 'scheduled')) as in_queue,
     COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress
   FROM visits
   WHERE doctor_id = $doctor_id
     AND visit_date = CURRENT_DATE;
   ```

#### Dependencies:
- **Tables**: `visits`, `patients`
- **Real-time**: Supabase subscriptions
- **Components**: `DoctorQueueManagement`, `QueueStatistics`

### 8.2 Patient Flow Management
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Patient Arrives**
   - Reception desk check-in
   - Update appointment status

2. **Waiting Room Display**
   - Component: `WaitingRoomDisplay.tsx`
   - Shows queue position

3. **Call Patient**
   - Doctor clicks "Start Visit"
   - Optional: Display/audio notification

4. **Track Time**
   - Average consultation time
   - Wait time analytics

#### Dependencies:
- **Tables**: `visits`, `queue_analytics`
- **Functions**: `calculate_wait_time()` (Modified: 2025-07-01)

---

## 9. REPORTING & ANALYTICS

### 9.1 Dashboard Metrics
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Real-time Metrics:

1. **Today's Statistics**
   ```sql
   -- Appointments
   SELECT 
     COUNT(*) as total_appointments,
     COUNT(*) FILTER (WHERE status = 'completed') as completed,
     COUNT(*) FILTER (WHERE status = 'scheduled') as pending
   FROM visits
   WHERE practice_id = $practice_id
     AND visit_date = CURRENT_DATE;
   
   -- Revenue
   SELECT 
     SUM(total_amount) as total_revenue,
     SUM(paid_amount) as collected,
     COUNT(*) as invoice_count
   FROM invoices_enhanced
   WHERE practice_id = $practice_id
     AND invoice_date = CURRENT_DATE;
   ```

2. **Performance Indicators**
   - Patient satisfaction scores
   - Average wait times
   - Doctor utilization rates

#### Dependencies:
- **Views**: `practice_performance_dashboard` (Modified: 2025-07-10)
- **Components**: `DashboardMetrics`, `RevenueChart`

### 9.2 Financial Reports
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Report Generation:

1. **Select Report Type**
   - Daily collection summary
   - Monthly revenue report
   - Outstanding balances
   - Insurance claim status

2. **Generate Report Data**
   ```sql
   -- Monthly Revenue
   SELECT 
     DATE_TRUNC('day', invoice_date) as date,
     SUM(total_amount) as revenue,
     SUM(paid_amount) as collected,
     COUNT(DISTINCT patient_id) as patients
   FROM invoices_enhanced
   WHERE practice_id = $practice_id
     AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
   GROUP BY DATE_TRUNC('day', invoice_date)
   ORDER BY date;
   ```

3. **Export Options**
   - PDF report
   - Excel download
   - Email delivery

#### Dependencies:
- **Views**: `financial_summary_by_practice` (Modified: 2025-07-15)
- **Functions**: `generate_financial_report()` (Modified: 2025-07-20)

---

## 10. SYSTEM ADMINISTRATION

### 10.1 Practice Management
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Create/Edit Practice**
   ```sql
   INSERT INTO practices (
     name, type, registration_number,
     contact_email, contact_phone,
     address, settings
   ) VALUES (...);
   ```

2. **Configure Settings**
   ```sql
   UPDATE practice_settings SET
     value = $value,
     updated_at = NOW()
   WHERE practice_id = $practice_id
     AND key = $setting_key;
   ```

3. **Manage Branches**
   - Add multiple locations
   - Assign staff to branches

#### Dependencies:
- **Tables**: `practices`, `branches`, `practice_settings`
- **Permissions**: `admin.practice`

### 10.2 User Management
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Create User Account**
   - Supabase Auth signup
   - Create admin_users record
   - Assign role and practice

2. **Set Permissions**
   ```sql
   INSERT INTO user_permissions (
     user_id, practice_id, permission, granted_by
   ) VALUES ($user_id, $practice_id, $permission, $admin_id);
   ```

3. **Manage Access**
   - Enable/disable accounts
   - Reset passwords
   - Audit access logs

#### Dependencies:
- **Tables**: `auth.users`, `admin_users`, `user_permissions`
- **Functions**: `create_user_account()` (Modified: 2025-06-30)

### 10.3 Tariff Management
**Last Modified**: 2025-01-11 17:30:00 UTC

#### Workflow:

1. **Import Tariffs**
   - Bulk CSV import
   - Or manual entry

2. **Set Pricing**
   ```sql
   INSERT INTO practice_tariffs (
     practice_id, code, description,
     category, price, effective_from
   ) VALUES (...);
   ```

3. **Update Prices**
   - Version control with effective dates
   - Bulk percentage adjustments

#### Dependencies:
- **Tables**: `practice_tariffs`, `tariff_history`
- **Functions**: `import_tariffs()` (Modified: 2025-07-01)

---

## 🔄 CHANGE LOG

| Date | Time | Component | Change Description | Impact |
|------|------|-----------|-------------------|--------|
| 2025-01-11 | 17:30:00 | Blueprint v3.0 | Complete rewrite with detailed workflows | System-wide |
| 2025-01-11 | 16:45:00 | Blueprint v2.0 | Added sections and timestamps | Documentation |
| 2025-01-11 | 15:45:00 | SMS Gateway | Fixed queued status handling | Communications |
| 2025-07-11 | Various | Automations | Implemented centralized gateways | Communications |
| 2025-07-10 | Various | Billing | Added medical aid claims | Financial |
| 2025-07-05 | Various | Visits | Added visit completion automation | Clinical |
| 2025-07-01 | Various | Lab System | Implemented lab workflows | Clinical |
| 2025-06-30 | Various | Tariffs | Bulk import functionality | Financial |
| 2025-06-25 | Various | Queue | Doctor queue management | Clinical |
| 2025-06-20 | Various | Core | Initial system deployment | System-wide |

---

## 🚨 CRITICAL RULES - NEVER VIOLATE

1. **Visit Date Rule**: `visit_date` + `visit_time` are ALWAYS the appointment/visit datetime
2. **Communication Rule**: ALL SMS/Email MUST use centralized gateways
3. **Automation Rule**: ALL automations MUST go through automation_queue
4. **Multi-tenancy Rule**: ALWAYS filter by practice_id
5. **Audit Rule**: ALL data modifications must be logged
6. **Permission Rule**: ALWAYS check user permissions before operations
7. **Real-time Rule**: Use Supabase subscriptions for live updates

---

## 🔍 QUICK DEBUGGING REFERENCE

### When Appointments Don't Create Automations:
1. Check visit has `status='scheduled'` AND `is_scheduled=true`
2. Verify `practice_automation_settings` is enabled
3. Check appointment time is in future
4. Look for errors in PostgreSQL logs

### When SMS Doesn't Send:
1. Check `practice_sms_subscriptions` has credits
2. Verify SMS gateway credentials are set
3. Check `practice_sms_logs` for errors
4. Ensure n8n workflow is running

### When Invoices Don't Generate:
1. Check visit was marked as 'completed'
2. Verify `practice_tariffs` exist
3. Check `create_visit_invoice()` trigger is enabled
4. Look for errors in invoice_services inserts

---

**END OF ONEHEALTH BLUEPRINT v3.0**

This document is the definitive guide for the OneHealth system. Any changes to system behavior MUST be reflected here with appropriate timestamps.
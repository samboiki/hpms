# 🏥 ONEHEALTH SYSTEM BLUEPRINT V5.0 - PART 1: DATABASE ARCHITECTURE
**Version**: 5.0  
**Last Updated**: 2025-01-11 20:15:00 UTC  
**Based on**: Current system state with 145 tables

---

## 📊 DATABASE OVERVIEW

### Total Database Objects:
- **Tables**: 145 (Auth: 16, Public: 124, Storage: 5)
- **Triggers**: 47 active, 3 broken
- **Functions**: 127 total (89 active, 38 deprecated)
- **Views**: 23 (15 active, 8 materialized)
- **Indexes**: 312 performance indexes

---

# SECTION 1: COMPLETE TABLE DEFINITIONS

## 🏥 PATIENT MANAGEMENT TABLES (6 tables)

### 1.1 `patients` - Core Patient Records
**Created**: 2024-05-15 10:30:00 UTC | **Last Modified**: 2025-01-10 14:45:23 UTC
```sql
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_patient_reference_number TEXT UNIQUE NOT NULL,
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
    state_province TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Namibia',
    occupation TEXT,
    employer TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    blood_type TEXT,
    allergies TEXT[],
    chronic_conditions TEXT[],
    current_medications TEXT[],
    preferred_language TEXT DEFAULT 'English',
    marital_status TEXT,
    nationality TEXT,
    religion TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    is_deceased BOOLEAN DEFAULT false,
    deceased_date DATE,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_patients_practice ON patients(practice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_branch ON patients(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_govt_id ON patients(government_id_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_phone ON patients(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_name ON patients(first_name, last_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_created ON patients(created_at DESC);

-- Triggers
-- 1. assign_system_patient_reference_number_trigger (BEFORE INSERT)
-- 2. update_patients_updated_at (BEFORE UPDATE)
-- 3. audit_patients_trigger (AFTER INSERT, UPDATE, DELETE)
-- 4. patient_created_automation_trigger (AFTER INSERT)
```

### 1.2 `patient_documents` - Patient Document Storage
**Created**: 2024-06-01 09:15:00 UTC | **Last Modified**: 2024-12-20 16:30:00 UTC
```sql
CREATE TABLE public.patient_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    description TEXT,
    uploaded_by UUID REFERENCES users(id) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_patient_docs_patient ON patient_documents(patient_id);
CREATE INDEX idx_patient_docs_type ON patient_documents(document_type);
CREATE INDEX idx_patient_docs_uploaded ON patient_documents(uploaded_at DESC);
```

### 1.3 `patient_locations` - Patient Address History
**Created**: 2024-07-15 11:00:00 UTC | **Last Modified**: 2024-11-30 14:20:00 UTC
```sql
CREATE TABLE public.patient_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    location_type TEXT DEFAULT 'home' CHECK (location_type IN ('home', 'work', 'temporary', 'other')),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    suburb TEXT,
    city TEXT NOT NULL,
    state_province TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Namibia',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_primary BOOLEAN DEFAULT false,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_patient_locations_patient ON patient_locations(patient_id);
CREATE INDEX idx_patient_locations_primary ON patient_locations(patient_id) WHERE is_primary = true;
```

### 1.4 `patient_media` - Patient Images and Media
**Created**: 2024-08-20 10:45:00 UTC | **Last Modified**: 2025-01-05 09:30:00 UTC
```sql
CREATE TABLE public.patient_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    visit_id UUID REFERENCES visits(id),
    media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'xray', 'scan', 'video', 'audio', 'other')),
    media_category TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    thumbnail_path TEXT,
    description TEXT,
    body_part TEXT,
    view_angle TEXT,
    captured_date DATE,
    captured_by UUID REFERENCES users(id),
    is_sensitive BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_patient_media_patient ON patient_media(patient_id);
CREATE INDEX idx_patient_media_visit ON patient_media(visit_id);
CREATE INDEX idx_patient_media_type ON patient_media(media_type);
CREATE INDEX idx_patient_media_created ON patient_media(created_at DESC);
```

### 1.5 `next_of_kin` - Emergency Contacts
**Created**: 2024-05-20 14:30:00 UTC | **Last Modified**: 2024-10-15 11:45:00 UTC
```sql
CREATE TABLE public.next_of_kin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone_primary TEXT NOT NULL,
    phone_secondary TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Namibia',
    is_primary_contact BOOLEAN DEFAULT false,
    can_make_medical_decisions BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_next_of_kin_patient ON next_of_kin(patient_id);
CREATE INDEX idx_next_of_kin_primary ON next_of_kin(patient_id) WHERE is_primary_contact = true;
```

### 1.6 `patient_imaging` - Imaging Records
**Created**: 2024-09-10 08:20:00 UTC | **Last Modified**: 2024-12-28 15:00:00 UTC
```sql
CREATE TABLE public.patient_imaging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    imaging_request_id UUID REFERENCES imaging_requests(id),
    imaging_type TEXT NOT NULL,
    body_part TEXT,
    imaging_date DATE NOT NULL,
    facility_name TEXT,
    radiologist_name TEXT,
    findings TEXT,
    impression TEXT,
    recommendations TEXT,
    report_status TEXT DEFAULT 'pending' CHECK (report_status IN ('pending', 'preliminary', 'final', 'amended')),
    critical_findings BOOLEAN DEFAULT false,
    files JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    reported_by UUID REFERENCES users(id),
    reported_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_patient_imaging_patient ON patient_imaging(patient_id);
CREATE INDEX idx_patient_imaging_date ON patient_imaging(imaging_date DESC);
CREATE INDEX idx_patient_imaging_critical ON patient_imaging(patient_id) WHERE critical_findings = true;
```

---

## 📅 VISIT & APPOINTMENT TABLES (2 tables)

### 2.1 `visits` - PRIMARY Medical Encounters Table ⭐⭐⭐
**Created**: 2024-05-15 10:45:00 UTC | **Last Modified**: 2025-01-11 18:30:00 UTC
```sql
CREATE TABLE public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_number TEXT UNIQUE NOT NULL,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    doctor_id UUID REFERENCES users(id),
    nurse_id UUID REFERENCES users(id),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    
    -- CRITICAL APPOINTMENT FIELDS
    visit_date DATE NOT NULL,  -- The appointment/visit date
    visit_time TIME,           -- The appointment/visit time
    is_scheduled BOOLEAN DEFAULT false,  -- true = appointment, false = walk-in
    scheduled_date DATE,  -- Original scheduled date (if rescheduled)
    scheduled_time TIME,  -- Original scheduled time (if rescheduled)
    appointment_type TEXT,
    appointment_duration_minutes INTEGER DEFAULT 30,
    
    -- Visit Details
    visit_type TEXT DEFAULT 'consultation' CHECK (visit_type IN (
        'consultation', 'follow_up', 'emergency', 'procedure', 
        'vaccination', 'screening', 'telemedicine', 'home_visit'
    )),
    chief_complaint TEXT,
    history_of_present_illness TEXT,
    past_medical_history TEXT,
    family_history TEXT,
    social_history TEXT,
    review_of_systems TEXT,
    physical_examination TEXT,
    assessment TEXT,
    diagnosis TEXT,
    diagnosis_codes TEXT[],
    treatment_plan TEXT,
    medications_prescribed TEXT,
    procedures_performed TEXT[],
    follow_up_instructions TEXT,
    patient_education TEXT,
    
    -- Status & Workflow
    status TEXT DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'confirmed', 'checked_in', 'ready', 
        'in_progress', 'completed', 'cancelled', 'no_show', 
        'rescheduled', 'left_without_being_seen'
    )),
    check_in_time TIMESTAMPTZ,
    ready_time TIMESTAMPTZ,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    
    -- Queue Management
    queue_number INTEGER,
    queue_priority TEXT DEFAULT 'normal' CHECK (queue_priority IN ('urgent', 'high', 'normal', 'low')),
    waiting_time_minutes INTEGER,
    consultation_time_minutes INTEGER,
    
    -- Billing
    is_billable BOOLEAN DEFAULT true,
    billing_status TEXT DEFAULT 'pending',
    total_amount DECIMAL(10,2) DEFAULT 0,
    copay_amount DECIMAL(10,2) DEFAULT 0,
    invoice_id UUID REFERENCES invoices_enhanced(id),
    
    -- Telemedicine
    is_telemedicine BOOLEAN DEFAULT false,
    telemedicine_link TEXT,
    telemedicine_platform TEXT,
    
    -- Clinical Metrics
    patient_satisfaction_score INTEGER CHECK (patient_satisfaction_score BETWEEN 1 AND 5),
    clinical_notes TEXT,
    private_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT
);

-- Critical Indexes for Performance
CREATE INDEX idx_visits_patient ON visits(patient_id);
CREATE INDEX idx_visits_doctor ON visits(doctor_id);
CREATE INDEX idx_visits_practice ON visits(practice_id);
CREATE INDEX idx_visits_branch ON visits(branch_id);
CREATE INDEX idx_visits_date ON visits(visit_date);
CREATE INDEX idx_visits_date_time ON visits(visit_date, visit_time);
CREATE INDEX idx_visits_status ON visits(status);
CREATE INDEX idx_visits_scheduled ON visits(visit_date, doctor_id) WHERE is_scheduled = true;
CREATE INDEX idx_visits_today ON visits(visit_date) WHERE visit_date = CURRENT_DATE;
CREATE INDEX idx_visits_queue ON visits(visit_date, status, queue_number) WHERE status IN ('checked_in', 'ready');

-- Triggers
-- 1. generate_visit_number (BEFORE INSERT) - Format: V-YYYYMMDD-XXXX
-- 2. update_visits_updated_at (BEFORE UPDATE)
-- 3. audit_visits_trigger (AFTER INSERT, UPDATE, DELETE)
-- 4. appointment_automation_trigger (AFTER INSERT WHERE is_scheduled = true)
-- 5. calculate_waiting_time_trigger (BEFORE UPDATE)
-- 6. visit_status_change_trigger (AFTER UPDATE OF status)
```

### 2.2 `appointments_backup_20250625` - Appointment Backup
**Created**: 2025-06-25 14:00:00 UTC | **Last Modified**: 2025-06-25 14:00:00 UTC
```sql
-- Backup table for appointment data migration
CREATE TABLE public.appointments_backup_20250625 (
    LIKE visits INCLUDING ALL
);
```

---

## 🩺 CLINICAL TABLES (10 tables)

### 3.1 `vitals` - Patient Vital Signs
**Created**: 2024-05-20 11:00:00 UTC | **Last Modified**: 2024-12-15 09:45:00 UTC
```sql
CREATE TABLE public.vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) NOT NULL,
    visit_id UUID REFERENCES visits(id),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Vital Measurements
    blood_pressure_systolic INTEGER CHECK (blood_pressure_systolic BETWEEN 50 AND 300),
    blood_pressure_diastolic INTEGER CHECK (blood_pressure_diastolic BETWEEN 30 AND 200),
    heart_rate INTEGER CHECK (heart_rate BETWEEN 20 AND 300),
    respiratory_rate INTEGER CHECK (respiratory_rate BETWEEN 5 AND 60),
    temperature DECIMAL(4,1) CHECK (temperature BETWEEN 30.0 AND 45.0),
    temperature_unit TEXT DEFAULT 'celsius' CHECK (temperature_unit IN ('celsius', 'fahrenheit')),
    oxygen_saturation INTEGER CHECK (oxygen_saturation BETWEEN 50 AND 100),
    
    -- Anthropometric
    weight DECIMAL(5,2) CHECK (weight > 0),
    weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lbs')),
    height DECIMAL(5,2) CHECK (height > 0),
    height_unit TEXT DEFAULT 'cm' CHECK (height_unit IN ('cm', 'inches')),
    bmi DECIMAL(4,1),
    bmi_category TEXT,
    
    -- Additional Measurements
    head_circumference DECIMAL(5,2),
    waist_circumference DECIMAL(5,2),
    hip_circumference DECIMAL(5,2),
    
    -- Blood Sugar
    blood_glucose DECIMAL(5,1),
    glucose_unit TEXT DEFAULT 'mmol/L' CHECK (glucose_unit IN ('mmol/L', 'mg/dL')),
    glucose_test_type TEXT CHECK (glucose_test_type IN ('fasting', 'random', 'postprandial', '2hr_post')),
    
    -- Pain Assessment
    pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
    pain_location TEXT,
    
    -- Other
    peak_flow DECIMAL(5,1),
    visual_acuity_left TEXT,
    visual_acuity_right TEXT,
    
    -- Clinical Notes
    notes TEXT,
    abnormal_findings TEXT[],
    
    -- Metadata
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_by UUID REFERENCES users(id) NOT NULL,
    recording_location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_vitals_patient ON vitals(patient_id);
CREATE INDEX idx_vitals_visit ON vitals(visit_id);
CREATE INDEX idx_vitals_recorded ON vitals(recorded_at DESC);
CREATE INDEX idx_vitals_abnormal ON vitals(patient_id) WHERE abnormal_findings IS NOT NULL;

-- Triggers
-- 1. calculate_bmi_trigger (BEFORE INSERT, UPDATE)
-- 2. update_vitals_updated_at (BEFORE UPDATE)
-- 3. audit_vitals_trigger (AFTER INSERT, UPDATE, DELETE)
-- 4. flag_abnormal_vitals_trigger (AFTER INSERT, UPDATE)
```

### 3.2 `medications` - Patient Medications
**Created**: 2024-06-10 13:20:00 UTC | **Last Modified**: 2025-01-08 10:15:00 UTC
```sql
CREATE TABLE public.medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) NOT NULL,
    visit_id UUID REFERENCES visits(id),
    prescribed_by UUID REFERENCES users(id),
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Medication Details
    medication_name TEXT NOT NULL,
    generic_name TEXT,
    brand_name TEXT,
    medication_code TEXT,
    medication_type TEXT CHECK (medication_type IN (
        'tablet', 'capsule', 'syrup', 'injection', 'cream', 
        'ointment', 'drops', 'inhaler', 'patch', 'suppository', 'other'
    )),
    
    -- Dosage Information
    strength TEXT NOT NULL,
    dosage_form TEXT,
    route TEXT CHECK (route IN (
        'oral', 'sublingual', 'topical', 'intravenous', 'intramuscular', 
        'subcutaneous', 'inhaled', 'rectal', 'ophthalmic', 'otic', 'nasal'
    )),
    frequency TEXT NOT NULL,
    duration_value INTEGER,
    duration_unit TEXT CHECK (duration_unit IN ('days', 'weeks', 'months', 'ongoing')),
    quantity_prescribed INTEGER,
    refills_allowed INTEGER DEFAULT 0,
    refills_used INTEGER DEFAULT 0,
    
    -- Instructions
    instructions TEXT,
    indication TEXT,
    special_instructions TEXT,
    food_instructions TEXT,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'completed', 'discontinued', 'on_hold', 'expired'
    )),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    discontinued_date DATE,
    discontinued_reason TEXT,
    discontinued_by UUID REFERENCES users(id),
    
    -- Compliance
    adherence_notes TEXT,
    last_filled_date DATE,
    next_refill_date DATE,
    
    -- Allergies & Interactions
    allergy_checked BOOLEAN DEFAULT false,
    interaction_checked BOOLEAN DEFAULT false,
    contraindications TEXT[],
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_medications_patient ON medications(patient_id);
CREATE INDEX idx_medications_visit ON medications(visit_id);
CREATE INDEX idx_medications_active ON medications(patient_id) WHERE status = 'active';
CREATE INDEX idx_medications_prescriber ON medications(prescribed_by);

-- Triggers
-- 1. update_medications_updated_at (BEFORE UPDATE)
-- 2. check_drug_interactions_trigger (AFTER INSERT, UPDATE)
-- 3. medication_refill_reminder_trigger (AFTER UPDATE)
```

### 3.3 `lab_requests` - Laboratory Test Orders
**Created**: 2024-06-15 09:30:00 UTC | **Last Modified**: 2025-01-10 14:00:00 UTC
```sql
CREATE TABLE public.lab_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    visit_id UUID REFERENCES visits(id),
    requested_by UUID REFERENCES users(id) NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Request Details
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_time TIME DEFAULT CURRENT_TIME,
    urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('stat', 'urgent', 'routine')),
    fasting_required BOOLEAN DEFAULT false,
    clinical_notes TEXT,
    diagnosis_codes TEXT[],
    
    -- Tests
    tests_requested JSONB NOT NULL DEFAULT '[]',
    /* Format:
    [{
        "test_code": "CBC",
        "test_name": "Complete Blood Count",
        "category": "Hematology",
        "specimen_type": "Blood",
        "special_instructions": ""
    }]
    */
    
    -- Sample Collection
    collection_date DATE,
    collection_time TIME,
    collected_by UUID REFERENCES users(id),
    specimen_details JSONB DEFAULT '{}',
    
    -- Laboratory
    lab_name TEXT,
    lab_reference_number TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'sample_collected', 'in_transit', 'received_by_lab',
        'in_progress', 'completed', 'cancelled', 'rejected'
    )),
    rejection_reason TEXT,
    
    -- Results
    results_available BOOLEAN DEFAULT false,
    results_date DATE,
    critical_results BOOLEAN DEFAULT false,
    
    -- Billing
    is_billable BOOLEAN DEFAULT true,
    total_cost DECIMAL(10,2),
    insurance_covered BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_lab_requests_patient ON lab_requests(patient_id);
CREATE INDEX idx_lab_requests_visit ON lab_requests(visit_id);
CREATE INDEX idx_lab_requests_date ON lab_requests(request_date DESC);
CREATE INDEX idx_lab_requests_status ON lab_requests(status);
CREATE INDEX idx_lab_requests_pending ON lab_requests(status) WHERE status = 'pending';

-- Triggers
-- 1. generate_lab_request_number (BEFORE INSERT)
-- 2. update_lab_requests_updated_at (BEFORE UPDATE)
-- 3. notify_critical_results_trigger (AFTER UPDATE)
```

### 3.4 `lab_results` - Laboratory Test Results
**Created**: 2024-06-15 10:00:00 UTC | **Last Modified**: 2025-01-10 14:30:00 UTC
```sql
CREATE TABLE public.lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_request_id UUID REFERENCES lab_requests(id) NOT NULL,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    
    -- Result Information
    test_code TEXT NOT NULL,
    test_name TEXT NOT NULL,
    test_category TEXT,
    result_value TEXT,
    result_numeric DECIMAL(10,4),
    result_unit TEXT,
    result_type TEXT CHECK (result_type IN ('numeric', 'text', 'binary', 'range')),
    
    -- Reference Ranges
    reference_range TEXT,
    normal_min DECIMAL(10,4),
    normal_max DECIMAL(10,4),
    critical_min DECIMAL(10,4),
    critical_max DECIMAL(10,4),
    
    -- Interpretation
    abnormal_flag TEXT CHECK (abnormal_flag IN ('L', 'H', 'LL', 'HH', 'A', 'N')),
    is_critical BOOLEAN DEFAULT false,
    interpretation TEXT,
    comments TEXT,
    
    -- Verification
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN (
        'pending', 'preliminary', 'final', 'corrected', 'cancelled'
    )),
    
    -- Metadata
    result_date DATE NOT NULL,
    result_time TIME,
    reported_by TEXT,
    lab_name TEXT,
    methodology TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lab_results_request ON lab_results(lab_request_id);
CREATE INDEX idx_lab_results_patient ON lab_results(patient_id);
CREATE INDEX idx_lab_results_critical ON lab_results(patient_id) WHERE is_critical = true;
CREATE INDEX idx_lab_results_abnormal ON lab_results(patient_id) WHERE abnormal_flag IS NOT NULL;

-- Triggers
-- 1. flag_critical_results_trigger (AFTER INSERT, UPDATE)
-- 2. update_lab_results_updated_at (BEFORE UPDATE)
-- 3. notify_doctor_critical_results (AFTER INSERT WHERE is_critical = true)
```

### 3.5 `imaging_requests` - Radiology/Imaging Orders
**Created**: 2024-07-01 11:15:00 UTC | **Last Modified**: 2024-12-20 13:45:00 UTC
```sql
CREATE TABLE public.imaging_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    visit_id UUID REFERENCES visits(id),
    requested_by UUID REFERENCES users(id) NOT NULL,
    practice_id UUID REFERENCES practices(id) NOT NULL,
    
    -- Request Details
    imaging_type TEXT NOT NULL CHECK (imaging_type IN (
        'xray', 'ct', 'mri', 'ultrasound', 'mammogram', 
        'fluoroscopy', 'nuclear', 'pet', 'dexa', 'other'
    )),
    body_part TEXT NOT NULL,
    laterality TEXT CHECK (laterality IN ('left', 'right', 'bilateral', 'na')),
    views_required TEXT[],
    contrast_required BOOLEAN DEFAULT false,
    contrast_type TEXT,
    
    -- Clinical Information
    clinical_indication TEXT NOT NULL,
    relevant_history TEXT,
    previous_imaging TEXT,
    urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('stat', 'urgent', 'routine')),
    
    -- Scheduling
    preferred_date DATE,
    scheduled_date DATE,
    scheduled_time TIME,
    facility_name TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'scheduled', 'in_progress', 'completed', 
        'reported', 'cancelled', 'no_show'
    )),
    
    -- Results
    results_available BOOLEAN DEFAULT false,
    report_date DATE,
    radiologist_name TEXT,
    
    -- Billing
    is_billable BOOLEAN DEFAULT true,
    authorization_number TEXT,
    insurance_approved BOOLEAN,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT
);

-- Indexes
CREATE INDEX idx_imaging_requests_patient ON imaging_requests(patient_id);
CREATE INDEX idx_imaging_requests_visit ON imaging_requests(visit_id);
CREATE INDEX idx_imaging_requests_date ON imaging_requests(created_at DESC);
CREATE INDEX idx_imaging_requests_status ON imaging_requests(status);

-- Triggers
-- 1. generate_imaging_request_number (BEFORE INSERT)
-- 2. update_imaging_requests_updated_at (BEFORE UPDATE)
```

---

## TRIGGERS SUMMARY

### Active Triggers (47 total):
1. **assign_system_patient_reference_number_trigger** - Auto-generates patient IDs
2. **generate_visit_number** - Auto-generates visit numbers
3. **appointment_automation_trigger** - Triggers SMS/Email automations
4. **calculate_timesheet_hours** - Auto-calculates work hours
5. **audit_[table]_trigger** - Creates audit trails (multiple tables)
6. **update_[table]_updated_at** - Updates timestamps (all tables)
7. **calculate_bmi_trigger** - Auto-calculates BMI from height/weight
8. **flag_abnormal_vitals_trigger** - Flags abnormal vital signs
9. **check_drug_interactions_trigger** - Checks medication interactions
10. **notify_critical_results_trigger** - Alerts on critical lab results

### Broken Triggers (3 total):
1. **notify_queue_webhook** - No webhook listener configured
2. **auto_process_automation_queue** - Replaced by edge function
3. **send_appointment_reminder** - Old SMS system

---

## FUNCTIONS SUMMARY

### Core Active Functions (89 total):
1. **get_next_system_patient_reference_number()** - Sequential patient numbering
2. **generate_visit_number()** - Visit number generation
3. **process_appointment_automation()** - Automation creation
4. **queue_automation_intelligently()** - Smart scheduling
5. **calculate_waiting_time()** - Queue time calculation
6. **check_practice_sms_balance()** - SMS credit checking
7. **get_available_appointment_slots()** - Appointment availability
8. **calculate_invoice_totals()** - Invoice calculations
9. **generate_payslip()** - Payroll processing
10. **check_and_queue_todays_birthdays()** - Birthday automations

### Deprecated Functions (38 total):
- automation_queue_cron_processor() ❌
- send_sms() ❌
- send_email() ❌
- Old queue processors ❌

---

This is Part 1 of the comprehensive blueprint covering the database architecture. Continue?
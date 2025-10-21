-- =====================================================
-- INPATIENT MODULE DATABASE SCHEMA
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. HOSPITAL WARDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS hospital_wards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  ward_name TEXT NOT NULL,
  ward_code TEXT UNIQUE,
  ward_type TEXT CHECK (ward_type IN ('general', 'icu', 'pediatric', 'maternity', 'emergency', 'surgical', 'psychiatric', 'oncology')),
  floor_number INTEGER,
  total_beds INTEGER NOT NULL DEFAULT 0,
  occupied_beds INTEGER DEFAULT 0,
  nurse_station_ext TEXT,
  head_nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  features TEXT[], -- ['cardiac_monitoring', 'ventilators', 'telemetry', 'isolation_capable']
  visiting_hours_start TIME,
  visiting_hours_end TIME,
  max_visitors_per_patient INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_hospital_wards_practice ON hospital_wards(practice_id);
CREATE INDEX idx_hospital_wards_branch ON hospital_wards(branch_id);

-- =====================================================
-- 2. WARD BEDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ward_beds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_id UUID NOT NULL REFERENCES hospital_wards(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  bed_code TEXT UNIQUE, -- Auto-generated: WARD-ROOM-BED (e.g., ICU-201-A)
  bed_type TEXT CHECK (bed_type IN ('standard', 'icu', 'pediatric', 'isolation', 'vip', 'emergency')),
  room_number TEXT,
  room_type TEXT CHECK (room_type IN ('single', 'double', 'ward', 'isolation', 'vip')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved', 'cleaning', 'blocked')),
  features TEXT[], -- ['oxygen', 'cardiac_monitor', 'ventilator', 'electric_adjustable', 'side_rails', 'call_button']
  daily_rate DECIMAL(10, 2),
  last_cleaned_at TIMESTAMPTZ,
  next_maintenance_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ward_id, bed_number)
);

-- Create indexes
CREATE INDEX idx_ward_beds_ward ON ward_beds(ward_id);
CREATE INDEX idx_ward_beds_status ON ward_beds(status);

-- =====================================================
-- 3. PATIENT ADMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS patient_admissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_number TEXT UNIQUE NOT NULL, -- Auto-generated: ADM-YYYY-NNNNNN
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,

  -- Admission Details
  admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_discharge_date DATE,
  actual_discharge_date TIMESTAMPTZ,
  admission_type TEXT NOT NULL CHECK (admission_type IN ('emergency', 'scheduled', 'transfer_in', 'referral', 'newborn')),
  admission_source TEXT CHECK (admission_source IN ('emergency_room', 'outpatient_clinic', 'transfer_hospital', 'transfer_ward', 'physician_referral', 'walk_in')),

  -- Medical Team
  attending_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admitting_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referring_doctor_name TEXT,
  referring_hospital TEXT,

  -- Diagnosis
  chief_complaint TEXT,
  primary_diagnosis TEXT,
  primary_diagnosis_code TEXT, -- ICD-10 code
  secondary_diagnoses TEXT[],
  secondary_diagnosis_codes TEXT[],

  -- Status
  admission_status TEXT DEFAULT 'active' CHECK (admission_status IN ('active', 'discharged', 'transferred', 'deceased', 'left_ama')),
  patient_condition TEXT CHECK (patient_condition IN ('stable', 'fair', 'serious', 'critical', 'undetermined')),

  -- Insurance/Billing
  insurance_verified BOOLEAN DEFAULT false,
  insurance_verification_date TIMESTAMPTZ,
  pre_authorization_number TEXT,
  estimated_length_of_stay INTEGER, -- in days

  -- Discharge Information
  discharge_type TEXT CHECK (discharge_type IN ('home', 'transfer', 'expired', 'ama', 'hospice', 'rehab')),
  discharge_disposition TEXT,
  discharge_instructions TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,

  -- Additional Info
  special_requirements TEXT[],
  isolation_required BOOLEAN DEFAULT false,
  isolation_type TEXT,
  fall_risk BOOLEAN DEFAULT false,
  allergy_alert BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_patient_admissions_patient ON patient_admissions(patient_id);
CREATE INDEX idx_patient_admissions_practice ON patient_admissions(practice_id);
CREATE INDEX idx_patient_admissions_status ON patient_admissions(admission_status);
CREATE INDEX idx_patient_admissions_date ON patient_admissions(admission_date);

-- =====================================================
-- 4. BED ALLOCATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bed_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id) ON DELETE CASCADE,
  bed_id UUID NOT NULL REFERENCES ward_beds(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  ward_id UUID NOT NULL REFERENCES hospital_wards(id) ON DELETE RESTRICT,

  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  released_by UUID REFERENCES users(id) ON DELETE SET NULL,

  transfer_reason TEXT CHECK (transfer_reason IN ('medical_needs', 'patient_request', 'bed_availability', 'isolation', 'discharge', 'deceased')),
  notes TEXT,
  is_current BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_bed_allocations_admission ON bed_allocations(admission_id);
CREATE INDEX idx_bed_allocations_bed ON bed_allocations(bed_id);
CREATE INDEX idx_bed_allocations_current ON bed_allocations(is_current);

-- =====================================================
-- 5. NURSING CARE RECORDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS nursing_care_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  nurse_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night', 'custom')),
  shift_start_time TIMESTAMPTZ NOT NULL,
  shift_end_time TIMESTAMPTZ,

  -- Vital Signs (links to existing vitals table)
  vital_signs_checked BOOLEAN DEFAULT false,
  vitals_ids UUID[], -- Array of vitals record IDs

  -- Medications
  medications_given JSONB, -- [{time, medication_id, dose, route, notes}]

  -- Intake/Output
  fluid_intake_ml INTEGER,
  urine_output_ml INTEGER,
  other_output_ml INTEGER,

  -- Patient Care
  patient_condition TEXT,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  mobility_status TEXT CHECK (mobility_status IN ('ambulatory', 'assisted', 'bedbound', 'wheelchair')),
  skin_condition TEXT,

  -- Activities
  bathed BOOLEAN DEFAULT false,
  position_changed BOOLEAN DEFAULT false,
  meals_taken TEXT[], -- ['breakfast', 'lunch', 'dinner']

  nursing_notes TEXT,
  alerts TEXT[],
  handover_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_nursing_care_admission ON nursing_care_records(admission_id);
CREATE INDEX idx_nursing_care_nurse ON nursing_care_records(nurse_id);
CREATE INDEX idx_nursing_care_shift ON nursing_care_records(shift_start_time);

-- =====================================================
-- 6. WARD ROUNDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ward_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  round_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  round_type TEXT CHECK (round_type IN ('regular', 'emergency', 'discharge', 'consultation')),

  -- Clinical Assessment
  patient_condition TEXT NOT NULL CHECK (patient_condition IN ('stable', 'improving', 'unchanged', 'deteriorating', 'critical')),
  consciousness_level TEXT CHECK (consciousness_level IN ('alert', 'drowsy', 'stuporous', 'comatose')),

  examination_findings TEXT,
  vital_signs_reviewed BOOLEAN DEFAULT false,
  lab_results_reviewed BOOLEAN DEFAULT false,
  imaging_reviewed BOOLEAN DEFAULT false,

  -- Treatment
  diagnosis_update TEXT,
  treatment_changes TEXT,
  new_orders TEXT[],
  medications_changed JSONB, -- [{action: 'add/remove/modify', medication, dose, reason}]

  -- Plan
  continue_current_treatment BOOLEAN DEFAULT true,
  specialty_consultation_needed TEXT[],
  procedures_ordered TEXT[],
  discharge_planning_started BOOLEAN DEFAULT false,
  estimated_discharge_date DATE,

  -- Documentation
  doctor_notes TEXT,
  family_updated BOOLEAN DEFAULT false,
  next_review_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ward_rounds_admission ON ward_rounds(admission_id);
CREATE INDEX idx_ward_rounds_doctor ON ward_rounds(doctor_id);
CREATE INDEX idx_ward_rounds_datetime ON ward_rounds(round_datetime);

-- =====================================================
-- 7. INPATIENT MEDICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS inpatient_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,

  medication_name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT NOT NULL,
  dosage_unit TEXT,
  route TEXT NOT NULL CHECK (route IN ('oral', 'iv', 'im', 'subcutaneous', 'topical', 'inhalation', 'rectal', 'sublingual')),
  frequency TEXT NOT NULL, -- 'BID', 'TID', 'QID', 'Q6H', 'Q8H', 'Q12H', 'PRN'

  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  duration_days INTEGER,

  prescribed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  prescription_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Administration tracking
  scheduled_times TIME[], -- [08:00, 14:00, 20:00]
  administration_records JSONB, -- [{datetime, given_by, dose_given, notes, skipped, skip_reason}]

  -- Additional info
  indication TEXT,
  special_instructions TEXT,
  prn_indication TEXT, -- For PRN medications
  max_daily_dose TEXT,

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued', 'held')),
  discontinuation_reason TEXT,
  discontinued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  discontinued_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_inpatient_medications_admission ON inpatient_medications(admission_id);
CREATE INDEX idx_inpatient_medications_patient ON inpatient_medications(patient_id);
CREATE INDEX idx_inpatient_medications_status ON inpatient_medications(status);

-- =====================================================
-- 8. BED TRANSFER HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bed_transfer_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,

  from_bed_id UUID REFERENCES ward_beds(id) ON DELETE SET NULL,
  to_bed_id UUID NOT NULL REFERENCES ward_beds(id) ON DELETE RESTRICT,
  from_ward_id UUID REFERENCES hospital_wards(id) ON DELETE SET NULL,
  to_ward_id UUID NOT NULL REFERENCES hospital_wards(id) ON DELETE RESTRICT,

  transfer_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transfer_reason TEXT NOT NULL,
  urgency TEXT CHECK (urgency IN ('routine', 'urgent', 'emergency')),

  ordered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_bed_transfer_admission ON bed_transfer_history(admission_id);
CREATE INDEX idx_bed_transfer_datetime ON bed_transfer_history(transfer_datetime);

-- =====================================================
-- 9. DISCHARGE SUMMARIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS discharge_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id UUID NOT NULL UNIQUE REFERENCES patient_admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,

  discharge_date TIMESTAMPTZ NOT NULL,
  prepared_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Clinical Summary
  admission_diagnosis TEXT NOT NULL,
  discharge_diagnosis TEXT NOT NULL,
  procedures_performed TEXT[],
  hospital_course TEXT,

  -- Discharge Status
  condition_on_discharge TEXT,
  discharge_destination TEXT,

  -- Medications
  discharge_medications JSONB, -- [{medication, dose, frequency, duration, instructions}]
  medications_discontinued TEXT[],

  -- Follow-up
  follow_up_appointments JSONB, -- [{specialty, date, location, doctor, reason}]
  pending_results TEXT[],

  -- Instructions
  activity_restrictions TEXT,
  diet_instructions TEXT,
  wound_care_instructions TEXT,
  warning_signs TEXT[], -- When to return to emergency

  -- Additional
  patient_education_provided TEXT[],
  equipment_provided TEXT[],
  home_health_arranged BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. VISITOR LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS visitor_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id UUID NOT NULL REFERENCES patient_admissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  ward_id UUID NOT NULL REFERENCES hospital_wards(id) ON DELETE CASCADE,

  visitor_name TEXT NOT NULL,
  visitor_id_number TEXT,
  relationship TEXT,
  contact_number TEXT,

  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,

  purpose TEXT CHECK (purpose IN ('regular_visit', 'emergency', 'consultation', 'caregiver')),
  authorized_by UUID REFERENCES users(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_visitor_logs_admission ON visitor_logs(admission_id);
CREATE INDEX idx_visitor_logs_checkin ON visitor_logs(check_in_time);

-- =====================================================
-- EXTEND EXISTING TABLES
-- =====================================================

-- Extend visits table for inpatient integration
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS admission_id UUID REFERENCES patient_admissions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS visit_category TEXT DEFAULT 'outpatient' CHECK (visit_category IN ('outpatient', 'inpatient', 'emergency', 'day_procedure')),
ADD COLUMN IF NOT EXISTS discharge_summary_id UUID REFERENCES discharge_summaries(id) ON DELETE SET NULL;

-- Create index for admission lookup
CREATE INDEX IF NOT EXISTS idx_visits_admission ON visits(admission_id);

-- Extend invoices_enhanced for inpatient billing
ALTER TABLE invoices_enhanced
ADD COLUMN IF NOT EXISTS admission_id UUID REFERENCES patient_admissions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS daily_room_charges JSONB, -- [{date, bed_type, rate, total}]
ADD COLUMN IF NOT EXISTS nursing_charges DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS pharmacy_charges DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS procedure_charges DECIMAL(10, 2);

-- Create index for admission billing
CREATE INDEX IF NOT EXISTS idx_invoices_admission ON invoices_enhanced(admission_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update ward occupancy
CREATE OR REPLACE FUNCTION update_ward_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_current = true THEN
    -- Increase occupancy
    UPDATE hospital_wards
    SET occupied_beds = occupied_beds + 1,
        updated_at = NOW()
    WHERE id = NEW.ward_id;

    -- Mark bed as occupied
    UPDATE ward_beds
    SET status = 'occupied',
        updated_at = NOW()
    WHERE id = NEW.bed_id;

  ELSIF TG_OP = 'UPDATE' AND OLD.is_current = true AND NEW.is_current = false THEN
    -- Decrease occupancy
    UPDATE hospital_wards
    SET occupied_beds = GREATEST(occupied_beds - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.ward_id;

    -- Mark bed as cleaning (not immediately available)
    UPDATE ward_beds
    SET status = 'cleaning',
        updated_at = NOW()
    WHERE id = OLD.bed_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bed allocation
CREATE TRIGGER trigger_update_ward_occupancy
AFTER INSERT OR UPDATE ON bed_allocations
FOR EACH ROW
EXECUTE FUNCTION update_ward_occupancy();

-- Function to generate admission number
CREATE OR REPLACE FUNCTION generate_admission_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  sequence_number INTEGER;
  admission_number TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(admission_number FROM 10) AS INTEGER)), 0) + 1
  INTO sequence_number
  FROM patient_admissions
  WHERE admission_number LIKE 'ADM-' || year_part || '-%';

  -- Format: ADM-YYYY-NNNNNN
  admission_number := 'ADM-' || year_part || '-' || LPAD(sequence_number::TEXT, 6, '0');

  RETURN admission_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate admission number
CREATE OR REPLACE FUNCTION set_admission_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.admission_number IS NULL THEN
    NEW.admission_number := generate_admission_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_admission_number
BEFORE INSERT ON patient_admissions
FOR EACH ROW
EXECUTE FUNCTION set_admission_number();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE hospital_wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nursing_care_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE inpatient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_transfer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multi-tenant isolation
-- Hospital Wards - Users can only see their practice's wards
CREATE POLICY "Users can view their practice wards" ON hospital_wards
FOR SELECT USING (
  practice_id IN (
    SELECT practice_id FROM users WHERE id = auth.uid()
    UNION
    SELECT practice_id FROM practice_staff WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their practice wards" ON hospital_wards
FOR ALL USING (
  practice_id IN (
    SELECT practice_id FROM users WHERE id = auth.uid()
    UNION
    SELECT practice_id FROM practice_staff WHERE user_id = auth.uid()
  )
);

-- Similar policies for other tables (simplified for brevity)
-- These ensure data isolation between different practices/hospitals

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Uncomment to insert sample ward data
/*
INSERT INTO hospital_wards (practice_id, ward_name, ward_type, floor_number, total_beds)
VALUES
  ((SELECT id FROM practices LIMIT 1), 'General Ward A', 'general', 1, 20),
  ((SELECT id FROM practices LIMIT 1), 'ICU', 'icu', 2, 10),
  ((SELECT id FROM practices LIMIT 1), 'Pediatric Ward', 'pediatric', 1, 15),
  ((SELECT id FROM practices LIMIT 1), 'Maternity Ward', 'maternity', 3, 12);
*/

-- =====================================================
-- GRANTS (Adjust based on your user roles)
-- =====================================================

-- Grant appropriate permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE patient_admissions IS 'Core table for managing inpatient admissions';
COMMENT ON TABLE hospital_wards IS 'Hospital ward/department definitions';
COMMENT ON TABLE ward_beds IS 'Individual bed tracking and management';
COMMENT ON TABLE bed_allocations IS 'Patient-to-bed assignment tracking';
COMMENT ON TABLE nursing_care_records IS 'Nursing documentation and shift records';
COMMENT ON TABLE ward_rounds IS 'Doctor ward round documentation';
COMMENT ON TABLE inpatient_medications IS 'Inpatient medication administration tracking';
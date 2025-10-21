-- ====================================================================
-- PERFORMANCE OPTIMIZATION: DATABASE INDEXES
-- ====================================================================
-- Created: 2025-10-21
-- Purpose: Improve query performance on commonly queried columns
-- ====================================================================

-- Index on users table
CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on patients table
CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id);
CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);
CREATE INDEX IF NOT EXISTS idx_patients_first_name ON patients(first_name);

-- Index on visits table (CRITICAL - visits is the primary table for appointments and medical encounters)
CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date ON visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id);

-- Index on appointments table
CREATE INDEX IF NOT EXISTS idx_appointments_practice_id ON appointments(practice_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

-- Index on practices table
CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(status);

-- Index on branches table
CREATE INDEX IF NOT EXISTS idx_branches_practice_id ON branches(practice_id);

-- Index on practice_settings table (composite index for key lookups)
CREATE INDEX IF NOT EXISTS idx_practice_settings_practice_id_key ON practice_settings(practice_id, setting_key);

-- Index on invoices_enhanced table
CREATE INDEX IF NOT EXISTS idx_invoices_practice_id ON invoices_enhanced(practice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices_enhanced(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices_enhanced(created_at);

-- Index on medical_aid_details
CREATE INDEX IF NOT EXISTS idx_medical_aid_details_patient_id ON medical_aid_details(patient_id);

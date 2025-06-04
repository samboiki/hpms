-- OneHealth Practice Management System - Initial Database Schema
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'practice_manager', 'doctor', 'nurse', 'receptionist');
CREATE TYPE practice_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE tariff_category AS ENUM ('consultation', 'procedure', 'diagnostic', 'treatment', 'emergency');
CREATE TYPE billing_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- Practices table
CREATE TABLE practices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Contact Information
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    
    -- Address
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Namibia',
    
    -- Practice Details
    specialties TEXT[], -- Array of specialties
    license_number VARCHAR(100),
    tax_number VARCHAR(100),
    registration_number VARCHAR(100),
    
    -- Business Hours (JSON format)
    business_hours JSONB DEFAULT '{}',
    
    -- Settings
    timezone VARCHAR(50) DEFAULT 'Africa/Windhoek',
    currency VARCHAR(3) DEFAULT 'NAD',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Status and metadata
    status practice_status DEFAULT 'active',
    logo_url VARCHAR(500),
    banner_url VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT practices_name_check CHECK (LENGTH(name) >= 2),
    CONSTRAINT practices_slug_check CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Enhanced Users table (extends Supabase auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Personal Information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    title VARCHAR(50), -- Dr., Mr., Ms., etc.
    display_name VARCHAR(200),
    
    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    
    -- Professional Details
    role user_role NOT NULL DEFAULT 'receptionist',
    license_number VARCHAR(100),
    specialization VARCHAR(255),
    qualifications TEXT[],
    
    -- Profile
    avatar_url VARCHAR(500),
    bio TEXT,
    
    -- Settings
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{"email": true, "sms": false, "push": true}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Practice Assignments
CREATE TABLE user_practice_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    
    -- Assignment Details
    role user_role NOT NULL,
    is_primary BOOLEAN DEFAULT false, -- Primary practice for user
    permissions JSONB DEFAULT '{}', -- Practice-specific permissions
    
    -- Schedule (if applicable)
    schedule JSONB DEFAULT '{}', -- Working hours, availability
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    
    -- Timestamps
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, practice_id),
    CONSTRAINT valid_assignment_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Tariffs Management
CREATE TABLE tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    
    -- Tariff Details
    code VARCHAR(50) NOT NULL, -- Unique code within practice
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category tariff_category NOT NULL,
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NAD',
    
    -- Medical Aid Pricing (JSON with provider-specific rates)
    medical_aid_rates JSONB DEFAULT '{}',
    
    -- Metadata
    unit VARCHAR(50), -- per visit, per hour, etc.
    duration_minutes INTEGER, -- Expected duration
    
    -- Classification
    tags TEXT[],
    is_emergency BOOLEAN DEFAULT false,
    requires_authorization BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_until DATE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id),
    
    -- Constraints
    UNIQUE(practice_id, code),
    CONSTRAINT tariffs_price_check CHECK (base_price >= 0),
    CONSTRAINT tariffs_dates_check CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

-- Tariff History (for price tracking)
CREATE TABLE tariff_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tariff_id UUID NOT NULL REFERENCES tariffs(id) ON DELETE CASCADE,
    
    -- Historical Data
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    change_reason TEXT,
    
    -- Metadata
    changed_by UUID REFERENCES user_profiles(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_date DATE DEFAULT CURRENT_DATE
);

-- Practice Settings
CREATE TABLE practice_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    
    -- Setting Details
    category VARCHAR(100) NOT NULL, -- billing, appointments, notifications, etc.
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    
    -- Metadata
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- System vs user configurable
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES user_profiles(id),
    
    -- Constraints
    UNIQUE(practice_id, category, key)
);

-- Patients (Core entity)
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    
    -- Personal Information
    patient_number VARCHAR(50), -- Practice-specific patient number
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(20),
    preferred_name VARCHAR(100),
    
    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    
    -- Demographics
    date_of_birth DATE,
    gender VARCHAR(20),
    id_number VARCHAR(50), -- National ID
    nationality VARCHAR(100) DEFAULT 'Namibian',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Address
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Namibia',
    
    -- Medical Information
    blood_type VARCHAR(10),
    allergies TEXT[],
    chronic_conditions TEXT[],
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relationship VARCHAR(100),
    
    -- Medical Aid
    medical_aid_provider VARCHAR(255),
    medical_aid_number VARCHAR(100),
    medical_aid_scheme VARCHAR(255),
    
    -- Status and Preferences
    is_active BOOLEAN DEFAULT true,
    communication_preferences JSONB DEFAULT '{"email": true, "sms": true, "call": true}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id),
    
    -- Constraints
    CONSTRAINT patients_name_check CHECK (LENGTH(first_name) >= 1 AND LENGTH(last_name) >= 1),
    UNIQUE(practice_id, patient_number)
);

-- Appointments
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES user_profiles(id),
    
    -- Appointment Details
    appointment_number VARCHAR(50), -- Practice-specific appointment number
    title VARCHAR(255),
    description TEXT,
    
    -- Scheduling
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    
    -- Classification
    type VARCHAR(100), -- consultation, follow-up, procedure, etc.
    category VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Status and Notes
    status appointment_status DEFAULT 'scheduled',
    notes TEXT,
    internal_notes TEXT, -- Staff-only notes
    
    -- Billing
    estimated_cost DECIMAL(10,2),
    tariff_ids UUID[], -- Associated tariffs
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id),
    
    -- Constraints
    CONSTRAINT appointments_time_check CHECK (end_time > start_time),
    CONSTRAINT appointments_date_check CHECK (appointment_date >= CURRENT_DATE - INTERVAL '1 year'),
    UNIQUE(practice_id, appointment_number)
);

-- Billing Records
CREATE TABLE billing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id),
    
    -- Invoice Details
    invoice_number VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100),
    
    -- Financial
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NAD',
    
    -- Status and Dates
    status billing_status DEFAULT 'draft',
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    paid_date DATE,
    
    -- Payment Details
    payment_method VARCHAR(100),
    payment_reference VARCHAR(255),
    
    -- Line Items (JSON)
    line_items JSONB NOT NULL DEFAULT '[]',
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id),
    
    -- Constraints
    CONSTRAINT billing_amounts_check CHECK (
        subtotal >= 0 AND tax_amount >= 0 AND 
        discount_amount >= 0 AND total_amount >= 0
    ),
    CONSTRAINT billing_dates_check CHECK (due_date >= issue_date),
    UNIQUE(practice_id, invoice_number)
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
    
    -- Event Details
    entity_type VARCHAR(100) NOT NULL, -- table name
    entity_id UUID, -- record id
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, etc.
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    changes JSONB, -- Computed diff
    
    -- Context
    user_id UUID REFERENCES user_profiles(id),
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    description TEXT,
    severity VARCHAR(20) DEFAULT 'info', -- debug, info, warning, error, critical
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT audit_logs_action_check CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS'))
);

-- Create indexes for performance
CREATE INDEX idx_practices_slug ON practices(slug);
CREATE INDEX idx_practices_status ON practices(status);

CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active);

CREATE INDEX idx_user_practice_assignments_user ON user_practice_assignments(user_id);
CREATE INDEX idx_user_practice_assignments_practice ON user_practice_assignments(practice_id);
CREATE INDEX idx_user_practice_assignments_active ON user_practice_assignments(is_active);

CREATE INDEX idx_tariffs_practice ON tariffs(practice_id);
CREATE INDEX idx_tariffs_category ON tariffs(category);
CREATE INDEX idx_tariffs_code ON tariffs(practice_id, code);
CREATE INDEX idx_tariffs_active ON tariffs(is_active);

CREATE INDEX idx_patients_practice ON patients(practice_id);
CREATE INDEX idx_patients_name ON patients(first_name, last_name);
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_phone ON patients(phone, mobile);
CREATE INDEX idx_patients_patient_number ON patients(practice_id, patient_number);

CREATE INDEX idx_appointments_practice ON appointments(practice_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_datetime ON appointments(appointment_date, start_time);

CREATE INDEX idx_billing_practice ON billing_records(practice_id);
CREATE INDEX idx_billing_patient ON billing_records(patient_id);
CREATE INDEX idx_billing_status ON billing_records(status);
CREATE INDEX idx_billing_invoice ON billing_records(practice_id, invoice_number);

CREATE INDEX idx_audit_logs_practice ON audit_logs(practice_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_practices_updated_at BEFORE UPDATE ON practices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_practice_assignments_updated_at BEFORE UPDATE ON user_practice_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tariffs_updated_at BEFORE UPDATE ON tariffs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_practice_settings_updated_at BEFORE UPDATE ON practice_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_records_updated_at BEFORE UPDATE ON billing_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
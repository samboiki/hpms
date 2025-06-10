-- ============================================
-- CRITICAL HPMS DATABASE SCHEMA RECONSTRUCTION
-- Based on emergency export + migration analysis
-- Generated: 2025-06-10T21:11:54.788Z
-- Status: LIFE AND DEATH CRITICAL
-- ============================================

-- DATABASE CONNECTION INFO
-- Host: db.jjxlfunlbyayxwvlpgwt.supabase.co
-- Port: 5432
-- Database: postgres
-- User: postgres
-- Password: T@ngisasa200
-- URL: https://jjxlfunlbyayxwvlpgwt.supabase.co

-- VERIFIED PRACTICES DATA (5 records confirmed)
CREATE TABLE IF NOT EXISTS public.practices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE,
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#01b9d5',
    secondary_color VARCHAR(7) DEFAULT '#0196be',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Namibia',
    postal_code VARCHAR(20),
    hero_image_url TEXT,
    hero_title TEXT,
    hero_subtitle TEXT,
    business_hours JSONB,
    features JSONB,
    settings JSONB,
    services JSONB,
    social_links JSONB,
    about_text TEXT,
    practice_type_id UUID,
    status TEXT,
    subscription_tier TEXT,
    timezone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INSERT VERIFIED PRACTICES
INSERT INTO practices (id, name, slug, domain, logo_url, primary_color, contact_email, contact_phone, address, city, country) VALUES 
('e0716e54-f808-4905-a1f8-85090dd3d9e2', 'Coastal Medical Center', 'coastalmed', 'coastalmed.vercel.app', '', '#01b9d5', 'hello@coastalmed.com', '+264 64 987 6543', '45 Beach Road', 'Swakopmund', 'Namibia'),
('9f9966b9-d515-470a-b6c5-c15330bbe7b7', 'City Clinic Windhoek', 'cityclinic', 'cityclinic.vercel.app', '', '#01b9d5', 'info@cityclinic.com', '+264 61 123 4567', '123 Independence Avenue', 'Windhoek', 'Namibia'),
('5da3896d-b9f3-4b0a-996a-3adca867cb30', 'Dr. Polina Aesthetic Clinic', 'dr-polina', 'drpolina.com', '', '#01b9d5', 'info@drpolina.com', '+264 61 555 0123', '123 Aesthetic Avenue', 'Windhoek', 'Namibia'),
('b64632c2-3a56-44cf-a2c9-0e42be03a2d3', 'Dr. Polina Aesthetics', 'dr-polina-aesthetics', 'healthpractice.vercel.app', 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/logo.png', '#E91E63', 'info@drpolinaaesthetics.com', '+264 81 435 8844', 'Feld Street 4, Ausspannplatz', 'Windhoek', 'Namibia'),
('ffed1160-00ec-4c4f-8810-913a24348d90', 'NewCharm Dental Practice', 'newcharm-dental', 'newcharm.vercel.app', 'https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/practice-images/newcharm/logo.png', '#00BCD4', 'info@newcharmdental.na', '+264 61 234 567', '123 Independence Avenue', 'Windhoek', 'Namibia')
ON CONFLICT (id) DO NOTHING;

-- CORE PATIENT MANAGEMENT TABLES
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    cell_number TEXT,
    date_of_birth DATE,
    gender TEXT,
    id_number TEXT,
    address TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Namibia',
    occupation TEXT,
    employer TEXT,
    marital_status TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    practice_id UUID REFERENCES practices(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    doctor_id UUID,
    practice_id UUID REFERENCES practices(id),
    date DATE NOT NULL,
    time TIME,
    duration INTEGER DEFAULT 30,
    type TEXT DEFAULT 'consultation',
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USERS TABLE (for authentication and staff)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    practice_id UUID REFERENCES practices(id),
    avatar_url TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VISITS TABLE
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id),
    patient_id UUID REFERENCES patients(id),
    doctor_id UUID REFERENCES users(id),
    practice_id UUID REFERENCES practices(id),
    visit_date DATE NOT NULL,
    visit_time TIME,
    visit_type TEXT DEFAULT 'consultation',
    chief_complaint TEXT,
    history_of_present_illness TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    follow_up_instructions TEXT,
    status TEXT DEFAULT 'scheduled',
    encounter_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MEDICAL RECORDS
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    visit_id UUID REFERENCES visits(id),
    doctor_id UUID REFERENCES users(id),
    record_type TEXT,
    diagnosis TEXT,
    treatment TEXT,
    prescriptions JSONB,
    doctor_notes TEXT,
    attachments JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MEDICAL AID DETAILS
CREATE TABLE IF NOT EXISTS public.medical_aid_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    provider TEXT,
    scheme_name TEXT,
    scheme_type TEXT,
    member_number TEXT,
    main_member_name TEXT,
    main_member_id_number TEXT,
    relationship_to_main_member TEXT,
    dependent_code TEXT,
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MEDICAL AID PROVIDERS (verified data)
CREATE TABLE IF NOT EXISTS public.medical_aid_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider_code TEXT UNIQUE,
    logo_url TEXT,
    contact_info JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO medical_aid_providers (name, provider_code) VALUES 
('Nammed Medical Aid Fund', 'NAMM'),
('Namibia Medical Care', 'NMC'),
('Namibia Health Plan', 'NHP'),
('Methealth Namibia', 'METH'),
('Prosperity Health', 'PROS')
ON CONFLICT (provider_code) DO NOTHING;

-- VITALS
CREATE TABLE IF NOT EXISTS public.vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES visits(id),
    patient_id UUID REFERENCES patients(id),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    temperature NUMERIC(4,1),
    weight NUMERIC(5,2),
    height NUMERIC(5,2),
    bmi NUMERIC(4,1),
    oxygen_saturation INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LAB REQUESTS
CREATE TABLE IF NOT EXISTS public.lab_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    visit_id UUID REFERENCES visits(id),
    doctor_id UUID REFERENCES users(id),
    test_name TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    is_urgent BOOLEAN DEFAULT false,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LAB RESULTS
CREATE TABLE IF NOT EXISTS public.lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    visit_id UUID REFERENCES visits(id),
    lab_request_id UUID REFERENCES lab_requests(id),
    test_name TEXT NOT NULL,
    result_value TEXT,
    unit TEXT,
    reference_range TEXT,
    abnormal_flag TEXT,
    status TEXT DEFAULT 'pending',
    performed_at TIMESTAMP WITH TIME ZONE,
    result_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MEDIA REQUESTS
CREATE TABLE IF NOT EXISTS public.media_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    visit_id UUID REFERENCES visits(id),
    doctor_id UUID REFERENCES users(id),
    request_type TEXT NOT NULL,
    description TEXT,
    media_url TEXT,
    status TEXT DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BILLING SYSTEM TABLES
CREATE TABLE IF NOT EXISTS public.practice_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.practice_tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    practice_type_id UUID REFERENCES practice_types(id),
    code TEXT NOT NULL,
    description TEXT,
    unit_price NUMERIC(10,2),
    currency TEXT DEFAULT 'NAD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dental_tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit_price NUMERIC(10,2),
    currency TEXT DEFAULT 'NAD',
    practice_type TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BILLING TABLES
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    batch_number TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    total_amount NUMERIC(12,2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    batch_id UUID REFERENCES batches(id),
    patient_id UUID REFERENCES patients(id),
    visit_id UUID REFERENCES visits(id),
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal NUMERIC(10,2) DEFAULT 0,
    tax_amount NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'draft',
    payment_status TEXT DEFAULT 'unpaid',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id),
    practice_tariff_id UUID REFERENCES practice_tariffs(id),
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VISIT SERVICES (for billing)
CREATE TABLE IF NOT EXISTS public.visit_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES visits(id),
    practice_tariff_id UUID REFERENCES practice_tariffs(id),
    service_code TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(10,2),
    total_price NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DOCUMENTS SYSTEM
CREATE TABLE IF NOT EXISTS public.patient_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    visit_id UUID REFERENCES visits(id),
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    uploaded_by UUID REFERENCES users(id),
    document_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COMMUNICATION SYSTEM
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    sender_id UUID REFERENCES users(id),
    recipient_id UUID,
    recipient_type TEXT,
    subject TEXT,
    content TEXT,
    message_type TEXT DEFAULT 'internal',
    status TEXT DEFAULT 'sent',
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STORAGE BUCKETS (Supabase specific)
-- documents bucket exists with policies
-- practice-images bucket exists

-- KEY CONSTRAINTS
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- CRITICAL INDEXES
CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id);
CREATE INDEX IF NOT EXISTS idx_appointments_practice_id ON appointments(practice_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_practice_id ON invoices(practice_id);
CREATE INDEX IF NOT EXISTS idx_batches_practice_id ON batches(practice_id);

-- CRITICAL NOTES
-- 1. All tables use UUID primary keys
-- 2. practice_id is the main tenant isolation field
-- 3. RLS is enabled on core tables
-- 4. Billing system is integrated with visit workflow
-- 5. Document storage uses Supabase storage buckets
-- 6. Medical aid system supports Namibian providers

-- END CRITICAL SCHEMA RECONSTRUCTION
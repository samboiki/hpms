-- OneHealth Practice Management System - Sample Data

-- Insert sample practices
INSERT INTO practices (id, name, slug, description, email, phone, address_line_1, city, specialties, business_hours) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'City Medical Centre',
    'city-medical',
    'Modern medical practice in the heart of Windhoek',
    'info@citymedical.na',
    '+264 61 123456',
    '123 Independence Avenue',
    'Windhoek',
    ARRAY['General Practice', 'Internal Medicine', 'Pediatrics'],
    '{"monday": {"start": "08:00", "end": "17:00"}, "tuesday": {"start": "08:00", "end": "17:00"}, "wednesday": {"start": "08:00", "end": "17:00"}, "thursday": {"start": "08:00", "end": "17:00"}, "friday": {"start": "08:00", "end": "17:00"}, "saturday": {"start": "08:00", "end": "12:00"}}'::jsonb
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'Namibia Dental Clinic',
    'namibia-dental',
    'Premier dental care services',
    'contact@namibiadental.na',
    '+264 61 789012',
    '456 Sam Nujoma Drive',
    'Windhoek',
    ARRAY['General Dentistry', 'Orthodontics', 'Oral Surgery'],
    '{"monday": {"start": "07:30", "end": "16:30"}, "tuesday": {"start": "07:30", "end": "16:30"}, "wednesday": {"start": "07:30", "end": "16:30"}, "thursday": {"start": "07:30", "end": "16:30"}, "friday": {"start": "07:30", "end": "16:30"}}'::jsonb
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    'Coastal Family Practice',
    'coastal-family',
    'Comprehensive family healthcare in Swakopmund',
    'admin@coastalfamily.na',
    '+264 64 567890',
    '789 Strand Street',
    'Swakopmund',
    ARRAY['Family Medicine', 'Emergency Medicine'],
    '{"monday": {"start": "08:00", "end": "18:00"}, "tuesday": {"start": "08:00", "end": "18:00"}, "wednesday": {"start": "08:00", "end": "18:00"}, "thursday": {"start": "08:00", "end": "18:00"}, "friday": {"start": "08:00", "end": "18:00"}, "saturday": {"start": "09:00", "end": "13:00"}}'::jsonb
);

-- Sample tariffs for City Medical Centre
INSERT INTO tariffs (practice_id, code, name, description, category, base_price, medical_aid_rates, unit, duration_minutes) VALUES
-- Consultations
('550e8400-e29b-41d4-a716-446655440001', 'CONS001', 'General Consultation', 'Standard consultation with GP', 'consultation', 450.00, '{"NamMed": 380.00, "NMC": 400.00, "Bonitas": 420.00}'::jsonb, 'per visit', 30),
('550e8400-e29b-41d4-a716-446655440001', 'CONS002', 'Follow-up Consultation', 'Follow-up visit within 2 weeks', 'consultation', 320.00, '{"NamMed": 280.00, "NMC": 300.00, "Bonitas": 310.00}'::jsonb, 'per visit', 20),
('550e8400-e29b-41d4-a716-446655440001', 'CONS003', 'Specialist Consultation', 'Consultation with specialist', 'consultation', 650.00, '{"NamMed": 580.00, "NMC": 600.00, "Bonitas": 620.00}'::jsonb, 'per visit', 45),

-- Procedures
('550e8400-e29b-41d4-a716-446655440001', 'PROC001', 'Blood Pressure Check', 'Basic vital signs monitoring', 'procedure', 80.00, '{"NamMed": 70.00, "NMC": 75.00, "Bonitas": 80.00}'::jsonb, 'per check', 10),
('550e8400-e29b-41d4-a716-446655440001', 'PROC002', 'ECG', 'Electrocardiogram', 'diagnostic', 220.00, '{"NamMed": 200.00, "NMC": 210.00, "Bonitas": 220.00}'::jsonb, 'per test', 15),
('550e8400-e29b-41d4-a716-446655440001', 'PROC003', 'Minor Surgery', 'Minor surgical procedures', 'procedure', 1200.00, '{"NamMed": 1100.00, "NMC": 1150.00, "Bonitas": 1200.00}'::jsonb, 'per procedure', 60),

-- Treatments
('550e8400-e29b-41d4-a716-446655440001', 'TREAT001', 'Vaccination', 'Standard immunization', 'treatment', 180.00, '{"NamMed": 160.00, "NMC": 170.00, "Bonitas": 180.00}'::jsonb, 'per dose', 15),
('550e8400-e29b-41d4-a716-446655440001', 'TREAT002', 'Wound Dressing', 'Wound care and dressing', 'treatment', 150.00, '{"NamMed": 130.00, "NMC": 140.00, "Bonitas": 150.00}'::jsonb, 'per dressing', 20),

-- Emergency
('550e8400-e29b-41d4-a716-446655440001', 'EMERG001', 'Emergency Consultation', 'After-hours emergency consultation', 'emergency', 850.00, '{"NamMed": 750.00, "NMC": 800.00, "Bonitas": 820.00}'::jsonb, 'per visit', 45);

-- Sample tariffs for Namibia Dental Clinic
INSERT INTO tariffs (practice_id, code, name, description, category, base_price, medical_aid_rates, unit, duration_minutes) VALUES
-- Dental Consultations
('550e8400-e29b-41d4-a716-446655440002', 'DENT001', 'Dental Consultation', 'Initial dental examination', 'consultation', 380.00, '{"NamMed": 320.00, "NMC": 350.00, "Bonitas": 370.00}'::jsonb, 'per visit', 30),
('550e8400-e29b-41d4-a716-446655440002', 'DENT002', 'Dental Cleaning', 'Professional teeth cleaning', 'treatment', 450.00, '{"NamMed": 400.00, "NMC": 420.00, "Bonitas": 440.00}'::jsonb, 'per session', 45),
('550e8400-e29b-41d4-a716-446655440002', 'DENT003', 'Filling (Amalgam)', 'Standard amalgam filling', 'treatment', 320.00, '{"NamMed": 280.00, "NMC": 300.00, "Bonitas": 310.00}'::jsonb, 'per filling', 30),
('550e8400-e29b-41d4-a716-446655440002', 'DENT004', 'Filling (Composite)', 'White composite filling', 'treatment', 480.00, '{"NamMed": 420.00, "NMC": 450.00, "Bonitas": 470.00}'::jsonb, 'per filling', 45),
('550e8400-e29b-41d4-a716-446655440002', 'DENT005', 'Tooth Extraction', 'Simple tooth extraction', 'procedure', 380.00, '{"NamMed": 330.00, "NMC": 350.00, "Bonitas": 370.00}'::jsonb, 'per tooth', 30),
('550e8400-e29b-41d4-a716-446655440002', 'DENT006', 'Root Canal Treatment', 'Endodontic treatment', 'procedure', 1500.00, '{"NamMed": 1350.00, "NMC": 1400.00, "Bonitas": 1450.00}'::jsonb, 'per tooth', 90),
('550e8400-e29b-41d4-a716-446655440002', 'DENT007', 'Crown (Porcelain)', 'Porcelain crown', 'treatment', 2800.00, '{"NamMed": 2500.00, "NMC": 2650.00, "Bonitas": 2700.00}'::jsonb, 'per crown', 120),
('550e8400-e29b-41d4-a716-446655440002', 'DENT008', 'X-Ray (Bitewing)', 'Dental x-ray', 'diagnostic', 120.00, '{"NamMed": 100.00, "NMC": 110.00, "Bonitas": 115.00}'::jsonb, 'per x-ray', 10);

-- Sample practice settings
INSERT INTO practice_settings (practice_id, category, key, value, description) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'general', 'appointment_duration', '"30"', 'Default appointment duration in minutes'),
('550e8400-e29b-41d4-a716-446655440001', 'general', 'booking_advance_days', '"90"', 'Maximum days in advance for booking'),
('550e8400-e29b-41d4-a716-446655440001', 'billing', 'invoice_prefix', '"INV"', 'Invoice number prefix'),
('550e8400-e29b-41d4-a716-446655440001', 'billing', 'payment_terms_days', '"30"', 'Default payment terms in days'),
('550e8400-e29b-41d4-a716-446655440001', 'notifications', 'appointment_reminders', 'true', 'Enable appointment reminder notifications'),
('550e8400-e29b-41d4-a716-446655440001', 'notifications', 'reminder_hours_before', '"24"', 'Hours before appointment to send reminder'),

('550e8400-e29b-41d4-a716-446655440002', 'general', 'appointment_duration', '"45"', 'Default appointment duration in minutes'),
('550e8400-e29b-41d4-a716-446655440002', 'general', 'booking_advance_days', '"60"', 'Maximum days in advance for booking'),
('550e8400-e29b-41d4-a716-446655440002', 'billing', 'invoice_prefix', '"DENT"', 'Invoice number prefix'),
('550e8400-e29b-41d4-a716-446655440002', 'billing', 'payment_terms_days', '"14"', 'Default payment terms in days');

-- Sample patients (will be created when you have actual users)
-- Note: These will need to be created after user authentication is set up
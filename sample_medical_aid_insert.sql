-- Sample medical aid data insert for testing
-- Run this via Supabase dashboard or psql as admin

-- First, let's see what patients we have
-- SELECT id, first_name, last_name FROM patients LIMIT 10;

-- Insert sample medical aid records for first few patients
-- Replace the patient_id values with actual patient IDs from your database

INSERT INTO medical_aid_details (
  patient_id, 
  provider, 
  scheme, 
  membership_number, 
  plan_type, 
  main_member_name, 
  main_member_id_number, 
  relationship_to_main
) VALUES 
-- Sample 1: NMC Diamond
((SELECT id FROM patients LIMIT 1 OFFSET 0), 
 'Namibia Medical Care', 
 'Diamond', 
 '12345678', 
 'Comprehensive', 
 'Johannes Mwangala', 
 '81234567890', 
 'Self'),

-- Sample 2: NHP Executive
((SELECT id FROM patients LIMIT 1 OFFSET 1), 
 'Namibia Health Plan', 
 'Executive', 
 '87654321', 
 'Comprehensive', 
 'Maria Nghipondoka', 
 '82345678901', 
 'Self'),

-- Sample 3: Discovery Health
((SELECT id FROM patients LIMIT 1 OFFSET 2), 
 'Discovery Health', 
 'Executive Plan', 
 '11223344', 
 'Premium', 
 'David Uutoni', 
 '83456789012', 
 'Self'),

-- Sample 4: Bonitas
((SELECT id FROM patients LIMIT 1 OFFSET 3), 
 'Bonitas Medical Fund', 
 'BonComprehensive', 
 '99887766', 
 'Comprehensive', 
 'Helena Amunyela', 
 '84567890123', 
 'Spouse'),

-- Sample 5: Gemhealth
((SELECT id FROM patients LIMIT 1 OFFSET 4), 
 'Gemhealth Medical Aid', 
 'Premium', 
 '55667788', 
 'Premium', 
 'Andreas Mukeve', 
 '85678901234', 
 'Self')

ON CONFLICT (patient_id) DO NOTHING;

-- Verify the inserts
SELECT 
  p.first_name, 
  p.last_name, 
  m.provider, 
  m.scheme, 
  m.membership_number 
FROM medical_aid_details m 
JOIN patients p ON m.patient_id = p.id 
ORDER BY p.first_name;
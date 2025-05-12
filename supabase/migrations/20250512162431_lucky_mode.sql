/*
  # Add Medical Aid Details for Patients

  1. Changes
    - Insert medical aid details for specific patients
    - Each patient gets unique medical aid information
    - Includes provider, scheme, membership details, and main member info

  2. Security
    - Uses existing RLS policies
    - No additional security changes needed
*/

-- Insert medical aid details for specified patients
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
  (
    '03dd4f09-67a8-4796-8e72-9f6356160178',
    'Namibia Medical Care',
    'Diamond',
    'NMC123456',
    'Comprehensive',
    'Johannes van der Merwe',
    '8005155012087',
    'Self'
  ),
  (
    '2a2136ad-7af7-47d0-b431-7dcef3411859',
    'Discovery Health',
    'Executive Plan',
    'DH789012',
    'Premium',
    'Sarah Johnson',
    '9208210123456',
    'Self'
  ),
  (
    '327925ed-6d7d-4464-8581-5a6fae75931e',
    'Bonitas',
    'BonComprehensive',
    'BON345678',
    'Standard',
    'Michael Brown',
    '7506125034089',
    'Self'
  ),
  (
    'd09ad54c-b7df-4c1f-b11b-994048aa730b',
    'Momentum Health',
    'Extender',
    'MH901234',
    'Elite',
    'Emily Wilson',
    '8912150067234',
    'Self'
  );
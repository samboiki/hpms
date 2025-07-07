-- Insert medical aid data for 80% of patients
-- This script will add realistic Namibian medical aid information

-- Temporarily disable RLS for bulk insert (as admin)
-- Note: Run this script with proper database admin privileges

-- Get random selection of patient IDs (approximately 80%)
WITH patient_sample AS (
  SELECT id, first_name, last_name, 
         ROW_NUMBER() OVER (ORDER BY RANDOM()) as rn,
         COUNT(*) OVER () as total_count
  FROM patients
),
selected_patients AS (
  SELECT id, first_name, last_name
  FROM patient_sample 
  WHERE rn <= (total_count * 0.8)::integer
),
medical_aid_data AS (
  SELECT 
    id as patient_id,
    CASE (RANDOM() * 6)::integer
      WHEN 0 THEN 'Namibia Medical Care'
      WHEN 1 THEN 'Namibia Health Plan'
      WHEN 2 THEN 'Discovery Health'
      WHEN 3 THEN 'Bonitas Medical Fund'
      WHEN 4 THEN 'Nammed Medical Aid Fund'
      WHEN 5 THEN 'Gemhealth Medical Aid'
      ELSE 'Old Mutual Health'
    END as provider,
    CASE (RANDOM() * 4)::integer
      WHEN 0 THEN 'Comprehensive'
      WHEN 1 THEN 'Standard' 
      WHEN 2 THEN 'Essential'
      ELSE 'Premium'
    END as scheme,
    (10000000 + (RANDOM() * 90000000)::bigint)::text as membership_number,
    CASE (RANDOM() * 3)::integer
      WHEN 0 THEN 'Comprehensive'
      WHEN 1 THEN 'Standard'
      ELSE 'Essential'
    END as plan_type,
    CASE (RANDOM() * 3)::integer
      WHEN 0 THEN first_name || ' ' || last_name
      WHEN 1 THEN 'Johannes Hendrik Mwangala'
      ELSE 'Maria Elizabeth Nghipondoka'
    END as main_member_name,
    (80000000000 + (RANDOM() * 19999999999)::bigint)::text as main_member_id_number,
    CASE (RANDOM() * 3)::integer
      WHEN 0 THEN 'Self'
      WHEN 1 THEN 'Spouse'
      ELSE 'Child'
    END as relationship_to_main
  FROM selected_patients
)
INSERT INTO medical_aid_details (
  patient_id,
  provider,
  scheme,
  membership_number,
  plan_type,
  main_member_name,
  main_member_id_number,
  relationship_to_main
)
SELECT 
  patient_id,
  provider,
  scheme,
  membership_number,
  plan_type,
  main_member_name,
  main_member_id_number,
  relationship_to_main
FROM medical_aid_data;

-- Show summary of inserted data
SELECT 
  provider,
  COUNT(*) as patient_count,
  ARRAY_AGG(DISTINCT scheme) as schemes_used
FROM medical_aid_details 
GROUP BY provider 
ORDER BY patient_count DESC;
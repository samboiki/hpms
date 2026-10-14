-- Applied 2026-10-14 as migration more_practice_types_2026_10_14 (version 20261014030422; stored statement md5 dd7a759b62962d3a6e3163998a33c5de = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left): 29 types became 83, 82 with a
-- discipline, none outside the NAMAF list; the old rows kept their ids, descriptions and links; running it twice changed
-- nothing; the policies on practice_types and the grants of dental_lab_practice_for were unchanged. As the doctor of a
-- dental practice whose type was set, inside the rehearsal only, to each of dental, dental_practice, orthodontist (typed
-- with a capital and a space), maxillofacial_oral_surgeon, periodontist, prosthodontist and dental_therapist, the lab check
-- accepted; for dental_technician, medical, optometry and general it refused ("Lab orders are for dental practices", 42501).
-- End to end the orthodontist practice's doctor ordered a crown (number 1) and its receptionist saw the order but could not
-- order (42501); another practice's staff were refused (42501); the doctor of a dental technician or GP practice was refused.
-- A practice administrator and a doctor read all 83 types and could not insert (42501) or change a link (0 rows); OneHealth
-- support inserted, changed and deleted; a patient-app login read 0 rows; anon read nothing (42501); anon and signed-in
-- logins cannot run the new helper (42501).
-- =============================================================================================
-- PROPOSAL: a practice type for every NAMAF discipline that has a code list; the dental specialists work like dental
-- File:   proposals/2026-10-14-more-practice-types.sql         Drafted: 2026-10-14 (agent dental-types)
-- Code:   src/utils/billing/practiceTypeNames.ts (DENTAL_PRACTICE_TYPES and the 'dental_practice' alias: the app's copy
--         of is_dental_practice_type below), src/utils/billing/tariffRules.ts (isDentalPractice: the one helper every
--         dental rule asks), src/utils/billing/namafTariffs.ts (NAMAF_DISCIPLINE_BY_PRACTICE_TYPE is the built-in copy of
--         section 1's links), src/utils/practiceType.ts (plain names, and the groups Settings > Practice lists the types
--         under). Tests keep the copies the same: practiceTypeDisciplines.test.ts, dentalPracticeTypes.test.ts
--
-- Why (owner, 14 Oct 2026): "dental specialists are their own practice types that work like dental", and every NAMAF
--   discipline that has a real code list gets a practice type, so a practice of that kind is given its codes by choosing
--   its type (practice_types.namaf_discipline_code, proposals/2026-10-14-practice-type-disciplines.sql). Until now the
--   tooth chart, the dental claim checks, the quote's tooth column and the dental lab orders belonged to the type 'dental'
--   alone, so an orthodontist had to be typed 'dental' and bill from the dentist's list (054) instead of its own (064).
--
-- What it does (additive; no policy is changed: practice_types belongs to the practice-isolation work)
--   1. 54 practice types, each with its NAMAF discipline (the existing 29 keep their ids, names and links):
--        dental specialists   orthodontist 064, maxillofacial_oral_surgeon 062, periodontist 092 (NAMAF: oral medicine /
--                             periodontic), prosthodontist 094, dental_therapist 095, dental_technician 093 (laboratory)
--        doctors              family_medicine 015, pulmonologist 017, gastroenterologist 019, medical_oncologist 023,
--                             neurosurgeon 024, nuclear_physician 025, clinical_hematologist 027, rheumatology 031,
--                             pediatric_cardiologist 033, physical_medicine 034, emergency_medicine 035, plastic_surgeon
--                             036, radiation_oncologist 040, thoracic_surgeon 044, pediatric_surgeon 114
--        allied health        medical_technology_lab 037, radiographer 039, sonographer 039004, art_therapist 067,
--                             podiatrist 068, medical_scientist 069, orthoptist 074, clinical_technologist 075,
--                             hearing_aid_acoustician 083, orthotist_prosthetist 087, social_worker 089,
--                             psychological_counsellor 099
--        complementary        chiropractor 004, chinese_medicine_practitioner 007, homeopath 008, naturopath 101,
--                             phytotherapist 103, acupuncturist 105
--        hospitals, clinics   ambulance_service 009, ambulance_intermediate 011, ambulance_basic 013, drug_and_alcohol
--        and services         047, sub_acute_facility 049, mental_health_institute 055, provincial_hospital 056,
--                             private_hospital_b 058, rehabilitation_hospital 059, day_clinic_077 077, blood_transfusion_
--                             service 078, hospice 079, nursing_agency 080, clinical_support_services 090, oncology_unit
--                             120000 (stand-alone oncology units: chemotherapy and radiation)
--      Two lists differ a little from the type that already holds the neighbouring number: private hospital B (058) has
--      17 lines the A tariff (057) lacks and lacks 7 of its lines; day clinic 077 is day clinic 076 with 3 more lines (no
--      amounts) and one different amount. Rheumatology (031) has only 3 lines, none with an amount (two visit lines and
--      the fund refund); provincial hospital (056) and clinical / support services (090) have 26 lines each, none with an
--      amount (state hospital charge lines; transport, appliances). Their practices type the amounts when they bill.
--   2. is_dental_practice_type(text): true for 'dental' and the dental specialists (orthodontist, maxillofacial_oral_surgeon,
--      periodontist, prosthodontist, dental_therapist) and for 'dental_practice', the text of the one practice whose type
--      matches no row (the app reads it as 'dental'; the practice's own text is not touched). Not the dental technician:
--      a laboratory has no tooth chart. The app's isDentalPractice is the same list.
--   3. dental_lab_practice_for (the check inside every lab-order function of proposals/2026-10-13-dental-lab-work.sql)
--      asks is_dental_practice_type instead of comparing the text with 'dental', so an orthodontist can order lab work.
--      Nothing else of that file changes; the function keeps its owner, its search path and its (internal) grants.
--   Disciplines left without a type, because their whole list is one administrative line: 000, 002, 003, 006, 037001,
--   037003, 037007, 037010, 037014, 050, 051, 053, 061, 069002, 071, 073, 081, 082, 085, 086003, 096, 097, 098, 102, 104,
--   113, 115, 116, 116001, 117, 117001, 118, 118001, 119001. The sub-lists (014003, 018001, 044300, 052001 ...) stay
--   available to a practice administrator on Admin > Tariffs > Practice tariff, as before.
--
-- Until it is applied the app uses its built-in copy of the links, and lab orders stay with the type 'dental'.
-- Apply: run the part between BEGIN; and ROLLBACK; as one migration (running it again changes nothing).
-- Undo:  CREATE OR REPLACE public.dental_lab_practice_for as in section 4a of proposals/2026-10-13-dental-lab-work.sql;
--        DROP FUNCTION public.is_dental_practice_type(text);
--        DELETE FROM public.practice_types t WHERE t.name IN (<the 54 names of section 1>) AND NOT EXISTS (SELECT 1 FROM
--          public.practices p WHERE p.practice_type_id = t.id OR lower(btrim(p.practice_type)) = t.name);
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The practice types, each with its NAMAF discipline
-- ---------------------------------------------------------------------------------------------

INSERT INTO public.practice_types (name, description, is_active, namaf_discipline_code) VALUES
  -- Dental specialists (section 2: they work like a dental practice, except the laboratory)
  ('orthodontist', 'orthodontist practice type', true, '064'),
  ('maxillofacial_oral_surgeon', 'maxillo-facial and oral surgeon practice type', true, '062'),
  ('periodontist', 'periodontist and oral medicine practice type', true, '092'),
  ('prosthodontist', 'prosthodontist practice type', true, '094'),
  ('dental_therapist', 'dental therapist practice type', true, '095'),
  ('dental_technician', 'dental technician (laboratory) practice type', true, '093'),
  -- Doctors
  ('family_medicine', 'family medicine practice type', true, '015'),
  ('pulmonologist', 'pulmonologist practice type', true, '017'),
  ('gastroenterologist', 'gastroenterologist practice type', true, '019'),
  ('medical_oncologist', 'medical oncologist practice type', true, '023'),
  ('neurosurgeon', 'neurosurgeon practice type', true, '024'),
  ('nuclear_physician', 'nuclear physician practice type', true, '025'),
  ('clinical_hematologist', 'clinical haematologist practice type', true, '027'),
  ('rheumatology', 'rheumatology practice type', true, '031'),
  ('pediatric_cardiologist', 'paediatric cardiologist practice type', true, '033'),
  ('physical_medicine', 'physical medicine practice type', true, '034'),
  ('emergency_medicine', 'emergency medicine specialist practice type', true, '035'),
  ('plastic_surgeon', 'plastic surgeon practice type', true, '036'),
  ('radiation_oncologist', 'radiation oncologist practice type', true, '040'),
  ('thoracic_surgeon', 'thoracic and cardio-thoracic surgeon practice type', true, '044'),
  ('pediatric_surgeon', 'paediatric surgeon practice type', true, '114'),
  -- Allied health
  ('medical_technology_lab', 'medical technology laboratory practice type', true, '037'),
  ('radiographer', 'radiographer practice type', true, '039'),
  ('sonographer', 'sonographer practice type', true, '039004'),
  ('art_therapist', 'art therapist practice type', true, '067'),
  ('podiatrist', 'podiatrist practice type', true, '068'),
  ('medical_scientist', 'medical scientist practice type', true, '069'),
  ('orthoptist', 'orthoptist practice type', true, '074'),
  ('clinical_technologist', 'clinical technologist practice type', true, '075'),
  ('hearing_aid_acoustician', 'hearing aid acoustician practice type', true, '083'),
  ('orthotist_prosthetist', 'orthotist and prosthetist practice type', true, '087'),
  ('social_worker', 'social worker practice type', true, '089'),
  ('psychological_counsellor', 'psychological counsellor practice type', true, '099'),
  -- Complementary medicine
  ('chiropractor', 'chiropractor practice type', true, '004'),
  ('chinese_medicine_practitioner', 'Chinese medicine practitioner practice type', true, '007'),
  ('homeopath', 'homeopath practice type', true, '008'),
  ('naturopath', 'naturopath practice type', true, '101'),
  ('phytotherapist', 'phytotherapist practice type', true, '103'),
  ('acupuncturist', 'acupuncturist practice type', true, '105'),
  -- Hospitals, clinics and services
  ('ambulance_service', 'ambulance service practice type', true, '009'),
  ('ambulance_intermediate', 'ambulance service (intermediate) practice type', true, '011'),
  ('ambulance_basic', 'ambulance service (basic) practice type', true, '013'),
  ('drug_and_alcohol', 'drug and alcohol treatment practice type', true, '047'),
  ('sub_acute_facility', 'sub-acute facility practice type', true, '049'),
  ('mental_health_institute', 'mental health institute practice type', true, '055'),
  ('provincial_hospital', 'provincial (state) hospital practice type', true, '056'),
  ('private_hospital_b', 'private hospital (B tariff) practice type', true, '058'),
  ('rehabilitation_hospital', 'rehabilitation hospital practice type', true, '059'),
  ('day_clinic_077', 'day clinic (NAMAF list 077) practice type', true, '077'),
  ('blood_transfusion_service', 'blood transfusion service practice type', true, '078'),
  ('hospice', 'hospice practice type', true, '079'),
  ('nursing_agency', 'nursing agency practice type', true, '080'),
  ('clinical_support_services', 'clinical and support services practice type', true, '090'),
  ('oncology_unit', 'stand-alone oncology unit practice type', true, '120000')
ON CONFLICT (name) DO UPDATE
  SET namaf_discipline_code = EXCLUDED.namaf_discipline_code, updated_at = now()
  WHERE practice_types.namaf_discipline_code IS DISTINCT FROM EXCLUDED.namaf_discipline_code;

-- ---------------------------------------------------------------------------------------------
-- 2. Which practice types work like a dental practice
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_dental_practice_type(p_practice_type text)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT lower(btrim(COALESCE(p_practice_type, ''))) IN (
    'dental', 'dental_practice', 'orthodontist', 'maxillofacial_oral_surgeon', 'periodontist', 'prosthodontist', 'dental_therapist'
  )
$$;

REVOKE ALL ON FUNCTION public.is_dental_practice_type(text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.is_dental_practice_type(text) IS
  'True for the practice types that work like a dental practice: dental and the dental specialists (and dental_practice, the text one practice holds, which the app reads as dental). The app''s copy is DENTAL_PRACTICE_TYPES in src/utils/billing/practiceTypeNames.ts. Internal: used by dental_lab_practice_for.';

-- ---------------------------------------------------------------------------------------------
-- 3. Lab orders are for every dental practice type (was: the type 'dental' alone)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dental_lab_practice_for(p_patient_id uuid, p_clinical boolean)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
  v_role text;
BEGIN
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = p_patient_id;
  SELECT u.role INTO v_role
    FROM public.users u
   WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND v_practice IS NOT NULL AND u.practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only staff of the patient''s practice can change this patient''s lab work' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.practices pr WHERE pr.id = v_practice AND public.is_dental_practice_type(pr.practice_type)) THEN
    RAISE EXCEPTION 'Lab orders are for dental practices' USING ERRCODE = '42501';
  END IF;
  IF p_clinical AND COALESCE(v_role, '') NOT IN ('doctor', 'nurse', 'admin') THEN
    RAISE EXCEPTION 'Only a practitioner, nurse or practice admin can order lab work or change an order' USING ERRCODE = '42501';
  END IF;
  RETURN v_practice;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks and result (read only)
-- ---------------------------------------------------------------------------------------------

-- A type whose discipline is not in the NAMAF list: no rows when all is well
SELECT pt.name, pt.namaf_discipline_code AS discipline_not_in_the_list
  FROM public.practice_types pt
 WHERE pt.namaf_discipline_code IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.namaf_tariff_disciplines d WHERE d.discipline_code = pt.namaf_discipline_code);

SELECT pt.name, pt.namaf_discipline_code, d.discipline_name, d.codes, d.priced_codes
  FROM public.practice_types pt
  LEFT JOIN public.namaf_tariff_disciplines d ON d.discipline_code = pt.namaf_discipline_code
 ORDER BY pt.name;

-- The types that work like dental
SELECT pt.name FROM public.practice_types pt WHERE public.is_dental_practice_type(pt.name) ORDER BY pt.name;

ROLLBACK;

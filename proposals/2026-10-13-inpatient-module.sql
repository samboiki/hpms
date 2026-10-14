-- Applied 2026-10-13 as migration inpatient_module_2026_10_13 (version 20261013195423; stored statement md5 f35d985710278420c8c7fae3716dce05 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked: the foreign key still on beds, no inpatient function):
-- anon and a patient-app login could not admit (42501); the receptionist could not set up a ward (42501), was refused an
-- admission without a reason, a second stay for the same patient, a taken bed and a receptionist as doctor (22023), and
-- admitted two invented stays (ADM-2026-000001 and -000002; the bed occupied, the ward's count +2); a nurse moved a patient
-- (old bed to cleaning, new bed occupied, one history row; a taken bed refused); the receptionist could not take a bed out
-- of use (42501) or free an occupied bed (22023) and marked the cleaned bed free (cleaned time set); nurses could not
-- record a round or prescribe (42501); a doctor recorded a round, could not change a nurse's record (42501) and prescribed
-- (times sorted, 5 days); a nurse recorded a dose given and one refused with a reason (the same dose twice and a refusal
-- without a reason refused); a doctor could not stop a medicine without a reason, then stopped it (a dose after refused);
-- visitors in and out (out twice refused); another practice read 0 admissions and could not change an admission, a bed or
-- a visitor (42501); the administrator added a ward (codes upper case, one daily code kept once) and a bed (total 1), and
-- was refused a rate with 3 decimals, visiting hours back to front and closing a ward with a patient in it (22023); the
-- receptionist could not discharge (42501); the doctor discharged (bed to cleaning, medicines completed, visitors signed
-- out; a round afterwards refused). After applying, again rolled back: a doctor's admission names them admitting doctor;
-- the stay was linked to the patient's invoice both ways, another patient's invoice and billing twice refused (22023).
-- =============================================================================================
-- PROPOSAL: the Inpatient page: wards and beds, admit, transfer, discharge and bill the stay, ward rounds, nursing
--           records per shift, the medication chart and the visitor log
-- File:   proposals/2026-10-13-inpatient-module.sql          Drafted: 2026-10-13
-- Needs:  proposals/2026-10-13-inpatient-access.sql (row level security on these tables, SELECT only for staff)
-- Code:   src/components/inpatient/* (the page, sidebar entry "Inpatient" before Stock), src/services/inpatientService.ts
--         (reads and these functions; "not set up yet" before this file), src/utils/inpatient/* (the rules, tested)
--
-- Why
--   The owner's earlier ward module lost its screens; its tables survived. Staff need to admit a patient to a bed,
--   move them, discharge and bill the stay, and record rounds, nursing care, medicines given and visitors. All writes go
--   through the functions below (staff of the practice, by role), so a bed can never hold two patients and the bed's
--   status, the ward's count and the history always agree.
--
-- What it does
--   1. bed_allocations.bed_id pointed at the other, unused bed table (beds); it now points at ward_beds, the beds of
--      hospital_wards (0 allocations existed, checked first). update_ward_occupancy then marks the real bed occupied on
--      admission and "cleaning" when the patient leaves it. One current bed per admission and one current admission per
--      bed; one active admission per patient.
--   2. Ward codes were unique across all practices, bed codes across all beds and admission numbers across all practices
--      (one practice's "W1" blocked another's, and numbers revealed other practices' admissions): now per practice
--      (ward codes, admission numbers) and per ward (bed codes). Admission numbers ADM-YYYY-NNNNNN count per practice,
--      under a lock so two admissions at the same moment never get the same number.
--   3. New columns: hospital_wards.bed_day_code (the tariff code a bed-day is billed under, at the bed's daily rate) and
--      daily_codes (codes billed once per day at their tariff price, e.g. a nursing fee); patient_admissions
--      discharged_by, billed_invoice_id and billed_at (the stay's invoice, so it is never billed twice).
--   4. Functions (SECURITY DEFINER, search_path public; signed-in staff only, of the practice):
--        inpatient_save_ward, inpatient_save_bed                 administrators
--        inpatient_set_bed_status                               any staff: clean / needs cleaning; administrators and
--                                                               nurses: out of use, reserved
--        inpatient_admit, inpatient_update_admission,
--        inpatient_transfer                                     any staff
--        inpatient_discharge                                    doctors, nurses, administrators
--        inpatient_save_round                                   doctors
--        inpatient_save_nursing_record                          nurses and doctors (their own records)
--        inpatient_prescribe, inpatient_discontinue_medication  doctors
--        inpatient_record_dose                                  nurses and doctors
--        inpatient_visitor_check_in, inpatient_visitor_check_out any staff
--        inpatient_mark_billed                                  any staff (after the invoice service created the invoice)
--   5. set_screen_access accepts 'inpatient': administrators choose which roles open the Inpatient page, as for Finance
--      and Stock (Settings > Users > Screen access).
--   The other set of tables (wards, beds, rooms) is not touched (question for the owner).
--
-- Apply: run the part between BEGIN; and ROLLBACK; (as a migration). Rehearse: run the whole file (it rolls back).
-- Undo:  DROP the inpatient_* functions; ALTER TABLE bed_allocations DROP CONSTRAINT bed_allocations_bed_id_fkey (and
--        re-add it to beds only while no allocation exists); the unique constraints back as they were; DROP the new
--        columns; set_screen_access as in proposals/2026-10-08-screen-access.sql.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bed_allocations) THEN
    RAISE EXCEPTION 'Check failed: bed_allocations has rows; their bed_id may point at the other bed table. Stop and look.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.patient_admissions'::regclass) THEN
    RAISE EXCEPTION 'Check failed: apply proposals/2026-10-13-inpatient-access.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Allocations point at the ward beds; one bed per admission, one admission per bed, one stay per patient
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.bed_allocations DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey;
ALTER TABLE public.bed_allocations
  ADD CONSTRAINT bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.ward_beds(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS bed_allocations_one_current_per_bed ON public.bed_allocations (bed_id) WHERE is_current;
CREATE UNIQUE INDEX IF NOT EXISTS bed_allocations_one_current_per_admission ON public.bed_allocations (admission_id) WHERE is_current;
CREATE UNIQUE INDEX IF NOT EXISTS patient_admissions_one_active_per_patient ON public.patient_admissions (patient_id)
  WHERE admission_status = 'active';

-- ---------------------------------------------------------------------------------------------
-- 2. Codes and numbers per practice
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.hospital_wards DROP CONSTRAINT IF EXISTS hospital_wards_ward_code_key;
ALTER TABLE public.hospital_wards ADD CONSTRAINT hospital_wards_practice_ward_code_key UNIQUE (practice_id, ward_code);
ALTER TABLE public.ward_beds DROP CONSTRAINT IF EXISTS ward_beds_bed_code_key;
ALTER TABLE public.ward_beds ADD CONSTRAINT ward_beds_ward_bed_code_key UNIQUE (ward_id, bed_code);
ALTER TABLE public.patient_admissions DROP CONSTRAINT IF EXISTS patient_admissions_admission_number_key;
ALTER TABLE public.patient_admissions ADD CONSTRAINT patient_admissions_practice_number_key UNIQUE (practice_id, admission_number);

CREATE OR REPLACE FUNCTION public.set_admission_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text;
  v_next integer;
BEGIN
  IF NEW.admission_number IS NULL THEN
    v_prefix := 'ADM-' || to_char(now() AT TIME ZONE 'Africa/Windhoek', 'YYYY') || '-';
    -- One admission at a time per practice takes the next number
    PERFORM pg_advisory_xact_lock(hashtext('admission_number:' || NEW.practice_id::text));
    SELECT COALESCE(max(substring(a.admission_number FROM length(v_prefix) + 1)::integer), 0) + 1 INTO v_next
      FROM patient_admissions a
     WHERE a.practice_id = NEW.practice_id AND a.admission_number LIKE v_prefix || '%'
       AND substring(a.admission_number FROM length(v_prefix) + 1) ~ '^[0-9]+$';
    NEW.admission_number := v_prefix || lpad(v_next::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_admission_number() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. New columns
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.hospital_wards ADD COLUMN IF NOT EXISTS bed_day_code text;
ALTER TABLE public.hospital_wards ADD COLUMN IF NOT EXISTS daily_codes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.patient_admissions ADD COLUMN IF NOT EXISTS discharged_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.patient_admissions ADD COLUMN IF NOT EXISTS billed_invoice_id uuid REFERENCES public.invoices_enhanced(id) ON DELETE SET NULL;
ALTER TABLE public.patient_admissions ADD COLUMN IF NOT EXISTS billed_at timestamptz;

-- ---------------------------------------------------------------------------------------------
-- 4. The functions
-- ---------------------------------------------------------------------------------------------

-- The signed-in staff member's role in their practice (practice and role), or refused. For the functions below only.
CREATE OR REPLACE FUNCTION public.inpatient_caller(OUT practice_id uuid, OUT role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT u.practice_id, u.role INTO practice_id, role
    FROM users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true);
  IF practice_id IS NULL THEN
    RAISE EXCEPTION 'Only the practice''s staff can do this.' USING ERRCODE = '42501';
  END IF;
END
$function$;

-- An active admission of the caller's practice, for a change (locked), or refused
CREATE OR REPLACE FUNCTION public.inpatient_active_admission(p_admission_id uuid, p_practice_id uuid)
 RETURNS public.patient_admissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row patient_admissions%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM patient_admissions a WHERE a.id = p_admission_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.practice_id IS DISTINCT FROM p_practice_id THEN
    RAISE EXCEPTION 'This admission was not found in your practice.' USING ERRCODE = '42501';
  END IF;
  IF v_row.admission_status <> 'active' THEN
    RAISE EXCEPTION 'This patient has already been discharged.' USING ERRCODE = '22023';
  END IF;
  RETURN v_row;
END
$function$;

-- A doctor of the practice (or nobody), for the admitting and attending doctor
CREATE OR REPLACE FUNCTION public.inpatient_check_doctor(p_user_id uuid, p_practice_id uuid, p_what text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p_user_id AND u.practice_id = p_practice_id AND u.role = 'doctor'
                    AND COALESCE(u.is_active, true)) THEN
    RAISE EXCEPTION 'Choose the % from the practice''s doctors.', p_what USING ERRCODE = '22023';
  END IF;
  RETURN p_user_id;
END
$function$;

-- Text of a JSON field, trimmed, NULL when empty
CREATE OR REPLACE FUNCTION public.inpatient_text(p_value jsonb, p_key text, p_max integer DEFAULT 2000)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT left(NULLIF(btrim(COALESCE(p_value->>p_key, '')), ''), p_max)
$function$;

-- A JSON array of texts as text[] (empty entries dropped)
CREATE OR REPLACE FUNCTION public.inpatient_texts(p_value jsonb, p_key text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(left(btrim(e), 300)) FILTER (WHERE btrim(e) <> ''), '{}')
    FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_value->p_key) = 'array' THEN p_value->p_key ELSE '[]'::jsonb END) AS t(e)
$function$;

-- 4.1 Wards (administrators)
CREATE OR REPLACE FUNCTION public.inpatient_save_ward(p_id uuid, p_ward jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_name text := inpatient_text(p_ward, 'ward_name', 120);
  v_code text := upper(inpatient_text(p_ward, 'ward_code', 20));
  v_type text := COALESCE(inpatient_text(p_ward, 'ward_type'), 'general');
  v_from time;
  v_to time;
  v_max integer;
  v_floor integer;
  v_active boolean := COALESCE((p_ward->>'is_active')::boolean, true);
  v_id uuid;
BEGIN
  IF v_me.role <> 'admin' THEN
    RAISE EXCEPTION 'Only the practice''s administrators set up wards and beds.' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Give the ward a name.' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('general', 'icu', 'pediatric', 'maternity', 'emergency', 'surgical', 'psychiatric', 'oncology') THEN
    RAISE EXCEPTION 'Choose the kind of ward from the list.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_from := NULLIF(p_ward->>'visiting_hours_start', '')::time;
    v_to := NULLIF(p_ward->>'visiting_hours_end', '')::time;
    v_max := NULLIF(p_ward->>'max_visitors_per_patient', '')::integer;
    v_floor := NULLIF(p_ward->>'floor_number', '')::integer;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Visiting hours are times (14:00), visitors and floor are whole numbers.' USING ERRCODE = '22023';
  END;
  IF (v_from IS NULL) <> (v_to IS NULL) OR v_from >= v_to THEN
    RAISE EXCEPTION 'Visiting hours need a start before the end (or leave both empty).' USING ERRCODE = '22023';
  END IF;
  IF v_max IS NOT NULL AND (v_max < 1 OR v_max > 20) THEN
    RAISE EXCEPTION 'Visitors at a time: between 1 and 20.' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO hospital_wards (practice_id, ward_name, ward_code, ward_type, floor_number, description, visiting_hours_start,
                                visiting_hours_end, max_visitors_per_patient, is_active, bed_day_code, daily_codes, total_beds, occupied_beds)
    VALUES (v_me.practice_id, v_name, v_code, v_type, v_floor, inpatient_text(p_ward, 'description', 500), v_from, v_to,
            COALESCE(v_max, 2), v_active, upper(inpatient_text(p_ward, 'bed_day_code', 20)),
            ARRAY(SELECT DISTINCT upper(c) FROM unnest(inpatient_texts(p_ward, 'daily_codes')) c), 0, 0)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  SELECT w.id INTO v_id FROM hospital_wards w WHERE w.id = p_id AND w.practice_id = v_me.practice_id FOR UPDATE;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This ward was not found in your practice.' USING ERRCODE = '42501';
  END IF;
  IF NOT v_active AND EXISTS (SELECT 1 FROM bed_allocations b WHERE b.ward_id = v_id AND b.is_current) THEN
    RAISE EXCEPTION 'Patients are still in this ward. Move or discharge them before closing it.' USING ERRCODE = '22023';
  END IF;
  UPDATE hospital_wards SET
    ward_name = v_name, ward_code = v_code, ward_type = v_type, floor_number = v_floor,
    description = inpatient_text(p_ward, 'description', 500), visiting_hours_start = v_from, visiting_hours_end = v_to,
    max_visitors_per_patient = COALESCE(v_max, 2), is_active = v_active,
    bed_day_code = upper(inpatient_text(p_ward, 'bed_day_code', 20)),
    daily_codes = ARRAY(SELECT DISTINCT upper(c) FROM unnest(inpatient_texts(p_ward, 'daily_codes')) c),
    updated_at = now()
  WHERE id = v_id;
  RETURN v_id;
END
$function$;

-- 4.2 Beds (administrators). The ward's bed count follows its active beds.
CREATE OR REPLACE FUNCTION public.inpatient_save_bed(p_id uuid, p_ward_id uuid, p_bed jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_number text := inpatient_text(p_bed, 'bed_number', 20);
  v_bed_type text := COALESCE(inpatient_text(p_bed, 'bed_type'), 'standard');
  v_room_type text := inpatient_text(p_bed, 'room_type');
  v_active boolean := COALESCE((p_bed->>'is_active')::boolean, true);
  v_rate numeric;
  v_id uuid;
BEGIN
  IF v_me.role <> 'admin' THEN
    RAISE EXCEPTION 'Only the practice''s administrators set up wards and beds.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM hospital_wards w WHERE w.id = p_ward_id AND w.practice_id = v_me.practice_id) THEN
    RAISE EXCEPTION 'This ward was not found in your practice.' USING ERRCODE = '42501';
  END IF;
  IF v_number IS NULL THEN
    RAISE EXCEPTION 'Give the bed a number or name.' USING ERRCODE = '22023';
  END IF;
  IF v_bed_type NOT IN ('standard', 'icu', 'pediatric', 'isolation', 'vip', 'emergency')
     OR (v_room_type IS NOT NULL AND v_room_type NOT IN ('single', 'double', 'ward', 'isolation', 'vip')) THEN
    RAISE EXCEPTION 'Choose the kind of bed and room from the lists.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_rate := NULLIF(p_bed->>'daily_rate', '')::numeric;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'The daily rate is an amount in N$, e.g. 1250.00.' USING ERRCODE = '22023';
  END;
  IF v_rate IS NOT NULL AND (v_rate < 0 OR v_rate <> round(v_rate, 2) OR v_rate > 1000000) THEN
    RAISE EXCEPTION 'The daily rate is an amount in N$ with at most 2 decimals.' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO ward_beds (ward_id, bed_number, bed_code, bed_type, room_number, room_type, daily_rate, notes, is_active, status)
    VALUES (p_ward_id, v_number, upper(inpatient_text(p_bed, 'bed_code', 20)), v_bed_type, inpatient_text(p_bed, 'room_number', 20),
            v_room_type, v_rate, inpatient_text(p_bed, 'notes', 500), v_active, 'available')
    RETURNING id INTO v_id;
  ELSE
    SELECT b.id INTO v_id FROM ward_beds b WHERE b.id = p_id AND b.ward_id = p_ward_id FOR UPDATE;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'This bed was not found in this ward.' USING ERRCODE = '42501';
    END IF;
    IF NOT v_active AND EXISTS (SELECT 1 FROM bed_allocations a WHERE a.bed_id = v_id AND a.is_current) THEN
      RAISE EXCEPTION 'A patient is in this bed. Move or discharge them before taking it out of use.' USING ERRCODE = '22023';
    END IF;
    UPDATE ward_beds SET
      bed_number = v_number, bed_code = upper(inpatient_text(p_bed, 'bed_code', 20)), bed_type = v_bed_type,
      room_number = inpatient_text(p_bed, 'room_number', 20), room_type = v_room_type, daily_rate = v_rate,
      notes = inpatient_text(p_bed, 'notes', 500), is_active = v_active, updated_at = now()
    WHERE id = v_id;
  END IF;
  UPDATE hospital_wards w SET total_beds = (SELECT count(*) FROM ward_beds b WHERE b.ward_id = w.id AND COALESCE(b.is_active, true)),
                              updated_at = now()
   WHERE w.id = p_ward_id;
  RETURN v_id;
END
$function$;

-- 4.3 A bed's status (clean, needs cleaning, out of use, reserved); never while a patient is in it
CREATE OR REPLACE FUNCTION public.inpatient_set_bed_status(p_bed_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_bed ward_beds%ROWTYPE;
BEGIN
  SELECT b.* INTO v_bed FROM ward_beds b JOIN hospital_wards w ON w.id = b.ward_id
   WHERE b.id = p_bed_id AND w.practice_id = v_me.practice_id FOR UPDATE OF b;
  IF v_bed.id IS NULL THEN
    RAISE EXCEPTION 'This bed was not found in your practice.' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('available', 'cleaning', 'maintenance', 'blocked', 'reserved') THEN
    RAISE EXCEPTION 'Choose free, needs cleaning, out of use or reserved.' USING ERRCODE = '22023';
  END IF;
  IF p_status IN ('maintenance', 'blocked', 'reserved') AND v_me.role NOT IN ('admin', 'nurse') THEN
    RAISE EXCEPTION 'Only administrators and nurses take a bed out of use or reserve it.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM bed_allocations a WHERE a.bed_id = p_bed_id AND a.is_current) THEN
    RAISE EXCEPTION 'A patient is in this bed. Move or discharge them first.' USING ERRCODE = '22023';
  END IF;
  UPDATE ward_beds SET status = p_status,
         last_cleaned_at = CASE WHEN p_status = 'available' AND v_bed.status = 'cleaning' THEN now() ELSE last_cleaned_at END,
         updated_at = now()
   WHERE id = p_bed_id;
END
$function$;

-- A free bed of the practice, locked, for an admission or a transfer
CREATE OR REPLACE FUNCTION public.inpatient_free_bed(p_bed_id uuid, p_practice_id uuid)
 RETURNS public.ward_beds
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bed ward_beds%ROWTYPE;
BEGIN
  SELECT b.* INTO v_bed FROM ward_beds b JOIN hospital_wards w ON w.id = b.ward_id
   WHERE b.id = p_bed_id AND w.practice_id = p_practice_id AND COALESCE(w.is_active, true) AND COALESCE(b.is_active, true)
   FOR UPDATE OF b;
  IF v_bed.id IS NULL THEN
    RAISE EXCEPTION 'Choose a bed in one of your practice''s open wards.' USING ERRCODE = '22023';
  END IF;
  IF v_bed.status NOT IN ('available', 'reserved') OR EXISTS (SELECT 1 FROM bed_allocations a WHERE a.bed_id = v_bed.id AND a.is_current) THEN
    RAISE EXCEPTION 'Bed % is not free. Choose a free bed.', v_bed.bed_number USING ERRCODE = '22023';
  END IF;
  RETURN v_bed;
END
$function$;

-- 4.4 Admit (any staff): the admission and its first bed
CREATE OR REPLACE FUNCTION public.inpatient_admit(p_patient_id uuid, p_bed_id uuid, p_admission jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_bed ward_beds%ROWTYPE;
  v_visit uuid := NULLIF(p_admission->>'visit_id', '')::uuid;
  v_type text := inpatient_text(p_admission, 'admission_type');
  v_source text := inpatient_text(p_admission, 'admission_source');
  v_condition text := inpatient_text(p_admission, 'patient_condition');
  v_complaint text := inpatient_text(p_admission, 'chief_complaint');
  v_when timestamptz;
  v_expected date;
  v_admitting uuid;
  v_attending uuid;
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = p_patient_id AND p.practice_id = v_me.practice_id) THEN
    RAISE EXCEPTION 'This patient was not found in your practice.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM patient_admissions a WHERE a.patient_id = p_patient_id AND a.admission_status = 'active') THEN
    RAISE EXCEPTION 'This patient is already admitted. Transfer them to another bed instead.' USING ERRCODE = '22023';
  END IF;
  IF v_visit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.id = v_visit AND v.patient_id = p_patient_id
                                                                   AND v.practice_id = v_me.practice_id) THEN
    RAISE EXCEPTION 'The visit is not one of this patient''s visits.' USING ERRCODE = '22023';
  END IF;
  IF v_type IS NULL OR v_type NOT IN ('emergency', 'scheduled', 'transfer_in', 'referral', 'newborn') THEN
    RAISE EXCEPTION 'Choose the kind of admission.' USING ERRCODE = '22023';
  END IF;
  IF v_source IS NOT NULL AND v_source NOT IN ('emergency_room', 'outpatient_clinic', 'transfer_hospital', 'transfer_ward', 'physician_referral', 'walk_in') THEN
    RAISE EXCEPTION 'Choose where the patient came from in the list.' USING ERRCODE = '22023';
  END IF;
  IF v_condition IS NOT NULL AND v_condition NOT IN ('stable', 'fair', 'serious', 'critical', 'undetermined') THEN
    RAISE EXCEPTION 'Choose the patient''s condition from the list.' USING ERRCODE = '22023';
  END IF;
  IF v_complaint IS NULL THEN
    RAISE EXCEPTION 'Say why the patient is admitted.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_when := COALESCE(NULLIF(p_admission->>'admission_date', '')::timestamptz, now());
    v_expected := NULLIF(p_admission->>'expected_discharge_date', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'The admission time or expected discharge day is not a valid date.' USING ERRCODE = '22023';
  END;
  IF v_when > now() + interval '5 minutes' OR v_when < now() - interval '30 days' THEN
    RAISE EXCEPTION 'The admission time must be within the last 30 days and not in the future.' USING ERRCODE = '22023';
  END IF;
  IF v_expected IS NOT NULL AND v_expected < (v_when AT TIME ZONE 'Africa/Windhoek')::date THEN
    RAISE EXCEPTION 'The expected discharge day is before the admission.' USING ERRCODE = '22023';
  END IF;
  v_admitting := inpatient_check_doctor(COALESCE(NULLIF(p_admission->>'admitting_doctor_id', '')::uuid,
                                                 CASE WHEN v_me.role = 'doctor' THEN auth.uid() END), v_me.practice_id, 'admitting doctor');
  v_attending := inpatient_check_doctor(COALESCE(NULLIF(p_admission->>'attending_doctor_id', '')::uuid, v_admitting),
                                        v_me.practice_id, 'attending doctor');
  v_bed := inpatient_free_bed(p_bed_id, v_me.practice_id);

  INSERT INTO patient_admissions (
    patient_id, visit_id, practice_id, admission_date, expected_discharge_date, admission_type, admission_source,
    attending_doctor_id, admitting_doctor_id, referring_doctor_name, referring_hospital, chief_complaint, primary_diagnosis,
    primary_diagnosis_code, secondary_diagnoses, secondary_diagnosis_codes, admission_status, patient_condition,
    pre_authorization_number, special_requirements, isolation_required, isolation_type, fall_risk, allergy_alert)
  VALUES (
    p_patient_id, v_visit, v_me.practice_id, v_when, v_expected, v_type, v_source,
    v_attending, v_admitting, inpatient_text(p_admission, 'referring_doctor_name', 120), inpatient_text(p_admission, 'referring_hospital', 120),
    v_complaint, inpatient_text(p_admission, 'primary_diagnosis', 300), upper(inpatient_text(p_admission, 'primary_diagnosis_code', 12)),
    inpatient_texts(p_admission, 'secondary_diagnoses'), ARRAY(SELECT upper(c) FROM unnest(inpatient_texts(p_admission, 'secondary_diagnosis_codes')) c),
    'active', v_condition, inpatient_text(p_admission, 'pre_authorization_number', 40), inpatient_texts(p_admission, 'special_requirements'),
    COALESCE((p_admission->>'isolation_required')::boolean, false), inpatient_text(p_admission, 'isolation_type', 80),
    COALESCE((p_admission->>'fall_risk')::boolean, false), COALESCE((p_admission->>'allergy_alert')::boolean, false))
  RETURNING id INTO v_id;

  INSERT INTO bed_allocations (admission_id, bed_id, patient_id, ward_id, allocated_at, allocated_by, is_current)
  VALUES (v_id, v_bed.id, p_patient_id, v_bed.ward_id, v_when, auth.uid(), true);
  RETURN v_id;
END
$function$;

-- 4.5 Change an active admission's details (any staff). Only the keys sent change.
CREATE OR REPLACE FUNCTION public.inpatient_update_admission(p_admission_id uuid, p_admission jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_row patient_admissions%ROWTYPE := inpatient_active_admission(p_admission_id, v_me.practice_id);
  v_visit uuid;
  v_condition text := inpatient_text(p_admission, 'patient_condition');
  v_expected date;
BEGIN
  IF p_admission ? 'visit_id' THEN
    v_visit := NULLIF(p_admission->>'visit_id', '')::uuid;
    IF v_visit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.id = v_visit AND v.patient_id = v_row.patient_id
                                                                     AND v.practice_id = v_me.practice_id) THEN
      RAISE EXCEPTION 'The visit is not one of this patient''s visits.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_admission ? 'chief_complaint' AND inpatient_text(p_admission, 'chief_complaint') IS NULL THEN
    RAISE EXCEPTION 'Say why the patient is admitted.' USING ERRCODE = '22023';
  END IF;
  IF v_condition IS NOT NULL AND v_condition NOT IN ('stable', 'fair', 'serious', 'critical', 'undetermined') THEN
    RAISE EXCEPTION 'Choose the patient''s condition from the list.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_expected := NULLIF(p_admission->>'expected_discharge_date', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'The expected discharge day is not a valid date.' USING ERRCODE = '22023';
  END;
  IF v_expected IS NOT NULL AND v_expected < (v_row.admission_date AT TIME ZONE 'Africa/Windhoek')::date THEN
    RAISE EXCEPTION 'The expected discharge day is before the admission.' USING ERRCODE = '22023';
  END IF;
  UPDATE patient_admissions a SET
    visit_id = CASE WHEN p_admission ? 'visit_id' THEN v_visit ELSE a.visit_id END,
    attending_doctor_id = CASE WHEN p_admission ? 'attending_doctor_id'
      THEN inpatient_check_doctor(NULLIF(p_admission->>'attending_doctor_id', '')::uuid, v_me.practice_id, 'attending doctor')
      ELSE a.attending_doctor_id END,
    chief_complaint = CASE WHEN p_admission ? 'chief_complaint' THEN inpatient_text(p_admission, 'chief_complaint') ELSE a.chief_complaint END,
    primary_diagnosis = CASE WHEN p_admission ? 'primary_diagnosis' THEN inpatient_text(p_admission, 'primary_diagnosis', 300) ELSE a.primary_diagnosis END,
    primary_diagnosis_code = CASE WHEN p_admission ? 'primary_diagnosis_code' THEN upper(inpatient_text(p_admission, 'primary_diagnosis_code', 12)) ELSE a.primary_diagnosis_code END,
    secondary_diagnoses = CASE WHEN p_admission ? 'secondary_diagnoses' THEN inpatient_texts(p_admission, 'secondary_diagnoses') ELSE a.secondary_diagnoses END,
    secondary_diagnosis_codes = CASE WHEN p_admission ? 'secondary_diagnosis_codes'
      THEN ARRAY(SELECT upper(c) FROM unnest(inpatient_texts(p_admission, 'secondary_diagnosis_codes')) c) ELSE a.secondary_diagnosis_codes END,
    patient_condition = CASE WHEN p_admission ? 'patient_condition' THEN v_condition ELSE a.patient_condition END,
    pre_authorization_number = CASE WHEN p_admission ? 'pre_authorization_number' THEN inpatient_text(p_admission, 'pre_authorization_number', 40) ELSE a.pre_authorization_number END,
    expected_discharge_date = CASE WHEN p_admission ? 'expected_discharge_date' THEN v_expected ELSE a.expected_discharge_date END,
    special_requirements = CASE WHEN p_admission ? 'special_requirements' THEN inpatient_texts(p_admission, 'special_requirements') ELSE a.special_requirements END,
    isolation_required = CASE WHEN p_admission ? 'isolation_required' THEN COALESCE((p_admission->>'isolation_required')::boolean, false) ELSE a.isolation_required END,
    isolation_type = CASE WHEN p_admission ? 'isolation_type' THEN inpatient_text(p_admission, 'isolation_type', 80) ELSE a.isolation_type END,
    fall_risk = CASE WHEN p_admission ? 'fall_risk' THEN COALESCE((p_admission->>'fall_risk')::boolean, false) ELSE a.fall_risk END,
    allergy_alert = CASE WHEN p_admission ? 'allergy_alert' THEN COALESCE((p_admission->>'allergy_alert')::boolean, false) ELSE a.allergy_alert END,
    updated_at = now()
  WHERE a.id = v_row.id;
END
$function$;

-- 4.6 Move to another bed (any staff): the old bed is released (to cleaning), the new one taken, the move recorded
CREATE OR REPLACE FUNCTION public.inpatient_transfer(p_admission_id uuid, p_to_bed_id uuid, p_reason_code text, p_reason text,
                                                    p_urgency text DEFAULT 'routine')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_row patient_admissions%ROWTYPE := inpatient_active_admission(p_admission_id, v_me.practice_id);
  v_current bed_allocations%ROWTYPE;
  v_bed ward_beds%ROWTYPE;
  v_reason text := left(NULLIF(btrim(COALESCE(p_reason, '')), ''), 500);
BEGIN
  IF p_reason_code IS NULL OR p_reason_code NOT IN ('medical_needs', 'patient_request', 'bed_availability', 'isolation') THEN
    RAISE EXCEPTION 'Choose why the patient moves.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_urgency, 'routine') NOT IN ('routine', 'urgent', 'emergency') THEN
    RAISE EXCEPTION 'Choose routine, urgent or emergency.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_current FROM bed_allocations a WHERE a.admission_id = v_row.id AND a.is_current FOR UPDATE;
  IF v_current.bed_id = p_to_bed_id THEN
    RAISE EXCEPTION 'The patient is already in this bed.' USING ERRCODE = '22023';
  END IF;
  v_bed := inpatient_free_bed(p_to_bed_id, v_me.practice_id);
  IF v_current.id IS NOT NULL THEN
    UPDATE bed_allocations SET is_current = false, released_at = now(), released_by = auth.uid(), transfer_reason = p_reason_code
     WHERE id = v_current.id;
  END IF;
  INSERT INTO bed_allocations (admission_id, bed_id, patient_id, ward_id, allocated_at, allocated_by, is_current, transfer_reason, notes)
  VALUES (v_row.id, v_bed.id, v_row.patient_id, v_bed.ward_id, now(), auth.uid(), true, p_reason_code, v_reason);
  INSERT INTO bed_transfer_history (admission_id, patient_id, from_bed_id, to_bed_id, from_ward_id, to_ward_id, transfer_datetime,
                                    transfer_reason, urgency, ordered_by, performed_by, notes)
  VALUES (v_row.id, v_row.patient_id, v_current.bed_id, v_bed.id, v_current.ward_id, v_bed.ward_id, now(),
          p_reason_code, COALESCE(p_urgency, 'routine'), auth.uid(), auth.uid(), v_reason);
END
$function$;

-- 4.7 Discharge (doctors, nurses, administrators): the bed goes to cleaning, the chart stops, visitors are signed out
CREATE OR REPLACE FUNCTION public.inpatient_discharge(p_admission_id uuid, p_discharge jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_row patient_admissions%ROWTYPE := inpatient_active_admission(p_admission_id, v_me.practice_id);
  v_type text := inpatient_text(p_discharge, 'discharge_type');
  v_condition text := inpatient_text(p_discharge, 'patient_condition');
  v_when timestamptz;
  v_follow date;
  v_status text;
BEGIN
  IF v_me.role NOT IN ('doctor', 'nurse', 'admin') THEN
    RAISE EXCEPTION 'Only doctors, nurses and administrators discharge a patient.' USING ERRCODE = '42501';
  END IF;
  IF v_type IS NULL OR v_type NOT IN ('home', 'transfer', 'expired', 'ama', 'hospice', 'rehab') THEN
    RAISE EXCEPTION 'Choose how the patient leaves.' USING ERRCODE = '22023';
  END IF;
  IF v_condition IS NOT NULL AND v_condition NOT IN ('stable', 'fair', 'serious', 'critical', 'undetermined') THEN
    RAISE EXCEPTION 'Choose the patient''s condition from the list.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_when := COALESCE(NULLIF(p_discharge->>'discharge_date', '')::timestamptz, now());
    v_follow := NULLIF(p_discharge->>'follow_up_date', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'The discharge time or follow-up day is not a valid date.' USING ERRCODE = '22023';
  END;
  IF v_when > now() + interval '5 minutes' OR v_when < v_row.admission_date THEN
    RAISE EXCEPTION 'The discharge time must be after the admission and not in the future.' USING ERRCODE = '22023';
  END IF;
  IF v_follow IS NOT NULL AND v_follow < (v_when AT TIME ZONE 'Africa/Windhoek')::date THEN
    RAISE EXCEPTION 'The follow-up day is before the discharge.' USING ERRCODE = '22023';
  END IF;
  v_status := CASE v_type WHEN 'expired' THEN 'deceased' WHEN 'ama' THEN 'left_ama' WHEN 'transfer' THEN 'transferred' ELSE 'discharged' END;

  UPDATE bed_allocations SET is_current = false, released_at = v_when, released_by = auth.uid(),
         transfer_reason = CASE WHEN v_type = 'expired' THEN 'deceased' ELSE 'discharge' END
   WHERE admission_id = v_row.id AND is_current;
  UPDATE inpatient_medications SET status = 'completed', end_datetime = LEAST(COALESCE(end_datetime, v_when), v_when), updated_at = now()
   WHERE admission_id = v_row.id AND status IN ('active', 'held');
  UPDATE visitor_logs SET check_out_time = v_when WHERE admission_id = v_row.id AND check_out_time IS NULL;
  UPDATE patient_admissions SET
    admission_status = v_status, actual_discharge_date = v_when, discharge_type = v_type,
    discharge_disposition = inpatient_text(p_discharge, 'discharge_disposition', 300),
    discharge_instructions = inpatient_text(p_discharge, 'discharge_instructions', 4000),
    follow_up_required = v_follow IS NOT NULL OR COALESCE((p_discharge->>'follow_up_required')::boolean, false),
    follow_up_date = v_follow, patient_condition = COALESCE(v_condition, patient_condition),
    discharged_by = auth.uid(), updated_at = now()
  WHERE id = v_row.id;
END
$function$;

-- 4.8 Ward round (doctors): a new note per round, never changed afterwards
CREATE OR REPLACE FUNCTION public.inpatient_save_round(p_admission_id uuid, p_round jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_row patient_admissions%ROWTYPE;
  v_condition text := inpatient_text(p_round, 'patient_condition');
  v_conscious text := inpatient_text(p_round, 'consciousness_level');
  v_type text := COALESCE(inpatient_text(p_round, 'round_type'), 'regular');
  v_next date;
  v_id uuid;
BEGIN
  IF v_me.role <> 'doctor' THEN
    RAISE EXCEPTION 'Only doctors record ward rounds.' USING ERRCODE = '42501';
  END IF;
  v_row := inpatient_active_admission(p_admission_id, v_me.practice_id);
  IF v_condition IS NULL OR v_condition NOT IN ('stable', 'improving', 'unchanged', 'deteriorating', 'critical') THEN
    RAISE EXCEPTION 'Choose how the patient is doing.' USING ERRCODE = '22023';
  END IF;
  IF v_conscious IS NOT NULL AND v_conscious NOT IN ('alert', 'drowsy', 'stuporous', 'comatose') THEN
    RAISE EXCEPTION 'Choose the level of consciousness from the list.' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('regular', 'emergency', 'discharge', 'consultation') THEN
    RAISE EXCEPTION 'Choose the kind of round from the list.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_next := NULLIF(p_round->>'next_review_date', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'The next review day is not a valid date.' USING ERRCODE = '22023';
  END;
  INSERT INTO ward_rounds (admission_id, patient_id, doctor_id, round_datetime, round_type, patient_condition, consciousness_level,
                           examination_findings, vital_signs_reviewed, lab_results_reviewed, imaging_reviewed, diagnosis_update,
                           treatment_changes, new_orders, continue_current_treatment, discharge_planning_started, doctor_notes,
                           family_updated, next_review_date)
  VALUES (v_row.id, v_row.patient_id, auth.uid(), now(), v_type, v_condition, v_conscious,
          inpatient_text(p_round, 'examination_findings', 4000), COALESCE((p_round->>'vital_signs_reviewed')::boolean, false),
          COALESCE((p_round->>'lab_results_reviewed')::boolean, false), COALESCE((p_round->>'imaging_reviewed')::boolean, false),
          inpatient_text(p_round, 'diagnosis_update', 1000), inpatient_text(p_round, 'treatment_changes', 2000),
          inpatient_texts(p_round, 'new_orders'), COALESCE((p_round->>'continue_current_treatment')::boolean, true),
          COALESCE((p_round->>'discharge_planning_started')::boolean, false), inpatient_text(p_round, 'doctor_notes', 4000),
          COALESCE((p_round->>'family_updated')::boolean, false), v_next)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

-- 4.9 Nursing record per shift (nurses and doctors; a record is changed only by who wrote it)
CREATE OR REPLACE FUNCTION public.inpatient_save_nursing_record(p_id uuid, p_admission_id uuid, p_record jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_row patient_admissions%ROWTYPE;
  v_shift text := inpatient_text(p_record, 'shift_type');
  v_mobility text := inpatient_text(p_record, 'mobility_status');
  v_start timestamptz;
  v_end timestamptz;
  v_pain integer;
  v_in integer;
  v_urine integer;
  v_other integer;
  v_vitals uuid[];
  v_id uuid;
BEGIN
  IF v_me.role NOT IN ('nurse', 'doctor') THEN
    RAISE EXCEPTION 'Only nurses and doctors write nursing records.' USING ERRCODE = '42501';
  END IF;
  v_row := inpatient_active_admission(p_admission_id, v_me.practice_id);
  IF v_shift IS NULL OR v_shift NOT IN ('morning', 'afternoon', 'night', 'custom') THEN
    RAISE EXCEPTION 'Choose the shift.' USING ERRCODE = '22023';
  END IF;
  IF v_mobility IS NOT NULL AND v_mobility NOT IN ('ambulatory', 'assisted', 'bedbound', 'wheelchair') THEN
    RAISE EXCEPTION 'Choose how the patient moves from the list.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_start := COALESCE(NULLIF(p_record->>'shift_start_time', '')::timestamptz, now());
    v_end := NULLIF(p_record->>'shift_end_time', '')::timestamptz;
    v_pain := NULLIF(p_record->>'pain_level', '')::integer;
    v_in := NULLIF(p_record->>'fluid_intake_ml', '')::integer;
    v_urine := NULLIF(p_record->>'urine_output_ml', '')::integer;
    v_other := NULLIF(p_record->>'other_output_ml', '')::integer;
    v_vitals := ARRAY(SELECT e::uuid FROM jsonb_array_elements_text(COALESCE(p_record->'vitals_ids', '[]'::jsonb)) e);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Times are dates with a time; pain, intake and output are whole numbers.' USING ERRCODE = '22023';
  END;
  IF v_end IS NOT NULL AND v_end < v_start THEN
    RAISE EXCEPTION 'The shift ends before it starts.' USING ERRCODE = '22023';
  END IF;
  IF v_pain IS NOT NULL AND (v_pain < 0 OR v_pain > 10) THEN
    RAISE EXCEPTION 'Pain is a score from 0 to 10.' USING ERRCODE = '22023';
  END IF;
  IF LEAST(v_in, v_urine, v_other) < 0 OR GREATEST(v_in, v_urine, v_other) > 20000 THEN
    RAISE EXCEPTION 'Intake and output are millilitres between 0 and 20000.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_vitals) vid
              WHERE NOT EXISTS (SELECT 1 FROM vitals vt WHERE vt.id = vid AND vt.visit_id = v_row.visit_id)) THEN
    RAISE EXCEPTION 'The vitals are not from this admission''s visit.' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO nursing_care_records (admission_id, patient_id, nurse_id, shift_type, shift_start_time, shift_end_time,
      vital_signs_checked, vitals_ids, fluid_intake_ml, urine_output_ml, other_output_ml, patient_condition, pain_level,
      mobility_status, skin_condition, bathed, position_changed, meals_taken, nursing_notes, alerts, handover_notes)
    VALUES (v_row.id, v_row.patient_id, auth.uid(), v_shift, v_start, v_end,
      COALESCE((p_record->>'vital_signs_checked')::boolean, false) OR cardinality(v_vitals) > 0, v_vitals, v_in, v_urine, v_other,
      inpatient_text(p_record, 'patient_condition', 300), v_pain, v_mobility, inpatient_text(p_record, 'skin_condition', 300),
      COALESCE((p_record->>'bathed')::boolean, false), COALESCE((p_record->>'position_changed')::boolean, false),
      inpatient_texts(p_record, 'meals_taken'), inpatient_text(p_record, 'nursing_notes', 4000), inpatient_texts(p_record, 'alerts'),
      inpatient_text(p_record, 'handover_notes', 4000))
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  SELECT r.id INTO v_id FROM nursing_care_records r WHERE r.id = p_id AND r.admission_id = v_row.id FOR UPDATE;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This nursing record was not found for this admission.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nursing_care_records r WHERE r.id = v_id AND r.nurse_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the person who wrote a nursing record changes it. Add your own record instead.' USING ERRCODE = '42501';
  END IF;
  UPDATE nursing_care_records SET shift_type = v_shift, shift_start_time = v_start, shift_end_time = v_end,
    vital_signs_checked = COALESCE((p_record->>'vital_signs_checked')::boolean, false) OR cardinality(v_vitals) > 0,
    vitals_ids = v_vitals, fluid_intake_ml = v_in, urine_output_ml = v_urine, other_output_ml = v_other,
    patient_condition = inpatient_text(p_record, 'patient_condition', 300), pain_level = v_pain, mobility_status = v_mobility,
    skin_condition = inpatient_text(p_record, 'skin_condition', 300), bathed = COALESCE((p_record->>'bathed')::boolean, false),
    position_changed = COALESCE((p_record->>'position_changed')::boolean, false), meals_taken = inpatient_texts(p_record, 'meals_taken'),
    nursing_notes = inpatient_text(p_record, 'nursing_notes', 4000), alerts = inpatient_texts(p_record, 'alerts'),
    handover_notes = inpatient_text(p_record, 'handover_notes', 4000), updated_at = now()
  WHERE id = v_id;
  RETURN v_id;
END
$function$;

-- 4.10 Prescribe on the inpatient chart (doctors)
CREATE OR REPLACE FUNCTION public.inpatient_prescribe(p_admission_id uuid, p_medication jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_row patient_admissions%ROWTYPE;
  v_name text := inpatient_text(p_medication, 'medication_name', 200);
  v_dose text := inpatient_text(p_medication, 'dosage', 60);
  v_route text := inpatient_text(p_medication, 'route');
  v_frequency text := inpatient_text(p_medication, 'frequency', 60);
  v_times time[];
  v_start timestamptz;
  v_end timestamptz;
  v_days integer;
  v_id uuid;
BEGIN
  IF v_me.role <> 'doctor' THEN
    RAISE EXCEPTION 'Only doctors prescribe on the medication chart.' USING ERRCODE = '42501';
  END IF;
  v_row := inpatient_active_admission(p_admission_id, v_me.practice_id);
  IF v_name IS NULL OR v_dose IS NULL OR v_frequency IS NULL THEN
    RAISE EXCEPTION 'Give the medicine, the dose and how often.' USING ERRCODE = '22023';
  END IF;
  IF v_route IS NULL OR v_route NOT IN ('oral', 'iv', 'im', 'subcutaneous', 'topical', 'inhalation', 'rectal', 'sublingual') THEN
    RAISE EXCEPTION 'Choose how the medicine is given.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_times := ARRAY(SELECT DISTINCT e::time FROM jsonb_array_elements_text(COALESCE(p_medication->'scheduled_times', '[]'::jsonb)) e ORDER BY 1);
    v_start := COALESCE(NULLIF(p_medication->>'start_datetime', '')::timestamptz, now());
    v_end := NULLIF(p_medication->>'end_datetime', '')::timestamptz;
    v_days := NULLIF(p_medication->>'duration_days', '')::integer;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Times of day are like 08:00; the start and end are dates with a time; days a whole number.' USING ERRCODE = '22023';
  END;
  IF cardinality(v_times) > 24 THEN
    RAISE EXCEPTION 'At most 24 times a day.' USING ERRCODE = '22023';
  END IF;
  IF v_days IS NOT NULL AND (v_days < 1 OR v_days > 365) THEN
    RAISE EXCEPTION 'The number of days is between 1 and 365.' USING ERRCODE = '22023';
  END IF;
  IF v_end IS NULL AND v_days IS NOT NULL THEN
    v_end := v_start + make_interval(days => v_days);
  END IF;
  IF v_end IS NOT NULL AND v_end <= v_start THEN
    RAISE EXCEPTION 'The medicine stops before it starts.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO inpatient_medications (admission_id, patient_id, medication_name, generic_name, dosage, dosage_unit, route, frequency,
    start_datetime, end_datetime, duration_days, prescribed_by, prescription_date, scheduled_times, administration_records, indication,
    special_instructions, prn_indication, max_daily_dose, status)
  VALUES (v_row.id, v_row.patient_id, v_name, inpatient_text(p_medication, 'generic_name', 200), v_dose,
    inpatient_text(p_medication, 'dosage_unit', 20), v_route, v_frequency, v_start, v_end, v_days, auth.uid(), now(), v_times, '[]'::jsonb,
    inpatient_text(p_medication, 'indication', 300), inpatient_text(p_medication, 'special_instructions', 1000),
    inpatient_text(p_medication, 'prn_indication', 300), inpatient_text(p_medication, 'max_daily_dose', 60), 'active')
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

-- 4.11 A dose given, missed, refused or held (nurses and doctors); one outcome per due dose, kept with who and when
CREATE OR REPLACE FUNCTION public.inpatient_record_dose(p_medication_id uuid, p_due_at timestamptz, p_outcome text, p_note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_med inpatient_medications%ROWTYPE;
  v_note text := left(NULLIF(btrim(COALESCE(p_note, '')), ''), 500);
  v_due text;
BEGIN
  IF v_me.role NOT IN ('nurse', 'doctor') THEN
    RAISE EXCEPTION 'Only nurses and doctors record doses.' USING ERRCODE = '42501';
  END IF;
  SELECT m.* INTO v_med FROM inpatient_medications m WHERE m.id = p_medication_id FOR UPDATE;
  IF v_med.id IS NULL THEN
    RAISE EXCEPTION 'This medicine was not found on the chart.' USING ERRCODE = '42501';
  END IF;
  PERFORM inpatient_active_admission(v_med.admission_id, v_me.practice_id);
  IF v_med.status <> 'active' THEN
    RAISE EXCEPTION 'This medicine is no longer active on the chart.' USING ERRCODE = '22023';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('given', 'missed', 'refused', 'held') THEN
    RAISE EXCEPTION 'Choose given, missed, refused or held.' USING ERRCODE = '22023';
  END IF;
  IF p_outcome <> 'given' AND v_note IS NULL THEN
    RAISE EXCEPTION 'Say why the dose was not given.' USING ERRCODE = '22023';
  END IF;
  IF p_due_at IS NULL OR p_due_at > now() + interval '2 hours' OR p_due_at < v_med.start_datetime - interval '1 day' THEN
    RAISE EXCEPTION 'Record a dose that is due now or was due earlier.' USING ERRCODE = '22023';
  END IF;
  v_due := to_char(p_due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:00"Z"');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_med.administration_records, '[]'::jsonb)) r WHERE r->>'due_at' = v_due) THEN
    RAISE EXCEPTION 'This dose is already recorded.' USING ERRCODE = '22023';
  END IF;
  UPDATE inpatient_medications SET
    administration_records = COALESCE(administration_records, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'due_at', v_due, 'outcome', p_outcome, 'recorded_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'recorded_by', auth.uid(), 'note', v_note)),
    updated_at = now()
  WHERE id = v_med.id;
END
$function$;

-- 4.12 Stop a medicine (doctors), with the reason
CREATE OR REPLACE FUNCTION public.inpatient_discontinue_medication(p_medication_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_med inpatient_medications%ROWTYPE;
  v_reason text := left(NULLIF(btrim(COALESCE(p_reason, '')), ''), 500);
BEGIN
  IF v_me.role <> 'doctor' THEN
    RAISE EXCEPTION 'Only doctors stop a medicine on the chart.' USING ERRCODE = '42501';
  END IF;
  SELECT m.* INTO v_med FROM inpatient_medications m WHERE m.id = p_medication_id FOR UPDATE;
  IF v_med.id IS NULL THEN
    RAISE EXCEPTION 'This medicine was not found on the chart.' USING ERRCODE = '42501';
  END IF;
  PERFORM inpatient_active_admission(v_med.admission_id, v_me.practice_id);
  IF v_med.status NOT IN ('active', 'held') THEN
    RAISE EXCEPTION 'This medicine has already been stopped.' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Say why the medicine is stopped.' USING ERRCODE = '22023';
  END IF;
  UPDATE inpatient_medications SET status = 'discontinued', discontinuation_reason = v_reason, discontinued_by = auth.uid(),
         discontinued_at = now(), end_datetime = now(), updated_at = now()
   WHERE id = v_med.id;
END
$function$;

-- 4.13 Visitors in and out (any staff). Visiting hours and the number at a time are warnings in the app, not refusals.
CREATE OR REPLACE FUNCTION public.inpatient_visitor_check_in(p_admission_id uuid, p_visitor jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_row patient_admissions%ROWTYPE := inpatient_active_admission(p_admission_id, v_me.practice_id);
  v_name text := inpatient_text(p_visitor, 'visitor_name', 120);
  v_purpose text := COALESCE(inpatient_text(p_visitor, 'purpose'), 'regular_visit');
  v_ward uuid;
  v_id uuid;
BEGIN
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Type the visitor''s name.' USING ERRCODE = '22023';
  END IF;
  IF v_purpose NOT IN ('regular_visit', 'emergency', 'consultation', 'caregiver') THEN
    RAISE EXCEPTION 'Choose why they visit from the list.' USING ERRCODE = '22023';
  END IF;
  SELECT a.ward_id INTO v_ward FROM bed_allocations a WHERE a.admission_id = v_row.id AND a.is_current;
  IF v_ward IS NULL THEN
    RAISE EXCEPTION 'The patient has no bed now, so visitors cannot be signed in.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO visitor_logs (admission_id, patient_id, ward_id, visitor_name, visitor_id_number, relationship, contact_number,
                            check_in_time, purpose, authorized_by, notes)
  VALUES (v_row.id, v_row.patient_id, v_ward, v_name, inpatient_text(p_visitor, 'visitor_id_number', 30),
          inpatient_text(p_visitor, 'relationship', 60), inpatient_text(p_visitor, 'contact_number', 30), now(), v_purpose,
          auth.uid(), inpatient_text(p_visitor, 'notes', 500))
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.inpatient_visitor_check_out(p_visitor_log_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_log visitor_logs%ROWTYPE;
BEGIN
  SELECT l.* INTO v_log FROM visitor_logs l JOIN patient_admissions a ON a.id = l.admission_id
   WHERE l.id = p_visitor_log_id AND a.practice_id = v_me.practice_id FOR UPDATE OF l;
  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'This visitor was not found in your practice.' USING ERRCODE = '42501';
  END IF;
  IF v_log.check_out_time IS NOT NULL THEN
    RAISE EXCEPTION 'This visitor has already left.' USING ERRCODE = '22023';
  END IF;
  UPDATE visitor_logs SET check_out_time = now() WHERE id = v_log.id;
END
$function$;

-- 4.14 The stay's invoice (created by the app's invoice service) is linked to the admission once, both ways
CREATE OR REPLACE FUNCTION public.inpatient_mark_billed(p_admission_id uuid, p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me record := inpatient_caller();
  v_row patient_admissions%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM patient_admissions a WHERE a.id = p_admission_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.practice_id IS DISTINCT FROM v_me.practice_id THEN
    RAISE EXCEPTION 'This admission was not found in your practice.' USING ERRCODE = '42501';
  END IF;
  IF v_row.billed_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'This stay has already been billed.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM invoices_enhanced i WHERE i.id = p_invoice_id AND i.patient_id = v_row.patient_id
                    AND i.practice_id = v_me.practice_id) THEN
    RAISE EXCEPTION 'The invoice is not one of this patient''s invoices.' USING ERRCODE = '22023';
  END IF;
  UPDATE patient_admissions SET billed_invoice_id = p_invoice_id, billed_at = now(), updated_at = now() WHERE id = v_row.id;
  UPDATE invoices_enhanced SET admission_id = v_row.id WHERE id = p_invoice_id AND admission_id IS NULL;
END
$function$;

DO $$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['public.inpatient_caller()', 'public.inpatient_active_admission(uuid, uuid)',
                              'public.inpatient_check_doctor(uuid, uuid, text)', 'public.inpatient_text(jsonb, text, integer)',
                              'public.inpatient_texts(jsonb, text)', 'public.inpatient_free_bed(uuid, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.inpatient_save_ward(uuid, jsonb)', 'public.inpatient_save_bed(uuid, uuid, jsonb)',
                              'public.inpatient_set_bed_status(uuid, text)', 'public.inpatient_admit(uuid, uuid, jsonb)',
                              'public.inpatient_update_admission(uuid, jsonb)', 'public.inpatient_transfer(uuid, uuid, text, text, text)',
                              'public.inpatient_discharge(uuid, jsonb)', 'public.inpatient_save_round(uuid, jsonb)',
                              'public.inpatient_save_nursing_record(uuid, uuid, jsonb)', 'public.inpatient_prescribe(uuid, jsonb)',
                              'public.inpatient_record_dose(uuid, timestamptz, text, text)', 'public.inpatient_discontinue_medication(uuid, text)',
                              'public.inpatient_visitor_check_in(uuid, jsonb)', 'public.inpatient_visitor_check_out(uuid)',
                              'public.inpatient_mark_billed(uuid, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Administrators choose who opens the Inpatient page (as for Finance and Stock)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_screen_access(p_practice_id uuid, p_screen text, p_roles text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  -- Screens a practice can limit (the app's GUARDED_SCREENS) and the roles it chooses between (the app's
  -- CHOOSABLE_ROLES; administrators always open every screen)
  v_screens constant text[] := ARRAY['finance', 'stock', 'inpatient'];
  v_roles constant text[] := ARRAY['doctor', 'nurse', 'receptionist'];
  v_caller_role text;
  v_before public.practice_settings%ROWTYPE;
  v_after public.practice_settings%ROWTYPE;
  v_value jsonb;
BEGIN
  IF public.rls_is_super_admin() THEN
    v_caller_role := 'super_admin';
  ELSIF EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = auth.uid() AND u.practice_id = p_practice_id AND u.role = 'admin' AND COALESCE(u.is_active, true)
  ) THEN
    v_caller_role := 'admin';
  ELSE
    RAISE EXCEPTION 'Only the practice''s administrators choose who can open Finance, Stock and Inpatient.' USING ERRCODE = '42501';
  END IF;
  IF p_screen IS NULL OR NOT (p_screen = ANY (v_screens)) THEN
    RAISE EXCEPTION 'There is no screen "%" to choose access for.', COALESCE(p_screen, '') USING ERRCODE = '22023';
  END IF;
  IF p_roles IS NOT NULL
     AND EXISTS (SELECT 1 FROM unnest(p_roles) AS r(role) WHERE r.role IS NULL OR NOT (r.role = ANY (v_roles))) THEN
    RAISE EXCEPTION 'Choose from doctor, nurse and receptionist (administrators can always open it).' USING ERRCODE = '22023';
  END IF;
  IF p_practice_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.practices p WHERE p.id = p_practice_id) THEN
    RAISE EXCEPTION 'This practice does not exist.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_before FROM public.practice_settings s
   WHERE s.practice_id = p_practice_id AND s.setting_key = 'screen_access'
   FOR UPDATE;

  -- The other screens keep their choice; a value that is not an object starts again from "every screen open"
  v_value := CASE WHEN jsonb_typeof(v_before.setting_value) = 'object' THEN v_before.setting_value ELSE '{}'::jsonb END;
  IF p_roles IS NULL THEN
    v_value := v_value - p_screen;
  ELSE
    v_value := jsonb_set(v_value, ARRAY[p_screen],
      (SELECT COALESCE(jsonb_agg(DISTINCT r.role ORDER BY r.role), '[]'::jsonb) FROM unnest(p_roles) AS r(role)));
  END IF;

  INSERT INTO public.practice_settings (practice_id, setting_key, setting_value, setting_type, description, is_public)
  VALUES (p_practice_id, 'screen_access', v_value, 'json',
          'Who can open Finance, Stock and Inpatient: the roles per screen (administrators always can; a screen not listed is open to every role)',
          false)
  ON CONFLICT (practice_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, setting_type = 'json'
  RETURNING * INTO v_after;

  -- Who changed it and when (super admins read every entry, the practice's administrators their practice's)
  INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, user_id, user_role, description)
  VALUES (
    'practice_settings', v_after.id,
    CASE WHEN v_before.id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    CASE WHEN v_before.id IS NULL THEN NULL
         ELSE jsonb_build_object('practice_id', p_practice_id, 'setting_key', 'screen_access',
                                 'setting_value', v_before.setting_value) END,
    jsonb_build_object('practice_id', p_practice_id, 'setting_key', 'screen_access', 'setting_value', v_after.setting_value),
    auth.uid(), v_caller_role,
    CASE WHEN p_roles IS NULL THEN format('%s opens for every role again', initcap(p_screen))
         ELSE format('Who can open %s changed', initcap(p_screen)) END
  );

  RETURN v_after.setting_value;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_screen_access(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_screen_access(uuid, text, text[]) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_fn text;
BEGIN
  IF (SELECT confrelid FROM pg_constraint WHERE conname = 'bed_allocations_bed_id_fkey') <> 'public.ward_beds'::regclass THEN
    RAISE EXCEPTION 'Check failed: bed_allocations.bed_id must point at ward_beds';
  END IF;
  FOR v_fn IN SELECT p.oid::regprocedure::text FROM pg_proc p
               WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'inpatient\_%' LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = v_fn::regprocedure AND a.grantee = 0)
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_fn::regprocedure AND proconfig @> ARRAY['search_path=public']) THEN
      RAISE EXCEPTION 'Check failed: % must not be callable with the public key and must fix its search_path', v_fn;
    END IF;
  END LOOP;
  IF has_function_privilege('authenticated', 'public.inpatient_caller()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.inpatient_free_bed(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.inpatient_active_admission(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: the helper functions are for the functions above only';
  END IF;
  IF has_table_privilege('authenticated', 'public.patient_admissions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ward_beds', 'UPDATE') THEN
    RAISE EXCEPTION 'Check failed: the inpatient tables are changed only through the functions';
  END IF;
END $$;

ROLLBACK;

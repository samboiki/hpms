-- Applied 2026-10-13 as migration inpatient_access_2026_10_13 (version 20261013194152; stored statement md5 0e57fedc0ff81685ea4706128a77bb4f = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that row level security was still off and the invented
-- nurse gone): the practice's administrator, doctor, an invented nurse and the receptionist each read the 5 wards and
-- 65 beds and could not update a bed or delete an admission (42501); another practice's doctor and a patient-app login
-- read 0 wards and 0 beds and could change nothing; anon could not read a bed or run generate_admission_number (42501).
-- =============================================================================================
-- PROPOSAL: close the inpatient tables to the public key and to other practices (first, before the Inpatient screens)
-- File:   proposals/2026-10-13-inpatient-access.sql          Drafted: 2026-10-13
-- Code:   none yet; the Inpatient page (src/components/inpatient/*) reads these tables after
--         proposals/2026-10-13-inpatient-module.sql, which also adds the functions that write them.
--
-- Why
--   The inpatient tables of the owner's earlier ward module (patient_admissions, bed_allocations, bed_transfer_history,
--   ward_rounds, nursing_care_records, inpatient_medications, visitor_logs) and its ward setup (hospital_wards,
--   ward_beds) had row level security off and full rights for anon and every login: anyone with the public key could
--   read, change or delete admissions, medication charts and the ward setup of every practice. The seven clinical
--   tables are empty today (counted 13 Oct 2026); the ward setup holds 5 wards and 65 beds of one practice.
--   Their two trigger functions (update_ward_occupancy, set_admission_number) and generate_admission_number ran with
--   no fixed search_path and could be called by anyone.
--
-- What it does
--   1. Row level security on for all nine tables; every right taken from PUBLIC, anon and logins; logins get SELECT
--      back. Changes come only through the SECURITY DEFINER functions of the module file (no direct writes).
--   2. Staff read their own practice's rows: wards and admissions by practice_id, beds through their ward, the rest
--      through their admission.
--   3. The three functions run with search_path public and nobody may call them directly (the triggers still fire).
--   4. The patient app's logins get nothing here (RESTRICTIVE portal_staff_only), as on every OneHealth table.
--   The other set of tables (wards, beds, rooms) is not touched: nothing in the app uses it (question for the owner).
--
-- Apply: run the part between BEGIN; and ROLLBACK; (as a migration). Rehearse: run the whole file (it rolls back).
-- Undo:  ALTER TABLE ... DISABLE ROW LEVEL SECURITY and GRANT ALL ... TO anon, authenticated (not advised: that is
--        the open state this file closes).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Row level security on; only SELECT for logins
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['hospital_wards', 'ward_beds', 'patient_admissions', 'bed_allocations', 'bed_transfer_history',
                                 'ward_rounds', 'nursing_care_records', 'inpatient_medications', 'visitor_logs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_table);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Staff read their own practice's rows
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS hospital_wards_read ON public.hospital_wards;
CREATE POLICY hospital_wards_read ON public.hospital_wards FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()));

DROP POLICY IF EXISTS ward_beds_read ON public.ward_beds;
CREATE POLICY ward_beds_read ON public.ward_beds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hospital_wards w
                  WHERE w.id = ward_beds.ward_id AND w.practice_id = (SELECT public.rls_my_practice_id())));

DROP POLICY IF EXISTS patient_admissions_read ON public.patient_admissions;
CREATE POLICY patient_admissions_read ON public.patient_admissions FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()));

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['bed_allocations', 'bed_transfer_history', 'ward_rounds', 'nursing_care_records',
                                 'inpatient_medications', 'visitor_logs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_read', v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
                   'USING (EXISTS (SELECT 1 FROM public.patient_admissions a '
                   'WHERE a.id = %I.admission_id AND a.practice_id = (SELECT public.rls_my_practice_id())))',
                   v_table || '_read', v_table, v_table);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. The trigger functions: a fixed search_path, nobody calls them directly
-- ---------------------------------------------------------------------------------------------
ALTER FUNCTION public.update_ward_occupancy() SET search_path = public;
ALTER FUNCTION public.set_admission_number() SET search_path = public;
ALTER FUNCTION public.generate_admission_number() SET search_path = public;
REVOKE ALL ON FUNCTION public.update_ward_occupancy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_admission_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_admission_number() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['hospital_wards', 'ward_beds', 'patient_admissions', 'bed_allocations', 'bed_transfer_history',
                                   'ward_rounds', 'nursing_care_records', 'inpatient_medications', 'visitor_logs'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
  v_fn text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['public.hospital_wards', 'public.ward_beds', 'public.patient_admissions', 'public.bed_allocations',
                                 'public.bed_transfer_history', 'public.ward_rounds', 'public.nursing_care_records',
                                 'public.inpatient_medications', 'public.visitor_logs'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_table::regclass)
       OR has_table_privilege('anon', v_table, 'SELECT') OR has_table_privilege('anon', v_table, 'INSERT')
       OR has_table_privilege('anon', v_table, 'UPDATE') OR has_table_privilege('anon', v_table, 'DELETE')
       OR has_table_privilege('authenticated', v_table, 'INSERT') OR has_table_privilege('authenticated', v_table, 'UPDATE')
       OR has_table_privilege('authenticated', v_table, 'DELETE') OR has_table_privilege('authenticated', v_table, 'TRUNCATE')
       OR NOT has_table_privilege('authenticated', v_table, 'SELECT')
       OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = split_part(v_table, '.', 2)
                       AND cmd = 'SELECT' AND policyname LIKE '%_read') THEN
      RAISE EXCEPTION 'Check failed: % must be read by its practice''s staff only, and changed by nobody directly', v_table;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.update_ward_occupancy()', 'public.set_admission_number()', 'public.generate_admission_number()'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_fn::regprocedure AND proconfig @> ARRAY['search_path=public']) THEN
      RAISE EXCEPTION 'Check failed: % must have a fixed search_path and not be callable', v_fn;
    END IF;
  END LOOP;
END $$;

ROLLBACK;

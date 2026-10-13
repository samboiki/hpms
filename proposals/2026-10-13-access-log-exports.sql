-- Applied 2026-10-13 as migration access_log_exports_2026_10_13 (version 20261012233146; stored statement md5 02a0d8d3b9fca3e0626b8cd554ba4af7 = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 afterwards: log_record_access 2c3ed1975b9da5b9b1dbc52b3117451b.
-- Rehearsed with simulated logins (rolled back): the practice's receptionist exported a file twice (both recorded),
-- opened it (recorded) and again (skipped), signed in (recorded) and again (skipped); an export without a patient and
-- of another practice's file were refused (42501), an unknown event (22023); the administrator's Who did what listed
-- the open, both exports (with their patient, from the patient file) and the sign-in; the table refused an export row
-- without a patient and a sign-in row with one (23514); anon was refused (42501).
-- =============================================================================================
-- PROPOSAL: the record-access log also records every export of a patient's record (parity Q8, with C17)
-- File:   proposals/2026-10-13-access-log-exports.sql                       Drafted: 2026-10-13
-- Code:   src/services/patientRecordExportService.ts (logRecordExport: calls log_record_access('record_exported',
--         patient, 'patient_file') after each export; no change needed), src/services/recordAccessLog.ts (the event),
--         src/components/finance/practiceReports/userActivity.ts ("Exported the patient's record" in Who did what)
--
-- Why: the patient file's record export (parity C17, proposals/2026-10-13-patient-file-extras.sql) hands a whole
-- patient record out of OneHealth, so who exported which record and when belongs in the access log next to who opened
-- it. proposals/2026-10-13-access-log.sql (applied) knew only a file opened, a sign-in and a sign-out, and refused
-- the export's entry (22023).
--
-- What it does
--   1. record_access_log: the event check also allows 'record_exported', and an export, like a file opened, names its
--      patient (and a sign-in or sign-out still names none). Existing rows keep both checks.
--   2. log_record_access: accepts 'record_exported' for a file of the caller's own practice (another practice's file
--      is refused, 42501). Every export is recorded: the 10-minute repeat skip stays for opening a file only.
--      Otherwise as proposals/2026-10-13-access-log.sql left it (its grants are kept by CREATE OR REPLACE).
--   3. Checks. report_user_activity is not changed: it already lists every event of the log (area 'access').
--
-- How to apply: after proposals/2026-10-13-access-log.sql. Rehearse in a transaction that rolls back, then apply the
-- part between BEGIN; and ROLLBACK; as one migration. Until then an export is simply not recorded.
-- Undo:  restore log_record_access from proposals/2026-10-13-access-log.sql (section 2), then (only once no export
--        rows exist, or after deleting them)
--        ALTER TABLE public.record_access_log DROP CONSTRAINT record_access_log_event_check,
--          ADD CONSTRAINT record_access_log_event_check CHECK (event IN ('patient_opened', 'signed_in', 'signed_out'));
--        ALTER TABLE public.record_access_log DROP CONSTRAINT record_access_log_patient_only_for_files,
--          ADD CONSTRAINT record_access_log_patient_only_for_files CHECK ((event = 'patient_opened') = (patient_id IS NOT NULL));
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: the access log as proposals/2026-10-13-access-log.sql left it
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.log_record_access(text,uuid,text)'::regprocedure) <> '85a971f653248e7981d222aedd555a71' THEN
    RAISE EXCEPTION 'Stopped: log_record_access is not the version proposals/2026-10-13-access-log.sql left; merge by hand';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.record_access_log'::regclass AND c.conname = 'record_access_log_event_check')
     IS DISTINCT FROM 'CHECK ((event = ANY (ARRAY[''patient_opened''::text, ''signed_in''::text, ''signed_out''::text])))'
     OR (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
          WHERE c.conrelid = 'public.record_access_log'::regclass AND c.conname = 'record_access_log_patient_only_for_files')
     IS DISTINCT FROM 'CHECK (((event = ''patient_opened''::text) = (patient_id IS NOT NULL)))' THEN
    RAISE EXCEPTION 'Stopped: the access log''s checks are not as proposals/2026-10-13-access-log.sql made them; merge by hand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. An export is an event of the log, and names its patient
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.record_access_log DROP CONSTRAINT record_access_log_event_check;
ALTER TABLE public.record_access_log ADD CONSTRAINT record_access_log_event_check
  CHECK (event IN ('patient_opened', 'record_exported', 'signed_in', 'signed_out'));
ALTER TABLE public.record_access_log DROP CONSTRAINT record_access_log_patient_only_for_files;
ALTER TABLE public.record_access_log ADD CONSTRAINT record_access_log_patient_only_for_files
  CHECK ((event IN ('patient_opened', 'record_exported')) = (patient_id IS NOT NULL));

COMMENT ON TABLE public.record_access_log IS
  'Who opened or exported which patient''s file (and from which screen), and staff sign-ins and sign-outs; never any value of the file. Written by log_record_access (a file opened: one entry per person and file per 10 minutes; every export); read by the practice''s administrators. Shown in Finance > Reports > Who did what.';

-- ---------------------------------------------------------------------------------------------
-- 2. Recording an export: every one, for a file of the caller's own practice
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_record_access(p_event text, p_patient_id uuid DEFAULT NULL, p_screen text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_practice uuid;
  v_screen   text := lower(btrim(COALESCE(p_screen, '')));
  v_window   interval;
BEGIN
  SELECT u.practice_id INTO v_practice FROM public.users u WHERE u.id = v_user AND COALESCE(u.is_active, true);
  IF v_user IS NULL OR v_practice IS NULL THEN
    RAISE EXCEPTION 'Only a practice''s staff are recorded here.' USING ERRCODE = '42501';
  END IF;
  IF p_event IS NULL OR p_event NOT IN ('patient_opened', 'record_exported', 'signed_in', 'signed_out') THEN
    RAISE EXCEPTION 'Unknown event: a patient''s file opened or exported, a sign-in or a sign-out.' USING ERRCODE = '22023';
  END IF;
  IF v_screen !~ '^[a-z][a-z0-9_]{0,39}$' THEN
    RAISE EXCEPTION 'Name the screen (lower-case letters, digits and _).' USING ERRCODE = '22023';
  END IF;
  IF p_event IN ('patient_opened', 'record_exported') THEN
    IF p_patient_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.practice_id = v_practice) THEN
      RAISE EXCEPTION 'Only a file of your own practice is recorded.' USING ERRCODE = '42501';
    END IF;
    -- Every export is recorded; the same file opened again within 10 minutes is one entry
    v_window := CASE WHEN p_event = 'patient_opened' THEN interval '10 minutes' END;
  ELSE
    IF p_patient_id IS NOT NULL THEN
      RAISE EXCEPTION 'A sign-in or sign-out names no patient.' USING ERRCODE = '22023';
    END IF;
    v_window := interval '1 minute';
  END IF;

  IF v_window IS NOT NULL THEN
    -- One entry per person and file in the window (two tabs opening the same file at once wait for each other here)
    PERFORM pg_advisory_xact_lock(hashtextextended('record_access_log|' || v_user::text || '|' || p_event || '|' || COALESCE(p_patient_id::text, ''), 0));
    IF EXISTS (SELECT 1 FROM public.record_access_log l
                WHERE l.user_id = v_user AND l.event = p_event AND l.patient_id IS NOT DISTINCT FROM p_patient_id
                  AND l.occurred_at > now() - v_window) THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO public.record_access_log (practice_id, user_id, event, patient_id, screen)
  VALUES (v_practice, v_user, p_event, p_patient_id, v_screen);
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.log_record_access(text, uuid, text) IS
  'Records a patient''s file opened (one entry per person and file per 10 minutes) or exported (every time), a sign-in or a sign-out for the signed-in staff member, with the screen. Never values of the file. Returns whether a row was written.';

-- ---------------------------------------------------------------------------------------------
-- 3. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_log text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.log_record_access(text, uuid, text)'::regprocedure);
BEGIN
  IF position('''record_exported''' in v_log) = 0 OR position('interval ''10 minutes''' in v_log) = 0
     OR position('p.practice_id = v_practice' in v_log) = 0 THEN
    RAISE EXCEPTION 'Check failed: log_record_access does not take exports, lost the repeat skip or its practice check';
  END IF;
  IF has_function_privilege('anon', 'public.log_record_access(text, uuid, text)', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.log_record_access(text, uuid, text)'::regprocedure AND a.grantee = 0)
     OR NOT has_function_privilege('authenticated', 'public.log_record_access(text, uuid, text)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.record_access_log', 'INSERT') THEN
    RAISE EXCEPTION 'Check failed: who may record changed (the public key, everyone, or staff writing directly)';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

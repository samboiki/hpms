-- Applied 2026-10-07 as migration patient_portal_2026_10_07 (two fixes for the shared database: see "Fix 2026-10-07")
-- Applied 2026-10-07 as migration portal_service_only_policies_2026_10_07: only the block marked "Fix 2026-10-07 (advisor)"
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: patient app (patients sign in with their cell number and an SMS code)
-- File:    proposals/2026-10-07-patient-portal.sql                    Drafted: 2026-10-07
-- Code:    src/patientPortal/* (the patient app, under /me), src/pages/auth/PatientSignIn.tsx,
--          src/stores/authStore.ts + src/App.tsx (staff app or patient app after sign-in),
--          supabase/functions/auth-sms-hook (sign-in codes by SMS, Supabase Auth "Send SMS" hook),
--          supabase/functions/patient-portal (linking records, requests, cancelling),
--          src/components/requests/LabResultReleaseButton.tsx (staff: "Release to patient"),
--          src/components/communications/PortalRequestsInbox.tsx (staff: Communications > App requests)
-- Rules:   supabase/functions/_shared/patientPortalLink.ts, patientPortalRequests.ts, authOtpPolicy.ts
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Run the whole file once as it is (Supabase SQL editor, or a branch first). It must finish
--      without an error. Section 0 stops on purpose when something would let patients see other
--      people's data; the message says what to fix. Read the NOTICE lines: they list what section 6
--      locks for patients and what still needs a person to check (views, functions).
--   2. Change the final ROLLBACK to COMMIT and run it again.
--   3. Then deploy the two edge functions and switch on phone sign-in (steps at the end of this file).
--   Apply it AFTER the other October proposals (two-way SMS, patient lists, claims, finance ledger):
--   section 6 locks the tables that exist when it runs. After any later CREATE TABLE, run
--      SELECT public.portal_apply_staff_guard();
--
-- How patients are kept to their own records
--   - A patient's login (Supabase Auth, phone) has no row in public.users. The staff policies check
--     public.users, but not all of them: the migrations in this repo still contain
--       patients "Enable select/insert/update for authenticated users only" USING (true)  (20250512153225)
--       users    users_select_policy USING (true)                                         (20250626)
--     and every signed-in user matches those. Section 6 therefore adds one RESTRICTIVE policy to every
--     table with RLS: a signed-in user without a staff profile gets no rows and can change nothing,
--     whatever the other policies allow. Staff pass it (they have a users row), so nothing changes for
--     them. Storage files get the same rule.
--   - Patients read only through the portal_* functions in section 5. Each returns rows of the patients
--     linked to the caller's own login and only patient-safe columns: never visit notes, diagnosis or
--     treatment plan, and lab results only after a doctor released them (section 3).
--   - Links (patient_accounts) are written only by the patient-portal edge function, after the person
--     confirmed the record's ID number (or its date of birth when it has none). A link stops working when
--     the record's cell number changes (section 7) or the login's phone number changes (section 1).
--   - Patients never write clinical data. Bookings, new times and profile changes are requests that
--     reception handles; cancelling goes through the edge function with the SMS-reply rules.
--
-- Contents
--   0. Checks before anything changes (stop on SQL-runner functions and auth.users triggers that create
--      staff profiles; notices about permissive policies, tables without RLS, views and functions)
--   1. Helper functions: portal_is_staff(), portal_linked_patient_ids()
--   2. Tables: patient_accounts, patient_portal_link_attempts, patient_portal_requests,
--      patient_portal_otp_sends
--   3. Lab results: released_to_patient (default false), the release function, the guard trigger
--   4. RLS and grants for the new tables
--   5. What the patient app reads: portal_my_patients(), portal_appointments(), portal_invoices(),
--      portal_invoice_lines(), portal_prescriptions(), portal_lab_results()
--   6. The staff-only guard on every other table and on storage files
--   7. A changed cell number on a patient file ends that file's links
--   8. Check: practice_sms_logs must accept message_type 'auth_otp'
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks
-- ---------------------------------------------------------------------------------------------

-- 0a. A trigger on auth.users that creates staff profiles would give every patient login a users row,
--     and with it the staff policies. Stop if one exists.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tg.tgname, p.proname, p.prosrc
    FROM pg_trigger tg
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE tg.tgrelid = 'auth.users'::regclass AND NOT tg.tgisinternal
  LOOP
    IF t.prosrc ~* 'insert[[:space:]]+into[[:space:]]+(public\.)?"?users"?([^a-z0-9_]|$)' THEN
      RAISE EXCEPTION 'Trigger % on auth.users (function %) creates public.users rows: every patient login would become staff', t.tgname, t.proname
        USING HINT = 'Make the trigger skip logins without an email (phone sign-in) before switching on the patient app.';
    END IF;
    RAISE NOTICE 'auth.users trigger % (function %) does not create public.users rows: fine', t.tgname, t.proname;
  END LOOP;
END $$;

-- 0b. Functions that run any SQL text bypass every policy. A patient login can call whatever a signed-in
--     user can call, so these must only be callable by the service role (the ai-search-patients edge
--     function uses execute_raw_sql with the service role and keeps working). Proposal 2026-10-06 6b
--     says to drop exec_raw_sql altogether; this only takes the right away from app users.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('exec', 'exec_sql', 'exec_raw_sql', 'execute_sql', 'execute_raw_sql', 'execute_ai_query', 'run_sql')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
    RAISE NOTICE 'Only the service role may now call %', f.signature;
  END LOOP;
END $$;

-- 0c. For the record (no change): policies that let any signed-in user (or everyone) read or write.
--     Section 6 confines patients whatever these say; staff keep what they have today.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
      AND (roles @> ARRAY['authenticated']::name[] OR roles @> ARRAY['public']::name[])
      AND (
        (cmd = 'INSERT' AND COALESCE(with_check, 'true') = 'true')
        OR (cmd <> 'INSERT' AND COALESCE(qual, 'true') = 'true')
      )
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE 'Open policy (patients are kept out by section 6): %.% "%" % for %', p.schemaname, p.tablename, p.policyname, p.cmd, p.roles;
  END LOOP;
END $$;

-- 0d. For the record: tables without RLS. Every API key (even the public anon key in the browser) can
--     read them today if the table is granted to anon; the patient app adds nothing to that, but they
--     should get RLS and policies. Views that run with their owner's rights and SECURITY DEFINER
--     functions are NOT covered by section 6: a patient login can use every one that signed-in users
--     may use, and one that only checks "someone is signed in" lets patients through. Check each one
--     limits rows to the caller's practice (or make the view security_invoker) before go-live.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    RAISE NOTICE 'Table without RLS (readable with any API key that has the grant): public.%', r.relname;
  END LOOP;

  FOR r IN
    SELECT c.oid::regclass AS view_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
      AND has_table_privilege('authenticated', c.oid, 'SELECT')
      AND NOT COALESCE((SELECT option_value::boolean FROM pg_options_to_table(c.reloptions) WHERE option_name = 'security_invoker'), false)
    ORDER BY 1
  LOOP
    RAISE NOTICE 'Check before go-live: view % runs with its owner''s rights and signed-in users (patients too) may read it', r.view_name;
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS function_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname NOT LIKE 'portal\_%'
      AND p.proname <> 'release_lab_results_to_patient'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ORDER BY 1
  LOOP
    RAISE NOTICE 'Check before go-live: SECURITY DEFINER function % can be called by signed-in users (patients too); it must check the caller is staff', r.function_name;
  END LOOP;
END $$;

-- 0e. For the record: logins with an email but no staff profile. Section 6 treats them like patients
--     (no access to practice tables). Expected: 0. Any other number: give them a users row or remove them.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM auth.users au
  WHERE COALESCE(au.email, '') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = au.id);
  RAISE NOTICE 'Email logins without a staff profile (they lose access to practice tables): %', n;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Helper functions
-- ---------------------------------------------------------------------------------------------

-- Staff = has a staff profile. The same test as every staff policy (EXISTS ... public.users ... auth.uid()).
CREATE OR REPLACE FUNCTION public.portal_is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid())
$$;
COMMENT ON FUNCTION public.portal_is_staff() IS
  'True when the signed-in user has a staff profile (public.users). Patient app logins never do.';

-- ---------------------------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------------------------

-- 2a. Which patient records a patient app login may see. One row per login and record.
CREATE TABLE IF NOT EXISTS public.patient_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practice_id     uuid REFERENCES public.practices(id) ON DELETE CASCADE,
  relationship    text NOT NULL CHECK (relationship IN ('self', 'child')),
  verified_by     text NOT NULL CHECK (verified_by IN ('date_of_birth', 'id_number')),
  phone_e164      text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  verified_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  revoke_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_accounts_user_patient_key UNIQUE (user_id, patient_id)
);
COMMENT ON TABLE public.patient_accounts IS
  'Patient app: records a login may see, after the person confirmed the record''s ID number or date of birth (patient-portal edge function).';
COMMENT ON COLUMN public.patient_accounts.relationship IS 'self = the person themselves; child = a child under 18 added by a parent.';
COMMENT ON COLUMN public.patient_accounts.phone_e164 IS 'The login''s number when the link was made. If the login''s phone changes, the link stops working.';
COMMENT ON COLUMN public.patient_accounts.revoked_at IS 'Set when the link must stop working (e.g. the record''s cell number changed). Revoke by hand: UPDATE ... SET revoked_at = now(), revoke_reason = ''...''.';

CREATE INDEX IF NOT EXISTS patient_accounts_user_idx ON public.patient_accounts (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS patient_accounts_patient_idx ON public.patient_accounts (patient_id);

-- The records the signed-in login may see: active links made with the login's current phone number.
CREATE OR REPLACE FUNCTION public.portal_linked_patient_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT pa.patient_id
  FROM public.patient_accounts pa
  JOIN auth.users au ON au.id = pa.user_id
  WHERE pa.user_id = auth.uid()
    AND pa.revoked_at IS NULL
    AND regexp_replace(COALESCE(au.phone, ''), '[^0-9]', '', 'g') = regexp_replace(pa.phone_e164, '[^0-9]', '', 'g')
$$;
COMMENT ON FUNCTION public.portal_linked_patient_ids() IS
  'Patient records linked to the signed-in patient app login (active links made with its current phone number).';

-- 2b. Tries to link records, for the lock after wrong details (no dates of birth or ID numbers stored).
CREATE TABLE IF NOT EXISTS public.patient_portal_link_attempts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164         text NOT NULL,
  outcome            text NOT NULL,
  counts_as_failure  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.patient_portal_link_attempts IS
  'Patient app: each try to link records (outcome only). Wrong tries lock linking (patientPortalLink.ts LINK_LIMITS). Delete a login''s rows to unlock it.';
CREATE INDEX IF NOT EXISTS patient_portal_link_attempts_user_idx ON public.patient_portal_link_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_portal_link_attempts_phone_idx ON public.patient_portal_link_attempts (phone_e164, created_at DESC);

-- 2c. What patients ask the practice for in the app. Reception handles them in Communications > App requests.
CREATE TABLE IF NOT EXISTS public.patient_portal_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  requested_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind            text NOT NULL CHECK (kind IN ('book', 'reschedule', 'cancel', 'profile_change')),
  visit_id        uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  preferred_date  date,
  preferred_time  text CHECK (preferred_time IS NULL OR preferred_time IN ('morning', 'afternoon', 'any')),
  message         text CHECK (message IS NULL OR char_length(message) <= 500),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'declined', 'withdrawn')),
  staff_note      text CHECK (staff_note IS NULL OR char_length(staff_note) <= 500),
  handled_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  handled_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.patient_portal_requests IS
  'Patient app requests: book, reschedule, profile_change wait for reception (status pending); cancel rows record a cancellation the app already made (status done).';
COMMENT ON COLUMN public.patient_portal_requests.staff_note IS 'Shown to the patient in the app.';
CREATE INDEX IF NOT EXISTS patient_portal_requests_inbox_idx ON public.patient_portal_requests (practice_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_portal_requests_patient_idx ON public.patient_portal_requests (patient_id, status);

CREATE OR REPLACE FUNCTION public.patient_portal_requests_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_portal_requests_touch_updated_at ON public.patient_portal_requests;
CREATE TRIGGER patient_portal_requests_touch_updated_at
  BEFORE UPDATE ON public.patient_portal_requests
  FOR EACH ROW EXECUTE FUNCTION public.patient_portal_requests_touch_updated_at();

-- 2d. Every sign-in code request the SMS hook saw, for its caps (authOtpPolicy.ts). No codes stored.
CREATE TABLE IF NOT EXISTS public.patient_portal_otp_sends (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164   text,
  practice_id  uuid REFERENCES public.practices(id) ON DELETE SET NULL,
  patient_id   uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  outcome      text NOT NULL CHECK (outcome IN ('sent', 'failed', 'no_patient', 'invalid_number', 'rate_limited')),
  sms_log_id   uuid REFERENCES public.practice_sms_logs(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.patient_portal_otp_sends IS
  'Patient app sign-in code requests seen by auth-sms-hook (caps per number and per hour). Safe to delete rows older than a month.';
CREATE INDEX IF NOT EXISTS patient_portal_otp_sends_phone_idx ON public.patient_portal_otp_sends (phone_e164, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_portal_otp_sends_sent_idx ON public.patient_portal_otp_sends (created_at DESC) WHERE outcome = 'sent';

-- ---------------------------------------------------------------------------------------------
-- 3. Lab results: patients see a result only after a doctor released it
--    New results are never released. Only release_lab_results_to_patient() changes the release columns
--    (the trigger keeps them for any other insert or update), and a released result whose value, unit,
--    range or test changes goes back to "not released" so the doctor sees the new value first.
--    Existing results stay unreleased: decide with the practices whether to release older ones.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS released_to_patient boolean NOT NULL DEFAULT false;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.lab_results.released_to_patient IS
  'Shown in the patient app. Set only by release_lab_results_to_patient(); false again when the result changes.';

CREATE OR REPLACE FUNCTION public.lab_results_release_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(current_setting('hpms.lab_release', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.released_to_patient := false;
      NEW.released_at := NULL;
      NEW.released_by := NULL;
    ELSE
      NEW.released_to_patient := OLD.released_to_patient;
      NEW.released_at := OLD.released_at;
      NEW.released_by := OLD.released_by;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.released_to_patient AND (
       NEW.test_value IS DISTINCT FROM OLD.test_value
       OR NEW.test_unit IS DISTINCT FROM OLD.test_unit
       OR NEW.reference_range IS DISTINCT FROM OLD.reference_range
       OR NEW.test_name IS DISTINCT FROM OLD.test_name
       OR NEW.lab_request_id IS DISTINCT FROM OLD.lab_request_id) THEN
    NEW.released_to_patient := false;
    NEW.released_at := NULL;
    NEW.released_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_results_release_guard ON public.lab_results;
CREATE TRIGGER lab_results_release_guard
  BEFORE INSERT OR UPDATE ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.lab_results_release_guard();

-- Release (or take back) all results of one lab request. Doctors and administrators of the practice.
CREATE OR REPLACE FUNCTION public.release_lab_results_to_patient(p_lab_request_id uuid, p_release boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_practice uuid;
  v_count integer;
BEGIN
  SELECT COALESCE(lr.practice_id, p.practice_id) INTO v_practice
  FROM public.lab_requests lr
  LEFT JOIN public.patients p ON p.id = lr.patient_id
  WHERE lr.id = p_lab_request_id;
  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'Lab request not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active IS DISTINCT FROM false
      AND (u.is_super_admin IS TRUE OR (u.practice_id = v_practice AND u.role IN ('doctor', 'admin')))
  ) THEN
    RAISE EXCEPTION 'Only a doctor or an administrator of this practice can release results to the patient'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('hpms.lab_release', 'on', true);
  UPDATE public.lab_results r
  SET released_to_patient = p_release,
      released_at = CASE WHEN p_release THEN now() END,
      released_by = CASE WHEN p_release THEN auth.uid() END
  WHERE r.lab_request_id = p_lab_request_id
    AND r.released_to_patient IS DISTINCT FROM p_release;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('hpms.lab_release', 'off', true);
  RETURN v_count;
END;
$$;
COMMENT ON FUNCTION public.release_lab_results_to_patient(uuid, boolean) IS
  'Release (true) or take back (false) every result of a lab request in the patient app. Doctors and administrators of the practice. Returns the number of results changed.';

-- ---------------------------------------------------------------------------------------------
-- 4. RLS and grants for the new tables
--    Writes come only from the edge functions (service role). Patients read their own links and
--    requests; staff read and handle requests of their practice (a user's practice comes from
--    public.users, as in the other proposals).
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patient_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_portal_link_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_portal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_portal_otp_sends ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.patient_accounts, public.patient_portal_link_attempts,
              public.patient_portal_requests, public.patient_portal_otp_sends FROM anon, authenticated;
GRANT ALL ON public.patient_accounts, public.patient_portal_link_attempts,
             public.patient_portal_requests, public.patient_portal_otp_sends TO service_role;

GRANT SELECT ON public.patient_accounts TO authenticated;
DROP POLICY IF EXISTS patient_accounts_select_own ON public.patient_accounts;
CREATE POLICY patient_accounts_select_own ON public.patient_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.patient_portal_requests TO authenticated;
GRANT UPDATE (status, staff_note, handled_by, handled_at) ON public.patient_portal_requests TO authenticated;

DROP POLICY IF EXISTS patient_portal_requests_select_patient ON public.patient_portal_requests;
CREATE POLICY patient_portal_requests_select_patient ON public.patient_portal_requests
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT public.portal_linked_patient_ids()));

DROP POLICY IF EXISTS patient_portal_requests_select_staff ON public.patient_portal_requests;
CREATE POLICY patient_portal_requests_select_staff ON public.patient_portal_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_portal_requests.practice_id));

DROP POLICY IF EXISTS patient_portal_requests_update_staff ON public.patient_portal_requests;
CREATE POLICY patient_portal_requests_update_staff ON public.patient_portal_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_portal_requests.practice_id))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = patient_portal_requests.practice_id)
    AND (handled_by IS NULL OR handled_by = auth.uid())
  );
-- patient_portal_link_attempts and patient_portal_otp_sends: no policies, so only the service role.
-- Fix 2026-10-07 (advisor): the security advisor lists these two tables as "RLS enabled, no policy". That is on
-- purpose (only the edge functions use them, with the service role, which skips RLS), so these policies change
-- nothing: they state the rule and keep it if a blanket policy or grant is added later.
DROP POLICY IF EXISTS patient_portal_link_attempts_service_only ON public.patient_portal_link_attempts;
CREATE POLICY patient_portal_link_attempts_service_only ON public.patient_portal_link_attempts
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS patient_portal_otp_sends_service_only ON public.patient_portal_otp_sends;
CREATE POLICY patient_portal_otp_sends_service_only ON public.patient_portal_otp_sends
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------------------------
-- 5. What the patient app reads (all SECURITY DEFINER, all limited to portal_linked_patient_ids())
--    Columns that may not exist on every database are read through to_jsonb(), so a missing one is
--    empty instead of an error.
-- ---------------------------------------------------------------------------------------------

-- The linked records, their practice's contact and bank details (for paying invoices)
CREATE OR REPLACE FUNCTION public.portal_my_patients()
RETURNS TABLE (
  patient_id uuid, relationship text, linked_at timestamptz,
  first_name text, last_name text, date_of_birth text, gender text, id_number text,
  cell_number text, email text, home_address text, postal_address text, postal_code text,
  practice_id uuid, practice_name text, practice_phone text, practice_email text, practice_address text,
  bank_name text, bank_account_holder text, bank_account_number text, bank_account_type text,
  bank_branch_code text, bank_swift_code text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT pa.patient_id, pa.relationship, pa.verified_at,
         p.first_name::text, p.last_name::text, p.date_of_birth::text, p.gender::text, p.id_number::text,
         p.cell_number::text, p.email::text, p.home_address::text, p.postal_address::text, p.postal_code::text,
         p.practice_id, pr.name::text,
         to_jsonb(pr) ->> 'contact_phone', to_jsonb(pr) ->> 'contact_email',
         concat_ws(', ', NULLIF(to_jsonb(pr) ->> 'address', ''), NULLIF(to_jsonb(pr) ->> 'city', '')),
         to_jsonb(pr) ->> 'bank_name', to_jsonb(pr) ->> 'account_holder_name', to_jsonb(pr) ->> 'account_number',
         to_jsonb(pr) ->> 'account_type', to_jsonb(pr) ->> 'branch_code', to_jsonb(pr) ->> 'swift_code'
  FROM public.patient_accounts pa
  JOIN public.patients p ON p.id = pa.patient_id
  LEFT JOIN public.practices pr ON pr.id = p.practice_id
  WHERE pa.user_id = auth.uid()
    AND pa.patient_id IN (SELECT public.portal_linked_patient_ids())
  ORDER BY pa.relationship = 'child', p.first_name
$$;

-- Appointments and visits: date, time, type, where they are in the clinic flow, doctor and practice.
-- Never notes, complaint, diagnosis, treatment plan or prescription text.
CREATE OR REPLACE FUNCTION public.portal_appointments(p_patient_id uuid)
RETURNS TABLE (
  visit_id uuid, practice_id uuid, practice_name text, practice_phone text,
  scheduled_date text, scheduled_time text, visit_date text, visit_time text,
  visit_type text, status text, is_cancelled boolean, is_checked_in boolean, is_ready boolean,
  is_handoff boolean, is_confirmed boolean, doctor_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT v.id, v.practice_id, pr.name::text, to_jsonb(pr) ->> 'contact_phone',
         v.scheduled_date::text, v.scheduled_time::text, v.visit_date::text, v.visit_time::text,
         v.visit_type::text, v.status::text, v.is_cancelled, v.is_checked_in, v.is_ready,
         v.is_handoff, v.is_confirmed, u.full_name::text
  FROM public.visits v
  LEFT JOIN public.practices pr ON pr.id = v.practice_id
  LEFT JOIN public.users u ON u.id::text = v.doctor_id::text
  WHERE v.patient_id = p_patient_id
    AND p_patient_id IN (SELECT public.portal_linked_patient_ids())
  ORDER BY COALESCE(v.scheduled_date::text, v.visit_date::text) DESC NULLS LAST,
           COALESCE(v.scheduled_time::text, v.visit_time::text) DESC NULLS LAST
  LIMIT 300
$$;

-- Invoices (the same columns the staff Billing tab reads), newest first
CREATE OR REPLACE FUNCTION public.portal_invoices(p_patient_id uuid)
RETURNS TABLE (
  id uuid, invoice_number text, practice_id uuid, practice_name text, visit_id text,
  issue_date text, due_date text, created_at text, total numeric, medical_aid_total numeric,
  patient_total numeric, payment_status text, payment_method text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT i.id, i.invoice_number::text, i.practice_id, pr.name::text, i.visit_id::text,
         i.issue_date::text, i.due_date::text, i.created_at::text, i.total::numeric, i.medical_aid_total::numeric,
         i.patient_total::numeric, i.payment_status::text, i.payment_method::text
  FROM public.invoices_enhanced i
  LEFT JOIN public.practices pr ON pr.id = i.practice_id
  WHERE i.patient_id = p_patient_id
    AND p_patient_id IN (SELECT public.portal_linked_patient_ids())
  ORDER BY COALESCE(i.issue_date::text, i.created_at::text) DESC NULLS LAST
  LIMIT 300
$$;

-- The lines of one invoice (no staff notes)
CREATE OR REPLACE FUNCTION public.portal_invoice_lines(p_invoice_id uuid)
RETURNS TABLE (
  id uuid, code text, description text, tooth_number text, quantity numeric,
  unit_price numeric, total_price numeric, patient_portion numeric, medical_aid_covered numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT s.id, s.code::text, s.description::text, to_jsonb(s) ->> 'tooth_number', s.quantity::numeric,
         s.unit_price::numeric, s.total_price::numeric, s.patient_portion::numeric, s.medical_aid_covered::numeric
  FROM public.invoice_services s
  JOIN public.invoices_enhanced i ON i.id = s.invoice_id
  WHERE s.invoice_id = p_invoice_id
    AND i.patient_id IN (SELECT public.portal_linked_patient_ids())
  ORDER BY s.created_at, s.id
$$;

-- Prescribed medicines (no doctor's notes)
CREATE OR REPLACE FUNCTION public.portal_prescriptions(p_patient_id uuid)
RETURNS TABLE (
  id uuid, medication_name text, dosage text, frequency text, duration text, instructions text,
  prescribed_date text, status text, prescriber_name text, practice_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT m.id, m.medication_name::text, to_jsonb(m) ->> 'dosage', to_jsonb(m) ->> 'frequency',
         to_jsonb(m) ->> 'duration', to_jsonb(m) ->> 'instructions', COALESCE(m.prescribed_date::text, m.created_at::text),
         to_jsonb(m) ->> 'status', u.full_name::text, pr.name::text
  FROM public.medications m
  JOIN public.patients p ON p.id = m.patient_id
  LEFT JOIN public.practices pr ON pr.id = p.practice_id
  LEFT JOIN public.users u ON u.id::text = (to_jsonb(m) ->> 'prescribed_by')
  WHERE m.patient_id = p_patient_id
    AND p_patient_id IN (SELECT public.portal_linked_patient_ids())
  ORDER BY COALESCE(m.prescribed_date::text, m.created_at::text) DESC NULLS LAST
  LIMIT 300
$$;

-- Lab results a doctor released, with the reference range. Never an unreleased result.
CREATE OR REPLACE FUNCTION public.portal_lab_results(p_patient_id uuid)
RETURNS TABLE (
  id uuid, lab_request_id uuid, request_date text, lab_facility text, test_name text, test_value text,
  test_unit text, reference_range text, released_at text, released_to_patient boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.id, r.lab_request_id, lr.request_date::text, lr.lab_facility::text, r.test_name::text, r.test_value::text,
         r.test_unit::text, r.reference_range::text, r.released_at::text, r.released_to_patient
  FROM public.lab_results r
  JOIN public.lab_requests lr ON lr.id = r.lab_request_id
  WHERE lr.patient_id = p_patient_id
    AND p_patient_id IN (SELECT public.portal_linked_patient_ids())
    AND r.released_to_patient IS TRUE
  ORDER BY r.released_at DESC NULLS LAST, lr.request_date DESC NULLS LAST, r.test_name
  LIMIT 500
$$;

-- Who may call what: patients (and staff, who simply get no rows) the readers; staff the release.
REVOKE ALL ON FUNCTION public.portal_is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_linked_patient_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_my_patients() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_appointments(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_invoices(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_invoice_lines(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_prescriptions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_lab_results(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_lab_results_to_patient(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lab_results_release_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_portal_requests_touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_is_staff(), public.portal_linked_patient_ids(), public.portal_my_patients(),
  public.portal_appointments(uuid), public.portal_invoices(uuid), public.portal_invoice_lines(uuid),
  public.portal_prescriptions(uuid), public.portal_lab_results(uuid),
  public.release_lab_results_to_patient(uuid, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. The staff-only guard
--    One RESTRICTIVE policy per table with RLS (it is AND-ed with every other policy): a signed-in
--    user without a staff profile gets no rows and cannot insert, change or delete anything. Staff pass
--    it, so their access is exactly what it is today. The anon key and the service role are not affected.
--    The patient app's own tables are left out (section 4 has their policies).
--    Re-run SELECT public.portal_apply_staff_guard(); after creating a table.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_apply_staff_guard()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  t record;
  n integer := 0;
BEGIN
  FOR t IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND c.relname NOT IN ('patient_accounts', 'patient_portal_link_attempts', 'patient_portal_requests', 'patient_portal_otp_sends')
      -- Fix 2026-10-07: this database is shared with other apps. Their tables (bet_*, bets_*) and the 25 tables
      -- OneHealth never uses are left alone, so the other apps' signed-in users keep their access.
      AND c.relname NOT LIKE 'bet\_%' AND c.relname NOT LIKE 'bets\_%'
      AND c.relname NOT IN ('ai_search_logs', 'automation_processing_log', 'bed_allocations', 'bed_transfer_history', 'beds',
                            'client_leads', 'expense_items', 'follow_up_automation_log_summary', 'follow_up_automation_logs',
                            'hospital_wards', 'inpatient_medications', 'message_engagement_metrics',
                            'notification_follow_up_sequences', 'nursing_care_records', 'patient_admissions', 'patient_locations',
                            'practice_automation_queue_stats', 'practice_signup_requests', 'social_media_accounts', 'staff_titles',
                            'system_logs', 'visitor_logs', 'ward_beds', 'ward_rounds', 'wards')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON %s', t.rel);
    EXECUTE format(
      'CREATE POLICY portal_staff_only ON %s AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))',
      t.rel
    );
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_apply_staff_guard() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.portal_apply_staff_guard() IS
  'Adds the RESTRICTIVE portal_staff_only policy to every public table with RLS (patient app logins get nothing). Run after creating tables.';

DO $$
DECLARE
  n integer;
BEGIN
  n := public.portal_apply_staff_guard();
  RAISE NOTICE 'Staff-only guard added to % tables', n;
END $$;

-- Storage files (lab reports, documents, images): the same rule. Public buckets' public links still work.
-- Some projects do not let the SQL editor add policies to storage.objects ("must be owner"): then the
-- script carries on with a WARNING, and the same policy must be added in Dashboard > Storage > Policies
-- (storage.objects, RESTRICTIVE, all operations, role authenticated, expression
-- (SELECT public.portal_is_staff())) before go-live.
-- Fix 2026-10-07: not run on this database. It is shared with other apps and storage changes are left to the
-- owner: a policy on storage.objects covers every bucket, so it could also lock out the other apps' signed-in
-- users. Add it in the dashboard before go-live, limited to OneHealth's buckets, e.g. the expression
--   bucket_id NOT IN ('documents', 'media', 'medical-aid-logos', 'patient-imaging', 'patient-laboratory',
--                     'patient-media', 'practice-images') OR (SELECT public.portal_is_staff())
DO $$
BEGIN
  -- EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON storage.objects';
  -- EXECUTE 'CREATE POLICY portal_staff_only ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated '
  --         'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  RAISE WARNING 'NOT DONE: staff-only guard on storage.objects (shared database: left to the owner). Add it in the dashboard, limited to OneHealth buckets, before go-live (see above).';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. A new cell number on a patient file ends that file's links: the old number may now belong to
--    someone else. The patient links again from the new number (with their ID number or birth date).
--    Only a change of digits counts ("0811234567" -> "081 123 4567" keeps the links).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patient_accounts_revoke_on_number_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.patient_accounts
  SET revoked_at = now(), revoke_reason = 'cell_number_changed'
  WHERE patient_id = NEW.id AND revoked_at IS NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.patient_accounts_revoke_on_number_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS patient_accounts_revoke_on_number_change ON public.patients;
CREATE TRIGGER patient_accounts_revoke_on_number_change
  AFTER UPDATE OF cell_number ON public.patients
  FOR EACH ROW
  WHEN (regexp_replace(COALESCE(OLD.cell_number, ''), '[^0-9]', '', 'g')
        IS DISTINCT FROM regexp_replace(COALESCE(NEW.cell_number, ''), '[^0-9]', '', 'g'))
  EXECUTE FUNCTION public.patient_accounts_revoke_on_number_change();

-- ---------------------------------------------------------------------------------------------
-- 8. Sign-in codes are logged by the gateway with message_type 'auth_otp' (the code itself hidden).
--    If the live table restricts message_type and the list lacks 'auth_otp', stop: no code would be sent.
--    Fix (with the name and values from the error), then run the script again:
--      ALTER TABLE public.practice_sms_logs DROP CONSTRAINT <name>;
--      ALTER TABLE public.practice_sms_logs ADD CONSTRAINT <name>
--        CHECK (message_type IN (<the existing values>, 'auth_otp'));
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.practice_sms_logs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%message_type%'
  LOOP
    IF c.definition NOT ILIKE '%auth_otp%' THEN
      RAISE EXCEPTION 'practice_sms_logs check % does not allow message_type auth_otp: %', c.conname, c.definition
        USING HINT = 'Add auth_otp to that list (see section 8 of this file), then run the script again.';
    END IF;
  END LOOP;
END $$;

-- Change to COMMIT once reviewed (see "How to apply" at the top)
ROLLBACK;

-- =============================================================================================
-- After COMMIT (owner, in this order). <project-ref> is the Supabase project reference.
--   a) Deploy the functions (Supabase CLI; the dashboard editor cannot bundle ../_shared):
--        npx supabase functions deploy centralized-sms-gateway --project-ref <project-ref>
--        npx supabase functions deploy patient-portal --project-ref <project-ref>
--        npx supabase functions deploy auth-sms-hook --no-verify-jwt --project-ref <project-ref>
--   b) Dashboard > Authentication > Hooks > "Send SMS hook": type HTTPS, URL
--        https://<project-ref>.supabase.co/functions/v1/auth-sms-hook
--      Generate the secret there, then store it for the function (keep it out of git):
--        npx supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_...' --project-ref <project-ref>
--      Optional: PORTAL_WEB_OTP_DOMAIN=app.onehealthsystems.com (Android offers the code on screen),
--      OTP_EXPIRY_MINUTES=5 (must match the expiry below).
--   c) Dashboard > Authentication > Providers > Phone: enable; allow new users to sign up (a patient's
--      first sign-in creates their login); SMS OTP expiry 300 seconds; OTP length 6.
--      Authentication > Rate limits: keep "SMS messages per hour" modest (e.g. 100); the hook adds its
--      own caps per number and per hour.
--      Authentication > Providers > Email: switch off "Allow new users to sign up" if staff logins are
--      only created by OneHealth (anyone could otherwise make an email login).
--   d) If the run printed "NOT DONE: staff-only guard on storage.objects", add that policy in the
--      dashboard now (section 6). Then check the NOTICE list of views and functions (section 0d).
--   e) Try it with one test patient whose file has your cell number before telling practices.
--
-- Undo (only if needed; deletes all patient app links and requests):
--   DROP POLICY IF EXISTS portal_staff_only ON storage.objects;
--   DO $$ DECLARE t record; BEGIN FOR t IN SELECT schemaname, tablename FROM pg_policies
--     WHERE policyname = 'portal_staff_only' AND schemaname = 'public' LOOP
--     EXECUTE format('DROP POLICY portal_staff_only ON %I.%I', t.schemaname, t.tablename); END LOOP; END $$;
--   DROP TRIGGER IF EXISTS patient_accounts_revoke_on_number_change ON public.patients;
--   DROP TRIGGER IF EXISTS lab_results_release_guard ON public.lab_results;
--   DROP TABLE IF EXISTS public.patient_portal_requests, public.patient_portal_link_attempts,
--     public.patient_portal_otp_sends, public.patient_accounts;
--   DROP FUNCTION IF EXISTS public.portal_my_patients(), public.portal_appointments(uuid), public.portal_invoices(uuid),
--     public.portal_invoice_lines(uuid), public.portal_prescriptions(uuid), public.portal_lab_results(uuid),
--     public.portal_linked_patient_ids(), public.portal_apply_staff_guard(), public.portal_is_staff(),
--     public.release_lab_results_to_patient(uuid, boolean), public.lab_results_release_guard(),
--     public.patient_accounts_revoke_on_number_change(), public.patient_portal_requests_touch_updated_at();
--   (The lab_results release columns can stay; they are only read by the patient app.)
-- =============================================================================================

-- Applied 2026-10-14 as migration claims_need_icd10_2026_10_14 (version 20261014031655, UTC; stored statement md5 904d1c45eb4551ee87f2317a7cb8dcd1 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left; invented batches under the practice number
-- 9999999990001, and one invented discontinued code D98.98 because the list has no discontinued diagnosis code that is also
-- marked for clinical use): 23 code shapes gave the answers section 1 describes (blank, null, lower case without a dot, padded,
-- trailing dot, dagger mark, two codes, leading slash, external cause, letters, category heading, asterisk, not in the list, a
-- discontinued code on its last day and the day after, no date, an odd date, any character for the dot); a batch with 7 bad
-- lines of 11 was refused (P0001, "Batch 1 cannot be marked as sent: 7 of its lines have no valid main ICD-10 code saved ...")
-- for status and sent_at together, sent_at alone, status sent alone, sending, confirmed and SENT in capitals; ready, draft,
-- open and active again, and other changes, went through; an empty batch could be sent; a credit file with a blank line was
-- refused; once its codes were saved the same batch was sent; a sent batch still moved on to paid and partially_paid with a
-- blank line, and claim_batch_refresh_status ran on one. The practice's administrator and doctor asked about their own
-- batches and OneHealth support about any; a doctor of another practice, an inactive user, a patient-app login and the public
-- key were refused (42501), and a doctor of another practice changed 0 rows; support was held to the guard like everyone.
-- Staff could not run prepare_batch_for_sending, the helper or the trigger function (42501). Running the body twice left one
-- trigger. The 99 real batches and 111 real lines were not touched; the 8 open batches (70 lines) are held back by their 70
-- lines until their codes are saved. After applying: the privileges, the trigger, the row counts and the 70 were checked again.
-- =============================================================================================
-- PROPOSAL: a claim batch cannot be marked as sent while a line has no usable main ICD-10 code
-- File:   proposals/2026-10-14-claims-need-icd10.sql              Drafted: 2026-10-14 (agent claims-safety)
-- Code:   src/components/finance/claims/claimsService.ts (submitBatch asks claim_batch_icd10_gaps before it emails
--         anything), BatchReview.tsx (Submit waits until the confirmed codes are saved),
--         src/components/modals/EnhancedFinancialModal.tsx (no longer sends: it opens the batch's claim review)
--
-- Why
--   NAMAF Circular 4 of 2025: since 1 July 2025 a claim line without an ICD-10 code is not paid. Claim review
--   (BatchReview + claimValidation) already stops "Submit to fund" while a line has no usable main code. The database
--   itself did not: every staff member of the practice may update batch_headers (policy batch_headers_staff), and the
--   deployed send-batch-email function emailed a file built by prepare_batch_for_sending(), which checks no ICD-10
--   code at all (it also wrote EMINANCE as the source software and fell back to claims@medicalaid.com for a fund
--   without an email address). Today every claim line in the database is saved without a code: 111 lines, 70 of them
--   (N$15,722.59) in the 8 open batches, so none of those 8 can be marked as sent until its codes are saved.
--
-- What it does (additive: no policy change, no existing row changes)
--   1. claim_main_icd10_ok(code, service date): whether the first code of a line's diagnostic_code ("K02.1/K04.0") can
--      be the main code of a claim line. It applies what claim review treats as errors (src/utils/billing/icd10.ts,
--      icd10Master.ts): the ICD-10 shape; not an external cause code (V to Y); and in the medical aids' list
--      (icd10_codes) the code is there, is not a category heading, is not an asterisk code and is not discontinued (a
--      discontinued code still counts for a service date up to the day it ended). The list marks 177 more codes (for
--      example Z37.0 and B90.0) "not valid as the main diagnosis" (valid_primary = false): claim review only warns
--      about those and leaves it to the practitioner, so the guard does not refuse them either. Internal: app logins
--      cannot call it.
--   2. claim_batch_icd10_gaps(batch): how many lines of the batch fail that test (0 = none), for staff of the batch's
--      practice and OneHealth support. The app asks it before it emails a file, so a file never goes out that the
--      database would then refuse to record as sent.
--   3. The guard, a trigger on batch_headers: when a batch that is not sent yet (no sent_at and an open status:
--      active, open, draft or ready, the two tests of the app's isOpenBatch and of claim_batch_refresh_status) is
--      changed to sent (sent_at set, or any other status) while a line fails the test, the change is refused in plain
--      words. Only that step is guarded: a sent batch keeps its rows and the funds' answers still move it from sent
--      to paid and so on, every other change to an open batch goes through, and no existing row is touched. A credit
--      file (transaction type C) is held to the same rule, as claim review holds it.
--   4. prepare_batch_for_sending(batch): EXECUTE taken from PUBLIC, anon and signed-in users; the service key keeps
--      it. Nothing in src, in supabase/functions (only the DEPRECATED_send-batch-email copies), in a database
--      function, view or cron job calls it; its caller was the send-batch-email edge function, retired in the same
--      change.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until it is applied the app works as before (submitBatch carries on when claim_batch_icd10_gaps is
-- missing).
-- Undo: DROP TRIGGER IF EXISTS batch_headers_sent_needs_icd10 ON public.batch_headers;
--       DROP FUNCTION IF EXISTS public.claim_batch_sent_needs_icd10();
--       DROP FUNCTION IF EXISTS public.claim_batch_icd10_gaps(uuid);
--       DROP FUNCTION IF EXISTS public.claim_main_icd10_ok(text, text);
--       GRANT EXECUTE ON FUNCTION public.prepare_batch_for_sending(uuid) TO authenticated;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Can this line's first ICD-10 code be the main code of a claim line?
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_main_icd10_ok(p_diagnostic_code text, p_service_date text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_code  text;
  v_entry public.icd10_codes%ROWTYPE;
BEGIN
  -- The main code is the first one on the line ("K02.1/K04.0"), tidied as the app does (normalizeIcd10): upper case,
  -- no spaces or dagger and asterisk marks, a missing dot added ("J069" -> "J06.9"), a trailing dot dropped
  v_code := (regexp_split_to_array(regexp_replace(btrim(COALESCE(p_diagnostic_code, '')), '^[/,;[:space:]]+', ''), '[/,;[:space:]]+'))[1];
  v_code := upper(translate(COALESCE(v_code, ''), '*+' || chr(8224), ''));
  IF right(v_code, 1) = '.' THEN
    v_code := left(v_code, -1);
  END IF;
  IF v_code ~ '^[A-Z][0-9]{3,4}$' THEN
    v_code := left(v_code, 3) || '.' || substr(v_code, 4);
  END IF;

  -- The ICD-10 shape (A00, J06.9, S52.50), and never an external cause code (V01 to Y98) as the main code
  IF v_code !~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$' OR v_code ~ '^[VWXY]' THEN
    RETURN false;
  END IF;

  -- The medical aids' list (icd10_codes). Not loaded at all (a fresh database): the shape is all that can be checked
  SELECT * INTO v_entry FROM public.icd10_codes c WHERE c.code = v_code;
  IF NOT FOUND THEN
    RETURN NOT EXISTS (SELECT 1 FROM public.icd10_codes);
  END IF;
  -- A category heading is not a diagnosis; an asterisk code never comes first
  IF NOT v_entry.valid_clinical_use OR v_entry.is_asterisk THEN
    RETURN false;
  END IF;
  -- Discontinued: still valid for a service date up to the day it ended (batch lines hold the date as yyyyMMdd)
  IF upper(btrim(COALESCE(v_entry.status, ''))) = 'D'
     AND NOT (v_entry.sa_end_date IS NOT NULL
              AND COALESCE(p_service_date, '') ~ '^[0-9]{8}$'
              AND p_service_date <= to_char(v_entry.sa_end_date, 'YYYYMMDD')) THEN
    RETURN false;
  END IF;
  RETURN true;
END
$$;

COMMENT ON FUNCTION public.claim_main_icd10_ok(text, text) IS
  'Whether the first code of a claim line''s diagnostic_code (and the line''s yyyyMMdd service date) can be the main ICD-10 code of the line: the tests claim review treats as errors. Internal.';

REVOKE ALL ON FUNCTION public.claim_main_icd10_ok(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_main_icd10_ok(text, text) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. How many lines of a batch have no usable main ICD-10 code saved
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_batch_icd10_gaps(p_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_practice uuid;
  v_gaps     integer;
BEGIN
  SELECT h.practice_id INTO v_practice FROM public.batch_headers h WHERE h.id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The claim batch was not found';
  END IF;
  -- The batch of the caller's own practice (OneHealth support: any); the service key and the database owner pass
  PERFORM public.rls_assert_my_practice(v_practice, true);

  SELECT count(*)::integer INTO v_gaps
    FROM public.batch_details d
   WHERE d.batch_header_id = p_batch_id
     AND NOT public.claim_main_icd10_ok(d.diagnostic_code, d.service_date);
  RETURN v_gaps;
END
$$;

COMMENT ON FUNCTION public.claim_batch_icd10_gaps(uuid) IS
  'How many lines of a claim batch have no usable main ICD-10 code saved (0 = none). Own practice only (support: any). Asked by the app before it emails a claim file; the guard on batch_headers uses it too.';

REVOKE ALL ON FUNCTION public.claim_batch_icd10_gaps(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_batch_icd10_gaps(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. The guard: an open batch cannot become a sent one while a line has no usable main ICD-10 code
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_batch_sent_needs_icd10()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gaps integer;
BEGIN
  -- Still not sent after this change: nothing to hold back (the trigger only fires for a batch that was open before)
  IF NEW.sent_at IS NULL AND lower(COALESCE(NEW.status, 'active')) IN ('active', 'open', 'draft', 'ready') THEN
    RETURN NEW;
  END IF;

  v_gaps := public.claim_batch_icd10_gaps(NEW.id);
  IF v_gaps > 0 THEN
    RAISE EXCEPTION 'Batch % cannot be marked as sent: % no valid main ICD-10 code saved (no ICD-10, no payment). Add and save the codes in Finance > Claims first.',
      NEW.batch_number,
      CASE WHEN v_gaps = 1 THEN '1 of its lines has' ELSE v_gaps::text || ' of its lines have' END;
  END IF;
  RETURN NEW;
END
$$;

COMMENT ON FUNCTION public.claim_batch_sent_needs_icd10() IS
  'Guard on batch_headers: a batch that is not sent yet cannot change to sent while a line has no usable main ICD-10 code (NAMAF Circular 4 of 2025: no ICD-10, no payment).';

REVOKE ALL ON FUNCTION public.claim_batch_sent_needs_icd10() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS batch_headers_sent_needs_icd10 ON public.batch_headers;
CREATE TRIGGER batch_headers_sent_needs_icd10
  BEFORE UPDATE OF status, sent_at ON public.batch_headers
  FOR EACH ROW
  WHEN (OLD.sent_at IS NULL AND lower(COALESCE(OLD.status, 'active')) IN ('active', 'open', 'draft', 'ready'))
  EXECUTE FUNCTION public.claim_batch_sent_needs_icd10();

-- ---------------------------------------------------------------------------------------------
-- 4. The database function that built a claim file with no ICD-10 check is closed to app logins
-- ---------------------------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.prepare_batch_for_sending(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT has_function_privilege('authenticated', 'public.prepare_batch_for_sending(uuid)', 'EXECUTE') AS staff_run_prepare,
       has_function_privilege('anon', 'public.prepare_batch_for_sending(uuid)', 'EXECUTE') AS anon_runs_prepare,
       has_function_privilege('service_role', 'public.prepare_batch_for_sending(uuid)', 'EXECUTE') AS service_runs_prepare,
       has_function_privilege('authenticated', 'public.claim_batch_icd10_gaps(uuid)', 'EXECUTE') AS staff_ask_gaps,
       has_function_privilege('anon', 'public.claim_batch_icd10_gaps(uuid)', 'EXECUTE') AS anon_asks_gaps,
       has_function_privilege('authenticated', 'public.claim_main_icd10_ok(text, text)', 'EXECUTE') AS staff_run_helper,
       (SELECT count(*) FROM pg_trigger
         WHERE tgrelid = 'public.batch_headers'::regclass AND tgname = 'batch_headers_sent_needs_icd10' AND NOT tgisinternal) AS guard_triggers;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

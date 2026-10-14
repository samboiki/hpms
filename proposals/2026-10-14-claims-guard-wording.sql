-- Applied 2026-10-14 as migration claims_guard_wording_2026_10_14 (version 20261014130818, UTC; stored statement md5 5a8184595cc9e5c63ef9968f53523d53 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left; one invented batch with one line and no
-- code under the practice number 9999999990001 of the test practice): before the change the refusal said Finance > Claims, after it
-- Finance > Batches, as the database owner, the practice's doctor and administrator and OneHealth support (all P0001); another
-- practice's staff changed 0 rows and the batch stayed open; the public key was refused (42501); once the line's code was saved the
-- practice's doctor marked the batch as sent. The privileges ({postgres, service_role}) and the one trigger were the same before
-- and after, and the 99 real batches and 111 real lines were not touched.
-- =============================================================================================
-- PROPOSAL: the claim guard's refusal names the place staff can open: Finance > Batches (Finance has no Claims tab)
-- File:   proposals/2026-10-14-claims-guard-wording.sql             Drafted: 2026-10-14 (agent w12-fix)
-- Code:   src/__tests__/screenNamesInText.test.ts keeps every text the app shows to the tabs Finance has (Overview, Invoicing,
--         Quotes, Payments, Debtors, Ledgers, Reports, Batches, Remittances); the database's own words must do the same.
--
-- Why
--   proposals/2026-10-14-claims-need-icd10.sql (applied as claims_need_icd10_2026_10_14) refuses to mark a claim batch as sent while
--   a line has no usable main ICD-10 code, and ends its refusal "Add and save the codes in Finance > Claims first." Staff would look
--   for a tab that does not exist: a batch is reviewed, its codes saved and the batch sent from Finance > Batches. The words reach
--   staff when a batch's codes change between the app's own check and the save of "sent" ("The claim file WAS emailed ... but the
--   batch could not be marked as sent (<this message>)").
--
-- What it does (one function, same body; no row, policy, privilege or trigger changes)
--   Replaces claim_batch_sent_needs_icd10() with the same body and the corrected place name. The trigger that calls it, the
--   privileges (only the trigger and the service key run it) and every row stay as they were.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one migration.
-- Undo: run section 3 of proposals/2026-10-14-claims-need-icd10.sql again (it holds the earlier wording).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The guard, as it was, with the place named correctly
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
    RAISE EXCEPTION 'Batch % cannot be marked as sent: % no valid main ICD-10 code saved (no ICD-10, no payment). Add and save the codes in Finance > Batches first.',
      NEW.batch_number,
      CASE WHEN v_gaps = 1 THEN '1 of its lines has' ELSE v_gaps::text || ' of its lines have' END;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.claim_batch_sent_needs_icd10() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT pg_get_functiondef('public.claim_batch_sent_needs_icd10()'::regprocedure) LIKE '%Finance > Batches first.%' AS names_batches,
       pg_get_functiondef('public.claim_batch_sent_needs_icd10()'::regprocedure) LIKE '%Finance > Claims%' AS still_names_claims,
       has_function_privilege('authenticated', 'public.claim_batch_sent_needs_icd10()', 'EXECUTE') AS staff_run_guard,
       has_function_privilege('anon', 'public.claim_batch_sent_needs_icd10()', 'EXECUTE') AS anon_runs_guard,
       (SELECT count(*) FROM pg_trigger
         WHERE tgrelid = 'public.batch_headers'::regclass AND tgname = 'batch_headers_sent_needs_icd10' AND NOT tgisinternal) AS guard_triggers;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

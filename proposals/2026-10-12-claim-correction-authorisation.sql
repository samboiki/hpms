-- Applied 2026-10-12 as migration claim_correction_authorisation_2026_10_12 (version 20261012150902; md5 of the part
-- between BEGIN; and ROLLBACK; = md5 of the stored statement: 237bda25bc02ec4ad277deb54f798945; live prosrc md5 of
-- claim_line_correct afterwards 780a89a51a953f2eb7c735ecdeda1ae9). Rehearsed with simulated logins (rolled back):
-- another practice's doctor and anon refused (42501); an admin's " ab.12/3 " reached the resent claim line and the
-- invoice line as "ab.12/3" (field 32 R; claim_corrected and line_changed recorded); a number with a space or of 22
-- characters was refused; every sent batch line unchanged.
-- =============================================================================================
-- PROPOSAL: a corrected authorisation number follows the invoice line's rule and goes on the invoice line too
-- File:   proposals/2026-10-12-claim-correction-authorisation.sql        Drafted: 2026-10-12
-- Code:   src/components/finance/claims/claimCorrections.ts (correctionPlan uses parseAuthorisationNumber of
--         src/utils/billing/lineSplit.ts, the app's one authorisation rule)
--
-- Why: claim_line_correct (proposals/2026-10-09-claim-corrections.sql) was written before invoice lines could hold an
-- authorisation number. proposals/2026-10-09-line-portions.sql, applied a few minutes earlier, added
-- invoice_services.authorisation_number with its own rule (1-21 letters, digits, '/', '.' or '-', as typed). So a
-- correction (a) refused a number with a '.' that the invoice line and the app accept, and upper-cased what the
-- staff typed; and (b) left the invoice line on the old number while the claim went out with the new one, so a later
-- claim of that line would carry the wrong number again.
-- What changes, in claim_line_correct only (its live text is read and three statements are replaced, each found
-- exactly once; the md5 of the live text must be the one the claim-corrections file left):
--   1. The typed number is kept as typed (outer spaces off) and checked by the invoice line's rule; empty clears it.
--   2. The invoice line takes the corrected number, like the date, practitioner and ICD-10 codes (its change history
--      records who and when); "invoice_line_updated" says so.
-- Nothing else changes: the same checks before (claim_line_resend_blocker, the invoice in its sent batch), the same
-- copy into the fund's open batch with field 32 R, the same audit event. Policies are not touched.
--
-- How to apply: rehearse (scripts/db/rehearsal.ts), then apply the part between BEGIN; and ROLLBACK; as a migration.
-- Undo: run claim_line_correct as proposals/2026-10-09-claim-corrections.sql left it (section 8 of that file).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.claim_line_correct(uuid,jsonb,text)'::regprocedure) <> '005bff5f9d1a28ffd9d2776ce7c9a271' THEN
    RAISE EXCEPTION 'Stopped: claim_line_correct is not the version proposals/2026-10-09-claim-corrections.sql left; merge by hand';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'invoice_services' AND column_name = 'authorisation_number') THEN
    RAISE EXCEPTION 'Stopped: invoice_services.authorisation_number is missing; apply proposals/2026-10-09-line-portions.sql first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.invoice_services'::regclass AND conname = 'invoice_services_authorisation_check'
                    AND pg_get_constraintdef(oid) LIKE '%^[A-Za-z0-9/.-]{1,21}$%') THEN
    RAISE EXCEPTION 'Stopped: the invoice line''s authorisation rule is not the one this file follows; merge by hand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. claim_line_correct: the invoice line's authorisation rule, and the number on the invoice line
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def text;
  v_old_rule text := $o$    v_auth := upper(btrim(COALESCE(v_changes->>'authorisation_number', '')));
    IF length(v_auth) > 21 OR v_auth !~ '^[A-Z0-9/-]*$' THEN
      RAISE EXCEPTION 'The authorisation number may only hold letters, digits, "/" and "-" (at most 21)';
    END IF;
    IF v_auth IS DISTINCT FROM upper(btrim(COALESCE(v_detail.authorisation_number, ''))) THEN$o$;
  v_new_rule text := $n$    -- As typed, by the invoice line's rule (invoice_services_authorisation_check; parseAuthorisationNumber in the app)
    v_auth := btrim(COALESCE(v_changes->>'authorisation_number', ''));
    IF v_auth <> '' AND v_auth !~ '^[A-Za-z0-9/.-]{1,21}$' THEN
      RAISE EXCEPTION 'An authorisation number has at most 21 letters or digits (no spaces or commas)';
    END IF;
    IF v_auth IS DISTINCT FROM btrim(COALESCE(v_detail.authorisation_number, '')) THEN$n$;
  v_old_update text := $o$  IF v_has_line AND (v_after ?| ARRAY['service_date', 'practitioner_id', 'icd10']) THEN
    UPDATE invoice_services
       SET service_date = CASE WHEN v_after ? 'service_date' THEN v_new_date ELSE service_date END,$o$;
  v_new_update text := $n$  IF v_has_line AND (v_after ?| ARRAY['service_date', 'practitioner_id', 'icd10', 'authorisation_number']) THEN
    UPDATE invoice_services
       SET authorisation_number = CASE WHEN v_after ? 'authorisation_number' THEN NULLIF(v_auth, '') ELSE authorisation_number END,
           service_date = CASE WHEN v_after ? 'service_date' THEN v_new_date ELSE service_date END,$n$;
  v_old_return text := $o$'invoice_line_updated', v_has_line AND (v_after ?| ARRAY['service_date', 'practitioner_id', 'icd10']),$o$;
  v_new_return text := $n$'invoice_line_updated', v_has_line AND (v_after ?| ARRAY['service_date', 'practitioner_id', 'icd10', 'authorisation_number']),$n$;
  v_pair text[];
BEGIN
  SELECT pg_get_functiondef('public.claim_line_correct(uuid,jsonb,text)'::regprocedure) INTO v_def;
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[[v_old_rule, v_new_rule], [v_old_update, v_new_update], [v_old_return, v_new_return]] LOOP
    IF (length(v_def) - length(replace(v_def, v_pair[1], ''))) / length(v_pair[1]) <> 1 THEN
      RAISE EXCEPTION 'claim_line_correct: a statement to replace was not found exactly once; nothing changed';
    END IF;
    v_def := replace(v_def, v_pair[1], v_pair[2]);
  END LOOP;
  EXECUTE v_def;
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 2. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_src text := (SELECT prosrc FROM pg_proc WHERE oid = 'public.claim_line_correct(uuid,jsonb,text)'::regprocedure);
BEGIN
  IF position('SET authorisation_number = CASE' in v_src) = 0 OR position('^[A-Za-z0-9/.-]{1,21}$' in v_src) = 0
     OR position('upper(btrim(COALESCE(v_changes->>''authorisation_number''' in v_src) > 0 THEN
    RAISE EXCEPTION 'Check failed: claim_line_correct does not follow the invoice line''s authorisation rule';
  END IF;
  -- The guards stay: the one resend, the blocker, the staff check
  IF position('claim_line_resend(v_batch.practice_id, p_line_id, ''R'', v_copy)' in v_src) = 0
     OR position('claim_line_resend_blocker(p_line_id, true)' in v_src) = 0 OR position('claim_assert_staff(v_batch.practice_id)' in v_src) = 0 THEN
    RAISE EXCEPTION 'Check failed: claim_line_correct lost a guard';
  END IF;
  IF has_function_privilege('anon', 'public.claim_line_correct(uuid,jsonb,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.claim_line_correct(uuid,jsonb,text)', 'EXECUTE')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.claim_line_correct(uuid,jsonb,text)'::regprocedure
                     AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'Check failed: claim_line_correct must stay for signed-in users only, running as its owner';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

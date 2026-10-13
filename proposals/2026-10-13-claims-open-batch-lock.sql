-- Applied 2026-10-13 as migration claims_open_batch_lock_2026_10_13 (version 20261012235814; stored statement md5 f7745ca6024e549911f94a2f990ceee6 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: get_or_create_active_batch_id 5e9c2e0cd466dde342566220f31b8f77 (before b8c8d40a660f31bc422705ce24161a52);
-- claim_invoice_into_batch 4be30582c749603e7d94dc408b5e3eb6 and assign_claim_batch_number 3a114432d9b46728987949d054fb2a22 unchanged.
-- Rehearsed (rolled back): the migration changed no batch, line or invoice link; all 20 invoices of every open batch
-- rebuilt by the current and the new function gave byte-identical lines, totals and links (an open batch is still found
-- without any lock); with a fund's open batch just sent, saving one of its invoices opened a batch identical to the one
-- the current function opens (header, lines, the invoice's link), and asking again found that batch, one open batch for
-- the fund; the first look comes before the lock, the second after it and before the insert, on the key
-- assign_claim_batch_number takes; every invoice of the sent batch saved again left it byte for byte unchanged; owner,
-- privileges and security invoker unchanged. After applying (rolled back): anon and another practice's staff are still
-- refused, the practice's own administrator gets one batch and the same one again. The undo file put the md5 back to
-- b8c8d40a660f31bc422705ce24161a52. Two sessions at once could not be run from the tools used here (one call at a time,
-- prepared transactions off). By hand, on a test copy (a branch or a local restore), in two psql sessions, for a
-- practice and fund with no open batch: session 1 BEGIN; SELECT public.get_or_create_active_batch_id(<practice>,
-- '<fund>'); (do not end it). Session 2 BEGIN; the same SELECT waits. COMMIT session 1: session 2 returns session 1's
-- batch id (before this file it opened a second batch there). ROLLBACK session 2.
-- =============================================================================================
-- PROPOSAL: two saves at the moment a fund has no open batch never open two batches for that fund
-- File:   proposals/2026-10-13-claims-open-batch-lock.sql          Drafted: 2026-10-13
-- Code:   none (the claim builders and Claims > Not yet batched already find or open a batch through this function)
--
-- Why
--   get_or_create_active_batch_id(practice, fund) finds the fund's open claim batch, else opens one. Two saves at the
--   moment the fund has none (just after its batch was sent) both looked, both found none and both opened a batch: the
--   second waited only at the insert (the batch-number lock of assign_claim_batch_number) and then opened a second
--   batch. Lines then went into either batch, and the fund would get two files. (No fund has two open batches today.)
--   It is called by the automatic batching (claim_invoice_into_batch), by lines sent again (claim_line_resend), by
--   batch_parent_invoice and auto_assign_invoice_to_batch, and directly by Claims > Not yet batched
--   (claimsService.addInvoicesToFundBatch), so the lock lives here, where every path passes. (Credit files are opened
--   by claim_reversals_to_batch under its own per-practice-and-fund lock, never through this function.)
--
-- What it does (get_or_create_active_batch_id only, edited in its live definition: one statement found exactly once;
-- its Windows line endings are kept)
--   When no open batch is found: the practice takes the lock assign_claim_batch_number already takes to number a new
--   batch (pg_advisory_xact_lock on 'claim_batch_number:' and the practice number), then looks again. A second save
--   waits there until the first is done, then finds the batch the first opened. Opening a batch already waited on that
--   lock at its insert, so nothing new is serialised and no new lock order is added; finding an open batch takes no
--   lock at all, as before. What a batch looks like when it is opened is unchanged. Owner and privileges are kept.
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; followed by tests that end in RAISE EXCEPTION), then
-- apply that part as one migration (claims_open_batch_lock_2026_10_13).
-- Undo: proposals/2026-10-13-claims-open-batch-lock-undo.sql takes the added lines out again (the function's prosrc
--       md5 returns to b8c8d40a660f31bc422705ce24161a52, checked in section 0 here).
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.get_or_create_active_batch_id(uuid,text)'::regprocedure) <> 'b8c8d40a660f31bc422705ce24161a52' THEN
    RAISE EXCEPTION 'Stopped: get_or_create_active_batch_id is not the version this file was written against; merge by hand';
  END IF;
  IF position('hashtext(''claim_batch_number:'' || NEW.practice_number)' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.assign_claim_batch_number()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Stopped: assign_claim_batch_number no longer takes the batch-number lock this file shares; merge by hand';
  END IF;
  -- Who may run it, to check at the end that nothing changed
  PERFORM set_config('onehealth.acl_before', (SELECT proacl::text FROM pg_proc WHERE oid = 'public.get_or_create_active_batch_id(uuid,text)'::regprocedure), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. get_or_create_active_batch_id: no open batch found, so wait for any other opening, then look again
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  -- The function was saved with Windows line endings; the lines added here keep them
  v_nl constant text := chr(13) || chr(10);
  v_def text;
  v_anchor text;
  v_added text;
BEGIN
  v_anchor := '    IF v_practice_number IS NULL THEN' || v_nl
    || '        RAISE EXCEPTION ''Practice not found or practice_number not set for practice_id %'', p_practice_id;' || v_nl
    || '    END IF;' || v_nl;
  v_added := v_nl
    || '    -- One opening at a time per practice: wait while another save opens a batch (the lock assign_claim_batch_number' || v_nl
    || '    -- takes to number it), then look again, so two saves never open two batches for one fund' || v_nl
    || '    -- (2026-10-13-claims-open-batch-lock.sql)' || v_nl
    || '    PERFORM pg_advisory_xact_lock(hashtext(''claim_batch_number:'' || v_practice_number));' || v_nl
    || '    SELECT id INTO v_batch_id' || v_nl
    || '    FROM batch_headers' || v_nl
    || '    WHERE practice_id = p_practice_id' || v_nl
    || '      AND medical_aid_reference = p_medical_aid_reference' || v_nl
    || '      AND status = ''active''' || v_nl
    || '    LIMIT 1;' || v_nl
    || '    IF v_batch_id IS NOT NULL THEN' || v_nl
    || '        RETURN v_batch_id;' || v_nl
    || '    END IF;' || v_nl;
  SELECT pg_get_functiondef('public.get_or_create_active_batch_id(uuid, text)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 THEN
    RAISE EXCEPTION 'get_or_create_active_batch_id: the practice-number check was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_anchor, v_anchor || v_added);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 2. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_src text := (SELECT prosrc FROM pg_proc WHERE oid = 'public.get_or_create_active_batch_id(uuid,text)'::regprocedure);
  v_lock integer;
  v_insert integer;
BEGIN
  v_lock := position('PERFORM pg_advisory_xact_lock(hashtext(''claim_batch_number:'' || v_practice_number));' in v_src);
  v_insert := position('INSERT INTO batch_headers' in v_src);
  -- The lock, then a second look, before a batch is opened; the first look stays without a lock
  IF v_lock = 0 OR v_insert = 0 OR v_lock > v_insert
     OR (length(v_src) - length(replace(v_src, 'AND status = ''active''', ''))) / length('AND status = ''active''') <> 2
     OR position('AND status = ''active''' in v_src) > v_lock
     OR position('AND status = ''active''' in substr(v_src, v_lock)) = 0 OR position('AND status = ''active''' in substr(v_src, v_lock)) > v_insert - v_lock THEN
    RAISE EXCEPTION 'Check failed: get_or_create_active_batch_id does not look again under the lock before opening a batch';
  END IF;
  IF position(chr(13) || chr(10) in v_src) = 0 OR v_src ~ '[^\r]\n' THEN
    RAISE EXCEPTION 'Check failed: the line endings of get_or_create_active_batch_id are mixed';
  END IF;
  IF (SELECT proacl::text FROM pg_proc WHERE oid = 'public.get_or_create_active_batch_id(uuid,text)'::regprocedure) IS DISTINCT FROM current_setting('onehealth.acl_before', true)
     OR (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_or_create_active_batch_id(uuid,text)'::regprocedure) THEN
    RAISE EXCEPTION 'Check failed: who may run get_or_create_active_batch_id, or how it runs, changed';
  END IF;
END $$;

ROLLBACK;

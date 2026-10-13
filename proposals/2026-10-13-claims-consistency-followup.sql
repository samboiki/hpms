-- Applied 2026-10-13 as migration claims_consistency_followup_2026_10_13 (version 20261012232829; stored statement md5 61eee3153596d3d6fa4a563b308a847a = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: claim_invoice_into_batch 4be30582c749603e7d94dc408b5e3eb6 (before b254e45e5fc2310cea809634ceccdab5);
-- sync_invoice_to_batch 059c5c8a8b90e3a99749f45885f580f3 and add_invoice_to_batch fa4850a1e3d75fc70e79c6b9f2441ac8 unchanged.
-- Rehearsed (rolled back): the migration changed no batch, line or invoice link; all 20 invoices of every open batch
-- rebuilt by the current and the new function gave byte-identical lines, totals and links; an open-batch invoice whose
-- patient lost the fund link kept pointing at its batch with 0 lines before (shown nowhere) and now points to none (back
-- in "Not yet batched"), every open batch's lines and totals as before; adding it by hand while unlinked was refused in
-- words (22023), nothing changed; a sent invoice whose patient lost the fund link, and every invoice of the sent batch
-- saved again, left the sent batch byte for byte unchanged; the batch lock comes before the line number is read, the
-- lock claim_line_copy takes; no batch has a line number twice today; privileges unchanged. The undo file put the md5
-- back to b254e45e5fc2310cea809634ceccdab5. Two sessions at once could not be run from the tools used here (one call at
-- a time, prepared transactions off). By hand, in two psql sessions, with two invoices of patients on one open batch's
-- fund that are in no batch yet: session 1 BEGIN; SELECT public.claim_invoice_into_batch(<invoice A>, <batch>); (do
-- not end it). Session 2 BEGIN; SET LOCAL lock_timeout = '3s'; SELECT public.claim_invoice_into_batch(<invoice B>,
-- <batch>); stops with 55P03 at the batch lock, before any line number is read. ROLLBACK both.
-- =============================================================================================
-- PROPOSAL: an invoice whose patient lost the fund link comes back to "Not yet batched" instead of showing nowhere, and
--           two saves for the same batch number their claim lines one after the other
-- File:   proposals/2026-10-13-claims-consistency-followup.sql          Drafted: 2026-10-13
-- Code:   src/components/finance/claims/claimsService.ts (loadUnbatchedInvoices) and UnbatchedInvoices.tsx ("Not yet
--         batched" shows why such an invoice cannot be claimed, with a link to the patient's file); the claim file names
--         the same practitioner as the claim line (claimedPractitionerOf, buildClaimLines; no SQL change for that)
--
-- Why
--   1. When a patient's medical aid record stopped naming a fund with a claim code, claim_invoice_into_batch (the claim
--      rules of sync_invoice_to_batch, proposals/2026-10-13-claims-consistency.sql) took the invoice's lines out of its
--      open batch but left the invoice pointing at that batch: it then showed in neither the batch nor "Not yet
--      batched", so it was never claimed or chased. (None today; the rehearsal sets one up.)
--   2. Two saves for the same fund at the same moment (two staff saving visits) both read the batch's last line number
--      before either wrote its lines, so two claim lines could get the same number in one batch, and the fund refuses
--      a file with a line number twice. claim_line_copy (lines sent again) already locks the batch first; the builder
--      did not.
--
-- What it does (claim_invoice_into_batch only, edited in its live definition: each statement found exactly once)
--   1. Not claimable because the fund link is missing: the invoice also leaves the batch it points to, and only a batch
--      that was never sent. A sent batch, its lines and an invoice's link to it are never touched (that case returns
--      before this point anyway). "Not yet batched" then lists the invoice with the reason.
--   2. The batch the lines go into is locked (SELECT ... FOR UPDATE on its header) before its last line number is read,
--      the lock claim_line_copy takes: a second save for the same batch waits until the first is done, then numbers its
--      lines after the first one's. Saves for other batches never wait.
--   Nothing else changes: for every invoice whose patient's fund is linked, a save produces byte for byte what it did.
--   CREATE OR REPLACE (through the edit) keeps owner and privileges: no app login and no public key can run it.
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; followed by tests that end in RAISE EXCEPTION), then
-- apply that part as one migration (claims_consistency_followup_2026_10_13).
-- Undo: proposals/2026-10-13-claims-consistency-followup-undo.sql puts both statements back (claim_invoice_into_batch's
--       prosrc md5 returns to b254e45e5fc2310cea809634ceccdab5, checked in section 0 here).
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.claim_invoice_into_batch(uuid,uuid)'::regprocedure) <> 'b254e45e5fc2310cea809634ceccdab5' THEN
    RAISE EXCEPTION 'Stopped: claim_invoice_into_batch is not the version proposals/2026-10-13-claims-consistency.sql left; merge by hand';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure) <> '059c5c8a8b90e3a99749f45885f580f3'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.add_invoice_to_batch(uuid,uuid)'::regprocedure) <> 'fa4850a1e3d75fc70e79c6b9f2441ac8' THEN
    RAISE EXCEPTION 'Stopped: sync_invoice_to_batch or add_invoice_to_batch changed since proposals/2026-10-13-claims-consistency.sql; merge by hand';
  END IF;
  -- The policies of the tables the claim builder reads and writes, to check at the end that none changed
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_services', 'invoices_enhanced', 'patients', 'batch_details', 'batch_headers', 'medical_aid_details')
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. claim_invoice_into_batch: a stale link to a never-sent batch is dropped; the batch is locked before numbering
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def text;
  v_edits text[][] := ARRAY[
    ARRAY[$o$    IF v_medical_aid_ref IS NULL THEN
        RETURN 'The patient''s medical aid details are not linked to a fund with a claim code: choose the fund on the patient''s file first';
    END IF;
$o$, $n$    IF v_medical_aid_ref IS NULL THEN
        -- Not claimable until the patient's file names a fund again: the invoice also leaves the batch it points to (its
        -- lines were taken out above), so "Not yet batched" lists it with this reason instead of it showing nowhere. Only
        -- a batch never sent: a sent batch keeps the invoice and its lines (2026-10-13-claims-consistency-followup.sql)
        UPDATE public.invoices_enhanced i SET batch_id = NULL
         WHERE i.id = p_invoice_id AND i.batch_id IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM public.batch_headers b
                WHERE b.id = i.batch_id
                  AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))
           );
        RETURN 'The patient''s medical aid details are not linked to a fund with a claim code: choose the fund on the patient''s file first';
    END IF;
$n$],
    ARRAY[$o$    SELECT * INTO v_batch FROM public.batch_headers WHERE id = v_batch_id;
$o$, $n$    -- One save at a time per batch: the header is locked before its last line number is read, so a second save for
    -- the same batch waits until this one is done and numbers its lines after these (claim_line_copy takes the same lock)
    SELECT * INTO v_batch FROM public.batch_headers WHERE id = v_batch_id FOR UPDATE;
$n$]
  ];
  v_i integer;
BEGIN
  SELECT pg_get_functiondef('public.claim_invoice_into_batch(uuid, uuid)'::regprocedure) INTO v_def;
  FOR v_i IN 1 .. array_length(v_edits, 1) LOOP
    IF (length(v_def) - length(replace(v_def, v_edits[v_i][1], ''))) / length(v_edits[v_i][1]) <> 1 THEN
      RAISE EXCEPTION 'claim_invoice_into_batch: statement % was not found exactly once; nothing changed', v_i;
    END IF;
    v_def := replace(v_def, v_edits[v_i][1], v_edits[v_i][2]);
  END LOOP;
  EXECUTE v_def;
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 2. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_rules text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.claim_invoice_into_batch(uuid, uuid)'::regprocedure);
  v_lock integer;
  v_number integer;
BEGIN
  -- The lock comes before the line number is read, on the batch the lines go into
  v_lock := position('FROM public.batch_headers WHERE id = v_batch_id FOR UPDATE' in v_rules);
  v_number := position('COALESCE(MAX(transaction_number_in_batch), 0) + 1' in v_rules);
  IF v_lock = 0 OR v_number = 0 OR v_lock > v_number THEN
    RAISE EXCEPTION 'Check failed: the batch is not locked before its last line number is read';
  END IF;
  -- A missing fund link drops only a link to a batch never sent; every earlier guard stays
  IF position('UPDATE public.invoices_enhanced i SET batch_id = NULL' in v_rules) = 0
     OR (length(v_rules) - length(replace(v_rules, 'b.sent_at IS NOT NULL', ''))) / length('b.sent_at IS NOT NULL') <> 3
     OR position('no_claims' in v_rules) = 0 OR position('GMED' in v_rules) = 0 OR position('icd10_primary' in v_rules) = 0
     OR position('v_target.sent_at IS NOT NULL' in v_rules) = 0 OR position('v_target.transaction_type' in v_rules) = 0
     OR position('v_target.medical_aid_reference IS DISTINCT FROM' in v_rules) = 0 THEN
    RAISE EXCEPTION 'Check failed: a guard of claim_invoice_into_batch is missing';
  END IF;
  IF has_function_privilege('anon', 'public.claim_invoice_into_batch(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_invoice_into_batch(uuid, uuid)', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.claim_invoice_into_batch(uuid, uuid)'::regprocedure AND a.grantee = 0)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.claim_invoice_into_batch(uuid, uuid)'::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'Check failed: claim_invoice_into_batch must stay for the database itself, running as its owner';
  END IF;
  IF current_setting('onehealth.policies_before', true) IS DISTINCT FROM (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_services', 'invoices_enhanced', 'patients', 'batch_details', 'batch_headers', 'medical_aid_details')) THEN
    RAISE EXCEPTION 'Check failed: a policy of the claim tables changed';
  END IF;
END $$;

ROLLBACK;

-- =============================================================================================
-- UNDO of proposals/2026-10-13-claims-consistency-followup.sql: the two statements of claim_invoice_into_batch it changed
-- are put back (prosrc md5 returns to b254e45e5fc2310cea809634ceccdab5, checked at the end).
-- Only for the owner's decision to go back: it ends in ROLLBACK; change that line to COMMIT to undo for real.
-- =============================================================================================
BEGIN;

DO $undo$
DECLARE
  v_def text;
  v_edits text[][] := ARRAY[
    ARRAY[$n$    IF v_medical_aid_ref IS NULL THEN
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
$n$, $o$    IF v_medical_aid_ref IS NULL THEN
        RETURN 'The patient''s medical aid details are not linked to a fund with a claim code: choose the fund on the patient''s file first';
    END IF;
$o$],
    ARRAY[$n$    -- One save at a time per batch: the header is locked before its last line number is read, so a second save for
    -- the same batch waits until this one is done and numbers its lines after these (claim_line_copy takes the same lock)
    SELECT * INTO v_batch FROM public.batch_headers WHERE id = v_batch_id FOR UPDATE;
$n$, $o$    SELECT * INTO v_batch FROM public.batch_headers WHERE id = v_batch_id;
$o$]
  ];
  v_i integer;
BEGIN
  SELECT pg_get_functiondef('public.claim_invoice_into_batch(uuid, uuid)'::regprocedure) INTO v_def;
  FOR v_i IN 1 .. array_length(v_edits, 1) LOOP
    IF (length(v_def) - length(replace(v_def, v_edits[v_i][1], ''))) / length(v_edits[v_i][1]) <> 1 THEN
      RAISE EXCEPTION 'claim_invoice_into_batch: statement % of the follow-up was not found exactly once; nothing changed', v_i;
    END IF;
    v_def := replace(v_def, v_edits[v_i][1], v_edits[v_i][2]);
  END LOOP;
  EXECUTE v_def;
END $undo$;

DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.claim_invoice_into_batch(uuid,uuid)'::regprocedure) <> 'b254e45e5fc2310cea809634ceccdab5' THEN
    RAISE EXCEPTION 'Check failed: claim_invoice_into_batch is not exactly as proposals/2026-10-13-claims-consistency.sql left it';
  END IF;
END $$;

ROLLBACK;

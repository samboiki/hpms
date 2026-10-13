-- =============================================================================================
-- UNDO of proposals/2026-10-13-claims-open-batch-lock.sql: the lines it added to get_or_create_active_batch_id are taken
-- out again (prosrc md5 returns to b8c8d40a660f31bc422705ce24161a52, checked at the end).
-- Only for the owner's decision to go back: it ends in ROLLBACK; change that line to COMMIT to undo for real.
-- =============================================================================================
BEGIN;

DO $undo$
DECLARE
  v_nl constant text := chr(13) || chr(10);
  v_def text;
  v_added text;
BEGIN
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
  IF (length(v_def) - length(replace(v_def, v_added, ''))) / length(v_added) <> 1 THEN
    RAISE EXCEPTION 'get_or_create_active_batch_id: the lines of 2026-10-13-claims-open-batch-lock.sql were not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_added, '');
END $undo$;

DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.get_or_create_active_batch_id(uuid,text)'::regprocedure) <> 'b8c8d40a660f31bc422705ce24161a52' THEN
    RAISE EXCEPTION 'Check failed: get_or_create_active_batch_id is not exactly as it was before proposals/2026-10-13-claims-open-batch-lock.sql';
  END IF;
END $$;

ROLLBACK;

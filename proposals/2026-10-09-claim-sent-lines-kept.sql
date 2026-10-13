-- Applied 2026-10-09 as migration claim_sent_lines_kept_2026_10_09 (stored statement md5 7f840b8e9755350f26e418845e4850d2;
-- live prosrc md5 afterwards e5695bebe31bf5f175dfeb536b3bdec3). Rehearsed on a real sent invoice in a rolled-back
-- transaction: after a simulated resubmission the old function left 0 of its 2 sent lines, the fixed one kept both.
-- =============================================================================================
-- PROPOSAL: a re-batched invoice never deletes its lines from a claim batch that was already sent
-- File:   proposals/2026-10-09-claim-sent-lines-kept.sql                Drafted: 2026-10-09
--
-- Why (found by the claims follow-up work, 2026-10-09): sync_invoice_to_batch, which the invoice-line trigger
-- runs on every change to an invoice line, first deletes ALL of the invoice's claim lines (batch_details) and
-- then rebuilds them in the practice's active batch. Its sent-batch guard only looks at the batch the invoice
-- points to now (invoices_enhanced.batch_id). An invoice whose earlier lines sit in a SENT batch but which now
-- points to an open batch (resubmitted after a rejection, or moved by claim review) would lose its lines from
-- the sent batch on its next edit: the record of what the fund received, which remittances, rejections and
-- the claim report are matched against.
-- Now the delete skips lines in any batch that was sent (or is no longer open), with the same test the guard
-- uses. Nothing else changes.
--
-- How: the live definition (as left by 2026-10-08-invoice-line-codes.sql) is read with pg_get_functiondef and
-- that one statement is replaced in it, so no other line can be mistyped; the block stops if the statement is
-- not found exactly once. CREATE OR REPLACE keeps the owner and the privileges (EXECUTE stays revoked from
-- PUBLIC, anon and authenticated).
-- Undo: run sync_invoice_to_batch as it is in proposals/2026-10-08-invoice-line-codes.sql.
-- =============================================================================================

BEGIN;

DO $migration$
DECLARE
  v_def text;
  v_old text := $old$    -- Wipe the slate clean: Delete all existing details for this invoice
    DELETE FROM public.batch_details WHERE invoice_id = p_invoice_id;$old$;
  v_new text := $new$    -- Wipe the slate clean: delete this invoice's claim lines, except lines in a batch that was already
    -- sent (or is no longer open): they stay exactly as the fund received them, also after a resubmission
    DELETE FROM public.batch_details d
     WHERE d.invoice_id = p_invoice_id
       AND NOT EXISTS (
           SELECT 1 FROM public.batch_headers b
            WHERE b.id = d.batch_header_id
              AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, 'active')) NOT IN ('active', 'open', 'draft', 'ready'))
       );$new$;
BEGIN
  SELECT pg_get_functiondef('public.sync_invoice_to_batch(uuid)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'sync_invoice_to_batch: the delete statement was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $migration$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.proname = 'sync_invoice_to_batch'
       AND position('AND NOT EXISTS (' in p.prosrc) > 0
       AND position('DELETE FROM public.batch_details WHERE invoice_id = p_invoice_id;' in p.prosrc) = 0
  ) THEN
    RAISE EXCEPTION 'Check failed: sync_invoice_to_batch still deletes lines of sent batches';
  END IF;
  IF has_function_privilege('authenticated', 'public.sync_invoice_to_batch(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.sync_invoice_to_batch(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: app users can run sync_invoice_to_batch';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

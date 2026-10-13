-- Applied 2026-10-07 as migration claims_flags_and_closed_months_2026_10_07 (tested: see the file header)
-- =============================================================================================
-- PROPOSAL: claims honour "Do not claim"; a late remittance is posted in an open month
-- File:   proposals/2026-10-07-claims-flags-and-closed-months.sql       Drafted: 2026-10-07
--
-- Requires: 2026-10-07-debtors-and-controls.sql (account_flags, dc_first_open_day, dc_month_label)
-- and 2026-10-07-remittances.sql (remittance_post_document). Runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind; change the last line to COMMIT to apply.
--
-- 1. sync_invoice_to_batch(invoice): the function the invoice-line trigger runs to put an invoice
--    in its fund's open batch. Unchanged, except: an invoice of a patient whose file is marked
--    "Do not claim" (account_flags.flag = 'no_claims', not cleared) is not batched; and search_path
--    is fixed to public (it is SECURITY DEFINER). An invoice batched before the flag was set is
--    caught by the batch review (src/utils/billing/claimValidation.ts), which refuses the line.
--    Direct calls are revoked: anyone (even signed out) could re-batch any practice's invoice with
--    it. Only the invoice-line trigger runs it, as its owner; the app never calls it.
-- 2. remittance_post_document(document, post): a payment dated in a closed month is posted on the
--    first day of the next open month (dc_first_open_day), as 2026-10-07-debtors-and-controls.sql
--    decided; the document keeps the fund's own payment date. Without this the period lock refuses
--    the receipt. The result adds posted_on (the date used) and closed_month (the closed month's
--    name when the date moved, else null), which Finance > Remittances shows.
--
-- Undo: run remittance_post_document as it is in 2026-10-07-remittances.sql, and
-- sync_invoice_to_batch without the "Do not claim" check.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Batching skips patients marked "Do not claim"
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_invoice_to_batch(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_invoice RECORD;
    v_patient RECORD;
    v_medical_aid RECORD;
    v_batch RECORD;
    v_service RECORD;
    v_practitioner_hpcsa TEXT;
    v_transaction_number INTEGER;
    v_member_initials TEXT;
    v_formatted_diagnosis TEXT;
    v_medical_aid_ref TEXT;
    v_batch_id UUID; -- <<<< FIX 1: Add a variable to temporarily hold the batch ID
BEGIN
    -- Get the master invoice record
    SELECT * INTO v_invoice FROM public.invoices_enhanced WHERE id = p_invoice_id;

    -- Wipe the slate clean: Delete all existing details for this invoice
    DELETE FROM public.batch_details WHERE invoice_id = p_invoice_id;

    -- Re-evaluate the invoice for batch eligibility
    IF v_invoice.medical_aid_total IS NULL OR v_invoice.medical_aid_total <= 0 OR NOT EXISTS (SELECT 1 FROM public.invoice_services WHERE invoice_id = p_invoice_id) THEN
        UPDATE public.invoices_enhanced SET batch_id = NULL WHERE id = p_invoice_id;
        RETURN;
    END IF;

    -- A patient whose file is marked "Do not claim" is never claimed (account_flags, 2026-10-07-debtors-and-controls.sql)
    IF EXISTS (
        SELECT 1 FROM public.account_flags f
         WHERE f.practice_id = v_invoice.practice_id AND f.patient_id = v_invoice.patient_id
           AND f.flag = 'no_claims' AND f.cleared_at IS NULL
    ) THEN
        UPDATE public.invoices_enhanced SET batch_id = NULL WHERE id = p_invoice_id;
        RETURN;
    END IF;

    -- It's eligible, so let's get the required data
    SELECT * INTO v_patient FROM public.patients WHERE id = v_invoice.patient_id;
    SELECT * INTO v_medical_aid FROM public.medical_aid_details WHERE patient_id = v_invoice.patient_id LIMIT 1;
    SELECT u.hpcsa_number INTO v_practitioner_hpcsa FROM public.users u WHERE u.id = v_invoice.practitioner_id;

    -- Find the medical aid reference
    SELECT map.medical_aid_reference INTO v_medical_aid_ref
    FROM public.medical_aid_details mad
    JOIN public.medical_aid_providers map ON mad.medical_aid_provider_id = map.id
    WHERE mad.patient_id = v_invoice.patient_id LIMIT 1;

    IF v_medical_aid_ref IS NULL THEN RETURN; END IF;

    --- *** CORRECTED LOGIC STARTS HERE *** ---
    -- FIX 2: First, get the ID of the active batch and store it.
    v_batch_id := get_or_create_active_batch_id(v_invoice.practice_id, v_medical_aid_ref);

    -- FIX 3: Now, use that ID to fetch the entire batch header record.
    SELECT * INTO v_batch FROM public.batch_headers WHERE id = v_batch_id;
    --- *** CORRECTED LOGIC ENDS HERE *** ---


    -- Rebuild the batch details from scratch
    SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_transaction_number FROM public.batch_details WHERE batch_header_id = v_batch.id;

    FOR v_service IN SELECT * FROM public.invoice_services WHERE invoice_id = p_invoice_id
    LOOP
        -- Calculate initials & Format diagnosis (logic unchanged)
        SELECT string_agg(UPPER(SUBSTRING(part FROM 1 FOR 1)), '') INTO v_member_initials FROM unnest(string_to_array(TRIM(v_patient.first_name), ' ')) AS part WHERE LENGTH(TRIM(part)) > 0;
        IF v_service.tooth_number IS NOT NULL AND TRIM(v_service.tooth_number) <> '' THEN
            v_formatted_diagnosis := 'TOOTH: ' || v_service.tooth_number || ' ' || v_service.description;
        ELSE
            v_formatted_diagnosis := v_service.description;
        END IF;
        v_formatted_diagnosis := SUBSTRING(UPPER(REPLACE(v_formatted_diagnosis, ',', '')) FROM 1 FOR 30);

        -- Insert the fresh, up-to-date record
        INSERT INTO public.batch_details (
            batch_header_id, invoice_id, transaction_number_in_batch, system_transaction_number,
            system_patient_reference_number, medical_aid_reference, medical_aid_membership_number,
            member_surname, member_initials, patient_name, patient_date_of_birth,
            bhf_tariff_code, service_amount, diagnosis, service_date,
            number_of_services, invoice_number, practice_number,
            treating_doctor_hpcsa_number, gender, patient_id_number, patient_id, visit_id
        ) VALUES (
            v_batch.id, p_invoice_id, v_transaction_number, v_service.system_transaction_number,
            v_patient.system_patient_reference_number::TEXT, v_batch.medical_aid_reference, REPLACE(COALESCE(v_medical_aid.membership_number, ''), ',', ''),
            REPLACE(UPPER(v_patient.last_name), ',', ''), REPLACE(v_member_initials, ',', ''),
            REPLACE(UPPER(v_patient.first_name), ',', ''), TO_CHAR(v_patient.date_of_birth, 'YYYYMMDD'),
            v_service.code, v_service.total_price, v_formatted_diagnosis,
            TO_CHAR(v_invoice.issue_date, 'YYYYMMDD'), v_service.quantity, REPLACE(v_invoice.invoice_number, ',', ''),
            v_batch.practice_number, REPLACE(COALESCE(v_practitioner_hpcsa, 'NOT_SET'), ',', ''),
            UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)), REPLACE(v_patient.id_number, ',', ''),
            v_patient.id, v_invoice.visit_id
        );
        v_transaction_number := v_transaction_number + 1;
    END LOOP;

    -- Finally, ensure the invoice is linked to the batch
    UPDATE public.invoices_enhanced SET batch_id = v_batch.id WHERE id = p_invoice_id;
END;
$$;

-- Only the invoice-line trigger runs it (as its owner); no app user may re-batch an invoice directly
REVOKE EXECUTE ON FUNCTION public.sync_invoice_to_batch(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. A remittance for a closed month is posted on the first open day
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remittance_post_document(p_document_id uuid, p_post jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc        remittance_documents%ROWTYPE;
  v_other      remittance_documents%ROWTYPE;
  v_receipt    jsonb := NULLIF(p_post->'receipt', 'null'::jsonb);
  v_result     jsonb := '{}'::jsonb;
  v_adjs       jsonb := '[]'::jsonb;
  v_item       jsonb;
  v_adj        jsonb;
  v_rejection  claim_rejections%ROWTYPE;
  v_line       remittance_lines%ROWTYPE;
  v_created    integer := 0;
  v_resolved   integer := 0;
  v_ids        uuid[];
  -- The day the money counts on: the fund's date, or the first open day when its month is closed
  v_base       date;
  v_post_on    date;
BEGIN
  SELECT * INTO v_doc FROM remittance_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Remittance document not found';
  END IF;
  PERFORM ar_assert_member(v_doc.practice_id);
  IF v_doc.status = 'posted' THEN
    RETURN jsonb_build_object('document_id', v_doc.id, 'receipt_id', v_doc.receipt_id, 'already_posted', true);
  END IF;
  IF NOT v_doc.reconciled THEN
    RAISE EXCEPTION 'This document does not add up (its lines do not match its totals), so nothing can be posted from it';
  END IF;

  -- What happened to each line
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'lines', '[]'::jsonb)) LOOP
    v_ids := ARRAY(SELECT (value)::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'claim_line_ids', '[]'::jsonb)) AS value);
    UPDATE remittance_lines
       SET posting_status = COALESCE(NULLIF(v_item->>'posting_status', ''), 'no_action'),
           allocated = COALESCE(remittance_amount(v_item->'allocated'), 0),
           shortfall = COALESCE(remittance_amount(v_item->'shortfall'), 0),
           written_off = COALESCE(remittance_amount(v_item->'written_off'), 0),
           match_status = COALESCE(NULLIF(v_item->>'match_status', ''), match_status),
           match_rule = COALESCE(NULLIF(btrim(v_item->>'match_rule'), ''), match_rule),
           claim_line_ids = CASE WHEN v_item ? 'claim_line_ids' THEN v_ids ELSE claim_line_ids END,
           claim_line_id = CASE WHEN v_item ? 'claim_line_ids' THEN v_ids[1] ELSE claim_line_id END,
           invoice_id = CASE WHEN v_item ? 'invoice_id' THEN NULLIF(v_item->>'invoice_id', '')::uuid ELSE invoice_id END,
           patient_id = CASE WHEN v_item ? 'patient_id' THEN NULLIF(v_item->>'patient_id', '')::uuid ELSE patient_id END,
           posted_at = now()
     WHERE id = NULLIF(v_item->>'line_id', '')::uuid AND document_id = v_doc.id;
  END LOOP;

  -- Lines matched to invoices of this practice only
  IF EXISTS (
    SELECT 1 FROM remittance_lines l JOIN invoices_enhanced i ON i.id = l.invoice_id
    WHERE l.document_id = v_doc.id AND i.practice_id IS DISTINCT FROM v_doc.practice_id
  ) THEN
    RAISE EXCEPTION 'A line is matched to an invoice of another practice';
  END IF;

  -- Money may only move on invoices this document's lines are matched to
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT value->>'invoice_id' AS invoice_id FROM jsonb_array_elements(COALESCE(v_receipt->'allocations', '[]'::jsonb))
      UNION ALL SELECT value->>'invoice_id' FROM jsonb_array_elements(COALESCE(v_receipt->'shortfalls', '[]'::jsonb))
      UNION ALL SELECT value->>'invoice_id' FROM jsonb_array_elements(COALESCE(v_receipt->'write_offs', '[]'::jsonb))
      UNION ALL SELECT value->>'invoice_id' FROM jsonb_array_elements(COALESCE(p_post->'adjustments', '[]'::jsonb))
    ) moved
    WHERE NOT EXISTS (
      SELECT 1 FROM remittance_lines l WHERE l.document_id = v_doc.id AND l.invoice_id = NULLIF(moved.invoice_id, '')::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Money can only be posted to invoices this remittance''s lines are matched to';
  END IF;
  IF v_doc.kind NOT IN ('payment', 'month_summary') AND (v_receipt IS NOT NULL OR jsonb_array_length(COALESCE(p_post->'adjustments', '[]'::jsonb)) > 0) THEN
    RAISE EXCEPTION 'A claim response moves no money: record its outcomes only';
  END IF;

  -- Undo provisional shortfalls and write-offs first: the fund has now paid those lines
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'reversals', '[]'::jsonb)) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM claim_rejections r
      WHERE r.practice_id = v_doc.practice_id AND r.adjustment_id = NULLIF(v_item->>'adjustment_id', '')::uuid
        AND EXISTS (SELECT 1 FROM remittance_lines l WHERE l.document_id = v_doc.id AND l.invoice_id = r.invoice_id)
    ) THEN
      RAISE EXCEPTION 'Only a shortfall or write-off made from the rejection queue, on an invoice this remittance pays, can be undone here';
    END IF;
    PERFORM ar_reverse_adjustment(NULLIF(v_item->>'adjustment_id', '')::uuid, COALESCE(NULLIF(btrim(v_item->>'reason'), ''), 'The medical aid paid this line after all'));
  END LOOP;

  IF v_receipt IS NOT NULL THEN
    IF v_doc.kind NOT IN ('payment', 'month_summary') THEN
      RAISE EXCEPTION 'Only a payment can be posted as a receipt';
    END IF;
    IF v_doc.status = 'duplicate' THEN
      RAISE EXCEPTION 'This payment was already posted from another file';
    END IF;
    IF COALESCE(v_doc.total_paid, 0) <= 0 THEN
      RAISE EXCEPTION 'This document paid nothing to the practice';
    END IF;
    IF v_doc.payment_date IS NULL OR v_doc.payment_date > ar_today() THEN
      RAISE EXCEPTION 'The fund pays this on %; post it on or after that day', COALESCE(v_doc.payment_date::text, 'an unknown date');
    END IF;
    IF v_doc.payment_key IS NOT NULL THEN
      SELECT * INTO v_other FROM remittance_documents
       WHERE practice_id = v_doc.practice_id AND payment_key = v_doc.payment_key AND status = 'posted' AND receipt_id IS NOT NULL AND id <> v_doc.id
       LIMIT 1;
      IF FOUND THEN
        RAISE EXCEPTION 'This payment was already posted from %', v_other.file_name;
      END IF;
    END IF;
    -- Every allocation must point at a line of this document
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_receipt->'allocations', '[]'::jsonb)) LOOP
      IF v_item->>'portion' <> 'medical_aid' OR NOT EXISTS (
        SELECT 1 FROM remittance_lines l WHERE l.document_id = v_doc.id AND l.id = NULLIF(v_item->>'external_ref', '')::uuid
      ) THEN
        RAISE EXCEPTION 'An allocation does not belong to a line of this remittance';
      END IF;
    END LOOP;
    v_base := v_doc.payment_date;
    v_post_on := dc_first_open_day(v_doc.practice_id, v_base);
    v_result := ar_post_receipt(v_receipt || jsonb_build_object(
      'practice_id', v_doc.practice_id,
      'payer_type', 'medical_aid',
      'fund_name', COALESCE(NULLIF(btrim(v_receipt->>'fund_name'), ''), v_doc.fund_name, v_doc.fund_code, 'Medical aid'),
      'method', CASE WHEN v_receipt->>'method' IN ('eft', 'medical_aid') THEN v_receipt->>'method' ELSE 'medical_aid' END,
      'amount', v_doc.total_paid,
      'received_on', v_post_on,
      'reference', COALESCE(v_doc.payment_reference, v_doc.statement_number),
      'source', 'remittance_import',
      'external_ref', COALESCE(v_doc.payment_key, 'sha256:' || v_doc.file_sha256 || ':' || v_doc.part_number)
    ));
    IF (v_result->>'duplicate')::boolean THEN
      RAISE EXCEPTION 'This payment was already posted (receipt %)', v_result->>'receipt_number';
    END IF;
    v_adjs := COALESCE(v_result->'adjustments', '[]'::jsonb);
  ELSE
    -- Nothing paid to the practice (e.g. the fund paid the member): adjustments on their own
    IF jsonb_array_length(COALESCE(p_post->'adjustments', '[]'::jsonb)) > 0 THEN
      v_base := LEAST(COALESCE(v_doc.payment_date, v_doc.document_date, ar_today()), ar_today());
      v_post_on := dc_first_open_day(v_doc.practice_id, v_base);
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'adjustments', '[]'::jsonb)) LOOP
      IF v_item->>'kind' NOT IN ('shortfall_transfer', 'write_off') THEN
        RAISE EXCEPTION 'Only shortfalls and write-offs are posted from a remittance';
      END IF;
      v_adj := ar_post_adjustment(v_item || jsonb_build_object('practice_id', v_doc.practice_id, 'effective_on', v_post_on));
      v_adjs := v_adjs || v_adj;
    END LOOP;
  END IF;

  -- New items in the rejection queue (a line already queued is not queued twice)
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'rejections', '[]'::jsonb)) LOOP
    SELECT * INTO v_line FROM remittance_lines WHERE id = NULLIF(v_item->>'line_id', '')::uuid AND document_id = v_doc.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A rejection does not belong to a line of this remittance';
    END IF;
    INSERT INTO claim_rejections (
      practice_id, remittance_line_id, document_id, claim_line_id, invoice_id, patient_id, fund_code, service_date,
      tariff_code, claimed, paid, at_stake, reason_codes, fund_reason, category, plain_reason, suggested_action, fix_hint,
      needs_approval, follow_up_on, resubmit_by, previous_id, status, created_by, updated_by
    ) VALUES (
      v_doc.practice_id, v_line.id, v_doc.id, NULLIF(v_item->>'claim_line_id', '')::uuid, NULLIF(v_item->>'invoice_id', '')::uuid,
      NULLIF(v_item->>'patient_id', '')::uuid, v_doc.fund_code, v_line.service_date, v_line.tariff_code,
      COALESCE(v_line.claimed, 0), v_line.paid, GREATEST(COALESCE(remittance_amount(v_item->'at_stake'), 0), 0),
      remittance_text_array(v_item->'reason_codes'), NULLIF(btrim(v_item->>'fund_reason'), ''), v_item->>'category',
      COALESCE(NULLIF(btrim(v_item->>'plain_reason'), ''), 'The fund did not pay this line.'), v_item->>'suggested_action',
      NULLIF(btrim(v_item->>'fix_hint'), ''), COALESCE((v_item->>'needs_approval')::boolean, false),
      NULLIF(v_item->>'follow_up_on', '')::date, NULLIF(v_item->>'resubmit_by', '')::date,
      (SELECT r.id FROM claim_rejections r WHERE r.id = NULLIF(v_item->>'supersedes_id', '')::uuid AND r.practice_id = v_doc.practice_id),
      CASE WHEN v_item->>'suggested_action' = 'wait' THEN 'waiting' ELSE 'open' END,
      auth.uid(), auth.uid()
    )
    ON CONFLICT (remittance_line_id) DO NOTHING
    RETURNING * INTO v_rejection;
    IF v_rejection.id IS NOT NULL THEN
      v_created := v_created + 1;
      PERFORM claim_rejection_log(v_rejection, 'created', v_rejection.plain_reason, jsonb_build_object('document_id', v_doc.id, 'codes', v_rejection.reason_codes));
      -- The fund rejected the same claim line again: the earlier item is closed, this one carries on
      IF v_rejection.previous_id IS NOT NULL THEN
        UPDATE claim_rejections SET status = 'closed', resolved_at = now(), resolved_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
         WHERE id = v_rejection.previous_id AND status IN ('open', 'waiting', 'resubmitted')
        RETURNING * INTO v_rejection;
        IF FOUND THEN
          PERFORM claim_rejection_log(v_rejection, 'closed', 'Rejected again on ' || v_doc.file_name, jsonb_build_object('document_id', v_doc.id));
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Rejections this payment settles
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_post->'resolves', '[]'::jsonb)) LOOP
    UPDATE claim_rejections
       SET status = 'resolved_by_payment', resolved_by_line_id = NULLIF(v_item->>'line_id', '')::uuid,
           resolved_at = now(), resolved_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
     WHERE id = NULLIF(v_item->>'rejection_id', '')::uuid AND practice_id = v_doc.practice_id
       AND status IN ('open', 'waiting', 'resubmitted', 'billed_patient', 'written_off')
       AND EXISTS (SELECT 1 FROM remittance_lines l WHERE l.id = NULLIF(v_item->>'line_id', '')::uuid AND l.document_id = v_doc.id)
    RETURNING * INTO v_rejection;
    IF FOUND THEN
      v_resolved := v_resolved + 1;
      PERFORM claim_rejection_log(v_rejection, 'resolved_by_payment', 'Paid on ' || v_doc.file_name, jsonb_build_object('document_id', v_doc.id));
    END IF;
  END LOOP;

  UPDATE remittance_documents
     SET status = 'posted', receipt_id = NULLIF(v_result->>'receipt_id', '')::uuid, posted_by = auth.uid(), posted_at = now()
   WHERE id = v_doc.id;

  RETURN jsonb_build_object(
    'document_id', v_doc.id, 'already_posted', false,
    'receipt_id', v_result->'receipt_id', 'receipt_number', v_result->'receipt_number',
    'allocated', v_result->'allocated', 'unallocated', v_result->'unallocated',
    'adjustments', v_adjs, 'rejections_created', v_created, 'resolved', v_resolved,
    'posted_on', v_post_on, 'closed_month', CASE WHEN v_post_on IS DISTINCT FROM v_base THEN dc_month_label(v_base) END
  );
END $$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

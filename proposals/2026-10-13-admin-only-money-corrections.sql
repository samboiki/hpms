-- =============================================================================================
-- PROPOSAL, NOT APPLIED: refunds, payment reversals and credit notes for administrators only; no new discounts;
--                        invoices never deleted (parity Q2, H15, Q5, D11, D19; owner decisions of 13 Oct 2026)
-- File:   proposals/2026-10-13-admin-only-money-corrections.sql      Drafted: 2026-10-13 (agent w11-finance)
-- Code:   src/services/ledger/moneyRights.ts (the same rules, tested), src/components/finance/receipts/arService.ts
--         and creditNoteService.ts (refuse before calling the database), InvoiceLedgerPanel.tsx and
--         ReceiptDetailModal.tsx (the actions are hidden from everyone but administrators), CleanInvoiceTable.tsx
--         (no delete button any more).
--
-- Why
--   The owner decided on 13 Oct 2026:
--     1. refunds, payment reversals and credit notes: administrators only (users.role = 'admin');
--     2. invoices are never deleted: they are cancelled, or credited in full;
--     3. no discounts on invoices.
--   The screens and the services already follow this. Today the database still lets any staff member of the practice
--   refund, reverse a receipt or an allocation, post or reverse a credit note (ar_assert_member only), give a discount
--   (administrators and practitioners) and delete an unpaid invoice (the invoices_enhanced DELETE grant; the
--   ar_invoice_delete_guard trigger only stops an invoice with payment history). This file makes the database say the
--   same as the screens, so an old browser tab or a hand-made call cannot get round it.
--
-- What it does (live definitions edited in place: each change is found exactly once or nothing changes)
--   1. public.ar_is_admin(practice): true for the caller when they are an administrator of that practice.
--   2. ar_post_adjustment: kinds 'credit_note' and 'refund' need an administrator (42501, plain message); 'discount'
--      is refused for everyone. credit_note_post_lines (credit notes per line) posts through ar_post_adjustment, so
--      it is covered too.
--   3. ar_reverse_receipt and ar_reverse_allocation: administrators only.
--   4. ar_reverse_adjustment: reversing a credit note or a refund needs an administrator. Other kinds keep their
--      rules, because the database itself reverses write-offs (a fund paid after all: remittances, claims follow-up)
--      and interest journals (an interest run taken back) on behalf of whoever posts that run.
--   5. invoices_enhanced: DELETE is revoked from PUBLIC, anon and authenticated (a grant, not a policy: the
--      practice-isolation policies on this protected table are not touched). SECURITY DEFINER functions and the
--      service role are not affected, and a patient deleted by an administrator still takes their invoices with them
--      through the foreign keys only where the foreign keys say so (unchanged).
--   Discounts already given stay as they are (balances, statements, the discount listing); an administrator can still
--   take one back (section 4 does not change discount reversals beyond the existing administrator-or-practitioner rule).
--
-- How to apply: rehearse the part between BEGIN; and ROLLBACK; with simulated logins (a receptionist and a
--   practitioner refused 42501 for a refund, a credit note, a receipt reversal and an allocation reversal; an
--   administrator allowed; a discount refused for all three; a receptionist's DELETE on invoices_enhanced refused
--   42501 "permission denied"; another practice and anon refused), then apply that part as one migration
--   (admin_only_money_corrections_2026_10_13). It needs proposals/2026-10-13-discounts-and-statements.sql applied
--   first (the anchors below are its versions of ar_post_adjustment and ar_reverse_adjustment).
-- Undo: reverse each edit (the old statements are quoted below), DROP FUNCTION public.ar_is_admin(uuid), and
--   GRANT DELETE ON public.invoices_enhanced TO authenticated.
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.ar_assert_member(uuid)') IS NULL
     OR to_regprocedure('public.ar_is_approver(uuid)') IS NULL
     OR to_regprocedure('public.ar_post_adjustment(jsonb)') IS NULL
     OR to_regprocedure('public.ar_reverse_receipt(uuid,text)') IS NULL
     OR to_regprocedure('public.ar_reverse_allocation(uuid,text)') IS NULL
     OR to_regprocedure('public.ar_reverse_adjustment(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-receipts-and-allocations.sql first';
  END IF;
  IF position('take back a discount' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_reverse_adjustment(uuid,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-13-discounts-and-statements.sql first';
  END IF;
  -- The policies of invoices_enhanced, to check at the end that none changed
  PERFORM set_config('onehealth.invoice_policies_before', (
    SELECT md5(COALESCE(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname), ''))
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices_enhanced'
  ), true);
END $$;

-- A helper for this file only: edits a function's live definition, each change found exactly once or nothing changes.
-- Every anchor is one line, so the file works with either line ending.
CREATE FUNCTION pg_temp.onehealth_edit_function(p_function regprocedure, p_edits text[]) RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  v_def text := pg_get_functiondef(p_function);
  v_i integer;
BEGIN
  FOR v_i IN 1 .. array_length(p_edits, 1) LOOP
    IF (length(v_def) - length(replace(v_def, p_edits[v_i][1], ''))) / length(p_edits[v_i][1]) <> 1 THEN
      RAISE EXCEPTION '%: change % was not found exactly once; nothing changed', p_function, v_i;
    END IF;
    v_def := replace(v_def, p_edits[v_i][1], p_edits[v_i][2]);
  END LOOP;
  EXECUTE v_def;
END $fn$;

-- ---------------------------------------------------------------------------------------------
-- 1. Who is an administrator of the practice
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ar_is_admin(p_practice_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.practice_id = p_practice_id AND users.role = 'admin'
  )
$$;
COMMENT ON FUNCTION public.ar_is_admin(uuid) IS
  'True for the practice''s administrators: they refund, reverse payments and give credit notes (owner, 13 Oct 2026).';
REVOKE ALL ON FUNCTION public.ar_is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ar_is_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Refunds and credit notes: administrators only; no new discounts
-- ---------------------------------------------------------------------------------------------
SELECT pg_temp.onehealth_edit_function('public.ar_post_adjustment(jsonb)'::regprocedure, ARRAY[
  ARRAY[$o$  v_adj := ar_insert_adjustment(v_practice, v_kind, p_payload, ar_today());$o$, $n$  -- Owner, 13 Oct 2026: refunds and credit notes are for administrators only, and no discounts are given
  -- (proposals/2026-10-13-admin-only-money-corrections.sql)
  IF v_kind IN ('credit_note', 'refund') AND NOT ar_is_admin(v_practice) THEN
    RAISE EXCEPTION 'Only a practice administrator can %. Ask an administrator to do it.',
      CASE v_kind WHEN 'refund' THEN 'refund money' ELSE 'give a credit note' END USING ERRCODE = '42501';
  END IF;
  IF v_kind = 'discount' THEN
    RAISE EXCEPTION 'The practice does not give discounts on invoices. If the patient was charged too much, an administrator can give a credit note.' USING ERRCODE = '42501';
  END IF;
  v_adj := ar_insert_adjustment(v_practice, v_kind, p_payload, ar_today());$n$]
]);

-- ---------------------------------------------------------------------------------------------
-- 3. Reversing a receipt or taking a payment off an invoice: administrators only
-- ---------------------------------------------------------------------------------------------
SELECT pg_temp.onehealth_edit_function('public.ar_reverse_receipt(uuid,text)'::regprocedure, ARRAY[
  ARRAY[$o$  PERFORM ar_assert_member(v_receipt.practice_id);$o$, $n$  PERFORM ar_assert_member(v_receipt.practice_id);
  IF NOT ar_is_admin(v_receipt.practice_id) THEN
    RAISE EXCEPTION 'Only a practice administrator can reverse a receipt. Ask an administrator to do it.' USING ERRCODE = '42501';
  END IF;$n$]
]);

SELECT pg_temp.onehealth_edit_function('public.ar_reverse_allocation(uuid,text)'::regprocedure, ARRAY[
  ARRAY[$o$  PERFORM ar_assert_member(v_practice);$o$, $n$  PERFORM ar_assert_member(v_practice);
  IF NOT ar_is_admin(v_practice) THEN
    RAISE EXCEPTION 'Only a practice administrator can take a payment off an invoice. Ask an administrator to do it.' USING ERRCODE = '42501';
  END IF;$n$]
]);

-- ---------------------------------------------------------------------------------------------
-- 4. Reversing a credit note or a refund: administrators only (write-offs and journals keep their rules: the
--    database reverses those itself for remittances, claims follow-up and interest runs)
-- ---------------------------------------------------------------------------------------------
SELECT pg_temp.onehealth_edit_function('public.ar_reverse_adjustment(uuid,text)'::regprocedure, ARRAY[
  ARRAY[$o$  PERFORM ar_assert_member(v_adj.practice_id);$o$, $n$  PERFORM ar_assert_member(v_adj.practice_id);
  IF v_adj.kind IN ('credit_note', 'refund') AND NOT ar_is_admin(v_adj.practice_id) THEN
    RAISE EXCEPTION 'Only a practice administrator can reverse a %. Ask an administrator to do it.',
      CASE v_adj.kind WHEN 'refund' THEN 'refund' ELSE 'credit note' END USING ERRCODE = '42501';
  END IF;$n$]
]);

DROP FUNCTION pg_temp.onehealth_edit_function(regprocedure, text[]);

-- ---------------------------------------------------------------------------------------------
-- 5. Invoices are never deleted from the app (cancel, or credit in full)
-- ---------------------------------------------------------------------------------------------
REVOKE DELETE ON public.invoices_enhanced FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF position('ar_is_admin(v_practice)' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_post_adjustment(jsonb)'::regprocedure)) = 0
     OR position('ar_is_admin(v_receipt.practice_id)' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_reverse_receipt(uuid,text)'::regprocedure)) = 0
     OR position('ar_is_admin(v_practice)' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_reverse_allocation(uuid,text)'::regprocedure)) = 0
     OR position('ar_is_admin(v_adj.practice_id)' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_reverse_adjustment(uuid,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: an administrator check is missing';
  END IF;
  IF has_table_privilege('authenticated', 'public.invoices_enhanced', 'DELETE')
     OR has_table_privilege('anon', 'public.invoices_enhanced', 'DELETE') THEN
    RAISE EXCEPTION 'Check failed: invoices can still be deleted';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.invoices_enhanced', 'UPDATE') THEN
    RAISE EXCEPTION 'Check failed: invoices can no longer be cancelled';
  END IF;
  IF (SELECT md5(COALESCE(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname), ''))
        FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices_enhanced') <> current_setting('onehealth.invoice_policies_before') THEN
    RAISE EXCEPTION 'Check failed: the policies of invoices_enhanced changed';
  END IF;
END $$;

ROLLBACK;

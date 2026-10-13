-- Applied 2026-10-13 as migration discounts_and_statements_2026_10_13 (version 20261012222122; stored statement md5 ce0279baf6a87ffe407005556024737e = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 afterwards: ar_adjustments_before_insert 5a15d8f0213fcf3a7955b03957fb62d9, ar_insert_adjustment
-- f17ed7f1a03102545596cde75615ee95, ar_post_adjustment 17bcaf6a1c5a373f8d3c6c2f9d87a847, ar_reverse_adjustment
-- c361b930d17d058f9d7dadd3be0e5d4c, ar_next_document_number c63c2d9f53706c49deed475c420a7996, dc_movements
-- 7660363a3ccc6dd24fbcdc86eab6e00b, dc_close_period e41fbf54d43ca44dd9c9cd71eaf267d0, dc_daybook_from_audit
-- 399e38ebb2d9a17d4212204958a432b6, dc_lock_adjustments efca19ab0ccf2c88256e93c25e6f8774, dc_flag_rule
-- 83588174ba0c73c40adf2e815bc276a8, dc_set_account_flag cb926a72f7c63d46be3808d1c257facb.
-- Rehearsed with simulated logins (rolled back), twice, the second with exactly the applied part: on invented invoices
-- (N$ 1,000.00 with the fund 700.00 and the patient 300.00; a private N$ 500.00) reception could not give a discount
-- (42501); a practitioner gave 10 % (DS-, N$ 30.00: the fund still owed 700.00, the patient 270.00; recorded with the
-- giver, the percentage and the reason); a percentage that did not match the amount, the fund's portion, more than the
-- patient owed and a reason outside the list were refused; 100 % of the private invoice settled it (paid), reception
-- could not take it back (42501) and an administrator could (owed 500.00 again, pending); another practice and anon
-- were refused (42501); the daybook held the discount (-30.00) and the reversal (+500.00); control totals showed
-- discounts on their own line (-530.00); a patient-app login and another practice read nothing; reception set,
-- changed (the old message kept as history) and cleared a statement message, a two-letter one was refused (23514),
-- another practice and anon could not (42501); a correction (JN-) still worked; every existing invoice balance and the
-- policies of the eight tables read were unchanged.
-- =============================================================================================
-- PROPOSAL: discounts on invoices (patient portion only, as their own ledger entries), and a statement message per
--           account (parity D19, R3, I8)
-- File:   proposals/2026-10-13-discounts-and-statements.sql          Drafted: 2026-10-13
-- Code:   src/services/ledger/discounts.ts (the rules below, tested), arModel.ts, arBalances.ts, arStatement.ts,
--         ledgerMovements.ts, daybook.ts, accountFlags.ts; src/components/finance/receipts/DiscountDialog.tsx
--         (Finance > an invoice > Payments and adjustments > Discount); the invoice PDF and statements; Finance >
--         Reports > Discounts given (practiceReports/discountListing.ts).
--
-- Why
--   D19: a practice gives discounts (a pensioner, a colleague, paid in full on the day) and Eminance records each one as
--   a discount transaction against the invoice, listed per practitioner and shown on the account. OneHealth only had a
--   discount on a private patient's line, typed while billing, with no reason, no percentage and no record of who gave
--   it. R3 lists the discounts of a period per practitioner and reason, which needs them recorded with a reason.
--   I8: Eminance prints a message per account on every statement ("arrangement: N$ 500 a month"); OneHealth only had a
--   message per statement run.
--
-- The discount decision (for the owner)
--   A discount is its own entry on the invoice (invoice_adjustments kind 'discount', numbered DS-000001), like a credit
--   note or a write-off: the invoice and its lines are never changed, so the claim lines already sent to a fund keep
--   their amounts and the books never disagree with the claim. It comes off the PATIENT'S portion only (what the patient
--   pays: a private invoice, a co-payment or levy, a shortfall moved to the patient): the medical aid is claimed at the
--   agreed price (claim field 16 "discount" stays 0.00, as Eminance sends it). To charge a fund less, the claim is
--   corrected (a credit note on the line queues a reversal for the fund). A discount is at most what the patient still
--   owes on the invoice; money already paid is given back with a credit note and a refund. A percentage is of what the
--   patient was charged on the invoice (their portion plus any shortfall moved to them) and must match the amount to
--   the cent. Only a practice administrator or practitioner (roles admin and doctor, as for write-offs) gives or takes
--   back a discount; the owner may want reception to give them too (one word in ar_insert_adjustment and the trigger).
--
-- What it does
--   1. invoice_adjustments: kind 'discount' (patient portion, a reason from the list, given by an administrator or
--      practitioner) and the optional percentage it was given as (percent, 0 < p <= 100, discounts only).
--   2. daybook_entries accept discounts (entry type and adjustment kind).
--   3. Discounts are numbered DS-000001 per practice (ar_document_counters series 'discount', ar_next_document_number).
--   4. Giving and taking back (live definitions edited, each changed statement found exactly once or nothing changes):
--      ar_adjustments_before_insert (at most what the patient owes, the giver's role, the percentage matches),
--      ar_insert_adjustment (role, approved_by = the giver, the percentage), ar_post_adjustment (accepts 'discount'),
--      ar_reverse_adjustment (only an administrator or practitioner takes one back).
--   5. ar_invoice_balances subtracts standing discounts from what is owed and shows them (medical_aid_discounted,
--      patient_discounted, appended); ar_invoice_portion_balances shows them per portion (discounted, appended). Both stay
--      security_invoker views with their grants.
--   6. Control totals and the month end count discounts on their own line ('discounts' in dc_movements and
--      dc_close_period's screen check), the daybook records a discount's effect, and a closed month refuses a discount
--      dated in it (dc_lock_adjustments, which now names it).
--   7. account_flags: 'statement_message' (an account flag: 3 to 280 characters, set on whoever pays, any staff member,
--      history kept like every flag): dc_flag_rule and dc_set_account_flag accept it.
--   8. The patient app's logins get nothing: no new table; invoice_adjustments and account_flags keep their policies,
--      the RESTRICTIVE portal_staff_only included.
--   9. Checks, including that every existing invoice balance and the policies of the tables read here did not change.
--   The practice message on invoices, quotes and statements and the "leave settled items off statements" default are
--   practice_settings rows ('document_settings'); their existing policies already let only administrators change them.
--
-- How to apply: rehearse (scripts/db/rehearsal.ts, or the part between BEGIN; and ROLLBACK; followed by tests that end
-- in RAISE EXCEPTION), then apply that part as one migration. Before it, the app offers no discount (the database
-- refuses the kind) and the statement message flag is refused with a plain message.
-- Undo (only while no discount or statement message was saved; both are kept for good once saved):
--   reverse each edit of sections 3, 4, 6 and 7 (the old statements are quoted in the edits below), recreate the two
--   views from their definitions in proposals/2026-10-07-receipts-and-allocations.sql, then
--   ALTER TABLE public.invoice_adjustments DROP CONSTRAINT invoice_adjustments_percent,
--     DROP CONSTRAINT invoice_adjustments_discount_rules, DROP COLUMN percent; and put back the old kind, daybook,
--   number-series and account_flags checks (the lists below without 'discount' and 'statement_message').
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_expected text[][] := ARRAY[
    ARRAY['public.ar_next_document_number(uuid,text)', 'fb220f739cdec94b3436c7fea3854209'],
    ARRAY['public.ar_adjustments_before_insert()', '19d88cac1aae22d98f568e7eeaea8e5b'],
    ARRAY['public.ar_insert_adjustment(uuid,text,jsonb,date)', 'ee7896a3ce319c16cdc5493a723ac413'],
    ARRAY['public.ar_post_adjustment(jsonb)', '6a6bf34cdd9c737ef82c8266a3ea445b'],
    ARRAY['public.ar_reverse_adjustment(uuid,text)', '748a12f0ea1e876a3bdc5136e9432bbf'],
    ARRAY['public.dc_lock_adjustments()', 'dc8fbc515c73cb1a2b0c31021f63ada7'],
    ARRAY['public.dc_movements(uuid)', 'c4094b30c02c786cc3f99b23d992a254'],
    ARRAY['public.dc_daybook_from_audit()', '293ad1cff4a11ef5427728d054d8fa78'],
    ARRAY['public.dc_close_period(uuid,date,jsonb)', '4852ab7ce29314474a5639afa99a7ea8'],
    ARRAY['public.dc_flag_rule(text)', 'a800489ecc468bfc913e1785a62b3ea8'],
    ARRAY['public.dc_set_account_flag(uuid,uuid,text,jsonb)', 'b3cab4962b22d4af6a5b2ca39ab4a9cb']
  ];
  v_i integer;
BEGIN
  FOR v_i IN 1 .. array_length(v_expected, 1) LOOP
    IF to_regprocedure(v_expected[v_i][1]) IS NULL
       OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(v_expected[v_i][1])) <> v_expected[v_i][2] THEN
      RAISE EXCEPTION 'Stopped: % is not the version this file was written against; merge by hand', v_expected[v_i][1];
    END IF;
  END LOOP;
  IF md5(pg_get_viewdef('public.ar_invoice_balances'::regclass)) <> '9506a5eab2b9ead87ab9dac5abda6217'
     OR md5(pg_get_viewdef('public.ar_invoice_portion_balances'::regclass)) <> '8970ebf1153953e2b9dddf79b6af513f' THEN
    RAISE EXCEPTION 'Stopped: ar_invoice_balances or ar_invoice_portion_balances changed since this file was written; merge by hand';
  END IF;
  IF to_regprocedure('public.ar_is_approver(uuid)') IS NULL OR to_regprocedure('public.ar_format_nad(numeric)') IS NULL
     OR to_regclass('public.account_flags') IS NULL OR to_regclass('public.daybook_entries') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply receipts and allocations and debtors and controls first';
  END IF;
  -- The policies of the tables this file reads or extends, to check at the end that none changed
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_adjustments', 'invoices_enhanced', 'invoice_services', 'account_flags', 'daybook_entries', 'practice_settings', 'patients', 'users')
  ), true);
  -- Every invoice's balance before, to check at the end that nothing already owed changed
  PERFORM set_config('onehealth.balances_before', (
    SELECT md5(COALESCE(string_agg(invoice_id::text || '|' || medical_aid_outstanding::text || '|' || patient_outstanding::text || '|' || outstanding::text, ';' ORDER BY invoice_id), ''))
      FROM public.ar_invoice_balances
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
-- 1. Discounts on invoice_adjustments
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_adjustments DROP CONSTRAINT invoice_adjustments_kind_check;
ALTER TABLE public.invoice_adjustments ADD CONSTRAINT invoice_adjustments_kind_check
  CHECK (kind IN ('credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer', 'discount'));

-- The percentage a discount was given as (10 = 10 %); the amount is what counts, worked out from it to the cent
ALTER TABLE public.invoice_adjustments ADD COLUMN IF NOT EXISTS percent numeric(5,2);
COMMENT ON COLUMN public.invoice_adjustments.percent IS
  'Discounts given as a percentage: the percentage of what the patient was charged on the invoice (amount = that, rounded to the cent)';

-- A discount comes off the patient's portion, with a reason from the list (src/services/ledger/discounts.ts
-- DISCOUNT_REASONS), given by an administrator or practitioner (approved_by)
ALTER TABLE public.invoice_adjustments ADD CONSTRAINT invoice_adjustments_discount_rules CHECK (
  kind <> 'discount' OR (
    portion = 'patient' AND approved_by IS NOT NULL
    AND reason_code IN ('loyal', 'pensioner', 'staff', 'courtesy', 'paid_on_day', 'hardship', 'goodwill', 'other')
  )
);
ALTER TABLE public.invoice_adjustments ADD CONSTRAINT invoice_adjustments_percent CHECK (
  percent IS NULL OR (kind = 'discount' AND percent > 0 AND percent <= 100)
);

-- ---------------------------------------------------------------------------------------------
-- 2. The daybook accepts discounts
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.daybook_entries DROP CONSTRAINT daybook_entries_entry_type_check;
ALTER TABLE public.daybook_entries ADD CONSTRAINT daybook_entries_entry_type_check CHECK (entry_type IN (
  'invoice_raised', 'invoice_amended', 'invoice_cancelled', 'invoice_reinstated', 'invoice_deleted', 'receipt',
  'receipt_reversed', 'allocation', 'allocation_reversed', 'credit_note', 'write_off', 'journal', 'refund',
  'shortfall_transfer', 'adjustment_reversed', 'discount'));
ALTER TABLE public.daybook_entries DROP CONSTRAINT daybook_entries_adjustment_kind_check;
ALTER TABLE public.daybook_entries ADD CONSTRAINT daybook_entries_adjustment_kind_check CHECK (adjustment_kind IN (
  'credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer', 'discount'));

-- ---------------------------------------------------------------------------------------------
-- 3. Discount numbers: DS-000001, per practice
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.ar_document_counters DROP CONSTRAINT ar_document_counters_series_check;
ALTER TABLE public.ar_document_counters ADD CONSTRAINT ar_document_counters_series_check CHECK (series IN (
  'receipt', 'legacy_receipt', 'credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer', 'discount'));

SELECT pg_temp.onehealth_edit_function('public.ar_next_document_number(uuid,text)'::regprocedure, ARRAY[
  ARRAY[$o$    WHEN 'shortfall_transfer' THEN 'ST'$o$, $n$    WHEN 'shortfall_transfer' THEN 'ST'
    WHEN 'discount' THEN 'DS'$n$]
]);

-- ---------------------------------------------------------------------------------------------
-- 4. Giving and taking back a discount
-- ---------------------------------------------------------------------------------------------

SELECT pg_temp.onehealth_edit_function('public.ar_adjustments_before_insert()'::regprocedure, ARRAY[
  ARRAY[$o$  v_unallocated numeric(14,2);$o$, $n$  v_unallocated numeric(14,2);
  v_base        numeric(14,2);$n$],
  -- A discount, like a credit note or a write-off, is never more than the portion still owes
  ARRAY[$o$    IF NEW.kind IN ('credit_note', 'write_off') OR (NEW.kind = 'journal' AND NEW.amount < 0) THEN$o$,
        $n$    IF NEW.kind IN ('credit_note', 'write_off', 'discount') OR (NEW.kind = 'journal' AND NEW.amount < 0) THEN$n$],
  ARRAY[$o$CASE NEW.kind WHEN 'credit_note' THEN 'A credit note' WHEN 'write_off' THEN 'A write-off' ELSE 'A correction' END,$o$,
        $n$CASE NEW.kind WHEN 'credit_note' THEN 'A credit note' WHEN 'write_off' THEN 'A write-off' WHEN 'discount' THEN 'A discount' ELSE 'A correction' END,$n$],
  ARRAY[$o$  NEW.adjustment_number := ar_next_document_number(NEW.practice_id, NEW.kind);$o$, $n$  -- A discount comes off what the patient pays, is given by an administrator or a practitioner, and a percentage is
  -- of what the patient was charged on the invoice, to the cent (2026-10-13-discounts-and-statements.sql)
  IF NEW.kind = 'discount' THEN
    IF NEW.portion IS DISTINCT FROM 'patient' THEN
      RAISE EXCEPTION 'A discount comes off what the patient pays: the medical aid is claimed as billed (correct the claim with a credit note to charge the fund less)';
    END IF;
    IF NEW.approved_by IS NULL
       OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.approved_by AND u.practice_id = NEW.practice_id AND u.role IN ('admin', 'doctor')) THEN
      RAISE EXCEPTION 'A discount must be given by a practice administrator or practitioner';
    END IF;
    IF NEW.percent IS NOT NULL THEN
      SELECT b.patient_billed + b.shortfall_transferred INTO v_base FROM ar_invoice_balances b WHERE b.invoice_id = NEW.invoice_id;
      IF COALESCE(v_base, 0) <= 0 THEN
        RAISE EXCEPTION 'The patient pays nothing on invoice % to take a percentage of', v_invoice.invoice_number;
      END IF;
      IF round(v_base * NEW.percent / 100, 2) <> NEW.amount THEN
        RAISE EXCEPTION '% per cent of % is %, not %', NEW.percent, ar_format_nad(v_base), ar_format_nad(round(v_base * NEW.percent / 100, 2)), ar_format_nad(NEW.amount);
      END IF;
    END IF;
  END IF;
  NEW.adjustment_number := ar_next_document_number(NEW.practice_id, NEW.kind);$n$]
]);

SELECT pg_temp.onehealth_edit_function('public.ar_insert_adjustment(uuid,text,jsonb,date)'::regprocedure, ARRAY[
  ARRAY[$o$  INSERT INTO invoice_adjustments ($o$, $n$  IF p_kind = 'discount' AND NOT ar_is_approver(p_practice_id) THEN
    RAISE EXCEPTION 'Only a practice administrator or practitioner can give a discount' USING ERRCODE = '42501';
  END IF;
  INSERT INTO invoice_adjustments ($n$],
  ARRAY[$o$approved_by, effective_on, external_ref$o$, $n$approved_by, effective_on, external_ref, percent$n$],
  -- Who gave a discount is kept as its approver, as for a write-off
  ARRAY[$o$    CASE WHEN p_kind = 'write_off' THEN auth.uid() END,$o$, $n$    CASE WHEN p_kind IN ('write_off', 'discount') THEN auth.uid() END,$n$],
  ARRAY[$o$    NULLIF(btrim(p_line->>'external_ref'), '')$o$, $n$    NULLIF(btrim(p_line->>'external_ref'), ''),
    CASE WHEN p_kind = 'discount' THEN NULLIF(btrim(p_line->>'percent'), '')::numeric END$n$]
]);

SELECT pg_temp.onehealth_edit_function('public.ar_post_adjustment(jsonb)'::regprocedure, ARRAY[
  ARRAY[$o$IF v_kind NOT IN ('credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer') THEN$o$,
        $n$IF v_kind NOT IN ('credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer', 'discount') THEN$n$]
]);

SELECT pg_temp.onehealth_edit_function('public.ar_reverse_adjustment(uuid,text)'::regprocedure, ARRAY[
  ARRAY[$o$  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN$o$, $n$  IF v_adj.kind = 'discount' AND NOT ar_is_approver(v_adj.practice_id) THEN
    RAISE EXCEPTION 'Only a practice administrator or practitioner can take back a discount' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN$n$]
]);

-- ---------------------------------------------------------------------------------------------
-- 5. Balances: standing discounts come off what is owed
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.ar_invoice_balances WITH (security_invoker = true) AS
 SELECT f.invoice_id,
    f.practice_id,
    f.patient_id,
    f.invoice_number,
    f.issue_date,
    f.due_date,
    f.payment_status,
    f.batch_id,
    f.is_cancelled,
    f.medical_aid_billed,
    f.patient_billed,
    f.medical_aid_allocated,
    f.patient_allocated,
    f.medical_aid_credited,
    f.patient_credited,
    f.medical_aid_written_off,
    f.patient_written_off,
    f.medical_aid_journals,
    f.patient_journals,
    f.shortfall_transferred,
    f.has_activity,
    f.has_entries,
    f.last_receipt_method,
    f.last_receipt_on,
    f.medical_aid_billed + f.medical_aid_journals - f.shortfall_transferred - f.medical_aid_credited - f.medical_aid_written_off - f.medical_aid_discounted - f.medical_aid_allocated AS medical_aid_outstanding,
    f.patient_billed + f.patient_journals + f.shortfall_transferred - f.patient_credited - f.patient_written_off - f.patient_discounted - f.patient_allocated AS patient_outstanding,
    f.medical_aid_billed + f.patient_billed + f.medical_aid_journals + f.patient_journals - f.medical_aid_credited - f.patient_credited - f.medical_aid_written_off - f.patient_written_off - f.medical_aid_discounted - f.patient_discounted - f.medical_aid_allocated - f.patient_allocated AS outstanding,
    f.medical_aid_discounted,
    f.patient_discounted
   FROM ( SELECT i.id AS invoice_id,
            i.practice_id,
            i.patient_id,
            i.invoice_number,
            i.issue_date,
            i.due_date,
            i.payment_status,
            i.batch_id,
            ar_is_cancelled(i.payment_status) AS is_cancelled,
            s.medical_aid_billed,
            s.patient_billed,
            COALESCE(a.medical_aid_allocated, 0::numeric) AS medical_aid_allocated,
            COALESCE(a.patient_allocated, 0::numeric) AS patient_allocated,
            COALESCE(d.medical_aid_credited, 0::numeric) AS medical_aid_credited,
            COALESCE(d.patient_credited, 0::numeric) AS patient_credited,
            COALESCE(d.medical_aid_written_off, 0::numeric) AS medical_aid_written_off,
            COALESCE(d.patient_written_off, 0::numeric) AS patient_written_off,
            COALESCE(d.medical_aid_journals, 0::numeric) AS medical_aid_journals,
            COALESCE(d.patient_journals, 0::numeric) AS patient_journals,
            COALESCE(d.shortfall_transferred, 0::numeric) AS shortfall_transferred,
            COALESCE(d.medical_aid_discounted, 0::numeric) AS medical_aid_discounted,
            COALESCE(d.patient_discounted, 0::numeric) AS patient_discounted,
            (COALESCE(a.effective_entries, 0::bigint) + COALESCE(d.effective_entries, 0::bigint)) > 0 AS has_activity,
            (COALESCE(a.entries, 0::bigint) + COALESCE(d.entries, 0::bigint)) > 0 AS has_entries,
            a.last_receipt_method,
            a.last_receipt_on
           FROM invoices_enhanced i
             CROSS JOIN LATERAL ( SELECT round(COALESCE(i.total, 0::numeric), 2) AS total,
                    round(COALESCE(i.medical_aid_total, 0::numeric), 2) AS medical_aid_total) t
             CROSS JOIN LATERAL ( SELECT
                        CASE
                            WHEN ar_is_cancelled(i.payment_status) OR t.total <= 0::numeric THEN 0::numeric
                            ELSE LEAST(GREATEST(t.medical_aid_total, 0::numeric), t.total)
                        END AS medical_aid_billed,
                        CASE
                            WHEN ar_is_cancelled(i.payment_status) THEN 0::numeric
                            WHEN t.total <= 0::numeric THEN t.total
                            ELSE t.total - LEAST(GREATEST(t.medical_aid_total, 0::numeric), t.total)
                        END AS patient_billed) s
             LEFT JOIN LATERAL ( SELECT sum(ra.amount) FILTER (WHERE ra.portion = 'medical_aid'::text AND ra.reversed_at IS NULL AND r.reversed_at IS NULL) AS medical_aid_allocated,
                    sum(ra.amount) FILTER (WHERE ra.portion = 'patient'::text AND ra.reversed_at IS NULL AND r.reversed_at IS NULL) AS patient_allocated,
                    count(*) FILTER (WHERE ra.reversed_at IS NULL AND r.reversed_at IS NULL) AS effective_entries,
                    count(*) AS entries,
                    (array_agg(r.method ORDER BY r.received_on DESC, ra.created_at DESC) FILTER (WHERE ra.reversed_at IS NULL AND r.reversed_at IS NULL))[1] AS last_receipt_method,
                    max(r.received_on) FILTER (WHERE ra.reversed_at IS NULL AND r.reversed_at IS NULL) AS last_receipt_on
                   FROM receipt_allocations ra
                     JOIN receipts r ON r.id = ra.receipt_id
                  WHERE ra.invoice_id = i.id) a ON true
             LEFT JOIN LATERAL ( SELECT sum(ad.amount) FILTER (WHERE ad.kind = 'credit_note'::text AND ad.portion = 'medical_aid'::text AND ad.reversed_at IS NULL) AS medical_aid_credited,
                    sum(ad.amount) FILTER (WHERE ad.kind = 'credit_note'::text AND ad.portion = 'patient'::text AND ad.reversed_at IS NULL) AS patient_credited,
                    sum(ad.amount) FILTER (WHERE ad.kind = 'write_off'::text AND ad.portion = 'medical_aid'::text AND ad.reversed_at IS NULL) AS medical_aid_written_off,
                    sum(ad.amount) FILTER (WHERE ad.kind = 'write_off'::text AND ad.portion = 'patient'::text AND ad.reversed_at IS NULL) AS patient_written_off,
                    sum(ad.amount) FILTER (WHERE ad.kind = 'journal'::text AND ad.portion = 'medical_aid'::text AND ad.reversed_at IS NULL) AS medical_aid_journals,
                    sum(ad.amount) FILTER (WHERE ad.kind = 'journal'::text AND ad.portion = 'patient'::text AND ad.reversed_at IS NULL) AS patient_journals,
                    sum(ad.amount) FILTER (WHERE ad.kind = 'shortfall_transfer'::text AND ad.reversed_at IS NULL) AS shortfall_transferred,
                    sum(ad.amount) FILTER (WHERE ad.kind = 'discount'::text AND ad.portion = 'medical_aid'::text AND ad.reversed_at IS NULL) AS medical_aid_discounted,
                    sum(ad.amount) FILTER (WHERE ad.kind = 'discount'::text AND ad.portion = 'patient'::text AND ad.reversed_at IS NULL) AS patient_discounted,
                    count(*) FILTER (WHERE ad.reversed_at IS NULL) AS effective_entries,
                    count(*) AS entries
                   FROM invoice_adjustments ad
                  WHERE ad.invoice_id = i.id) d ON true) f;

CREATE OR REPLACE VIEW public.ar_invoice_portion_balances WITH (security_invoker = true) AS
 SELECT b.invoice_id,
    b.practice_id,
    b.patient_id,
    b.invoice_number,
    b.issue_date,
    b.due_date,
    'medical_aid'::text AS portion,
    b.medical_aid_billed AS billed,
    b.medical_aid_allocated AS allocated,
    b.medical_aid_credited AS credited,
    b.medical_aid_written_off AS written_off,
    b.medical_aid_journals AS journals,
    - b.shortfall_transferred AS transferred,
    b.medical_aid_outstanding AS outstanding,
    b.medical_aid_discounted AS discounted
   FROM ar_invoice_balances b
UNION ALL
 SELECT b.invoice_id,
    b.practice_id,
    b.patient_id,
    b.invoice_number,
    b.issue_date,
    b.due_date,
    'patient'::text AS portion,
    b.patient_billed AS billed,
    b.patient_allocated AS allocated,
    b.patient_credited AS credited,
    b.patient_written_off AS written_off,
    b.patient_journals AS journals,
    b.shortfall_transferred AS transferred,
    b.patient_outstanding AS outstanding,
    b.patient_discounted AS discounted
   FROM ar_invoice_balances b;

-- ---------------------------------------------------------------------------------------------
-- 6. Control totals, the month end, the daybook and closed months
-- ---------------------------------------------------------------------------------------------

SELECT pg_temp.onehealth_edit_function('public.dc_movements(uuid)'::regprocedure, ARRAY[
  ARRAY[$o$WHEN 'journal' THEN 'journals' ELSE 'refunds' END,$o$, $n$WHEN 'journal' THEN 'journals' WHEN 'discount' THEN 'discounts' ELSE 'refunds' END,$n$],
  ARRAY[$o$CASE WHEN a.kind IN ('credit_note', 'write_off') THEN -a.amount ELSE a.amount END$o$,
        $n$CASE WHEN a.kind IN ('credit_note', 'write_off', 'discount') THEN -a.amount ELSE a.amount END$n$],
  ARRAY[$o$CASE WHEN a.kind IN ('credit_note', 'write_off') THEN a.amount ELSE -a.amount END$o$,
        $n$CASE WHEN a.kind IN ('credit_note', 'write_off', 'discount') THEN a.amount ELSE -a.amount END$n$]
]);

SELECT pg_temp.onehealth_edit_function('public.dc_close_period(uuid,date,jsonb)'::regprocedure, ARRAY[
  ARRAY[$o$ARRAY['invoices', 'credit_notes', 'write_offs',$o$, $n$ARRAY['invoices', 'credit_notes', 'discounts', 'write_offs',$n$]
]);

SELECT pg_temp.onehealth_edit_function('public.dc_daybook_from_audit()'::regprocedure, ARRAY[
  ARRAY[$o$WHEN 'write_off' THEN -v_amount WHEN 'journal'$o$, $n$WHEN 'write_off' THEN -v_amount WHEN 'discount' THEN -v_amount WHEN 'journal'$n$]
]);

SELECT pg_temp.onehealth_edit_function('public.dc_lock_adjustments()'::regprocedure, ARRAY[
  ARRAY[$o$WHEN 'refund' THEN 'a refund' ELSE 'a shortfall transfer' END$o$, $n$WHEN 'refund' THEN 'a refund' WHEN 'discount' THEN 'a discount' ELSE 'a shortfall transfer' END$n$]
]);

-- ---------------------------------------------------------------------------------------------
-- 7. A statement message per account (an account flag, kept on whoever pays)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.account_flags DROP CONSTRAINT account_flags_flag_check;
ALTER TABLE public.account_flags ADD CONSTRAINT account_flags_flag_check CHECK (flag IN (
  'cash_only', 'no_claims', 'dispute', 'handed_over', 'credit_limit', 'no_statement', 'statement_language', 'alert',
  'no_interest', 'lay_bye', 'statement_message'));
ALTER TABLE public.account_flags DROP CONSTRAINT account_flags_value;
ALTER TABLE public.account_flags ADD CONSTRAINT account_flags_value CHECK (
CASE flag
    WHEN 'credit_limit'::text THEN ((amount IS NOT NULL) AND (amount > (0)::numeric) AND (value IS NULL))
    WHEN 'statement_language'::text THEN ((value = ANY (ARRAY['en'::text, 'af'::text])) AND (amount IS NULL))
    WHEN 'alert'::text THEN (((char_length(btrim(COALESCE(value, ''::text))) >= 3) AND (char_length(btrim(COALESCE(value, ''::text))) <= 280)) AND (amount IS NULL))
    -- Printed on every statement of the account (src/services/ledger/accountFlags.ts STATEMENT_MESSAGE_MAX)
    WHEN 'statement_message'::text THEN (((char_length(btrim(COALESCE(value, ''::text))) >= 3) AND (char_length(btrim(COALESCE(value, ''::text))) <= 280)) AND (amount IS NULL))
    ELSE ((amount IS NULL) AND (value IS NULL))
END);

SELECT pg_temp.onehealth_edit_function('public.dc_flag_rule(text)'::regprocedure, ARRAY[
  ARRAY[$o$    ('statement_language', 'Statement language', 'account', false, ARRAY[]::text[]),$o$, $n$    ('statement_language', 'Statement language', 'account', false, ARRAY[]::text[]),
    ('statement_message', 'Statement message', 'account', false, ARRAY[]::text[]),$n$]
]);

SELECT pg_temp.onehealth_edit_function('public.dc_set_account_flag(uuid,uuid,text,jsonb)'::regprocedure, ARRAY[
  ARRAY[$o$  ELSIF p_flag IN ('statement_language', 'alert') THEN$o$, $n$  ELSIF p_flag IN ('statement_language', 'alert', 'statement_message') THEN$n$],
  ARRAY[$o$    IF p_flag NOT IN ('credit_limit', 'statement_language', 'alert') THEN$o$, $n$    IF p_flag NOT IN ('credit_limit', 'statement_language', 'alert', 'statement_message') THEN$n$]
]);

DROP FUNCTION pg_temp.onehealth_edit_function(regprocedure, text[]);

-- ---------------------------------------------------------------------------------------------
-- 8. The patient app: nothing new (no new table; the RESTRICTIVE portal_staff_only policies of invoice_adjustments and
--    account_flags stay as they are)
-- ---------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------
-- 9. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_src text;
  v_fn text;
BEGIN
  -- Every edit is in place
  IF position('''discount'' THEN ''DS''' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_next_document_number(uuid,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: discounts are not numbered';
  END IF;
  v_src := (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_adjustments_before_insert()'::regprocedure);
  IF position('IN (''credit_note'', ''write_off'', ''discount'')' in v_src) = 0 OR position('per cent of' in v_src) = 0
     OR position('A discount must be given by' in v_src) = 0 OR position('A write-off must be approved' in v_src) = 0 THEN
    RAISE EXCEPTION 'Check failed: ar_adjustments_before_insert does not check discounts, or lost the write-off check';
  END IF;
  v_src := (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_insert_adjustment(uuid,text,jsonb,date)'::regprocedure);
  IF position('can give a discount' in v_src) = 0 OR position('external_ref, percent' in v_src) = 0 OR position('can approve a write-off' in v_src) = 0 THEN
    RAISE EXCEPTION 'Check failed: ar_insert_adjustment does not record discounts as this file says';
  END IF;
  IF position('''discount'')' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_post_adjustment(jsonb)'::regprocedure)) = 0
     OR position('take back a discount' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.ar_reverse_adjustment(uuid,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: discounts cannot be given or are taken back by anyone';
  END IF;
  IF position('''discounts''' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.dc_movements(uuid)'::regprocedure)) = 0
     OR position('''discounts''' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.dc_close_period(uuid,date,jsonb)'::regprocedure)) = 0
     OR position('''discount'' THEN -v_amount' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.dc_daybook_from_audit()'::regprocedure)) = 0
     OR position('a discount' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.dc_lock_adjustments()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: control totals, the month end, the daybook or the closed-month lock do not know discounts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dc_flag_rule('statement_message'))
     OR position('''statement_message'')' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.dc_set_account_flag(uuid,uuid,text,jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: the statement message flag cannot be set';
  END IF;
  -- The views stay security_invoker (they read with the user's own policies)
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.ar_invoice_balances'::regclass AND reloptions @> ARRAY['security_invoker=true'])
     OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.ar_invoice_portion_balances'::regclass AND reloptions @> ARRAY['security_invoker=true'])
     OR has_table_privilege('anon', 'public.ar_invoice_balances', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: a balance view is no longer security_invoker or anon can read it';
  END IF;
  -- Who may run what is unchanged
  FOREACH v_fn IN ARRAY ARRAY['public.ar_post_adjustment(jsonb)', 'public.ar_reverse_adjustment(uuid,text)', 'public.dc_set_account_flag(uuid,uuid,text,jsonb)', 'public.dc_close_period(uuid,date,jsonb)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % must be for signed-in staff only', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.ar_insert_adjustment(uuid,text,jsonb,date)', 'public.ar_next_document_number(uuid,text)', 'public.dc_movements(uuid)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Check failed: % is for the functions above only', v_fn;
    END IF;
  END LOOP;
  -- Nothing already owed changed (no discount exists yet), and no policy changed
  IF current_setting('onehealth.balances_before', true) IS DISTINCT FROM (
    SELECT md5(COALESCE(string_agg(invoice_id::text || '|' || medical_aid_outstanding::text || '|' || patient_outstanding::text || '|' || outstanding::text, ';' ORDER BY invoice_id), ''))
      FROM public.ar_invoice_balances) THEN
    RAISE EXCEPTION 'Check failed: an invoice balance changed';
  END IF;
  IF current_setting('onehealth.policies_before', true) IS DISTINCT FROM (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('invoice_adjustments', 'invoices_enhanced', 'invoice_services', 'account_flags', 'daybook_entries', 'practice_settings', 'patients', 'users')) THEN
    RAISE EXCEPTION 'Check failed: a policy of invoice_adjustments, invoices_enhanced, invoice_services, account_flags, daybook_entries, practice_settings, patients or users changed';
  END IF;
END $$;

ROLLBACK;

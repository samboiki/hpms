-- Applied 2026-10-12 as migration who_did_what_2026_10_12 (version 20261012191531; stored statement md5 07919a1aa9ad876c9b4cf4f28d1c828f = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: report_user_activity 166297074a4b10a62cb2295471fb336b, log_report_export f6e9c2097ef767756f9b65abaf2a9320.
-- Rehearsed with simulated logins (rolled back): anon refused the report, the log and the table (42501); another
-- practice's doctor refused both (42501); the practice's receptionist (not an administrator) refused the report
-- (42501), logged an export, a bad report name refused (23514), a direct insert refused (42501), read 0 exports; the
-- administrator read the export, was refused someone from another practice and 410 days (22023) and another
-- practice's report (42501); the receptionist's report matched the trails area by area (invoice, payment, patient
-- file, export), nothing outside the period, patient-file rows carrying only a visit id; a receipt and an allocation
-- recorded by the receptionist (invented ar_audit_events) showed with their receipt, invoice and patient.
-- =============================================================================================
-- PROPOSAL: "who did what" - one staff member's postings and changes over a period, for the practice's
--           administrators (parity R17 "finger print" report and Q8 audit report), and a record of every download
--           and print of a Finance report (Q8: exports were not recorded)
-- File:   proposals/2026-10-12-who-did-what.sql                            Drafted: 2026-10-12
-- Code:   src/components/finance/practiceReports/WhoDidWhatReport.tsx (the report, administrators only),
--         src/components/finance/practiceReports/userActivity.ts (each event in plain words; what is not recorded; tested),
--         src/components/finance/practiceReports/practiceReportsService.ts (loadUserActivity, logReportExport)
--
-- Why (parity R17, Q8): who posted or changed something shows per entry (the daybook's "By", a receipt's created and
-- reversed by, an invoice's change history, a patient file's change history), but nothing lists one person's actions
-- over a period, and nothing recorded who downloaded or printed a report.
--
-- What it does
--   1. report_exports: one row per download (CSV) or print of a Finance report: the report, the period, how many
--      rows, its filters (ids and choices only, never names or amounts), who and when. Written only through
--      log_report_export; read by the practice's administrators (and OneHealth support). No one changes or deletes a
--      row (no grant).
--   2. log_report_export(practice, report, format, from, to, rows, filters): records an export by the signed-in
--      person; staff who may open Finance (claim_assert_staff), as the reports themselves.
--   3. report_user_activity(practice, user, from, to): what one staff member of the practice did from `from` to `to`
--      (Windhoek days, at most 13 months), newest last, from the trails the database already keeps:
--        invoices raised (invoices_enhanced.created_by) and changed (invoice_audit_events, the invoice history:
--        fields, lines, claim lines corrected or sent again);
--        receipts, allocations, credit notes, write-offs, corrections and refunds, and their reversals
--        (ar_audit_events);
--        patient files, visits, vital signs and medical aid added, changed or deleted (audit_logs; only entries of
--        this practice, by the rule its read policy uses: rls_my_role_for_audit_entry);
--        claim batches sent (batch_submissions), rejections acted on (claim_rejection_events), remittances posted;
--        months closed and reopened, days cashed up, deposit slips prepared, banked and cancelled;
--        daybook prints and exports, and Finance report downloads and prints (section 1).
--      Values of patient records are never returned (which record, not what it held). Only the practice's own
--      administrators may call it (42501 for everyone else, the public key included); the person asked about must
--      work in the practice.
--   Not recorded anywhere today (the report says so): opening or reading a patient file, an invoice or a report;
--   sign-ins (only each person's last one is kept, users.last_login); downloads other than the daybook and Finance
--   reports (claim files, statements, debtors lists, the receivables ledger CSV).
--
-- Needs: practice isolation's rls_my_practice_id and rls_is_super_admin, staff-records-admins' rls_is_staff_admin,
-- the audit read policy's rls_my_role_for_audit_entry, claim-corrections (claim_assert_staff), debtors-and-controls
-- (period_closes, cash_ups, bank_deposits, daybook_prints), receipts (ar_audit_events), invoicing
-- (invoice_audit_events, invoices_enhanced.created_by), remittances.
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the report says it is not set up yet and downloads are simply not recorded.
-- Undo:  DROP FUNCTION IF EXISTS public.report_user_activity(uuid, uuid, date, date);
--        DROP FUNCTION IF EXISTS public.log_report_export(uuid, text, text, date, date, integer, jsonb);
--        DROP TABLE IF EXISTS public.report_exports;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: what this file reads, as it was on 2026-10-12
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.rls_is_staff_admin()') IS NULL OR to_regprocedure('public.rls_my_practice_id()') IS NULL
     OR to_regprocedure('public.rls_is_super_admin()') IS NULL OR to_regprocedure('public.rls_my_role_for_audit_entry(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Check failed: the rls_ helpers are missing (practice isolation, staff-records-admins)';
  END IF;
  IF to_regprocedure('public.claim_assert_staff(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Check failed: claim_assert_staff(uuid) is missing (claim-corrections)';
  END IF;
  IF to_regclass('public.ar_audit_events') IS NULL OR to_regclass('public.invoice_audit_events') IS NULL
     OR to_regclass('public.period_closes') IS NULL OR to_regclass('public.cash_ups') IS NULL
     OR to_regclass('public.bank_deposits') IS NULL OR to_regclass('public.daybook_prints') IS NULL
     OR to_regclass('public.claim_rejection_events') IS NULL OR to_regclass('public.remittance_documents') IS NULL THEN
    RAISE EXCEPTION 'Check failed: a trail this report reads is missing';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Downloads and prints of Finance reports
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_exports (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  report      text NOT NULL CHECK (report ~ '^[a-z0-9_]{1,60}$'),
  format      text NOT NULL CHECK (format IN ('csv', 'print')),
  period_from date,
  period_to   date,
  row_count   integer CHECK (row_count IS NULL OR row_count >= 0),
  filters     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object' AND length(filters::text) <= 2000),
  exported_by uuid NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_exports_practice_person_idx ON public.report_exports (practice_id, exported_by, exported_at);

COMMENT ON TABLE public.report_exports IS
  'Every download (CSV) or print of a Finance report: report, period, rows, filters (ids and choices only), who and when. Written by log_report_export; read by the practice''s administrators. Shown in Finance > Reports > Who did what.';

ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_exports_admin_read ON public.report_exports;
CREATE POLICY report_exports_admin_read ON public.report_exports FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u
             WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = report_exports.practice_id)
    OR public.rls_is_super_admin()
  );
REVOKE ALL ON public.report_exports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.report_exports TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Recording a download or print
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_report_export(
  p_practice_id uuid, p_report text, p_format text, p_from date, p_to date, p_rows integer, p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id bigint;
BEGIN
  PERFORM public.claim_assert_staff(p_practice_id);
  INSERT INTO public.report_exports (practice_id, report, format, period_from, period_to, row_count, filters, exported_by)
  VALUES (p_practice_id, btrim(COALESCE(p_report, '')), p_format, p_from, p_to, p_rows, COALESCE(p_filters, '{}'::jsonb), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_report_export(uuid, text, text, date, date, integer, jsonb) IS
  'Records a download (csv) or print of a Finance report by the signed-in person. Staff who open Finance.';

-- ---------------------------------------------------------------------------------------------
-- 3. Who did what: one staff member's actions over a period
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.report_user_activity(p_practice_id uuid, p_user_id uuid, p_from date, p_to date)
RETURNS TABLE (
  occurred_at timestamptz,
  area text,
  action text,
  invoice_id uuid,
  receipt_id uuid,
  patient_id uuid,
  batch_id uuid,
  record_table text,
  record_id uuid,
  document text,
  amount numeric,
  details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_from timestamptz;
  v_to   timestamptz;
BEGIN
  IF auth.uid() IS NULL OR public.rls_my_practice_id() IS DISTINCT FROM p_practice_id OR NOT public.rls_is_staff_admin() THEN
    RAISE EXCEPTION 'Only the practice''s administrators can see who did what.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.practice_id = p_practice_id) THEN
    RAISE EXCEPTION 'Choose someone who works in this practice.' USING ERRCODE = '22023';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Choose a period: a first and a last day.' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > 400 THEN
    RAISE EXCEPTION 'Choose a period of at most 13 months.' USING ERRCODE = '22023';
  END IF;
  -- Windhoek days: from the first day's midnight up to (not including) the midnight after the last day
  v_from := p_from::timestamp AT TIME ZONE 'Africa/Windhoek';
  v_to := (p_to + 1)::timestamp AT TIME ZONE 'Africa/Windhoek';

  RETURN QUERY
  -- Invoices raised
  SELECT i.created_at, 'invoice'::text, 'invoice_raised'::text, i.id, NULL::uuid, i.patient_id, NULL::uuid,
         'invoices_enhanced'::text, i.id, i.invoice_number, i.total, '{}'::jsonb
    FROM public.invoices_enhanced i
   WHERE i.practice_id = p_practice_id AND i.created_by = p_user_id AND i.created_at >= v_from AND i.created_at < v_to
  UNION ALL
  -- Invoice changes: fields, lines, claim lines corrected or sent again (the invoice history)
  SELECT e.changed_at, 'invoice', e.action, e.invoice_id, NULL, i.patient_id, NULL,
         'invoice_audit_events', NULL, i.invoice_number, NULL,
         jsonb_build_object('id', e.id, 'field', e.field, 'old_value', e.old_value, 'new_value', e.new_value,
                            'line_code', e.line_code, 'line_before', e.line_before, 'line_after', e.line_after)
    FROM public.invoice_audit_events e
    LEFT JOIN public.invoices_enhanced i ON i.id = e.invoice_id
   WHERE e.practice_id = p_practice_id AND e.changed_by = p_user_id AND e.changed_at >= v_from AND e.changed_at < v_to
  UNION ALL
  -- Receipts, allocations and adjustments (credit notes, write-offs, corrections, refunds, shortfall moves), created
  -- or reversed: the whole row is in details at the time
  SELECT a.occurred_at, 'payment', a.entity || '_' || a.action,
         ids.invoice, ids.receipt, COALESCE(ids.patient, inv.patient_id), NULL,
         'ar_audit_events', a.entity_id,
         COALESCE(a.details ->> 'receipt_number', a.details ->> 'adjustment_number', inv.invoice_number),
         CASE WHEN (a.details ->> 'amount') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (a.details ->> 'amount')::numeric END,
         jsonb_build_object('kind', a.details ->> 'kind', 'portion', a.details ->> 'portion', 'method', a.details ->> 'method',
                            'invoice_number', inv.invoice_number)
    FROM public.ar_audit_events a
    CROSS JOIN LATERAL (
      SELECT CASE WHEN a.details ->> 'invoice_id' ~* c_uuid THEN (a.details ->> 'invoice_id')::uuid END AS invoice,
             CASE WHEN a.entity = 'receipt' THEN a.entity_id
                  WHEN a.details ->> 'receipt_id' ~* c_uuid THEN (a.details ->> 'receipt_id')::uuid END AS receipt,
             CASE WHEN a.details ->> 'patient_id' ~* c_uuid THEN (a.details ->> 'patient_id')::uuid END AS patient) ids
    LEFT JOIN public.invoices_enhanced inv ON inv.id = ids.invoice
   WHERE a.practice_id = p_practice_id AND a.actor = p_user_id AND a.occurred_at >= v_from AND a.occurred_at < v_to
  UNION ALL
  -- Patient files, visits, vital signs and medical aid: which record, never its values. An entry is this practice's
  -- when the audit read policy says so for the caller (an administrator of this practice, checked above)
  SELECT l.created_at, 'patient_file', lower(l.action), NULL, NULL,
         CASE WHEN l.table_name = 'patients' THEN l.record_id ELSE COALESCE(ids.patient, v.patient_id) END,
         NULL, l.table_name, l.record_id, NULL, NULL,
         jsonb_build_object('visit_id', ids.visit)
    FROM public.audit_logs l
    CROSS JOIN LATERAL (
      SELECT CASE WHEN COALESCE(l.new_values, l.old_values) ->> 'patient_id' ~* c_uuid
                  THEN (COALESCE(l.new_values, l.old_values) ->> 'patient_id')::uuid END AS patient,
             CASE WHEN l.table_name = 'visits' THEN l.record_id
                  WHEN COALESCE(l.new_values, l.old_values) ->> 'visit_id' ~* c_uuid
                  THEN (COALESCE(l.new_values, l.old_values) ->> 'visit_id')::uuid END AS visit) ids
    LEFT JOIN public.visits v ON v.id = ids.visit
   WHERE l.user_id = p_user_id AND l.created_at >= v_from AND l.created_at < v_to
     AND l.table_name IN ('patients', 'visits', 'vitals', 'medical_aid_details')
     AND public.rls_my_role_for_audit_entry(COALESCE(l.new_values, l.old_values)) = 'admin'
  UNION ALL
  -- Claim batches sent
  SELECT s.submitted_at, 'claims', 'batch_sent', NULL, NULL, NULL, s.batch_header_id,
         'batch_submissions', s.id, h.batch_number::text, s.total_amount,
         jsonb_build_object('status', s.status, 'fund', COALESCE(s.medical_aid_reference, h.medical_aid_reference), 'claims', s.total_claims)
    FROM public.batch_submissions s
    LEFT JOIN public.batch_headers h ON h.id = s.batch_header_id
   WHERE s.practice_id = p_practice_id AND s.submitted_by = p_user_id AND s.submitted_at >= v_from AND s.submitted_at < v_to
  UNION ALL
  -- Rejections acted on (resubmitted, billed to the patient, written off, waiting, noted, closed, reopened)
  SELECT ev.occurred_at, 'claims', 'rejection_' || ev.action, cr.invoice_id, NULL, cr.patient_id, cr.resubmitted_batch_id,
         'claim_rejections', cr.id, cr.tariff_code, cr.at_stake,
         jsonb_build_object('fund', cr.fund_code, 'claim_line_id', cr.claim_line_id)
    FROM public.claim_rejection_events ev
    JOIN public.claim_rejections cr ON cr.id = ev.rejection_id
   WHERE cr.practice_id = p_practice_id AND ev.actor = p_user_id AND ev.occurred_at >= v_from AND ev.occurred_at < v_to
  UNION ALL
  -- Remittances (fund payments and responses) posted
  SELECT d.posted_at, 'claims', 'remittance_posted', NULL, d.receipt_id, NULL, NULL,
         'remittance_documents', d.id, d.file_name, d.total_paid,
         jsonb_build_object('fund', COALESCE(d.fund_code, d.fund_name))
    FROM public.remittance_documents d
   WHERE d.practice_id = p_practice_id AND d.posted_by = p_user_id AND d.posted_at >= v_from AND d.posted_at < v_to
  UNION ALL
  -- Months closed and reopened
  SELECT c.closed_at, 'controls', 'month_closed', NULL, NULL, NULL, NULL,
         'period_closes', c.id, to_char(c.period_month, 'YYYY-MM'), c.closing_balance, '{}'::jsonb
    FROM public.period_closes c
   WHERE c.practice_id = p_practice_id AND c.closed_by = p_user_id AND c.closed_at >= v_from AND c.closed_at < v_to
  UNION ALL
  SELECT c.reopened_at, 'controls', 'month_reopened', NULL, NULL, NULL, NULL,
         'period_closes', c.id, to_char(c.period_month, 'YYYY-MM'), NULL, '{}'::jsonb
    FROM public.period_closes c
   WHERE c.practice_id = p_practice_id AND c.reopened_by = p_user_id AND c.reopened_at >= v_from AND c.reopened_at < v_to
  UNION ALL
  -- Days cashed up (and a count replaced)
  SELECT cu.closed_at, 'controls', 'day_cashed_up', NULL, NULL, NULL, NULL,
         'cash_ups', cu.id, to_char(cu.business_date, 'YYYY-MM-DD'), cu.counted_cash, jsonb_build_object('difference', cu.difference)
    FROM public.cash_ups cu
   WHERE cu.practice_id = p_practice_id AND cu.closed_by = p_user_id AND cu.closed_at >= v_from AND cu.closed_at < v_to
  UNION ALL
  SELECT cu.superseded_at, 'controls', 'cash_up_replaced', NULL, NULL, NULL, NULL,
         'cash_ups', cu.id, to_char(cu.business_date, 'YYYY-MM-DD'), NULL, '{}'::jsonb
    FROM public.cash_ups cu
   WHERE cu.practice_id = p_practice_id AND cu.superseded_by = p_user_id AND cu.superseded_at >= v_from AND cu.superseded_at < v_to
  UNION ALL
  -- Deposit slips prepared, banked and cancelled
  SELECT bd.prepared_at, 'controls', 'deposit_prepared', NULL, NULL, NULL, NULL,
         'bank_deposits', bd.id, bd.deposit_number, bd.amount, '{}'::jsonb
    FROM public.bank_deposits bd
   WHERE bd.practice_id = p_practice_id AND bd.prepared_by = p_user_id AND bd.prepared_at >= v_from AND bd.prepared_at < v_to
  UNION ALL
  SELECT bd.deposited_at, 'controls', 'deposit_banked', NULL, NULL, NULL, NULL,
         'bank_deposits', bd.id, bd.deposit_number, bd.amount, '{}'::jsonb
    FROM public.bank_deposits bd
   WHERE bd.practice_id = p_practice_id AND bd.deposited_by = p_user_id AND bd.deposited_at >= v_from AND bd.deposited_at < v_to
  UNION ALL
  SELECT bd.cancelled_at, 'controls', 'deposit_cancelled', NULL, NULL, NULL, NULL,
         'bank_deposits', bd.id, bd.deposit_number, bd.amount, '{}'::jsonb
    FROM public.bank_deposits bd
   WHERE bd.practice_id = p_practice_id AND bd.cancelled_by = p_user_id AND bd.cancelled_at >= v_from AND bd.cancelled_at < v_to
  UNION ALL
  -- Daybook prints and exports
  SELECT dp.printed_at, 'export', 'daybook_' || dp.kind, NULL, NULL, NULL, NULL,
         'daybook_prints', dp.id, to_char(dp.day, 'YYYY-MM-DD'), NULL,
         jsonb_build_object('copy', dp.copy_number, 'entries', dp.entry_count)
    FROM public.daybook_prints dp
   WHERE dp.practice_id = p_practice_id AND dp.printed_by = p_user_id AND dp.printed_at >= v_from AND dp.printed_at < v_to
  UNION ALL
  -- Finance report downloads and prints (section 1)
  SELECT x.exported_at, 'export', 'report_' || x.format, NULL, NULL, NULL, NULL,
         'report_exports', NULL, x.report, NULL,
         jsonb_build_object('from', x.period_from, 'to', x.period_to, 'rows', x.row_count, 'filters', x.filters)
    FROM public.report_exports x
   WHERE x.practice_id = p_practice_id AND x.exported_by = p_user_id AND x.exported_at >= v_from AND x.exported_at < v_to
   ORDER BY 1, 3;
END;
$$;

COMMENT ON FUNCTION public.report_user_activity(uuid, uuid, date, date) IS
  'Who did what: one staff member''s invoices, payments, adjustments, patient-file changes, claims, controls and exports over a period, from the existing trails; never the values of patient records. The practice''s administrators only. Finance > Reports > Who did what.';

REVOKE ALL ON FUNCTION public.log_report_export(uuid, text, text, date, date, integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_user_activity(uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_report_export(uuid, text, text, date, date, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_user_activity(uuid, uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Result (read only): who may call them, and that the table is closed to writes from the app
-- ---------------------------------------------------------------------------------------------

SELECT has_function_privilege('anon', 'public.report_user_activity(uuid, uuid, date, date)', 'EXECUTE') AS anon_runs_report,
       has_function_privilege('anon', 'public.log_report_export(uuid, text, text, date, date, integer, jsonb)', 'EXECUTE') AS anon_logs,
       has_table_privilege('authenticated', 'public.report_exports', 'INSERT') AS staff_insert_directly,
       has_table_privilege('authenticated', 'public.report_exports', 'DELETE') AS staff_delete;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

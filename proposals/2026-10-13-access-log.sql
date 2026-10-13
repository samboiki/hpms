-- Applied 2026-10-13 as migration access_log_2026_10_13 (version 20261012221143; stored statement md5 025f5860fc2346e56530767215b7fd45 = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 afterwards: report_user_activity 7dfeb9613d2ea4c2b39155ad642a58bc, log_record_access 85a971f653248e7981d222aedd555a71.
-- Rehearsed with simulated logins (rolled back): the practice's receptionist opened a file (recorded), the same file
-- again and from the visit page (skipped, within 10 minutes), a second file (recorded), signed in (recorded), again
-- (skipped), signed out (recorded); another practice's file and no patient were refused (42501), an unknown event, a
-- badly named screen and a sign-in naming a patient (22023); a direct insert was refused (42501); she read 0 rows and
-- was refused the report (42501). The administrator read her 4 entries; the report showed them in area 'access' (two
-- files with their patients and screens, the sign-in and sign-out without a patient), and every other row of her 13
-- months was the same as the 12 October report returned. Another practice's doctor read 0 and could not record this
-- practice's file (42501); a patient-app login and anon could neither record nor read (42501); patient merges do not
-- touch the log (no foreign key to patients).
-- =============================================================================================
-- PROPOSAL: a record of who opened which patient's file, and of sign-ins and sign-outs, shown in "Who did what"
--           (parity Q8: audit of record access)
-- File:   proposals/2026-10-13-access-log.sql                               Drafted: 2026-10-13
-- Code:   src/services/recordAccessLog.ts (records an entry; never blocks or slows the screen; tested),
--         src/hooks/usePatientFileAccessLog.ts (the patient file and the visit page call it),
--         src/stores/authStore.ts (sign-in and sign-out),
--         src/components/finance/practiceReports/userActivity.ts (the entries in words; what is still not recorded)
--
-- Why (Q8): "Who did what" showed postings and changes, but opening a patient's file and signing in or out were not
-- recorded anywhere (only each person's most recent sign-in was kept), so a practice could not answer "who looked at
-- this file" or "who was signed in that evening".
--
-- What it does
--   1. record_access_log: one row per event - a patient's file opened, a sign-in, a sign-out - with the practice, the
--      person, the patient (file opens only), the screen and the time. Never any value of the file. No foreign key to
--      patients on purpose: a merge of patient files (which re-points every foreign key to patients) must not rewrite
--      whose file was opened, and the entry outlives the file. Read by the practice's administrators (and OneHealth
--      support); written only through log_record_access; nobody changes or deletes a row (no grant).
--   2. log_record_access(event, patient, screen): records the event for the signed-in staff member. A file of another
--      practice is refused (42501), so nothing is recorded about it. Repeats are skipped: the same person opening the
--      same file within 10 minutes is one entry; a second sign-in or sign-out within a minute is skipped. Returns
--      whether a row was written. The screens call it without waiting and ignore any failure.
--   3. report_user_activity (Finance > Reports > Who did what): as proposals/2026-10-12-who-did-what.sql left it, plus
--      one part reading record_access_log (area 'access': the event, the patient, the screen). Same arguments, same
--      columns, same rule (the practice's administrators only).
--   4. The patient app's logins get nothing here, as on every OneHealth table.
--   5. Checks.
-- Still not recorded (the report says so): reading a visit, an invoice or a report without opening the patient's
-- file from the patient file or visit page; seeing a patient in lists, the diary, search or the dashboard; a session
-- that ends by closing the browser or timing out (no sign-out); coming back on a device that stayed signed in (not a
-- new sign-in); OneHealth support opening another practice's file.
-- Kept: until the owner decides how long (nothing deletes rows; one row per person per file per 10 minutes at most).
--
-- Needs: practice isolation's rls_my_practice_id and rls_is_super_admin, staff-records-admins' rls_is_staff_admin,
-- proposals/2026-10-12-who-did-what.sql (report_user_activity as it left it; the file stops if it changed since).
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Before it is applied the screens' calls fail quietly and nothing is recorded.
-- Undo:  restore report_user_activity from proposals/2026-10-12-who-did-what.sql (section 3), then
--        DROP FUNCTION IF EXISTS public.log_record_access(text, uuid, text);
--        DROP TABLE IF EXISTS public.record_access_log;
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.report_user_activity(uuid,uuid,date,date)'::regprocedure) <> '166297074a4b10a62cb2295471fb336b' THEN
    RAISE EXCEPTION 'Stopped: report_user_activity is not the version proposals/2026-10-12-who-did-what.sql left; merge by hand';
  END IF;
  IF to_regprocedure('public.rls_is_staff_admin()') IS NULL OR to_regprocedure('public.rls_my_practice_id()') IS NULL
     OR to_regprocedure('public.rls_is_super_admin()') IS NULL OR to_regprocedure('public.rls_my_role_for_audit_entry(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Stopped: the rls_ helpers are missing (practice isolation, staff-records-admins)';
  END IF;
  -- The policies of the protected tables this file reads, to check at the end that none changed
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('patients', 'users', 'practices')
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The access log
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.record_access_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  user_id     uuid NOT NULL,
  event       text NOT NULL CHECK (event IN ('patient_opened', 'signed_in', 'signed_out')),
  -- No foreign key: a merge of patient files must not rewrite whose file was opened, and the entry outlives the file
  patient_id  uuid,
  screen      text NOT NULL CHECK (screen ~ '^[a-z][a-z0-9_]{0,39}$'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT record_access_log_patient_only_for_files CHECK ((event = 'patient_opened') = (patient_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS record_access_log_person_idx ON public.record_access_log (practice_id, user_id, occurred_at);
CREATE INDEX IF NOT EXISTS record_access_log_repeat_idx ON public.record_access_log (user_id, event, patient_id, occurred_at);

COMMENT ON TABLE public.record_access_log IS
  'Who opened which patient''s file (and from which screen), and staff sign-ins and sign-outs; never any value of the file. Written by log_record_access (one entry per person and file per 10 minutes); read by the practice''s administrators. Shown in Finance > Reports > Who did what.';

ALTER TABLE public.record_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS record_access_log_admin_read ON public.record_access_log;
CREATE POLICY record_access_log_admin_read ON public.record_access_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u
             WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = record_access_log.practice_id)
    OR public.rls_is_super_admin()
  );
REVOKE ALL ON public.record_access_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.record_access_log TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Recording a file opened, a sign-in or a sign-out
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_record_access(p_event text, p_patient_id uuid DEFAULT NULL, p_screen text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_practice uuid;
  v_screen   text := lower(btrim(COALESCE(p_screen, '')));
  v_window   interval;
BEGIN
  SELECT u.practice_id INTO v_practice FROM public.users u WHERE u.id = v_user AND COALESCE(u.is_active, true);
  IF v_user IS NULL OR v_practice IS NULL THEN
    RAISE EXCEPTION 'Only a practice''s staff are recorded here.' USING ERRCODE = '42501';
  END IF;
  IF p_event IS NULL OR p_event NOT IN ('patient_opened', 'signed_in', 'signed_out') THEN
    RAISE EXCEPTION 'Unknown event: a patient''s file opened, a sign-in or a sign-out.' USING ERRCODE = '22023';
  END IF;
  IF v_screen !~ '^[a-z][a-z0-9_]{0,39}$' THEN
    RAISE EXCEPTION 'Name the screen (lower-case letters, digits and _).' USING ERRCODE = '22023';
  END IF;
  IF p_event = 'patient_opened' THEN
    IF p_patient_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.practice_id = v_practice) THEN
      RAISE EXCEPTION 'Only a file of your own practice is recorded.' USING ERRCODE = '42501';
    END IF;
    v_window := interval '10 minutes';
  ELSE
    IF p_patient_id IS NOT NULL THEN
      RAISE EXCEPTION 'A sign-in or sign-out names no patient.' USING ERRCODE = '22023';
    END IF;
    v_window := interval '1 minute';
  END IF;

  -- One entry per person and file in the window (two tabs opening the same file at once wait for each other here)
  PERFORM pg_advisory_xact_lock(hashtextextended('record_access_log|' || v_user::text || '|' || p_event || '|' || COALESCE(p_patient_id::text, ''), 0));
  IF EXISTS (SELECT 1 FROM public.record_access_log l
              WHERE l.user_id = v_user AND l.event = p_event AND l.patient_id IS NOT DISTINCT FROM p_patient_id
                AND l.occurred_at > now() - v_window) THEN
    RETURN false;
  END IF;

  INSERT INTO public.record_access_log (practice_id, user_id, event, patient_id, screen)
  VALUES (v_practice, v_user, p_event, p_patient_id, v_screen);
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.log_record_access(text, uuid, text) IS
  'Records a patient''s file opened (one entry per person and file per 10 minutes), a sign-in or a sign-out for the signed-in staff member, with the screen. Never values of the file. Returns whether a row was written.';

REVOKE ALL ON FUNCTION public.log_record_access(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_record_access(text, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Who did what shows them: report_user_activity as proposals/2026-10-12-who-did-what.sql left it, plus the last part
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
  UNION ALL
  -- Patient files opened, sign-ins and sign-outs (record_access_log): which file and from which screen, never its values
  SELECT r.occurred_at, 'access', r.event, NULL, NULL, r.patient_id, NULL,
         'record_access_log', NULL, r.screen, NULL, '{}'::jsonb
    FROM public.record_access_log r
   WHERE r.practice_id = p_practice_id AND r.user_id = p_user_id AND r.occurred_at >= v_from AND r.occurred_at < v_to
   ORDER BY 1, 3;
END;
$$;

COMMENT ON FUNCTION public.report_user_activity(uuid, uuid, date, date) IS
  'Who did what: one staff member''s invoices, payments, adjustments, patient-file changes, claims, controls, exports, patient files opened and sign-ins and sign-outs over a period, from the existing trails; never the values of patient records. The practice''s administrators only. Finance > Reports > Who did what.';

-- ---------------------------------------------------------------------------------------------
-- 4. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    DROP POLICY IF EXISTS portal_staff_only ON public.record_access_log;
    CREATE POLICY portal_staff_only ON public.record_access_log AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_report text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.report_user_activity(uuid, uuid, date, date)'::regprocedure);
BEGIN
  IF (SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename IN ('patients', 'users', 'practices'))
     IS DISTINCT FROM current_setting('onehealth.policies_before', true) THEN
    RAISE EXCEPTION 'Check failed: a policy of patients, users or practices changed';
  END IF;
  -- Every trail of the report is still read, the new one too, and the administrators-only rule is still first
  IF position('public.record_access_log r' in v_report) = 0 OR position('public.report_exports x' in v_report) = 0
     OR position('public.invoice_audit_events e' in v_report) = 0 OR position('public.ar_audit_events a' in v_report) = 0
     OR position('public.audit_logs l' in v_report) = 0 OR position('public.daybook_prints dp' in v_report) = 0
     OR position('NOT public.rls_is_staff_admin()' in v_report) = 0 THEN
    RAISE EXCEPTION 'Check failed: report_user_activity lost a trail or its administrators-only rule';
  END IF;
  IF has_function_privilege('anon', 'public.log_record_access(text, uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.report_user_activity(uuid, uuid, date, date)', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.log_record_access(text, uuid, text)'::regprocedure AND a.grantee = 0)
     OR has_table_privilege('anon', 'public.record_access_log', 'SELECT')
     OR has_table_privilege('authenticated', 'public.record_access_log', 'INSERT')
     OR has_table_privilege('authenticated', 'public.record_access_log', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.record_access_log', 'DELETE') THEN
    RAISE EXCEPTION 'Check failed: the access log can be written directly, or read or written by the public key';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

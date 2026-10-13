-- Applied 2026-10-08 as migration eminance_import_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: move a practice over from Eminance (patients, family accounts, medical
-- aid details, opening balances, recall dates and a read-only claim history)
-- File:    proposals/2026-10-07-eminance-import.sql                      Drafted: 2026-10-07
-- Code:    src/utils/import/* (reading the exports, matching, the plan; tested),
--          src/services/import/eminanceImportService.ts (calls the functions below),
--          src/components/import/* (Settings > Move over from Eminance, the patient file's
--          "Eminance account" line and its claim history)
--
-- Not applied. It runs inside a transaction that ends in ROLLBACK, so running it by mistake leaves
-- nothing behind.
--
-- Rehearsed 2026-10-08 on the live database inside one transaction that was rolled back (checked
-- afterwards: no table, column, function, patient or invoice was left). Section 10's checks passed.
-- With invented rows and a simulated admin sign-in (counts only): 20 rows staged and imported in 6
-- calls; 4 new patients (1 with a NOID- placeholder), 1 existing file matched and given its Eminance
-- number, 2 rows left out (no date of birth, a date in the future); 2 medical aid rows with dependant
-- codes 00 and 01, 1 alert, 1 family link; 5 opening balances on 2 accounts (OB-...-C, -30, -60, -90,
-- -180), each in its own age band with the fund and patient parts as staged, N$ 581.72 in all, 5
-- daybook entries, 0 receipts, 2 carrier visits; 2 recall lists with 3 entries; 3 claim lines; the 3
-- rows the wizard had already left out kept their reasons. 0 messages queued for the imported
-- patients (2 for a control patient registered the usual way). Another staff member was refused.
-- The undo was refused once a next of kin was added to an imported patient, and after that was
-- removed it took 8 calls and left 0 patients, invoices, visits, medical aid rows, family links,
-- alerts, lists, claim lines, staged rows and records; the existing file's Eminance number was
-- cleared and the daybook shows 5 deletions (net N$ 0.00).
--
-- Why (parity matrix section 6 item 10, row T2)
--   About 80% of Namibian practices run Eminance. Without a way to bring their patients, families,
--   balances and history over, a practice cannot switch, and staff cannot answer "my Eminance account
--   number is ..." in OneHealth.
--
-- Apply order
--   AFTER the receipts, debtors, patient lists, invoicing and dependant code proposals: it uses
--   dc_link_account_holder, dc_first_open_day, dc_assert_role and dc_set_account_flag, the period lock
--   and daybook triggers on invoices_enhanced, invoice_assign_number's "keep this number" switch,
--   patient_lists and medical_aid_details.dependant_code (section 1 stops if any is missing).
--   BEFORE the patient portal proposal (its staff-only guard then covers these tables too; when the
--   portal is already applied, section 9 adds the same guard to these tables only).
--   It is listed just before proposals/2026-10-07-patient-portal.sql in DEFAULT_ORDER
--   (scripts/db/rehearsal.ts).
--
-- How to apply
--   1. Run the whole file once as it is (Supabase SQL editor or a branch). It must finish without an
--      error; section 10 checks what it created.
--   2. Change the final ROLLBACK to COMMIT and run it again. It writes no rows; it is quick at any
--      hour (it adds one column and one index to patients).
--   3. Nothing to deploy. Settings > "Move over from Eminance" (practice admins) says "not set up
--      yet" until this is applied, and the patient file shows the Eminance account number once the
--      column exists.
--   Undo after a COMMIT: see the end of the file.
--
-- What it adds
--   patients.legacy_account_number  the Eminance account number (e.g. 0001234), searchable and shown
--                                   on the patient file. Only the column and an index: the policies of
--                                   patients belong to the practice-isolation work and are not touched.
--   legacy_import_runs              one row per import: status, the "balances as at" date, counts.
--   legacy_import_rows              the rows the wizard staged (one per person, family link, account
--                                   balance, recall and claim history), with the outcome of each and
--                                   why it was skipped. Personal values are removed from the rows when
--                                   the import finishes, and the rows are deleted when it is undone.
--   legacy_import_records           what the import created (patients, medical aid details, family
--                                   links, alerts, visits, opening balances, list entries), so the undo
--                                   removes exactly that and nothing else.
--   legacy_claim_lines              read-only claim history from Eminance's claim files (History\*.Dat).
--   Functions                       legacy_import_start, legacy_import_stage, legacy_import_continue,
--                                   legacy_import_undo (the app calls these; each checks that the caller
--                                   is an admin of the practice) and their internal steps.
--
-- Decisions
--   * Only practice admins (users.role = 'admin') import and undo (dc_assert_role). Staff of the
--     practice read the runs, rows and claim history (the usual users.practice_id rule). Nobody writes
--     the tables directly; anon gets nothing.
--   * The import works in small steps (legacy_import_continue does the next 40 to 200 rows, by kind,
--     and says what is left), because an API call has 8 seconds. Each row is saved or skipped on its own: one bad row
--     never stops the others, and its reason is kept in plain words.
--   * Opening balances are invoices, so the age analysis, statements, daybook and month-end see them
--     like any other debt: one invoice per age band an account owes in, numbered OB-<account>-<band>
--     (its own series, so INV- numbers stay gapless; a second import of the same account is refused),
--     dated "balances as at" minus the band's start (30, 60 ... 180 days) so it lands in the band
--     Eminance showed. A date in a closed month moves to dc_first_open_day (the first day of the next
--     open month): the closed month is never changed, the debt then looks younger. The invoices go
--     through the existing triggers (period lock, daybook, payment status, numbering); nothing is
--     written around them. The fund and patient parts are the invoice's medical_aid_total and the rest,
--     exactly as receipts allocate against them.
--   * invoices_enhanced.visit_id is required, so each account holder with a balance gets one visit row:
--     cancelled, not scheduled, dated the day of the import and noted "Opening balance brought over
--     from Eminance ... Not a consultation". Cancelled visits are left out of the diary, today's list,
--     recall lists and visit counts. It is removed with the balances on undo.
--   * Credit (Eminance's "unallocated") is set off against the same account's debts in the wizard,
--     oldest first, the way Eminance's own "auto allocate all" is used for conversions. An account whose
--     credit is larger than its debt gets no balance; the wizard lists it so the practice can refund or
--     record it. No receipts are created: a receipt can never be deleted, so the import could no longer
--     be undone.
--   * Imported patients are not new to the practice: the welcome and birthday messages that the
--     database's automation triggers queue for a new patient are deleted in the same transaction
--     (legacy_import_quiet), so no SMS or email is ever sent because of an import.
--   * A person without an ID number gets "NOID-" and 12 random characters: patients.id_number is
--     required and unique across OneHealth. Staff replace it with the real number later.
--   * Undo: allowed while nobody has worked with the imported records (legacy_import_work_done looks
--     at every table that refers to the imported patients, their visits and their opening balances, and
--     at closed months and claim batches). It deletes what the import created (in steps), clears the
--     Eminance number it set on existing files, and deletes the staged rows. The daybook keeps an
--     "invoice raised" and an "invoice deleted" line for each opening balance (it is never changed).
--
-- Money is numeric(14,2) in NAD (the wizard sends whole cents). Dates are Africa/Windhoek dates.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Preconditions: the tables, columns and functions this script relies on
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.patients'), ('public.medical_aid_details'), ('public.medical_aid_providers'), ('public.visits'),
                 ('public.invoices_enhanced'), ('public.account_holder_links'), ('public.account_flags'), ('public.period_closes'),
                 ('public.patient_lists'), ('public.patient_list_members'), ('public.users'), ('public.practices')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %. Apply the receipts, debtors and patient lists proposals first.', v_missing;
  END IF;

  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.ar_today()'), ('public.ar_format_nad(numeric)'), ('public.dc_assert_role(uuid,text[],text)'),
                 ('public.dc_first_open_day(uuid,date)'), ('public.dc_link_account_holder(uuid,uuid,uuid,text)'),
                 ('public.dc_set_account_flag(uuid,uuid,text,jsonb)'), ('public.dc_month_label(date)'), ('public.dc_day_label(date)'),
                 ('public.invoice_assign_number()')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: functions of the receipts, debtors or invoicing proposals are missing: %', v_missing;
  END IF;

  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ') INTO v_missing
    FROM (VALUES
      ('patients', 'practice_id'), ('patients', 'id_number'), ('patients', 'date_of_birth'), ('patients', 'gender'),
      ('medical_aid_details', 'dependant_code'), ('medical_aid_details', 'medical_aid_provider_id'),
      ('invoices_enhanced', 'visit_id'), ('invoices_enhanced', 'medical_aid_total'), ('invoices_enhanced', 'patient_total'),
      ('invoices_enhanced', 'created_by'), ('visits', 'visit_subtype'), ('visits', 'is_cancelled'), ('users', 'role')
    ) AS t(table_name, column_name)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these columns are missing: %. Adjust this script before applying it.', v_missing;
  END IF;

  -- Opening balances keep their own OB- numbers; without the switch they would take INV- numbers and
  -- leave gaps in the practice's invoice numbers when an import is undone
  IF pg_get_functiondef('public.invoice_assign_number()'::regprocedure) !~ 'keep_invoice_number' THEN
    RAISE EXCEPTION 'Stopped: invoice_assign_number() no longer honours hpms.keep_invoice_number (proposals/2026-10-07-invoicing.sql)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. The Eminance account number on the patient file
--    Only the column and an index: the policies of patients are not touched.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS legacy_account_number text;
COMMENT ON COLUMN public.patients.legacy_account_number IS
  'The patient''s account number in the practice''s previous system (Eminance), e.g. 0001234: staff search by it and patients quote it. Set by the Eminance import (proposals/2026-10-07-eminance-import.sql).';
CREATE INDEX IF NOT EXISTS patients_legacy_account_number_idx
  ON public.patients (practice_id, legacy_account_number) WHERE legacy_account_number IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legacy_import_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  source          text NOT NULL DEFAULT 'eminance' CHECK (source = 'eminance'),
  status          text NOT NULL DEFAULT 'staging' CHECK (status IN ('staging', 'importing', 'imported', 'undoing', 'undone')),
  -- The day the age analysis was run in Eminance: opening balances are dated back from it
  balances_as_of  date,
  -- What staff chose in the wizard (file names and types, portions): no patient data
  options         jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(options) = 'object'),
  -- The counts at the end of the import (kept after an undo, when the rows are gone)
  summary         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  imported_at     timestamptz,
  undo_started_at timestamptz,
  undone_at       timestamptz,
  undone_by       uuid,
  undo_reason     text
);
CREATE INDEX IF NOT EXISTS legacy_import_runs_practice_idx ON public.legacy_import_runs (practice_id, created_at DESC);
-- One import or undo at a time per practice
CREATE UNIQUE INDEX IF NOT EXISTS legacy_import_runs_one_active
  ON public.legacy_import_runs (practice_id) WHERE status IN ('staging', 'importing', 'undoing');
COMMENT ON TABLE public.legacy_import_runs IS
  'Imports from Eminance (Settings > Move over from Eminance). staging -> importing -> imported; undoing -> undone.';

CREATE TABLE IF NOT EXISTS public.legacy_import_rows (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id         uuid NOT NULL REFERENCES public.legacy_import_runs(id) ON DELETE CASCADE,
  practice_id    uuid NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('patient', 'family', 'balance', 'recall', 'claim_line')),
  -- The wizard's key for the row: family, balance, recall and claim rows name their patient by it
  row_key        text NOT NULL CHECK (char_length(row_key) BETWEEN 1 AND 80),
  -- Where the row came from in the uploaded file (for the result screen)
  file_line      integer,
  account_number text CHECK (account_number IS NULL OR char_length(account_number) <= 20),
  -- What the result screen shows, e.g. the person's name or "Account 0001234"
  label          text NOT NULL DEFAULT '' CHECK (char_length(label) <= 200),
  -- The cleaned values (removed when the import finishes)
  payload        jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'matched', 'skipped')),
  reason         text,
  patient_id     uuid,
  processed_at   timestamptz,
  CONSTRAINT legacy_import_rows_key UNIQUE (run_id, row_key)
);
CREATE INDEX IF NOT EXISTS legacy_import_rows_step_idx ON public.legacy_import_rows (run_id, kind, status, id);
COMMENT ON TABLE public.legacy_import_rows IS
  'Rows staged by the Eminance import wizard with their outcome: created, matched (an existing file or list was used) or skipped (reason). Payloads are emptied when the import finishes; the rows are deleted on undo.';

CREATE TABLE IF NOT EXISTS public.legacy_import_records (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id      uuid NOT NULL REFERENCES public.legacy_import_runs(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('patient', 'medical_aid', 'family_link', 'alert', 'visit', 'invoice', 'list', 'list_member', 'legacy_number')),
  record_id   uuid NOT NULL,
  patient_id  uuid,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS legacy_import_records_run_idx ON public.legacy_import_records (run_id, kind, id);
CREATE INDEX IF NOT EXISTS legacy_import_records_record_idx ON public.legacy_import_records (record_id);
COMMENT ON TABLE public.legacy_import_records IS
  'Everything an Eminance import created (or changed: legacy_number), so its undo removes exactly that. Internal: written and read only by the import functions.';

CREATE TABLE IF NOT EXISTS public.legacy_claim_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id    uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  run_id         uuid NOT NULL REFERENCES public.legacy_import_runs(id) ON DELETE CASCADE,
  service_date   date NOT NULL,
  tariff_code    text NOT NULL CHECK (char_length(tariff_code) BETWEEN 1 AND 10),
  description    text,
  tooth          text,
  diagnosis      text,
  quantity       numeric(8,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount         numeric(14,2) NOT NULL,
  fund_code      text,
  invoice_number text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legacy_claim_lines_patient_idx ON public.legacy_claim_lines (patient_id, service_date DESC);
CREATE INDEX IF NOT EXISTS legacy_claim_lines_run_idx ON public.legacy_claim_lines (run_id);
COMMENT ON TABLE public.legacy_claim_lines IS
  'Read-only claim history brought over from Eminance''s claim files (medical aid claim lines only; Eminance exports no history of private invoices). Shown on the patient file.';

-- ---------------------------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.legacy_import_assert_admin(p_practice_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dc_assert_role(p_practice_id, ARRAY['admin'], 'move patients over from Eminance');
END $$;

-- A text value from a payload: trimmed, cut to p_max characters, NULL when empty
CREATE OR REPLACE FUNCTION public.legacy_import_text(p_payload jsonb, p_key text, p_max integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(left(btrim(COALESCE(p_payload ->> p_key, '')), p_max), '')
$$;

-- Days from the start of an age band (the same bands as AGE_BANDS in src/services/ledger/receivables.ts)
CREATE OR REPLACE FUNCTION public.legacy_import_band_days(p_band text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_band WHEN 'current' THEN 0 WHEN 'days_30' THEN 30 WHEN 'days_60' THEN 60 WHEN 'days_90' THEN 90
                     WHEN 'days_120' THEN 120 WHEN 'days_150' THEN 150 WHEN 'days_180_plus' THEN 180 END
$$;

CREATE OR REPLACE FUNCTION public.legacy_import_band_label(p_band text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_band WHEN 'current' THEN 'current' WHEN 'days_180_plus' THEN '180+ days'
                     ELSE legacy_import_band_days(p_band)::text || ' days' END
$$;

-- What the result screen and the undo message call a table
CREATE OR REPLACE FUNCTION public.legacy_import_table_label(p_table text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_table
    WHEN 'visits' THEN 'visits or bookings' WHEN 'invoices_enhanced' THEN 'invoices' WHEN 'invoice_services' THEN 'invoice lines'
    WHEN 'receipts' THEN 'payments' WHEN 'receipt_allocations' THEN 'payments' WHEN 'invoice_adjustments' THEN 'credit notes, write-offs or corrections'
    WHEN 'practice_sms_logs' THEN 'SMS messages' WHEN 'practice_email_logs' THEN 'emails' WHEN 'practice_sms_replies' THEN 'SMS replies'
    WHEN 'patient_documents' THEN 'documents' WHEN 'medical_aid_details' THEN 'medical aid details' WHEN 'next_of_kin' THEN 'next of kin'
    WHEN 'patient_list_members' THEN 'patient list entries' WHEN 'account_flags' THEN 'account flags or alerts'
    WHEN 'account_holder_links' THEN 'family account changes' WHEN 'batch_details' THEN 'claim lines' WHEN 'vitals' THEN 'vitals'
    WHEN 'lab_requests' THEN 'lab requests' WHEN 'medications' THEN 'prescriptions' WHEN 'patient_allergies' THEN 'allergies'
    WHEN 'credit_control_notes' THEN 'credit control notes' WHEN 'payment_promises' THEN 'promises to pay' WHEN 'quotes' THEN 'quotes'
    ELSE replace(p_table, '_', ' ')
  END
$$;

-- The row a family, balance, recall or claim row names by its key, with the patient it became
CREATE OR REPLACE FUNCTION public.legacy_import_patient_of(p_run_id uuid, p_key text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.patient_id FROM legacy_import_rows r
   WHERE r.run_id = p_run_id AND r.row_key = p_key AND r.kind = 'patient' AND r.status IN ('created', 'matched')
$$;

/*
  Imported patients are not new to the practice. The database's automation triggers queue a welcome
  (and, on their birthday, a birthday) message for every new patient, and may queue messages for new
  visits and invoices. This removes what was queued for the records an import step created, in the
  same transaction, so nothing can be sent. Tables that do not exist are skipped; any other error stops
  the step (nothing is kept), which is safer than sending.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_quiet(p_practice_id uuid, p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids   text[] := ARRAY(SELECT unnest(COALESCE(p_ids, '{}'::uuid[]))::text);
  v_total integer := 0;
  v_rows  integer;
BEGIN
  IF cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;
  IF to_regclass('public.automation_executions') IS NOT NULL THEN
    IF to_regclass('public.automation_notifications') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.automation_notifications WHERE execution_id IN (SELECT e.id FROM public.automation_executions e
                WHERE e.related_record_id = ANY ($1) OR e.patient_id = ANY ($1) OR e.visit_id = ANY ($1) OR e.invoice_id = ANY ($1))'
        USING p_ids;
    END IF;
    IF to_regclass('public.automation_queue') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.automation_queue WHERE execution_id IN (SELECT e.id FROM public.automation_executions e
                WHERE e.related_record_id = ANY ($1) OR e.patient_id = ANY ($1) OR e.visit_id = ANY ($1) OR e.invoice_id = ANY ($1))'
        USING p_ids;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_total := v_total + v_rows;
    END IF;
    EXECUTE 'DELETE FROM public.automation_executions
              WHERE related_record_id = ANY ($1) OR patient_id = ANY ($1) OR visit_id = ANY ($1) OR invoice_id = ANY ($1)'
      USING p_ids;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END IF;
  IF to_regclass('public.automation_queue') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.automation_queue
              WHERE practice_id = $1
                AND (payload ->> ''patient_id'' = ANY ($2) OR trigger_data ->> ''patient_id'' = ANY ($2)
                     OR payload ->> ''visit_id'' = ANY ($2) OR trigger_data ->> ''visit_id'' = ANY ($2)
                     OR payload ->> ''invoice_id'' = ANY ($2) OR trigger_data ->> ''invoice_id'' = ANY ($2))'
      USING p_practice_id, v_ids;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END IF;
  IF to_regclass('public.notification_queue') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notification_queue WHERE record_id = ANY ($1)' USING p_ids;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END IF;
  IF to_regclass('public.follow_up_automation_queue') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.follow_up_automation_queue WHERE visit_id = ANY ($1)' USING p_ids;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END IF;
  RETURN v_total;
END $$;

-- Rows per kind and outcome, for the progress bar and the result screen
CREATE OR REPLACE FUNCTION public.legacy_import_progress(p_run_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'run_id', r.id,
    'status', r.status,
    'balances_as_of', r.balances_as_of,
    'done', r.status IN ('imported', 'undone'),
    'counts', COALESCE((
      SELECT jsonb_object_agg(k.kind, k.counts) FROM (
        SELECT x.kind, jsonb_build_object(
                 'pending', count(*) FILTER (WHERE x.status = 'pending'),
                 'created', count(*) FILTER (WHERE x.status = 'created'),
                 'matched', count(*) FILTER (WHERE x.status = 'matched'),
                 'skipped', count(*) FILTER (WHERE x.status = 'skipped')) AS counts
          FROM legacy_import_rows x WHERE x.run_id = r.id GROUP BY x.kind
      ) k), r.summary -> 'counts', '{}'::jsonb),
    'opening_balance_cents', COALESCE((
      SELECT sum((d.details ->> 'total_cents')::bigint) FROM legacy_import_records d
       WHERE d.run_id = r.id AND d.kind = 'invoice'), (r.summary ->> 'opening_balance_cents')::bigint, 0),
    'claim_lines', COALESCE((SELECT count(*) FROM legacy_claim_lines c WHERE c.run_id = r.id), 0),
    'undo_left', (SELECT count(*) FROM legacy_import_records d WHERE d.run_id = r.id)
           + (SELECT count(*) FROM legacy_claim_lines c WHERE c.run_id = r.id)
  )
  FROM legacy_import_runs r WHERE r.id = p_run_id
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Starting an import and staging the wizard's rows
-- ---------------------------------------------------------------------------------------------

/*
  legacy_import_start(practice, { "balances_as_of": "2026-10-07"?, "files": [{ "name", "kind", "rows", "portion"? }] })
  An earlier wizard that never started importing is discarded (it created nothing).
*/
CREATE OR REPLACE FUNCTION public.legacy_import_start(p_practice_id uuid, p_options jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_as_of date;
  v_id    uuid;
BEGIN
  PERFORM legacy_import_assert_admin(p_practice_id);
  IF p_options IS NULL OR jsonb_typeof(p_options) <> 'object' THEN
    RAISE EXCEPTION 'The import settings are missing';
  END IF;
  BEGIN
    v_as_of := NULLIF(p_options ->> 'balances_as_of', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'The "balances as at" date is not a date';
  END;
  IF v_as_of > ar_today() THEN
    RAISE EXCEPTION 'The "balances as at" date cannot be in the future';
  END IF;
  IF v_as_of < ar_today() - 366 THEN
    RAISE EXCEPTION 'The balances are more than a year old: run the age analysis in Eminance again and export it';
  END IF;

  DELETE FROM legacy_import_runs WHERE practice_id = p_practice_id AND status = 'staging';
  IF EXISTS (SELECT 1 FROM legacy_import_runs WHERE practice_id = p_practice_id AND status IN ('importing', 'undoing')) THEN
    RAISE EXCEPTION 'Another import from Eminance is not finished yet. Finish or undo it first (Settings > Move over from Eminance).';
  END IF;

  INSERT INTO legacy_import_runs (practice_id, balances_as_of, options)
  VALUES (p_practice_id, v_as_of, p_options - 'rows')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

/*
  legacy_import_stage(run, [{ "kind", "key", "line"?, "account_number"?, "label", "payload": {...} }, ...])
  At most 500 rows a call; only while the run is being staged. Returns the number of rows added.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_stage(p_run_id uuid, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run   legacy_import_runs%ROWTYPE;
  v_count integer;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This import was not found';
  END IF;
  PERFORM legacy_import_assert_admin(v_run.practice_id);
  IF v_run.status <> 'staging' THEN
    RAISE EXCEPTION 'Rows can only be added before the import starts';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN 0;
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'Send at most 500 rows at a time';
  END IF;
  IF (SELECT count(*) FROM legacy_import_rows WHERE run_id = p_run_id) + jsonb_array_length(p_rows) > 100000 THEN
    RAISE EXCEPTION 'An import can hold at most 100 000 rows';
  END IF;

  INSERT INTO legacy_import_rows (run_id, practice_id, kind, row_key, file_line, account_number, label, payload)
  SELECT p_run_id, v_run.practice_id, e ->> 'kind', e ->> 'key', NULLIF(e ->> 'line', '')::integer,
         NULLIF(left(btrim(COALESCE(e ->> 'account_number', '')), 20), ''), left(COALESCE(e ->> 'label', ''), 200),
         CASE WHEN jsonb_typeof(e -> 'payload') = 'object' THEN e -> 'payload' ELSE '{}'::jsonb END
    FROM jsonb_array_elements(p_rows) e;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. The import steps (internal; legacy_import_continue calls them in this order)
--    A balance, recall or claim row the wizard already knows cannot be brought over has the payload
--    { "skip_reason": "..." } instead: it is kept, skipped, so the result screen can say why.
-- ---------------------------------------------------------------------------------------------

/*
  6a. People. payload: { "decision": "new" | "existing" | "skip", "reason"?, "existing_patient_id"?,
      "first_name", "last_name", "id_number"? (null: a NOID- placeholder), "date_of_birth", "gender",
      "cell_number"?, "email"?, "home_language"?, "occupation"?, "employer"?, "home_address"?,
      "postal_address"?, "postal_code"?, "alert"?,
      "medical_aid"?: { "provider_id", "option"?, "membership_number"?, "main_member_name"?,
                        "main_member_id_number"?, "relationship", "dependant_code"? } }
  An existing file only gets the Eminance number when it has none.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_people(p_run_id uuid, p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run      legacy_import_runs%ROWTYPE;
  r          legacy_import_rows%ROWTYPE;
  p          jsonb;
  m          jsonb;
  v_existing record;
  v_patient  uuid;
  v_id       text;
  v_dob      date;
  v_gender   text;
  v_language text;
  v_provider record;
  v_detail   uuid;
  v_flag     jsonb;
  v_notes    text[];
  v_created  uuid[] := '{}';
  v_count    integer := 0;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id;
  FOR r IN
    SELECT * FROM legacy_import_rows WHERE run_id = p_run_id AND kind = 'patient' AND status = 'pending' ORDER BY id LIMIT p_limit
  LOOP
    v_count := v_count + 1;
    p := r.payload;

    IF p ->> 'decision' = 'existing' THEN
      SELECT id, legacy_account_number INTO v_existing FROM patients
       WHERE id = CASE WHEN p ->> 'existing_patient_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                       THEN (p ->> 'existing_patient_id')::uuid END
         AND practice_id = v_run.practice_id;
      IF NOT FOUND THEN
        UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(),
               reason = 'The OneHealth file it matched is no longer there' WHERE id = r.id;
        CONTINUE;
      END IF;
      IF v_existing.legacy_account_number IS NULL AND r.account_number IS NOT NULL THEN
        UPDATE patients SET legacy_account_number = r.account_number WHERE id = v_existing.id;
        INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id, details)
        VALUES (p_run_id, 'legacy_number', v_existing.id, v_existing.id, jsonb_build_object('value', r.account_number));
      END IF;
      UPDATE legacy_import_rows SET status = 'matched', patient_id = v_existing.id, processed_at = now(),
             reason = CASE WHEN v_existing.legacy_account_number IS NOT NULL AND v_existing.legacy_account_number IS DISTINCT FROM r.account_number
                           THEN 'Already in OneHealth; the file keeps its Eminance number ' || v_existing.legacy_account_number
                           ELSE 'Already in OneHealth: the existing file is used' END
       WHERE id = r.id;
      CONTINUE;
    END IF;

    IF p ->> 'decision' IS DISTINCT FROM 'new' THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(),
             reason = COALESCE(legacy_import_text(p, 'reason', 300), 'Not brought over') WHERE id = r.id;
      CONTINUE;
    END IF;

    v_notes := '{}';
    BEGIN
      IF legacy_import_text(p, 'first_name', 100) IS NULL OR legacy_import_text(p, 'last_name', 100) IS NULL THEN
        RAISE EXCEPTION 'The first name or surname is missing';
      END IF;
      BEGIN
        v_dob := (p ->> 'date_of_birth')::date;
      EXCEPTION WHEN others THEN
        v_dob := NULL;
      END;
      IF v_dob IS NULL OR v_dob > ar_today() OR v_dob < DATE '1900-01-01' THEN
        RAISE EXCEPTION 'The date of birth is missing or not a real date';
      END IF;
      v_gender := lower(COALESCE(p ->> 'gender', ''));
      IF v_gender NOT IN ('male', 'female', 'other') THEN
        RAISE EXCEPTION 'The sex is missing';
      END IF;
      v_language := legacy_import_text(p, 'home_language', 20);
      IF v_language NOT IN ('English', 'Afrikaans', 'Oshiwambo', 'Other') THEN
        v_language := NULL;
      END IF;

      v_id := upper(regexp_replace(COALESCE(p ->> 'id_number', ''), '[\s/.-]', '', 'g'));
      IF v_id = '' THEN
        -- id_number is required and unique across OneHealth: a placeholder staff replace later
        v_id := 'NOID-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
      ELSIF char_length(v_id) > 20 OR v_id !~ '^[A-Z0-9]+$' THEN
        RAISE EXCEPTION 'The ID number % is not a valid ID or passport number', v_id;
      ELSIF EXISTS (SELECT 1 FROM patients WHERE id_number = v_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'unique_violation', MESSAGE = 'id_number';
      END IF;

      INSERT INTO patients (first_name, last_name, id_number, date_of_birth, gender, cell_number, email, home_language,
                            occupation, employer, home_address, postal_address, postal_code, practice_id, legacy_account_number)
      VALUES (legacy_import_text(p, 'first_name', 100), legacy_import_text(p, 'last_name', 100), v_id, v_dob, v_gender,
              legacy_import_text(p, 'cell_number', 40), legacy_import_text(p, 'email', 200), v_language,
              legacy_import_text(p, 'occupation', 100), legacy_import_text(p, 'employer', 150),
              legacy_import_text(p, 'home_address', 300), legacy_import_text(p, 'postal_address', 300),
              legacy_import_text(p, 'postal_code', 20), v_run.practice_id, r.account_number)
      RETURNING id INTO v_patient;
      INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id) VALUES (p_run_id, 'patient', v_patient, v_patient);

      m := p -> 'medical_aid';
      IF jsonb_typeof(m) = 'object' THEN
        SELECT id, name INTO v_provider FROM medical_aid_providers WHERE id = NULLIF(m ->> 'provider_id', '')::uuid;
        IF FOUND THEN
          INSERT INTO medical_aid_details (patient_id, provider, scheme, plan_type, medical_aid_provider_id, membership_number,
                                           main_member_name, main_member_id_number, relationship_to_main, dependant_code)
          VALUES (v_patient, v_provider.name,
                  COALESCE(legacy_import_text(m, 'option', 100), v_provider.name),
                  COALESCE(legacy_import_text(m, 'option', 100), v_provider.name),
                  v_provider.id,
                  COALESCE(legacy_import_text(m, 'membership_number', 30), ''),
                  COALESCE(legacy_import_text(m, 'main_member_name', 100), ''),
                  COALESCE(legacy_import_text(m, 'main_member_id_number', 20), ''),
                  COALESCE(legacy_import_text(m, 'relationship', 20), 'self'),
                  CASE WHEN COALESCE(m ->> 'dependant_code', '') ~ '^[0-9]{1,3}$' THEN m ->> 'dependant_code' END)
          RETURNING id INTO v_detail;
          INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id) VALUES (p_run_id, 'medical_aid', v_detail, v_patient);
        ELSE
          v_notes := v_notes || 'the medical aid fund chosen for it was not found, so no medical aid details were added'::text;
        END IF;
      END IF;

      IF char_length(COALESCE(legacy_import_text(p, 'alert', 280), '')) >= 3 THEN
        v_flag := dc_set_account_flag(v_run.practice_id, v_patient, 'alert', jsonb_build_object('value', legacy_import_text(p, 'alert', 280)));
        INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id) VALUES (p_run_id, 'alert', (v_flag ->> 'id')::uuid, v_patient);
      END IF;

      IF v_id LIKE 'NOID-%' THEN
        v_notes := array_prepend('No ID number in Eminance: add it to the file'::text, v_notes);
      END IF;
      UPDATE legacy_import_rows SET status = 'created', patient_id = v_patient, processed_at = now(),
             reason = NULLIF(array_to_string(v_notes, '; '), '')
       WHERE id = r.id;
      v_created := v_created || v_patient;
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(),
               reason = 'Its ID number is already on a OneHealth file (possibly at another practice). Check the patient list.' WHERE id = r.id;
      WHEN others THEN
        UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), reason = left(SQLERRM, 300) WHERE id = r.id;
    END;
  END LOOP;
  PERFORM legacy_import_quiet(v_run.practice_id, v_created);
  RETURN v_count;
END $$;

/*
  6b. Family accounts: payload { "patient_key", "holder_key", "relationship": "spouse" | "child" | "dependant" | "other" }
  Through dc_link_account_holder (the debtors proposal's rules). Two people who were both already in
  OneHealth keep the family account they have.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_families(p_run_id uuid, p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run      legacy_import_runs%ROWTYPE;
  r          legacy_import_rows%ROWTYPE;
  v_patient  uuid;
  v_holder   uuid;
  v_both_old boolean;
  v_link     jsonb;
  v_rel      text;
  v_count    integer := 0;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id;
  FOR r IN
    SELECT * FROM legacy_import_rows WHERE run_id = p_run_id AND kind = 'family' AND status = 'pending' ORDER BY id LIMIT p_limit
  LOOP
    v_count := v_count + 1;
    v_patient := legacy_import_patient_of(p_run_id, r.payload ->> 'patient_key');
    v_holder := legacy_import_patient_of(p_run_id, r.payload ->> 'holder_key');
    IF v_patient IS NULL OR v_holder IS NULL THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(),
             reason = 'The patient or the main member was not brought over' WHERE id = r.id;
      CONTINUE;
    END IF;
    SELECT bool_and(x.status = 'matched') INTO v_both_old FROM legacy_import_rows x
     WHERE x.run_id = p_run_id AND x.kind = 'patient' AND x.row_key IN (r.payload ->> 'patient_key', r.payload ->> 'holder_key');
    IF v_both_old THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), patient_id = v_patient,
             reason = 'Both were already in OneHealth: their family account is left as it is' WHERE id = r.id;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM account_holder_links WHERE practice_id = v_run.practice_id AND patient_id = v_patient AND unlinked_at IS NULL) THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), patient_id = v_patient,
             reason = 'Already on a family account in OneHealth' WHERE id = r.id;
      CONTINUE;
    END IF;
    v_rel := CASE WHEN r.payload ->> 'relationship' IN ('spouse', 'child', 'dependant', 'other') THEN r.payload ->> 'relationship' ELSE 'dependant' END;
    BEGIN
      v_link := dc_link_account_holder(v_run.practice_id, v_patient, v_holder, v_rel);
      INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id, details)
      VALUES (p_run_id, 'family_link', (v_link ->> 'id')::uuid, v_patient, jsonb_build_object('holder_patient_id', v_holder));
      UPDATE legacy_import_rows SET status = 'created', patient_id = v_patient, processed_at = now() WHERE id = r.id;
    EXCEPTION WHEN others THEN
      UPDATE legacy_import_rows SET status = 'skipped', patient_id = v_patient, processed_at = now(),
             reason = left('Not added to the family account: ' || SQLERRM, 300) WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_count;
END $$;

/*
  6c. Opening balances: payload { "holder_key", "bands": [{ "band": "current" | "days_30" | ... | "days_180_plus",
      "patient_cents": 0, "medical_aid_cents": 0 }] }
  One invoice per band with money, on the account holder, through the normal invoice triggers.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_balances(p_run_id uuid, p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run      legacy_import_runs%ROWTYPE;
  r          legacy_import_rows%ROWTYPE;
  b          jsonb;
  v_holder   uuid;
  v_visit    uuid;
  v_invoice  uuid;
  v_band     text;
  v_patient_cents bigint;
  v_fund_cents    bigint;
  v_total_cents   bigint;
  v_sum_cents     bigint;
  v_wanted   date;
  v_date     date;
  v_number   text;
  v_moved    text[];
  v_made     uuid[] := '{}';
  v_count    integer := 0;
  v_invoices integer;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id;
  FOR r IN
    SELECT * FROM legacy_import_rows WHERE run_id = p_run_id AND kind = 'balance' AND status = 'pending' ORDER BY id LIMIT p_limit
  LOOP
    v_count := v_count + 1;
    IF r.payload ? 'skip_reason' THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), reason = legacy_import_text(r.payload, 'skip_reason', 300) WHERE id = r.id;
      CONTINUE;
    END IF;
    v_holder := legacy_import_patient_of(p_run_id, r.payload ->> 'holder_key');
    IF v_holder IS NULL THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(),
             reason = 'The main member of this account was not brought over, so its balance was not either' WHERE id = r.id;
      CONTINUE;
    END IF;
    IF r.account_number IS NULL OR v_run.balances_as_of IS NULL THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), patient_id = v_holder,
             reason = 'The account number or the "balances as at" date is missing' WHERE id = r.id;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM invoices_enhanced
                WHERE practice_id = v_run.practice_id
                  AND invoice_number = ANY (ARRAY(SELECT 'OB-' || r.account_number || '-' || s
                                                    FROM unnest(ARRAY['C', '30', '60', '90', '120', '150', '180']) s))) THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), patient_id = v_holder,
             reason = 'This account''s balance was already brought over in an earlier import' WHERE id = r.id;
      CONTINUE;
    END IF;

    v_moved := '{}';
    v_sum_cents := 0;
    v_invoices := 0;
    BEGIN
      -- One carrier visit per account holder, made with the first invoice: invoices_enhanced.visit_id is required
      SELECT record_id INTO v_visit FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'visit' AND patient_id = v_holder LIMIT 1;

      PERFORM set_config('hpms.keep_invoice_number', 'on', true);
      FOR b IN SELECT * FROM jsonb_array_elements(COALESCE(r.payload -> 'bands', '[]'::jsonb)) LOOP
        v_band := b ->> 'band';
        IF legacy_import_band_days(v_band) IS NULL THEN
          RAISE EXCEPTION 'Unknown age band %', v_band;
        END IF;
        v_patient_cents := COALESCE((b ->> 'patient_cents')::bigint, 0);
        v_fund_cents := COALESCE((b ->> 'medical_aid_cents')::bigint, 0);
        IF v_patient_cents < 0 OR v_fund_cents < 0 THEN
          RAISE EXCEPTION 'A balance cannot be negative (credit is set off in the wizard)';
        END IF;
        v_total_cents := v_patient_cents + v_fund_cents;
        CONTINUE WHEN v_total_cents = 0;

        v_wanted := v_run.balances_as_of - legacy_import_band_days(v_band);
        v_date := dc_first_open_day(v_run.practice_id, v_wanted);
        IF v_date > ar_today() THEN
          RAISE EXCEPTION 'Every month up to today is closed, so no balance can be dated';
        END IF;
        IF v_date <> v_wanted THEN
          v_moved := v_moved || (legacy_import_band_label(v_band) || ' dated ' || dc_day_label(v_date) || ' because '
                                 || dc_month_label(v_wanted) || ' is closed');
        END IF;
        v_number := 'OB-' || r.account_number || '-' || CASE v_band WHEN 'current' THEN 'C' ELSE legacy_import_band_days(v_band)::text END;

        IF v_visit IS NULL THEN
          INSERT INTO visits (patient_id, practice_id, visit_date, visit_type, status, is_cancelled, is_scheduled, visit_subtype,
                              automation_source, notes)
          VALUES (v_holder, v_run.practice_id, ar_today(), 'consultation', 'cancelled', true, false, 'eminance_opening_balance', 'system',
                  'Opening balance brought over from Eminance (account ' || r.account_number || ') on ' || dc_day_label(ar_today())
                  || '. Not a consultation.')
          RETURNING id INTO v_visit;
          INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id) VALUES (p_run_id, 'visit', v_visit, v_holder);
          v_made := v_made || v_visit;
        END IF;

        INSERT INTO invoices_enhanced (invoice_number, patient_id, visit_id, practice_id, issue_date, due_date, subtotal, tax, total,
                                       medical_aid_total, patient_total, payment_status, notes, created_by)
        VALUES (v_number, v_holder, v_visit, v_run.practice_id, v_date, v_date, v_total_cents / 100.0, 0, v_total_cents / 100.0,
                v_fund_cents / 100.0, v_patient_cents / 100.0, CASE WHEN v_date < ar_today() THEN 'overdue' ELSE 'pending' END,
                'Opening balance brought over from Eminance (account ' || r.account_number || ', ' || legacy_import_band_label(v_band)
                || ' on ' || dc_day_label(v_run.balances_as_of) || ')', auth.uid())
        RETURNING id INTO v_invoice;
        INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id, details)
        VALUES (p_run_id, 'invoice', v_invoice, v_holder,
                jsonb_build_object('band', v_band, 'issue_date', v_date, 'total_cents', v_total_cents, 'medical_aid_cents', v_fund_cents));
        v_made := v_made || v_invoice;
        v_sum_cents := v_sum_cents + v_total_cents;
        v_invoices := v_invoices + 1;
      END LOOP;
      PERFORM set_config('hpms.keep_invoice_number', 'off', true);

      UPDATE legacy_import_rows SET status = CASE WHEN v_invoices > 0 THEN 'created' ELSE 'skipped' END, patient_id = v_holder, processed_at = now(),
             reason = CASE WHEN v_invoices = 0 THEN 'Nothing owed on this account'
                           ELSE ar_format_nad(v_sum_cents / 100.0) || ' in ' || v_invoices || CASE WHEN v_invoices = 1 THEN ' balance' ELSE ' balances' END
                                || CASE WHEN cardinality(v_moved) > 0 THEN '; ' || array_to_string(v_moved, '; ') ELSE '' END END
       WHERE id = r.id;
    EXCEPTION WHEN others THEN
      PERFORM set_config('hpms.keep_invoice_number', 'off', true);
      UPDATE legacy_import_rows SET status = 'skipped', patient_id = v_holder, processed_at = now(),
             reason = left('Balance not brought over: ' || SQLERRM, 300) WHERE id = r.id;
    END;
  END LOOP;
  PERFORM legacy_import_quiet(v_run.practice_id, v_made);
  RETURN v_count;
END $$;

/*
  6d. Recall dates: payload { "patient_key", "due_date", "reason"?, "list_name", "list_description"? }
  The patient goes on the practice's manual patient list of that month (the wizard names it, e.g.
  "Eminance recalls: Nov 2026"), where staff can see and message them.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_recalls(p_run_id uuid, p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run     legacy_import_runs%ROWTYPE;
  r         legacy_import_rows%ROWTYPE;
  v_patient uuid;
  v_name    text;
  v_list    record;
  v_list_id uuid;
  v_member  uuid;
  v_count   integer := 0;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id;
  FOR r IN
    SELECT * FROM legacy_import_rows WHERE run_id = p_run_id AND kind = 'recall' AND status = 'pending' ORDER BY id LIMIT p_limit
  LOOP
    v_count := v_count + 1;
    IF r.payload ? 'skip_reason' THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), reason = legacy_import_text(r.payload, 'skip_reason', 300) WHERE id = r.id;
      CONTINUE;
    END IF;
    v_patient := legacy_import_patient_of(p_run_id, r.payload ->> 'patient_key');
    v_name := legacy_import_text(r.payload, 'list_name', 80);
    IF v_patient IS NULL OR v_name IS NULL THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(),
             reason = CASE WHEN v_patient IS NULL THEN 'The patient was not brought over' ELSE 'The list name is missing' END
       WHERE id = r.id;
      CONTINUE;
    END IF;
    BEGIN
      SELECT id, kind INTO v_list FROM patient_lists
       WHERE practice_id = v_run.practice_id AND lower(btrim(name)) = lower(btrim(v_name));
      IF NOT FOUND THEN
        INSERT INTO patient_lists (practice_id, name, description, kind)
        VALUES (v_run.practice_id, v_name, legacy_import_text(r.payload, 'list_description', 300), 'manual')
        RETURNING id INTO v_list_id;
        INSERT INTO legacy_import_records (run_id, kind, record_id) VALUES (p_run_id, 'list', v_list_id);
      ELSIF v_list.kind <> 'manual' THEN
        RAISE EXCEPTION 'A smart list is already called "%"', v_name;
      ELSE
        v_list_id := v_list.id;
      END IF;
      v_member := NULL;
      INSERT INTO patient_list_members (list_id, practice_id, patient_id, source)
      VALUES (v_list_id, v_run.practice_id, v_patient, 'manual')
      ON CONFLICT (list_id, patient_id) DO NOTHING
      RETURNING id INTO v_member;
      IF v_member IS NOT NULL THEN
        INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id) VALUES (p_run_id, 'list_member', v_member, v_patient);
      END IF;
      UPDATE legacy_import_rows SET status = CASE WHEN v_member IS NULL THEN 'matched' ELSE 'created' END, patient_id = v_patient,
             processed_at = now(),
             reason = CASE WHEN v_member IS NULL THEN 'Already on "' || v_name || '"' ELSE 'On "' || v_name || '"' END
       WHERE id = r.id;
    EXCEPTION WHEN others THEN
      UPDATE legacy_import_rows SET status = 'skipped', patient_id = v_patient, processed_at = now(), reason = left(SQLERRM, 300) WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_count;
END $$;

/*
  6e. Claim history: payload { "patient_key", "lines": [{ "service_date", "tariff_code", "description"?, "tooth"?,
      "diagnosis"?, "quantity"?, "amount_cents", "fund_code"?, "invoice_number"? }] }
*/
CREATE OR REPLACE FUNCTION public.legacy_import_claims(p_run_id uuid, p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run     legacy_import_runs%ROWTYPE;
  r         legacy_import_rows%ROWTYPE;
  v_patient uuid;
  v_lines   integer;
  v_count   integer := 0;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id;
  FOR r IN
    SELECT * FROM legacy_import_rows WHERE run_id = p_run_id AND kind = 'claim_line' AND status = 'pending' ORDER BY id LIMIT p_limit
  LOOP
    v_count := v_count + 1;
    IF r.payload ? 'skip_reason' THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), reason = legacy_import_text(r.payload, 'skip_reason', 300) WHERE id = r.id;
      CONTINUE;
    END IF;
    v_patient := legacy_import_patient_of(p_run_id, r.payload ->> 'patient_key');
    IF v_patient IS NULL THEN
      UPDATE legacy_import_rows SET status = 'skipped', processed_at = now(), reason = 'The patient was not brought over' WHERE id = r.id;
      CONTINUE;
    END IF;
    BEGIN
      INSERT INTO legacy_claim_lines (practice_id, patient_id, run_id, service_date, tariff_code, description, tooth, diagnosis,
                                      quantity, amount, fund_code, invoice_number)
      SELECT v_run.practice_id, v_patient, p_run_id, (l ->> 'service_date')::date, left(btrim(l ->> 'tariff_code'), 10),
             legacy_import_text(l, 'description', 60), legacy_import_text(l, 'tooth', 20), legacy_import_text(l, 'diagnosis', 64),
             CASE WHEN COALESCE((l ->> 'quantity')::numeric, 0) > 0 THEN round((l ->> 'quantity')::numeric, 2) ELSE 1 END,
             COALESCE((l ->> 'amount_cents')::bigint, 0) / 100.0, legacy_import_text(l, 'fund_code', 10), legacy_import_text(l, 'invoice_number', 20)
        FROM jsonb_array_elements(COALESCE(r.payload -> 'lines', '[]'::jsonb)) l
       WHERE COALESCE(btrim(l ->> 'tariff_code'), '') <> '' AND l ->> 'service_date' ~ '^\d{4}-\d{2}-\d{2}$';
      GET DIAGNOSTICS v_lines = ROW_COUNT;
      UPDATE legacy_import_rows SET status = CASE WHEN v_lines > 0 THEN 'created' ELSE 'skipped' END, patient_id = v_patient,
             processed_at = now(), reason = CASE WHEN v_lines = 1 THEN '1 claim line' ELSE v_lines || ' claim lines' END
       WHERE id = r.id;
    EXCEPTION WHEN others THEN
      UPDATE legacy_import_rows SET status = 'skipped', patient_id = v_patient, processed_at = now(),
             reason = left('Claim history not brought over: ' || SQLERRM, 300) WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_count;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. legacy_import_continue(run): the next step of the import. The app calls it until "done".
--    The first call moves the run from staging to importing. The last one stores the counts and
--    empties the payloads (the patient files now hold that data; the rows keep name, outcome, reason).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.legacy_import_continue(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run  legacy_import_runs%ROWTYPE;
  v_kind text;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This import was not found';
  END IF;
  PERFORM legacy_import_assert_admin(v_run.practice_id);
  IF v_run.status = 'staging' THEN
    IF NOT EXISTS (SELECT 1 FROM legacy_import_rows WHERE run_id = p_run_id) THEN
      RAISE EXCEPTION 'There is nothing to import';
    END IF;
    UPDATE legacy_import_runs SET status = 'importing', started_at = now() WHERE id = p_run_id;
  ELSIF v_run.status <> 'importing' THEN
    RETURN legacy_import_progress(p_run_id);
  END IF;

  FOREACH v_kind IN ARRAY ARRAY['patient', 'family', 'balance', 'recall', 'claim_line'] LOOP
    IF EXISTS (SELECT 1 FROM legacy_import_rows WHERE run_id = p_run_id AND kind = v_kind AND status = 'pending') THEN
      CASE v_kind
        WHEN 'patient' THEN PERFORM legacy_import_people(p_run_id, 80);
        WHEN 'family' THEN PERFORM legacy_import_families(p_run_id, 150);
        WHEN 'balance' THEN PERFORM legacy_import_balances(p_run_id, 40);
        WHEN 'recall' THEN PERFORM legacy_import_recalls(p_run_id, 200);
        ELSE PERFORM legacy_import_claims(p_run_id, 60);
      END CASE;
      RETURN legacy_import_progress(p_run_id);
    END IF;
  END LOOP;

  UPDATE legacy_import_runs SET status = 'imported', imported_at = now() WHERE id = p_run_id;
  UPDATE legacy_import_runs SET summary = legacy_import_progress(p_run_id) - 'run_id' - 'status' - 'done' - 'undo_left' WHERE id = p_run_id;
  UPDATE legacy_import_rows SET payload = '{}'::jsonb WHERE run_id = p_run_id AND payload <> '{}'::jsonb;
  RETURN legacy_import_progress(p_run_id);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Undo
-- ---------------------------------------------------------------------------------------------

/*
  What staff did with the imported records since the import, in words, or NULL when nothing. Looks at
  every table with a foreign key to the imported patients, their opening-balance visits and invoices
  (so tables added later are covered too), plus claim batches, changed amounts, edited files and
  closed months.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_work_done(p_run_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run      legacy_import_runs%ROWTYPE;
  v_patients uuid[];
  v_visits   uuid[];
  v_invoices uuid[];
  v_details  uuid[];
  v_ours     text[];
  v_ids      uuid[];
  c          record;
  v_n        bigint;
  v_month    date;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id;
  v_patients := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'patient');
  v_visits := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'visit');
  v_invoices := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'invoice');
  v_details := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'medical_aid');
  v_ours := ARRAY(SELECT record_id::text FROM legacy_import_records WHERE run_id = p_run_id);

  FOR c IN
    SELECT con.conrelid::regclass AS tbl, cls.relname::text AS table_name, a.attname::text AS col, con.confrelid AS target
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND cardinality(con.conkey) = 1
       AND con.confrelid IN ('public.patients'::regclass, 'public.visits'::regclass, 'public.invoices_enhanced'::regclass)
       AND con.conrelid <> 'public.legacy_claim_lines'::regclass
  LOOP
    v_ids := CASE c.target WHEN 'public.patients'::regclass THEN v_patients
                           WHEN 'public.visits'::regclass THEN v_visits ELSE v_invoices END;
    CONTINUE WHEN cardinality(v_ids) = 0;
    -- Joined to the few ids first, so a large table is not compared row by row with a long list
    EXECUTE format('SELECT count(*) FROM %s t JOIN unnest($1::uuid[]) AS u(id) ON t.%I = u.id
                     WHERE NOT COALESCE((to_jsonb(t) ->> ''id'') = ANY ($2), false)', c.tbl, c.col)
      INTO v_n USING v_ids, v_ours;
    IF v_n > 0 THEN
      RETURN format('%s were added to the imported patients or their opening balances after the import (%s)',
                    legacy_import_table_label(c.table_name), v_n);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM invoices_enhanced WHERE id = ANY (v_invoices) AND batch_id IS NOT NULL) THEN
    RETURN 'an opening balance was put in a claim batch';
  END IF;
  IF EXISTS (SELECT 1 FROM invoices_enhanced i JOIN legacy_import_records d ON d.record_id = i.id AND d.run_id = p_run_id AND d.kind = 'invoice'
              WHERE round(COALESCE(i.total, 0) * 100) <> (d.details ->> 'total_cents')::bigint
                 OR round(COALESCE(i.medical_aid_total, 0) * 100) <> (d.details ->> 'medical_aid_cents')::bigint
                 OR lower(COALESCE(i.payment_status, '')) IN ('paid', 'partial', 'cancelled', 'canceled', 'void', 'voided')) THEN
    RETURN 'an opening balance was changed, paid or cancelled';
  END IF;
  IF v_run.imported_at IS NOT NULL AND (
       EXISTS (SELECT 1 FROM patients WHERE id = ANY (v_patients) AND updated_at > v_run.imported_at)
       OR EXISTS (SELECT 1 FROM medical_aid_details WHERE id = ANY (v_details) AND updated_at > v_run.imported_at)) THEN
    RETURN 'imported patient files were edited';
  END IF;
  SELECT min(pc.period_month) INTO v_month
    FROM invoices_enhanced i
    JOIN period_closes pc ON pc.practice_id = i.practice_id AND pc.period_month = date_trunc('month', i.issue_date)::date AND pc.reopened_at IS NULL
   WHERE i.id = ANY (v_invoices);
  IF v_month IS NOT NULL THEN
    RETURN dc_month_label(v_month) || ' was closed with opening balances of this import in it';
  END IF;
  RETURN NULL;
END $$;

-- One step of an undo: removes up to a few hundred records, newest kinds first. Returns how many.
CREATE OR REPLACE FUNCTION public.legacy_import_undo_step(p_run_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids  uuid[];
  v_rows integer;
BEGIN
  -- Claim history
  DELETE FROM legacy_claim_lines WHERE id IN (SELECT id FROM legacy_claim_lines WHERE run_id = p_run_id LIMIT 3000);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN RETURN v_rows; END IF;

  -- Recall list entries, then the lists the import created (kept when staff added people to them)
  v_ids := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'list_member' LIMIT 500);
  IF cardinality(v_ids) > 0 THEN
    DELETE FROM patient_list_members WHERE id = ANY (v_ids);
    DELETE FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'list_member' AND record_id = ANY (v_ids);
    RETURN cardinality(v_ids);
  END IF;
  v_ids := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'list');
  IF cardinality(v_ids) > 0 THEN
    DELETE FROM patient_lists l WHERE l.id = ANY (v_ids) AND NOT EXISTS (SELECT 1 FROM patient_list_members m WHERE m.list_id = l.id);
    DELETE FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'list';
    RETURN cardinality(v_ids);
  END IF;

  -- Opening balances (the period lock and the delete guard still apply), then their visits
  v_ids := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'invoice' LIMIT 100);
  IF cardinality(v_ids) > 0 THEN
    DELETE FROM invoices_enhanced WHERE id = ANY (v_ids);
    DELETE FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'invoice' AND record_id = ANY (v_ids);
    RETURN cardinality(v_ids);
  END IF;
  v_ids := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'visit' LIMIT 100);
  IF cardinality(v_ids) > 0 THEN
    DELETE FROM visits WHERE id = ANY (v_ids);
    DELETE FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'visit' AND record_id = ANY (v_ids);
    RETURN cardinality(v_ids);
  END IF;

  -- The Eminance number set on files that already existed (left alone when staff changed it since)
  v_ids := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'legacy_number' LIMIT 500);
  IF cardinality(v_ids) > 0 THEN
    UPDATE patients p SET legacy_account_number = NULL
      FROM legacy_import_records d
     WHERE d.run_id = p_run_id AND d.kind = 'legacy_number' AND d.record_id = p.id AND p.id = ANY (v_ids)
       AND p.legacy_account_number = d.details ->> 'value';
    DELETE FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'legacy_number' AND record_id = ANY (v_ids);
    RETURN cardinality(v_ids);
  END IF;

  -- The patients the import created: their medical aid details, family links and alerts go with them
  v_ids := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'patient' LIMIT 50);
  IF cardinality(v_ids) > 0 THEN
    DELETE FROM patients WHERE id = ANY (v_ids);
    DELETE FROM legacy_import_records WHERE run_id = p_run_id AND (record_id = ANY (v_ids) OR patient_id = ANY (v_ids));
    RETURN cardinality(v_ids);
  END IF;

  -- Family links between a new holder and a dependant that was already in OneHealth went with the holder
  DELETE FROM legacy_import_records WHERE run_id = p_run_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END $$;

/*
  legacy_import_undo(run, reason): the first call checks that nobody has worked with the imported records
  and starts the undo; every call removes the next part. The app calls it until "done". A run that never
  started importing is simply discarded.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_undo(p_run_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run  legacy_import_runs%ROWTYPE;
  v_work text;
BEGIN
  SELECT * INTO v_run FROM legacy_import_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This import was not found';
  END IF;
  PERFORM legacy_import_assert_admin(v_run.practice_id);

  IF v_run.status = 'staging' THEN
    DELETE FROM legacy_import_runs WHERE id = p_run_id;
    RETURN jsonb_build_object('run_id', p_run_id, 'status', 'discarded', 'done', true);
  END IF;
  IF v_run.status IN ('importing', 'imported') THEN
    IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
      RAISE EXCEPTION 'Say why the import is undone (it is kept with the import)';
    END IF;
    v_work := legacy_import_work_done(p_run_id);
    IF v_work IS NOT NULL THEN
      RAISE EXCEPTION 'This import can no longer be undone: %. Correct the files one by one instead.', v_work USING HINT = 'work_done';
    END IF;
    UPDATE legacy_import_runs
       SET status = 'undoing', undo_started_at = now(), undo_reason = btrim(p_reason),
           summary = CASE WHEN summary = '{}'::jsonb THEN legacy_import_progress(p_run_id) - 'run_id' - 'status' - 'done' - 'undo_left' ELSE summary END
     WHERE id = p_run_id;
  ELSIF v_run.status <> 'undoing' THEN
    RETURN legacy_import_progress(p_run_id);
  END IF;

  IF legacy_import_undo_step(p_run_id) = 0 THEN
    DELETE FROM legacy_import_rows WHERE run_id = p_run_id;
    UPDATE legacy_import_runs SET status = 'undone', undone_at = now(), undone_by = auth.uid() WHERE id = p_run_id;
  END IF;
  RETURN legacy_import_progress(p_run_id);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 9. Row level security and grants. Read: staff of the practice. Write: only the functions above.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.legacy_import_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_rows    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_claim_lines    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legacy_import_runs_select ON public.legacy_import_runs;
CREATE POLICY legacy_import_runs_select ON public.legacy_import_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = legacy_import_runs.practice_id));

DROP POLICY IF EXISTS legacy_import_rows_select ON public.legacy_import_rows;
CREATE POLICY legacy_import_rows_select ON public.legacy_import_rows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = legacy_import_rows.practice_id));

DROP POLICY IF EXISTS legacy_claim_lines_select ON public.legacy_claim_lines;
CREATE POLICY legacy_claim_lines_select ON public.legacy_claim_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = legacy_claim_lines.practice_id));

-- No policy on legacy_import_records: only the import functions use it

REVOKE ALL ON public.legacy_import_runs, public.legacy_import_rows, public.legacy_import_records, public.legacy_claim_lines
  FROM anon, authenticated;
GRANT SELECT ON public.legacy_import_runs, public.legacy_import_rows, public.legacy_claim_lines TO authenticated;

-- The patient app's staff-only guard, on these tables only (portal_apply_staff_guard() would also
-- re-create the policies of every other table, which this file must not touch)
DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NULL THEN
    RETURN;
  END IF;
  FOREACH v_table IN ARRAY ARRAY['legacy_import_runs', 'legacy_import_rows', 'legacy_import_records', 'legacy_claim_lines'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
    EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                   'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
  END LOOP;
END $$;

-- Internal functions are not callable from the API
REVOKE ALL ON FUNCTION public.legacy_import_text(jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_band_days(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_band_label(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_table_label(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_assert_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_patient_of(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_quiet(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_progress(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_people(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_families(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_balances(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_recalls(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_claims(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_work_done(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_import_undo_step(uuid) FROM PUBLIC, anon, authenticated;

-- The API: practice admins (each function checks the role itself)
REVOKE ALL ON FUNCTION public.legacy_import_start(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.legacy_import_stage(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.legacy_import_continue(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.legacy_import_undo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legacy_import_start(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_import_stage(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_import_continue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_import_undo(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 10. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'legacy_account_number') THEN
    RAISE EXCEPTION 'Check failed: patients.legacy_account_number was not added';
  END IF;

  SELECT string_agg(c.relname, ', ') INTO v_bad FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relname IN ('legacy_import_runs', 'legacy_import_rows', 'legacy_import_records', 'legacy_claim_lines')
     AND NOT c.relrowsecurity;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: row level security is off on %', v_bad;
  END IF;

  SELECT string_agg(table_name || ' ' || privilege_type, ', ') INTO v_bad FROM information_schema.role_table_grants
   WHERE grantee = 'anon' AND table_schema = 'public'
     AND table_name IN ('legacy_import_runs', 'legacy_import_rows', 'legacy_import_records', 'legacy_claim_lines');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: anon can use %', v_bad;
  END IF;
  SELECT string_agg(table_name || ' ' || privilege_type, ', ') INTO v_bad FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_schema = 'public' AND privilege_type <> 'SELECT'
     AND table_name IN ('legacy_import_runs', 'legacy_import_rows', 'legacy_import_records', 'legacy_claim_lines');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: signed-in users could write %', v_bad;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_bad FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'legacy\_import\_%'
     AND p.proname NOT IN ('legacy_import_text', 'legacy_import_band_days', 'legacy_import_band_label', 'legacy_import_table_label')
     AND (NOT p.prosecdef OR NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) s WHERE s LIKE 'search_path=%'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: these functions must be SECURITY DEFINER with a search_path: %', v_bad;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_bad FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'legacy\_import\_%'
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: anon can call %', v_bad;
  END IF;

  IF legacy_import_band_days('days_180_plus') <> 180 OR legacy_import_band_days('current') <> 0 OR legacy_import_band_days('days_45') IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the age bands do not match AGE_BANDS in src/services/ledger/receivables.ts';
  END IF;
  RAISE NOTICE 'Eminance import: tables, functions, policies and grants checked.';
END $$;

ROLLBACK;

-- =============================================================================================
-- Undo (after a COMMIT), in one transaction. First undo every import that should not be kept
-- (Settings > Move over from Eminance > Undo); patients and balances that were kept stay where they
-- are. Dropping the column loses the Eminance numbers of the files that were kept.
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.legacy_import_undo(uuid, text);
--   DROP FUNCTION IF EXISTS public.legacy_import_undo_step(uuid);
--   DROP FUNCTION IF EXISTS public.legacy_import_work_done(uuid);
--   DROP FUNCTION IF EXISTS public.legacy_import_continue(uuid);
--   DROP FUNCTION IF EXISTS public.legacy_import_claims(uuid, integer);
--   DROP FUNCTION IF EXISTS public.legacy_import_recalls(uuid, integer);
--   DROP FUNCTION IF EXISTS public.legacy_import_balances(uuid, integer);
--   DROP FUNCTION IF EXISTS public.legacy_import_families(uuid, integer);
--   DROP FUNCTION IF EXISTS public.legacy_import_people(uuid, integer);
--   DROP FUNCTION IF EXISTS public.legacy_import_stage(uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.legacy_import_start(uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.legacy_import_progress(uuid);
--   DROP FUNCTION IF EXISTS public.legacy_import_quiet(uuid, uuid[]);
--   DROP FUNCTION IF EXISTS public.legacy_import_patient_of(uuid, text);
--   DROP FUNCTION IF EXISTS public.legacy_import_table_label(text);
--   DROP FUNCTION IF EXISTS public.legacy_import_band_label(text);
--   DROP FUNCTION IF EXISTS public.legacy_import_band_days(text);
--   DROP FUNCTION IF EXISTS public.legacy_import_text(jsonb, text, integer);
--   DROP FUNCTION IF EXISTS public.legacy_import_assert_admin(uuid);
--   DROP TABLE IF EXISTS public.legacy_claim_lines;
--   DROP TABLE IF EXISTS public.legacy_import_records;
--   DROP TABLE IF EXISTS public.legacy_import_rows;
--   DROP TABLE IF EXISTS public.legacy_import_runs;
--   DROP INDEX IF EXISTS public.patients_legacy_account_number_idx;
--   ALTER TABLE public.patients DROP COLUMN IF EXISTS legacy_account_number;
--   COMMIT;
-- The app keeps working after the undo: Settings shows "not set up yet" and the patient file stops
-- showing an Eminance number. Opening balances, carrier visits and recall lists of imports that were
-- kept stay (they are ordinary invoices, visits and lists).
-- =============================================================================================

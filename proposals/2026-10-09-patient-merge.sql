-- Applied 2026-10-09 as migration patient_merge_2026_10_09 (version 20261009105834; stored statement md5 77709ea20164e4eb09dc67cf4a6a69a3 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed;
-- live prosrc md5 afterwards: merge_patients 95890cfda2ec307ca067e3322ccb86b7, undo_patient_merge 1c1640772f0ea3bf6e90bce2b602db26,
-- legacy_import_people 9a4e73215fc4f52b7fc908896f4b95d5). Rehearsed with simulated logins on invented practices, staff and
-- patients (rolled back), repeated after applying: the administrator's merge moved a visit, a closed-month invoice (the
-- period lock refuses that move in the app), a receipt, an open-batch claim line, a quote, a note, a credit-control note,
-- an account flag and the next of kin; the same flag in force on both files, the sent-batch claim line, the second medical
-- aid, both files on one list, the family link between the two files and the second clinical profile stayed with the
-- archived file; no message was queued and no trigger was left off; the receptionist then saw 1 file. The undo put every
-- row back (row counts per table of both files equal to before); after a new visit on the kept file it was refused
-- (merge_has_new_records {"visits": 1}). A receptionist, another practice's administrator (42501) and anon (42501) could
-- neither merge nor undo; another practice saw 0 merge records and 0 counts. The same ID number saved at a second
-- practice and was refused twice in one (23505).
-- =============================================================================================
-- PROPOSAL: duplicate patient files merged inside one practice (and undone), the ID number unique per practice
-- File:   proposals/2026-10-09-patient-merge.sql                       Drafted: 2026-10-09
-- Code:   src/utils/patients/duplicatePatients.ts (the duplicate rules, tested), src/utils/patients/duplicatePairs.ts
--         (the finder, tested), src/utils/patients/patientMerge.ts (labels and the suggested file, tested),
--         src/services/patientMergeService.ts, src/components/patients/duplicates/PossibleDuplicatesDialog.tsx
--
-- Why (parity matrix 2026-10-08, rows A18 and A4):
--   - Two files for one person split the history: allergies on one, invoices on the other, and the fund sees two
--     "patients" with one membership number. Registration warns before a second file is opened, but files that
--     already exist twice could not be put together.
--   - patients.id_number was unique across all of OneHealth, so a person who is a patient at two practices could
--     not be registered at the second one ("registered at another practice"). Each practice keeps its own file.
--
-- What it does
--   1. The ID number is unique per practice (constraint patients_practice_id_number_key) instead of across
--      OneHealth (patients_id_number_key dropped). No practice reads another practice's patients: the existing
--      policies on patients are not touched.
--   2. patients.merged_into_patient_id: the file a merged-away file was merged into. A merged-away file is
--      archived, never deleted: its practice_id is cleared, so no screen, list, search, recall, automation or
--      other practice ever shows it, and the merge record (3) keeps the practice for the undo.
--   3. patient_merges: one row per merge (who, when, the rows moved per table, and the ids the undo needs).
--      Staff of the practice (and OneHealth support) can read it; only the functions below write it.
--   4. merge_patients(keep, merge): an active administrator of the practice (rls_is_staff_admin) merges two files
--      of their own practice in one transaction. Every row of the merged-away file moves to the kept file, then
--      the merged-away file is archived. The tables are found from the foreign keys when it runs, so a table
--      added later moves too.
--   5. undo_patient_merge(merge): puts every moved row back and restores the archived file, while nothing new has
--      been added to the kept file since the merge (any table); otherwise it says what was added.
--   6. patient_record_counts(ids): visits, invoices and claims per file for the duplicate finder, with the
--      caller's own rights (row security applies).
--   7. legacy_import_people (Eminance import): an ID number already used counts only within the practice.
--   8. patients.legacy_account_number also holds the old file number staff type for patients not imported.
--
-- Tables the merge moves (every column with a foreign key to patients.id, as of 2026-10-09):
--   account_flags, account_holder_links (patient_id and holder_patient_id), automation_executions,
--   batch_details (claim lines in open batches only), bed_allocations, bed_transfer_history, beds (no foreign key:
--   named in patient_merge_columns), claim_rejections, credit_control_notes, dental_chart_changes,
--   dental_chart_entries, diary_reminder_log, discharge_summaries, imaging_requests, inpatient_medications,
--   internal_message_channels, invoice_adjustments, invoices_enhanced, lab_requests, leave_forms, legacy_claim_lines,
--   medical_aid_details (*), medications, next_of_kin (*), nursing_care_records, optometry_cl_supplies,
--   optometry_exams, optometry_lab_order_events, optometry_lab_orders, optometry_prescriptions, patient_accounts,
--   patient_admissions, patient_allergies, patient_allergy_overrides, patient_clinical_profiles, patient_documents,
--   patient_imaging, patient_laboratory, patient_letters, patient_list_members, patient_locations, patient_media,
--   patient_notes, patient_portal_otp_sends, patient_portal_requests, patient_problems, payment_promises,
--   practice_email_logs, practice_sms_logs, practice_sms_replies, quotes, receipts, remittance_lines,
--   review_requests, stock_dispensings, system_notifications, visit_documents, visitor_logs, visits, ward_rounds.
--   (*) only when the kept file has none: the app reads one medical aid and one next of kin per patient
--       (maybeSingle), and claims take the first medical aid row. Otherwise they stay with the archived file.
--   A row that would break a rule of its table stays with the archived file and is counted: the same account
--   flag in force on both files, both files on the same list, a family link between the two files, a second
--   clinical profile or location.
-- Kept as written (history; patient_merges maps the archived file to the kept one): claim lines in batches already
--   sent (their patient_id stays), the daybook (daybook_entries), interest-run lines, the stock ledger
--   (stock_movements), audit trails (audit_logs, ar_audit_events), message and notification queues and logs keyed
--   by record id, the Eminance import's own bookkeeping (legacy_import_rows, legacy_import_records) and
--   appointments_backup_20250625. Each moved invoice gets an "invoice_changed / patient_id" line in its history
--   (invoice_audit_events), as a change of patient made in the app would.
--
-- How rows move: the finance and stock history guards (receipts and adjustments are reverse-only, closed months are
--   locked, quotes keep their patient, ...) refuse any change, by design for day-to-day work. A merge changes only
--   which file a row belongs to: no amount, date or status. So merge_patients switches the user triggers of each
--   table it moves rows in off for its own transaction (ALTER TABLE ... DISABLE TRIGGER, re-enabled before it
--   returns; other sessions never see them off, and writers to that table wait the moment the merge takes). This
--   also keeps the moves from queuing messages, webhooks or automations. Foreign keys stay checked. It is the only
--   place that does this.
--
-- Apply: as one migration, after 2026-10-09-staff-records-admins.sql (rls_is_staff_admin) and the practice isolation
--   files (rls_my_practice_id, rls_is_super_admin). The app keeps working before it is applied: the finder and the
--   merge say "not set up yet".
-- Undo (first undo every merge with undo_patient_merge, which puts every file back):
--   DROP FUNCTION public.merge_patients(uuid, uuid), public.undo_patient_merge(uuid), public.patient_record_counts(uuid[]),
--     public.patient_merge_columns(), public.patient_merge_row_filter(text, boolean);
--   DROP TABLE public.patient_merges;
--   ALTER TABLE public.patients DROP COLUMN merged_into_patient_id;
--   ALTER TABLE public.patients DROP CONSTRAINT patients_practice_id_number_key,
--     ADD CONSTRAINT patients_id_number_key UNIQUE (id_number);   -- fails once a person is a patient at two practices
--   legacy_import_people: the replacements of section 7 the other way round.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The ID number is unique per practice
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_id_number_key;
ALTER TABLE public.patients ADD CONSTRAINT patients_practice_id_number_key UNIQUE (practice_id, id_number);

-- ---------------------------------------------------------------------------------------------
-- 2. An archived (merged-away) file points to the file it was merged into
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS merged_into_patient_id uuid REFERENCES public.patients(id);
COMMENT ON COLUMN public.patients.merged_into_patient_id IS
  'Set when this file was merged into another file of the practice (merge_patients): the file is archived (practice_id cleared, so no screen lists it) and kept for the merge record (patient_merges) and its undo.';
CREATE INDEX IF NOT EXISTS patients_merged_into_idx ON public.patients (merged_into_patient_id) WHERE merged_into_patient_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 3. The merge record
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_merges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL REFERENCES public.practices(id),
  kept_patient_id    uuid NOT NULL REFERENCES public.patients(id),
  merged_patient_id  uuid NOT NULL REFERENCES public.patients(id),
  -- The archived file's name and OneHealth reference, for the history list (staff cannot read an archived file)
  merged_file        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Rows moved, and rows that stayed with the archived file, per table: {"visits": 3, ...}
  moved              jsonb NOT NULL DEFAULT '{}'::jsonb,
  left_with_archived jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Per "table.column": the ids moved, and the kept file's ids right after the merge (what the undo compares)
  row_ids            jsonb NOT NULL DEFAULT '{}'::jsonb,
  merged_by          uuid NOT NULL,
  merged_at          timestamptz NOT NULL DEFAULT now(),
  undone_by          uuid,
  undone_at          timestamptz,
  moved_back         jsonb,
  CONSTRAINT patient_merges_two_files CHECK (kept_patient_id <> merged_patient_id),
  CONSTRAINT patient_merges_undo_complete CHECK ((undone_at IS NULL) = (undone_by IS NULL))
);
CREATE INDEX IF NOT EXISTS patient_merges_practice_idx ON public.patient_merges (practice_id, merged_at DESC);
CREATE INDEX IF NOT EXISTS patient_merges_merged_idx ON public.patient_merges (merged_patient_id);
CREATE INDEX IF NOT EXISTS patient_merges_kept_idx ON public.patient_merges (kept_patient_id);
COMMENT ON TABLE public.patient_merges IS
  'One row per merge of two patient files (merge_patients), undone with undo_patient_merge. Maps an archived file to the file it was merged into, e.g. for claim lines of sent batches, which keep the archived file''s id.';

ALTER TABLE public.patient_merges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_merges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_merges TO authenticated;
DROP POLICY IF EXISTS patient_merges_read ON public.patient_merges;
CREATE POLICY patient_merges_read ON public.patient_merges FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- ---------------------------------------------------------------------------------------------
-- 4. What the merge moves: every column with a single-column foreign key to patients, plus beds.patient_id
--    (no foreign key). pk is the table's one-column primary key (NULL when it has none: such a table refuses the
--    merge if the file has rows in it, because its rows could not be put back).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patient_merge_columns()
RETURNS TABLE (tbl regclass, schema_name text, table_name text, col text, pk text, pk_type text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT c.conrelid::regclass, n.nspname::text, r.relname::text, a.attname::text, k.attname::text,
         pg_catalog.format_type(k.atttypid, k.atttypmod)
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class r ON r.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = r.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    LEFT JOIN pg_catalog.pg_index i ON i.indrelid = c.conrelid AND i.indisprimary AND i.indnatts = 1
    LEFT JOIN pg_catalog.pg_attribute k ON k.attrelid = c.conrelid AND k.attnum = i.indkey[0]
   WHERE c.contype = 'f' AND c.confrelid = 'public.patients'::regclass AND cardinality(c.conkey) = 1
     AND c.conrelid NOT IN ('public.patients'::regclass, 'public.patient_merges'::regclass)
  UNION
  SELECT to_regclass('public.beds'), 'public', 'beds', 'patient_id', 'id', 'uuid'
   WHERE to_regclass('public.beds') IS NOT NULL
$$;

/*
  The extra condition a table's rows must meet to move ($1 is the kept file in every statement that uses it):
  - claim lines move only while their batch is open (the same test as sync_invoice_to_batch): a sent batch is never
    rewritten, its lines keep the archived file's id;
  - a medical aid or next of kin moves only when the kept file has none (merge only).
*/
CREATE OR REPLACE FUNCTION public.patient_merge_row_filter(p_table text, p_undo boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_table = 'public.batch_details' THEN
      ' AND NOT EXISTS (SELECT 1 FROM public.batch_headers b WHERE b.id = t.batch_header_id'
      || ' AND (b.sent_at IS NOT NULL OR lower(COALESCE(b.status, ''active'')) NOT IN (''active'', ''open'', ''draft'', ''ready'')))'
    WHEN p_table IN ('public.medical_aid_details', 'public.next_of_kin') AND NOT p_undo THEN
      ' AND NOT EXISTS (SELECT 1 FROM ' || p_table || ' k WHERE k.patient_id = $1)'
    ELSE ''
  END
$$;

REVOKE EXECUTE ON FUNCTION public.patient_merge_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.patient_merge_row_filter(text, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. The merge. search_path is public (not empty) because the triggers it fires on patients (the audit trail) name
--    their tables without a schema; everything here is named with its schema.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_patients(p_keep_patient_id uuid, p_merge_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET lock_timeout = '5s'
AS $$
DECLARE
  v_practice uuid := public.rls_my_practice_id();
  v_keep     record;
  v_merge    record;
  v_ref      record;
  v_table    text;
  v_filter   text;
  v_before   text[];
  v_ids      text[];
  v_pk       text;
  v_new_pk   text;
  v_total    bigint;
  v_triggers text[];
  v_trigger  text;
  v_moved    jsonb := '{}'::jsonb;
  v_left     jsonb := '{}'::jsonb;
  v_rows     jsonb := '{}'::jsonb;
  v_merge_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_practice IS NULL OR NOT public.rls_is_staff_admin() THEN
    RAISE EXCEPTION 'Only a practice administrator can merge patient files' USING ERRCODE = '42501';
  END IF;
  IF p_keep_patient_id IS NULL OR p_merge_patient_id IS NULL OR p_keep_patient_id = p_merge_patient_id THEN
    RAISE EXCEPTION 'Choose two different patient files' USING ERRCODE = '22023';
  END IF;

  -- Both files locked in a fixed order, so two merges of the same files wait for each other
  PERFORM 1 FROM public.patients WHERE id IN (p_keep_patient_id, p_merge_patient_id) ORDER BY id FOR UPDATE;
  SELECT * INTO v_keep FROM public.patients WHERE id = p_keep_patient_id;
  SELECT * INTO v_merge FROM public.patients WHERE id = p_merge_patient_id;
  -- Never another practice's file (an archived file has no practice, so it cannot be merged again)
  IF v_keep.id IS NULL OR v_merge.id IS NULL
     OR v_keep.practice_id IS DISTINCT FROM v_practice OR v_merge.practice_id IS DISTINCT FROM v_practice THEN
    RAISE EXCEPTION 'Both files must be current patient files of your practice' USING ERRCODE = '42501';
  END IF;

  -- Tables in a fixed order, so merges running at the same time lock them in the same order
  FOR v_ref IN SELECT * FROM public.patient_merge_columns() ORDER BY schema_name, table_name, col LOOP
    v_table := format('%I.%I', v_ref.schema_name, v_ref.table_name);
    EXECUTE format('SELECT count(*) FROM %s t WHERE t.%I = $1', v_table, v_ref.col) INTO v_total USING p_merge_patient_id;
    IF v_ref.pk IS NULL THEN
      IF v_total > 0 THEN
        RAISE EXCEPTION 'The table % has no one-column key, so its rows could not be put back by an undo; nothing was merged', v_table;
      END IF;
      CONTINUE;
    END IF;

    -- The kept file's own rows before the merge: with the moved ones, what the undo compares with
    EXECUTE format('SELECT COALESCE(array_agg(t.%I::text), ''{}''::text[]) FROM %s t WHERE t.%I = $1', v_ref.pk, v_table, v_ref.col)
      INTO v_before USING p_keep_patient_id;
    v_ids := '{}';

    IF v_total > 0 THEN
      v_filter := public.patient_merge_row_filter(v_ref.schema_name || '.' || v_ref.table_name, false);
      SELECT COALESCE(array_agg(tg.tgname::text ORDER BY tg.tgname), '{}') INTO v_triggers
        FROM pg_catalog.pg_trigger tg
       WHERE tg.tgrelid = v_ref.tbl AND NOT tg.tgisinternal AND tg.tgenabled = 'O';
      FOREACH v_trigger IN ARRAY v_triggers LOOP
        EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', v_table, v_trigger);
      END LOOP;

      BEGIN
        EXECUTE format('WITH m AS (UPDATE %1$s t SET %2$I = $1 WHERE t.%2$I = $2%3$s RETURNING t.%4$I::text AS pk) '
                       || 'SELECT COALESCE(array_agg(pk), ''{}''::text[]) FROM m', v_table, v_ref.col, v_filter, v_ref.pk)
          INTO v_ids USING p_keep_patient_id, p_merge_patient_id;
      EXCEPTION WHEN unique_violation OR check_violation OR exclusion_violation THEN
        -- Row by row: a row that would break a rule of its table stays with the archived file
        v_ids := '{}';
        FOR v_pk IN EXECUTE format('SELECT t.%1$I::text FROM %2$s t WHERE t.%3$I = $2%4$s ORDER BY 1', v_ref.pk, v_table, v_ref.col, v_filter)
            USING p_keep_patient_id, p_merge_patient_id LOOP
          BEGIN
            EXECUTE format('UPDATE %1$s t SET %2$I = $1 WHERE t.%2$I = $2 AND t.%3$I = $3::%4$s RETURNING t.%3$I::text',
                           v_table, v_ref.col, v_ref.pk, v_ref.pk_type)
              INTO v_new_pk USING p_keep_patient_id, p_merge_patient_id, v_pk;
            IF v_new_pk IS NOT NULL THEN
              v_ids := v_ids || v_new_pk;
            END IF;
          EXCEPTION WHEN unique_violation OR check_violation OR exclusion_violation THEN
            NULL;
          END;
        END LOOP;
      END;

      FOREACH v_trigger IN ARRAY v_triggers LOOP
        EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %I', v_table, v_trigger);
      END LOOP;

      IF cardinality(v_ids) > 0 THEN
        v_moved := v_moved || jsonb_build_object(v_ref.table_name, COALESCE((v_moved ->> v_ref.table_name)::bigint, 0) + cardinality(v_ids));
      END IF;
      IF v_total > cardinality(v_ids) THEN
        v_left := v_left || jsonb_build_object(v_ref.table_name, COALESCE((v_left ->> v_ref.table_name)::bigint, 0) + v_total - cardinality(v_ids));
      END IF;
      -- The invoice's own history shows the change of patient, as a change made in the app would
      IF v_ref.tbl = 'public.invoices_enhanced'::regclass AND cardinality(v_ids) > 0 AND to_regclass('public.invoice_audit_events') IS NOT NULL THEN
        INSERT INTO public.invoice_audit_events (practice_id, invoice_id, action, field, old_value, new_value)
        SELECT i.practice_id, i.id, 'invoice_changed', 'patient_id', p_merge_patient_id::text, p_keep_patient_id::text
          FROM public.invoices_enhanced i WHERE i.id = ANY (v_ids::uuid[]);
      END IF;
    END IF;

    IF cardinality(v_before) + cardinality(v_ids) > 0 THEN
      v_rows := v_rows || jsonb_build_object(v_ref.schema_name || '.' || v_ref.table_name || '.' || v_ref.col,
                                             jsonb_build_object('moved', to_jsonb(v_ids), 'kept', to_jsonb(v_before || v_ids)));
    END IF;
  END LOOP;

  -- Archived, never deleted: no practice, so nothing lists it; it points to the kept file
  UPDATE public.patients SET merged_into_patient_id = p_keep_patient_id, practice_id = NULL WHERE id = p_merge_patient_id;

  INSERT INTO public.patient_merges (practice_id, kept_patient_id, merged_patient_id, merged_file, moved, left_with_archived, row_ids, merged_by)
  VALUES (v_practice, p_keep_patient_id, p_merge_patient_id,
          jsonb_build_object('first_name', v_merge.first_name, 'last_name', v_merge.last_name,
                             'reference', v_merge.system_patient_reference_number),
          v_moved, v_left, v_rows, auth.uid())
  RETURNING id INTO v_merge_id;

  RETURN jsonb_build_object('merge_id', v_merge_id, 'moved', v_moved, 'left_with_archived', v_left);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. The undo (search_path public for the same reason as the merge)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.undo_patient_merge(p_merge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET lock_timeout = '5s'
AS $$
DECLARE
  v_record   public.patient_merges%ROWTYPE;
  v_keep     record;
  v_archived record;
  v_ref      record;
  v_table    text;
  v_key      text;
  v_kept     text[];
  v_moved    text[];
  v_count    bigint;
  v_triggers text[];
  v_trigger  text;
  v_added    jsonb := '{}'::jsonb;
  v_back     jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_record FROM public.patient_merges WHERE id = p_merge_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.rls_is_staff_admin()
     OR public.rls_my_practice_id() IS DISTINCT FROM v_record.practice_id THEN
    RAISE EXCEPTION 'Only an administrator of the practice can undo this merge' USING ERRCODE = '42501';
  END IF;
  IF v_record.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'This merge was already undone' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.patients WHERE id IN (v_record.kept_patient_id, v_record.merged_patient_id) ORDER BY id FOR UPDATE;
  SELECT * INTO v_keep FROM public.patients WHERE id = v_record.kept_patient_id;
  SELECT * INTO v_archived FROM public.patients WHERE id = v_record.merged_patient_id;
  IF v_keep.id IS NULL OR v_keep.practice_id IS DISTINCT FROM v_record.practice_id OR v_keep.merged_into_patient_id IS NOT NULL THEN
    RAISE EXCEPTION 'The kept file was merged into another file since: undo that merge first' USING ERRCODE = '22023';
  END IF;
  IF v_archived.id IS NULL OR v_archived.merged_into_patient_id IS DISTINCT FROM v_record.kept_patient_id THEN
    RAISE EXCEPTION 'The archived file is no longer archived by this merge' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.patients p
              WHERE p.practice_id = v_record.practice_id AND p.id_number = v_archived.id_number AND p.id <> v_archived.id) THEN
    RAISE EXCEPTION 'Another file of the practice now has the archived file''s ID number: change one of them before undoing the merge'
      USING ERRCODE = '23505';
  END IF;

  -- Nothing new on the kept file since the merge, in any table
  FOR v_ref IN SELECT * FROM public.patient_merge_columns() ORDER BY schema_name, table_name, col LOOP
    CONTINUE WHEN v_ref.pk IS NULL;
    v_table := format('%I.%I', v_ref.schema_name, v_ref.table_name);
    v_key := v_ref.schema_name || '.' || v_ref.table_name || '.' || v_ref.col;
    v_kept := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_record.row_ids -> v_key -> 'kept', '[]'::jsonb)));
    EXECUTE format('SELECT count(*) FROM %1$s t WHERE t.%2$I = $1 AND NOT (t.%3$I = ANY ($2::%4$s[]))', v_table, v_ref.col, v_ref.pk, v_ref.pk_type)
      INTO v_count USING v_record.kept_patient_id, v_kept;
    IF v_count > 0 THEN
      v_added := v_added || jsonb_build_object(v_ref.table_name, COALESCE((v_added ->> v_ref.table_name)::bigint, 0) + v_count);
    END IF;
  END LOOP;
  IF v_added <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Records were added to the kept file since the merge, so it can no longer be undone'
      USING ERRCODE = 'P0001', DETAIL = v_added::text, HINT = 'merge_has_new_records';
  END IF;

  -- Every moved row back (claim lines only while their batch is still open: a sent batch is never rewritten)
  FOR v_ref IN SELECT * FROM public.patient_merge_columns() ORDER BY schema_name, table_name, col LOOP
    CONTINUE WHEN v_ref.pk IS NULL;
    v_table := format('%I.%I', v_ref.schema_name, v_ref.table_name);
    v_key := v_ref.schema_name || '.' || v_ref.table_name || '.' || v_ref.col;
    v_moved := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_record.row_ids -> v_key -> 'moved', '[]'::jsonb)));
    CONTINUE WHEN cardinality(v_moved) = 0;

    SELECT COALESCE(array_agg(tg.tgname::text ORDER BY tg.tgname), '{}') INTO v_triggers
      FROM pg_catalog.pg_trigger tg
     WHERE tg.tgrelid = v_ref.tbl AND NOT tg.tgisinternal AND tg.tgenabled = 'O';
    FOREACH v_trigger IN ARRAY v_triggers LOOP
      EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', v_table, v_trigger);
    END LOOP;
    EXECUTE format('WITH m AS (UPDATE %1$s t SET %2$I = $2 WHERE t.%2$I = $1 AND t.%3$I = ANY ($3::%4$s[])%5$s RETURNING t.%3$I::text AS pk) '
                   || 'SELECT COALESCE(array_agg(pk), ''{}''::text[]) FROM m',
                   v_table, v_ref.col, v_ref.pk, v_ref.pk_type,
                   public.patient_merge_row_filter(v_ref.schema_name || '.' || v_ref.table_name, true))
      INTO v_moved USING v_record.kept_patient_id, v_record.merged_patient_id, v_moved;
    FOREACH v_trigger IN ARRAY v_triggers LOOP
      EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %I', v_table, v_trigger);
    END LOOP;

    IF cardinality(v_moved) > 0 THEN
      v_back := v_back || jsonb_build_object(v_ref.table_name, COALESCE((v_back ->> v_ref.table_name)::bigint, 0) + cardinality(v_moved));
      IF v_ref.tbl = 'public.invoices_enhanced'::regclass AND to_regclass('public.invoice_audit_events') IS NOT NULL THEN
        INSERT INTO public.invoice_audit_events (practice_id, invoice_id, action, field, old_value, new_value)
        SELECT i.practice_id, i.id, 'invoice_changed', 'patient_id', v_record.kept_patient_id::text, v_record.merged_patient_id::text
          FROM public.invoices_enhanced i WHERE i.id = ANY (v_moved::uuid[]);
      END IF;
    END IF;
  END LOOP;

  UPDATE public.patients SET practice_id = v_record.practice_id, merged_into_patient_id = NULL WHERE id = v_record.merged_patient_id;
  UPDATE public.patient_merges SET undone_at = now(), undone_by = auth.uid(), moved_back = v_back WHERE id = p_merge_id;

  RETURN jsonb_build_object('merge_id', p_merge_id, 'moved_back', v_back);
END $$;

REVOKE EXECUTE ON FUNCTION public.merge_patients(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.undo_patient_merge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_patients(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_patient_merge(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. Visits, invoices and claims per file for the duplicate finder: the caller's own rights, so row security limits
--    it to their practice (at most 400 files per call)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patient_record_counts(p_patient_ids uuid[])
RETURNS TABLE (patient_id uuid, visits bigint, invoices bigint, claims bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.id,
         (SELECT count(*) FROM public.visits v WHERE v.patient_id = p.id),
         (SELECT count(*) FROM public.invoices_enhanced i WHERE i.patient_id = p.id),
         (SELECT count(DISTINCT d.invoice_id) FROM public.batch_details d WHERE d.patient_id = p.id)
    FROM public.patients p
   WHERE p.id = ANY (p_patient_ids[1:400])
$$;
REVOKE EXECUTE ON FUNCTION public.patient_record_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_record_counts(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. The Eminance import: an ID number already in use counts only within the practice (three statements of the live
--    legacy_import_people replaced in place; the block stops if one is not found exactly once)
-- ---------------------------------------------------------------------------------------------
DO $migration$
DECLARE
  v_def  text;
  v_pair text[];
  v_pairs text[][] := ARRAY[
    ARRAY['ELSIF EXISTS (SELECT 1 FROM patients WHERE id_number = v_id) THEN',
          'ELSIF EXISTS (SELECT 1 FROM patients WHERE id_number = v_id AND practice_id = v_run.practice_id) THEN'],
    ARRAY['-- id_number is required and unique across OneHealth: a placeholder staff replace later',
          '-- id_number is required (unique within the practice): a placeholder staff replace later'],
    ARRAY['''Its ID number is already on a OneHealth file (possibly at another practice). Check the patient list.''',
          '''Its ID number is already on a file of this practice. Check the patient list.''']
  ];
BEGIN
  IF to_regprocedure('public.legacy_import_people(uuid, integer)') IS NULL THEN
    RETURN;
  END IF;
  SELECT pg_get_functiondef('public.legacy_import_people(uuid, integer)'::regprocedure) INTO v_def;
  FOREACH v_pair SLICE 1 IN ARRAY v_pairs LOOP
    IF (length(v_def) - length(replace(v_def, v_pair[1], ''))) / length(v_pair[1]) <> 1 THEN
      RAISE EXCEPTION 'legacy_import_people: "%" was not found exactly once; nothing changed', left(v_pair[1], 60);
    END IF;
    v_def := replace(v_def, v_pair[1], v_pair[2]);
  END LOOP;
  EXECUTE v_def;
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 9. The old file number of patients who were not imported
-- ---------------------------------------------------------------------------------------------
COMMENT ON COLUMN public.patients.legacy_account_number IS
  'The patient''s file or account number in the practice''s previous system (Eminance or paper files), e.g. 0001234: staff search by it and patients quote it. Set by the Eminance import, or typed by staff as the old file number of a patient who was not imported.';

-- ---------------------------------------------------------------------------------------------
-- 10. Checks
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.patients'::regclass AND conname = 'patients_id_number_key') THEN
    RAISE EXCEPTION 'Check failed: the ID number is still unique across all practices';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.patients'::regclass AND conname = 'patients_practice_id_number_key'
                    AND contype = 'u' AND pg_get_constraintdef(oid) = 'UNIQUE (practice_id, id_number)') THEN
    RAISE EXCEPTION 'Check failed: the ID number is not unique per practice';
  END IF;
  IF has_table_privilege('anon', 'public.patient_merges', 'SELECT')
     OR has_table_privilege('authenticated', 'public.patient_merges', 'INSERT')
     OR has_table_privilege('authenticated', 'public.patient_merges', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.patient_merges', 'DELETE')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.patient_merges'::regclass) THEN
    RAISE EXCEPTION 'Check failed: patient_merges is writable or readable without the practice policy';
  END IF;
  IF has_function_privilege('anon', 'public.merge_patients(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.undo_patient_merge(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.patient_record_counts(uuid[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.patient_merge_columns()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.merge_patients(uuid, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.undo_patient_merge(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: the merge functions have the wrong grants';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patient_merge_columns() WHERE tbl = 'public.visits'::regclass AND col = 'patient_id' AND pk = 'id')
     OR NOT EXISTS (SELECT 1 FROM public.patient_merge_columns() WHERE tbl = 'public.receipts'::regclass AND col = 'patient_id')
     OR EXISTS (SELECT 1 FROM public.patient_merge_columns() WHERE pk IS NULL) THEN
    RAISE EXCEPTION 'Check failed: the merge does not see every table that references patients with a one-column key';
  END IF;
  IF to_regprocedure('public.legacy_import_people(uuid, integer)') IS NOT NULL
     AND position('id_number = v_id AND practice_id = v_run.practice_id' in
                  (SELECT prosrc FROM pg_proc WHERE oid = 'public.legacy_import_people(uuid, integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: the Eminance import still checks ID numbers across practices';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

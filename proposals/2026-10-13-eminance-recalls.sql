-- Applied 2026-10-13 as migration eminance_recalls_2026_10_13 (version 20261013062512; stored statement md5 eed4bc82a6f335a52de73e0558f20ed8 = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 afterwards: legacy_import_set_recall e1edf37dcb71307789d927947d90c95d, legacy_import_recalls
-- 93b7d99588d1624d64c8284eeff3ec95, legacy_import_undo_step 93eda5230bbac7770f1f0c8cc163a5f4 (set_patient_recall unchanged,
-- 415b5c8ff3157c8e4370cfce2f87558f). Backfill when applied: no import had run, 0 recalls set.
-- Rehearsed (rolled back) with invented rows and simulated logins. Two imports run first with the old functions set 0
-- recalls (lists only). The backfill then gave the finished one's month list "the 1st of next month" and its overdue
-- list "today" (reasons say so), left its "later" entry and an entry taken off the list without one, and gave the
-- unfinished one its exact day and tidied reason (3 set, all as the importing administrator). A new import (after the
-- file) set a new patient's recall (open, on its list, in the list facts), set a 100-day-overdue one due today with
-- Eminance's date in the reason, refused one 6 years ahead with the reason on the row, did not record a recall staff had
-- already set with the same day and reason, and kept a skipped row's reason. A booking made the overdue one "booked".
-- The undo was refused while staff had added a recall to the imported patient ("patient recalls were added ..."), then
-- removed the import's untouched recalls, kept the one staff had moved and staff's own, and left 0 records. The
-- practice's receptionist read the recall but could not run the step or continue the import (42501); another
-- practice's staff read 0 and could not run the step (42501); anon could neither run it nor read recalls (42501).
-- =============================================================================================
-- PROPOSAL: recalls brought over from Eminance also become the patient's own recall, so they come due and close
--           when the patient books (parity O3 and O5; integration review D3)
-- File:   proposals/2026-10-13-eminance-recalls.sql                           Drafted: 2026-10-13
-- Code:   the import screens call legacy_import_continue() as before (src/services/import/eminanceImportService.ts);
--         the diary report's "Move to a recall list" sets its recalls in the app through set_patient_recall()
--         (src/utils/diary/reportRecalls.ts, src/components/appointments/diary/DiaryReportModal.tsx)
--
-- Why: the Eminance import put each recall's patient on a manual list ("Eminance recalls: Nov 2026") and nothing more.
-- A list entry never comes due (the "Recall due" list and the diary report's "Recalled but not seen" read
-- patient_recalls) and never closes when the patient books, so staff had to clear the lists by hand.
--
-- What it does
--   1. legacy_import_records may record a recall (kind 'recall'), so an undo knows which recalls the import set.
--   2. legacy_import_set_recall(): the one step that turns an Eminance recall into the patient's recall, through
--      set_patient_recall() and so its rules (a day from today up to five years ahead, a reason of 2 to 120
--      characters, the same day and reason twice gives the one already there, at most 10 still to come, the person
--      setting it an active staff member of the practice). A recall day that has passed is due the day it is brought
--      over, with Eminance's day in the reason ("6-monthly check-up (Eminance date 3 Mar 2026)"); a day more than five
--      years ahead stays on the list only. A recall it cannot set never stops the list entry: the row's outcome says
--      why ('On "Eminance recalls: Nov 2026"; no recall set: ...').
--   3. legacy_import_recalls(): as proposals/2026-10-07-eminance-import.sql section 6d left it, plus step 2 per row.
--   4. legacy_import_undo_step(): as that file's section 8 left it, plus removing the recalls the import set (first;
--      one that staff changed since is theirs now and stays, as the Eminance number does). A recall staff set on an
--      imported patient still stops the undo (legacy_import_work_done looks at every table that refers to them).
--   5. Backfill: imports that ran before this file get the same recalls, set as the administrator who ran them (else
--      the practice's first active administrator). Rows of an import still running hold the day and reason; a
--      finished import kept only its list entries, so the list's name gives the day: the 1st of its month
--      ("Eminance recalls: Nov 2026"; today when that month has begun), today for "overdue" (the reason says so);
--      "later" lists (over 12 months ahead) and renamed lists get none. Patients taken off the list since are left
--      alone. When this was written no import had run (0 runs, 0 Eminance recall lists).
--   6. Checks: the kind check, the functions' rights (app logins cannot run the new step), nothing for the public key.
--   Needs proposals/2026-10-07-eminance-import.sql and proposals/2026-10-12-patient-recalls.sql (section 0 stops when
--   either import function was changed since, unless it is this file's own version).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then imported recalls go on the lists only, as before.
-- Undo (imports go back to list entries only; recalls already set stay and can be removed on the patient file):
--   legacy_import_recalls() and legacy_import_undo_step() as proposals/2026-10-07-eminance-import.sql has them;
--   DROP FUNCTION IF EXISTS public.legacy_import_set_recall(uuid, uuid, uuid, text, text);
--   the kind check without 'recall', once no import records one (an undo of such an import first, with this file's
--   legacy_import_undo_step, so its recalls go with it).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Stop before changing anything when what this file builds on is not as expected
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_recalls text;
  v_undo    text;
BEGIN
  IF to_regprocedure('public.set_patient_recall(uuid,uuid,date,text,uuid,uuid)') IS NULL
     OR to_regprocedure('public.legacy_import_recalls(uuid,integer)') IS NULL
     OR to_regprocedure('public.legacy_import_undo_step(uuid)') IS NULL
     OR to_regprocedure('public.dc_day_label(date)') IS NULL THEN
    RAISE EXCEPTION 'Stopped: needs proposals/2026-10-07-eminance-import.sql and proposals/2026-10-12-patient-recalls.sql';
  END IF;
  SELECT prosrc INTO v_recalls FROM pg_proc WHERE oid = 'public.legacy_import_recalls(uuid,integer)'::regprocedure;
  SELECT prosrc INTO v_undo FROM pg_proc WHERE oid = 'public.legacy_import_undo_step(uuid)'::regprocedure;
  -- The import file's text (md5 of the function body), or this file's own version when it runs again
  IF md5(v_recalls) <> '2f2ff8463fbbe84ceaeb8d798164a02c' AND position('legacy_import_set_recall' IN v_recalls) = 0 THEN
    RAISE EXCEPTION 'Stopped: legacy_import_recalls() changed since proposals/2026-10-07-eminance-import.sql; merge section 3 by hand';
  END IF;
  IF md5(v_undo) <> '5d391fd8859ef8418eacee054302cdfc' AND position('kind = ''recall''' IN v_undo) = 0 THEN
    RAISE EXCEPTION 'Stopped: legacy_import_undo_step() changed since proposals/2026-10-07-eminance-import.sql; merge section 4 by hand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The import may record the recalls it set (for its undo)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.legacy_import_records DROP CONSTRAINT IF EXISTS legacy_import_records_kind_check;
ALTER TABLE public.legacy_import_records ADD CONSTRAINT legacy_import_records_kind_check
  CHECK (kind = ANY (ARRAY['patient', 'medical_aid', 'family_link', 'alert', 'visit', 'invoice', 'list', 'list_member',
                           'legacy_number', 'recall']));

-- ---------------------------------------------------------------------------------------------
-- 2. An Eminance recall as the patient's recall (the import and the backfill both use this one step)
-- ---------------------------------------------------------------------------------------------

/*
  Sets the patient's recall through set_patient_recall() (its rules and its check of who sets it) and returns the words
  added to the row's outcome: "recall 14 Nov 2026", or "no recall set: <why>". It never raises: the list entry stands
  whatever happens here. A recall it adds (not one the patient already had with the same day and reason) is recorded,
  with its day and reason, so the undo removes it while it is as the import set it.
*/
CREATE OR REPLACE FUNCTION public.legacy_import_set_recall(p_run_id uuid, p_practice_id uuid, p_patient_id uuid, p_due_on text, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today  date := (now() AT TIME ZONE 'Africa/Windhoek')::date;
  v_reason text := btrim(regexp_replace(COALESCE(p_reason, ''), '\s+', ' ', 'g'));
  v_note   text := '';
  v_due_on date;
  v_due    date;
  v_before integer;
  v_id     uuid;
BEGIN
  IF btrim(COALESCE(p_due_on, '')) !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN 'no recall set: the recall date is missing';
  END IF;
  v_due_on := btrim(p_due_on)::date;
  IF v_due_on > (v_today + interval '5 years')::date THEN
    RETURN 'no recall set: its date is more than five years ahead';
  END IF;
  IF char_length(v_reason) < 2 THEN
    v_reason := 'Recall from Eminance';
  END IF;
  -- A day that has passed is due today (a recall is never set in the past); Eminance's day stays in the reason
  IF v_due_on < v_today THEN
    v_note := ' (Eminance date ' || dc_day_label(v_due_on) || ')';
  END IF;
  v_reason := btrim(left(v_reason, 120 - char_length(v_note))) || v_note;
  v_due := GREATEST(v_due_on, v_today);

  SELECT count(*) INTO v_before FROM patient_recalls WHERE patient_id = p_patient_id;
  v_id := public.set_patient_recall(p_practice_id, p_patient_id, v_due, v_reason, NULL, NULL);
  IF (SELECT count(*) FROM patient_recalls WHERE patient_id = p_patient_id) > v_before THEN
    INSERT INTO legacy_import_records (run_id, kind, record_id, patient_id, details)
    SELECT p_run_id, 'recall', r.id, r.patient_id, jsonb_build_object('due_on', r.due_on, 'reason', r.reason)
      FROM patient_recalls r
     WHERE r.id = v_id;
  END IF;
  RETURN 'recall ' || dc_day_label(v_due);
EXCEPTION WHEN others THEN
  RETURN left('no recall set: ' || SQLERRM, 200);
END $$;

REVOKE ALL ON FUNCTION public.legacy_import_set_recall(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Recall rows: the list entry as before, and the patient's recall (section 2)
-- ---------------------------------------------------------------------------------------------

/*
  6d. Recall dates: payload { "patient_key", "due_date", "reason"?, "list_name", "list_description"? }
  The patient goes on the practice's manual patient list of that month (the wizard names it, e.g.
  "Eminance recalls: Nov 2026"), where staff can see and message them, and gets the recall on their file, which
  comes due on its day and closes when they book (proposals/2026-10-13-eminance-recalls.sql).
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
  v_recall  text;
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
      -- The patient's own recall: due on its day, done once they book (never stops the list entry)
      v_recall := legacy_import_set_recall(p_run_id, v_run.practice_id, v_patient, r.payload ->> 'due_date', r.payload ->> 'reason');
      UPDATE legacy_import_rows SET status = CASE WHEN v_member IS NULL THEN 'matched' ELSE 'created' END, patient_id = v_patient,
             processed_at = now(),
             reason = CASE WHEN v_member IS NULL THEN 'Already on "' || v_name || '"' ELSE 'On "' || v_name || '"' END || '; ' || v_recall
       WHERE id = r.id;
    EXCEPTION WHEN others THEN
      UPDATE legacy_import_rows SET status = 'skipped', patient_id = v_patient, processed_at = now(), reason = left(SQLERRM, 300) WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_count;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Undo: the recalls the import set go first, then everything as before
-- ---------------------------------------------------------------------------------------------

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

  -- The patients' recalls the import set (one staff changed since is theirs now and stays, as the Eminance number does)
  v_ids := ARRAY(SELECT record_id FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'recall' LIMIT 500);
  IF cardinality(v_ids) > 0 THEN
    DELETE FROM patient_recalls r
     USING legacy_import_records d
     WHERE d.run_id = p_run_id AND d.kind = 'recall' AND d.record_id = r.id AND r.id = ANY (v_ids)
       AND r.due_on = (d.details ->> 'due_on')::date AND r.reason = d.details ->> 'reason';
    DELETE FROM legacy_import_records WHERE run_id = p_run_id AND kind = 'recall' AND record_id = ANY (v_ids);
    RETURN cardinality(v_ids);
  END IF;

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

-- ---------------------------------------------------------------------------------------------
-- 5. Backfill: the recalls of imports that ran before this file
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_today  date := (now() AT TIME ZONE 'Africa/Windhoek')::date;
  v_run    record;
  v_entry  record;
  v_by     uuid;
  v_suffix text;
  v_month  date;
  v_due    date;
  v_reason text;
  v_outcome text;
  v_runs   integer := 0;
  v_seen   integer := 0;
  v_set    integer := 0;
  v_none   integer := 0;
  v_before integer;
BEGIN
  SELECT count(*) INTO v_before FROM legacy_import_records WHERE kind = 'recall';
  FOR v_run IN
    SELECT id, practice_id, created_by FROM legacy_import_runs WHERE status IN ('importing', 'imported') ORDER BY created_at, id
  LOOP
    -- set_patient_recall() checks who sets a recall: the administrator who ran the import while still active in the
    -- practice, else the practice's first active administrator (none: this import's entries get no recall)
    v_by := NULL;
    SELECT u.id INTO v_by FROM users u
     WHERE u.practice_id = v_run.practice_id AND COALESCE(u.is_active, true) AND u.role = 'admin'
     ORDER BY (u.id = v_run.created_by) DESC, u.created_at, u.id
     LIMIT 1;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_by, 'role', 'authenticated')::text, true);
    v_runs := v_runs + 1;

    -- Each list entry the import made that is still there, with the row that made it (the row holds the day and
    -- reason until its import finishes); a patient who already has a recall from this import is done
    FOR v_entry IN
      SELECT d.patient_id, l.name AS list_name, x.payload
        FROM legacy_import_records d
        JOIN patient_list_members m ON m.id = d.record_id
        JOIN patient_lists l ON l.id = m.list_id
        LEFT JOIN LATERAL (
          SELECT r.payload FROM legacy_import_rows r
           WHERE r.run_id = d.run_id AND r.kind = 'recall' AND r.patient_id = d.patient_id AND r.payload ->> 'list_name' = l.name
           ORDER BY r.id
           LIMIT 1
        ) x ON true
       WHERE d.run_id = v_run.id AND d.kind = 'list_member' AND d.patient_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM legacy_import_records k WHERE k.run_id = d.run_id AND k.kind = 'recall' AND k.patient_id = d.patient_id)
       ORDER BY d.id
    LOOP
      v_seen := v_seen + 1;
      IF v_by IS NULL THEN
        v_none := v_none + 1;
        CONTINUE;
      END IF;
      IF v_entry.payload ? 'due_date' THEN
        v_outcome := legacy_import_set_recall(v_run.id, v_run.practice_id, v_entry.patient_id, v_entry.payload ->> 'due_date', v_entry.payload ->> 'reason');
      ELSE
        -- A finished import: the day from the list's name ("Eminance recalls: Nov 2026", "...: overdue")
        v_suffix := btrim(substr(v_entry.list_name, char_length('Eminance recalls:') + 1));
        v_due := NULL;
        IF v_entry.list_name NOT LIKE 'Eminance recalls:%' THEN
          v_due := NULL;
        ELSIF v_suffix = 'overdue' THEN
          v_due := v_today;
          v_reason := 'Recall from Eminance (overdue when brought over)';
        ELSIF v_suffix ~ '^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$' THEN
          v_month := to_date('01 ' || v_suffix, 'DD Mon YYYY');
          v_due := GREATEST(v_month, v_today);
          v_reason := 'Recall from Eminance (due ' || to_char(v_month, 'FMMon YYYY') || ')';
        END IF;
        IF v_due IS NULL THEN
          v_none := v_none + 1;
          CONTINUE;
        END IF;
        v_outcome := legacy_import_set_recall(v_run.id, v_run.practice_id, v_entry.patient_id, v_due::text, v_reason);
      END IF;
      IF v_outcome LIKE 'no recall set%' THEN
        v_none := v_none + 1;
      END IF;
    END LOOP;
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT count(*) - v_before INTO v_set FROM legacy_import_records WHERE kind = 'recall';
  RAISE NOTICE 'Eminance recalls backfilled: % imports, % list entries, % recalls set, % without a recall', v_runs, v_seen, v_set, v_none;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.legacy_import_records'::regclass
                    AND conname = 'legacy_import_records_kind_check' AND pg_get_constraintdef(oid) LIKE '%''recall''%') THEN
    RAISE EXCEPTION 'check failed: legacy_import_records does not take a recall';
  END IF;
  IF has_function_privilege('anon', 'public.legacy_import_set_recall(uuid, uuid, uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.legacy_import_set_recall(uuid, uuid, uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.legacy_import_recalls(uuid, integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.legacy_import_recalls(uuid, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.legacy_import_undo_step(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.legacy_import_undo_step(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: an app login can run an import step directly';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.set_patient_recall(uuid, uuid, date, text, uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: staff can no longer set recalls';
  END IF;
  RAISE NOTICE 'Eminance recalls ready: the kind check and the functions'' rights checked';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Result (read only): the recalls imports set, by import status (counts only)
-- ---------------------------------------------------------------------------------------------
SELECT r.status, count(d.id) AS recalls_set
  FROM legacy_import_runs r
  LEFT JOIN legacy_import_records d ON d.run_id = r.id AND d.kind = 'recall'
 GROUP BY r.status
 ORDER BY r.status;

ROLLBACK;

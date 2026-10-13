-- Applied 2026-10-12 as migration patient_recalls_2026_10_12 (version 20261012192103; stored statement md5 296e991df597e3a228aaf668c67fcbdb = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 afterwards: set_patient_recall 415b5c8ff3157c8e4370cfce2f87558f, remove_patient_recall 583660013b65ba8561eb4f7302041244, patient_list_facts 37adb30267f9bc22c734554926118d36; 2 policies (read, portal guard).
-- Rehearsed twice (rolled back) with simulated logins: a receptionist set a recall from a visit (reason trimmed, open), the same
-- date and reason again gave the same one; past, 5-year-plus, 1-letter and another patient's visit refused (22023), direct
-- insert refused (42501); facts showed its date. Its own visit and a visit the day it was set left it open; another booking
-- made it booked and the facts moved to the next recall; a booking 40 days early left a recall open, 10 days early booked it,
-- a no-show opened it again, a completed visit made it seen. A doctor changed and removed one (removed twice, changed after
-- removing: P0002). Another practice's doctor read 0 and could not set, remove or read the facts (42501); anon 42501.
-- Every other patient-list fact was unchanged for the largest practice.
-- =============================================================================================
-- PROPOSAL: a recall date and reason per patient, done when a matching booking is made (parity O3, O5)
-- File:   proposals/2026-10-12-patient-recalls.sql                       Drafted: 2026-10-12
-- Code:   src/utils/patientLists/recalls.ts (wording and checks, unit tested), listRules.ts ("Recall due" honours it)
--         src/services/patientRecallService.ts, src/components/patientLists/PatientRecallControl.tsx, RecallSheet.tsx,
--         RecalledNotSeenSheet.tsx; the booking's actions (VisitActionModal.tsx) set one from a visit
--
-- Why (parity O3): Eminance keeps a recall per patient (date, reason, e.g. "6-monthly check-up", "Review blood
-- pressure"), set on the file or when the visit is billed, and its recall lists and "No shows (recalled but not
-- seen)" report read it. OneHealth's recall lists only knew "months since the last visit" or "last billed code".
--
-- What it does (additive: no existing table, policy or row is changed)
--   1. patient_recalls: a patient's recall (date, reason, the visit it was set from, the day it was set). Removing one
--      keeps the row (removed_at), so "recalled but not seen" and the file keep their history.
--   2. patient_recall_status (a view with the caller's rights): the ONE rule for when a recall is done. A booking of
--      the patient completes it when it is for a day after the recall was set and no earlier than 30 days before the
--      recall date, and is not cancelled or missed (and is not the visit it was set from). status: 'open', 'booked'
--      (a matching booking still to come), 'seen' (a matching visit completed) or 'removed'. A matching booking that
--      is cancelled or missed later stops matching, so the recall is open again (and overdue: "recalled but not seen").
--   3. RLS: staff of the practice (and OneHealth support) read; nobody writes directly. The patient app's guard.
--   4. set_patient_recall() and remove_patient_recall(): any active staff member of the practice. A date from today
--      up to five years ahead, a reason of 2 to 120 characters; the same date and reason twice gives the one there.
--   5. patient_list_facts() also returns recall_on and recall_reason: the patient's earliest open recall. "Recall
--      due" (src/utils/patientLists/listRules.ts) puts a patient on the list on their own recall date instead of
--      after the months rule; every other fact is unchanged (checked in section 6).
--   Needs practice isolation's rls_my_practice_id() and rls_is_super_admin(), patient lists' patient_list_facts() as
--   proposals/2026-10-08-optometry.sql left it (17 columns) and patient_lists_can_access().
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the file's Recall button says recalls are not set up yet and the lists work as before.
-- The scheduled list sender (supabase/functions-proposals/patient-list-automations, not deployed yet) imports
-- listRules.ts, so it honours recall dates once it is deployed.
-- Undo (recalls are lost; the lists go back to the months rule):
--   DROP FUNCTION IF EXISTS public.set_patient_recall(uuid, uuid, date, text, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.remove_patient_recall(uuid, uuid);
--   patient_list_facts() as proposals/2026-10-08-optometry.sql section 10 has it (DROP FUNCTION first: fewer columns);
--   DROP VIEW IF EXISTS public.patient_recall_status;
--   DROP TABLE IF EXISTS public.patient_recalls;
-- =============================================================================================

BEGIN;

-- Stop before changing anything when the functions and columns this file builds on are not as expected
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(signature, ', ') INTO v_missing
    FROM (VALUES ('public.rls_my_practice_id()'), ('public.rls_is_super_admin()'),
                 ('public.patient_lists_can_access(uuid)'), ('public.patient_list_facts(uuid,date,uuid[])')) AS t(signature)
   WHERE to_regprocedure(signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
  IF pg_get_function_result('public.patient_list_facts(uuid,date,uuid[])'::regprocedure) IS DISTINCT FROM
     'TABLE(patient_id uuid, first_name text, last_name text, date_of_birth date, cell_number text, sms_opt_out boolean, '
     'last_completed_visit_on date, last_completed_by_type jsonb, last_billed_by_code jsonb, completed_visits_12m integer, '
     'next_booking_on date, next_booking_time text, last_no_show_on date, balance_due numeric, oldest_unpaid_on date, '
     'next_repeat_due_on date, contact_lenses_run_out_on date)' THEN
    RAISE EXCEPTION 'Stopped: patient_list_facts() is not as proposals/2026-10-08-optometry.sql left it; merge section 5 by hand';
  END IF;
END $$;

-- The facts of the practice with the most patients, as they are now (compared in section 6; no row is ever shown).
-- Read as the service role, which patient_lists_can_access() allows.
DO $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.practice_id IS NOT NULL
   GROUP BY p.practice_id ORDER BY count(*) DESC, p.practice_id LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE format('CREATE TEMP TABLE recall_facts_before ON COMMIT DROP AS SELECT %L::uuid AS practice_id, f.* FROM public.patient_list_facts(%L::uuid, %L::date) f',
                 v_practice, v_practice, (now() AT TIME ZONE 'Africa/Windhoek')::date);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. patient_recalls
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patient_recalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- The day the patient should come back (src/utils/patientLists/recalls.ts RECALL_LIMITS)
  due_on date NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 120 AND reason = btrim(reason)),
  -- The visit it was set from (null: set on the patient file); that visit never completes it
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  -- The practice's day it was set (Windhoek): only a booking for a later day completes it
  set_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Windhoek')::date),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid
);

COMMENT ON TABLE public.patient_recalls IS
  'A patient''s recall: come back on due_on for reason. Done when a matching booking is made (patient_recall_status). '
  'Written only by set_patient_recall() and remove_patient_recall(); removing keeps the row (removed_at).';

CREATE INDEX IF NOT EXISTS patient_recalls_practice_due_idx ON public.patient_recalls (practice_id, due_on) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS patient_recalls_patient_idx ON public.patient_recalls (patient_id);

-- ---------------------------------------------------------------------------------------------
-- 2. patient_recall_status: when a recall is done (the one place this rule lives)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.patient_recall_status WITH (security_invoker = true) AS
SELECT r.id,
       r.practice_id,
       r.patient_id,
       r.due_on,
       r.reason,
       r.visit_id,
       r.set_on,
       r.created_by,
       r.created_at,
       r.removed_at,
       m.id AS matched_visit_id,
       m.day AS matched_on,
       CASE
         WHEN r.removed_at IS NOT NULL THEN 'removed'
         WHEN m.id IS NULL THEN 'open'
         WHEN m.seen THEN 'seen'
         ELSE 'booked'
       END AS status
  FROM public.patient_recalls r
  LEFT JOIN LATERAL (
    -- A booking for a day after the recall was set, no earlier than 30 days before the recall date, not cancelled
    -- or missed; a completed one first (the patient came), else the soonest still to come
    SELECT v.id,
           COALESCE(v.scheduled_date, v.visit_date)::date AS day,
           (lower(btrim(COALESCE(v.status, ''))) = 'completed') AS seen
      FROM public.visits v
     WHERE v.patient_id = r.patient_id
       AND v.id IS DISTINCT FROM r.visit_id
       AND NOT COALESCE(v.is_cancelled, false)
       AND lower(btrim(COALESCE(v.status, ''))) NOT IN ('cancelled', 'no-show', 'no_show')
       AND COALESCE(v.scheduled_date, v.visit_date)::date > r.set_on
       AND COALESCE(v.scheduled_date, v.visit_date)::date >= r.due_on - 30
     ORDER BY (lower(btrim(COALESCE(v.status, ''))) = 'completed') DESC, COALESCE(v.scheduled_date, v.visit_date), v.id
     LIMIT 1
  ) m ON r.removed_at IS NULL;

COMMENT ON VIEW public.patient_recall_status IS
  'Each recall with the booking that completes it: one for a day after the recall was set and no earlier than 30 days '
  'before its date, not cancelled or missed. status open / booked / seen / removed. Runs with the caller''s rights.';

-- ---------------------------------------------------------------------------------------------
-- 3. Who reads and who changes them
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.patient_recalls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_recalls FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_recalls TO authenticated;
GRANT ALL ON public.patient_recalls TO service_role;
REVOKE ALL ON public.patient_recall_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_recall_status TO authenticated, service_role;

DROP POLICY IF EXISTS patient_recalls_read ON public.patient_recalls;
CREATE POLICY patient_recalls_read ON public.patient_recalls FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.patient_recalls';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.patient_recalls AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Setting, changing and removing a recall (any active staff member of the practice)
-- ---------------------------------------------------------------------------------------------

-- Sets a recall (p_recall_id null) or changes the date and reason of one still in force; returns its id
CREATE OR REPLACE FUNCTION public.set_patient_recall(
  p_practice_id uuid,
  p_patient_id uuid,
  p_due_on date,
  p_reason text,
  p_visit_id uuid DEFAULT NULL,
  p_recall_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := btrim(regexp_replace(COALESCE(p_reason, ''), '\s+', ' ', 'g'));
  v_today date := (now() AT TIME ZONE 'Africa/Windhoek')::date;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_practice_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.practice_id = p_practice_id
  ) THEN
    RAISE EXCEPTION 'You can only set recalls for patients of your own practice.' USING ERRCODE = '42501';
  END IF;
  IF p_patient_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = p_patient_id AND p.practice_id = p_practice_id
  ) THEN
    RAISE EXCEPTION 'This patient is not a patient of the practice.' USING ERRCODE = '42501';
  END IF;
  IF p_due_on IS NULL OR p_due_on < v_today OR p_due_on > (v_today + interval '5 years')::date THEN
    RAISE EXCEPTION 'Choose a recall date from today up to five years ahead.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Say what the recall is for, in 2 to 120 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_visit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.visits v WHERE v.id = p_visit_id AND v.patient_id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'That visit is not this patient''s.' USING ERRCODE = '22023';
  END IF;

  IF p_recall_id IS NOT NULL THEN
    UPDATE public.patient_recalls r
       SET due_on = p_due_on, reason = v_reason
     WHERE r.id = p_recall_id AND r.practice_id = p_practice_id AND r.patient_id = p_patient_id AND r.removed_at IS NULL
    RETURNING r.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'This recall was removed, or it is not this patient''s.' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
  END IF;

  -- The same recall twice (a second tap): the one already there
  SELECT r.id INTO v_id
    FROM public.patient_recalls r
   WHERE r.practice_id = p_practice_id AND r.patient_id = p_patient_id AND r.removed_at IS NULL
     AND r.due_on = p_due_on AND lower(r.reason) = lower(v_reason)
   ORDER BY r.created_at
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  IF (SELECT count(*) FROM public.patient_recalls r
       WHERE r.patient_id = p_patient_id AND r.removed_at IS NULL AND r.due_on >= v_today) >= 10 THEN
    RAISE EXCEPTION 'This patient already has 10 recalls to come: remove one first.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.patient_recalls (practice_id, patient_id, due_on, reason, visit_id, set_on, created_by)
  VALUES (p_practice_id, p_patient_id, p_due_on, v_reason, p_visit_id, v_today, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Removes a recall (kept as history); staff of its practice
CREATE OR REPLACE FUNCTION public.remove_patient_recall(p_practice_id uuid, p_recall_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_practice_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.practice_id = p_practice_id
  ) THEN
    RAISE EXCEPTION 'You can only remove recalls of your own practice.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.patient_recalls r
     SET removed_at = now(), removed_by = auth.uid()
   WHERE r.id = p_recall_id AND r.practice_id = p_practice_id AND r.removed_at IS NULL
  RETURNING r.id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This recall was already removed.' USING ERRCODE = 'P0002';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.set_patient_recall(uuid, uuid, date, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_patient_recall(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_patient_recall(uuid, uuid, date, text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_patient_recall(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. Patient lists: patient_list_facts() also returns the patient's earliest open recall (recall_on,
--    recall_reason). As proposals/2026-10-08-optometry.sql left it, plus the recall CTE and two columns.
-- ---------------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.patient_list_facts(uuid, date, uuid[]);
CREATE OR REPLACE FUNCTION public.patient_list_facts(
  p_practice_id uuid,
  p_today date,
  p_patient_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(patient_id uuid, first_name text, last_name text, date_of_birth date, cell_number text, sms_opt_out boolean,
              last_completed_visit_on date, last_completed_by_type jsonb, last_billed_by_code jsonb, completed_visits_12m integer,
              next_booking_on date, next_booking_time text, last_no_show_on date, balance_due numeric, oldest_unpaid_on date,
              next_repeat_due_on date, contact_lenses_run_out_on date, recall_on date, recall_reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.patient_lists_can_access(p_practice_id) THEN
    RAISE EXCEPTION 'Not allowed to read this practice''s patients' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL THEN
    RAISE EXCEPTION 'p_today (the practice''s local date) is required' USING ERRCODE = '22004';
  END IF;

  RETURN QUERY
  WITH pts AS (
    SELECT p.id AS pid,
           p.first_name::text AS first_name,
           p.last_name::text AS last_name,
           p.date_of_birth::date AS date_of_birth,
           p.cell_number::text AS cell_number,
           COALESCE((to_jsonb(p) ->> 'sms_opt_out')::boolean, false) AS sms_opt_out
    FROM public.patients p
    WHERE p.practice_id = p_practice_id
      AND (p_patient_ids IS NULL OR p.id = ANY (p_patient_ids))
  ),
  vis AS (
    SELECT v.patient_id AS pid,
           lower(btrim(COALESCE(v.visit_type, ''))) AS visit_type,
           lower(btrim(COALESCE(v.status, ''))) AS status,
           COALESCE(v.is_cancelled, false) AS is_cancelled,
           COALESCE(v.visit_date, v.scheduled_date)::date AS happened_on,
           COALESCE(v.scheduled_date, v.visit_date)::date AS booked_on,
           COALESCE(v.scheduled_time::text, v.visit_time::text) AS booked_time
    FROM public.visits v
    JOIN pts ON pts.pid = v.patient_id
  ),
  visit_facts AS (
    SELECT vis.pid,
           MAX(vis.happened_on) FILTER (WHERE vis.status = 'completed' AND NOT vis.is_cancelled) AS last_completed_visit_on,
           (COUNT(*) FILTER (
              WHERE vis.status = 'completed' AND NOT vis.is_cancelled
                AND vis.happened_on > (p_today - INTERVAL '12 months')::date
                AND vis.happened_on <= p_today
           ))::integer AS completed_visits_12m,
           MAX(vis.booked_on) FILTER (
             WHERE vis.status IN ('no-show', 'no_show') AND NOT vis.is_cancelled AND vis.booked_on <= p_today
           ) AS last_no_show_on,
           MIN(vis.booked_on) FILTER (
             WHERE vis.booked_on >= p_today AND NOT vis.is_cancelled
               AND vis.status NOT IN ('cancelled', 'no-show', 'no_show', 'completed')
           ) AS next_booking_on
    FROM vis
    GROUP BY vis.pid
  ),
  by_type AS (
    SELECT t.pid, jsonb_object_agg(t.visit_type, t.last_on) AS last_completed_by_type
    FROM (
      SELECT vis.pid, vis.visit_type, MAX(vis.happened_on) AS last_on
      FROM vis
      WHERE vis.status = 'completed' AND NOT vis.is_cancelled
        AND vis.visit_type <> '' AND vis.happened_on IS NOT NULL
      GROUP BY vis.pid, vis.visit_type
    ) t
    GROUP BY t.pid
  ),
  -- Last date each tariff code was billed (recall by treatment, e.g. 8159 scale and polish): the visit's date,
  -- else the invoice date; cancelled invoices do not count
  billed AS (
    SELECT ie.patient_id AS pid,
           btrim(s.code) AS code,
           COALESCE(v.visit_date::date, ie.issue_date, (ie.created_at AT TIME ZONE 'Africa/Windhoek')::date) AS served_on
    FROM public.invoice_services s
    JOIN public.invoices_enhanced ie ON ie.id = s.invoice_id
    JOIN pts ON pts.pid = ie.patient_id
    LEFT JOIN public.visits v ON v.id = ie.visit_id
    WHERE COALESCE(NULLIF(lower(btrim(ie.payment_status)), ''), 'pending') <> 'cancelled'
      AND btrim(COALESCE(s.code, '')) <> ''
  ),
  by_code AS (
    SELECT c.pid, jsonb_object_agg(c.code, c.last_on) AS last_billed_by_code
    FROM (
      SELECT billed.pid, billed.code, MAX(billed.served_on) AS last_on
      FROM billed
      WHERE billed.served_on IS NOT NULL AND billed.served_on <= p_today
      GROUP BY billed.pid, billed.code
    ) c
    GROUP BY c.pid
  ),
  next_time AS (
    SELECT DISTINCT ON (vis.pid) vis.pid, vis.booked_time
    FROM vis
    JOIN visit_facts vf ON vf.pid = vis.pid AND vis.booked_on = vf.next_booking_on
    WHERE NOT vis.is_cancelled AND vis.status NOT IN ('cancelled', 'no-show', 'no_show', 'completed')
    ORDER BY vis.pid, vis.booked_time NULLS LAST
  ),
  owed AS (
    SELECT i.pid,
           SUM(i.patient_portion) AS balance_due,
           MIN(i.billed_on) AS oldest_unpaid_on
    FROM (
      SELECT ie.patient_id AS pid,
             CASE
               WHEN ie.patient_total IS NOT NULL THEN ie.patient_total
               ELSE GREATEST(COALESCE(ie.total, 0) - COALESCE(ie.medical_aid_total, 0), 0)
             END AS patient_portion,
             COALESCE(ie.issue_date, (ie.created_at AT TIME ZONE 'Africa/Windhoek')::date) AS billed_on
      FROM public.invoices_enhanced ie
      JOIN pts ON pts.pid = ie.patient_id
      WHERE COALESCE(NULLIF(lower(btrim(ie.payment_status)), ''), 'pending') NOT IN ('paid', 'cancelled')
    ) i
    WHERE i.patient_portion > 0
    GROUP BY i.pid
  ),
  -- Standing scripts with repeats left (not cancelled, still valid): the next repeat is due when the
  -- medicine last dispensed runs out (its day + its days of medicine). Scripts without days of medicine
  -- ("when needed") have no due day.
  repeat_due AS (
    SELECT d.patient_id AS pid,
           MIN(lastd.dispensed_on + COALESCE(lastd.days_supply, d.days_supply)) AS next_repeat_due_on
    FROM public.stock_dispensings d
    JOIN pts ON pts.pid = d.patient_id
    CROSS JOIN LATERAL (
      SELECT count(*) AS used FROM public.stock_dispensings r WHERE r.repeat_of = d.id AND r.cancelled_at IS NULL
    ) u
    CROSS JOIN LATERAL (
      SELECT x.dispensed_on, x.days_supply FROM public.stock_dispensings x
       WHERE (x.id = d.id OR x.repeat_of = d.id) AND x.cancelled_at IS NULL
       ORDER BY x.dispensed_on DESC, x.created_at DESC
       LIMIT 1
    ) lastd
    WHERE d.practice_id = p_practice_id AND d.repeat_of IS NULL AND d.cancelled_at IS NULL
      AND d.repeats_allowed > 0 AND u.used < d.repeats_allowed
      AND (d.valid_until IS NULL OR d.valid_until >= p_today)
      AND COALESCE(lastd.days_supply, d.days_supply) IS NOT NULL
    GROUP BY d.patient_id
  ),
  -- Contact lenses (proposals/2026-10-08-optometry.sql): the patient has lenses until the latest run-out
  -- day of the supplies they collected
  cl_due AS (
    SELECT s.patient_id AS pid, MAX(s.runs_out_on) AS contact_lenses_run_out_on
    FROM public.optometry_cl_supplies s
    JOIN pts ON pts.pid = s.patient_id
    WHERE s.practice_id = p_practice_id AND s.status = 'collected' AND s.runs_out_on IS NOT NULL
    GROUP BY s.patient_id
  ),
  -- The patient's earliest open recall (proposals/2026-10-12-patient-recalls.sql): set on the file or at a visit,
  -- not completed by a matching booking (patient_recall_status decides) and not removed
  recall AS (
    SELECT DISTINCT ON (s.patient_id) s.patient_id AS pid, s.due_on, s.reason
    FROM public.patient_recall_status s
    JOIN pts ON pts.pid = s.patient_id
    WHERE s.practice_id = p_practice_id AND s.status = 'open'
    ORDER BY s.patient_id, s.due_on, s.created_at, s.id
  )
  SELECT pts.pid,
         pts.first_name,
         pts.last_name,
         pts.date_of_birth,
         pts.cell_number,
         pts.sms_opt_out,
         vf.last_completed_visit_on,
         COALESCE(bt.last_completed_by_type, '{}'::jsonb),
         COALESCE(bc.last_billed_by_code, '{}'::jsonb),
         COALESCE(vf.completed_visits_12m, 0),
         vf.next_booking_on,
         nt.booked_time,
         vf.last_no_show_on,
         COALESCE(ow.balance_due, 0)::numeric,
         ow.oldest_unpaid_on,
         rd.next_repeat_due_on,
         cl.contact_lenses_run_out_on,
         rc.due_on,
         rc.reason
  FROM pts
  LEFT JOIN visit_facts vf ON vf.pid = pts.pid
  LEFT JOIN by_type bt ON bt.pid = pts.pid
  LEFT JOIN by_code bc ON bc.pid = pts.pid
  LEFT JOIN next_time nt ON nt.pid = pts.pid
  LEFT JOIN owed ow ON ow.pid = pts.pid
  LEFT JOIN repeat_due rd ON rd.pid = pts.pid
  LEFT JOIN cl_due cl ON cl.pid = pts.pid
  LEFT JOIN recall rc ON rc.pid = pts.pid
  ORDER BY pts.last_name, pts.first_name, pts.pid;
END
$function$;

COMMENT ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) IS
  'One row of facts per patient of a practice for the patient lists (src/utils/patientLists/listRules.ts decides who is on '
  'which list). recall_on / recall_reason: the earliest open recall (patient_recall_status).';
REVOKE ALL ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks: the patient app's guard, nothing for the public key, the functions' rights, and every
--    other patient-list fact exactly as before this file
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_practice uuid;
  v_missing integer;
  v_added integer;
  v_columns text := 'patient_id, first_name, last_name, date_of_birth, cell_number, sms_opt_out, last_completed_visit_on, '
    'last_completed_by_type, last_billed_by_code, completed_visits_12m, next_booking_on, next_booking_time, last_no_show_on, '
    'balance_due, oldest_unpaid_on, next_repeat_due_on, contact_lenses_run_out_on';
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.patient_recalls'::regclass) THEN
    RAISE EXCEPTION 'check failed: row level security is off on patient_recalls';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = 'public.patient_recall_status'::regclass
                    AND 'security_invoker=true' = ANY (COALESCE(c.reloptions, '{}'))) THEN
    RAISE EXCEPTION 'check failed: patient_recall_status does not run with the caller''s rights';
  END IF;
  IF has_table_privilege('anon', 'public.patient_recalls', 'SELECT')
     OR has_table_privilege('anon', 'public.patient_recall_status', 'SELECT')
     OR has_table_privilege('authenticated', 'public.patient_recalls', 'INSERT')
     OR has_table_privilege('authenticated', 'public.patient_recalls', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.patient_recalls', 'DELETE') THEN
    RAISE EXCEPTION 'check failed: the public key reads recalls, or staff can write them directly';
  END IF;
  IF has_function_privilege('anon', 'public.set_patient_recall(uuid, uuid, date, text, uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.remove_patient_recall(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.patient_list_facts(uuid, date, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: the public key can run a recall or list function';
  END IF;

  SELECT b.practice_id INTO v_practice FROM recall_facts_before b LIMIT 1;
  IF v_practice IS NULL THEN
    RAISE NOTICE 'No patients: the patient-list facts comparison was skipped';
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE format('SELECT count(*) FROM (SELECT %s FROM recall_facts_before EXCEPT SELECT %s FROM public.patient_list_facts(%L::uuid, %L::date)) d',
                 v_columns, v_columns, v_practice, (now() AT TIME ZONE 'Africa/Windhoek')::date) INTO v_missing;
  EXECUTE format('SELECT count(*) FROM (SELECT %s FROM public.patient_list_facts(%L::uuid, %L::date) EXCEPT SELECT %s FROM recall_facts_before) d',
                 v_columns, v_practice, (now() AT TIME ZONE 'Africa/Windhoek')::date, v_columns) INTO v_added;
  PERFORM set_config('request.jwt.claims', '', true);
  IF v_missing <> 0 OR v_added <> 0 THEN
    RAISE EXCEPTION 'check failed: patient_list_facts() changed other facts (% rows differ, % new)', v_missing, v_added;
  END IF;
  RAISE NOTICE 'patient recalls ready: row level security on, the view, the functions'' rights and the patient-list facts checked';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Result (read only): the policies and the recalls (none yet)
-- ---------------------------------------------------------------------------------------------

SELECT tablename, policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'patient_recalls' ORDER BY policyname;
SELECT count(*) AS recalls FROM public.patient_recalls;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

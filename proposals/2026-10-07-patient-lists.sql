-- =============================================================================================
-- PROPOSAL, NOT APPLIED: patient lists (manual and smart) with message automation
-- File:    proposals/2026-10-07-patient-lists.sql                    Drafted: 2026-10-07
-- Code:    src/utils/patientLists/* (rules, messages, sending), src/services/patientListService.ts,
--          src/components/patientLists/* (Lists page, "Add to list", per-patient "Lists")
-- Sender:  supabase/functions-proposals/patient-list-automations/index.ts (not deployed)
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Review. Run it on a Supabase branch (or a copy of the database) with the final ROLLBACK
--      changed to COMMIT. Check in the app: Patients > select patients > "Add to list", a
--      patient's file > "Lists", and the Lists page (Communications). Until this is applied those
--      screens show "Automation lists are not switched on yet" and change nothing.
--   2. Apply to production the same way.
--   3. Scheduled sending (section 6) is separate and stays off until the edge function is deployed
--      and has been tried in dry-run mode. "Send now" works as soon as steps 1-2 are done; it sends
--      through the centralized SMS gateway like every other SMS.
--
-- Contents
--   0. Access helper
--   1. patient_lists: lists, the rule of a smart list, message settings
--   2. patient_list_members: people added by hand, exclusions, and what was sent to whom
--   3. RLS (same rule as existing tables: the user's practice in public.users)
--   4. patient_list_facts(): one row of facts per patient
--   5. claim_patient_list_sends() / release_patient_list_send(): "never the same message twice"
--   6. (Commented out) the 15-minute schedule (pg_cron + pg_net) for the edge function
--
-- How smart lists stay up to date
--   Membership is worked out when a list is read, never stored, so nothing has to be refreshed
--   and a list is never stale. patient_list_facts() returns facts per patient (last completed
--   visit, next booking, last missed appointment, balance owed...) and the rules in
--   src/utils/patientLists/listRules.ts decide who is on each list - the same tested code in the
--   browser and in the scheduled sender. patient_list_members only holds people added by hand,
--   exclusions, and the per-patient record of the last message (the once-per-period guard).
--
-- Opt-out: patients.sms_opt_out is added by another change. patient_list_facts() reads it through
-- to_jsonb(), so it works before and after that column exists (missing = not opted out).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Access helper for the functions below (the tables use the usual inline RLS check).
--    The scheduled sender calls with the service role and may read every practice.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.patient_lists_can_access(p_practice_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(auth.role(), '') = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.practice_id = p_practice_id
      )
$$;
COMMENT ON FUNCTION public.patient_lists_can_access(uuid) IS
  'True when the signed-in user belongs to the practice, or the caller is the service role (scheduled sender).';

-- ---------------------------------------------------------------------------------------------
-- 1. patient_lists
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patient_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 300),
  kind text NOT NULL CHECK (kind IN ('manual', 'smart')),
  -- Smart lists only; the shape is checked in code (listRules.ts validateRule), e.g.
  -- {"type":"birthday","window":"today"}, {"type":"recall_due","months":6,"visitTypes":[]},
  -- {"type":"lapsed","months":12}, {"type":"outstanding_balance","minDays":30,"minAmount":1},
  -- {"type":"missed_appointment","withinDays":14}, {"type":"regular_follow_up","everyDays":30,"minVisitsInYear":3}
  rule jsonb,
  -- Message settings, checked in code (listAutomation.ts): template, schedule ('manual' | 'daily' |
  -- 'birthday_morning'), sendTime, quietStart, quietEnd (HH:MM, Windhoek time), repeat
  -- ('day' | 'week' | 'month' | 'year' | 'ever')
  automation jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Scheduled sending on/off. A column (not in the jsonb) so the sender finds lists by index.
  automation_enabled boolean NOT NULL DEFAULT false,
  last_run_on date,          -- Windhoek date of the last scheduled run: at most one run a day
  last_run_at timestamptz,   -- last send of any kind (scheduled or "Send now")
  last_run_summary jsonb,    -- {mode, sent, failed, skipped, stopped, ...} shown on the list card
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_lists_rule_matches_kind CHECK (
    (kind = 'smart' AND rule IS NOT NULL AND jsonb_typeof(rule) = 'object' AND rule ? 'type')
    OR (kind = 'manual' AND rule IS NULL)
  ),
  CONSTRAINT patient_lists_automation_is_object CHECK (jsonb_typeof(automation) = 'object')
);
COMMENT ON TABLE public.patient_lists IS
  'Patient lists for reminders and greetings. Smart lists fill themselves from a rule; see proposals/2026-10-07-patient-lists.sql.';

CREATE INDEX IF NOT EXISTS patient_lists_practice_idx ON public.patient_lists (practice_id);
-- One name per practice, ignoring case and outer spaces ("Recall due" = "recall due ")
CREATE UNIQUE INDEX IF NOT EXISTS patient_lists_practice_name_key
  ON public.patient_lists (practice_id, lower(btrim(name)));
-- The scheduled sender only looks at lists with automatic sending switched on
CREATE INDEX IF NOT EXISTS patient_lists_scheduled_idx
  ON public.patient_lists (practice_id) WHERE automation_enabled;

CREATE OR REPLACE FUNCTION public.patient_lists_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_lists_touch_updated_at ON public.patient_lists;
CREATE TRIGGER patient_lists_touch_updated_at
  BEFORE UPDATE ON public.patient_lists
  FOR EACH ROW EXECUTE FUNCTION public.patient_lists_touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- 2. patient_list_members
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patient_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.patient_lists(id) ON DELETE CASCADE,
  -- Copied from the list by the trigger below (kept for RLS); a client value is ignored
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- manual: added by hand. rule: a smart-list member whose row exists only because they were
  -- excluded or messaged (smart-list membership itself is never stored)
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'rule')),
  -- Taken off the list by staff (a smart list's rule may still match them)
  excluded boolean NOT NULL DEFAULT false,
  excluded_at timestamptz,
  excluded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  -- Once-per-period guard: the period of the last message from this list ('2026' once a year,
  -- '2026-10' a month, '2026-W41' a week, '2026-10-07' a day, 'once' only ever once)
  last_sent_period text,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_list_members_list_patient_key UNIQUE (list_id, patient_id)
);
COMMENT ON TABLE public.patient_list_members IS
  'People added to a list by hand, exclusions, and the record of the last list message per patient.';

-- (list_id, patient_id) is covered by the unique constraint
CREATE INDEX IF NOT EXISTS patient_list_members_patient_idx ON public.patient_list_members (patient_id);
CREATE INDEX IF NOT EXISTS patient_list_members_practice_idx ON public.patient_list_members (practice_id);

-- A patient can only be on a list of their own practice, whatever the client sends
CREATE OR REPLACE FUNCTION public.patient_list_members_check_practice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_list_practice uuid;
  v_patient_practice uuid;
BEGIN
  SELECT l.practice_id INTO v_list_practice FROM public.patient_lists l WHERE l.id = NEW.list_id;
  SELECT p.practice_id INTO v_patient_practice FROM public.patients p WHERE p.id = NEW.patient_id;
  IF v_list_practice IS NULL OR v_patient_practice IS DISTINCT FROM v_list_practice THEN
    RAISE EXCEPTION 'The patient and the list belong to different practices' USING ERRCODE = '23514';
  END IF;
  NEW.practice_id := v_list_practice;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS patient_list_members_check_practice ON public.patient_list_members;
CREATE TRIGGER patient_list_members_check_practice
  BEFORE INSERT OR UPDATE ON public.patient_list_members
  FOR EACH ROW EXECUTE FUNCTION public.patient_list_members_check_practice();

-- ---------------------------------------------------------------------------------------------
-- 3. RLS: staff see and change only their own practice's lists
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.patient_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_list_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_lists_select ON public.patient_lists;
CREATE POLICY patient_lists_select ON public.patient_lists FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_lists.practice_id));

DROP POLICY IF EXISTS patient_lists_insert ON public.patient_lists;
CREATE POLICY patient_lists_insert ON public.patient_lists FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_lists.practice_id));

DROP POLICY IF EXISTS patient_lists_update ON public.patient_lists;
CREATE POLICY patient_lists_update ON public.patient_lists FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_lists.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_lists.practice_id));

DROP POLICY IF EXISTS patient_lists_delete ON public.patient_lists;
CREATE POLICY patient_lists_delete ON public.patient_lists FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_lists.practice_id));

DROP POLICY IF EXISTS patient_list_members_select ON public.patient_list_members;
CREATE POLICY patient_list_members_select ON public.patient_list_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_list_members.practice_id));

DROP POLICY IF EXISTS patient_list_members_insert ON public.patient_list_members;
CREATE POLICY patient_list_members_insert ON public.patient_list_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_list_members.practice_id));

DROP POLICY IF EXISTS patient_list_members_update ON public.patient_list_members;
CREATE POLICY patient_list_members_update ON public.patient_list_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_list_members.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_list_members.practice_id));

DROP POLICY IF EXISTS patient_list_members_delete ON public.patient_list_members;
CREATE POLICY patient_list_members_delete ON public.patient_list_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = patient_list_members.practice_id));

-- ---------------------------------------------------------------------------------------------
-- 4. patient_list_facts(): one row per patient of the practice (or of p_patient_ids), ordered by
--    surname. No rule logic here: listRules.ts decides who is on which list.
--
--    p_today is the practice's local date (Windhoek), passed by the caller so the database and the
--    code agree on "today" (the database session runs in UTC).
--    Visits: completed = status 'completed' and not cancelled (booked, missed and cancelled visits
--    never count as seen). A booking = dated today or later, not cancelled, missed or completed.
--    Money owed follows src/components/patients/patientBilling.ts: invoices that are not 'paid' or
--    'cancelled' (a missing status counts as pending); the patient's share is patient_total, or
--    total minus the medical aid portion when patient_total is empty.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.patient_list_facts(
  p_practice_id uuid,
  p_today date,
  p_patient_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  patient_id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  cell_number text,
  sms_opt_out boolean,
  last_completed_visit_on date,
  last_completed_by_type jsonb,
  completed_visits_12m integer,
  next_booking_on date,
  next_booking_time text,
  last_no_show_on date,
  balance_due numeric,
  oldest_unpaid_on date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  )
  SELECT pts.pid,
         pts.first_name,
         pts.last_name,
         pts.date_of_birth,
         pts.cell_number,
         pts.sms_opt_out,
         vf.last_completed_visit_on,
         COALESCE(bt.last_completed_by_type, '{}'::jsonb),
         COALESCE(vf.completed_visits_12m, 0),
         vf.next_booking_on,
         nt.booked_time,
         vf.last_no_show_on,
         COALESCE(ow.balance_due, 0)::numeric,
         ow.oldest_unpaid_on
  FROM pts
  LEFT JOIN visit_facts vf ON vf.pid = pts.pid
  LEFT JOIN by_type bt ON bt.pid = pts.pid
  LEFT JOIN next_time nt ON nt.pid = pts.pid
  LEFT JOIN owed ow ON ow.pid = pts.pid
  ORDER BY pts.last_name, pts.first_name, pts.pid;
END
$$;
COMMENT ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) IS
  'Facts per patient for patient lists (visits, bookings, no-shows, balance owed). Rules are applied in src/utils/patientLists/listRules.ts.';

-- ---------------------------------------------------------------------------------------------
-- 5. The once-per-period guard. Before a list message goes out, the patient is claimed for the
--    period (e.g. '2026' for a birthday). A second run at the same moment - the scheduled sender
--    while someone presses "Send now", or a double click - waits for the row lock, sees the
--    period already set and does not get the patient back, so it cannot send twice.
--    Excluded members are never claimed. A failed send is released so a later run can retry.
--    SECURITY INVOKER: the RLS policies above apply (the service role bypasses them).
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_patient_list_sends(p_list_id uuid, p_patient_ids uuid[], p_period text)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_practice_id uuid;
BEGIN
  IF p_period IS NULL OR btrim(p_period) = '' THEN
    RAISE EXCEPTION 'A send period is required' USING ERRCODE = '22004';
  END IF;
  SELECT l.practice_id INTO v_practice_id FROM public.patient_lists l WHERE l.id = p_list_id;
  IF v_practice_id IS NULL THEN
    RAISE EXCEPTION 'List not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    INSERT INTO public.patient_list_members AS m (list_id, practice_id, patient_id, source, last_sent_period, last_sent_at)
    SELECT p_list_id, v_practice_id, ids.pid, 'rule', p_period, now()
    FROM (SELECT DISTINCT unnest(p_patient_ids) AS pid) ids
    WHERE ids.pid IS NOT NULL
    ON CONFLICT (list_id, patient_id) DO UPDATE
      SET last_sent_period = EXCLUDED.last_sent_period,
          last_sent_at = EXCLUDED.last_sent_at
      WHERE m.last_sent_period IS DISTINCT FROM EXCLUDED.last_sent_period
        AND NOT m.excluded
    RETURNING m.patient_id
  )
  SELECT claimed.patient_id FROM claimed;
END
$$;
COMMENT ON FUNCTION public.claim_patient_list_sends(uuid, uuid[], text) IS
  'Marks patients as messaged by a list for a period and returns those not already marked (by another run). Excluded members are skipped.';

CREATE OR REPLACE FUNCTION public.release_patient_list_send(p_list_id uuid, p_patient_id uuid, p_period text)
RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH released AS (
    UPDATE public.patient_list_members m
    SET last_sent_period = NULL,
        last_sent_at = NULL
    WHERE m.list_id = p_list_id
      AND m.patient_id = p_patient_id
      AND m.last_sent_period = p_period
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM released)
$$;
COMMENT ON FUNCTION public.release_patient_list_send(uuid, uuid, text) IS
  'Gives back a claim after a failed send, so the patient can be messaged by a later run.';

-- Functions are callable by signed-in staff and the scheduled sender, not anonymously
REVOKE ALL ON FUNCTION public.patient_lists_can_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_patient_list_sends(uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_patient_list_send(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_lists_can_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_patient_list_sends(uuid, uuid[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_patient_list_send(uuid, uuid, text) TO authenticated, service_role;

REVOKE ALL ON public.patient_lists, public.patient_list_members FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_list_members TO authenticated;
GRANT ALL ON public.patient_lists TO service_role;
GRANT ALL ON public.patient_list_members TO service_role;

-- Quick checks to run on the branch before COMMIT (expect: two tables, RLS on, four functions)
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('patient_lists', 'patient_list_members');
-- SELECT proname FROM pg_proc WHERE proname IN ('patient_lists_can_access', 'patient_list_facts',
--   'claim_patient_list_sends', 'release_patient_list_send');

ROLLBACK;  -- change to COMMIT after review and a successful test on a branch database

-- ---------------------------------------------------------------------------------------------
-- 6. Scheduled sending (NOT part of the transaction above; run only after these steps)
--
--   a) Deploy: copy supabase/functions-proposals/patient-list-automations to
--      supabase/functions/patient-list-automations (with its deno.json) and deploy it.
--      It imports src/utils/patientLists by relative path; if your Supabase CLI does not bundle
--      files outside supabase/, copy those files (and the ones they import) into
--      supabase/functions/_shared/ and adjust the imports.
--   b) Secrets: supabase secrets set PATIENT_LISTS_CRON_SECRET=<long random value>
--      Leave PATIENT_LISTS_DRY_RUN unset at first: the function then only reports what it
--      would send (no claims, no SMS).
--   c) Store the secret in Vault and schedule every 15 minutes (lists send at their own time):
--
--      select vault.create_secret('<same long random value>', 'patient_lists_cron_secret');
--      create extension if not exists pg_cron;
--      create extension if not exists pg_net;
--      select cron.schedule(
--        'patient-list-automations',
--        '*/15 * * * *',
--        $cron$
--        select net.http_post(
--          url := 'https://<project-ref>.supabase.co/functions/v1/patient-list-automations',
--          headers := jsonb_build_object(
--            'Content-Type', 'application/json',
--            'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'patient_lists_cron_secret')
--          ),
--          body := '{}'::jsonb,
--          timeout_milliseconds := 120000
--        );
--        $cron$
--      );
--
--      If the function keeps JWT verification on, also send 'Authorization', 'Bearer <anon key>'.
--   d) After a day of dry-run reports (Edge Function logs) look right, set
--      PATIENT_LISTS_DRY_RUN=false. Lists send only when staff switch on "Send automatically".
--   To stop all scheduled sending: select cron.unschedule('patient-list-automations');
-- ---------------------------------------------------------------------------------------------

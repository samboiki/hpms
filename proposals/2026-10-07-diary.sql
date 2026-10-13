-- Applied 2026-10-07 as migration diary_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: diary blocked time (a practitioner unavailable, the practice or a branch closed)
-- File:    proposals/2026-10-07-diary.sql                                   Drafted: 2026-10-07
-- Code:    src/utils/diary/blockedTime.ts (the rules, unit tested), src/services/diaryService.ts,
--          src/components/appointments/diary/BlockTimeModal.tsx ("Block time" button in the diary),
--          src/components/appointments/PremiumDayGridView.tsx and PremiumWeekGridView.tsx (greyed time),
--          src/components/forms/PremiumAddAppointmentForm.tsx (asks before booking into blocked time)
--
-- Why
--   Reception has to see when a practitioner is away (leave, a conference, a meeting, lunch every
--   weekday) or when the practice or one branch is closed (staff training, a day the President declares
--   a public holiday for one year only), so that nobody books a patient into time when nobody is there.
--   The diary had a placeholder for this (blockedTimes={[]}) and nowhere to store it. Booking into
--   blocked time stays possible: the booking form names the block and the reason and asks
--   "Book anyway?" (a practitioner may still see one urgent patient during lunch).
--
--   Public holidays and the double-booking warnings need nothing from this file: they are worked out in
--   the app (src/utils/diary/holidays.ts, src/utils/diary/bookingChecks.ts) and already work.
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Review the sections below. Run the whole file once as it is (Supabase SQL editor, or a branch
--      first): it must finish without an error, and section 5 reports "diary_blocks ready".
--   2. Change the final ROLLBACK to COMMIT and run it again.
--   3. Nothing to deploy. In the app: Dashboard > diary > "Block time". Until step 2 that dialog says
--      "Blocked time is not switched on yet" and the diary shows no blocked time; nothing else changes.
--      If it still says so a minute after COMMIT, run:  NOTIFY pgrst, 'reload schema';
--
-- Contents
--   1. diary_blocks: one row per block (a one-off span of days, or a window that repeats)
--   2. updated_at trigger
--   3. RLS: staff of the practice (and super admins) see, add, change and remove its blocks
--   4. Grants
--   5. Checks
--   Undo: at the end of the file.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. diary_blocks
--    A block covers the days from start_date to end_date (inclusive) that match `recurrence`, and on
--    each of those days either the whole day (no times) or the same start_time-end_time window:
--      none      every day from start_date to end_date (leave 7-11 Oct, or a meeting on one day)
--      daily     every day from start_date, until end_date when there is one
--      weekdays  Monday to Friday from start_date (lunch 13:00-14:00), until end_date when there is one
--      weekly    the weekday of start_date (every Wednesday afternoon), until end_date when there is one
--    doctor_id set: that practitioner is unavailable. doctor_id null: everyone, i.e. the practice is
--    closed, or only branch_id's branch when branch_id is set. src/utils/diary/blockedTime.ts applies the
--    same rules (validateDiaryBlockInput mirrors the CHECK constraints below).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diary_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL,
  branch_id   uuid,
  doctor_id   uuid,
  reason      text NOT NULL,
  start_date  date NOT NULL,
  end_date    date,
  start_time  time,
  end_time    time,
  recurrence  text NOT NULL DEFAULT 'none',
  created_by  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Named, because the app reads the branch name through this relationship (branch:branches(name))
  CONSTRAINT diary_blocks_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT diary_blocks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE,
  CONSTRAINT diary_blocks_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT diary_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT diary_blocks_reason_check CHECK (char_length(btrim(reason)) BETWEEN 1 AND 120),
  CONSTRAINT diary_blocks_recurrence_check CHECK (recurrence IN ('none', 'daily', 'weekdays', 'weekly')),
  CONSTRAINT diary_blocks_dates_check CHECK (end_date IS NULL OR end_date >= start_date),
  -- A one-off block has a last day; only a repeating block may run on without one
  CONSTRAINT diary_blocks_end_date_check CHECK (recurrence <> 'none' OR end_date IS NOT NULL),
  -- Both times with the end after the start (no blocks past midnight), or neither (the whole day)
  CONSTRAINT diary_blocks_times_check CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  -- A branch closure applies to everyone at the branch, so it never names one practitioner as well
  CONSTRAINT diary_blocks_scope_check CHECK (branch_id IS NULL OR doctor_id IS NULL)
);

COMMENT ON TABLE public.diary_blocks IS
  'Diary blocked time: a practitioner unavailable (doctor_id) or the practice/branch closed (doctor_id null). Booking into it asks for confirmation in the app. Rules: src/utils/diary/blockedTime.ts.';
COMMENT ON COLUMN public.diary_blocks.doctor_id IS 'The practitioner who is unavailable; null = everyone (practice closed, or branch_id closed).';
COMMENT ON COLUMN public.diary_blocks.branch_id IS 'Set only for a branch closure (doctor_id null).';
COMMENT ON COLUMN public.diary_blocks.end_date IS 'Last day covered (inclusive). Null only for a repeating block with no end.';
COMMENT ON COLUMN public.diary_blocks.start_time IS 'Window start on each covered day; null with end_time null = the whole day.';
COMMENT ON COLUMN public.diary_blocks.recurrence IS 'none | daily | weekdays (Mon-Fri) | weekly (weekday of start_date).';

-- The diary reads the blocks of one practice that overlap the days on screen
CREATE INDEX IF NOT EXISTS diary_blocks_practice_dates_idx ON public.diary_blocks (practice_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS diary_blocks_doctor_idx ON public.diary_blocks (doctor_id) WHERE doctor_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 2. updated_at
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diary_blocks_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS diary_blocks_touch_updated_at ON public.diary_blocks;
CREATE TRIGGER diary_blocks_touch_updated_at
  BEFORE UPDATE ON public.diary_blocks
  FOR EACH ROW EXECUTE FUNCTION public.diary_blocks_touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- 3. RLS: the usual rule (the user's practice in public.users), plus super admins as in the claims
--    proposal. Any staff member of the practice may block time: reception records leave and meetings
--    in Eminance today. (Owner decision: limit INSERT/DELETE to admins by adding
--    "AND users.role = 'admin'" to those two policies.)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.diary_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diary_blocks_select ON public.diary_blocks;
CREATE POLICY diary_blocks_select ON public.diary_blocks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND (users.practice_id = diary_blocks.practice_id OR COALESCE(users.is_super_admin, false))
  ));

DROP POLICY IF EXISTS diary_blocks_insert ON public.diary_blocks;
CREATE POLICY diary_blocks_insert ON public.diary_blocks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND (users.practice_id = diary_blocks.practice_id OR COALESCE(users.is_super_admin, false))
  ));

DROP POLICY IF EXISTS diary_blocks_update ON public.diary_blocks;
CREATE POLICY diary_blocks_update ON public.diary_blocks
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND (users.practice_id = diary_blocks.practice_id OR COALESCE(users.is_super_admin, false))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND (users.practice_id = diary_blocks.practice_id OR COALESCE(users.is_super_admin, false))
  ));

DROP POLICY IF EXISTS diary_blocks_delete ON public.diary_blocks;
CREATE POLICY diary_blocks_delete ON public.diary_blocks
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND (users.practice_id = diary_blocks.practice_id OR COALESCE(users.is_super_admin, false))
  ));

-- ---------------------------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON public.diary_blocks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diary_blocks TO authenticated;
GRANT ALL ON public.diary_blocks TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. Checks: RLS is on with four policies, and the constraints refuse what the app refuses.
--    Each test row below must be refused; an exception block undoes its insert either way.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  rls_on boolean;
  policy_count integer;
  any_practice uuid;
BEGIN
  SELECT relrowsecurity INTO rls_on FROM pg_class WHERE oid = 'public.diary_blocks'::regclass;
  IF NOT rls_on THEN
    RAISE EXCEPTION 'diary_blocks: row level security is off';
  END IF;

  SELECT count(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public' AND tablename = 'diary_blocks';
  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'diary_blocks: expected 4 policies, found %', policy_count;
  END IF;

  SELECT id INTO any_practice FROM public.practices LIMIT 1;
  IF any_practice IS NOT NULL THEN
    BEGIN
      INSERT INTO public.diary_blocks (practice_id, reason, start_date, end_date, start_time, end_time)
      VALUES (any_practice, 'check', DATE '2026-10-07', DATE '2026-10-07', TIME '14:00', TIME '13:00');
      RAISE EXCEPTION 'diary_blocks: an end time before the start time was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.diary_blocks (practice_id, reason, start_date) VALUES (any_practice, 'check', DATE '2026-10-07');
      RAISE EXCEPTION 'diary_blocks: a one-off block without a last day was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.diary_blocks (practice_id, reason, start_date, end_date) VALUES (any_practice, '   ', DATE '2026-10-07', DATE '2026-10-07');
      RAISE EXCEPTION 'diary_blocks: a block without a reason was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END IF;

  RAISE NOTICE 'diary_blocks ready: row level security on, % policies, constraints checked', policy_count;
END $$;

-- Change to COMMIT once reviewed (see "How to apply" at the top)
ROLLBACK;

-- =============================================================================================
-- Undo (only if needed; removes every stored block):
--   DROP TABLE IF EXISTS public.diary_blocks;
--   DROP FUNCTION IF EXISTS public.diary_blocks_touch_updated_at();
-- The app then shows "Blocked time is not switched on yet" again and keeps working.
-- =============================================================================================

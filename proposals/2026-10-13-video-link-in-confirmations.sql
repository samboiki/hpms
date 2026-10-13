-- Applied 2026-10-13 as migration video_link_in_confirmations_2026_10_13 (version 20261013012309; stored statement md5 5b3f9c71a2af547597a1a21dcdb45a71 = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 of automation_queue_claim afterwards 0f9d059c696790970f6a8bc15700fce9 (before d95a050da0ad1b807b3f61539a7b31c6);
-- who may run it unchanged ({postgres=X/postgres,service_role=X/postgres}).
-- Rehearsed (rolled back, then checked: the function's text, the queue and the bookings as before): an invented
-- confirmed video booking and an in-rooms one, their confirmations queued and claimed as the sender claims them: 2
-- claimed, the video booking's carried its link, the other carried video_link null (only yes/no answers were read).
-- =============================================================================================
-- PROPOSAL: the booking confirmation can carry a video booking's room link ({{videoLink}}, parity B16)
-- File:   proposals/2026-10-13-video-link-in-confirmations.sql            Drafted: 2026-10-13
-- Code:   supabase/functions/process-automation-queue/automationRun.ts (reads visit.video_link from the claimed row
--         and fills {{videoLink}}), supabase/functions/_shared/appointmentReminders.ts (the placeholder and its rule:
--         a line that only carries the link is left out for a booking seen in the rooms).
--
-- Why: the booking confirmation SMS or email (process-automation-queue) is the natural place to send the link a
-- patient joins a video consultation with. automation_queue_claim() hands the sender a fixed set of the booking's
-- columns, without visits.video_link (proposals/2026-10-13-video-bookings.sql).
--
-- What it does (one key added; nothing else in the function changes)
--   1. automation_queue_claim(): the booking it hands over also carries 'video_link'. Edited in place: the live
--      function's text must be exactly what proposals/2026-10-08-automations.sql left (its md5 is checked) and the
--      piece replaced must occur once, or nothing changes. CREATE OR REPLACE keeps its owner and grants.
--   2. Checks after.
--   The deployed sender ignores the extra key until process-automation-queue is deployed with this version.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Needs proposals/2026-10-13-video-bookings.sql (the column).
-- Undo: the same replace the other way round ('video_link', v.video_link, removed), or the function as
--   proposals/2026-10-08-automations.sql has it.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: the column exists and the function is as the automations proposal left it
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'video_link') THEN
    RAISE EXCEPTION 'Stopped: visits.video_link is missing; apply proposals/2026-10-13-video-bookings.sql first';
  END IF;
  IF to_regprocedure('public.automation_queue_claim(integer)') IS NULL THEN
    RAISE EXCEPTION 'Stopped: automation_queue_claim(integer) is missing';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.automation_queue_claim(integer)'::regprocedure) <> 'd95a050da0ad1b807b3f61539a7b31c6' THEN
    RAISE EXCEPTION 'Stopped: automation_queue_claim changed since this file was written; look at it again';
  END IF;
  PERFORM set_config('onehealth.claim_acl_before',
    (SELECT proacl::text FROM pg_proc WHERE oid = 'public.automation_queue_claim(integer)'::regprocedure), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The booking handed to the sender also carries its room link
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_def text := pg_get_functiondef('public.automation_queue_claim(integer)'::regprocedure);
  v_old text := '''practitioner_name'', u.full_name) END)';
  v_new text := '''video_link'', v.video_link, ''practitioner_name'', u.full_name) END)';
BEGIN
  IF (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'Stopped: the booking''s keys are not where they were expected in automation_queue_claim';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Checks after: the key is there once, the function is still SECURITY DEFINER with search_path public
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_src text := (SELECT prosrc FROM pg_proc WHERE oid = 'public.automation_queue_claim(integer)'::regprocedure);
BEGIN
  IF position('''video_link'', v.video_link' IN v_src) = 0 THEN
    RAISE EXCEPTION 'check failed: automation_queue_claim does not hand over the room link';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.automation_queue_claim(integer)'::regprocedure
                  AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'check failed: automation_queue_claim lost SECURITY DEFINER or its search_path';
  END IF;
  IF has_function_privilege('anon', 'public.automation_queue_claim(integer)', 'EXECUTE')
     OR current_setting('onehealth.claim_acl_before', true) IS DISTINCT FROM
        (SELECT proacl::text FROM pg_proc WHERE oid = 'public.automation_queue_claim(integer)'::regprocedure) THEN
    RAISE EXCEPTION 'check failed: who may run automation_queue_claim changed';
  END IF;
END $$;

ROLLBACK;

-- Applied 2026-10-13 as migration video_bookings_2026_10_13 (version 20261013005607; stored statement md5 09505ed6653b5023a07549319b21f425 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked: no column or setting row left): reception gave a
-- booking a room link (1 row), cleared it (1) and set another; an http link, two links, a 11-character link, markup
-- and a 524-character link were refused (23514); reception could not set the practice's default link (42501) but
-- read it once the administrator had set it and changed it (1 row each, an upsert on practice and key). Another
-- practice's staff changed and saw 0 bookings and 0 default rows; a patient-app login changed and saw 0; anon was
-- refused (42501) both ways. The policies on visits were unchanged (fingerprint before and after).
-- =============================================================================================
-- PROPOSAL: video consultations in the diary: a booking seen by video keeps its room link (parity B16)
-- File:   proposals/2026-10-13-video-bookings.sql                         Drafted: 2026-10-13
-- Code:   src/utils/diary/videoBookings.ts (the link rules, tested), src/services/videoBookingService.ts (the practice's
--         default link), the booking form (src/components/forms/PremiumAddAppointmentForm.tsx), the diary cards and the
--         booking's actions (src/components/modals/VisitActionModal.tsx), {{videoLink}} in
--         src/utils/templates/mergeFields.ts and supabase/functions/_shared/appointmentReminders.ts.
--
-- Why (parity B16): OneHealth has a private video room with an SMS invite (src/components/telemedicine), but a
-- booking could not say it is a video consultation or keep the link the patient joins with, so reception kept the
-- link in their head or in the notes and the reminders could not carry it. Eminance flags a teleconsult on the
-- diary entry with a 5-character PIN kept in clear.
--
-- What it does (additive: no policy, trigger or function changes)
--   1. visits.video_link (text, null = seen in the rooms): the room link of a video booking: typed (the
--      practitioner's own Zoom, Teams or Meet room), the practice's default link, or a new private OneHealth room.
--      Staff set it with their existing right to change the practice's visits, like the booking's other details.
--      https only (an http link sends the call unencrypted), one link without spaces or markup, 12 to 500 characters.
--   2. The practice's default link is not a column: it is the practice_settings row 'video_consult_link'
--      ({"url": "https://..."}), which only practice administrators may change (that table's existing policies).
--   3. Checks after.
--   Before this file is applied the booking form says video bookings are not set up yet and saves the booking
--   without a link; the diary works as before.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration.
-- Undo:
--   ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_video_link_check;
--   ALTER TABLE public.visits DROP COLUMN IF EXISTS video_link;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before: the visits table, and no video_link column of another kind
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.visits') IS NULL THEN
    RAISE EXCEPTION 'Stopped: the visits table is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'video_link' AND data_type <> 'text') THEN
    RAISE EXCEPTION 'Stopped: visits.video_link exists with another type';
  END IF;
  PERFORM set_config('onehealth.visits_policies_before',
    (SELECT md5(string_agg(policyname || cmd || COALESCE(qual, '') || COALESCE(with_check, ''), '|' ORDER BY policyname))
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits'), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The booking's room link (adding a nullable column does not rewrite visits)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS video_link text;

-- Same rule as checkVideoLink in src/utils/diary/videoBookings.ts
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_video_link_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_video_link_check CHECK (
  video_link IS NULL
  OR (char_length(video_link) BETWEEN 12 AND 500 AND video_link ~ '^https://[^[:space:]<>"]+$')
);

COMMENT ON COLUMN public.visits.video_link IS
  'The room link of a video consultation (null = seen in the rooms): typed, the practice''s default (practice_settings ''video_consult_link'') or a new private OneHealth room. Messages fill {{videoLink}} with it. https only.';

-- ---------------------------------------------------------------------------------------------
-- 2. Checks after: the column and its rule are there, and the policies on visits did not change
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'video_link' AND is_nullable = 'YES') THEN
    RAISE EXCEPTION 'check failed: visits.video_link is missing or not nullable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass AND conname = 'visits_video_link_check') THEN
    RAISE EXCEPTION 'check failed: visits_video_link_check is missing';
  END IF;
  IF current_setting('onehealth.visits_policies_before', true) IS DISTINCT FROM
     (SELECT md5(string_agg(policyname || cmd || COALESCE(qual, '') || COALESCE(with_check, ''), '|' ORDER BY policyname))
        FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits') THEN
    RAISE EXCEPTION 'check failed: the policies on visits changed';
  END IF;
END $$;

ROLLBACK;

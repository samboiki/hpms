-- =============================================================================================
-- PROPOSAL, NOT APPLIED: two-way SMS (patients reply to practice SMS messages)
-- File:   proposals/2026-10-07-two-way-sms.sql                 Drafted: 2026-10-07
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Review each section. Run the whole file once as it is (Supabase SQL editor, or a branch):
--      it must finish without an error. Section 5 stops on purpose if practice_sms_logs refuses the
--      message type used for automatic answers (fix described there).
--   2. Change the final ROLLBACK to COMMIT and run it again.
--   3. Then set the secret, deploy the two edge functions and point SMSPortal at the webhook
--      (steps at the end of this file).
--
-- Contents
--   1. patients.sms_opt_out / sms_opt_out_at: STOP / START replies. Read by the SMS gateway (it refuses
--      non-essential messages to opted-out patients) and by patient automation lists. Do not rename.
--   2. practice_sms_replies: one row per patient reply, stored once per SMSPortal message
--   3. RLS and grants: staff of the practice read replies and mark them handled; only the service
--      role (the webhook) inserts
--   4. Realtime: the SMS replies inbox updates live
--   5. Check: practice_sms_logs must accept message_type 'sms_auto_reply'
--
-- Used by: supabase/functions/sms-reply-webhook, supabase/functions/centralized-sms-gateway,
--          src/components/communications/SmsRepliesInbox.tsx (+ smsRepliesService.ts)
-- The intent values in section 2 must match SMS_REPLY_INTENTS in
-- supabase/functions/_shared/smsReplyIntent.ts (a unit test compares them).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. SMS opt-out on the patient file
--    A patient (or whoever uses the patient's number) who replies STOP stops getting news, offers,
--    birthday, recall and other non-essential SMS from this practice. Appointment, results and
--    other essential messages, and replies the patient asked for, still go out.
--    Adding a NOT NULL column with a constant default does not rewrite the table (PostgreSQL 11+).
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS sms_opt_out boolean NOT NULL DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS sms_opt_out_at timestamptz;

COMMENT ON COLUMN public.patients.sms_opt_out IS
  'Replied STOP: no non-essential SMS (marketing, birthday, recall, campaigns, automation lists). Essential messages still go out. Set by sms-reply-webhook; START clears it.';
COMMENT ON COLUMN public.patients.sms_opt_out_at IS
  'When the patient opted out of non-essential SMS (null when receiving them).';

-- The gateway looks up opted-out patients of a practice before every non-essential SMS
CREATE INDEX IF NOT EXISTS patients_sms_opt_out_idx ON public.patients (practice_id) WHERE sms_opt_out;

-- ---------------------------------------------------------------------------------------------
-- 2. practice_sms_replies
--    Written by the sms-reply-webhook edge function (service role). provider_event_id is SMSPortal's
--    id of the incoming SMS, unique, so a webhook delivered twice is stored, acted on and answered
--    once. practice_id is null when a reply could not be matched to a practice (visible to nobody in
--    the app; the owner can query them).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_sms_replies (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id            uuid REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id             uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  visit_id               uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  sms_log_id             uuid REFERENCES public.practice_sms_logs(id) ON DELETE SET NULL,
  source_phone           text NOT NULL,
  source_phone_e164      text,
  destination_phone      text,
  message                text NOT NULL DEFAULT '',
  original_message       text,
  original_message_type  text,
  intent                 text NOT NULL DEFAULT 'free_text',
  rating                 smallint,
  action_taken           text,
  auto_reply_log_id      uuid REFERENCES public.practice_sms_logs(id) ON DELETE SET NULL,
  status                 text NOT NULL DEFAULT 'new',
  handled_by             uuid REFERENCES public.users(id) ON DELETE SET NULL,
  handled_at             timestamptz,
  provider_event_id      text NOT NULL,
  provider_opt_out       boolean NOT NULL DEFAULT false,
  received_at            timestamptz NOT NULL DEFAULT now(),
  raw                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_sms_replies_provider_event_id_key UNIQUE (provider_event_id),
  CONSTRAINT practice_sms_replies_status_check CHECK (status IN ('new', 'handled')),
  CONSTRAINT practice_sms_replies_intent_check CHECK (intent IN (
    'confirm', 'cancel', 'reschedule', 'booking', 'opt_out', 'opt_in', 'help', 'rating',
    'waitlist_accept', 'waitlist_decline', 'free_text'
  )),
  CONSTRAINT practice_sms_replies_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
);

COMMENT ON TABLE public.practice_sms_replies IS
  'Patient replies to practice SMS (SMSPortal reply webhook). One row per incoming SMS; status new = waiting for staff.';
COMMENT ON COLUMN public.practice_sms_replies.source_phone IS 'The patient''s number as SMSPortal sent it (reply to this number).';
COMMENT ON COLUMN public.practice_sms_replies.source_phone_e164 IS 'The same number normalised (+264...); null when it is not a phone number.';
COMMENT ON COLUMN public.practice_sms_replies.sms_log_id IS 'The message the patient answered (SMSPortal customerId = practice_sms_logs.id).';
COMMENT ON COLUMN public.practice_sms_replies.intent IS 'What the reply asks for (supabase/functions/_shared/smsReplyIntent.ts).';
COMMENT ON COLUMN public.practice_sms_replies.action_taken IS 'What the system did automatically, or why staff must look, in plain language.';
COMMENT ON COLUMN public.practice_sms_replies.auto_reply_log_id IS 'The automatic answer (at most one per reply), sent through centralized-sms-gateway.';
COMMENT ON COLUMN public.practice_sms_replies.handled_by IS 'Staff member who marked it handled; null with handled_at set = handled automatically.';
COMMENT ON COLUMN public.practice_sms_replies.provider_event_id IS 'smsportal:incoming:<IncomingId> (else smsportal:event:<EventId>): makes a repeated delivery a no-op.';
COMMENT ON COLUMN public.practice_sms_replies.raw IS 'The webhook body as received (for support).';

-- The inbox (practice, filter, newest first) and the per-number limit on automatic answers
CREATE INDEX IF NOT EXISTS practice_sms_replies_inbox_idx
  ON public.practice_sms_replies (practice_id, status, received_at DESC);
CREATE INDEX IF NOT EXISTS practice_sms_replies_phone_idx
  ON public.practice_sms_replies (source_phone_e164, received_at DESC);
CREATE INDEX IF NOT EXISTS practice_sms_replies_patient_idx
  ON public.practice_sms_replies (patient_id, received_at DESC) WHERE patient_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.practice_sms_replies_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS practice_sms_replies_touch_updated_at ON public.practice_sms_replies;
CREATE TRIGGER practice_sms_replies_touch_updated_at
  BEFORE UPDATE ON public.practice_sms_replies
  FOR EACH ROW EXECUTE FUNCTION public.practice_sms_replies_touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- 3. RLS and grants (same rule as the existing policies: a user's practice comes from public.users)
--    Staff may only change status / handled_by / handled_at, and only name themselves as handler.
--    No INSERT or DELETE for app users: rows come from the webhook (service role, bypasses RLS).
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.practice_sms_replies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.practice_sms_replies FROM anon, authenticated;
GRANT SELECT ON public.practice_sms_replies TO authenticated;
GRANT UPDATE (status, handled_by, handled_at) ON public.practice_sms_replies TO authenticated;
GRANT ALL ON public.practice_sms_replies TO service_role;

DROP POLICY IF EXISTS practice_sms_replies_select ON public.practice_sms_replies;
CREATE POLICY practice_sms_replies_select ON public.practice_sms_replies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = practice_sms_replies.practice_id));

DROP POLICY IF EXISTS practice_sms_replies_update ON public.practice_sms_replies;
CREATE POLICY practice_sms_replies_update ON public.practice_sms_replies
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = practice_sms_replies.practice_id))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.practice_id = practice_sms_replies.practice_id)
    AND (handled_by IS NULL OR handled_by = auth.uid())
  );

-- ---------------------------------------------------------------------------------------------
-- 4. Realtime: new replies appear in the inbox without a refresh (RLS still applies per user)
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'practice_sms_replies'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_sms_replies;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Automatic answers are logged by the gateway with message_type 'sms_auto_reply'.
--    The code already sends types such as 'custom', 'system', 'general' and 'automation', so the live
--    table is not expected to restrict message_type. If it does and the list lacks 'sms_auto_reply',
--    stop here: every automatic answer would fail with "Failed to create log entry".
--    Fix (with the name and values from the error):
--      ALTER TABLE public.practice_sms_logs DROP CONSTRAINT <name>;
--      ALTER TABLE public.practice_sms_logs ADD CONSTRAINT <name>
--        CHECK (message_type IN (<the existing values>, 'sms_auto_reply'));
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.practice_sms_logs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%message_type%'
  LOOP
    IF c.definition NOT ILIKE '%sms_auto_reply%' THEN
      RAISE EXCEPTION 'practice_sms_logs check % does not allow message_type sms_auto_reply: %', c.conname, c.definition
        USING HINT = 'Add sms_auto_reply to that list (see section 5 of this file), then run the script again.';
    END IF;
  END LOOP;
END $$;

-- Change to COMMIT once reviewed (see "How to apply" at the top)
ROLLBACK;

-- =============================================================================================
-- After COMMIT (owner, in this order). <project-ref> is the Supabase project reference.
--   a) Secret for the webhook (a long random value, e.g. 40+ characters; keep it out of git):
--        npx supabase secrets set SMS_REPLY_WEBHOOK_KEY=<secret> --project-ref <project-ref>
--      (SMS_PORTAL_CLIENT_ID and SMS_PORTAL_API_SECRET are already set for the gateway.)
--   b) Deploy with the Supabase CLI (the dashboard editor cannot bundle ../_shared):
--        npx supabase functions deploy centralized-sms-gateway --project-ref <project-ref>
--        npx supabase functions deploy sms-reply-webhook --no-verify-jwt --project-ref <project-ref>
--   c) SMSPortal > Settings > Webhooks > SMS Reply Webhook, Custom Body (JSON), URL:
--        https://<project-ref>.supabase.co/functions/v1/sms-reply-webhook?key=<secret>
--
-- Undo (only if needed; drops all stored replies):
--   DROP TABLE IF EXISTS public.practice_sms_replies;
--   DROP FUNCTION IF EXISTS public.practice_sms_replies_touch_updated_at();
--   DROP INDEX IF EXISTS public.patients_sms_opt_out_idx;
--   ALTER TABLE public.patients DROP COLUMN IF EXISTS sms_opt_out_at, DROP COLUMN IF EXISTS sms_opt_out;
-- =============================================================================================

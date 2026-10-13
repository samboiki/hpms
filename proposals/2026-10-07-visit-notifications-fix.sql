-- Applied 2026-10-07 as migrations visit_notifications_fix_2026_10_07 (first part),
-- visit_notifications_fix_2_2026_10_07 and visit_notifications_fix_3_2026_10_07 (this whole file)
-- =============================================================================================
-- PROPOSAL: marking a visit ready or cancelled works again
-- File:   proposals/2026-10-07-visit-notifications-fix.sql              Drafted: 2026-10-07
--
-- Why: the AFTER UPDATE trigger trigger_visit_notifications (function notify_visit_changes) failed
-- on every update that set visits.is_ready or visits.is_cancelled to true, so these did nothing on
-- the live database: cancelling from the booking form (PremiumAddAppointmentForm), the diary's
-- cancel (visitsStore), and marking a patient ready (visitsStore, EnhancedVisitTimeline,
-- VisitGridView). Reproduced 2026-10-07 in rolled-back tests. Four faults, one after another:
--   1. it read patients.full_name, which does not exist (patients has first_name and last_name);
--   2. it read NEW.cancellation_reason, which visits does not have;
--   3. create_system_notification() inserted text into the enum columns notification_type and
--      priority without a cast (so no notification it made ever worked; this trigger is its only
--      caller);
--   4. the cancel notification asked for priority 'normal', which notification_priority does not
--      have (low, medium, high, urgent, critical);
--   5. the notification is for the practitioner, not the person who clicked, so the INSERT ...
--      RETURNING (which needs the new row to be visible to the caller) was refused by the
--      system_notifications policies.
--
-- The fix:
--   - create_system_notification casts the type and maps any priority it does not know to medium;
--   - notify_visit_changes builds the name from first_name and last_name ("a patient" when it
--     cannot be read), notifies only when the visit has a practitioner (user_id is required), uses
--     priority medium for cancellations, and links to the visit in the patient file
--     (/patients/<patient>?visit=<visit>, as src/components/billing/invoiceLinks.ts visitLink);
--   - notify_visit_changes runs as its owner (SECURITY DEFINER; a trigger function cannot be called
--     directly), so it can read the patient's name and write the practitioner's notification;
--     create_system_notification can no longer be called by app users (anyone could otherwise
--     notify anyone);
--   - a notification that still fails is logged as a warning and never stops the visit change:
--     cancelling or marking ready is the work, the notification is a courtesy.
--
-- Undo: restore the previous bodies (they fail on every ready or cancel, so there is no reason to).
-- =============================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_user_id uuid, p_practice_id uuid, p_type text, p_priority text, p_title text, p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb, p_patient_id uuid DEFAULT NULL::uuid, p_visit_id uuid DEFAULT NULL::uuid,
  p_action_url text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  notification_id uuid;
  v_priority text := CASE WHEN p_priority IN ('low', 'medium', 'high', 'urgent', 'critical') THEN p_priority ELSE 'medium' END;
BEGIN
  INSERT INTO system_notifications (
    user_id, practice_id, notification_type, priority,
    title, message, metadata, patient_id, visit_id, action_url
  )
  VALUES (
    p_user_id, p_practice_id, p_type::notification_type, v_priority::notification_priority,
    p_title, p_message, COALESCE(p_metadata, '{}'::jsonb), p_patient_id, p_visit_id, p_action_url
  )
  RETURNING id INTO notification_id;

  PERFORM pg_notify('notifications', json_build_object(
    'notification_id', notification_id,
    'user_id', p_user_id,
    'type', p_type,
    'priority', v_priority
  )::text);

  RETURN notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_visit_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ready boolean := NEW.is_ready = TRUE AND (OLD.is_ready IS NULL OR OLD.is_ready = FALSE);
  v_cancelled boolean := NEW.is_cancelled = TRUE AND (OLD.is_cancelled IS NULL OR OLD.is_cancelled = FALSE);
  v_patient_name text;
  v_link text := '/patients/' || NEW.patient_id || '?visit=' || NEW.id;
BEGIN
  -- Only a visit with a practitioner has someone to tell
  IF NEW.doctor_id IS NULL OR NOT (v_ready OR v_cancelled) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), '') INTO v_patient_name
      FROM patients p WHERE p.id = NEW.patient_id;
    v_patient_name := COALESCE(v_patient_name, 'a patient');

    IF v_ready THEN
      PERFORM create_system_notification(
        NEW.doctor_id, NEW.practice_id, 'patient_arrived', 'high', 'Patient Ready',
        'Patient ' || v_patient_name || ' is ready for their visit',
        jsonb_build_object('visit_id', NEW.id, 'patient_id', NEW.patient_id),
        NEW.patient_id, NEW.id, v_link
      );
    END IF;

    IF v_cancelled THEN
      PERFORM create_system_notification(
        NEW.doctor_id, NEW.practice_id, 'appointment_cancelled', 'medium', 'Visit Cancelled',
        'Visit with ' || v_patient_name || ' has been cancelled',
        jsonb_build_object('visit_id', NEW.id, 'patient_id', NEW.patient_id),
        NEW.patient_id, NEW.id, v_link
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_visit_changes: no notification for visit % (%)', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Only the trigger above creates these notifications
REVOKE EXECUTE ON FUNCTION public.create_system_notification(uuid, uuid, text, text, text, text, jsonb, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_visit_changes() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

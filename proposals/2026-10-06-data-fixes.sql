-- =============================================================================================
-- PROPOSAL, NOT APPLIED: data fixes found while testing HPMS end to end on 6 October 2026
--
-- Nothing here has been run. The script ends in ROLLBACK, so running it by mistake changes nothing.
-- Review each section, run it on a Supabase branch first, then change ROLLBACK to COMMIT.
-- =============================================================================================

BEGIN;

-- 1. "Mark No Show" always fails --------------------------------------------------------------
-- The app writes visits.status = 'no-show', but the live check constraint does not allow it
-- (tested: 'no-show' and 'no_show' are both refused; scheduled, in-progress, completed and cancelled pass).
-- Every value below is one the app writes or reads (see src/utils/visitStage.ts).
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_status_check
  CHECK (status IN ('pending', 'scheduled', 'confirmed', 'ready', 'in-progress', 'completed', 'cancelled', 'no-show'));

-- Demo data only: missed appointments in the seeded demo practice were stored as cancelled with this note.
-- After the constraint above, they can carry the real status:
UPDATE public.visits
SET status = 'no-show', is_cancelled = false
WHERE notes = '[Cancelled: did not attend (no-show)]'
  AND id::text LIKE '5eed%-2610-4000-8000-%';

-- 2. Lab requests without a practice ------------------------------------------------------------
-- The lab request form never saved practice_id (fixed in the app on 6 Oct 2026), so most requests are
-- invisible on practice-scoped screens (Encounters statistics, the doctor's history panel).
UPDATE public.lab_requests lr
SET practice_id = p.practice_id
FROM public.patients p
WHERE lr.patient_id = p.id
  AND lr.practice_id IS NULL
  AND p.practice_id IS NOT NULL;

-- 3. Timesheets saved with the wrong first day ---------------------------------------------------
-- The timesheet screen converted local midnight to UTC, so period_start was saved as the last day of the
-- previous month (fixed in the app). period_end was always right; derive the start from it.
-- Only rows with exactly that one-day error change, so any other period length is left alone
-- (checked 6 Oct 2026 in the demo practice: 123 start on the 1st, 6 start the day before, none differ otherwise).
UPDATE public.timesheets
SET period_start = date_trunc('month', period_end)::date
WHERE period_start = (date_trunc('month', period_end) - interval '1 day')::date;

-- 4. Per-visit dental codes marked as needing a tooth number --------------------------------------
-- The claims check refuses lines without a tooth for codes marked requires_tooth_number = 'YES'. These are
-- charged once per visit, not per tooth, so every dental claim with them would be blocked.
-- The tariff descriptions themselves say so: 8109 "Infection control, per dentist/hygienist/assistant, per visit",
-- 8145 "Local anaesthetic, per visit", 8110 "Provision of sterilised and wrapped instrumentation" (per visit).
-- It changes the shared tariff list for every dental practice.
UPDATE public.practice_tariffs
SET requires_tooth_number = 'NO'
WHERE code IN ('8109', '8110', '8145')  -- infection control, sterilised instruments, local anaesthetic per visit
  AND requires_tooth_number = 'YES';

-- 5. Automation jobs created by the demo seed -----------------------------------------------------
-- Each seeded demo patient queued two 'patient.created' jobs. They can never send anything (seeded patients
-- have no phone or email) and all 840 are already marked failed with every attempt used, but they clutter the
-- automation monitor. One job of each pair keeps the patient in payload, the other in trigger_data. Optional:
DELETE FROM public.automation_queue
WHERE trigger_type = 'patient.created'
  AND (trigger_data->>'patient_id' LIKE '5eed%' OR payload->>'patient_id' LIKE '5eed%');

-- 6. Security (from the code and policy review; adapt names to the live policies) -----------------
-- a) Remove the SQL-runner edge function (execute-sql): it runs any SQL with the service role after only
--    checking that an Authorization header exists. Delete it in the Supabase dashboard.
-- b) Remove the create-test-user edge function (no auth check) and the exec_raw_sql RPC:
--      DROP FUNCTION IF EXISTS public.exec_raw_sql(text);
-- c) public.users: SELECT is USING (true) and users may update their own row without column limits, so a
--    user can make themselves super admin. Restrict SELECT to the user's own practice and block updates to
--    role, is_super_admin, can_manage_practices, permissions and practice_id except by admins.
-- d) public.audit_logs: any signed-in user can read and insert. Allow insert from triggers only and read
--    for admins of the practice.
-- e) public.payslips and public.timesheets: a doctor could create payslips and timesheets for colleagues
--    (seen while seeding demo data). Restrict INSERT/UPDATE to admins, and timesheets to the owner while draft.

-- 7. Demo data: emergencies booked weeks ahead ------------------------------------------------------
-- The demo seed booked 20 "emergency" visits in the coming weeks (13 for one patient); emergencies are walk-ins.
-- The other 126 skewed bookings were moved to other patients on 6 Oct 2026. These 20 could not be deleted from
-- the app: no app account may delete visits. Backup of the rows: seed-booking-repair-backup.json (session notes).
DELETE FROM public.visits
WHERE status = 'scheduled'
  AND visit_type = 'emergency'
  AND id IN (
  '5eed0400-2610-4000-8000-000000000d9b', '5eed0400-2610-4000-8000-000000000d9c', '5eed0400-2610-4000-8000-000000000da0',
  '5eed0400-2610-4000-8000-000000000da2', '5eed0400-2610-4000-8000-000000000dc0', '5eed0400-2610-4000-8000-000000000dc7',
  '5eed0400-2610-4000-8000-000000000dd3', '5eed0400-2610-4000-8000-000000000de6', '5eed0400-2610-4000-8000-000000000dec',
  '5eed0400-2610-4000-8000-000000000e02', '5eed0400-2610-4000-8000-000000000e0d', '5eed0400-2610-4000-8000-000000000e16',
  '5eed0400-2610-4000-8000-000000000e34', '5eed0400-2610-4000-8000-000000000e57', '5eed0400-2610-4000-8000-000000000e71',
  '5eed0400-2610-4000-8000-000000000e73', '5eed0400-2610-4000-8000-000000000e75', '5eed0400-2610-4000-8000-000000000e81',
  '5eed0400-2610-4000-8000-000000000e8b', '5eed0400-2610-4000-8000-000000000e8f'
  );

-- 8. Let practice administrators delete bookings ---------------------------------------------------
-- visits has SELECT, INSERT and UPDATE policies but no DELETE policy, so no app account can delete a visit:
-- the delete silently removes nothing. This lets an administrator (or a super admin) delete a booking made by
-- mistake, until the patient checks in. Visits that started stay: they hold clinical records and invoices.
-- The app shows "Delete Booking" in the visit actions for administrators (PremiumAppointmentScheduler).
-- Apply together with 6c: while users can change their own role, anyone could make themselves an admin.
DROP POLICY IF EXISTS "Practice admins can delete bookings" ON public.visits;
CREATE POLICY "Practice admins can delete bookings" ON public.visits
  FOR DELETE TO authenticated
  USING (
    visits.status IN ('pending', 'scheduled', 'confirmed', 'cancelled', 'no-show')
    AND COALESCE(visits.is_checked_in, false) = false
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.is_active IS DISTINCT FROM false
        AND (users.is_super_admin IS TRUE OR (users.role = 'admin' AND users.practice_id = visits.practice_id))
    )
  );

ROLLBACK;

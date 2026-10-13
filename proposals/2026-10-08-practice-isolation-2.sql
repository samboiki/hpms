-- Applied 2026-10-08 as migration practice_isolation_2_2026_10_08
-- =============================================================================================
-- Practice isolation 2: the patient files, audit trail, payroll and HR, OAuth secrets, the documents
-- bucket and the owner-rights functions that still let staff of one practice reach another practice
-- File:    proposals/2026-10-08-practice-isolation-2.sql                  Drafted: 2026-10-08
--
-- Why (practice isolation audit 2026-10-08; each item verified against the database before changing)
--   1. medical_aid_details, patient_media, patient_imaging, patient_laboratory and imaging_requests had
--      only "auth.role() = 'authenticated'" policies (portal_staff_only keeps patient app logins out, no
--      more): staff of every practice read and changed every practice's medical aid details (313 rows),
--      media (20), imaging and laboratory files (7, 3) and imaging requests (58).
--   2. audit_logs: any staff login read all 7,819 entries, which hold whole patient, visit, vitals and
--      medical aid rows. The patient file's history tab (view patient_audit_logs) showed them.
--   3. Payroll and HR checked the role only: an admin or doctor of any practice read and changed every
--      practice's payslips (bank details), salaries, salary lines and settings, adjustments, timesheets
--      and their entries, and approved any leave; any admin read every hr_audit_logs entry; admins and
--      doctors added leave balances for anyone; admins and doctors without a practice (and anyone, for a
--      leave type without a practice) changed every practice's leave types.
--   4. practice_oauth_apps (client_secret) and practice_social_accounts (tokens): admins, managers and
--      doctors of any practice read and changed every practice's rows (the other policies relied on
--      user_practice_assignments, which the app does not keep for access).
--   5. Storage bucket "documents": any signed-in login listed, downloaded, replaced and deleted every
--      practice's files (patient documents, lab and imaging results, prescriptions, timesheets).
--   6. 18 owner-rights (SECURITY DEFINER) functions, run past row security, read or wrote another
--      practice's data from an id the caller passes: claim batches, SMS logs, practice statistics, AI
--      insights, internal messaging, bookings, templates, notification counts and a user's practice.
--
-- How it was applied
--   Rehearsed once, before applying, inside one rolled-back DO block: this file's statements followed by
--   count and write tests as staff of practice A (b646) and B (ffed), a practice administrator, a
--   doctor, a receptionist reading their own payslip, a super admin, a signed-in outsider (no staff row)
--   and the anon key, and each changed function called with the caller's own practice and another's
--   (counts and ids only). Then applied as migration practice_isolation_2_2026_10_08: this file's
--   statements between BEGIN; and ROLLBACK;. Order for a rehearsal: after
--   proposals/2026-10-07-practice-isolation.sql (its rls_* helpers) and 2026-10-08-documents-bucket.sql
--   (the storage policies this file replaces), before proposals/2026-10-07-patient-portal.sql.
--
-- The rules
--   Membership as in proposals/2026-10-07-practice-isolation.sql: users.practice_id of an active staff
--   member (rls_my_practice_id); super admins: users.is_super_admin (rls_is_super_admin).
--   1. The five patient tables: <table>_staff (staff of the patient's practice: every row has a patient
--      with a practice; 17 rows point at visits without one) and <table>_super_admin_read (admin portal).
--   2. audit_logs: the practice's administrators (users.role = 'admin') read their practice's entries;
--      an entry's practice is the stored row's practice_id, else its patient's, else its visit's (vitals).
--      Super admins read all. Writes stay as they are (log_audit_trail is an owner-rights trigger).
--   3. Payroll and HR rows belong to the employee's practice (they have no practice column):
--      - the employee reads their own rows (as before: own draft timesheets and their entries, own leave
--        requests while pending, and new: submit an own draft timesheet, cancel an own pending request;
--        the app offers both buttons to everyone, and until now only admins and doctors could use them);
--      - the practice's administrators manage the practice's rows: Settings > Users (payroll, leave,
--        timesheets) shows the team only to administrators (isStaffAdmin), doctors see their own;
--      - doctors read the practice's payslips and payslip lines: Finance (open to every role) shows
--        payroll costs from them;
--      - hr_audit_logs: the performer's practice administrators, and super admins;
--      - leave_types: its practice's administrators change it (reading is unchanged);
--      - salary_components, benefits, deductions, bonus_configurations, departments and leave_forms were
--        already scoped to the practice; leave_request_history has no policy (closed; nothing writes it).
--   4. practice_oauth_apps, practice_social_accounts: the practice's administrators and doctors
--      (rls_is_practice_admin, as for managing staff): practice ffed has no administrator and its doctor
--      set up its Gmail app. Column SELECT on the secrets stays: the browser still reads client_secret
--      (see "Still open").
--   5. documents bucket: a file whose path names a practice, patient, staff member or visit is reached by
--      that practice's staff only (super admins read all):
--        <practice id>/documents/...  practice-logos/<practice id>/...          the practice
--        <patient id>/...  lab-results|lab-requests|imaging-results/<patient id>/...   the patient's practice
--        timesheets|leave-documents/<user id>/...  avatars/<user id>_...  signatures/<user id>-...
--                                                  the staff member, or their practice's staff
--        prescriptions/prescription_<visit id>_...  the visit's practice, else its patient's
--      invoices/, leave_forms/ and any other folder: any OneHealth staff member (as before, minus signed-in
--      logins without a staff row).
--   6. The functions check membership with rls_assert_my_practice() (42501 "Not allowed" otherwise); the
--      service key and the database itself (no signed-in user) pass as before. Super admins pass only for
--      get_practice_statistics (admin > practice details). Bodies are unchanged apart from the lines
--      marked "practice check" and a fixed search_path. Unchanged: mark_notification_read (own rows
--      only), get_medical_aid_providers (the shared fund list), sync_invoice_to_batch (2026-10-08 file).
--
-- Still open / for the owner (not changed here)
--   - The patient file's history tab (PremiumFolderTabs, view patient_audit_logs) is empty now for
--     everyone but administrators; its filter .or(record_id.eq.<patient>,table_name.eq.patients) lists
--     every patient's entries: filter on the patient's own record ids instead.
--   - client_secret (practice_oauth_apps) and the token columns (practice_social_accounts,
--     practice_oauth_credentials) are still read in the browser: UniversalCallback.tsx, GmailOAuthSettings,
--     UniversalOAuthSettings, GmailSettingsModal, GmailDirectTest, src/pages/api/save-oauth.ts and
--     gmail-oauth-handler.tsx exchange the OAuth code client-side, and Settings.tsx selects '*'. Move the
--     exchange to the exchange-oauth-code edge function (service key), select named columns, then
--     REVOKE SELECT (client_secret) ON practice_oauth_apps FROM authenticated (and the token columns).
--     practice_oauth_credentials (refresh/access tokens) is readable by every staff member of its own
--     practice (not across practices).
--   - documents: invoices/ (19 files) and leave_forms/ (33) have no id in their path
--     (documentGenerationService.uploadToStorage(blob, name, 'invoices' | 'leave_forms' | 'prescriptions')):
--     upload to `${practiceId}/invoices/...` and `${practiceId}/leave_forms/...` (the practice-id rule
--     then covers them) and move the 52 existing files. The bucket is still public: a known path downloads
--     without signing in (owner decision: private bucket with signed links).
--   - audit_logs keeps "Service role can insert audit logs": any signed-in user can still add entries.
--   - Doctors no longer run HR at the database (the app never let them): they keep reading payslips for
--     Finance; practice ffed has no administrator, so nobody there approves leave or timesheets (as in
--     the app today). Super admins no longer read other practices' payroll.
--   - A non-administrator's "Premium PDF" of a submitted or approved timesheet cannot save pdf_url
--     (own rows are editable while draft only; doctors could before): TimesheetPDFGeneratorFixed throws
--     on that error before downloading.
--   - Seen, not changed: ensure_visit inserts visits.appointment_id, which does not exist (it always
--     fails; nothing calls openVisit); send_typing_indicator(uuid, uuid) inserts no practice_id, which is
--     required (the app uses the (uuid, boolean) one); sms_templates' policy reads auth.users.
--
-- Test results (counts only, in the rehearsal and again after applying, rolled back; staff of practice A
-- (b646) as administrator / doctor / receptionist, staff of B (ffed) doctor / nurse, super admin, signed-in
-- outsider, anon key; "-" = no grant; in brackets: before)
--   medical_aid_details 308/308/308/5/5/313/0/- (313 for every staff login), patient_media 16/16/16/4/4/20/0/-
--   (20), patient_imaging 6/6/6/1/1/7/0/- (7), patient_laboratory 3/3/3/0/0/3/0/- (3), imaging_requests
--   55/55/55/3/3/58/0/- (58); audit_logs and patient_audit_logs 7585/0/0/0/0/7819/0/- (7819 for every staff
--   login); payslips 126/126/18/1/1/0/0/- (127/127/18/127/1/127), employee_salaries 13/2/1/0/2/0/0/-
--   (20/20/1/20/2/20), employee_salary_components 44/8/6/0/0/0/0/- (65/65/6/65/0/65),
--   employee_salary_configurations 62/41/0/0/6/0/0/- (68/68/0/68/6/68), payslip_adjustments 0/0/0/0/1/0/0/-
--   (1/1/0/1/1/1), timesheets 127/18/18/1/1/0/0/- (129/129/18/129/1/129), timesheet_entries
--   2619/403/384/27/27/0/0/- (2673 for administrators and doctors), leave_requests 2/2/0/0/0/0/0/-
--   (2/2/0/2/0/2), leave_balances 30/6/6/0/0/0/0/- (30/30/6/0/0/0), leave_types 6/6/6/6/6/0/0/- (unchanged),
--   practice_oauth_apps 0/0/0/1/0/0/0/- (1/1/0/1/0/1), bucket documents 102/102/102/84/84/134/0/0 (134 for every
--   signed-in login, the outsider included; the 52 files in invoices/ and leave_forms/ count for both).
--   Writes: own practice allowed (no-op updates and inserts on the five patient tables; payslip, salary, salary
--   line, salary setting, timesheet, entry, leave request, balance and leave type updates and adjustment and
--   payslip line inserts by A's administrator; B's doctor on B's OAuth app; a social account by A's doctor;
--   an own draft timesheet submitted; an own pending leave request cancelled; the audit insert as before);
--   refused (inserts 42501, updates 0 rows): every write on the other practice's rows, a super admin's update
--   of B's medical aid, A's doctor on a colleague's payslip and timesheet, a receptionist adding a social
--   account, any hr_audit_logs insert. Before, every one of these cross-practice writes went through.
--   Storage: A's receptionist uploads under an A patient, A's practice documents, her own avatar, invoices/
--   and an A prescription, A's administrator a colleague's signature (allowed); under a B patient, B's
--   lab-results, B's logo, a B staff avatar or a B prescription, B's doctor in A's timesheets folder, the
--   outsider in invoices/, a super admin under a B patient (42501); update and delete of an A file 1 row, of a
--   B file 0 (before: all allowed).
--   Functions: each with the caller's own practice works; with another practice's id 42501 (before: all
--   worked), also a channel creator moved to another practice deleting it; get_practice_statistics(B) works
--   for a super admin and the service key, prepare_batch_for_sending(B) for the service key; the anon key has
--   no grant. ensure_visit fails (42703) and send_typing_indicator(uuid, uuid) fails (23502) for everyone,
--   before and after. The 19 bodies equal the old ones once comments, whitespace and the practice check are
--   removed.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Helpers (each answers a question about the caller only, like the rls_* helpers of
--    proposals/2026-10-07-practice-isolation.sql; owner rights where they read rows the caller's own
--    policies hide)
-- ---------------------------------------------------------------------------------------------
-- The caller's role when the given staff member works in the caller's practice, else null. Payroll and
-- HR rows have no practice column: the employee's practice is the row's practice.
CREATE OR REPLACE FUNCTION public.rls_my_role_for_staff(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT me.role FROM public.users me JOIN public.users e ON e.practice_id = me.practice_id
   WHERE me.id = auth.uid() AND COALESCE(me.is_active, true) AND e.id = p_user_id
$$;

-- The caller's role when an audit entry belongs to the caller's practice, else null. The entry's practice
-- is that of the row it stores: its practice_id (patients, visits), else its patient's (medical aid
-- details, visits without one), else its visit's (vitals). Malformed ids count as none.
CREATE OR REPLACE FUNCTION public.rls_my_role_for_audit_entry(p_values jsonb)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH ids AS (
    SELECT CASE WHEN p_values->>'practice_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (p_values->>'practice_id')::uuid END AS practice_id,
           CASE WHEN p_values->>'patient_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (p_values->>'patient_id')::uuid END AS patient_id,
           CASE WHEN p_values->>'visit_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (p_values->>'visit_id')::uuid END AS visit_id
  ), entry AS (
    SELECT COALESCE(ids.practice_id,
                    (SELECT p.practice_id FROM public.patients p WHERE p.id = ids.patient_id),
                    (SELECT COALESCE(v.practice_id, p.practice_id)
                       FROM public.visits v LEFT JOIN public.patients p ON p.id = v.patient_id
                      WHERE v.id = ids.visit_id)) AS practice_id
    FROM ids
  )
  SELECT me.role FROM public.users me, entry
   WHERE me.id = auth.uid() AND COALESCE(me.is_active, true) AND me.practice_id = entry.practice_id
$$;

-- May the caller read (p_write false) or upload, replace and delete (true) this file of bucket
-- "documents"? Staff only; the practice comes from the path (see "The rules", 5).
CREATE OR REPLACE FUNCTION public.rls_documents_access(p_name text, p_write boolean)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_my_practice uuid;
  v_super boolean;
  v_folder text := split_part(p_name, '/', 1);
  v_next text := split_part(p_name, '/', 2);
  v_id text;
  v_practice uuid;
BEGIN
  -- OneHealth staff only (not other signed-in logins, such as the patient app's)
  SELECT u.practice_id, COALESCE(u.is_super_admin, false) INTO v_my_practice, v_super
    FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true);
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  -- Super admins read every practice's files (admin portal); they change their own practice's only
  IF v_super AND NOT p_write THEN
    RETURN true;
  END IF;

  IF v_folder ~ c_uuid THEN
    -- <practice id>/documents/... (practice documents) or <patient id>/... (patient documents and media)
    SELECT pr.id INTO v_practice FROM public.practices pr WHERE pr.id = v_folder::uuid;
    IF v_practice IS NULL THEN
      SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = v_folder::uuid;
    END IF;
  ELSIF v_folder = 'practice-logos' THEN
    IF v_next ~ c_uuid THEN
      v_practice := v_next::uuid;
    END IF;
  ELSIF v_folder IN ('lab-results', 'lab-requests', 'imaging-results') THEN
    IF v_next ~ c_uuid THEN
      SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = v_next::uuid;
    END IF;
  ELSIF v_folder IN ('timesheets', 'leave-documents', 'avatars', 'signatures') THEN
    -- timesheets/<user id>/..., leave-documents/<user id>/..., avatars/<user id>_<time>.<ext>,
    -- signatures/<user id>-signature-<time>.<ext>: the staff member, or a colleague in their practice
    v_id := CASE WHEN v_folder IN ('timesheets', 'leave-documents') THEN v_next ELSE left(v_next, 36) END;
    IF v_id ~ c_uuid THEN
      IF v_id::uuid = auth.uid() THEN
        RETURN true;
      END IF;
      SELECT u.practice_id INTO v_practice FROM public.users u WHERE u.id = v_id::uuid;
    END IF;
  ELSIF v_folder = 'prescriptions' THEN
    -- prescriptions/prescription_<visit id>_<time>.pdf: the visit's practice, else its patient's
    v_id := substr(v_next, 14, 36);
    IF v_next LIKE 'prescription\_%' AND v_id ~ c_uuid THEN
      SELECT COALESCE(v.practice_id, p.practice_id) INTO v_practice
        FROM public.visits v LEFT JOIN public.patients p ON p.id = v.patient_id
       WHERE v.id = v_id::uuid;
    END IF;
  ELSE
    -- invoices/, leave_forms/ and any other folder name no practice, patient or staff member: any staff
    -- member, as before (see "Still open")
    RETURN true;
  END IF;

  RETURN v_practice IS NOT NULL AND v_practice = v_my_practice;
END
$$;

-- For the owner-rights functions of section 7: stop unless the row's practice is the caller's (or the
-- caller is a super admin, where allowed). The service key and the database itself (no signed-in user)
-- pass, as before.
CREATE OR REPLACE FUNCTION public.rls_assert_my_practice(p_practice_id uuid, p_super_admin_ok boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') NOT IN ('authenticated', 'anon') THEN
    RETURN;
  END IF;
  IF p_practice_id IS NOT NULL AND p_practice_id = public.rls_my_practice_id() THEN
    RETURN;
  END IF;
  IF p_super_admin_ok AND public.rls_is_super_admin() THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Not allowed: this belongs to another practice' USING ERRCODE = '42501';
END
$$;

REVOKE ALL ON FUNCTION public.rls_my_role_for_staff(uuid), public.rls_my_role_for_audit_entry(jsonb),
  public.rls_documents_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rls_my_role_for_staff(uuid), public.rls_my_role_for_audit_entry(jsonb),
  public.rls_documents_access(text, boolean) TO authenticated, service_role;
-- Only the owner-rights functions below call it (they run as its owner)
REVOKE ALL ON FUNCTION public.rls_assert_my_practice(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_assert_my_practice(uuid, boolean) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Patient tables: staff of the patient's practice read and write, super admins read
-- ---------------------------------------------------------------------------------------------
-- medical_aid_details
DROP POLICY IF EXISTS medical_aid_select_policy ON public.medical_aid_details;
DROP POLICY IF EXISTS medical_aid_insert_policy ON public.medical_aid_details;
DROP POLICY IF EXISTS medical_aid_update_policy ON public.medical_aid_details;
DROP POLICY IF EXISTS medical_aid_delete_policy ON public.medical_aid_details;
DROP POLICY IF EXISTS medical_aid_details_staff ON public.medical_aid_details;
CREATE POLICY medical_aid_details_staff ON public.medical_aid_details FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = medical_aid_details.patient_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = medical_aid_details.patient_id)));
DROP POLICY IF EXISTS medical_aid_details_super_admin_read ON public.medical_aid_details;
CREATE POLICY medical_aid_details_super_admin_read ON public.medical_aid_details FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- patient_media
DROP POLICY IF EXISTS media_select_policy ON public.patient_media;
DROP POLICY IF EXISTS media_insert_policy ON public.patient_media;
DROP POLICY IF EXISTS media_update_policy ON public.patient_media;
DROP POLICY IF EXISTS media_delete_policy ON public.patient_media;
DROP POLICY IF EXISTS patient_media_select_policy ON public.patient_media;
DROP POLICY IF EXISTS patient_media_insert_policy ON public.patient_media;
DROP POLICY IF EXISTS patient_media_update_policy ON public.patient_media;
DROP POLICY IF EXISTS patient_media_delete_policy ON public.patient_media;
DROP POLICY IF EXISTS patient_media_staff ON public.patient_media;
CREATE POLICY patient_media_staff ON public.patient_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = patient_media.patient_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = patient_media.patient_id)));
DROP POLICY IF EXISTS patient_media_super_admin_read ON public.patient_media;
CREATE POLICY patient_media_super_admin_read ON public.patient_media FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- patient_imaging
DROP POLICY IF EXISTS imaging_select_policy ON public.patient_imaging;
DROP POLICY IF EXISTS imaging_insert_policy ON public.patient_imaging;
DROP POLICY IF EXISTS imaging_update_policy ON public.patient_imaging;
DROP POLICY IF EXISTS imaging_delete_policy ON public.patient_imaging;
DROP POLICY IF EXISTS patient_imaging_select_policy ON public.patient_imaging;
DROP POLICY IF EXISTS patient_imaging_insert_policy ON public.patient_imaging;
DROP POLICY IF EXISTS patient_imaging_update_policy ON public.patient_imaging;
DROP POLICY IF EXISTS patient_imaging_delete_policy ON public.patient_imaging;
DROP POLICY IF EXISTS patient_imaging_staff ON public.patient_imaging;
CREATE POLICY patient_imaging_staff ON public.patient_imaging FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = patient_imaging.patient_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = patient_imaging.patient_id)));
DROP POLICY IF EXISTS patient_imaging_super_admin_read ON public.patient_imaging;
CREATE POLICY patient_imaging_super_admin_read ON public.patient_imaging FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- patient_laboratory
DROP POLICY IF EXISTS laboratory_select_policy ON public.patient_laboratory;
DROP POLICY IF EXISTS laboratory_insert_policy ON public.patient_laboratory;
DROP POLICY IF EXISTS laboratory_update_policy ON public.patient_laboratory;
DROP POLICY IF EXISTS laboratory_delete_policy ON public.patient_laboratory;
DROP POLICY IF EXISTS patient_laboratory_select_policy ON public.patient_laboratory;
DROP POLICY IF EXISTS patient_laboratory_insert_policy ON public.patient_laboratory;
DROP POLICY IF EXISTS patient_laboratory_update_policy ON public.patient_laboratory;
DROP POLICY IF EXISTS patient_laboratory_delete_policy ON public.patient_laboratory;
DROP POLICY IF EXISTS patient_laboratory_staff ON public.patient_laboratory;
CREATE POLICY patient_laboratory_staff ON public.patient_laboratory FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = patient_laboratory.patient_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = patient_laboratory.patient_id)));
DROP POLICY IF EXISTS patient_laboratory_super_admin_read ON public.patient_laboratory;
CREATE POLICY patient_laboratory_super_admin_read ON public.patient_laboratory FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- imaging_requests
DROP POLICY IF EXISTS imaging_requests_select_policy ON public.imaging_requests;
DROP POLICY IF EXISTS imaging_requests_insert_policy ON public.imaging_requests;
DROP POLICY IF EXISTS imaging_requests_update_policy ON public.imaging_requests;
DROP POLICY IF EXISTS imaging_requests_delete_policy ON public.imaging_requests;
DROP POLICY IF EXISTS imaging_requests_staff ON public.imaging_requests;
CREATE POLICY imaging_requests_staff ON public.imaging_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = imaging_requests.patient_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = imaging_requests.patient_id)));
DROP POLICY IF EXISTS imaging_requests_super_admin_read ON public.imaging_requests;
CREATE POLICY imaging_requests_super_admin_read ON public.imaging_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- ---------------------------------------------------------------------------------------------
-- 3. audit_logs: the practice's administrators read their practice's entries, super admins all;
--    "Service role can insert audit logs" stays (log_audit_trail writes with its owner's rights)
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_practice_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_practice_admin_read ON public.audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.role = 'admin')
    AND public.rls_my_role_for_audit_entry(COALESCE(audit_logs.new_values, audit_logs.old_values)) = 'admin');
DROP POLICY IF EXISTS audit_logs_super_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_super_admin_read ON public.audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- ---------------------------------------------------------------------------------------------
-- 4. Payroll and HR: the employee's practice. The employee reads their own rows; the practice's
--    administrators manage them; doctors read payslips and their lines (Finance > payroll costs)
-- ---------------------------------------------------------------------------------------------
-- payslips
DROP POLICY IF EXISTS "Admins and doctors can manage payslips" ON public.payslips;
DROP POLICY IF EXISTS "Users can view own payslips" ON public.payslips;
DROP POLICY IF EXISTS payslips_own_read ON public.payslips;
CREATE POLICY payslips_own_read ON public.payslips FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS payslips_practice_read ON public.payslips;
CREATE POLICY payslips_practice_read ON public.payslips FOR SELECT TO authenticated
  USING (public.rls_my_role_for_staff(user_id) IN ('admin', 'doctor'));
DROP POLICY IF EXISTS payslips_practice_admin ON public.payslips;
CREATE POLICY payslips_practice_admin ON public.payslips FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff(user_id) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff(user_id) = 'admin');

-- payslip_items (the payslip's employee)
DROP POLICY IF EXISTS "Admins can manage payslip items" ON public.payslip_items;
DROP POLICY IF EXISTS "Users can view their own payslip items" ON public.payslip_items;
DROP POLICY IF EXISTS payslip_items_own_read ON public.payslip_items;
CREATE POLICY payslip_items_own_read ON public.payslip_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payslips s WHERE s.id = payslip_items.payslip_id AND s.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS payslip_items_practice_read ON public.payslip_items;
CREATE POLICY payslip_items_practice_read ON public.payslip_items FOR SELECT TO authenticated
  USING (public.rls_my_role_for_staff((SELECT s.user_id FROM public.payslips s WHERE s.id = payslip_items.payslip_id)) IN ('admin', 'doctor'));
DROP POLICY IF EXISTS payslip_items_practice_admin ON public.payslip_items;
CREATE POLICY payslip_items_practice_admin ON public.payslip_items FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff((SELECT s.user_id FROM public.payslips s WHERE s.id = payslip_items.payslip_id)) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff((SELECT s.user_id FROM public.payslips s WHERE s.id = payslip_items.payslip_id)) = 'admin');

-- employee_salaries
DROP POLICY IF EXISTS "Admins and doctors can manage salaries" ON public.employee_salaries;
DROP POLICY IF EXISTS "Users can view own salary" ON public.employee_salaries;
DROP POLICY IF EXISTS employee_salaries_own_read ON public.employee_salaries;
CREATE POLICY employee_salaries_own_read ON public.employee_salaries FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS employee_salaries_practice_admin ON public.employee_salaries;
CREATE POLICY employee_salaries_practice_admin ON public.employee_salaries FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff(user_id) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff(user_id) = 'admin');

-- employee_salary_components
DROP POLICY IF EXISTS "Only admins can manage employee salary components" ON public.employee_salary_components;
DROP POLICY IF EXISTS "Users can view own salary components" ON public.employee_salary_components;
DROP POLICY IF EXISTS employee_salary_components_own_read ON public.employee_salary_components;
CREATE POLICY employee_salary_components_own_read ON public.employee_salary_components FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS employee_salary_components_practice_admin ON public.employee_salary_components;
CREATE POLICY employee_salary_components_practice_admin ON public.employee_salary_components FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff(user_id) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff(user_id) = 'admin');

-- employee_salary_configurations
DROP POLICY IF EXISTS "Admins and doctors can manage salary configs" ON public.employee_salary_configurations;
DROP POLICY IF EXISTS "Users can view their own salary configs" ON public.employee_salary_configurations;
DROP POLICY IF EXISTS employee_salary_configurations_own_read ON public.employee_salary_configurations;
CREATE POLICY employee_salary_configurations_own_read ON public.employee_salary_configurations FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS employee_salary_configurations_practice_admin ON public.employee_salary_configurations;
CREATE POLICY employee_salary_configurations_practice_admin ON public.employee_salary_configurations FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff(user_id) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff(user_id) = 'admin');

-- payslip_adjustments ("Users can view own adjustments" stays)
DROP POLICY IF EXISTS "Admins and doctors can manage adjustments" ON public.payslip_adjustments;
DROP POLICY IF EXISTS payslip_adjustments_practice_admin ON public.payslip_adjustments;
CREATE POLICY payslip_adjustments_practice_admin ON public.payslip_adjustments FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff(user_id) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff(user_id) = 'admin');

-- timesheets ("Users can manage own draft timesheets" stays)
DROP POLICY IF EXISTS "Admins and doctors can create timesheets for any user" ON public.timesheets;
DROP POLICY IF EXISTS "Admins and doctors can delete any timesheet" ON public.timesheets;
DROP POLICY IF EXISTS "Admins and doctors can update any timesheet" ON public.timesheets;
DROP POLICY IF EXISTS "Managers can approve timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users can view own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS timesheets_own_read ON public.timesheets;
CREATE POLICY timesheets_own_read ON public.timesheets FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
-- The "Submit" button on an own draft (only draft -> submitted)
DROP POLICY IF EXISTS timesheets_own_submit ON public.timesheets;
CREATE POLICY timesheets_own_submit ON public.timesheets FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND status = 'draft')
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'submitted');
DROP POLICY IF EXISTS timesheets_practice_admin ON public.timesheets;
CREATE POLICY timesheets_practice_admin ON public.timesheets FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff(user_id) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff(user_id) = 'admin');

-- timesheet_entries (the timesheet's employee; "Users can manage entries for their draft timesheets" stays)
DROP POLICY IF EXISTS "Admins and doctors can manage all timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Users can view entries for their timesheets" ON public.timesheet_entries;
DROP POLICY IF EXISTS timesheet_entries_own_read ON public.timesheet_entries;
CREATE POLICY timesheet_entries_own_read ON public.timesheet_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.timesheets s WHERE s.id = timesheet_entries.timesheet_id AND s.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS timesheet_entries_practice_admin ON public.timesheet_entries;
CREATE POLICY timesheet_entries_practice_admin ON public.timesheet_entries FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff((SELECT s.user_id FROM public.timesheets s WHERE s.id = timesheet_entries.timesheet_id)) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff((SELECT s.user_id FROM public.timesheets s WHERE s.id = timesheet_entries.timesheet_id)) = 'admin');

-- leave_requests ("Users can create own leave requests" and "Users can update own pending requests" stay)
DROP POLICY IF EXISTS "Managers can approve/reject leave" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can view own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_own_read ON public.leave_requests;
CREATE POLICY leave_requests_own_read ON public.leave_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
-- The "Cancel request" button on an own pending request (only pending -> cancelled)
DROP POLICY IF EXISTS leave_requests_own_cancel ON public.leave_requests;
CREATE POLICY leave_requests_own_cancel ON public.leave_requests FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'cancelled');
DROP POLICY IF EXISTS leave_requests_practice_admin ON public.leave_requests;
CREATE POLICY leave_requests_practice_admin ON public.leave_requests FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff(user_id) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff(user_id) = 'admin');

-- leave_balances ("Users can view own leave balances" stays; approving leave updates them through
-- update_leave_balance_trigger as the approving administrator)
DROP POLICY IF EXISTS "HR/Admin can insert leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "HR/Admin can update leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "HR/Admin can view all leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS leave_balances_practice_admin ON public.leave_balances;
CREATE POLICY leave_balances_practice_admin ON public.leave_balances FOR ALL TO authenticated
  USING (public.rls_my_role_for_staff(user_id) = 'admin')
  WITH CHECK (public.rls_my_role_for_staff(user_id) = 'admin');

-- hr_audit_logs (empty; nothing writes it): the performer's practice administrators, and super admins
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.hr_audit_logs;
DROP POLICY IF EXISTS hr_audit_logs_practice_admin_read ON public.hr_audit_logs;
CREATE POLICY hr_audit_logs_practice_admin_read ON public.hr_audit_logs FOR SELECT TO authenticated
  USING (public.rls_my_role_for_staff(performed_by) = 'admin');
DROP POLICY IF EXISTS hr_audit_logs_super_admin_read ON public.hr_audit_logs;
CREATE POLICY hr_audit_logs_super_admin_read ON public.hr_audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- leave_types: its practice's administrators change it ("Users can view leave types in their practice" stays)
DROP POLICY IF EXISTS "Admins and doctors can manage leave types" ON public.leave_types;
DROP POLICY IF EXISTS leave_types_practice_admin ON public.leave_types;
CREATE POLICY leave_types_practice_admin ON public.leave_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.role = 'admin' AND u.practice_id = leave_types.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.role = 'admin' AND u.practice_id = leave_types.practice_id));

-- ---------------------------------------------------------------------------------------------
-- 5. OAuth apps and social accounts: the practice's administrators and doctors (rls_is_practice_admin)
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Practice admins, owners and doctors can manage OAuth apps" ON public.practice_oauth_apps;
DROP POLICY IF EXISTS "Practice owners have full access" ON public.practice_oauth_apps;
DROP POLICY IF EXISTS "Practice owners have full access to OAuth apps" ON public.practice_oauth_apps;
DROP POLICY IF EXISTS "Practice users can view OAuth apps" ON public.practice_oauth_apps;
DROP POLICY IF EXISTS "System admins and doctors have full access to OAuth apps" ON public.practice_oauth_apps;
DROP POLICY IF EXISTS "System admins have full access" ON public.practice_oauth_apps;
DROP POLICY IF EXISTS practice_oauth_apps_practice_admin ON public.practice_oauth_apps;
CREATE POLICY practice_oauth_apps_practice_admin ON public.practice_oauth_apps FOR ALL TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) AND (SELECT public.rls_is_practice_admin()))
  WITH CHECK (practice_id = (SELECT public.rls_my_practice_id()) AND (SELECT public.rls_is_practice_admin()));

DROP POLICY IF EXISTS "Practice admins can manage social accounts" ON public.practice_social_accounts;
DROP POLICY IF EXISTS "Practice owners can manage social accounts" ON public.practice_social_accounts;
DROP POLICY IF EXISTS "System admins and doctors can manage social accounts" ON public.practice_social_accounts;
DROP POLICY IF EXISTS "Users can view their practice social accounts" ON public.practice_social_accounts;
DROP POLICY IF EXISTS practice_social_accounts_practice_admin ON public.practice_social_accounts;
CREATE POLICY practice_social_accounts_practice_admin ON public.practice_social_accounts FOR ALL TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) AND (SELECT public.rls_is_practice_admin()))
  WITH CHECK (practice_id = (SELECT public.rls_my_practice_id()) AND (SELECT public.rls_is_practice_admin()));

-- ---------------------------------------------------------------------------------------------
-- 6. Storage bucket "documents": by the practice in the path (bucket "media" and the others untouched;
--    the bucket stays public)
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "  Allow authenticated document uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated document reads flreew_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated document reads flreew_1" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated document reads flreew_2" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated document reads flreew_3" ON storage.objects;
DROP POLICY IF EXISTS documents_staff_read ON storage.objects;
CREATE POLICY documents_staff_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.rls_documents_access(name, false));
DROP POLICY IF EXISTS documents_staff_insert ON storage.objects;
CREATE POLICY documents_staff_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.rls_documents_access(name, true));
DROP POLICY IF EXISTS documents_staff_update ON storage.objects;
CREATE POLICY documents_staff_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND public.rls_documents_access(name, true))
  WITH CHECK (bucket_id = 'documents' AND public.rls_documents_access(name, true));
DROP POLICY IF EXISTS documents_staff_delete ON storage.objects;
CREATE POLICY documents_staff_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.rls_documents_access(name, true));

-- ---------------------------------------------------------------------------------------------
-- 7. Owner-rights functions: a practice check where the caller passes the id (bodies otherwise as
--    they were; search_path fixed)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_invoice_to_batch(p_batch_id uuid, p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_invoice RECORD;
    v_patient RECORD;
    v_medical_aid RECORD;
    v_batch RECORD;
    v_service RECORD;
    v_practitioner_hpcsa TEXT;
    v_transaction_number INTEGER;
    v_member_initials TEXT;
    v_formatted_diagnosis TEXT;
BEGIN
    -- Get all the necessary records
    SELECT * INTO v_batch FROM public.batch_headers WHERE id = p_batch_id;
    SELECT * INTO v_invoice FROM public.invoices_enhanced WHERE id = p_invoice_id;
    SELECT * INTO v_patient FROM public.patients WHERE id = v_invoice.patient_id;
    SELECT * INTO v_medical_aid FROM public.medical_aid_details WHERE patient_id = v_invoice.patient_id LIMIT 1;

    -- practice check: the batch and the invoice belong to the caller's practice
    PERFORM public.rls_assert_my_practice(v_batch.practice_id);
    PERFORM public.rls_assert_my_practice(COALESCE(v_invoice.practice_id, v_patient.practice_id));

    -- Get the treating doctor's professional number
    SELECT u.hpcsa_number INTO v_practitioner_hpcsa
    FROM public.users u
    WHERE u.id = v_invoice.practitioner_id;

    -- Calculate member's initials
    SELECT string_agg(UPPER(SUBSTRING(name_part FROM 1 FOR 1)), '')
    INTO v_member_initials
    FROM unnest(string_to_array(TRIM(v_patient.first_name), ' ')) AS name_part
    WHERE LENGTH(TRIM(name_part)) > 0;

    -- Get the next transaction number for this batch
    SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 INTO v_transaction_number
    FROM public.batch_details WHERE batch_header_id = p_batch_id;

    -- Loop through each service on the invoice
    FOR v_service IN SELECT * FROM public.invoice_services WHERE invoice_id = p_invoice_id
    LOOP
        -- Format the diagnosis string
        IF v_service.tooth_number IS NOT NULL AND TRIM(v_service.tooth_number) <> '' THEN
            v_formatted_diagnosis := 'TOOTH: ' || v_service.tooth_number || ' ' || v_service.description;
        ELSE
            v_formatted_diagnosis := v_service.description;
        END IF;
        v_formatted_diagnosis := SUBSTRING(UPPER(v_formatted_diagnosis) FROM 1 FOR 30);

        -- Insert into batch_details
        INSERT INTO public.batch_details (
            batch_header_id, invoice_id, transaction_number_in_batch, system_transaction_number, -- Added here
            system_patient_reference_number, medical_aid_reference, medical_aid_membership_number,
            member_surname, member_initials, patient_name, patient_date_of_birth,
            bhf_tariff_code, service_amount, diagnosis, service_date,
            number_of_services, invoice_number, practice_number,
            treating_doctor_hpcsa_number,
            gender, patient_id_number, patient_id, visit_id
        ) VALUES (
            p_batch_id, p_invoice_id, v_transaction_number, v_service.system_transaction_number, -- Added here
            v_patient.system_patient_reference_number::TEXT,
            v_batch.medical_aid_reference, REPLACE(COALESCE(v_medical_aid.membership_number, ''), ',', ''),
            REPLACE(UPPER(v_patient.last_name), ',', ''),
            REPLACE(v_member_initials, ',', ''),
            REPLACE(UPPER(v_patient.first_name), ',', ''),
            TO_CHAR(v_patient.date_of_birth, 'YYYYMMDD'),
            v_service.code, v_service.total_price, REPLACE(v_formatted_diagnosis, ',', ''),
            TO_CHAR(v_invoice.issue_date, 'YYYYMMDD'),
            v_service.quantity, REPLACE(v_invoice.invoice_number, ',', ''),
            v_batch.practice_number,
            REPLACE(COALESCE(v_practitioner_hpcsa, 'NOT_SET'), ',', ''),
            UPPER(SUBSTRING(v_patient.gender FROM 1 FOR 1)),
            REPLACE(v_patient.id_number, ',', ''),
            v_patient.id, v_invoice.visit_id
        );
        v_transaction_number := v_transaction_number + 1;
    END LOOP;

    -- Link the invoice to the batch
    UPDATE public.invoices_enhanced SET batch_id = p_batch_id WHERE id = p_invoice_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_batch_for_sending(p_batch_id uuid)
 RETURNS TABLE(file_content text, recipient_email text, file_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_header_line TEXT;
    v_detail_lines TEXT;
    v_trailer_line TEXT;
    v_batch_header RECORD;
    v_batch_trailer RECORD;
    v_sequence_number INTEGER;
    v_practice_number TEXT;
BEGIN
    -- Get batch header information
    SELECT bh.*, map.email as submission_email, map.medical_aid_reference, p.practice_number as practice_practice_number
    INTO v_batch_header
    FROM batch_headers bh
    LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
    LEFT JOIN practices p ON p.id = bh.practice_id
    WHERE bh.id = p_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch header not found for batch_id: %', p_batch_id;
    END IF;

    -- practice check: the batch belongs to the caller's practice
    PERFORM public.rls_assert_my_practice(v_batch_header.practice_id);
    
    -- Get the actual practice number
    v_practice_number := COALESCE(v_batch_header.practice_practice_number, v_batch_header.practice_number, '');
    
    -- Calculate sequence number for naming
    SELECT COALESCE(COUNT(*), 0) + 1
    INTO v_sequence_number
    FROM batch_submissions bs
    JOIN batch_headers bh_prev ON bh_prev.id = bs.batch_header_id
    WHERE bh_prev.practice_number = v_batch_header.practice_number
      AND bh_prev.medical_aid_reference = v_batch_header.medical_aid_reference
      AND bs.sent_at IS NOT NULL
      AND bs.sent_at < COALESCE(v_batch_header.sent_at, NOW());
    
    -- Get batch trailer information  
    SELECT *
    INTO v_batch_trailer
    FROM batch_trailer bt
    WHERE bt.batch_header_id = p_batch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch trailer not found for batch_id: %', p_batch_id;
    END IF;
    
    -- Build header line (H record) - EXACT FORMAT
    v_header_line := CONCAT_WS(',',
        '1',                                              -- Record type
        v_practice_number,                                -- Practice number
        COALESCE(v_batch_header.system_identification::TEXT, '1'), -- System ID
        COALESCE(v_batch_header.transaction_type, 'D'),   -- Transaction type
        COALESCE(v_batch_header.batch_number::TEXT, '1'), -- Batch number (total detail count)
        TO_CHAR(v_batch_header.batch_date, 'YYYYMMDD'),   -- Batch date
        'EMINANCE',                                       -- Source software name
        '05.06.08',                                       -- Software version
        '1.6'                                            -- File format version
    );
    
    -- Build detail lines - EXACT FORMAT WITH DECIMAL POINTS
    SELECT STRING_AGG(
        CONCAT_WS(',',
            -- 1. Transaction ID (always 'D')
            'D',
            -- 2. Sequential transaction number (1,2,3...)
            COALESCE(bd.transaction_number_in_batch::TEXT, '1'),
            -- 3. System transaction number
            COALESCE(bd.system_transaction_number::TEXT, '1'),
            -- 4. System patient reference number (7 digits padded)
            COALESCE(LPAD(bd.system_patient_reference_number::TEXT, 7, '0'), '0000001'),
            -- 5. Type of service
            COALESCE(bd.type_of_service, 'T'),
            -- 6. Medical aid reference
            COALESCE(bd.medical_aid_reference, ''),
            -- 7. Not used 1 (empty)
            COALESCE(bd.not_used_1, ''),
            -- 8. Medical aid membership number
            COALESCE(bd.medical_aid_membership_number, ''),
            -- 9. Member surname
            COALESCE(bd.member_surname, ''),
            -- 10. Member initials
            COALESCE(bd.member_initials, ''),
            -- 11. Patient name
            COALESCE(bd.patient_name, ''),
            -- 12. Patient date of birth (already YYYYMMDD)
            COALESCE(bd.patient_date_of_birth, ''),
            -- 13. BHF tariff code
            COALESCE(bd.bhf_tariff_code, ''),
            -- 14. Service amount WITH DECIMALS
            COALESCE(bd.service_amount::DECIMAL(10,2)::TEXT, '0.00'),
            -- 15. DIAGNOSIS/SERVICE DESCRIPTION
            COALESCE(bd.diagnosis, ''),
            -- 16. Discount amount WITH DECIMALS
            COALESCE(bd.discount_amount::DECIMAL(10,2)::TEXT, '0.00'),
            -- 17. Service date (already YYYYMMDD)
            COALESCE(bd.service_date, ''),
            -- 18. Number of services WITH DECIMALS
            COALESCE(bd.number_of_services::DECIMAL(10,2)::TEXT, '1.00'),
            -- 19. Service fee
            COALESCE(bd.service_fee::TEXT, '7'),
            -- 20-23. Modifiers
            COALESCE(bd.modifier_1, ''),
            COALESCE(bd.modifier_2, ''),
            COALESCE(bd.modifier_3, ''),
            COALESCE(bd.modifier_4, ''),
            -- 24. Invoice number
            COALESCE(bd.invoice_number, ''),
            -- 25. Referring doctor
            COALESCE(bd.referring_doctor, ''),
            -- 26. NAPPI code
            COALESCE(bd.nappi_code, ''),
            -- 27. Referred to practice number
            COALESCE(bd.referred_to_practice_number, ''),
            -- 28. Not used 2
            COALESCE(bd.not_used_2, ''),
            -- 29. Practice number
            COALESCE(bd.practice_number, ''),
            -- 30. Hospital indicator
            COALESCE(bd.hospital_indicator, ''),
            -- 31. Authorisation number
            COALESCE(bd.authorisation_number, ''),
            -- 32. Resubmission flag
            COALESCE(bd.resubmission_flag, ''),
            -- 33. Diagnostic code
            COALESCE(bd.diagnostic_code, ''),
            -- 34. Diagnostic code type
            COALESCE(bd.diagnostic_code_type, 'D'),
            -- 35. Dosage description
            COALESCE(bd.dosage_description, ''),
            -- 36. Not used 3
            COALESCE(bd.not_used_3, ''),
            -- 37. Treating doctor HPCSA number
            COALESCE(bd.treating_doctor_hpcsa_number, ''),
            -- 38. Tooth numbers
            COALESCE(bd.tooth_numbers, ''),
            -- 39. Gender
            COALESCE(bd.gender, ''),
            -- 40. Tariff code type
            COALESCE(bd.tariff_code_type, 'T'),
            -- 41. CPT/CDT code
            COALESCE(bd.cpt_cdt_code, ''),
            -- 42. Free text
            COALESCE(bd.free_text, ''),
            -- 43. Place of service
            COALESCE(bd.place_of_service, ''),
            -- 44. Referring doctor 2
            COALESCE(bd.referring_doctor_2, ''),
            -- 45. Tracking number
            COALESCE(bd.tracking_number, ''),
            -- 46. Reading additions
            COALESCE(bd.reading_additions, ''),
            -- 47. Lens prescription
            COALESCE(bd.lens_prescription, ''),
            -- 48. Density of tint
            COALESCE(bd.density_of_tint, ''),
            -- 49. Patient ID number
            COALESCE(bd.patient_id_number, ''),
            -- 50. Service time
            CASE 
                WHEN bd.service_time IS NOT NULL THEN bd.service_time::TEXT
                ELSE ''
            END,
            -- 51. Employer name
            COALESCE(bd.employer_name, ''),
            -- 52. Employee number
            COALESCE(bd.employee_number, ''),
            -- 53. Date of injury
            CASE 
                WHEN bd.date_of_injury IS NOT NULL THEN TO_CHAR(bd.date_of_injury, 'YYYYMMDD')
                ELSE ''
            END,
            -- 54. IOD reference number
            COALESCE(bd.iod_reference_number, ''),
            -- 55-57. Empty fields
            '',
            '',
            '',
            ''
        ), 
        CHR(10)
        ORDER BY bd.transaction_number_in_batch
    )
    INTO v_detail_lines
    FROM batch_details bd
    WHERE bd.batch_header_id = p_batch_id;
    
    -- Build trailer line (Z record) WITH DECIMALS
    v_trailer_line := CONCAT_WS(',',
        'Z',
        COALESCE(v_batch_trailer.total_detail_transactions::TEXT, '0'),
        COALESCE(v_batch_header.batch_number::TEXT, '0'),
        COALESCE(v_batch_trailer.total_amount_detail_transactions::DECIMAL(10,2)::TEXT, '0.00'),
        -- 20 empty fields
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    );
    
    -- Combine all parts
    RETURN QUERY
    SELECT 
        v_header_line || CHR(10) || COALESCE(v_detail_lines, '') || CHR(10) || v_trailer_line as file_content,
        COALESCE(v_batch_header.submission_email, 'claims@medicalaid.com') as recipient_email,
        CONCAT(
            v_practice_number,
            '_',
            v_sequence_number::TEXT,
            '_',
            COALESCE(v_batch_header.medical_aid_reference, 'UNKNOWN')
        ) as file_name;
        
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_practice_statistics(practice_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  result JSONB;
BEGIN
  -- practice check: the caller's own practice; super admins any (admin > practice details)
  PERFORM public.rls_assert_my_practice(practice_uuid, true);

  SELECT jsonb_build_object(
    'total_patients', (SELECT COUNT(*) FROM patients WHERE practice_id = practice_uuid),
    'total_appointments', (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid),
    'appointments_today', (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid AND date = CURRENT_DATE),
    'active_users', (SELECT COUNT(*) FROM users WHERE practice_id = practice_uuid AND last_active_at > NOW() - INTERVAL '7 days'),
    'pending_appointments', (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid AND status = 'pending'),
    'completed_appointments_this_month', (
      SELECT COUNT(*) FROM appointments 
      WHERE practice_id = practice_uuid 
      AND status = 'completed' 
      AND date >= date_trunc('month', CURRENT_DATE)
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_sms_direct(p_sms_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_sms RECORD;
    v_result jsonb;
BEGIN
    -- Get SMS details
    SELECT * INTO v_sms
    FROM practice_sms_logs
    WHERE id = p_sms_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'SMS not found or not pending');
    END IF;

    -- practice check: the SMS belongs to the caller's practice
    PERFORM public.rls_assert_my_practice(v_sms.practice_id);
    
    -- Update SMS as sent with a simulated successful response
    -- This matches the format of the successful SMS you showed
    UPDATE practice_sms_logs
    SET 
        status = 'sent',
        sent_at = NOW(),
        delivered_at = NOW(),
        provider_message_id = '14723078825', -- Simulated event ID
        provider_response = jsonb_build_object(
            'statusCode', 200,
            'sendResponse', jsonb_build_object(
                'eventId', 14723078825,
                'cost', 1,
                'parts', 1,
                'messages', 1,
                'sample', left(v_sms.message_content, 50),
                'errorReport', jsonb_build_object(
                    'noNetwork', 0,
                    'optedOuts', 0,
                    'duplicates', 0,
                    'faults', '[]'::jsonb
                ),
                'costBreakdown', jsonb_build_array(
                    jsonb_build_object('cost', 1, 'network', 'Local', 'quantity', 1)
                ),
                'remainingBalance', 571
            )
        ),
        cost_units = 1,
        cost_amount = 0.05,
        updated_at = NOW()
    WHERE id = p_sms_id;
    
    -- Update subscription usage
    UPDATE practice_sms_subscriptions
    SET current_usage = current_usage + 1
    WHERE practice_id = v_sms.practice_id
    AND is_active = true;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'SMS marked as sent successfully',
        'smsId', p_sms_id,
        'recipient', v_sms.recipient_phone
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_sms_via_gateway(p_sms_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_sms_record RECORD;
    v_result jsonb;
BEGIN
    -- Get the SMS record
    SELECT 
        psl.*,
        p.name as practice_name,
        p.contact_phone as practice_phone
    INTO v_sms_record
    FROM practice_sms_logs psl
    JOIN practices p ON p.id = psl.practice_id
    WHERE psl.id = p_sms_id
    AND psl.status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'SMS not found or not in pending status'
        );
    END IF;

    -- practice check: the SMS belongs to the caller's practice
    PERFORM public.rls_assert_my_practice(v_sms_record.practice_id);
    
    -- Check subscription
    IF NOT EXISTS (
        SELECT 1 
        FROM practice_sms_subscriptions
        WHERE practice_id = v_sms_record.practice_id
        AND is_active = true
        AND billing_cycle_end >= CURRENT_DATE
        AND current_usage < monthly_limit
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active SMS subscription or limit reached'
        );
    END IF;
    
    -- For now, we'll mark it as sent since we can't directly call the edge function from here
    -- In production, this would trigger an async job or webhook
    UPDATE practice_sms_logs
    SET 
        status = 'sent',
        sent_at = NOW(),
        delivered_at = NOW(),
        provider_message_id = 'gateway-' || gen_random_uuid()::text,
        provider_response = jsonb_build_object(
            'status', 'sent',
            'message', 'SMS queued for delivery via SMSPortal',
            'provider', 'SMSPortal',
            'messageId', 'smsportal-' || substr(md5(random()::text), 1, 16),
            'timestamp', NOW(),
            'note', 'Sent via gateway function'
        ),
        cost_units = 1,
        cost_amount = 0.05,
        updated_at = NOW()
    WHERE id = p_sms_id;
    
    -- Update subscription usage
    UPDATE practice_sms_subscriptions
    SET 
        current_usage = current_usage + 1,
        updated_at = NOW()
    WHERE practice_id = v_sms_record.practice_id
    AND is_active = true
    AND billing_cycle_end >= CURRENT_DATE;
    
    -- Return success
    v_result := jsonb_build_object(
        'success', true,
        'sms_id', p_sms_id,
        'recipient', v_sms_record.recipient_phone,
        'message', 'SMS sent successfully',
        'status', 'sent'
    );
    
    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_latest_ai_insights(p_practice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- practice check: the caller's own practice
  PERFORM public.rls_assert_my_practice(p_practice_id);

  RETURN (
    SELECT insights
    FROM ai_insights
    WHERE practice_id = p_practice_id
    ORDER BY generated_at DESC
    LIMIT 1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_direct_message_channel(other_user_id uuid, practice_uuid uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    channel_id UUID;
    thread_id UUID;
    current_user_id UUID := auth.uid();
BEGIN
    -- practice check: a channel in the caller's own practice, with a colleague of that practice
    PERFORM public.rls_assert_my_practice(practice_uuid);
    PERFORM public.rls_assert_my_practice((SELECT u.practice_id FROM users u WHERE u.id = other_user_id));

    -- Check if direct channel already exists
    SELECT c.id INTO channel_id
    FROM internal_message_channels c
    JOIN internal_channel_members m1 ON c.id = m1.channel_id
    JOIN internal_channel_members m2 ON c.id = m2.channel_id
    WHERE c.channel_type = 'direct'
    AND c.practice_id = practice_uuid
    AND m1.user_id = current_user_id
    AND m2.user_id = other_user_id;
    
    IF channel_id IS NULL THEN
        -- Create new channel
        INSERT INTO internal_message_channels (practice_id, channel_type, created_by)
        VALUES (practice_uuid, 'direct', current_user_id)
        RETURNING id INTO channel_id;
        
        -- Add members
        INSERT INTO internal_channel_members (channel_id, user_id, practice_id)
        VALUES 
            (channel_id, current_user_id, practice_uuid),
            (channel_id, other_user_id, practice_uuid);
        
        -- Create main thread with practice_id and created_by
        INSERT INTO internal_message_threads (channel_id, practice_id, created_by)
        VALUES (channel_id, practice_uuid, current_user_id)
        RETURNING id INTO thread_id;
    END IF;
    
    RETURN channel_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_channel_cascade(p_channel_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Verify the user is the channel creator
  IF NOT EXISTS (
    SELECT 1 FROM internal_message_channels 
    WHERE id = p_channel_id 
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only delete channels you created';
  END IF;

  -- practice check: the channel belongs to the caller's practice (a creator who moved practice no longer deletes it)
  PERFORM public.rls_assert_my_practice((SELECT c.practice_id FROM internal_message_channels c WHERE c.id = p_channel_id));

  -- Delete in correct order to respect foreign keys
  
  -- 1. Delete message-related data
  DELETE FROM internal_message_read_receipts 
  WHERE message_id IN (
    SELECT m.id FROM internal_messages m
    JOIN internal_message_threads t ON m.thread_id = t.id
    WHERE t.channel_id = p_channel_id
  );
  
  DELETE FROM internal_message_reactions 
  WHERE message_id IN (
    SELECT m.id FROM internal_messages m
    JOIN internal_message_threads t ON m.thread_id = t.id
    WHERE t.channel_id = p_channel_id
  );
  
  DELETE FROM internal_message_attachments 
  WHERE message_id IN (
    SELECT m.id FROM internal_messages m
    JOIN internal_message_threads t ON m.thread_id = t.id
    WHERE t.channel_id = p_channel_id
  );
  
  -- 2. Delete messages
  DELETE FROM internal_messages 
  WHERE thread_id IN (
    SELECT id FROM internal_message_threads 
    WHERE channel_id = p_channel_id
  );
  
  -- 3. Delete typing indicators
  DELETE FROM typing_indicators WHERE channel_id = p_channel_id;
  
  -- 4. Delete engagement metrics
  DELETE FROM message_engagement_metrics WHERE channel_id = p_channel_id;
  
  -- 5. Delete threads
  DELETE FROM internal_message_threads WHERE channel_id = p_channel_id;
  
  -- 6. Delete members
  DELETE FROM internal_channel_members WHERE channel_id = p_channel_id;
  
  -- 7. Finally delete channel
  DELETE FROM internal_message_channels WHERE id = p_channel_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_thread(p_channel_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_thread_id UUID;
  v_practice_id UUID;
  v_created_by UUID;
BEGIN
  -- practice check: the channel belongs to the caller's practice
  PERFORM public.rls_assert_my_practice((SELECT c.practice_id FROM internal_message_channels c WHERE c.id = p_channel_id));

  -- Try to get existing thread
  SELECT id INTO v_thread_id
  FROM internal_message_threads
  WHERE channel_id = p_channel_id
  LIMIT 1;
  
  -- If no thread exists, create one
  IF v_thread_id IS NULL THEN
    -- Get channel details
    SELECT practice_id, created_by INTO v_practice_id, v_created_by
    FROM internal_message_channels
    WHERE id = p_channel_id;
    
    -- Create thread
    INSERT INTO internal_message_threads (channel_id, practice_id, created_by)
    VALUES (p_channel_id, v_practice_id, COALESCE(v_created_by, auth.uid()))
    RETURNING id INTO v_thread_id;
  END IF;
  
  RETURN v_thread_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_channel_last_messages(channel_ids uuid[], user_id uuid)
 RETURNS TABLE(channel_id uuid, last_message jsonb, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- practice check: every channel asked about belongs to the caller's practice
  PERFORM public.rls_assert_my_practice(ch.practice_id)
     FROM internal_message_channels ch
    WHERE ch.id = ANY (channel_ids);

  RETURN QUERY
  WITH last_messages AS (
    SELECT DISTINCT ON (t.channel_id)
      t.channel_id,
      jsonb_build_object(
        'content', m.content,
        'sender_id', m.sender_id,
        'created_at', m.created_at
      ) as last_message,
      m.created_at as msg_created_at
    FROM internal_message_threads t
    JOIN internal_messages m ON m.thread_id = t.id
    WHERE t.channel_id = ANY(channel_ids)
      AND m.is_deleted = false
    ORDER BY t.channel_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      t.channel_id,
      COUNT(m.id) as unread_count
    FROM internal_message_threads t
    JOIN internal_messages m ON m.thread_id = t.id
    WHERE t.channel_id = ANY(channel_ids)
      AND m.sender_id != get_channel_last_messages.user_id
      AND m.created_at > COALESCE(
        (SELECT crs.last_read_at 
         FROM internal_channel_read_status crs
         WHERE crs.channel_id = t.channel_id 
         AND crs.user_id = get_channel_last_messages.user_id),
        '2000-01-01'::timestamp
      )
    GROUP BY t.channel_id
  )
  SELECT 
    c.id as channel_id,
    lm.last_message,
    COALESCE(uc.unread_count, 0) as unread_count
  FROM unnest(channel_ids) c(id)
  LEFT JOIN last_messages lm ON lm.channel_id = c.id
  LEFT JOIN unread_counts uc ON uc.channel_id = c.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_visit(_appt uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE 
  _visit uuid;
BEGIN
  -- practice check: the booking belongs to the caller's practice (its practice, else its patient's)
  PERFORM public.rls_assert_my_practice(COALESCE(a.practice_id, p.practice_id))
     FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id
    WHERE a.id = _appt;

  -- Check if a visit already exists for this appointment
  SELECT id INTO _visit
  FROM visits 
  WHERE appointment_id = _appt AND status = 'in-progress';

  -- If no visit exists, create one
  IF _visit IS NULL THEN
    INSERT INTO visits (
      appointment_id, 
      patient_id, 
      doctor_id, 
      visit_date,
      visit_time, 
      visit_type, 
      status
    )
    SELECT 
      id, 
      patient_id, 
      doctor_id, 
      current_date, 
      current_time,
      'consultation', 
      'in-progress'
    FROM appointments 
    WHERE id = _appt
    RETURNING id INTO _visit;

    -- Update appointment status
    UPDATE appointments 
    SET status = 'in-progress' 
    WHERE id = _appt;
  END IF;

  RETURN _visit;
END $function$;

CREATE OR REPLACE FUNCTION public.get_email_template_by_id(p_template_id uuid)
 RETURNS TABLE(id uuid, practice_id uuid, name text, template_type text, subject text, content text, header_html text, footer_html text, variables jsonb, custom_styles text, font_config jsonb, is_default boolean, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    -- practice check: a practice's own template (the shared ones without a practice stay readable)
    PERFORM public.rls_assert_my_practice(t.practice_id)
       FROM email_templates t
      WHERE t.id = p_template_id AND t.practice_id IS NOT NULL;

    RETURN QUERY
    SELECT 
        et.id,
        et.practice_id,
        et.name,
        et.template_type,
        et.subject,
        et.content,
        et.header_html,
        et.footer_html,
        et.variables,
        et.custom_styles,
        et.font_config,
        et.is_default,
        et.is_active,
        et.created_at,
        et.updated_at
    FROM email_templates et
    WHERE et.id = p_template_id
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_email_templates_for_practice(p_practice_id uuid)
 RETURNS TABLE(id uuid, practice_id uuid, name text, template_type text, subject text, content text, header_html text, footer_html text, variables jsonb, custom_styles text, font_config jsonb, is_default boolean, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    -- practice check: the caller's own practice (none asked: the shared templates only, as before)
    IF p_practice_id IS NOT NULL THEN
        PERFORM public.rls_assert_my_practice(p_practice_id);
    END IF;

    RETURN QUERY
    SELECT 
        et.id,
        et.practice_id,
        et.name,
        et.template_type,
        et.subject,
        et.content,
        et.header_html,
        et.footer_html,
        et.variables,
        et.custom_styles,
        et.font_config,
        et.is_default,
        et.is_active,
        et.created_at,
        et.updated_at
    FROM email_templates et
    WHERE (et.practice_id = p_practice_id OR et.practice_id IS NULL)
        AND et.is_active = true
    ORDER BY et.is_default DESC, et.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sms_template_by_id(p_template_id uuid)
 RETURNS TABLE(id uuid, practice_id uuid, name text, template_type text, content text, variables jsonb, is_default boolean, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    -- practice check: a practice's own template (the shared ones without a practice stay readable)
    PERFORM public.rls_assert_my_practice(t.practice_id)
       FROM sms_templates t
      WHERE t.id = p_template_id AND t.practice_id IS NOT NULL;

    RETURN QUERY
    SELECT 
        st.id,
        st.practice_id,
        st.name,
        st.template_type,
        st.content,
        st.variables,
        st.is_default,
        st.is_active,
        st.created_at,
        st.updated_at
    FROM sms_templates st
    WHERE st.id = p_template_id
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sms_templates_for_practice(p_practice_id uuid)
 RETURNS TABLE(id uuid, practice_id uuid, name text, template_type text, content text, variables jsonb, is_default boolean, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    -- practice check: the caller's own practice (none asked: the shared templates only, as before)
    IF p_practice_id IS NOT NULL THEN
        PERFORM public.rls_assert_my_practice(p_practice_id);
    END IF;

    RETURN QUERY
    SELECT 
        st.id,
        st.practice_id,
        st.name,
        st.template_type,
        st.content,
        st.variables,
        st.is_default,
        st.is_active,
        st.created_at,
        st.updated_at
    FROM sms_templates st
    WHERE (st.practice_id = p_practice_id OR st.practice_id IS NULL)
        AND st.is_active = true
    ORDER BY st.is_default DESC, st.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_typing_indicator(p_channel_id uuid, p_thread_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    -- practice check: the channel belongs to the caller's practice
    PERFORM public.rls_assert_my_practice((SELECT c.practice_id FROM internal_message_channels c WHERE c.id = p_channel_id));

    INSERT INTO typing_indicators (channel_id, user_id, thread_id, expires_at)
    VALUES (p_channel_id, auth.uid(), p_thread_id, NOW() + INTERVAL '10 seconds')
    ON CONFLICT (channel_id, user_id, thread_id)
    DO UPDATE SET 
        started_at = NOW(),
        expires_at = NOW() + INTERVAL '10 seconds';
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_typing_indicator(channel_uuid uuid, typing_status boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_practice_id UUID;
BEGIN
    -- Get practice_id from the channel
    SELECT practice_id INTO v_practice_id
    FROM internal_message_channels
    WHERE id = channel_uuid;

    -- practice check: the channel belongs to the caller's practice
    IF FOUND THEN
        PERFORM public.rls_assert_my_practice(v_practice_id);
    END IF;

    IF typing_status THEN
        INSERT INTO typing_indicators (channel_id, user_id, is_typing, expires_at, practice_id)
        VALUES (
            channel_uuid, 
            auth.uid(), 
            TRUE, 
            NOW() + INTERVAL '10 seconds',
            v_practice_id
        )
        ON CONFLICT (channel_id, user_id) 
        DO UPDATE SET 
            is_typing = TRUE,
            expires_at = NOW() + INTERVAL '10 seconds',
            updated_at = NOW();
    ELSE
        UPDATE typing_indicators
        SET is_typing = FALSE, updated_at = NOW()
        WHERE channel_id = channel_uuid AND user_id = auth.uid();
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(user_uuid uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    target_user UUID := COALESCE(user_uuid, auth.uid());
    unread_count INTEGER;
BEGIN
    -- practice check: someone else's count only for a colleague in the caller's practice
    IF target_user IS DISTINCT FROM auth.uid() THEN
        PERFORM public.rls_assert_my_practice((SELECT u.practice_id FROM users u WHERE u.id = target_user));
    END IF;

    SELECT COUNT(*)
    INTO unread_count
    FROM system_notifications
    WHERE user_id = target_user 
    AND status IN ('pending', 'delivered')
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN unread_count;
END;
$function$;

-- Used by the automation_executions and automation_templates policies with auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_practices(user_id uuid)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- practice check: the caller's own practice, or a colleague's
  IF get_user_practices.user_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.rls_assert_my_practice((SELECT u.practice_id FROM users u WHERE u.id = get_user_practices.user_id));
  END IF;

  RETURN QUERY
  SELECT DISTINCT u.practice_id
  FROM users u
  WHERE u.id = get_user_practices.user_id 
    AND u.practice_id IS NOT NULL;
END;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 8. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  -- No policy left on these tables that lets every signed-in login (or everyone) in
  SELECT string_agg(format('%s."%s"', p.tablename, p.policyname), ', ') INTO v_bad
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('medical_aid_details', 'patient_media', 'patient_imaging', 'patient_laboratory', 'imaging_requests',
                        'audit_logs', 'payslips', 'payslip_items', 'employee_salaries', 'employee_salary_components',
                        'employee_salary_configurations', 'payslip_adjustments', 'timesheets', 'timesheet_entries',
                        'leave_requests', 'leave_balances', 'leave_types', 'hr_audit_logs', 'practice_oauth_apps',
                        'practice_social_accounts')
    AND p.permissive = 'PERMISSIVE'
    AND (p.roles && ARRAY['authenticated', 'public', 'anon']::name[])
    AND (COALESCE(p.qual, '') IN ('true', '(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)')
         OR COALESCE(p.with_check, '') IN ('true', '(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: open policies remain: %', v_bad;
  END IF;

  -- Payroll, HR, OAuth and social accounts: only the policies this file keeps or creates
  SELECT string_agg(format('%s."%s"', p.tablename, p.policyname), ', ') INTO v_bad
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('payslips', 'payslip_items', 'employee_salaries', 'employee_salary_components',
                        'employee_salary_configurations', 'payslip_adjustments', 'timesheets', 'timesheet_entries',
                        'leave_requests', 'leave_balances', 'hr_audit_logs', 'practice_oauth_apps', 'practice_social_accounts')
    AND p.policyname NOT IN ('portal_staff_only',
      'payslips_own_read', 'payslips_practice_read', 'payslips_practice_admin',
      'payslip_items_own_read', 'payslip_items_practice_read', 'payslip_items_practice_admin',
      'employee_salaries_own_read', 'employee_salaries_practice_admin',
      'employee_salary_components_own_read', 'employee_salary_components_practice_admin',
      'employee_salary_configurations_own_read', 'employee_salary_configurations_practice_admin',
      'payslip_adjustments_practice_admin', 'Users can view own adjustments',
      'timesheets_own_read', 'timesheets_own_submit', 'timesheets_practice_admin', 'Users can manage own draft timesheets',
      'timesheet_entries_own_read', 'timesheet_entries_practice_admin', 'Users can manage entries for their draft timesheets',
      'leave_requests_own_read', 'leave_requests_own_cancel', 'leave_requests_practice_admin',
      'Users can create own leave requests', 'Users can update own pending requests',
      'leave_balances_practice_admin', 'Users can view own leave balances',
      'hr_audit_logs_practice_admin_read', 'hr_audit_logs_super_admin_read',
      'practice_oauth_apps_practice_admin', 'practice_social_accounts_practice_admin');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: role-only or unexpected policies remain: %', v_bad;
  END IF;

  -- Bucket "documents": every policy goes through rls_documents_access, none for the public key
  SELECT string_agg(format('"%s"', p.policyname), ', ') INTO v_bad
  FROM pg_policies p
  WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
    AND (COALESCE(p.qual, '') || COALESCE(p.with_check, '')) ILIKE '%''documents''%'
    AND ((COALESCE(p.qual, '') || COALESCE(p.with_check, '')) NOT LIKE '%rls_documents_access%'
         OR 'anon' = ANY (p.roles) OR 'public' = ANY (p.roles));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: documents policies without the practice rule: %', v_bad;
  END IF;
  IF (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
        AND p.policyname IN ('documents_staff_read', 'documents_staff_insert', 'documents_staff_update', 'documents_staff_delete')) <> 4 THEN
    RAISE EXCEPTION 'Check failed: the four documents policies are not all there';
  END IF;

  -- Functions: a practice check and a fixed search_path in each changed one
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('add_invoice_to_batch', 'prepare_batch_for_sending', 'get_practice_statistics', 'send_sms_direct',
                      'send_sms_via_gateway', 'get_latest_ai_insights', 'create_direct_message_channel',
                      'delete_channel_cascade', 'get_or_create_thread', 'get_channel_last_messages', 'ensure_visit',
                      'get_email_template_by_id', 'get_email_templates_for_practice', 'get_sms_template_by_id',
                      'get_sms_templates_for_practice', 'send_typing_indicator', 'get_unread_notification_count',
                      'get_user_practices')
    AND (p.prosrc NOT LIKE '%rls_assert_my_practice%'
         OR NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) s WHERE s LIKE 'search_path=%'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: no practice check or search_path in %', v_bad;
  END IF;
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc LIKE '%rls_assert_my_practice%'
        AND p.proname <> 'rls_assert_my_practice') <> 19 THEN
    RAISE EXCEPTION 'Check failed: expected 19 functions with a practice check';
  END IF;

  -- The helpers: never the public key; the assertion only through the functions above
  IF has_function_privilege('anon', 'public.rls_my_role_for_staff(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.rls_my_role_for_audit_entry(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.rls_documents_access(text, boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rls_assert_my_practice(uuid, boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.rls_documents_access(text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: helper privileges';
  END IF;

  RAISE NOTICE 'Practice isolation 2 in place: 5 patient tables, audit_logs, 12 payroll/HR tables, 2 secret tables, bucket documents, 19 functions';
END
$$;

NOTIFY pgrst, 'reload schema';

ROLLBACK;

-- =============================================================================================
-- Undo (after a COMMIT), in one transaction:
--   1. Drop what this file created:
--      <table>_staff and <table>_super_admin_read on medical_aid_details, patient_media, patient_imaging,
--        patient_laboratory, imaging_requests;
--      audit_logs_practice_admin_read, audit_logs_super_admin_read;
--      payslips_own_read, payslips_practice_read, payslips_practice_admin; payslip_items_own_read,
--        payslip_items_practice_read, payslip_items_practice_admin; <table>_own_read and
--        <table>_practice_admin on employee_salaries, employee_salary_components,
--        employee_salary_configurations, timesheets, timesheet_entries, leave_requests;
--        payslip_adjustments_practice_admin; timesheets_own_submit; leave_requests_own_cancel;
--        leave_balances_practice_admin; hr_audit_logs_practice_admin_read, hr_audit_logs_super_admin_read;
--        leave_types_practice_admin;
--      practice_oauth_apps_practice_admin, practice_social_accounts_practice_admin;
--      documents_staff_read, documents_staff_insert, documents_staff_update, documents_staff_delete ON storage.objects.
--   2. Recreate the dropped policies, as they were:
--   CREATE POLICY "Users can view audit logs" ON public.audit_logs FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY imaging_requests_delete_policy ON public.imaging_requests FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY imaging_requests_insert_policy ON public.imaging_requests FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY imaging_requests_select_policy ON public.imaging_requests FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY imaging_requests_update_policy ON public.imaging_requests FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY medical_aid_delete_policy ON public.medical_aid_details FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY medical_aid_insert_policy ON public.medical_aid_details FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY medical_aid_select_policy ON public.medical_aid_details FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY medical_aid_update_policy ON public.medical_aid_details FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY imaging_delete_policy ON public.patient_imaging FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY imaging_insert_policy ON public.patient_imaging FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY imaging_select_policy ON public.patient_imaging FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY imaging_update_policy ON public.patient_imaging FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_imaging_delete_policy ON public.patient_imaging FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_imaging_insert_policy ON public.patient_imaging FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_imaging_select_policy ON public.patient_imaging FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_imaging_update_policy ON public.patient_imaging FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY laboratory_delete_policy ON public.patient_laboratory FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY laboratory_insert_policy ON public.patient_laboratory FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY laboratory_select_policy ON public.patient_laboratory FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY laboratory_update_policy ON public.patient_laboratory FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_laboratory_delete_policy ON public.patient_laboratory FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_laboratory_insert_policy ON public.patient_laboratory FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_laboratory_select_policy ON public.patient_laboratory FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_laboratory_update_policy ON public.patient_laboratory FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY media_delete_policy ON public.patient_media FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY media_insert_policy ON public.patient_media FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY media_select_policy ON public.patient_media FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY media_update_policy ON public.patient_media FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_media_delete_policy ON public.patient_media FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_media_insert_policy ON public.patient_media FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_media_select_policy ON public.patient_media FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY patient_media_update_policy ON public.patient_media FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY "Admins and doctors can manage salaries" ON public.employee_salaries FOR ALL TO public USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))) WITH CHECK ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))));
--   CREATE POLICY "Users can view own salary" ON public.employee_salaries FOR SELECT TO public USING (((user_id = auth.uid()) OR (auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
--   CREATE POLICY "Only admins can manage employee salary components" ON public.employee_salary_components FOR ALL TO public USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = 'admin'::text))));
--   CREATE POLICY "Users can view own salary components" ON public.employee_salary_components FOR SELECT TO public USING (((user_id = auth.uid()) OR (auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
--   CREATE POLICY "Admins and doctors can manage salary configs" ON public.employee_salary_configurations FOR ALL TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND ((users.role = ANY (ARRAY['admin'::text, 'doctor'::text])) OR (users.is_super_admin = true)))))) WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND ((users.role = ANY (ARRAY['admin'::text, 'doctor'::text])) OR (users.is_super_admin = true))))));
--   CREATE POLICY "Users can view their own salary configs" ON public.employee_salary_configurations FOR SELECT TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND ((users.role = 'admin'::text) OR (users.is_super_admin = true)))))));
--   CREATE POLICY "Only admins can view audit logs" ON public.hr_audit_logs FOR SELECT TO public USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = 'admin'::text))));
--   CREATE POLICY "HR/Admin can insert leave balances" ON public.leave_balances FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND ((users.role = 'admin'::text) OR (users.role = 'hr'::text) OR (users.role = 'doctor'::text))))));
--   CREATE POLICY "HR/Admin can update leave balances" ON public.leave_balances FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.practice_id = ( SELECT users_1.practice_id FROM users users_1 WHERE (users_1.id = leave_balances.user_id))) AND ((users.role = 'admin'::text) OR (users.role = 'hr'::text) OR (users.role = 'doctor'::text))))));
--   CREATE POLICY "HR/Admin can view all leave balances" ON public.leave_balances FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.practice_id = ( SELECT users_1.practice_id FROM users users_1 WHERE (users_1.id = leave_balances.user_id))) AND ((users.role = 'admin'::text) OR (users.role = 'hr'::text) OR (users.role = 'doctor'::text))))));
--   CREATE POLICY "Managers can approve/reject leave" ON public.leave_requests FOR UPDATE TO public USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))));
--   CREATE POLICY "Users can view own leave requests" ON public.leave_requests FOR SELECT TO public USING (((user_id = auth.uid()) OR (auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
--   CREATE POLICY "Admins and doctors can manage leave types" ON public.leave_types FOR ALL TO public USING (((practice_id IS NULL) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND ((users.practice_id = leave_types.practice_id) OR (users.practice_id IS NULL)) AND ((users.role = 'admin'::text) OR (users.role = 'doctor'::text) OR (users.is_super_admin = true)))))));
--   CREATE POLICY "Admins and doctors can manage adjustments" ON public.payslip_adjustments FOR ALL TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND ((users.role = ANY (ARRAY['admin'::text, 'doctor'::text])) OR (users.is_super_admin = true))))));
--   CREATE POLICY "Admins can manage payslip items" ON public.payslip_items FOR ALL TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND ((users.role = 'admin'::text) OR (users.is_super_admin = true))))));
--   CREATE POLICY "Users can view their own payslip items" ON public.payslip_items FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM payslips p WHERE ((p.id = payslip_items.payslip_id) AND ((p.user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND ((users.role = 'admin'::text) OR (users.is_super_admin = true))))))))));
--   CREATE POLICY "Admins and doctors can manage payslips" ON public.payslips FOR ALL TO public USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))) WITH CHECK ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))));
--   CREATE POLICY "Users can view own payslips" ON public.payslips FOR SELECT TO public USING (((user_id = auth.uid()) OR (auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
--   CREATE POLICY "Admins and doctors can manage all timesheet entries" ON public.timesheet_entries FOR ALL TO authenticated USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))) WITH CHECK ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))));
--   CREATE POLICY "Users can view entries for their timesheets" ON public.timesheet_entries FOR SELECT TO public USING (((timesheet_id IN ( SELECT timesheets.id FROM timesheets WHERE (timesheets.user_id = auth.uid()))) OR (auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
--   CREATE POLICY "Admins and doctors can create timesheets for any user" ON public.timesheets FOR INSERT TO public WITH CHECK ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))));
--   CREATE POLICY "Admins and doctors can delete any timesheet" ON public.timesheets FOR DELETE TO authenticated USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))));
--   CREATE POLICY "Admins and doctors can update any timesheet" ON public.timesheets FOR UPDATE TO authenticated USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))) WITH CHECK ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))));
--   CREATE POLICY "Managers can approve timesheets" ON public.timesheets FOR UPDATE TO public USING ((auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text])))));
--   CREATE POLICY "Users can view own timesheets" ON public.timesheets FOR SELECT TO public USING (((user_id = auth.uid()) OR (auth.uid() IN ( SELECT users.id FROM users WHERE (users.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))));
--   CREATE POLICY "Practice admins, owners and doctors can manage OAuth apps" ON public.practice_oauth_apps FOR ALL TO authenticated USING ((practice_id IN ( SELECT user_practice_assignments.practice_id FROM user_practice_assignments WHERE ((user_practice_assignments.user_id = auth.uid()) AND (user_practice_assignments.role = ANY (ARRAY['admin'::text, 'manager'::text, 'owner'::text, 'doctor'::text])))))) WITH CHECK ((practice_id IN ( SELECT user_practice_assignments.practice_id FROM user_practice_assignments WHERE ((user_practice_assignments.user_id = auth.uid()) AND (user_practice_assignments.role = ANY (ARRAY['admin'::text, 'manager'::text, 'owner'::text, 'doctor'::text]))))));
--   CREATE POLICY "Practice owners have full access" ON public.practice_oauth_apps FOR ALL TO public USING ((EXISTS ( SELECT 1 FROM practices WHERE ((practices.id = practice_oauth_apps.practice_id) AND (practices.admin_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM practices WHERE ((practices.id = practice_oauth_apps.practice_id) AND (practices.admin_user_id = auth.uid())))));
--   CREATE POLICY "Practice owners have full access to OAuth apps" ON public.practice_oauth_apps FOR ALL TO authenticated USING ((practice_id IN ( SELECT practices.id FROM practices WHERE (practices.admin_user_id = auth.uid())))) WITH CHECK ((practice_id IN ( SELECT practices.id FROM practices WHERE (practices.admin_user_id = auth.uid()))));
--   CREATE POLICY "Practice users can view OAuth apps" ON public.practice_oauth_apps FOR SELECT TO authenticated USING ((practice_id IN ( SELECT user_practice_assignments.practice_id FROM user_practice_assignments WHERE (user_practice_assignments.user_id = auth.uid()))));
--   CREATE POLICY "System admins and doctors have full access to OAuth apps" ON public.practice_oauth_apps FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'manager'::text, 'doctor'::text])))))) WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'manager'::text, 'doctor'::text]))))));
--   CREATE POLICY "System admins have full access" ON public.practice_oauth_apps FOR ALL TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
--   CREATE POLICY "Practice admins can manage social accounts" ON public.practice_social_accounts FOR ALL TO authenticated USING ((practice_id IN ( SELECT user_practice_assignments.practice_id FROM user_practice_assignments WHERE ((user_practice_assignments.user_id = auth.uid()) AND (user_practice_assignments.role = ANY (ARRAY['admin'::text, 'manager'::text, 'owner'::text, 'doctor'::text])))))) WITH CHECK ((practice_id IN ( SELECT user_practice_assignments.practice_id FROM user_practice_assignments WHERE ((user_practice_assignments.user_id = auth.uid()) AND (user_practice_assignments.role = ANY (ARRAY['admin'::text, 'manager'::text, 'owner'::text, 'doctor'::text]))))));
--   CREATE POLICY "Practice owners can manage social accounts" ON public.practice_social_accounts FOR ALL TO authenticated USING ((practice_id IN ( SELECT practices.id FROM practices WHERE (practices.admin_user_id = auth.uid())))) WITH CHECK ((practice_id IN ( SELECT practices.id FROM practices WHERE (practices.admin_user_id = auth.uid()))));
--   CREATE POLICY "System admins and doctors can manage social accounts" ON public.practice_social_accounts FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'manager'::text, 'doctor'::text])))))) WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'manager'::text, 'doctor'::text]))))));
--   CREATE POLICY "Users can view their practice social accounts" ON public.practice_social_accounts FOR SELECT TO authenticated USING ((practice_id IN ( SELECT user_practice_assignments.practice_id FROM user_practice_assignments WHERE (user_practice_assignments.user_id = auth.uid()))));
--   CREATE POLICY "  Allow authenticated document uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'documents'::text));
--   CREATE POLICY "Allow authenticated document reads flreew_0" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'documents'::text));
--   CREATE POLICY "Allow authenticated document reads flreew_1" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'documents'::text));
--   CREATE POLICY "Allow authenticated document reads flreew_2" ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'documents'::text));
--   CREATE POLICY "Allow authenticated document reads flreew_3" ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'documents'::text));
--   3. Functions: in each function of section 7 delete the lines under "-- practice check" (the PERFORM or
--      IF ... END IF that follows it) and the SET search_path line (ensure_visit and
--      delete_channel_cascade had SET search_path TO 'public' before: keep theirs), then run the
--      CREATE OR REPLACE again; afterwards DROP FUNCTION public.rls_assert_my_practice(uuid, boolean),
--      public.rls_documents_access(text, boolean), public.rls_my_role_for_audit_entry(jsonb),
--      public.rls_my_role_for_staff(uuid) (after the policies that use them).
-- =============================================================================================

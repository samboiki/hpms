-- Applied 2026-10-07 as migration practice_isolation_2026_10_07
-- =============================================================================================
-- Practice isolation: the OneHealth tables that still let any signed-in login read and change every
-- practice's rows, super admins back on the visit and patient views, two views off owner rights,
-- and settings for today's functions
-- File:    proposals/2026-10-07-practice-isolation.sql                    Drafted: 2026-10-07
--
-- Why
--   28 OneHealth tables still had policies with USING (true) / WITH CHECK (true) (or "any signed-in
--   user") from earlier migrations, so staff of one practice could read and change another practice's
--   invoices, invoice lines, lab requests and results, patient documents, inventory, messages and
--   settings, and read every practice's settings and staff list. Two more holes made isolation moot:
--     - users: anyone could change their own users row, including is_super_admin, role and practice_id,
--       and admins/doctors of any practice could change or delete any user of any practice;
--     - medications: doctors and admins of any practice could read every practice's medications, and
--       any admin could delete them.
--   The views switched to security_invoker earlier today left super admins with 0 rows (the visits and
--   patients policies leave them out), so admin > practice details > "recent appointments" was empty.
--   medications_with_details still ran with its owner's rights and read auth.users (advisor ERROR);
--   sms_analytics too (its base table sms_usage_logs had a policy that read auth.users).
--
-- How it was applied
--   Run once, before applying, inside one rolled-back transaction: this file's statements followed
--   by count and write tests as an active staff member of each practice, a super admin, a random
--   signed-in outsider, the anon key and the service role (counts only, no values). Then applied as
--   migration practice_isolation_2026_10_07: this file without its BEGIN / ROLLBACK lines.
--   Order for a rehearsal: after proposals/2026-10-07-rls-onehealth.sql, before
--   proposals/2026-10-07-patient-portal.sql (its staff-only guard stays on every table here).
--
-- The rules
--   Membership, as in proposals/2026-10-07-rls-onehealth.sql (users.practice_id of an active staff
--   member; user_practice_assignments is not used for access, as in that file and the app):
--     EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true)
--             AND u.practice_id = <the row's practice>)
--   <the row's practice> is the row's practice_id, or comes from the parent row:
--     invoices_enhanced, lab_requests  practice_id, else the patient's practice (8 invoices and 15 lab
--                                      requests have none; two lab request screens insert without it)
--     invoice_services                 the invoice's practice (as above)
--     lab_results                      the lab request's practice (as above)
--     patient_documents                the patient's practice
--     medications                      the visit's practice, else the patient's practice
--   Practice tables staff work in: <table>_staff (FOR ALL, staff of the row's practice) and
--   <table>_super_admin_read (FOR SELECT). Super admins read everything (admin portal, onehealth
--   dashboard) and write only where the admin tools write today: practices, users, the global
--   reference tables and practice_service_subscriptions (onehealth dashboard > practices > manage).
--   That differs from the earlier file, where super admins could also write the practice tables.
--   Subscriptions, features and logs: staff read their own practice's rows only (<table>_staff_read);
--   the gateways and the admin dashboard change them with the service role.
--   Global reference tables (automation_definitions, medical_aid_providers, medical_aid_schemes,
--   medical_aid_service_prices_retired, practice_types, sms_plans, practice_tariffs): signed-in users
--   read; super admins change them (practice_tariffs: its existing super-admin insert policy).
--   medical_aid_providers stays readable with the anon key (the public sites' fund list).
--   users: everyone reads and edits their own row but cannot change their own role, practice,
--   super-admin flag, can_manage_practices, is_active or permissions; staff read their practice's
--   staff; admins and doctors of a practice manage its users (as the old policies, now limited to
--   their own practice, never super admins); super admins manage all. The users policies use small
--   SECURITY DEFINER helpers (rls_*) because a users policy that reads users would recurse.
--   practices: staff read their own practice (and a practice whose admin_user_id they are); super
--   admins read and change all. "Allow users to update their own practice" (any staff of the
--   practice) is kept: see "For the owner".
--   The anon read-only policies the public sites use stay: "Allow anon to select practices" and
--   allow_anon_read_practice_users.
--
-- Dropped and not replaced
--   Anon write policies on practices, practice_inventory, practice_email_subscriptions and
--   practice_sms_subscriptions (USING true): the anon key has had no write grant on them since the
--   earlier change today, so they did nothing, but would reopen the tables with any future grant.
--
-- For the owner (not changed here)
--   - Any staff member may update their own practice (theme, settings, bank details, sms_limit,
--     approval_status): restricting it to admins would quietly stop non-admin saves (the screens
--     are not role-gated). Decide, then gate the screens and narrow the policy.
--   - The anon key can read every column of practices (including admin_password and
--     gmail_refresh_token) and of active staff users rows (bank details): phase 2 of
--     proposals/2026-10-07-close-anonymous-access.sql (listing views) is still open.
--   - messages had no practice column; this file adds practice_id (the table is empty; the app
--     already sends practice_id when it writes there).
--
-- Test results (counts only, in the rehearsal and again after applying, rolled back; staff of practice
-- b646 / staff of practice ffed / super admin / signed-in outsider / anon key / service role = all rows;
-- "-" = no grant; in brackets: what every signed-in login saw before)
--   invoices_enhanced 3098/14/3112/0/-/3112 (3112), invoice_services 14398/56/14454/0/-/14454 (14454),
--   lab_requests 134/5/139/0/-/139 (139), lab_results 219/0/219/0/-/219 (219), patient_documents
--   3/0/3/0/-/3 (3), medications 1843/14/1857/0/-/1857 (1857), practice_inventory 38/2/40/0/-/40 (40),
--   automation_queue 844/25/870/0/-/870 (870), message_templates 0/0/6/0/-/6 (6; all belong to other
--   practices), practice_email_subscriptions 1/1/7/0/-/7 (7), practice_sms_subscriptions 1/1/6/0/-/6 (6),
--   practice_features 0/0/3/0/-/3 (3; other practices), sms_logs 0/0/6/0/-/6 (6; other practices or
--   none), users 7/5/18/0/13/18 (18), practices 1/1/874/0/874/874 (874), user_practice_assignments
--   8/5/45/0/-/45 (45), user_profiles 1/0/16/0/-/16 (16), system_notifications 0/0/170/0/-/170 (own only,
--   as before). Super admins: patients 0 -> 501, visits and appointments 0 -> 4015.
--   Global tables, every signed-in user: automation_definitions 25, medical_aid_schemes 9,
--   medical_aid_service_prices_retired 18, practice_types 18, practice_tariffs 179, sms_plans 4,
--   medical_aid_providers 5 (anon 5, kept). Empty: messages, oauth_callback_tokens,
--   practice_service_subscriptions, sms_usage_logs (before: an error for every signed-in user).
--   Views: medications_with_details 1843/14/1857/0/-/1857 and sms_analytics 1/1/875/0/-/875 (before
--   1857 and 875 for any signed-in login, the outsider included).
--   Writes: own practice allowed (invoice update and insert, invoice line, patient, lab result and
--   inventory updates, message, lab request without practice_id, document, medicine inserts); the other
--   practice refused (inserts 42501, updates and deletes 0 rows) on invoices_enhanced, invoice_services,
--   patients, lab_results, messages, lab_requests, patient_documents, practice_inventory, medications;
--   super admins change none of these. users: own row editable, own super-admin flag, practice and role
--   refused; admins edit their own practice's staff only and cannot make super admins or move staff to
--   another practice; super admins edit all. practices: own 1 (kept policy), other 0, super admin 1.
--   Triggers: an internal message in the practice's channel writes its 4 notifications.
--   Admin > practice details > "recent appointments" (super admin): 5 rows, all with patient and doctor.
--   The visit screen's medicines (EditVisitTabs columns) on a b646 visit: 3 rows for b646 staff with
--   patient and visit columns, 0 for ffed staff, 3 for a super admin.
--   Security advisor: auth_users_exposed 1 -> 0, security_definer_view 8 -> 6 (the rest belong to other
--   apps or the tables left alone), function_search_path_mutable 219 -> 190, anon_security_definer_
--   function_executable 84 -> 65; authenticated_security_definer_function_executable 146 -> 150 (the
--   four rls_* helpers, on purpose: they return only the caller's own row).
--   Seen while testing, not changed: notify_visit_changes (visits trigger) reads patients.full_name,
--   which does not exist, so marking a visit ready or cancelled fails (also with the service role).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Helpers for the users policies (they read the caller's own users row without the users
--    policies, so a users policy can use them without recursing; nothing about other users leaks)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_my_practice_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.practice_id FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true)
$$;

CREATE OR REPLACE FUNCTION public.rls_is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.is_super_admin = true)
$$;

-- Admins and doctors manage their practice's staff (the roles the old users policies allowed)
CREATE OR REPLACE FUNCTION public.rls_is_practice_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role IN ('admin', 'doctor'))
$$;

-- The caller's access fields as stored, so a user editing their own row cannot change them
CREATE OR REPLACE FUNCTION public.rls_my_access_fields()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object('role', u.role, 'practice_id', u.practice_id, 'is_super_admin', u.is_super_admin,
                            'can_manage_practices', u.can_manage_practices, 'is_active', u.is_active, 'permissions', u.permissions)
  FROM public.users u WHERE u.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.rls_my_practice_id(), public.rls_is_super_admin(), public.rls_is_practice_admin(),
  public.rls_my_access_fields() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rls_my_practice_id(), public.rls_is_super_admin(), public.rls_is_practice_admin(),
  public.rls_my_access_fields() TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. users
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS users_select_policy ON public.users;
DROP POLICY IF EXISTS users_update_policy ON public.users;
DROP POLICY IF EXISTS users_insert_policy ON public.users;
DROP POLICY IF EXISTS users_delete_policy ON public.users;

DROP POLICY IF EXISTS users_read ON public.users;
CREATE POLICY users_read ON public.users FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid())
    AND jsonb_build_object('role', role, 'practice_id', practice_id, 'is_super_admin', is_super_admin,
                           'can_manage_practices', can_manage_practices, 'is_active', is_active, 'permissions', permissions)
        = (SELECT public.rls_my_access_fields()));

DROP POLICY IF EXISTS users_practice_admin ON public.users;
CREATE POLICY users_practice_admin ON public.users FOR ALL TO authenticated
  USING ((SELECT public.rls_is_practice_admin()) AND practice_id = (SELECT public.rls_my_practice_id()) AND NOT COALESCE(is_super_admin, false))
  WITH CHECK ((SELECT public.rls_is_practice_admin()) AND practice_id = (SELECT public.rls_my_practice_id()) AND NOT COALESCE(is_super_admin, false));

DROP POLICY IF EXISTS users_super_admin ON public.users;
CREATE POLICY users_super_admin ON public.users FOR ALL TO authenticated
  USING ((SELECT public.rls_is_super_admin())) WITH CHECK ((SELECT public.rls_is_super_admin()));

-- ---------------------------------------------------------------------------------------------
-- 3. practices (anon read and "Allow users to update their own practice" kept)
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access to practices" ON public.practices;
DROP POLICY IF EXISTS "Allow anon to insert practices" ON public.practices;
DROP POLICY IF EXISTS "Allow anon to update practices" ON public.practices;
DROP POLICY IF EXISTS "Allow anon to delete practices" ON public.practices;

DROP POLICY IF EXISTS practices_staff_read ON public.practices;
CREATE POLICY practices_staff_read ON public.practices FOR SELECT TO authenticated
  USING (admin_user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = practices.id));
DROP POLICY IF EXISTS practices_super_admin ON public.practices;
CREATE POLICY practices_super_admin ON public.practices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- ---------------------------------------------------------------------------------------------
-- 4. Practice tables staff work in: staff of the row's practice read and write, super admins read
-- ---------------------------------------------------------------------------------------------
-- invoices_enhanced
DROP POLICY IF EXISTS invoices_all_access ON public.invoices_enhanced;
DROP POLICY IF EXISTS invoices_enhanced_staff ON public.invoices_enhanced;
CREATE POLICY invoices_enhanced_staff ON public.invoices_enhanced FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = COALESCE(invoices_enhanced.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = invoices_enhanced.patient_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = COALESCE(invoices_enhanced.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = invoices_enhanced.patient_id))));
DROP POLICY IF EXISTS invoices_enhanced_super_admin_read ON public.invoices_enhanced;
CREATE POLICY invoices_enhanced_super_admin_read ON public.invoices_enhanced FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- invoice_services (the invoice's practice)
DROP POLICY IF EXISTS invoice_services_all_access ON public.invoice_services;
DROP POLICY IF EXISTS invoice_services_staff ON public.invoice_services;
CREATE POLICY invoice_services_staff ON public.invoice_services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT COALESCE(i.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = i.patient_id))
                         FROM public.invoices_enhanced i WHERE i.id = invoice_services.invoice_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT COALESCE(i.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = i.patient_id))
                         FROM public.invoices_enhanced i WHERE i.id = invoice_services.invoice_id)));
DROP POLICY IF EXISTS invoice_services_super_admin_read ON public.invoice_services;
CREATE POLICY invoice_services_super_admin_read ON public.invoice_services FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- lab_requests
DROP POLICY IF EXISTS "Authenticated users can view lab requests" ON public.lab_requests;
DROP POLICY IF EXISTS "Authenticated users can create lab requests" ON public.lab_requests;
DROP POLICY IF EXISTS "Authenticated users can update lab requests" ON public.lab_requests;
DROP POLICY IF EXISTS "Authenticated users can delete lab requests" ON public.lab_requests;
DROP POLICY IF EXISTS lab_requests_staff ON public.lab_requests;
CREATE POLICY lab_requests_staff ON public.lab_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = COALESCE(lab_requests.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = lab_requests.patient_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = COALESCE(lab_requests.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = lab_requests.patient_id))));
DROP POLICY IF EXISTS lab_requests_super_admin_read ON public.lab_requests;
CREATE POLICY lab_requests_super_admin_read ON public.lab_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- lab_results (the lab request's practice)
DROP POLICY IF EXISTS "Authenticated users can view lab results" ON public.lab_results;
DROP POLICY IF EXISTS "Authenticated users can create lab results" ON public.lab_results;
DROP POLICY IF EXISTS "Authenticated users can update lab results" ON public.lab_results;
DROP POLICY IF EXISTS "Authenticated users can delete lab results" ON public.lab_results;
DROP POLICY IF EXISTS lab_results_staff ON public.lab_results;
CREATE POLICY lab_results_staff ON public.lab_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT COALESCE(r.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = r.patient_id))
                         FROM public.lab_requests r WHERE r.id = lab_results.lab_request_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT COALESCE(r.practice_id, (SELECT p.practice_id FROM public.patients p WHERE p.id = r.patient_id))
                         FROM public.lab_requests r WHERE r.id = lab_results.lab_request_id)));
DROP POLICY IF EXISTS lab_results_super_admin_read ON public.lab_results;
CREATE POLICY lab_results_super_admin_read ON public.lab_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- patient_documents (the patient's practice)
DROP POLICY IF EXISTS "Users can view patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Users can insert patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Users can update patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Users can delete patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS patient_documents_staff ON public.patient_documents;
CREATE POLICY patient_documents_staff ON public.patient_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = patient_documents.patient_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = (SELECT p.practice_id FROM public.patients p WHERE p.id = patient_documents.patient_id)));
DROP POLICY IF EXISTS patient_documents_super_admin_read ON public.patient_documents;
CREATE POLICY patient_documents_super_admin_read ON public.patient_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- medications (found while switching medications_with_details: doctors and admins of any practice read
-- them all, any admin deleted them; the other four relied on the visits/patients policies, which now
-- let super admins read, and would have let them write too)
DROP POLICY IF EXISTS "Users can view medications for accessible patients" ON public.medications;
DROP POLICY IF EXISTS "Users can view medications for their practice patients" ON public.medications;
DROP POLICY IF EXISTS "Users can insert medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert medications for accessible patients" ON public.medications;
DROP POLICY IF EXISTS "Users can update medications" ON public.medications;
DROP POLICY IF EXISTS "Users can update medications for accessible patients" ON public.medications;
DROP POLICY IF EXISTS "Users can delete medications" ON public.medications;
DROP POLICY IF EXISTS "Users can delete medications for accessible patients" ON public.medications;
DROP POLICY IF EXISTS medications_staff ON public.medications;
CREATE POLICY medications_staff ON public.medications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = COALESCE((SELECT v.practice_id FROM public.visits v WHERE v.id = medications.visit_id),
                                 (SELECT p.practice_id FROM public.patients p WHERE p.id = medications.patient_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = COALESCE((SELECT v.practice_id FROM public.visits v WHERE v.id = medications.visit_id),
                                 (SELECT p.practice_id FROM public.patients p WHERE p.id = medications.patient_id))));
DROP POLICY IF EXISTS medications_super_admin_read ON public.medications;
CREATE POLICY medications_super_admin_read ON public.medications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- practice_inventory
DROP POLICY IF EXISTS "Authenticated users can manage inventory" ON public.practice_inventory;
DROP POLICY IF EXISTS "Anon users can read inventory" ON public.practice_inventory;
DROP POLICY IF EXISTS "Anon users can insert inventory" ON public.practice_inventory;
DROP POLICY IF EXISTS "Anon users can update inventory" ON public.practice_inventory;
DROP POLICY IF EXISTS "Anon users can delete inventory" ON public.practice_inventory;
DROP POLICY IF EXISTS practice_inventory_staff ON public.practice_inventory;
CREATE POLICY practice_inventory_staff ON public.practice_inventory FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = practice_inventory.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = practice_inventory.practice_id));
DROP POLICY IF EXISTS practice_inventory_super_admin_read ON public.practice_inventory;
CREATE POLICY practice_inventory_super_admin_read ON public.practice_inventory FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- automation_queue (the database's own queue functions run as the signed-in user from patient and
-- visit triggers; they now work through that practice's items only)
DROP POLICY IF EXISTS "Service role can manage queue" ON public.automation_queue;
DROP POLICY IF EXISTS automation_queue_staff ON public.automation_queue;
CREATE POLICY automation_queue_staff ON public.automation_queue FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = automation_queue.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = automation_queue.practice_id));
DROP POLICY IF EXISTS automation_queue_super_admin_read ON public.automation_queue;
CREATE POLICY automation_queue_super_admin_read ON public.automation_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- messages: no practice column until now (the table is empty; appointmentService already sends practice_id)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS practice_id uuid REFERENCES public.practices(id);
CREATE INDEX IF NOT EXISTS idx_messages_practice_id ON public.messages (practice_id);
COMMENT ON COLUMN public.messages.practice_id IS 'The practice that sent the message; row level security: its staff only.';
DROP POLICY IF EXISTS "Allow all operations for authenticated users on messages" ON public.messages;
DROP POLICY IF EXISTS messages_staff ON public.messages;
CREATE POLICY messages_staff ON public.messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = messages.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = messages.practice_id));
DROP POLICY IF EXISTS messages_super_admin_read ON public.messages;
CREATE POLICY messages_super_admin_read ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- message_templates: "Users can view their practice templates" and "Admin users can manage templates"
-- (practice-scoped) stay
DROP POLICY IF EXISTS "Allow all operations for authenticated users on templates" ON public.message_templates;
DROP POLICY IF EXISTS message_templates_super_admin_read ON public.message_templates;
CREATE POLICY message_templates_super_admin_read ON public.message_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- patients: the four "... from their practice only" policies stay; the open insert goes
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.patients;
DROP POLICY IF EXISTS patients_super_admin_read ON public.patients;
CREATE POLICY patients_super_admin_read ON public.patients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- visits: the staff policies stay; super admins read again (appointments, encounters_view, admin portal)
DROP POLICY IF EXISTS visits_super_admin_read ON public.visits;
CREATE POLICY visits_super_admin_read ON public.visits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- ---------------------------------------------------------------------------------------------
-- 5. Subscriptions, features and logs: staff read their practice's rows, super admins read all;
--    changes go through the gateways and the admin dashboard (service role), except
--    practice_service_subscriptions, which the onehealth dashboard changes as a super admin
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations on practice_email_subscriptions" ON public.practice_email_subscriptions;
DROP POLICY IF EXISTS "Allow anon full access to email subscriptions" ON public.practice_email_subscriptions;
DROP POLICY IF EXISTS practice_email_subscriptions_staff_read ON public.practice_email_subscriptions;
CREATE POLICY practice_email_subscriptions_staff_read ON public.practice_email_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = practice_email_subscriptions.practice_id)));

-- "Users can view their SMS subscriptions" (practice-scoped) stays
DROP POLICY IF EXISTS "Allow all operations on practice_sms_subscriptions" ON public.practice_sms_subscriptions;
DROP POLICY IF EXISTS "Allow anon full access to sms subscriptions" ON public.practice_sms_subscriptions;
DROP POLICY IF EXISTS "SMS subscriptions are manageable by authenticated users" ON public.practice_sms_subscriptions;
DROP POLICY IF EXISTS "SMS subscriptions are viewable by authenticated users" ON public.practice_sms_subscriptions;
DROP POLICY IF EXISTS practice_sms_subscriptions_super_admin_read ON public.practice_sms_subscriptions;
CREATE POLICY practice_sms_subscriptions_super_admin_read ON public.practice_sms_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

DROP POLICY IF EXISTS "Allow all operations on practice_service_subscriptions" ON public.practice_service_subscriptions;
DROP POLICY IF EXISTS practice_service_subscriptions_staff_read ON public.practice_service_subscriptions;
CREATE POLICY practice_service_subscriptions_staff_read ON public.practice_service_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = practice_service_subscriptions.practice_id));
DROP POLICY IF EXISTS practice_service_subscriptions_super_admin ON public.practice_service_subscriptions;
CREATE POLICY practice_service_subscriptions_super_admin ON public.practice_service_subscriptions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- practice_features: per-practice feature switches and limits (not a catalogue)
DROP POLICY IF EXISTS "Allow all operations on practice_features" ON public.practice_features;
DROP POLICY IF EXISTS practice_features_staff_read ON public.practice_features;
CREATE POLICY practice_features_staff_read ON public.practice_features FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = practice_features.practice_id)));

DROP POLICY IF EXISTS "Allow all operations on sms_logs" ON public.sms_logs;
DROP POLICY IF EXISTS "SMS logs are insertable by authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS "SMS logs are viewable by authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS sms_logs_staff_read ON public.sms_logs;
CREATE POLICY sms_logs_staff_read ON public.sms_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = sms_logs.practice_id)));

-- sms_usage_logs (behind sms_analytics): its policy read auth.users, which signed-in users may not read
DROP POLICY IF EXISTS "Users can view their SMS usage" ON public.sms_usage_logs;
DROP POLICY IF EXISTS sms_usage_logs_staff_read ON public.sms_usage_logs;
CREATE POLICY sms_usage_logs_staff_read ON public.sms_usage_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = sms_usage_logs.practice_id)));

-- ---------------------------------------------------------------------------------------------
-- 6. Global reference tables: signed-in users read, super admins change
-- ---------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view automation definitions" ON public.automation_definitions;
DROP POLICY IF EXISTS automation_definitions_read ON public.automation_definitions;
CREATE POLICY automation_definitions_read ON public.automation_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS automation_definitions_super_admin ON public.automation_definitions;
CREATE POLICY automation_definitions_super_admin ON public.automation_definitions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- medical_aid_providers: the anon key keeps reading (the public sites' fund list)
DROP POLICY IF EXISTS read_providers ON public.medical_aid_providers;
DROP POLICY IF EXISTS medical_aid_providers_read ON public.medical_aid_providers;
CREATE POLICY medical_aid_providers_read ON public.medical_aid_providers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS medical_aid_providers_super_admin ON public.medical_aid_providers;
CREATE POLICY medical_aid_providers_super_admin ON public.medical_aid_providers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

DROP POLICY IF EXISTS read_schemes ON public.medical_aid_schemes;
DROP POLICY IF EXISTS medical_aid_schemes_read ON public.medical_aid_schemes;
CREATE POLICY medical_aid_schemes_read ON public.medical_aid_schemes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS medical_aid_schemes_super_admin ON public.medical_aid_schemes;
CREATE POLICY medical_aid_schemes_super_admin ON public.medical_aid_schemes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

DROP POLICY IF EXISTS read_prices ON public.medical_aid_service_prices_retired;
DROP POLICY IF EXISTS medical_aid_service_prices_retired_read ON public.medical_aid_service_prices_retired;
CREATE POLICY medical_aid_service_prices_retired_read ON public.medical_aid_service_prices_retired FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS medical_aid_service_prices_retired_super_admin ON public.medical_aid_service_prices_retired;
CREATE POLICY medical_aid_service_prices_retired_super_admin ON public.medical_aid_service_prices_retired FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

DROP POLICY IF EXISTS practice_types_read_all ON public.practice_types;
DROP POLICY IF EXISTS practice_types_read ON public.practice_types;
CREATE POLICY practice_types_read ON public.practice_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS practice_types_super_admin ON public.practice_types;
CREATE POLICY practice_types_super_admin ON public.practice_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

DROP POLICY IF EXISTS "SMS plans are publicly viewable" ON public.sms_plans;
DROP POLICY IF EXISTS sms_plans_read ON public.sms_plans;
CREATE POLICY sms_plans_read ON public.sms_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sms_plans_super_admin ON public.sms_plans;
CREATE POLICY sms_plans_super_admin ON public.sms_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- practice_tariffs (per practice type): practice_tariffs_insert_platform_admin and
-- "Users can view tariffs for their practice type" stay
DROP POLICY IF EXISTS practice_tariffs_read_all ON public.practice_tariffs;
DROP POLICY IF EXISTS practice_tariffs_read ON public.practice_tariffs;
CREATE POLICY practice_tariffs_read ON public.practice_tariffs FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------------------------
-- 7. Per-person rows
-- ---------------------------------------------------------------------------------------------
-- user_profiles (onehealth dashboard: a login's own profile; id = the login)
DROP POLICY IF EXISTS "Allow all operations on user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_own ON public.user_profiles;
CREATE POLICY user_profiles_own ON public.user_profiles FOR ALL TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_profiles_super_admin_read ON public.user_profiles;
CREATE POLICY user_profiles_super_admin_read ON public.user_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- user_practice_assignments: a login's own rows (the email template, OAuth app and social account
-- policies look up the caller's own rows), the practice's rows for its staff; written by the service role
DROP POLICY IF EXISTS "Allow all operations on user_practice_assignments" ON public.user_practice_assignments;
DROP POLICY IF EXISTS user_practice_assignments_read ON public.user_practice_assignments;
CREATE POLICY user_practice_assignments_read ON public.user_practice_assignments FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
      AND (u.is_super_admin = true OR u.practice_id = user_practice_assignments.practice_id)));

-- system_notifications: "Users can view/update their own notifications" stay; new notifications only
-- for the writer's own practice (the message and visit triggers write them as the signed-in user)
DROP POLICY IF EXISTS "System can create notifications" ON public.system_notifications;
DROP POLICY IF EXISTS system_notifications_staff_insert ON public.system_notifications;
CREATE POLICY system_notifications_staff_insert ON public.system_notifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = system_notifications.practice_id));
DROP POLICY IF EXISTS system_notifications_super_admin_read ON public.system_notifications;
CREATE POLICY system_notifications_super_admin_read ON public.system_notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.is_super_admin = true));

-- oauth_callback_tokens: "Service role only" stays; the practice's staff read and mark its tokens used
-- (Settings > OAuth checks the token after Google sign-in)
DROP POLICY IF EXISTS oauth_callback_tokens_staff_read ON public.oauth_callback_tokens;
CREATE POLICY oauth_callback_tokens_staff_read ON public.oauth_callback_tokens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND (u.is_super_admin = true OR u.practice_id = oauth_callback_tokens.practice_id)));
DROP POLICY IF EXISTS oauth_callback_tokens_staff_update ON public.oauth_callback_tokens;
CREATE POLICY oauth_callback_tokens_staff_update ON public.oauth_callback_tokens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = oauth_callback_tokens.practice_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true) AND u.practice_id = oauth_callback_tokens.practice_id));

-- ---------------------------------------------------------------------------------------------
-- 8. Views: the caller's rights; medications_with_details reads public.users (same columns, the
--    prescriber's email kept as character varying(255)); sms_analytics is unchanged apart from that
--    (it never read auth.users itself: its base table's policy did, replaced in section 5)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.medications_with_details WITH (security_invoker = on) AS
 SELECT m.id,
    m.visit_id,
    m.patient_id,
    m.medication_name,
    m.dosage,
    m.frequency,
    m.duration,
    m.instructions,
    m.prescribed_by,
    m.prescribed_date,
    m.status,
    m.notes,
    m.created_at,
    m.updated_at,
    (p.first_name || ' '::text) || p.last_name AS patient_name,
    p.date_of_birth,
    p.cell_number,
    u.email::character varying(255) AS prescribed_by_email,
    v.visit_date,
    v.visit_time,
    v.visit_type,
    v.chief_complaint,
    row_number() OVER (PARTITION BY m.patient_id ORDER BY v.visit_date, v.visit_time, v.created_at) AS visit_number,
    v.encounter_date,
    v.diagnosis,
    v.treatment_plan
   FROM public.medications m
     LEFT JOIN public.patients p ON m.patient_id = p.id
     LEFT JOIN public.users u ON m.prescribed_by = u.id
     LEFT JOIN public.visits v ON m.visit_id = v.id
  ORDER BY p.last_name, p.first_name, v.visit_date DESC, v.visit_time DESC;

ALTER VIEW public.sms_analytics SET (security_invoker = on);

-- ---------------------------------------------------------------------------------------------
-- 9. Today's functions: a fixed search_path where the advisor found none (function_search_path_mutable;
--    none uses an extension function, so public is enough), and no EXECUTE for the anon key on the
--    trigger functions (a trigger runs whatever the caller's rights; nobody calls these directly)
-- ---------------------------------------------------------------------------------------------
ALTER FUNCTION public.ar_amount(jsonb) SET search_path = public;
ALTER FUNCTION public.ar_audit_append_only() SET search_path = public;
ALTER FUNCTION public.ar_derive_payment_status(text, date, boolean, numeric, numeric) SET search_path = public;
ALTER FUNCTION public.ar_format_nad(numeric) SET search_path = public;
ALTER FUNCTION public.ar_is_cancelled(text) SET search_path = public;
ALTER FUNCTION public.ar_no_truncate() SET search_path = public;
ALTER FUNCTION public.ar_portion_label(text) SET search_path = public;
ALTER FUNCTION public.ar_receipt_method_from_text(text) SET search_path = public;
ALTER FUNCTION public.ar_today() SET search_path = public;
ALTER FUNCTION public.billing_code_bundle_lines_set_practice() SET search_path = public;
ALTER FUNCTION public.billing_code_bundles_touch_audit() SET search_path = public;
ALTER FUNCTION public.dc_day_label(date) SET search_path = public;
ALTER FUNCTION public.dc_flag_rule(text) SET search_path = public;
ALTER FUNCTION public.dc_invoice_billed(numeric, text) SET search_path = public;
ALTER FUNCTION public.dc_invoice_date(date, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.dc_local_date(timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.dc_month_label(date) SET search_path = public;
ALTER FUNCTION public.dc_net_cents(jsonb) SET search_path = public;
ALTER FUNCTION public.dc_no_truncate() SET search_path = public;
ALTER FUNCTION public.dc_statement_criteria_guard() SET search_path = public;
ALTER FUNCTION public.fund_tariff_contracts_normalise() SET search_path = public;
ALTER FUNCTION public.fund_tariffs_normalise() SET search_path = public;
ALTER FUNCTION public.invoice_audit_append_only() SET search_path = public;
ALTER FUNCTION public.invoice_format_number(text, integer, bigint) SET search_path = public;
ALTER FUNCTION public.patient_lists_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.quote_lines_guard() SET search_path = public;
ALTER FUNCTION public.quotes_guard() SET search_path = public;
ALTER FUNCTION public.remittance_append_only() SET search_path = public;
ALTER FUNCTION public.remittance_text_array(jsonb) SET search_path = public;

REVOKE EXECUTE ON FUNCTION
  public.ar_adjustments_before_insert(), public.ar_adjustments_before_reverse(), public.ar_allocations_before_insert(),
  public.ar_audit(), public.ar_audit_append_only(), public.ar_entries_sync_status(), public.ar_invoice_delete_guard(),
  public.ar_invoice_status_bridge(), public.ar_no_truncate(), public.ar_receipts_after_reverse(),
  public.ar_receipts_before_insert(), public.ar_receipts_before_reverse(), public.ar_reverse_only(),
  public.assign_claim_batch_number(), public.billing_code_bundle_lines_set_practice(),
  public.billing_code_bundles_touch_audit(), public.diary_blocks_touch_updated_at(),
  public.fund_tariff_contracts_normalise(), public.fund_tariffs_normalise(), public.invoice_audit_append_only(),
  public.patient_allergies_clear_nka(), public.patient_allergies_stamp(), public.patient_allergy_overrides_stamp(),
  public.patient_clinical_profiles_stamp(), public.patient_letters_stamp(), public.patient_list_members_check_practice(),
  public.patient_lists_touch_updated_at(), public.patient_problems_stamp(), public.patient_safety_set_practice(),
  public.practice_sms_replies_touch_updated_at(), public.quote_lines_guard(), public.quotes_guard(),
  public.remittance_append_only()
FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------------------------
-- 10. Checks: stop here (nothing is kept) if any fails
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  -- No policy left that lets every signed-in login (or everyone) in, apart from the reference-table reads
  SELECT string_agg(format('%s."%s"', p.tablename, p.policyname), ', ') INTO v_bad
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('automation_definitions', 'automation_queue', 'invoice_services', 'invoices_enhanced', 'lab_requests',
                        'lab_results', 'medical_aid_providers', 'medical_aid_schemes', 'medical_aid_service_prices_retired',
                        'message_templates', 'messages', 'oauth_callback_tokens', 'patient_documents', 'patients',
                        'practice_email_subscriptions', 'practice_features', 'practice_inventory', 'practice_service_subscriptions',
                        'practice_sms_subscriptions', 'practice_tariffs', 'practice_types', 'practices', 'sms_logs', 'sms_plans',
                        'system_notifications', 'user_practice_assignments', 'user_profiles', 'users', 'medications', 'sms_usage_logs',
                        'visits')
    AND p.permissive = 'PERMISSIVE'
    AND (p.roles && ARRAY['authenticated', 'public', 'anon']::name[])
    AND (COALESCE(p.qual, '') IN ('true', '(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)')
         OR COALESCE(p.with_check, '') IN ('true', '(auth.uid() IS NOT NULL)', '(auth.role() = ''authenticated''::text)'))
    AND p.policyname NOT IN ('automation_definitions_read', 'medical_aid_providers_read', 'medical_aid_schemes_read',
                             'medical_aid_service_prices_retired_read', 'practice_types_read', 'sms_plans_read',
                             'practice_tariffs_read', 'Allow anon to select practices');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: open policies remain: %', v_bad;
  END IF;

  -- The anon read-only policies the public sites use are still there
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'practices' AND policyname = 'Allow anon to select practices')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'allow_anon_read_practice_users') THEN
    RAISE EXCEPTION 'Check failed: the public sites lost their anon read on practices or users';
  END IF;

  -- Views
  SELECT string_agg(c.relname, ', ') INTO v_bad
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN ('medications_with_details', 'sms_analytics')
    AND NOT COALESCE((SELECT option_value::boolean FROM pg_options_to_table(c.reloptions) WHERE option_name = 'security_invoker'), false);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: views still run with their owner''s rights: %', v_bad;
  END IF;
  IF pg_get_viewdef('public.medications_with_details'::regclass) ~ 'auth\.' THEN
    RAISE EXCEPTION 'Check failed: medications_with_details still reads the auth schema';
  END IF;

  -- Functions
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('ar_amount', 'ar_audit_append_only', 'ar_derive_payment_status', 'ar_format_nad', 'ar_is_cancelled',
                      'ar_no_truncate', 'ar_portion_label', 'ar_receipt_method_from_text', 'ar_today',
                      'billing_code_bundle_lines_set_practice', 'billing_code_bundles_touch_audit', 'dc_day_label', 'dc_flag_rule',
                      'dc_invoice_billed', 'dc_invoice_date', 'dc_local_date', 'dc_month_label', 'dc_net_cents', 'dc_no_truncate',
                      'dc_statement_criteria_guard', 'fund_tariff_contracts_normalise', 'fund_tariffs_normalise',
                      'invoice_audit_append_only', 'invoice_format_number', 'patient_lists_touch_updated_at', 'quote_lines_guard',
                      'quotes_guard', 'remittance_append_only', 'remittance_text_array')
    AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) s WHERE s LIKE 'search_path=%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: no search_path on %', v_bad;
  END IF;

  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prorettype = 'trigger'::regtype
    AND p.proname IN ('ar_adjustments_before_insert', 'ar_adjustments_before_reverse', 'ar_allocations_before_insert', 'ar_audit',
                      'ar_audit_append_only', 'ar_entries_sync_status', 'ar_invoice_delete_guard', 'ar_invoice_status_bridge',
                      'ar_no_truncate', 'ar_receipts_after_reverse', 'ar_receipts_before_insert', 'ar_receipts_before_reverse',
                      'ar_reverse_only', 'assign_claim_batch_number', 'billing_code_bundle_lines_set_practice',
                      'billing_code_bundles_touch_audit', 'diary_blocks_touch_updated_at', 'fund_tariff_contracts_normalise',
                      'fund_tariffs_normalise', 'invoice_audit_append_only', 'patient_allergies_clear_nka', 'patient_allergies_stamp',
                      'patient_allergy_overrides_stamp', 'patient_clinical_profiles_stamp', 'patient_letters_stamp',
                      'patient_list_members_check_practice', 'patient_lists_touch_updated_at', 'patient_problems_stamp',
                      'patient_safety_set_practice', 'practice_sms_replies_touch_updated_at', 'quote_lines_guard', 'quotes_guard',
                      'remittance_append_only')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Check failed: the anon key can still run %', v_bad;
  END IF;

  RAISE NOTICE 'Practice isolation in place: no open policies on the 31 tables, 2 views on the caller''s rights, 29 search_paths, 33 trigger functions closed to anon';
END
$$;

-- PostgREST: pick up the new column and the changed views
NOTIFY pgrst, 'reload schema';

ROLLBACK;

-- =============================================================================================
-- Undo (after a COMMIT), in one transaction:
--   1. Drop what this file created:
--      users: users_read, users_self_update, users_practice_admin, users_super_admin;
--      practices: practices_staff_read, practices_super_admin;
--      <table>_staff and <table>_super_admin_read on invoices_enhanced, invoice_services, lab_requests,
--        lab_results, patient_documents, medications, practice_inventory, automation_queue, messages;
--      <table>_super_admin_read on message_templates, patients, visits, practice_sms_subscriptions,
--        system_notifications, user_profiles;
--      <table>_staff_read on practice_email_subscriptions, practice_service_subscriptions,
--        practice_features, sms_logs, sms_usage_logs, oauth_callback_tokens; oauth_callback_tokens_staff_update;
--      practice_service_subscriptions_super_admin; user_profiles_own; user_practice_assignments_read;
--      system_notifications_staff_insert;
--      <table>_read and <table>_super_admin on automation_definitions, medical_aid_providers,
--        medical_aid_schemes, medical_aid_service_prices_retired, practice_types, sms_plans; practice_tariffs_read;
--      DROP FUNCTION public.rls_my_practice_id(), public.rls_is_super_admin(), public.rls_is_practice_admin(),
--        public.rls_my_access_fields();  (after the users policies)
--      messages.practice_id can stay (empty table).
--   2. Recreate the policies section 2-7 dropped, as they were:
--   CREATE POLICY "All users can view automation definitions" ON public.automation_definitions FOR SELECT TO public USING (true);
--   CREATE POLICY "Service role can manage queue" ON public.automation_queue FOR ALL TO public USING (true);
--   CREATE POLICY invoices_all_access ON public.invoices_enhanced FOR ALL TO public USING (true);
--   CREATE POLICY invoice_services_all_access ON public.invoice_services FOR ALL TO public USING (true);
--   CREATE POLICY "Authenticated users can create lab requests" ON public.lab_requests FOR INSERT TO authenticated WITH CHECK (true);
--   CREATE POLICY "Authenticated users can delete lab requests" ON public.lab_requests FOR DELETE TO authenticated USING (true);
--   CREATE POLICY "Authenticated users can update lab requests" ON public.lab_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "Authenticated users can view lab requests" ON public.lab_requests FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "Authenticated users can create lab results" ON public.lab_results FOR INSERT TO authenticated WITH CHECK (true);
--   CREATE POLICY "Authenticated users can delete lab results" ON public.lab_results FOR DELETE TO authenticated USING (true);
--   CREATE POLICY "Authenticated users can update lab results" ON public.lab_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "Authenticated users can view lab results" ON public.lab_results FOR SELECT TO authenticated USING (true);
--   CREATE POLICY read_providers ON public.medical_aid_providers FOR SELECT TO public USING (true);
--   CREATE POLICY read_schemes ON public.medical_aid_schemes FOR SELECT TO public USING (true);
--   CREATE POLICY read_prices ON public.medical_aid_service_prices_retired FOR SELECT TO public USING (true);
--   CREATE POLICY "Users can delete medications" ON public.medications FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM (visits v JOIN patients p ON ((v.patient_id = p.id))) WHERE (v.id = medications.visit_id))));
--   CREATE POLICY "Users can delete medications for accessible patients" ON public.medications FOR DELETE TO public USING (((auth.role() = 'authenticated'::text) AND ((prescribed_by = auth.uid()) OR (( SELECT users.role FROM users WHERE (users.id = auth.uid())) = 'admin'::text))));
--   CREATE POLICY "Users can insert medications" ON public.medications FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM (visits v JOIN patients p ON ((v.patient_id = p.id))) WHERE (v.id = medications.visit_id))));
--   CREATE POLICY "Users can insert medications for accessible patients" ON public.medications FOR INSERT TO public WITH CHECK (((auth.role() = 'authenticated'::text) AND ((( SELECT users.role FROM users WHERE (users.id = auth.uid())) = ANY (ARRAY['doctor'::text, 'admin'::text])) AND (EXISTS ( SELECT 1 FROM (patients p JOIN users u ON ((u.practice_id = p.practice_id))) WHERE ((p.id = medications.patient_id) AND (u.id = auth.uid())))))));
--   CREATE POLICY "Users can update medications" ON public.medications FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM (visits v JOIN patients p ON ((v.patient_id = p.id))) WHERE (v.id = medications.visit_id))));
--   CREATE POLICY "Users can update medications for accessible patients" ON public.medications FOR UPDATE TO public USING (((auth.role() = 'authenticated'::text) AND ((prescribed_by = auth.uid()) OR ((( SELECT users.role FROM users WHERE (users.id = auth.uid())) = ANY (ARRAY['doctor'::text, 'admin'::text])) AND (EXISTS ( SELECT 1 FROM (patients p JOIN users u ON ((u.practice_id = p.practice_id))) WHERE ((p.id = medications.patient_id) AND (u.id = auth.uid()))))))));
--   CREATE POLICY "Users can view medications for accessible patients" ON public.medications FOR SELECT TO public USING (((auth.role() = 'authenticated'::text) AND ((( SELECT users.role FROM users WHERE (users.id = auth.uid())) = ANY (ARRAY['doctor'::text, 'admin'::text])) OR (EXISTS ( SELECT 1 FROM (patients p JOIN users u ON ((u.practice_id = p.practice_id))) WHERE ((p.id = medications.patient_id) AND (u.id = auth.uid())))))));
--   CREATE POLICY "Users can view medications for their practice patients" ON public.medications FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM (visits v JOIN patients p ON ((v.patient_id = p.id))) WHERE (v.id = medications.visit_id))));
--   CREATE POLICY "Allow all operations for authenticated users on messages" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow all operations for authenticated users on templates" ON public.message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "Users can delete patient documents" ON public.patient_documents FOR DELETE TO public USING ((auth.uid() IS NOT NULL));
--   CREATE POLICY "Users can insert patient documents" ON public.patient_documents FOR INSERT TO public WITH CHECK ((auth.uid() IS NOT NULL));
--   CREATE POLICY "Users can update patient documents" ON public.patient_documents FOR UPDATE TO public USING ((auth.uid() IS NOT NULL));
--   CREATE POLICY "Users can view patient documents" ON public.patient_documents FOR SELECT TO public USING (true);
--   CREATE POLICY "Enable insert for authenticated users only" ON public.patients FOR INSERT TO authenticated WITH CHECK (true);
--   CREATE POLICY "Allow all operations on practice_email_subscriptions" ON public.practice_email_subscriptions FOR ALL TO public USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow anon full access to email subscriptions" ON public.practice_email_subscriptions FOR ALL TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow all operations on practice_features" ON public.practice_features FOR ALL TO public USING (true) WITH CHECK (true);
--   CREATE POLICY "Anon users can delete inventory" ON public.practice_inventory FOR DELETE TO anon USING (true);
--   CREATE POLICY "Anon users can insert inventory" ON public.practice_inventory FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY "Anon users can read inventory" ON public.practice_inventory FOR SELECT TO anon USING (true);
--   CREATE POLICY "Anon users can update inventory" ON public.practice_inventory FOR UPDATE TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY "Authenticated users can manage inventory" ON public.practice_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow anon to delete practices" ON public.practices FOR DELETE TO anon USING (true);
--   CREATE POLICY "Allow anon to insert practices" ON public.practices FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY "Allow anon to update practices" ON public.practices FOR UPDATE TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow public read access to practices" ON public.practices FOR SELECT TO public USING (true);
--   CREATE POLICY "Allow all operations on practice_service_subscriptions" ON public.practice_service_subscriptions FOR ALL TO public USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow all operations on practice_sms_subscriptions" ON public.practice_sms_subscriptions FOR ALL TO public USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow anon full access to sms subscriptions" ON public.practice_sms_subscriptions FOR ALL TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY "SMS subscriptions are manageable by authenticated users" ON public.practice_sms_subscriptions FOR ALL TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY "SMS subscriptions are viewable by authenticated users" ON public.practice_sms_subscriptions FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY practice_tariffs_read_all ON public.practice_tariffs FOR SELECT TO public USING (true);
--   CREATE POLICY practice_types_read_all ON public.practice_types FOR SELECT TO public USING (true);
--   CREATE POLICY "Allow all operations on sms_logs" ON public.sms_logs FOR ALL TO public USING (true) WITH CHECK (true);
--   CREATE POLICY "SMS logs are insertable by authenticated users" ON public.sms_logs FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
--   CREATE POLICY "SMS logs are viewable by authenticated users" ON public.sms_logs FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
--   CREATE POLICY "SMS plans are publicly viewable" ON public.sms_plans FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "Users can view their SMS usage" ON public.sms_usage_logs FOR SELECT TO public USING ((practice_id IN ( SELECT sms_usage_logs.practice_id FROM auth.users WHERE (users.id = auth.uid()))));
--   CREATE POLICY "System can create notifications" ON public.system_notifications FOR INSERT TO public WITH CHECK (true);
--   CREATE POLICY "Allow all operations on user_practice_assignments" ON public.user_practice_assignments FOR ALL TO public USING (true) WITH CHECK (true);
--   CREATE POLICY "Allow all operations on user_profiles" ON public.user_profiles FOR ALL TO public USING (true) WITH CHECK (true);
--   CREATE POLICY users_delete_policy ON public.users FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM users deleter WHERE ((deleter.id = auth.uid()) AND ((deleter.is_super_admin = true) OR (deleter.role = ANY (ARRAY['admin'::text, 'doctor'::text])))))));
--   CREATE POLICY users_insert_policy ON public.users FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM users creator WHERE ((creator.id = auth.uid()) AND ((creator.is_super_admin = true) OR (creator.role = ANY (ARRAY['admin'::text, 'doctor'::text])))))));
--   CREATE POLICY users_select_policy ON public.users FOR SELECT TO authenticated USING (true);
--   CREATE POLICY users_update_policy ON public.users FOR UPDATE TO authenticated USING (((auth.uid() = id) OR (EXISTS ( SELECT 1 FROM users updater WHERE ((updater.id = auth.uid()) AND ((updater.is_super_admin = true) OR (updater.role = ANY (ARRAY['admin'::text, 'doctor'::text])))))))) WITH CHECK (((auth.uid() = id) OR (EXISTS ( SELECT 1 FROM users updater WHERE ((updater.id = auth.uid()) AND ((updater.is_super_admin = true) OR (updater.role = ANY (ARRAY['admin'::text, 'doctor'::text]))))))));
--   3. Views: ALTER VIEW public.sms_analytics SET (security_invoker = off); and recreate
--      medications_with_details with LEFT JOIN auth.users u and u.email, security_invoker off.
--   4. Functions: ALTER FUNCTION <each of section 9> RESET search_path; GRANT EXECUTE ON FUNCTION
--      <each trigger function of section 9> TO anon; (neither was needed by anything)
-- =============================================================================================

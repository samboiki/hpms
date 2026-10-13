-- =============================================================================================
-- PROPOSAL, NOT APPLIED: optometry - prescriptions, eye exams, optical lab orders, contact lenses,
-- frames, optical benefit notes, claim fields 45-47 and the "Contact lenses running out" list
-- File:    proposals/2026-10-08-optometry.sql                             Drafted: 2026-10-08
-- Code:    src/utils/optometry/* (prescription ranges and wording, transposition, comparison, ICD-10
--          suggestions, the claim formats, lab order steps, contact-lens run-out days, frame status,
--          the report; unit tested), src/services/optometry/optometryService.ts (reads and writes),
--          src/components/optometry/* (patient file > Eyes, the visit's "Eye exam" section, the
--          prescription and lab order slips, frames, lab orders across the practice, the report).
--          Optometry practices only (isOptometryPractice in src/utils/billing/tariffRules.ts).
-- Parity:  Eminance rows M1, M2, M4 (app only), M5, M6 / O10, M7, M9 (a practice note, no benefit
--          tables), M10 (claim fields 45-47) and M12.
--
-- Why
--   OneHealth had nothing for optometrists: no prescription, eye exam, lab order or frame. Eminance
--   keeps the script per eye, prints it, sends it in claim fields 45-47, tracks lab orders with PD and
--   remakes, keeps barcoded frames in stock and reminds contact-lens wearers before their supply runs
--   out. Before this file is applied the Eyes tab says plainly that eye records are not set up yet.
--
-- This script has NOT been applied. It runs inside a transaction that ends in ROLLBACK, so running it
-- by mistake leaves nothing behind.
--
-- How to apply
--   1. Run the whole file once as it is. It must finish without an error; the last check reports
--      "optometry ready".
--   2. Change the final ROLLBACK to COMMIT and run it again (or apply it as a migration without its
--      BEGIN / ROLLBACK lines).
--   3. Nothing to deploy. If the Eyes tab still says "not set up yet" a minute later, run:
--        NOTIFY pgrst, 'reload schema';
--   Order: after proposals/2026-10-07-dispensing-and-stock.sql (frames are stock items; this file
--   replaces patient_list_facts() as that file left it) and the claims files (batch_details); BEFORE
--   proposals/2026-10-07-patient-portal.sql (DEFAULT_ORDER in scripts/db/rehearsal.ts), so the
--   portal's staff-only guard covers these tables. Where the portal file is already applied, section
--   12 runs the guard again.
--
-- What is stored (nothing is ever deleted; a mistake is marked "entered in error" with its reason)
--   optometry_exams              one per visit: vision without and with the patient's own glasses,
--                                pressure (IOP) per eye with the method and the time measured, visual
--                                fields (normal / abnormal and a note), the contact-lens fitting note.
--   optometry_prescriptions      per eye: sphere -30..+30 and cylinder -15..+15 in 0.25 steps, axis
--                                0-180 (with a cylinder only), prism with its base, reading addition
--                                0.75-4.00, vision with it; contact lenses also base curve, diameter and
--                                the lens name. Spectacles or contact lenses; from an exam, or brought in
--                                from elsewhere. Changing an exam's refraction keeps the old prescription,
--                                marked "changed at the eye exam".
--   optometry_lab_orders (+ _events) what goes to the lab (eyes, lens type, material, coatings, tint,
--                                PD and fitting heights per eye, the frame from stock or described, the
--                                lab) and its steps: ordered -> received -> fitted -> collected, a remake
--                                (with its reason) or a cancellation (with its reason). Every step is in
--                                the events table, which the turnaround report reads.
--   optometry_cl_supplies        contact lenses ordered for or handed to a patient, and the day they run
--                                out (the app works it out from the replacement and the number of lenses).
--   optometry_frames             brand, model, colour and size of a frame. The frame itself is a stock
--                                item (practice_inventory, group "Frames", with its barcode), so deliveries,
--                                counts, valuation and the sale on an invoice are the stock module's.
--   optometry_fund_notes         the practice's own note per fund (and option): what it pays for spectacles
--                                and how often, with an optional limit and cycle. No benefit tables are
--                                invented; the note shows where spectacles and lenses are chosen.
--
-- Who may do what
--   - Active staff of the patient's practice read everything here (row level security; the users row
--     is the source of truth). These are clinical records: super admins of other practices are not
--     included, and patient-app logins read nothing.
--   - Every write goes through the functions in section 8, which check the signed-in user and stamp
--     who and when. Exams and prescriptions: a practitioner, nurse or practice admin (users.role
--     doctor, nurse or admin). Lab orders and contact-lens supplies: any staff member (reception
--     orders and hands over). Frames: who may change stock items (stock_save_item: admin, doctor,
--     nurse). Optical benefit notes: a practice admin. There are no INSERT, UPDATE or DELETE grants.
--
-- Claims: fields 45-47 of the Methealth/QEDI layout (QEDI specification sections 33-35)
--   A BEFORE INSERT trigger on batch_details fills reading_additions (field 45, "R3.00L3.75"),
--   lens_prescription (46, "R+01.25-00.50X090L+01.00-00.75X180") and density_of_tint (47, "R35L35")
--   when the claim line's visit has a lab order (its prescription and tint) or a spectacle
--   prescription, of the batch's own practice only. Values already on the line are kept, and nothing
--   else in sync_invoice_to_batch changes. src/utils/billing/claimFile.ts writes these fields only in
--   the specification's format. The specification defines no "PPN" (network) flag, so none is added.
--
-- Decisions for the owner (also in the report)
--   - Prescriptions are valid 24 months (spectacles) or 12 (contact lenses) unless the optometrist
--     changes the date; the app suggests these, the database does not force them.
--   - A prescription on an open lab order cannot be marked entered in error until the order is
--     collected or cancelled.
--   - The prescription is claimed as recorded (plus or minus cylinder): the specification takes both.
--
-- Contents
--   0. Preconditions, and the patient-list facts before this file (to prove section 10 changes no fact)
--   1. Shared helpers (today in Windhoek, visual acuity)
--   2. optometry_exams                    5. optometry_cl_supplies
--   3. optometry_prescriptions            6. optometry_frames
--   4. optometry_lab_orders and events    7. optometry_fund_notes
--   8. Functions (membership checks; exams and prescriptions; lab orders; contact lenses; frames; notes)
--   9. Claim fields 45-47 (the formats and the batch_details trigger)
--  10. Patient lists: patient_list_facts() also returns contact_lenses_run_out_on
--  11. Row level security and grants
--  12. The patient app's staff-only guard (when the portal file is applied)
--  13. Checks (the behaviour checks run inside a block that undoes itself)
--   Undo: at the end of the file.
--
-- Rehearsed 2026-10-08 on the live database inside one transaction that was rolled back (checked
-- afterwards: no optometry table, function or trigger was left, and patient_list_facts() was as before).
-- Sections 13a-13c passed (13c: every other patient-list fact of the largest practice unchanged). As
-- simulated sign-ins, after a practitioner recorded an exam with a refraction, a bifocal lab order (then
-- "back from the lab") and a contact-lens supply (counts only):
--   practitioner (doctor): exams 1, prescriptions 1, lab orders 1, order steps 2, supplies 1; the
--     patient-list fact "contact lenses run out" set for the patient; a direct INSERT refused (42501)
--   receptionist of that practice: sees 1 prescription and 1 order; marks the order collected; recording
--     an eye exam is refused (42501)
--   staff of another practice: sees 0 rows; changing an order and reading the list facts refused (42501)
--   a signed-in login without a staff profile: sees 0 rows; recording a prescription refused (42501)
--   the anon key: reading and the functions refused (42501)
--   structure: 7 tables, 7 staff read policies, 7 portal staff-only guards, 22 functions, 1 claim trigger,
--     patient_list_facts() returns 17 columns
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Preconditions
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.practices'), ('public.patients'), ('public.visits'), ('public.users'), ('public.practice_inventory'),
                 ('public.stock_suppliers'), ('public.stock_movements'), ('public.batch_headers'), ('public.batch_details')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %. Apply the stock and claims proposals first.', v_missing;
  END IF;
  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.stock_save_item(jsonb)'), ('public.patient_lists_can_access(uuid)'),
                 ('public.patient_list_facts(uuid,date,uuid[])')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
  -- Section 10 rewrites patient_list_facts() as proposals/2026-10-07-dispensing-and-stock.sql left it.
  -- If another file has changed it since, merge by hand instead of losing that change.
  IF pg_get_function_result('public.patient_list_facts(uuid,date,uuid[])'::regprocedure) IS DISTINCT FROM
     'TABLE(patient_id uuid, first_name text, last_name text, date_of_birth date, cell_number text, sms_opt_out boolean, '
     'last_completed_visit_on date, last_completed_by_type jsonb, last_billed_by_code jsonb, completed_visits_12m integer, '
     'next_booking_on date, next_booking_time text, last_no_show_on date, balance_due numeric, oldest_unpaid_on date, '
     'next_repeat_due_on date)' THEN
    RAISE EXCEPTION 'Stopped: patient_list_facts() is not as proposals/2026-10-07-dispensing-and-stock.sql left it; merge section 10 by hand';
  END IF;
  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ') INTO v_missing
    FROM (VALUES ('batch_details', 'visit_id'), ('batch_details', 'batch_header_id'), ('batch_details', 'reading_additions'),
                 ('batch_details', 'lens_prescription'), ('batch_details', 'density_of_tint'), ('batch_headers', 'practice_id'),
                 ('practice_inventory', 'item_group'), ('practice_inventory', 'barcode'), ('visits', 'patient_id'),
                 ('visits', 'visit_date'), ('visits', 'scheduled_date'), ('patients', 'practice_id'), ('users', 'role'),
                 ('users', 'is_active'), ('users', 'hpcsa_number')) AS t(table_name, column_name)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these columns are missing: %', v_missing;
  END IF;
END $$;

-- The facts of the practice with the most patients, as they are now (compared in section 13; no row is
-- ever shown). Read as the service role, which patient_lists_can_access() allows.
DO $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.practice_id IS NOT NULL
   GROUP BY p.practice_id ORDER BY count(*) DESC, p.practice_id LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE format('CREATE TEMP TABLE optometry_facts_before ON COMMIT DROP AS SELECT %L::uuid AS practice_id, f.* FROM public.patient_list_facts(%L::uuid, %L::date) f',
                 v_practice, v_practice, (now() AT TIME ZONE 'Africa/Windhoek')::date);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Shared helpers
-- ---------------------------------------------------------------------------------------------

-- 1a. Today in Windhoek (statuses and supplies are dated by the practice's day, not UTC)
CREATE OR REPLACE FUNCTION public.optometry_today()
RETURNS date LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE 'Africa/Windhoek')::date
$$;

-- 1b. Visual acuity as stored: Snellen ("6/9+2", "20/40"), decimal ("1.0", "0.5") or CF, HM, LP, NLP.
--     The app uses the same expression (VA_PATTERN in src/utils/optometry/visualAcuity.ts).
CREATE OR REPLACE FUNCTION public.optometry_va_ok(p_va text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_va ~ '^((6|20)/[1-9][0-9]{0,2}([+-][1-5])?|0\.(0[1-9]|[1-9][0-9]?)|1\.[0-9]{1,2}|2\.00?|CF|HM|LP|NLP)$'
$$;

-- 1c. An acuity as typed, in the stored form: upper case, no spaces, a decimal comma as a point
CREATE OR REPLACE FUNCTION public.optometry_va(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT NULLIF(upper(regexp_replace(replace(COALESCE(p_text, ''), ',', '.'), '\s', '', 'g')), '')
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. optometry_exams: the eye exam of a visit (one per visit)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.optometry_exams (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  visit_id         uuid NOT NULL,
  examined_on      date NOT NULL,
  -- Vision without correction and with the patient's own glasses (vision with the new prescription is on it)
  va_unaided_r     text,
  va_unaided_l     text,
  va_aided_r       text,
  va_aided_l       text,
  -- Intra-ocular pressure in mmHg, with how and when it was measured (it varies through the day)
  iop_r            numeric(4,1),
  iop_l            numeric(4,1),
  iop_method       text,
  iop_time         time,
  fields_result    text,
  fields_note      text,
  cl_fitting_note  text,
  notes            text,
  recorded_by      uuid,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Named, because the app reads the user names through these relationships
  CONSTRAINT optometry_exams_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_exams_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT optometry_exams_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE,
  CONSTRAINT optometry_exams_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_exams_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_exams_visit_key UNIQUE (visit_id),
  CONSTRAINT optometry_exams_va_check CHECK (
    (va_unaided_r IS NULL OR public.optometry_va_ok(va_unaided_r)) AND (va_unaided_l IS NULL OR public.optometry_va_ok(va_unaided_l)) AND
    (va_aided_r IS NULL OR public.optometry_va_ok(va_aided_r)) AND (va_aided_l IS NULL OR public.optometry_va_ok(va_aided_l))),
  CONSTRAINT optometry_exams_iop_check CHECK ((iop_r IS NULL OR iop_r BETWEEN 1 AND 80) AND (iop_l IS NULL OR iop_l BETWEEN 1 AND 80)),
  CONSTRAINT optometry_exams_iop_method_check CHECK (iop_method IS NULL OR iop_method IN ('non_contact', 'applanation', 'rebound', 'other')),
  -- A pressure is only meaningful with its method and time
  CONSTRAINT optometry_exams_iop_complete_check CHECK ((iop_r IS NULL AND iop_l IS NULL) OR (iop_method IS NOT NULL AND iop_time IS NOT NULL)),
  CONSTRAINT optometry_exams_fields_check CHECK (fields_result IS NULL OR fields_result IN ('normal', 'abnormal')),
  CONSTRAINT optometry_exams_text_check CHECK (
    (fields_note IS NULL OR char_length(fields_note) <= 300) AND (cl_fitting_note IS NULL OR char_length(cl_fitting_note) <= 500) AND
    (notes IS NULL OR char_length(notes) <= 1000))
);
COMMENT ON TABLE public.optometry_exams IS
  'Eye exam of a visit (optometry): vision unaided and with own glasses, pressure with method and time, visual fields, contact-lens fitting note. The refraction is a prescription linked to the exam. See proposals/2026-10-08-optometry.sql.';

CREATE INDEX IF NOT EXISTS optometry_exams_patient_idx ON public.optometry_exams (patient_id, examined_on);
CREATE INDEX IF NOT EXISTS optometry_exams_practice_idx ON public.optometry_exams (practice_id);

-- ---------------------------------------------------------------------------------------------
-- 3. optometry_prescriptions: per eye (r_ right, l_ left)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.optometry_prescriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  visit_id         uuid,
  exam_id          uuid,
  kind             text NOT NULL,
  prescribed_on    date NOT NULL,
  valid_until      date,
  r_sphere         numeric(5,2) NOT NULL,
  r_cylinder       numeric(5,2),
  r_axis           smallint,
  r_prism          numeric(4,2),
  r_prism_base     text,
  r_add            numeric(4,2),
  r_va             text,
  r_base_curve     numeric(4,2),
  r_diameter       numeric(4,2),
  l_sphere         numeric(5,2) NOT NULL,
  l_cylinder       numeric(5,2),
  l_axis           smallint,
  l_prism          numeric(4,2),
  l_prism_base     text,
  l_add            numeric(4,2),
  l_va             text,
  l_base_curve     numeric(4,2),
  l_diameter       numeric(4,2),
  lens_name        text,
  -- Set when the prescription was brought in from another practitioner
  outside_source   text,
  notes            text,
  recorded_by      uuid,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  voided_by        uuid,
  voided_at        timestamptz,
  void_reason      text,
  CONSTRAINT optometry_prescriptions_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT optometry_prescriptions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT optometry_prescriptions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.optometry_exams(id) ON DELETE SET NULL,
  CONSTRAINT optometry_prescriptions_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_prescriptions_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_prescriptions_kind_check CHECK (kind IN ('spectacles', 'contact_lenses')),
  -- The same ranges as RX_LIMITS in src/utils/optometry/prescription.ts; dioptres in quarter steps
  CONSTRAINT optometry_prescriptions_sphere_check CHECK (
    r_sphere BETWEEN -30 AND 30 AND r_sphere * 4 = trunc(r_sphere * 4) AND
    l_sphere BETWEEN -30 AND 30 AND l_sphere * 4 = trunc(l_sphere * 4)),
  CONSTRAINT optometry_prescriptions_cylinder_check CHECK (
    (r_cylinder IS NULL OR (r_cylinder <> 0 AND r_cylinder BETWEEN -15 AND 15 AND r_cylinder * 4 = trunc(r_cylinder * 4))) AND
    (l_cylinder IS NULL OR (l_cylinder <> 0 AND l_cylinder BETWEEN -15 AND 15 AND l_cylinder * 4 = trunc(l_cylinder * 4)))),
  -- An axis belongs to a cylinder, and a cylinder needs its axis
  CONSTRAINT optometry_prescriptions_axis_check CHECK (
    (r_cylinder IS NULL) = (r_axis IS NULL) AND (r_axis IS NULL OR r_axis BETWEEN 0 AND 180) AND
    (l_cylinder IS NULL) = (l_axis IS NULL) AND (l_axis IS NULL OR l_axis BETWEEN 0 AND 180)),
  CONSTRAINT optometry_prescriptions_prism_check CHECK (
    (r_prism IS NULL) = (r_prism_base IS NULL) AND (r_prism IS NULL OR (r_prism BETWEEN 0.25 AND 20 AND r_prism * 4 = trunc(r_prism * 4))) AND
    (r_prism_base IS NULL OR r_prism_base IN ('in', 'out', 'up', 'down')) AND
    (l_prism IS NULL) = (l_prism_base IS NULL) AND (l_prism IS NULL OR (l_prism BETWEEN 0.25 AND 20 AND l_prism * 4 = trunc(l_prism * 4))) AND
    (l_prism_base IS NULL OR l_prism_base IN ('in', 'out', 'up', 'down'))),
  CONSTRAINT optometry_prescriptions_add_check CHECK (
    (r_add IS NULL OR (r_add BETWEEN 0.75 AND 4 AND r_add * 4 = trunc(r_add * 4))) AND
    (l_add IS NULL OR (l_add BETWEEN 0.75 AND 4 AND l_add * 4 = trunc(l_add * 4)))),
  CONSTRAINT optometry_prescriptions_va_check CHECK ((r_va IS NULL OR public.optometry_va_ok(r_va)) AND (l_va IS NULL OR public.optometry_va_ok(l_va))),
  CONSTRAINT optometry_prescriptions_lens_check CHECK (
    (r_base_curve IS NULL OR r_base_curve BETWEEN 6.5 AND 10.5) AND (l_base_curve IS NULL OR l_base_curve BETWEEN 6.5 AND 10.5) AND
    (r_diameter IS NULL OR r_diameter BETWEEN 8 AND 20) AND (l_diameter IS NULL OR l_diameter BETWEEN 8 AND 20)),
  -- Base curve, diameter and the lens name are for contact lenses; contact lenses take no prism
  CONSTRAINT optometry_prescriptions_kind_fields_check CHECK (
    (kind = 'contact_lenses' OR (r_base_curve IS NULL AND l_base_curve IS NULL AND r_diameter IS NULL AND l_diameter IS NULL AND lens_name IS NULL)) AND
    (kind = 'spectacles' OR (r_prism IS NULL AND l_prism IS NULL))),
  CONSTRAINT optometry_prescriptions_valid_check CHECK (valid_until IS NULL OR valid_until >= prescribed_on),
  CONSTRAINT optometry_prescriptions_text_check CHECK (
    (lens_name IS NULL OR char_length(lens_name) <= 80) AND (outside_source IS NULL OR char_length(outside_source) <= 120) AND
    (notes IS NULL OR char_length(notes) <= 500)),
  -- "Entered in error" always has its reason and its time
  CONSTRAINT optometry_prescriptions_void_check CHECK ((voided_at IS NULL) = (void_reason IS NULL) AND (void_reason IS NULL OR char_length(void_reason) <= 200))
);
COMMENT ON TABLE public.optometry_prescriptions IS
  'Spectacle and contact-lens prescriptions per eye (optometry). Never deleted; mistakes and changed exam refractions are marked entered in error. See proposals/2026-10-08-optometry.sql.';

CREATE INDEX IF NOT EXISTS optometry_prescriptions_patient_idx ON public.optometry_prescriptions (patient_id, prescribed_on);
CREATE INDEX IF NOT EXISTS optometry_prescriptions_practice_idx ON public.optometry_prescriptions (practice_id);
CREATE INDEX IF NOT EXISTS optometry_prescriptions_visit_idx ON public.optometry_prescriptions (visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS optometry_prescriptions_exam_idx ON public.optometry_prescriptions (exam_id) WHERE exam_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 4. optometry_lab_orders and optometry_lab_order_events
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.optometry_lab_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  -- The visit the lenses are billed at (claim fields 45-47 are filled for its claim lines)
  visit_id         uuid,
  prescription_id  uuid NOT NULL,
  order_no         integer NOT NULL,
  status           text NOT NULL DEFAULT 'ordered',
  status_on        date NOT NULL,
  ordered_on       date NOT NULL,
  eyes             text NOT NULL,
  lens_type        text NOT NULL,
  material         text NOT NULL,
  coatings         text[] NOT NULL DEFAULT '{}',
  tint_percent     smallint,
  tint_colour      text,
  pd_right         numeric(3,1),
  pd_left          numeric(3,1),
  height_right     numeric(3,1),
  height_left      numeric(3,1),
  frame_item_id    uuid,
  -- The frame's name when it was ordered (the slip and the history keep it if the item changes)
  frame_name       text,
  frame_note       text,
  supplier_id      uuid,
  lab_reference    text,
  required_by      date,
  notes            text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT optometry_lab_orders_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_lab_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT optometry_lab_orders_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT optometry_lab_orders_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.optometry_prescriptions(id),
  CONSTRAINT optometry_lab_orders_frame_item_id_fkey FOREIGN KEY (frame_item_id) REFERENCES public.practice_inventory(id) ON DELETE SET NULL,
  CONSTRAINT optometry_lab_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.stock_suppliers(id) ON DELETE SET NULL,
  CONSTRAINT optometry_lab_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_lab_orders_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_lab_orders_number_key UNIQUE (practice_id, order_no),
  CONSTRAINT optometry_lab_orders_status_check CHECK (status IN ('ordered', 'received', 'fitted', 'collected', 'remake', 'cancelled')),
  CONSTRAINT optometry_lab_orders_eyes_check CHECK (eyes IN ('both', 'right', 'left')),
  CONSTRAINT optometry_lab_orders_lens_type_check CHECK (lens_type IN ('single_vision', 'bifocal', 'multifocal', 'office', 'other')),
  CONSTRAINT optometry_lab_orders_material_check
    CHECK (material IN ('cr39', 'polycarbonate', 'trivex', 'index_160', 'index_167', 'index_174', 'glass', 'other')),
  CONSTRAINT optometry_lab_orders_coatings_check
    CHECK (coatings <@ ARRAY['hard_coat', 'anti_reflective', 'blue_filter', 'photochromic', 'tint', 'polarised', 'uv']::text[]),
  -- A tint has its density (claim field 47 holds two digits per eye), and only a tinted lens has one
  CONSTRAINT optometry_lab_orders_tint_check
    CHECK ((tint_percent IS NOT NULL) = ('tint' = ANY (coatings)) AND (tint_percent IS NULL OR tint_percent BETWEEN 1 AND 99)
           AND (tint_colour IS NULL OR (tint_percent IS NOT NULL AND char_length(tint_colour) <= 30))),
  -- Monocular pupil distance 20-40 mm and fitting height 10-40 mm, in half millimetres
  CONSTRAINT optometry_lab_orders_measure_check CHECK (
    (pd_right IS NULL OR (pd_right BETWEEN 20 AND 40 AND pd_right * 2 = trunc(pd_right * 2))) AND
    (pd_left IS NULL OR (pd_left BETWEEN 20 AND 40 AND pd_left * 2 = trunc(pd_left * 2))) AND
    (height_right IS NULL OR (height_right BETWEEN 10 AND 40 AND height_right * 2 = trunc(height_right * 2))) AND
    (height_left IS NULL OR (height_left BETWEEN 10 AND 40 AND height_left * 2 = trunc(height_left * 2)))),
  -- The lab needs the PD of every eye ordered, and the fitting height for lenses with a reading part
  CONSTRAINT optometry_lab_orders_pd_needed_check CHECK ((eyes = 'left' OR pd_right IS NOT NULL) AND (eyes = 'right' OR pd_left IS NOT NULL)),
  CONSTRAINT optometry_lab_orders_height_needed_check CHECK (
    lens_type NOT IN ('bifocal', 'multifocal', 'office') OR ((eyes = 'left' OR height_right IS NOT NULL) AND (eyes = 'right' OR height_left IS NOT NULL))),
  CONSTRAINT optometry_lab_orders_frame_check CHECK (frame_item_id IS NOT NULL OR frame_note IS NOT NULL OR frame_name IS NOT NULL),
  CONSTRAINT optometry_lab_orders_dates_check CHECK (status_on >= ordered_on AND (required_by IS NULL OR required_by >= ordered_on)),
  CONSTRAINT optometry_lab_orders_text_check CHECK (
    (frame_note IS NULL OR char_length(frame_note) <= 200) AND (frame_name IS NULL OR char_length(frame_name) <= 200) AND
    (lab_reference IS NULL OR char_length(lab_reference) <= 40) AND (notes IS NULL OR char_length(notes) <= 500))
);
COMMENT ON TABLE public.optometry_lab_orders IS
  'Optical lab orders (optometry): lenses for a prescription, the measurements, the frame and the lab, with their steps in optometry_lab_order_events. See proposals/2026-10-08-optometry.sql.';

CREATE INDEX IF NOT EXISTS optometry_lab_orders_patient_idx ON public.optometry_lab_orders (patient_id, ordered_on);
CREATE INDEX IF NOT EXISTS optometry_lab_orders_open_idx ON public.optometry_lab_orders (practice_id, status);
CREATE INDEX IF NOT EXISTS optometry_lab_orders_visit_idx ON public.optometry_lab_orders (visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS optometry_lab_orders_prescription_idx ON public.optometry_lab_orders (prescription_id);
CREATE INDEX IF NOT EXISTS optometry_lab_orders_frame_idx ON public.optometry_lab_orders (frame_item_id) WHERE frame_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.optometry_lab_order_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id     uuid NOT NULL,
  practice_id  uuid NOT NULL,
  patient_id   uuid NOT NULL,
  status       text NOT NULL,
  from_status  text,
  reason       text,
  happened_on  date NOT NULL,
  changed_by   uuid,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT optometry_lab_order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.optometry_lab_orders(id) ON DELETE CASCADE,
  CONSTRAINT optometry_lab_order_events_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_lab_order_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT optometry_lab_order_events_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_lab_order_events_status_check CHECK (
    status IN ('ordered', 'received', 'fitted', 'collected', 'remake', 'cancelled') AND
    (from_status IS NULL OR from_status IN ('ordered', 'received', 'fitted', 'collected', 'remake', 'cancelled'))),
  CONSTRAINT optometry_lab_order_events_reason_check CHECK (reason IS NULL OR char_length(reason) <= 200)
);
COMMENT ON TABLE public.optometry_lab_order_events IS
  'Every step of an optical lab order (who, when, and why for a remake or cancellation). Insert only, through the optometry functions.';

CREATE INDEX IF NOT EXISTS optometry_lab_order_events_order_idx ON public.optometry_lab_order_events (order_id, changed_at);
CREATE INDEX IF NOT EXISTS optometry_lab_order_events_practice_idx ON public.optometry_lab_order_events (practice_id, happened_on);

-- ---------------------------------------------------------------------------------------------
-- 5. optometry_cl_supplies: contact lenses ordered for or handed to a patient
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.optometry_cl_supplies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  prescription_id  uuid,
  lens_name        text NOT NULL,
  replacement      text NOT NULL,
  lenses_per_eye   smallint NOT NULL,
  supplier_id      uuid,
  status           text NOT NULL,
  ordered_on       date,
  received_on      date,
  collected_on     date,
  runs_out_on      date,
  cancelled_on     date,
  cancel_reason    text,
  notes            text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT optometry_cl_supplies_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_cl_supplies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT optometry_cl_supplies_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.optometry_prescriptions(id) ON DELETE SET NULL,
  CONSTRAINT optometry_cl_supplies_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.stock_suppliers(id) ON DELETE SET NULL,
  CONSTRAINT optometry_cl_supplies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_cl_supplies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_cl_supplies_status_check CHECK (status IN ('ordered', 'received', 'collected', 'cancelled')),
  CONSTRAINT optometry_cl_supplies_replacement_check CHECK (replacement IN ('daily', 'two_weekly', 'monthly', 'three_monthly', 'yearly')),
  CONSTRAINT optometry_cl_supplies_lenses_check CHECK (lenses_per_eye BETWEEN 1 AND 400),
  -- With the patient: the day they got the lenses and the day the lenses run out, after it
  CONSTRAINT optometry_cl_supplies_collected_check CHECK (
    (status = 'collected') = (collected_on IS NOT NULL) AND (collected_on IS NULL OR runs_out_on > collected_on)),
  CONSTRAINT optometry_cl_supplies_cancel_check CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL)),
  CONSTRAINT optometry_cl_supplies_text_check CHECK (
    char_length(lens_name) BETWEEN 1 AND 80 AND (cancel_reason IS NULL OR char_length(cancel_reason) <= 200) AND
    (notes IS NULL OR char_length(notes) <= 300))
);
COMMENT ON TABLE public.optometry_cl_supplies IS
  'Contact-lens supplies per patient (optometry): ordered, arrived, collected (with the day they run out) or cancelled. The run-out day feeds the "Contact lenses running out" patient list. See proposals/2026-10-08-optometry.sql.';

CREATE INDEX IF NOT EXISTS optometry_cl_supplies_patient_idx ON public.optometry_cl_supplies (patient_id, created_at);
CREATE INDEX IF NOT EXISTS optometry_cl_supplies_running_idx ON public.optometry_cl_supplies (practice_id, patient_id) WHERE status = 'collected';

-- ---------------------------------------------------------------------------------------------
-- 6. optometry_frames: what a frame stock item is (the item and its barcode are practice_inventory's)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.optometry_frames (
  item_id      uuid PRIMARY KEY,
  practice_id  uuid NOT NULL,
  brand        text NOT NULL,
  model        text NOT NULL,
  colour       text,
  size         text,
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT optometry_frames_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.practice_inventory(id) ON DELETE CASCADE,
  CONSTRAINT optometry_frames_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_frames_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frames_text_check CHECK (
    char_length(brand) BETWEEN 1 AND 60 AND char_length(model) BETWEEN 1 AND 60 AND
    (colour IS NULL OR char_length(colour) <= 30) AND (size IS NULL OR char_length(size) <= 20))
);
COMMENT ON TABLE public.optometry_frames IS
  'Brand, model, colour and size of frame stock items (practice_inventory, group Frames). See proposals/2026-10-08-optometry.sql.';

CREATE INDEX IF NOT EXISTS optometry_frames_practice_idx ON public.optometry_frames (practice_id);

-- ---------------------------------------------------------------------------------------------
-- 7. optometry_fund_notes: the practice's own optical benefit note per fund (and option)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.optometry_fund_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     uuid NOT NULL,
  fund_reference  text NOT NULL,
  plan_option     text,
  note            text NOT NULL,
  limit_amount    numeric(12,2),
  cycle_months    smallint,
  updated_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT optometry_fund_notes_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_fund_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_fund_notes_fund_check CHECK (fund_reference ~ '^[A-Z0-9]{2,10}$'),
  CONSTRAINT optometry_fund_notes_values_check CHECK (
    char_length(note) BETWEEN 1 AND 500 AND (plan_option IS NULL OR char_length(plan_option) BETWEEN 1 AND 60) AND
    (limit_amount IS NULL OR limit_amount BETWEEN 0 AND 1000000) AND (cycle_months IS NULL OR cycle_months BETWEEN 1 AND 60))
);
COMMENT ON TABLE public.optometry_fund_notes IS
  'The practice''s own optical benefit note per fund (claim code) and optional plan option, with an optional limit and cycle. No benefit tables are kept. See proposals/2026-10-08-optometry.sql.';

CREATE UNIQUE INDEX IF NOT EXISTS optometry_fund_notes_fund_key
  ON public.optometry_fund_notes (practice_id, fund_reference, lower(COALESCE(plan_option, '')));

-- ---------------------------------------------------------------------------------------------
-- 8. Functions
-- ---------------------------------------------------------------------------------------------

-- 8a. The patient's practice, when the signed-in user is active staff of it; raises otherwise.
--     p_clinical: exams and prescriptions need a practitioner, nurse or practice admin.
--     auth.uid() is NULL in the SQL editor and for the service role, so they cannot use these functions
--     (the service role may write to the tables directly).
CREATE OR REPLACE FUNCTION public.optometry_practice_for(p_patient_id uuid, p_clinical boolean)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid;
  v_role text;
BEGIN
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = p_patient_id;
  SELECT u.role INTO v_role
  FROM public.users u
  WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND v_practice IS NOT NULL AND u.practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only staff of the patient''s practice can change this patient''s eye records' USING ERRCODE = '42501';
  END IF;
  IF p_clinical AND COALESCE(v_role, '') NOT IN ('doctor', 'nurse', 'admin') THEN
    RAISE EXCEPTION 'Only a practitioner, nurse or practice admin can record eye exams and prescriptions' USING ERRCODE = '42501';
  END IF;
  RETURN v_practice;
END
$$;

-- 8b. Raises unless the signed-in user is active staff of the practice (with one of p_roles, when given)
CREATE OR REPLACE FUNCTION public.optometry_staff_of(p_practice_id uuid, p_roles text[])
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND p_practice_id IS NOT NULL AND u.practice_id = p_practice_id
       AND (p_roles IS NULL OR u.role = ANY (p_roles))
  ) THEN
    RAISE EXCEPTION '%', CASE WHEN p_roles IS NULL THEN 'Only staff of the practice can do this' ELSE 'Only a practice admin can change this' END
      USING ERRCODE = '42501';
  END IF;
END
$$;

-- 8c. A prescription's values from the app's JSON ({"right": {...}, "left": {...}, "valid_until",
--     "lens_name", "outside_source", "notes"}): a zero cylinder, prism or add is "none". The table's
--     checks decide what is allowed (the app checks the same first).
CREATE OR REPLACE FUNCTION public.optometry_rx_values(p_rx jsonb)
RETURNS TABLE (
  r_sphere numeric, r_cylinder numeric, r_axis smallint, r_prism numeric, r_prism_base text, r_add numeric, r_va text,
  r_base_curve numeric, r_diameter numeric,
  l_sphere numeric, l_cylinder numeric, l_axis smallint, l_prism numeric, l_prism_base text, l_add numeric, l_va text,
  l_base_curve numeric, l_diameter numeric,
  valid_until date, lens_name text, outside_source text, notes text
)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH eye AS (
    SELECT s.side,
           NULLIF(p_rx -> s.side ->> 'sphere', '')::numeric AS sphere,
           NULLIF(NULLIF(p_rx -> s.side ->> 'cylinder', '')::numeric, 0) AS cylinder,
           NULLIF(p_rx -> s.side ->> 'axis', '')::smallint AS axis,
           NULLIF(NULLIF(p_rx -> s.side ->> 'prism', '')::numeric, 0) AS prism,
           NULLIF(btrim(p_rx -> s.side ->> 'base'), '') AS base,
           NULLIF(NULLIF(p_rx -> s.side ->> 'add', '')::numeric, 0) AS addition,
           public.optometry_va(p_rx -> s.side ->> 'va') AS va,
           NULLIF(p_rx -> s.side ->> 'base_curve', '')::numeric AS base_curve,
           NULLIF(p_rx -> s.side ->> 'diameter', '')::numeric AS diameter
    FROM unnest(ARRAY['right', 'left']) AS s(side)
  )
  SELECT r.sphere, r.cylinder, r.axis, r.prism, r.base, r.addition, r.va, r.base_curve, r.diameter,
         l.sphere, l.cylinder, l.axis, l.prism, l.base, l.addition, l.va, l.base_curve, l.diameter,
         NULLIF(p_rx ->> 'valid_until', '')::date, NULLIF(btrim(p_rx ->> 'lens_name'), ''),
         NULLIF(btrim(p_rx ->> 'outside_source'), ''), NULLIF(btrim(p_rx ->> 'notes'), '')
  FROM eye r, eye l
  WHERE r.side = 'right' AND l.side = 'left'
$$;

-- 8d. Records a prescription (internal: the callers check the user); returns its id
CREATE OR REPLACE FUNCTION public.optometry_insert_rx(
  p_practice_id uuid, p_patient_id uuid, p_visit_id uuid, p_exam_id uuid, p_kind text, p_prescribed_on date, p_rx jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid;
BEGIN
  IF jsonb_typeof(p_rx -> 'right') IS DISTINCT FROM 'object' OR jsonb_typeof(p_rx -> 'left') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'A prescription has a right eye and a left eye' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.optometry_prescriptions (
    practice_id, patient_id, visit_id, exam_id, kind, prescribed_on, valid_until,
    r_sphere, r_cylinder, r_axis, r_prism, r_prism_base, r_add, r_va, r_base_curve, r_diameter,
    l_sphere, l_cylinder, l_axis, l_prism, l_prism_base, l_add, l_va, l_base_curve, l_diameter,
    lens_name, outside_source, notes, recorded_by
  )
  SELECT p_practice_id, p_patient_id, p_visit_id, p_exam_id, p_kind, p_prescribed_on, v.valid_until,
         v.r_sphere, v.r_cylinder, v.r_axis, v.r_prism, v.r_prism_base, v.r_add, v.r_va, v.r_base_curve, v.r_diameter,
         v.l_sphere, v.l_cylinder, v.l_axis, v.l_prism, v.l_prism_base, v.l_add, v.l_va, v.l_base_curve, v.l_diameter,
         v.lens_name, v.outside_source, v.notes, auth.uid()
  FROM public.optometry_rx_values(p_rx) v
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

-- 8e. Whether the JSON describes another prescription than the stored one (an unchanged exam saved
--     again keeps its prescription)
CREATE OR REPLACE FUNCTION public.optometry_rx_differs(p_prescription_id uuid, p_rx jsonb)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (r.r_sphere, r.r_cylinder, r.r_axis, r.r_prism, r.r_prism_base, r.r_add, r.r_va, r.r_base_curve, r.r_diameter,
          r.l_sphere, r.l_cylinder, r.l_axis, r.l_prism, r.l_prism_base, r.l_add, r.l_va, r.l_base_curve, r.l_diameter,
          r.valid_until, r.lens_name, r.notes)
         IS DISTINCT FROM
         (v.r_sphere, v.r_cylinder, v.r_axis, v.r_prism, v.r_prism_base, v.r_add, v.r_va, v.r_base_curve, v.r_diameter,
          v.l_sphere, v.l_cylinder, v.l_axis, v.l_prism, v.l_prism_base, v.l_add, v.l_va, v.l_base_curve, v.l_diameter,
          v.valid_until, v.lens_name, v.notes)
  FROM public.optometry_prescriptions r, public.optometry_rx_values(p_rx) v
  WHERE r.id = p_prescription_id
$$;

-- 8f. Marks a prescription entered in error (internal). Refused while an open lab order uses it: the
--     order would then be made to a prescription nobody stands by.
CREATE OR REPLACE FUNCTION public.optometry_void_rx(p_prescription_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_order integer;
BEGIN
  SELECT o.order_no INTO v_order
  FROM public.optometry_lab_orders o
  WHERE o.prescription_id = p_prescription_id AND o.status NOT IN ('collected', 'cancelled')
  ORDER BY o.order_no
  LIMIT 1;
  IF v_order IS NOT NULL THEN
    RAISE EXCEPTION 'This prescription is on lab order %, which is still open: finish or cancel the order first', v_order
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.optometry_prescriptions
     SET voided_at = now(), voided_by = auth.uid(), void_reason = left(p_reason, 200)
   WHERE id = p_prescription_id AND voided_at IS NULL;
END
$$;

-- 8g. optometry_save_exam({visit_id, va_unaided_r, va_unaided_l, va_aided_r, va_aided_l, iop_r, iop_l,
--     iop_method, iop_time, fields_result, fields_note, cl_fitting_note, notes, refraction?,
--     contact_lens_rx?}): the eye exam of a visit, created or updated, and its prescriptions. A
--     refraction that changed replaces the exam's prescription (the old one is kept, marked "changed
--     at the eye exam"); one taken off is marked "taken off the eye exam". Returns {exam_id,
--     spectacles?, contact_lenses?}. Practitioners, nurses and practice admins.
CREATE OR REPLACE FUNCTION public.optometry_save_exam(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_visit_id uuid := NULLIF(p_payload ->> 'visit_id', '')::uuid;
  v_patient uuid;
  v_on date;
  v_practice uuid;
  v_exam uuid;
  v_result jsonb;
  v_kind text;
  v_rx jsonb;
  v_current uuid;
BEGIN
  SELECT v.patient_id, COALESCE(v.visit_date, v.scheduled_date, public.optometry_today()) INTO v_patient, v_on
  FROM public.visits v
  WHERE v.id = v_visit_id;
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Save the visit first: the eye exam belongs to a visit' USING ERRCODE = '22023';
  END IF;
  v_practice := public.optometry_practice_for(v_patient, true);

  INSERT INTO public.optometry_exams AS e (
    practice_id, patient_id, visit_id, examined_on, va_unaided_r, va_unaided_l, va_aided_r, va_aided_l,
    iop_r, iop_l, iop_method, iop_time, fields_result, fields_note, cl_fitting_note, notes, recorded_by, updated_by
  ) VALUES (
    v_practice, v_patient, v_visit_id, v_on,
    public.optometry_va(p_payload ->> 'va_unaided_r'), public.optometry_va(p_payload ->> 'va_unaided_l'),
    public.optometry_va(p_payload ->> 'va_aided_r'), public.optometry_va(p_payload ->> 'va_aided_l'),
    NULLIF(p_payload ->> 'iop_r', '')::numeric, NULLIF(p_payload ->> 'iop_l', '')::numeric,
    NULLIF(p_payload ->> 'iop_method', ''), NULLIF(p_payload ->> 'iop_time', '')::time,
    NULLIF(p_payload ->> 'fields_result', ''), NULLIF(btrim(p_payload ->> 'fields_note'), ''),
    NULLIF(btrim(p_payload ->> 'cl_fitting_note'), ''), NULLIF(btrim(p_payload ->> 'notes'), ''),
    auth.uid(), auth.uid()
  )
  ON CONFLICT (visit_id) DO UPDATE SET
    va_unaided_r = EXCLUDED.va_unaided_r, va_unaided_l = EXCLUDED.va_unaided_l,
    va_aided_r = EXCLUDED.va_aided_r, va_aided_l = EXCLUDED.va_aided_l,
    iop_r = EXCLUDED.iop_r, iop_l = EXCLUDED.iop_l, iop_method = EXCLUDED.iop_method, iop_time = EXCLUDED.iop_time,
    fields_result = EXCLUDED.fields_result, fields_note = EXCLUDED.fields_note,
    cl_fitting_note = EXCLUDED.cl_fitting_note, notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING e.id INTO v_exam;
  v_result := jsonb_build_object('exam_id', v_exam);

  FOREACH v_kind IN ARRAY ARRAY['spectacles', 'contact_lenses'] LOOP
    v_rx := p_payload -> CASE v_kind WHEN 'spectacles' THEN 'refraction' ELSE 'contact_lens_rx' END;
    SELECT r.id INTO v_current
    FROM public.optometry_prescriptions r
    WHERE r.exam_id = v_exam AND r.kind = v_kind AND r.voided_at IS NULL
    ORDER BY r.recorded_at DESC
    LIMIT 1;
    IF jsonb_typeof(v_rx) = 'object' THEN
      IF v_current IS NULL OR public.optometry_rx_differs(v_current, v_rx) THEN
        IF v_current IS NOT NULL THEN
          PERFORM public.optometry_void_rx(v_current, 'Changed at the eye exam');
        END IF;
        v_current := public.optometry_insert_rx(v_practice, v_patient, v_visit_id, v_exam, v_kind, v_on, v_rx);
      END IF;
      v_result := v_result || jsonb_build_object(v_kind, v_current);
    ELSIF v_current IS NOT NULL THEN
      PERFORM public.optometry_void_rx(v_current, 'Taken off the eye exam');
    END IF;
  END LOOP;
  RETURN v_result;
END
$$;

-- 8h. optometry_save_prescription({patient_id, kind, prescribed_on, valid_until?, right, left,
--     lens_name?, outside_source?, notes?, visit_id?, replaces?}): a prescription brought in from
--     elsewhere or written outside an exam; with "replaces", a correction: the corrected one is marked
--     "corrected" and the new one keeps its visit and exam. Returns the new id. Practitioners, nurses
--     and practice admins.
CREATE OR REPLACE FUNCTION public.optometry_save_prescription(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_patient uuid := NULLIF(p_payload ->> 'patient_id', '')::uuid;
  v_kind text := COALESCE(NULLIF(p_payload ->> 'kind', ''), 'spectacles');
  v_on date := NULLIF(p_payload ->> 'prescribed_on', '')::date;
  v_visit uuid := NULLIF(p_payload ->> 'visit_id', '')::uuid;
  v_replaces uuid := NULLIF(p_payload ->> 'replaces', '')::uuid;
  v_practice uuid;
  v_old public.optometry_prescriptions%ROWTYPE;
BEGIN
  v_practice := public.optometry_practice_for(v_patient, true);
  IF v_on IS NULL OR v_on > public.optometry_today() THEN
    RAISE EXCEPTION 'Give the day it was prescribed (not a day still to come)' USING ERRCODE = '22023';
  END IF;
  IF v_visit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_visit AND v.patient_id = v_patient) THEN
    RAISE EXCEPTION 'The visit is not this patient''s' USING ERRCODE = '23514';
  END IF;
  IF v_replaces IS NOT NULL THEN
    SELECT * INTO v_old FROM public.optometry_prescriptions WHERE id = v_replaces FOR UPDATE;
    IF NOT FOUND OR v_old.patient_id <> v_patient OR v_old.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'The prescription to correct is not one of this patient''s current prescriptions' USING ERRCODE = '22023';
    END IF;
    v_kind := v_old.kind;
    PERFORM public.optometry_void_rx(v_replaces, 'Corrected');
  END IF;
  RETURN public.optometry_insert_rx(v_practice, v_patient, COALESCE(v_visit, v_old.visit_id), v_old.exam_id, v_kind, v_on, p_payload);
END
$$;

-- 8i. optometry_void_prescription(id, reason): "entered in error", with the reason. Practitioners,
--     nurses and practice admins.
CREATE OR REPLACE FUNCTION public.optometry_void_prescription(p_prescription_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rx public.optometry_prescriptions%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  SELECT * INTO v_rx FROM public.optometry_prescriptions WHERE id = p_prescription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prescription not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.optometry_practice_for(v_rx.patient_id, true);
  IF v_reason IS NULL OR char_length(v_reason) > 200 THEN
    RAISE EXCEPTION 'Say in a few words why the prescription is a mistake' USING ERRCODE = '22023';
  END IF;
  IF v_rx.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This prescription is already marked entered in error' USING ERRCODE = '22023';
  END IF;
  PERFORM public.optometry_void_rx(p_prescription_id, v_reason);
END
$$;

-- 8j. optometry_lab_order_save({id?, prescription_id, visit_id?, eyes, lens_type, material, coatings,
--     tint_percent?, tint_colour?, pd_right?, pd_left?, height_right?, height_left?, frame_item_id?,
--     frame_note?, supplier_id?, lab_reference?, required_by?, notes?}): a new order (numbered per
--     practice, "ordered" today) or a change while it has not gone to the lab yet. Returns {id,
--     order_no, created}. Any staff member of the patient's practice.
CREATE OR REPLACE FUNCTION public.optometry_lab_order_save(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := NULLIF(p_payload ->> 'id', '')::uuid;
  v_existing public.optometry_lab_orders%ROWTYPE;
  v_rx public.optometry_prescriptions%ROWTYPE;
  v_practice uuid;
  v_eyes text := COALESCE(NULLIF(p_payload ->> 'eyes', ''), 'both');
  v_type text := NULLIF(p_payload ->> 'lens_type', '');
  v_coatings text[] := ARRAY(SELECT DISTINCT c FROM jsonb_array_elements_text(COALESCE(p_payload -> 'coatings', '[]'::jsonb)) AS c ORDER BY c);
  v_frame uuid := NULLIF(p_payload ->> 'frame_item_id', '')::uuid;
  v_frame_name text;
  v_supplier uuid := NULLIF(p_payload ->> 'supplier_id', '')::uuid;
  v_visit uuid := NULLIF(p_payload ->> 'visit_id', '')::uuid;
  v_today date := public.optometry_today();
  v_no integer;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.optometry_lab_orders WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lab order not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM public.optometry_practice_for(v_existing.patient_id, false);
    IF v_existing.status <> 'ordered' THEN
      RAISE EXCEPTION 'Order % has come back from the lab or is closed: its details can no longer change', v_existing.order_no USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_rx FROM public.optometry_prescriptions WHERE id = NULLIF(p_payload ->> 'prescription_id', '')::uuid;
  IF NOT FOUND OR v_rx.kind <> 'spectacles' OR v_rx.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Choose the spectacle prescription the lenses are made to' USING ERRCODE = '22023';
  END IF;
  IF v_id IS NOT NULL AND v_rx.patient_id <> v_existing.patient_id THEN
    RAISE EXCEPTION 'The prescription is another patient''s' USING ERRCODE = '22023';
  END IF;
  v_practice := public.optometry_practice_for(v_rx.patient_id, false);

  -- Lenses with a reading part are made with the reading addition of every eye ordered
  IF v_type IN ('bifocal', 'multifocal', 'office')
     AND ((v_eyes <> 'left' AND v_rx.r_add IS NULL) OR (v_eyes <> 'right' AND v_rx.l_add IS NULL)) THEN
    RAISE EXCEPTION 'A % lens needs a reading addition in the prescription for every eye ordered', replace(v_type, '_', ' ') USING ERRCODE = '22023';
  END IF;
  IF v_frame IS NOT NULL THEN
    SELECT i.name INTO v_frame_name FROM public.practice_inventory i WHERE i.id = v_frame AND i.practice_id = v_practice;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a frame from your practice''s stock' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_supplier IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.stock_suppliers s WHERE s.id = v_supplier AND s.practice_id = v_practice) THEN
    RAISE EXCEPTION 'Choose one of your practice''s suppliers as the lab' USING ERRCODE = '22023';
  END IF;
  IF v_visit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_visit AND v.patient_id = v_rx.patient_id) THEN
    RAISE EXCEPTION 'The visit is not this patient''s' USING ERRCODE = '23514';
  END IF;

  IF v_id IS NULL THEN
    -- One number after the other per practice, also when two people order at once
    PERFORM pg_advisory_xact_lock(hashtext('optometry_lab_orders'), hashtext(v_practice::text));
    SELECT COALESCE(max(o.order_no), 0) + 1 INTO v_no FROM public.optometry_lab_orders o WHERE o.practice_id = v_practice;
    INSERT INTO public.optometry_lab_orders (
      practice_id, patient_id, visit_id, prescription_id, order_no, status, status_on, ordered_on, eyes, lens_type, material,
      coatings, tint_percent, tint_colour, pd_right, pd_left, height_right, height_left, frame_item_id, frame_name, frame_note,
      supplier_id, lab_reference, required_by, notes, created_by, updated_by
    ) VALUES (
      v_practice, v_rx.patient_id, v_visit, v_rx.id, v_no, 'ordered', v_today, v_today, v_eyes, v_type, NULLIF(p_payload ->> 'material', ''),
      v_coatings, NULLIF(p_payload ->> 'tint_percent', '')::smallint, NULLIF(btrim(p_payload ->> 'tint_colour'), ''),
      NULLIF(p_payload ->> 'pd_right', '')::numeric, NULLIF(p_payload ->> 'pd_left', '')::numeric,
      NULLIF(p_payload ->> 'height_right', '')::numeric, NULLIF(p_payload ->> 'height_left', '')::numeric,
      v_frame, v_frame_name, NULLIF(btrim(p_payload ->> 'frame_note'), ''), v_supplier,
      NULLIF(btrim(p_payload ->> 'lab_reference'), ''), NULLIF(p_payload ->> 'required_by', '')::date,
      NULLIF(btrim(p_payload ->> 'notes'), ''), auth.uid(), auth.uid()
    )
    RETURNING id INTO v_id;
    INSERT INTO public.optometry_lab_order_events (order_id, practice_id, patient_id, status, happened_on, changed_by)
    VALUES (v_id, v_practice, v_rx.patient_id, 'ordered', v_today, auth.uid());
    RETURN jsonb_build_object('id', v_id, 'order_no', v_no, 'created', true);
  END IF;

  UPDATE public.optometry_lab_orders
     SET visit_id = v_visit, prescription_id = v_rx.id, eyes = v_eyes, lens_type = v_type, material = NULLIF(p_payload ->> 'material', ''),
         coatings = v_coatings, tint_percent = NULLIF(p_payload ->> 'tint_percent', '')::smallint,
         tint_colour = NULLIF(btrim(p_payload ->> 'tint_colour'), ''),
         pd_right = NULLIF(p_payload ->> 'pd_right', '')::numeric, pd_left = NULLIF(p_payload ->> 'pd_left', '')::numeric,
         height_right = NULLIF(p_payload ->> 'height_right', '')::numeric, height_left = NULLIF(p_payload ->> 'height_left', '')::numeric,
         frame_item_id = v_frame, frame_name = v_frame_name, frame_note = NULLIF(btrim(p_payload ->> 'frame_note'), ''),
         supplier_id = v_supplier, lab_reference = NULLIF(btrim(p_payload ->> 'lab_reference'), ''),
         required_by = NULLIF(p_payload ->> 'required_by', '')::date, notes = NULLIF(btrim(p_payload ->> 'notes'), ''),
         updated_by = auth.uid(), updated_at = now()
   WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'order_no', v_existing.order_no, 'created', false);
END
$$;

-- 8k. optometry_lab_order_set_status(order, status, reason?, on?): the next step of an order, dated
--     today or the day it happened (not before the last step). The steps are NEXT_LAB_STATUSES in
--     src/utils/optometry/labOrders.ts; a remake or a cancellation says why. Any staff member.
CREATE OR REPLACE FUNCTION public.optometry_lab_order_set_status(p_order_id uuid, p_status text, p_reason text DEFAULT NULL, p_on date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_order public.optometry_lab_orders%ROWTYPE;
  v_on date := COALESCE(p_on, public.optometry_today());
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_allowed boolean;
BEGIN
  SELECT * INTO v_order FROM public.optometry_lab_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lab order not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.optometry_practice_for(v_order.patient_id, false);
  v_allowed := CASE v_order.status
    WHEN 'ordered' THEN p_status IN ('received', 'cancelled')
    WHEN 'received' THEN p_status IN ('fitted', 'collected', 'remake')
    WHEN 'fitted' THEN p_status IN ('collected', 'remake')
    WHEN 'collected' THEN p_status = 'remake'
    WHEN 'remake' THEN p_status IN ('received', 'cancelled')
    ELSE false
  END;
  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'Order % is % and cannot be marked % now', v_order.order_no, replace(v_order.status, '_', ' '), replace(COALESCE(p_status, ''), '_', ' ')
      USING ERRCODE = '22023';
  END IF;
  IF p_status IN ('remake', 'cancelled') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Say why the order is %', CASE p_status WHEN 'remake' THEN 'sent for a remake' ELSE 'cancelled' END USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_reason, '')) > 200 THEN
    RAISE EXCEPTION 'Keep the reason to 200 characters' USING ERRCODE = '22023';
  END IF;
  IF v_on > public.optometry_today() OR v_on < v_order.status_on THEN
    RAISE EXCEPTION 'Choose a day from % (the last step) to today', to_char(v_order.status_on, 'FMDD Mon YYYY') USING ERRCODE = '22023';
  END IF;

  UPDATE public.optometry_lab_orders
     SET status = p_status, status_on = v_on, updated_by = auth.uid(), updated_at = now()
   WHERE id = p_order_id;
  INSERT INTO public.optometry_lab_order_events (order_id, practice_id, patient_id, status, from_status, reason, happened_on, changed_by)
  VALUES (p_order_id, v_order.practice_id, v_order.patient_id, p_status, v_order.status, v_reason, v_on, auth.uid());
  RETURN jsonb_build_object('status', p_status, 'status_on', v_on);
END
$$;

-- 8l. optometry_cl_supply_save({patient_id, prescription_id?, lens_name, replacement, lenses_per_eye,
--     supplier_id?, status ('ordered' | 'collected'), collected_on?, runs_out_on?, notes?}): lenses
--     ordered for the patient, or handed over now (with the day they run out, which the app works out).
--     Returns the id. Any staff member.
CREATE OR REPLACE FUNCTION public.optometry_cl_supply_save(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_patient uuid := NULLIF(p_payload ->> 'patient_id', '')::uuid;
  v_rx uuid := NULLIF(p_payload ->> 'prescription_id', '')::uuid;
  v_supplier uuid := NULLIF(p_payload ->> 'supplier_id', '')::uuid;
  v_status text := COALESCE(NULLIF(p_payload ->> 'status', ''), 'collected');
  v_collected date := NULLIF(p_payload ->> 'collected_on', '')::date;
  v_practice uuid;
  v_id uuid;
BEGIN
  v_practice := public.optometry_practice_for(v_patient, false);
  IF v_status NOT IN ('ordered', 'collected') THEN
    RAISE EXCEPTION 'A new supply is either ordered from the supplier or handed to the patient' USING ERRCODE = '22023';
  END IF;
  IF v_rx IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.optometry_prescriptions r
     WHERE r.id = v_rx AND r.patient_id = v_patient AND r.kind = 'contact_lenses' AND r.voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Choose one of the patient''s current contact-lens prescriptions' USING ERRCODE = '22023';
  END IF;
  IF v_supplier IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.stock_suppliers s WHERE s.id = v_supplier AND s.practice_id = v_practice) THEN
    RAISE EXCEPTION 'Choose one of your practice''s suppliers' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'collected' AND (v_collected IS NULL OR v_collected > public.optometry_today()) THEN
    RAISE EXCEPTION 'Give the day the patient got the lenses (not a day still to come)' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.optometry_cl_supplies (
    practice_id, patient_id, prescription_id, lens_name, replacement, lenses_per_eye, supplier_id, status,
    ordered_on, collected_on, runs_out_on, notes, created_by, updated_by
  ) VALUES (
    v_practice, v_patient, v_rx, NULLIF(btrim(p_payload ->> 'lens_name'), ''), NULLIF(p_payload ->> 'replacement', ''),
    NULLIF(p_payload ->> 'lenses_per_eye', '')::smallint, v_supplier, v_status,
    CASE WHEN v_status = 'ordered' THEN public.optometry_today() END,
    CASE WHEN v_status = 'collected' THEN v_collected END,
    CASE WHEN v_status = 'collected' THEN NULLIF(p_payload ->> 'runs_out_on', '')::date END,
    NULLIF(btrim(p_payload ->> 'notes'), ''), auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

-- 8m. optometry_cl_supply_set_status(supply, status, on?, runs_out_on?, reason?): an ordered supply
--     arrives, is collected (with the day it runs out) or is cancelled (with why). Any staff member.
CREATE OR REPLACE FUNCTION public.optometry_cl_supply_set_status(
  p_supply_id uuid, p_status text, p_on date DEFAULT NULL, p_runs_out_on date DEFAULT NULL, p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_supply public.optometry_cl_supplies%ROWTYPE;
  v_on date := COALESCE(p_on, public.optometry_today());
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  SELECT * INTO v_supply FROM public.optometry_cl_supplies WHERE id = p_supply_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact-lens supply not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.optometry_practice_for(v_supply.patient_id, false);
  IF NOT ((v_supply.status = 'ordered' AND p_status IN ('received', 'collected', 'cancelled'))
       OR (v_supply.status = 'received' AND p_status IN ('collected', 'cancelled'))) THEN
    RAISE EXCEPTION 'This supply is % and cannot be marked % now', v_supply.status, COALESCE(p_status, '') USING ERRCODE = '22023';
  END IF;
  IF v_on > public.optometry_today() OR v_on < COALESCE(v_supply.received_on, v_supply.ordered_on, v_on) THEN
    RAISE EXCEPTION 'Choose a day from the order to today' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'collected' AND (p_runs_out_on IS NULL OR p_runs_out_on <= v_on) THEN
    RAISE EXCEPTION 'Give the day the lenses run out (after the day they were collected)' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'cancelled' AND (v_reason IS NULL OR char_length(v_reason) > 200) THEN
    RAISE EXCEPTION 'Say in a few words why the supply is cancelled' USING ERRCODE = '22023';
  END IF;
  UPDATE public.optometry_cl_supplies
     SET status = p_status,
         received_on = CASE WHEN p_status = 'received' THEN v_on ELSE received_on END,
         collected_on = CASE WHEN p_status = 'collected' THEN v_on ELSE collected_on END,
         runs_out_on = CASE WHEN p_status = 'collected' THEN p_runs_out_on ELSE runs_out_on END,
         cancelled_on = CASE WHEN p_status = 'cancelled' THEN v_on ELSE cancelled_on END,
         cancel_reason = CASE WHEN p_status = 'cancelled' THEN v_reason ELSE cancel_reason END,
         updated_by = auth.uid(), updated_at = now()
   WHERE id = p_supply_id;
END
$$;

-- 8n. optometry_save_frame(item, frame): a frame is saved as a stock item by the stock module's own
--     stock_save_item (its checks and roles: admins, practitioners and nurses), always in the "Frames"
--     group, then its brand, model, colour and size. Returns stock_save_item's {id, created}.
CREATE OR REPLACE FUNCTION public.optometry_save_frame(p_item jsonb, p_frame jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_brand text := NULLIF(btrim(p_frame ->> 'brand'), '');
  v_model text := NULLIF(btrim(p_frame ->> 'model'), '');
  v_result jsonb;
  v_id uuid;
  v_practice uuid;
BEGIN
  IF v_brand IS NULL OR v_model IS NULL THEN
    RAISE EXCEPTION 'A frame needs its brand and model' USING ERRCODE = '22023';
  END IF;
  v_result := public.stock_save_item(COALESCE(p_item, '{}'::jsonb) || jsonb_build_object('item_group', 'Frames', 'category', 'other'));
  v_id := (v_result ->> 'id')::uuid;
  SELECT i.practice_id INTO v_practice FROM public.practice_inventory i WHERE i.id = v_id;
  INSERT INTO public.optometry_frames AS f (item_id, practice_id, brand, model, colour, size, updated_by)
  VALUES (v_id, v_practice, v_brand, v_model, NULLIF(btrim(p_frame ->> 'colour'), ''), NULLIF(btrim(p_frame ->> 'size'), ''), auth.uid())
  ON CONFLICT (item_id) DO UPDATE SET
    brand = EXCLUDED.brand, model = EXCLUDED.model, colour = EXCLUDED.colour, size = EXCLUDED.size,
    updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN v_result;
END
$$;

-- 8o. optometry_save_fund_note(practice, {id?, fund_reference, plan_option?, note, limit_amount?,
--     cycle_months?}) and optometry_delete_fund_note(id): the practice's optical benefit notes. Practice
--     admins.
CREATE OR REPLACE FUNCTION public.optometry_save_fund_note(p_practice_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := NULLIF(p_payload ->> 'id', '')::uuid;
  v_practice uuid := p_practice_id;
  v_fund text := upper(btrim(COALESCE(p_payload ->> 'fund_reference', '')));
  v_option text := NULLIF(btrim(p_payload ->> 'plan_option'), '');
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT n.practice_id INTO v_practice FROM public.optometry_fund_notes n WHERE n.id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Note not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  PERFORM public.optometry_staff_of(v_practice, ARRAY['admin']);
  IF EXISTS (
    SELECT 1 FROM public.optometry_fund_notes n
     WHERE n.practice_id = v_practice AND n.fund_reference = v_fund AND lower(COALESCE(n.plan_option, '')) = lower(COALESCE(v_option, ''))
       AND n.id IS DISTINCT FROM v_id
  ) THEN
    RAISE EXCEPTION 'There is already a note for this fund and option: change that one' USING ERRCODE = '23505';
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.optometry_fund_notes (practice_id, fund_reference, plan_option, note, limit_amount, cycle_months, updated_by)
    VALUES (v_practice, v_fund, v_option, btrim(COALESCE(p_payload ->> 'note', '')), NULLIF(p_payload ->> 'limit_amount', '')::numeric,
            NULLIF(p_payload ->> 'cycle_months', '')::smallint, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.optometry_fund_notes
       SET fund_reference = v_fund, plan_option = v_option, note = btrim(COALESCE(p_payload ->> 'note', '')),
           limit_amount = NULLIF(p_payload ->> 'limit_amount', '')::numeric, cycle_months = NULLIF(p_payload ->> 'cycle_months', '')::smallint,
           updated_by = auth.uid(), updated_at = now()
     WHERE id = v_id;
  END IF;
  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION public.optometry_delete_fund_note(p_note_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid;
BEGIN
  SELECT n.practice_id INTO v_practice FROM public.optometry_fund_notes n WHERE n.id = p_note_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.optometry_staff_of(v_practice, ARRAY['admin']);
  DELETE FROM public.optometry_fund_notes WHERE id = p_note_id;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Claim fields 45-47 (QEDI specification sections 33-35). The app writes the same strings
--    (src/utils/optometry/claimFields.ts; section 13 checks both agree on one prescription).
-- ---------------------------------------------------------------------------------------------

-- 9a. A dioptre as field 46 writes it: sign always, two digits before the point ("+01.25", "-10.00")
CREATE OR REPLACE FUNCTION public.optometry_claim_dioptre(p_value numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_value < 0 THEN '-' ELSE '+' END || to_char(abs(p_value), 'FM00.00')
$$;

-- 9b. The three fields for a visit of a practice: from the visit's lab order (its prescription and its
--     tint) or else the visit's latest spectacle prescription. Nothing when there is neither.
CREATE OR REPLACE FUNCTION public.optometry_claim_fields(p_visit_id uuid, p_practice_id uuid)
RETURNS TABLE (reading_additions text, lens_prescription text, density_of_tint text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_order public.optometry_lab_orders%ROWTYPE;
  v_rx public.optometry_prescriptions%ROWTYPE;
BEGIN
  SELECT o.* INTO v_order
  FROM public.optometry_lab_orders o
  WHERE o.visit_id = p_visit_id AND o.practice_id = p_practice_id AND o.status <> 'cancelled'
  ORDER BY o.created_at DESC
  LIMIT 1;
  IF v_order.id IS NOT NULL THEN
    SELECT r.* INTO v_rx FROM public.optometry_prescriptions r WHERE r.id = v_order.prescription_id AND r.voided_at IS NULL;
  ELSE
    SELECT r.* INTO v_rx
    FROM public.optometry_prescriptions r
    WHERE r.visit_id = p_visit_id AND r.practice_id = p_practice_id AND r.kind = 'spectacles' AND r.voided_at IS NULL
    ORDER BY r.prescribed_on DESC, r.recorded_at DESC
    LIMIT 1;
  END IF;
  IF v_rx.id IS NULL THEN
    RETURN;
  END IF;
  reading_additions := NULLIF(
    CASE WHEN v_rx.r_add IS NULL THEN '' ELSE 'R' || to_char(v_rx.r_add, 'FM0.00') END ||
    CASE WHEN v_rx.l_add IS NULL THEN '' ELSE 'L' || to_char(v_rx.l_add, 'FM0.00') END, '');
  -- "No cylinder" is written -00.00 with axis 000, as in the specification's own example
  lens_prescription :=
    'R' || public.optometry_claim_dioptre(v_rx.r_sphere) ||
    CASE WHEN v_rx.r_cylinder IS NULL THEN '-00.00X000'
         ELSE public.optometry_claim_dioptre(v_rx.r_cylinder) || 'X' || to_char(COALESCE(v_rx.r_axis, 0), 'FM000') END ||
    'L' || public.optometry_claim_dioptre(v_rx.l_sphere) ||
    CASE WHEN v_rx.l_cylinder IS NULL THEN '-00.00X000'
         ELSE public.optometry_claim_dioptre(v_rx.l_cylinder) || 'X' || to_char(COALESCE(v_rx.l_axis, 0), 'FM000') END;
  density_of_tint := CASE WHEN v_order.tint_percent IS NULL THEN NULL ELSE
    CASE WHEN v_order.eyes <> 'left' THEN 'R' || v_order.tint_percent ELSE '' END ||
    CASE WHEN v_order.eyes <> 'right' THEN 'L' || v_order.tint_percent ELSE '' END END;
  RETURN NEXT;
END
$$;

-- 9c. Every new claim line of a visit gets the fields (only from the batch's own practice's records;
--     values already on the line are kept). sync_invoice_to_batch itself is unchanged.
CREATE OR REPLACE FUNCTION public.optometry_fill_claim_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid;
  v_fields record;
BEGIN
  IF NEW.visit_id IS NULL OR (NULLIF(NEW.reading_additions, '') IS NOT NULL AND NULLIF(NEW.lens_prescription, '') IS NOT NULL
                              AND NULLIF(NEW.density_of_tint, '') IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  SELECT h.practice_id INTO v_practice FROM public.batch_headers h WHERE h.id = NEW.batch_header_id;
  IF v_practice IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT f.* INTO v_fields FROM public.optometry_claim_fields(NEW.visit_id, v_practice) f;
  IF FOUND THEN
    NEW.reading_additions := COALESCE(NULLIF(NEW.reading_additions, ''), v_fields.reading_additions);
    NEW.lens_prescription := COALESCE(NULLIF(NEW.lens_prescription, ''), v_fields.lens_prescription);
    NEW.density_of_tint := COALESCE(NULLIF(NEW.density_of_tint, ''), v_fields.density_of_tint);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS optometry_claim_fields ON public.batch_details;
CREATE TRIGGER optometry_claim_fields BEFORE INSERT ON public.batch_details
  FOR EACH ROW EXECUTE FUNCTION public.optometry_fill_claim_fields();

-- ---------------------------------------------------------------------------------------------
-- 10. Patient lists: patient_list_facts() also returns contact_lenses_run_out_on (the day the
--     patient's contact lenses run out: the latest run-out day of the supplies they collected) for
--     the "Contact lenses running out" list. The body is proposals/2026-10-07-dispensing-and-stock.sql
--     section 18 unchanged plus the "cl_due" part; the rule itself is in
--     src/utils/patientLists/listRules.ts. Recreated because the columns it returns change.
-- ---------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.patient_list_facts(uuid, date, uuid[]);
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
  last_billed_by_code jsonb,
  completed_visits_12m integer,
  next_booking_on date,
  next_booking_time text,
  last_no_show_on date,
  balance_due numeric,
  oldest_unpaid_on date,
  next_repeat_due_on date,
  contact_lenses_run_out_on date
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
         cl.contact_lenses_run_out_on
  FROM pts
  LEFT JOIN visit_facts vf ON vf.pid = pts.pid
  LEFT JOIN by_type bt ON bt.pid = pts.pid
  LEFT JOIN by_code bc ON bc.pid = pts.pid
  LEFT JOIN next_time nt ON nt.pid = pts.pid
  LEFT JOIN owed ow ON ow.pid = pts.pid
  LEFT JOIN repeat_due rd ON rd.pid = pts.pid
  LEFT JOIN cl_due cl ON cl.pid = pts.pid
  ORDER BY pts.last_name, pts.first_name, pts.pid;
END
$$;
COMMENT ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) IS
  'Facts per patient for patient lists (visits, bookings, no-shows, balance owed, next repeat due, contact lenses running out). Rules are applied in src/utils/patientLists/listRules.ts.';
REVOKE ALL ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_list_facts(uuid, date, uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 11. Row level security and grants: active staff of the practice read; nobody writes except through
--     the functions above (and the service role)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.optometry_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_lab_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_cl_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_fund_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS optometry_exams_staff_read ON public.optometry_exams;
CREATE POLICY optometry_exams_staff_read ON public.optometry_exams FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_exams.practice_id));

DROP POLICY IF EXISTS optometry_prescriptions_staff_read ON public.optometry_prescriptions;
CREATE POLICY optometry_prescriptions_staff_read ON public.optometry_prescriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_prescriptions.practice_id));

DROP POLICY IF EXISTS optometry_lab_orders_staff_read ON public.optometry_lab_orders;
CREATE POLICY optometry_lab_orders_staff_read ON public.optometry_lab_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_lab_orders.practice_id));

DROP POLICY IF EXISTS optometry_lab_order_events_staff_read ON public.optometry_lab_order_events;
CREATE POLICY optometry_lab_order_events_staff_read ON public.optometry_lab_order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_lab_order_events.practice_id));

DROP POLICY IF EXISTS optometry_cl_supplies_staff_read ON public.optometry_cl_supplies;
CREATE POLICY optometry_cl_supplies_staff_read ON public.optometry_cl_supplies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_cl_supplies.practice_id));

DROP POLICY IF EXISTS optometry_frames_staff_read ON public.optometry_frames;
CREATE POLICY optometry_frames_staff_read ON public.optometry_frames FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_frames.practice_id));

DROP POLICY IF EXISTS optometry_fund_notes_staff_read ON public.optometry_fund_notes;
CREATE POLICY optometry_fund_notes_staff_read ON public.optometry_fund_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_fund_notes.practice_id));

REVOKE ALL ON public.optometry_exams, public.optometry_prescriptions, public.optometry_lab_orders, public.optometry_lab_order_events,
  public.optometry_cl_supplies, public.optometry_frames, public.optometry_fund_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.optometry_exams, public.optometry_prescriptions, public.optometry_lab_orders, public.optometry_lab_order_events,
  public.optometry_cl_supplies, public.optometry_frames, public.optometry_fund_notes TO authenticated;
GRANT ALL ON public.optometry_exams, public.optometry_prescriptions, public.optometry_lab_orders, public.optometry_lab_order_events,
  public.optometry_cl_supplies, public.optometry_frames, public.optometry_fund_notes TO service_role;
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated',
    pg_get_serial_sequence('public.optometry_lab_order_events', 'id'));
END
$$;

-- Internal: membership checks, the prescription helpers and the claim fields
REVOKE ALL ON FUNCTION public.optometry_practice_for(uuid, boolean), public.optometry_staff_of(uuid, text[]),
  public.optometry_rx_values(jsonb), public.optometry_insert_rx(uuid, uuid, uuid, uuid, text, date, jsonb),
  public.optometry_rx_differs(uuid, jsonb), public.optometry_void_rx(uuid, text), public.optometry_claim_dioptre(numeric),
  public.optometry_claim_fields(uuid, uuid), public.optometry_fill_claim_fields() FROM PUBLIC, anon, authenticated;
-- Pure helpers the table checks use (the service role writes directly)
REVOKE ALL ON FUNCTION public.optometry_today(), public.optometry_va_ok(text), public.optometry_va(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.optometry_today(), public.optometry_va_ok(text), public.optometry_va(text) TO authenticated, service_role;
-- What the app calls
REVOKE ALL ON FUNCTION public.optometry_save_exam(jsonb), public.optometry_save_prescription(jsonb),
  public.optometry_void_prescription(uuid, text), public.optometry_lab_order_save(jsonb),
  public.optometry_lab_order_set_status(uuid, text, text, date), public.optometry_cl_supply_save(jsonb),
  public.optometry_cl_supply_set_status(uuid, text, date, date, text), public.optometry_save_frame(jsonb, jsonb),
  public.optometry_save_fund_note(uuid, jsonb), public.optometry_delete_fund_note(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.optometry_save_exam(jsonb), public.optometry_save_prescription(jsonb),
  public.optometry_void_prescription(uuid, text), public.optometry_lab_order_save(jsonb),
  public.optometry_lab_order_set_status(uuid, text, text, date), public.optometry_cl_supply_save(jsonb),
  public.optometry_cl_supply_set_status(uuid, text, date, date, text), public.optometry_save_frame(jsonb, jsonb),
  public.optometry_save_fund_note(uuid, jsonb), public.optometry_delete_fund_note(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 12. With the patient portal applied: patient-app logins get nothing from the new tables either
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.portal_apply_staff_guard()') IS NOT NULL THEN
    PERFORM public.portal_apply_staff_guard();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 13. Checks
-- ---------------------------------------------------------------------------------------------

-- 13a. Row level security is on, one staff read policy per table and none for anon; signed-in users may
--      read but not write; anon may not run the functions; the internal ones are internal; the claim
--      formats agree with the app's (src/utils/optometry/__tests__/claimFields.test.ts uses the same values)
DO $$
DECLARE
  t text;
  v_count integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['optometry_exams', 'optometry_prescriptions', 'optometry_lab_orders', 'optometry_lab_order_events',
                           'optometry_cl_supplies', 'optometry_frames', 'optometry_fund_notes'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', t)::regclass) THEN
      RAISE EXCEPTION '%: row level security is off', t;
    END IF;
    SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname LIKE t || '\_%';
    IF v_count <> 1 THEN
      RAISE EXCEPTION '%: expected 1 staff policy, found %', t, v_count;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND 'anon' = ANY (roles)) THEN
      RAISE EXCEPTION '%: a policy is open to anon', t;
    END IF;
    IF NOT has_table_privilege('authenticated', format('public.%I', t), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', t), 'DELETE')
       OR has_table_privilege('anon', format('public.%I', t), 'SELECT') THEN
      RAISE EXCEPTION '%: signed-in users must read only, anon nothing', t;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.optometry_save_exam(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.optometry_lab_order_set_status(uuid, text, text, date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.optometry_practice_for(uuid, boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.optometry_insert_rx(uuid, uuid, uuid, uuid, text, date, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.optometry_claim_fields(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'optometry functions: anon may not run them, and the checks and helpers are internal';
  END IF;
  IF public.optometry_claim_dioptre(1.25) <> '+01.25' OR public.optometry_claim_dioptre(-10) <> '-10.00'
     OR public.optometry_claim_dioptre(0) <> '+00.00' OR public.optometry_claim_dioptre(0.25) <> '+00.25' THEN
    RAISE EXCEPTION 'optometry_claim_dioptre does not write dioptres as the app does';
  END IF;
  IF NOT public.optometry_va_ok('6/9+2') OR NOT public.optometry_va_ok('NLP') OR public.optometry_va_ok('6/0')
     OR public.optometry_va('6 / 9 +2') <> '6/9+2' THEN
    RAISE EXCEPTION 'optometry_va_ok does not accept the same acuities as the app';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.batch_details'::regclass AND tgname = 'optometry_claim_fields' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'the claim-fields trigger on batch_details is missing or disabled';
  END IF;
END $$;

-- 13b. Behaviour, as signed-in users of one practice with a patient and a visit (a practitioner, and
--      reception when there is one), a staff member of another practice, a login without a staff
--      profile and the anon key. Runs inside a block that undoes itself: nothing is left behind, also
--      when this file ends in COMMIT (the simulated sign-ins end with the block).
DO $$
DECLARE
  v_practice uuid;
  v_clinician uuid;
  v_clinician_role text;
  v_receptionist uuid;
  v_other uuid;
  v_patient uuid;
  v_visit uuid;
  v_supplier uuid;
  v_header uuid;
  v_result jsonb;
  v_spectacles uuid;
  v_first uuid;
  v_contact uuid;
  v_plain uuid;
  v_frame uuid;
  v_order uuid;
  v_order2 uuid;
  v_supply uuid;
  v_line uuid;
  v_count integer;
  v_text text;
  v_date date;
  v_today date := public.optometry_today();
  v_exam jsonb;
  v_refraction jsonb := jsonb_build_object('valid_until', (public.optometry_today() + 730)::text,
    'right', jsonb_build_object('sphere', -1.25, 'cylinder', -0.5, 'axis', 90, 'add', 2, 'va', '6/6'),
    'left', jsonb_build_object('sphere', -1, 'cylinder', -0.75, 'axis', 180, 'add', 2, 'va', '6/6'));
BEGIN
  SELECT u.practice_id, u.id, u.role INTO v_practice, v_clinician, v_clinician_role
  FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.role IN ('doctor', 'nurse', 'admin') AND u.practice_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.visits v JOIN public.patients p ON p.id = v.patient_id WHERE p.practice_id = u.practice_id)
  ORDER BY u.id
  LIMIT 1;
  SELECT v.patient_id, v.id INTO v_patient, v_visit
  FROM public.visits v JOIN public.patients p ON p.id = v.patient_id
  WHERE p.practice_id = v_practice
  ORDER BY v.id
  LIMIT 1;
  SELECT u.id INTO v_receptionist FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.role = 'receptionist' AND u.practice_id = v_practice ORDER BY u.id LIMIT 1;
  SELECT u.id INTO v_other FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.practice_id IS NOT NULL AND u.practice_id <> v_practice ORDER BY u.id LIMIT 1;
  IF v_visit IS NULL OR v_other IS NULL THEN
    RAISE NOTICE 'No practice with a practitioner, a visit and staff elsewhere: behaviour checks skipped';
    RETURN;
  END IF;

  BEGIN
    -- A lab (supplier) and a claim batch of the practice to test with
    INSERT INTO public.stock_suppliers (practice_id, name) VALUES (v_practice, 'Check optical lab') RETURNING id INTO v_supplier;
    INSERT INTO public.batch_headers (practice_id, practice_number, batch_number, batch_date, medical_aid_reference)
    VALUES (v_practice, 'CHECK', 1, v_today, 'CHKOPT') RETURNING id INTO v_header;

    -- The practitioner records the exam: vision, pressure, fields, the refraction and a contact-lens fit
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_clinician, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    v_exam := jsonb_build_object('visit_id', v_visit, 'va_unaided_r', '6/18', 'va_unaided_l', '6/24', 'iop_r', 14, 'iop_l', 15,
      'iop_method', 'non_contact', 'iop_time', '09:30', 'fields_result', 'normal', 'refraction', v_refraction,
      'contact_lens_rx', jsonb_build_object('lens_name', 'Check monthly lens',
        'right', jsonb_build_object('sphere', -1.25, 'base_curve', 8.6, 'diameter', 14.2),
        'left', jsonb_build_object('sphere', -1, 'base_curve', 8.6, 'diameter', 14.2)));
    v_result := public.optometry_save_exam(v_exam);
    v_first := (v_result ->> 'spectacles')::uuid;
    v_contact := (v_result ->> 'contact_lenses')::uuid;
    IF v_first IS NULL OR v_contact IS NULL
       OR (SELECT count(*) FROM public.optometry_exams WHERE patient_id = v_patient) <> 1
       OR (SELECT count(*) FROM public.optometry_prescriptions WHERE patient_id = v_patient) <> 2 THEN
      RAISE EXCEPTION 'check failed: the practitioner does not see the exam and its 2 prescriptions';
    END IF;

    -- Saved again unchanged, the prescription stays; a changed refraction replaces it and keeps the old one
    IF (public.optometry_save_exam(v_exam) ->> 'spectacles')::uuid IS DISTINCT FROM v_first THEN
      RAISE EXCEPTION 'check failed: saving an unchanged exam replaced its prescription';
    END IF;
    v_result := public.optometry_save_exam(jsonb_set(v_exam, '{refraction,right,sphere}', '-1.5'));
    v_spectacles := (v_result ->> 'spectacles')::uuid;
    SELECT void_reason INTO v_text FROM public.optometry_prescriptions WHERE id = v_first;
    IF v_spectacles = v_first OR v_text IS DISTINCT FROM 'Changed at the eye exam'
       OR (SELECT count(*) FROM public.optometry_prescriptions WHERE patient_id = v_patient AND kind = 'spectacles' AND voided_at IS NULL) <> 1 THEN
      RAISE EXCEPTION 'check failed: a changed refraction did not replace the prescription (and keep the old one)';
    END IF;

    -- Direct writes are refused: everything goes through the functions
    BEGIN
      INSERT INTO public.optometry_prescriptions (practice_id, patient_id, kind, prescribed_on, r_sphere, l_sphere)
      VALUES (v_practice, v_patient, 'spectacles', v_today, 0, 0);
      RAISE EXCEPTION 'check failed: a direct insert was accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- The ranges: a sphere off the quarter steps, an axis without a cylinder, a pressure without its method
    BEGIN
      PERFORM public.optometry_save_prescription(jsonb_build_object('patient_id', v_patient, 'prescribed_on', v_today,
        'right', jsonb_build_object('sphere', -1.3), 'left', jsonb_build_object('sphere', 0)));
      RAISE EXCEPTION 'check failed: a sphere of -1.30 was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.optometry_save_prescription(jsonb_build_object('patient_id', v_patient, 'prescribed_on', v_today,
        'right', jsonb_build_object('sphere', -1, 'axis', 90), 'left', jsonb_build_object('sphere', 0)));
      RAISE EXCEPTION 'check failed: an axis without a cylinder was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.optometry_save_exam(jsonb_build_object('visit_id', v_visit, 'iop_r', 14));
      RAISE EXCEPTION 'check failed: a pressure without method and time was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- A frame is a stock item in the Frames group, with its brand and model
    v_frame := (public.optometry_save_frame(
      jsonb_build_object('practice_id', v_practice, 'name', 'Check Frame C1 Black 52-18-140', 'unit', 'each', 'unit_cost', 300,
                         'opening_quantity', 1, 'barcode', 'CHKFRAME01'),
      jsonb_build_object('brand', 'Check Frame', 'model', 'C1', 'colour', 'Black', 'size', '52-18-140')) ->> 'id')::uuid;
    IF (SELECT item_group FROM public.practice_inventory WHERE id = v_frame) IS DISTINCT FROM 'Frames'
       OR NOT EXISTS (SELECT 1 FROM public.optometry_frames WHERE item_id = v_frame AND brand = 'Check Frame') THEN
      RAISE EXCEPTION 'check failed: the frame is not a stock item in the Frames group with its details';
    END IF;

    -- A multifocal lab order with heights, a tint and the frame from stock
    v_result := public.optometry_lab_order_save(jsonb_build_object('prescription_id', v_spectacles, 'visit_id', v_visit, 'eyes', 'both',
      'lens_type', 'multifocal', 'material', 'cr39', 'coatings', jsonb_build_array('anti_reflective', 'tint'), 'tint_percent', 35,
      'pd_right', 31.5, 'pd_left', 32, 'height_right', 18, 'height_left', 18, 'frame_item_id', v_frame, 'supplier_id', v_supplier));
    v_order := (v_result ->> 'id')::uuid;
    IF (v_result ->> 'order_no')::integer IS NULL
       OR (SELECT frame_name FROM public.optometry_lab_orders WHERE id = v_order) IS DISTINCT FROM 'Check Frame C1 Black 52-18-140'
       OR (SELECT count(*) FROM public.optometry_lab_order_events WHERE order_id = v_order) <> 1 THEN
      RAISE EXCEPTION 'check failed: the lab order, its frame name or its first step is missing';
    END IF;

    -- A multifocal needs the reading addition in the prescription
    v_plain := public.optometry_save_prescription(jsonb_build_object('patient_id', v_patient, 'prescribed_on', v_today,
      'outside_source', 'Check practice', 'right', jsonb_build_object('sphere', -2), 'left', jsonb_build_object('sphere', -2)));
    BEGIN
      PERFORM public.optometry_lab_order_save(jsonb_build_object('prescription_id', v_plain, 'eyes', 'both', 'lens_type', 'multifocal',
        'material', 'cr39', 'pd_right', 31, 'pd_left', 31, 'height_right', 18, 'height_left', 18, 'frame_note', 'Own frame'));
      RAISE EXCEPTION 'check failed: a multifocal without a reading addition was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    -- The steps: never straight from the lab to the patient's hands; a remake says why
    BEGIN
      PERFORM public.optometry_lab_order_set_status(v_order, 'collected');
      RAISE EXCEPTION 'check failed: an order at the lab was marked collected';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    PERFORM public.optometry_lab_order_set_status(v_order, 'received');
    BEGIN
      PERFORM public.optometry_lab_order_set_status(v_order, 'remake', ' ');
      RAISE EXCEPTION 'check failed: a remake without a reason was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    PERFORM public.optometry_lab_order_set_status(v_order, 'remake', 'Axis of the right lens out');
    PERFORM public.optometry_lab_order_set_status(v_order, 'received');
    PERFORM public.optometry_lab_order_set_status(v_order, 'collected');
    IF (SELECT count(*) FROM public.optometry_lab_order_events WHERE order_id = v_order) <> 5
       OR (SELECT status FROM public.optometry_lab_orders WHERE id = v_order) <> 'collected' THEN
      RAISE EXCEPTION 'check failed: the order''s steps were not all recorded';
    END IF;

    -- Claim fields 45-47 are filled for a claim line of the visit (the same strings the app writes)
    INSERT INTO public.batch_details (batch_header_id, visit_id, transaction_number_in_batch, medical_aid_reference, bhf_tariff_code,
      service_amount, service_date, invoice_number, practice_number, gender, patient_id_number)
    VALUES (v_header, v_visit, 1, 'CHKOPT', '0000', 1, to_char(v_today, 'YYYYMMDD'), 'CHK', 'CHECK', 'F', '0')
    RETURNING id INTO v_line;
    SELECT lens_prescription || '|' || reading_additions || '|' || density_of_tint INTO v_text FROM public.batch_details WHERE id = v_line;
    IF v_text IS DISTINCT FROM 'R-01.50-00.50X090L-01.00-00.75X180|R2.00L2.00|R35L35' THEN
      RAISE EXCEPTION 'check failed: claim fields 45-47 were %', COALESCE(v_text, 'empty');
    END IF;

    -- A prescription on an open order cannot be marked a mistake until the order is closed
    v_order2 := (public.optometry_lab_order_save(jsonb_build_object('prescription_id', v_spectacles, 'eyes', 'right',
      'lens_type', 'single_vision', 'material', 'polycarbonate', 'pd_right', 31.5, 'frame_note', 'Spare pair, own frame')) ->> 'id')::uuid;
    BEGIN
      PERFORM public.optometry_void_prescription(v_spectacles, 'Check');
      RAISE EXCEPTION 'check failed: a prescription on an open order was marked entered in error';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    PERFORM public.optometry_lab_order_set_status(v_order2, 'cancelled', 'Patient changed their mind');
    PERFORM public.optometry_void_prescription(v_plain, 'Typed for the wrong patient');

    -- Contact lenses: a supply handed over today that runs out in 10 days puts the patient on the list;
    -- a supply ordered and collected later counts from its own run-out day
    v_supply := public.optometry_cl_supply_save(jsonb_build_object('patient_id', v_patient, 'prescription_id', v_contact,
      'lens_name', 'Check monthly lens', 'replacement', 'monthly', 'lenses_per_eye', 1, 'status', 'collected',
      'collected_on', v_today, 'runs_out_on', v_today + 10));
    SELECT f.contact_lenses_run_out_on INTO v_date FROM public.patient_list_facts(v_practice, v_today, ARRAY[v_patient]) f;
    IF v_date IS DISTINCT FROM v_today + 10 THEN
      RAISE EXCEPTION 'check failed: the run-out day is not in the patient-list facts';
    END IF;
    v_supply := public.optometry_cl_supply_save(jsonb_build_object('patient_id', v_patient, 'lens_name', 'Check monthly lens',
      'replacement', 'monthly', 'lenses_per_eye', 6, 'status', 'ordered'));
    BEGIN
      PERFORM public.optometry_cl_supply_set_status(v_supply, 'collected', v_today, v_today);
      RAISE EXCEPTION 'check failed: a supply that runs out the day it was collected was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    PERFORM public.optometry_cl_supply_set_status(v_supply, 'collected', v_today, v_today + 180);
    SELECT f.contact_lenses_run_out_on INTO v_date FROM public.patient_list_facts(v_practice, v_today, ARRAY[v_patient]) f;
    IF v_date IS DISTINCT FROM v_today + 180 THEN
      RAISE EXCEPTION 'check failed: the latest run-out day does not count';
    END IF;

    -- Optical benefit notes: practice admins only
    IF v_clinician_role = 'admin' THEN
      PERFORM public.optometry_save_fund_note(v_practice, jsonb_build_object('fund_reference', 'NMC1', 'note', 'Check note', 'cycle_months', 24));
    ELSE
      BEGIN
        PERFORM public.optometry_save_fund_note(v_practice, jsonb_build_object('fund_reference', 'NMC1', 'note', 'Check note'));
        RAISE EXCEPTION 'check failed: a % saved a benefit note', v_clinician_role;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END IF;

    -- Reception sees the records and moves orders on, but does not record exams
    IF v_receptionist IS NOT NULL THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_receptionist, 'role', 'authenticated')::text, true);
      IF (SELECT count(*) FROM public.optometry_prescriptions WHERE patient_id = v_patient) <> 4 THEN
        RAISE EXCEPTION 'check failed: reception does not see the patient''s prescriptions';
      END IF;
      v_order2 := (public.optometry_lab_order_save(jsonb_build_object('prescription_id', v_spectacles, 'eyes', 'left',
        'lens_type', 'single_vision', 'material', 'cr39', 'pd_left', 32, 'frame_note', 'Own frame')) ->> 'id')::uuid;
      PERFORM public.optometry_lab_order_set_status(v_order2, 'received');
      BEGIN
        PERFORM public.optometry_save_exam(v_exam);
        RAISE EXCEPTION 'check failed: reception recorded an eye exam';
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END IF;

    -- Staff of another practice see nothing and change nothing
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
    SELECT (SELECT count(*) FROM public.optometry_exams WHERE patient_id = v_patient)
         + (SELECT count(*) FROM public.optometry_prescriptions WHERE patient_id = v_patient)
         + (SELECT count(*) FROM public.optometry_lab_orders WHERE patient_id = v_patient)
         + (SELECT count(*) FROM public.optometry_lab_order_events WHERE patient_id = v_patient)
         + (SELECT count(*) FROM public.optometry_cl_supplies WHERE patient_id = v_patient)
         + (SELECT count(*) FROM public.optometry_frames WHERE practice_id = v_practice)
         + (SELECT count(*) FROM public.optometry_fund_notes WHERE practice_id = v_practice) INTO v_count;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'check failed: staff of another practice see % optometry rows', v_count;
    END IF;
    BEGIN
      PERFORM public.optometry_lab_order_set_status(v_order, 'remake', 'Check');
      RAISE EXCEPTION 'check failed: staff of another practice changed an order';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- A login without a staff profile (a patient-app login) sees nothing and orders nothing
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    IF (SELECT count(*) FROM public.optometry_prescriptions) <> 0 OR (SELECT count(*) FROM public.optometry_lab_orders) <> 0 THEN
      RAISE EXCEPTION 'check failed: a login without a staff profile sees optometry rows';
    END IF;
    BEGIN
      PERFORM public.optometry_cl_supply_save(jsonb_build_object('patient_id', v_patient, 'lens_name', 'x', 'replacement', 'daily',
        'lenses_per_eye', 30, 'status', 'ordered'));
      RAISE EXCEPTION 'check failed: a login without a staff profile ordered lenses';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- The anon key reads nothing and runs nothing
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    PERFORM set_config('role', 'anon', true);
    BEGIN
      PERFORM count(*) FROM public.optometry_prescriptions;
      RAISE EXCEPTION 'check failed: anon read prescriptions';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.optometry_lab_order_set_status(v_order, 'remake', 'Check');
      RAISE EXCEPTION 'check failed: anon ran an optometry function';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    RAISE EXCEPTION USING MESSAGE = 'optometry_checks_passed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'optometry_checks_passed' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'optometry behaviour checked as practitioner, reception (%), other practice, no-profile login and anon (test rows undone)',
    CASE WHEN v_receptionist IS NULL THEN 'none in this practice' ELSE 'yes' END;
END $$;

-- 13c. patient_list_facts() returns every other fact exactly as before this file
DO $$
DECLARE
  v_practice uuid;
  v_missing integer;
  v_added integer;
  v_columns text := 'patient_id, first_name, last_name, date_of_birth, cell_number, sms_opt_out, last_completed_visit_on, '
    'last_completed_by_type, last_billed_by_code, completed_visits_12m, next_booking_on, next_booking_time, last_no_show_on, '
    'balance_due, oldest_unpaid_on, next_repeat_due_on';
BEGIN
  SELECT b.practice_id INTO v_practice FROM optometry_facts_before b LIMIT 1;
  IF v_practice IS NULL THEN
    RAISE NOTICE 'No patients: the patient-list facts comparison was skipped';
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE format('SELECT count(*) FROM (SELECT %s FROM optometry_facts_before EXCEPT SELECT %s FROM public.patient_list_facts(%L::uuid, %L::date)) d',
                 v_columns, v_columns, v_practice, public.optometry_today()) INTO v_missing;
  EXECUTE format('SELECT count(*) FROM (SELECT %s FROM public.patient_list_facts(%L::uuid, %L::date) EXCEPT SELECT %s FROM optometry_facts_before) d',
                 v_columns, v_practice, public.optometry_today(), v_columns) INTO v_added;
  PERFORM set_config('request.jwt.claims', '', true);
  IF v_missing <> 0 OR v_added <> 0 THEN
    RAISE EXCEPTION 'check failed: patient_list_facts() changed other facts (% rows differ, % new)', v_missing, v_added;
  END IF;
  RAISE NOTICE 'optometry ready: row level security on, the functions, their rules, the claim fields and the patient-list facts checked (test rows undone)';
END $$;

-- Change to COMMIT once reviewed (see "How to apply" at the top)
ROLLBACK;

-- =============================================================================================
-- Undo (only if needed; removes every optometry record):
--   DROP TRIGGER IF EXISTS optometry_claim_fields ON public.batch_details;
--   Recreate patient_list_facts() from proposals/2026-10-07-dispensing-and-stock.sql section 18
--     (DROP FUNCTION public.patient_list_facts(uuid, date, uuid[]) first: its columns change).
--   DROP TABLE IF EXISTS public.optometry_lab_order_events, public.optometry_lab_orders, public.optometry_cl_supplies,
--     public.optometry_prescriptions, public.optometry_exams, public.optometry_frames, public.optometry_fund_notes;
--   DROP FUNCTION IF EXISTS public.optometry_fill_claim_fields(), public.optometry_claim_fields(uuid, uuid),
--     public.optometry_claim_dioptre(numeric), public.optometry_delete_fund_note(uuid),
--     public.optometry_save_fund_note(uuid, jsonb), public.optometry_save_frame(jsonb, jsonb),
--     public.optometry_cl_supply_set_status(uuid, text, date, date, text), public.optometry_cl_supply_save(jsonb),
--     public.optometry_lab_order_set_status(uuid, text, text, date), public.optometry_lab_order_save(jsonb),
--     public.optometry_void_prescription(uuid, text), public.optometry_save_prescription(jsonb),
--     public.optometry_save_exam(jsonb), public.optometry_void_rx(uuid, text), public.optometry_rx_differs(uuid, jsonb),
--     public.optometry_insert_rx(uuid, uuid, uuid, uuid, text, date, jsonb), public.optometry_rx_values(jsonb),
--     public.optometry_staff_of(uuid, text[]), public.optometry_practice_for(uuid, boolean),
--     public.optometry_va(text), public.optometry_va_ok(text), public.optometry_today();
--   Frames stay in the stock as ordinary items of the Frames group. The Eyes tab then says "not set up
--   yet" again.
-- =============================================================================================

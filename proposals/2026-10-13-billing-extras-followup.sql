-- Applied 2026-10-13 as migration billing_extras_followup_2026_10_13 (version 20261013025106; stored statement md5 7da8d4fbf677b38dc21d9fa82f0264e0 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed (rolled back) on the demo practice with a patient of 24 visits: a payment plan's carrier (billing_carrier_visit)
-- and an opening balance's (as the Eminance import writes it) got no visit number and left every figure as it was:
-- the dashboard's encounters 3841/3841, the patient's visit count 24/24 and last visit unchanged, the merge screen 24/24,
-- Encounters' list 24/24, appointments 24/24; a real visit afterwards took number 25 and counted (3842, 25). An invented
-- patient-app login linked to the patient saw 25 appointments, none of them a carrier; the practice's administrator saw
-- only the real visit in both views, and an update through appointments reached it (1 row) but not a carrier (0 rows);
-- the public key could not call visit_is_carrier (42501). Every patched object was exactly the one piece longer, with its
-- rights and attributes, and portal_staff_only was on the seven billing extras tables.
-- =============================================================================================
-- PROPOSAL: billing extras follow-up - rows that only carry invoices are not visits
-- File:   proposals/2026-10-13-billing-extras-followup.sql                Drafted: 2026-10-13
-- Undo:   proposals/2026-10-13-billing-extras-followup-undo.sql
-- Code:   src/utils/carrierVisits.ts (the same rule for the app's own queries; a test keeps the two the same)
--
-- Why
--   Every invoice needs a visit (invoices_enhanced.visit_id is required), so payment plan instalments, prepaid package
--   sales (proposals/2026-10-13-billing-extras.sql) and opening balances brought over from Eminance
--   (proposals/2026-10-07-eminance-import.sql) hang on a row the system makes: cancelled, not scheduled, noted "Not a
--   consultation", automation_source 'system'. Only those two features write 'system' (checked 2026-10-13: the other
--   value in use is 'template', the follow-up automation's real bookings). These rows must not count anywhere visits
--   are counted.
--
-- What it does
--   1. public.visit_is_carrier(automation_source): the one rule (automation_source is 'system'). The column's comment
--      says so.
--   2. Visit numbers: generate_visit_number gives such a row no number, so it never takes one from the patient's visits.
--   3. Counts and lists that included them now leave them out, each through visit_is_carrier:
--        get_dashboard_stats (the dashboard's encounter figures), get_patient_visit_counts (the data fetcher's visit
--        count and last visit), patient_record_counts (the merge screen's visits), portal_appointments (the patient
--        app's appointments), encounters_view (Encounters' list and numbering) and the appointments view.
--      Each is patched in place: the text it was written against is checked first (md5), one exact piece is added,
--      and the result is checked to be exactly that, so owner, rights, SECURITY DEFINER, search_path and view options
--      stay as they were.
--   Already safe, unchanged (cancelled visits never count there): patient_recall_status (recalls "recalled but not
--   seen"), patient_list_facts (smart lists: last visit, lapsed, no-shows, next booking), the diary and its report
--   (bookings by scheduled date), no-shows (the missed-appointment note). Not changed because nothing reads them:
--   patient_visit_stats, today_visits_view, dashboard_stats_mv, patient_location_density, get_dashboard_data_bundle,
--   get_appointment_stats, get_patient_activity_status.
--   4. Checks, including the patient app's RESTRICTIVE portal_staff_only policy on the seven billing extras tables
--      (made by proposals/2026-10-13-billing-extras.sql section 7, as proposals/2026-10-12-referrals-and-authorisations.sql
--      section 8 does).
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; followed by tests that end in RAISE EXCEPTION), then
-- apply that part as one migration. Needs proposals/2026-10-13-billing-extras.sql. The app's own queries leave these
-- rows out with or without this file (src/utils/carrierVisits.ts filters on the column, which exists already).
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.billing_carrier_visit(uuid, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Apply proposals/2026-10-13-billing-extras.sql first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'automation_source') THEN
    RAISE EXCEPTION 'visits.automation_source is missing';
  END IF;
  IF to_regclass('public.appointments') IS NULL OR to_regclass('public.encounters_view') IS NULL THEN
    RAISE EXCEPTION 'The appointments or encounters_view view is missing';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The rule
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.visit_is_carrier(p_automation_source text)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$ SELECT p_automation_source IS NOT DISTINCT FROM 'system' $$;

COMMENT ON FUNCTION public.visit_is_carrier(text) IS
  'A visit row that only carries invoices (payment plan instalments, package sales, Eminance opening balances): '
  'automation_source ''system''. Not a visit: no visit count includes it. The app''s twin: src/utils/carrierVisits.ts';

REVOKE ALL ON FUNCTION public.visit_is_carrier(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visit_is_carrier(text) TO authenticated, service_role;

COMMENT ON COLUMN public.visits.automation_source IS
  'Source of the visit creation: manual (user created), template (follow-up automation), system (a row the system made '
  'only to carry invoices: payment plan instalments, package sales, Eminance opening balances; not a visit, so no visit '
  'count includes it: public.visit_is_carrier)';

-- ---------------------------------------------------------------------------------------------
-- 2 and 3. Patches: each object is checked against the text this file was written for, gets one exact piece, and
--          is recreated from its own definition (same owner, rights and attributes)
-- ---------------------------------------------------------------------------------------------
CREATE TEMP TABLE billing_followup_patches (
  object text PRIMARY KEY, kind text NOT NULL, before_text text NOT NULL, before_acl text, before_options text,
  piece_from text NOT NULL, piece_to text NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.billing_followup_patch(p_object text, p_kind text, p_md5 text, p_from text, p_to text)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_text text;
  v_def text;
  v_acl text;
  v_options text;
BEGIN
  IF p_kind = 'function' THEN
    SELECT p.prosrc, pg_get_functiondef(p.oid), p.proacl::text,
           concat_ws('|', p.prosecdef::text, p.provolatile::text, array_to_string(p.proconfig, ','))
      INTO v_text, v_def, v_acl, v_options
      FROM pg_proc p WHERE p.oid = p_object::regprocedure;
  ELSE
    SELECT pg_get_viewdef(c.oid, true), c.relacl::text, array_to_string(c.reloptions, ', ')
      INTO v_text, v_acl, v_options
      FROM pg_class c WHERE c.oid = p_object::regclass;
  END IF;
  IF md5(v_text) <> p_md5 THEN
    RAISE EXCEPTION '% changed since this file was written (md5 %); read it again', p_object, md5(v_text);
  END IF;
  IF (length(v_text) - length(replace(v_text, p_from, ''))) / length(p_from) <> 1 THEN
    RAISE EXCEPTION 'The piece to patch is not in % exactly once', p_object;
  END IF;
  INSERT INTO billing_followup_patches VALUES (p_object, p_kind, v_text, v_acl, v_options, p_from, p_to);
  IF p_kind = 'function' THEN
    IF (length(v_def) - length(replace(v_def, p_from, ''))) / length(p_from) <> 1 THEN
      RAISE EXCEPTION 'The piece to patch is not in the definition of % exactly once', p_object;
    END IF;
    EXECUTE replace(v_def, p_from, p_to);
  ELSE
    EXECUTE format('CREATE OR REPLACE VIEW %s%s AS %s', p_object,
                   CASE WHEN v_options IS NULL OR v_options = '' THEN '' ELSE ' WITH (' || v_options || ')' END,
                   rtrim(replace(v_text, p_from, p_to), ';'));
  END IF;
END
$$;

-- 2. A row that only carries invoices gets no visit number (the patient's next visit takes the next one)
SELECT pg_temp.billing_followup_patch('public.generate_visit_number()', 'function', '5a5d75ec224718e5d3b15840325e3c78',
  E'    BEGIN\n      -- Get the max visit number for this patient\n',
  E'    BEGIN\n      -- A row that only carries invoices is not a visit: no number, and it never takes one from the patient''s visits\n'
   '      IF public.visit_is_carrier(NEW.automation_source) THEN\n        NEW.visit_number := NULL;\n        RETURN NEW;\n      END IF;\n\n'
   '      -- Get the max visit number for this patient\n');

-- 3. The dashboard's encounter figures (total, completed, pending, percentages, new this month)
SELECT pg_temp.billing_followup_patch('public.get_dashboard_stats(uuid)', 'function', 'c9353f71b60b2afcd7b584b7dce0148f',
  E'    FROM visits v\n    WHERE v.practice_id = p_practice_id\n',
  E'    FROM visits v\n    WHERE v.practice_id = p_practice_id\n      AND NOT public.visit_is_carrier(v.automation_source)\n');

-- The data fetcher's visit count and last visit date per patient
SELECT pg_temp.billing_followup_patch('public.get_patient_visit_counts(uuid[])', 'function', '1a4816229ac4a01a4f8fea427010334f',
  E'  WHERE v.patient_id = ANY(patient_ids)\n',
  E'  WHERE v.patient_id = ANY(patient_ids)\n    AND NOT public.visit_is_carrier(v.automation_source)\n');

-- The merge screen's visits per file
SELECT pg_temp.billing_followup_patch('public.patient_record_counts(uuid[])', 'function', 'f2f583fed63bf3d6e890c431289e3988',
  '(SELECT count(*) FROM public.visits v WHERE v.patient_id = p.id)',
  '(SELECT count(*) FROM public.visits v WHERE v.patient_id = p.id AND NOT public.visit_is_carrier(v.automation_source))');

-- The patient app's appointments: a cancelled "consultation" the patient never booked is not shown
SELECT pg_temp.billing_followup_patch('public.portal_appointments(uuid)', 'function', '6601265bbde706fc2cd986918d3f26ee',
  E'  WHERE v.patient_id = p_patient_id\n',
  E'  WHERE v.patient_id = p_patient_id\n    AND NOT public.visit_is_carrier(v.automation_source)\n');

-- Encounters' list (and its numbering, row_number over the rows left)
SELECT pg_temp.billing_followup_patch('public.encounters_view', 'view', 'ceeaf85b7e25969544ce359e579ad419',
  E'\n  ORDER BY v.created_at DESC;',
  E'\n  WHERE NOT public.visit_is_carrier(v.automation_source)\n  ORDER BY v.created_at DESC;');

-- Appointments (the view over visits several screens read and update)
SELECT pg_temp.billing_followup_patch('public.appointments', 'view', '2cfc967edb24ec1756f7a2c7c6de3c05',
  E'\n   FROM visits;',
  E'\n   FROM visits\n  WHERE NOT public.visit_is_carrier(visits.automation_source);');

-- ---------------------------------------------------------------------------------------------
-- 4. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_text text;
  v_acl text;
  v_options text;
  t text;
BEGIN
  IF NOT public.visit_is_carrier('system') OR public.visit_is_carrier(NULL) OR public.visit_is_carrier('template')
     OR public.visit_is_carrier('manual') OR public.visit_is_carrier('System') THEN
    RAISE EXCEPTION 'visit_is_carrier does not follow the rule';
  END IF;
  IF has_function_privilege('anon', 'public.visit_is_carrier(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.visit_is_carrier(text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.visit_is_carrier(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'visit_is_carrier rights are not as intended';
  END IF;

  IF (SELECT count(*) FROM billing_followup_patches) <> 7 THEN
    RAISE EXCEPTION 'Not every object was patched';
  END IF;
  FOR r IN SELECT * FROM billing_followup_patches LOOP
    IF r.kind = 'function' THEN
      SELECT p.prosrc, p.proacl::text, concat_ws('|', p.prosecdef::text, p.provolatile::text, array_to_string(p.proconfig, ','))
        INTO v_text, v_acl, v_options FROM pg_proc p WHERE p.oid = r.object::regprocedure;
    ELSE
      SELECT pg_get_viewdef(c.oid, true), c.relacl::text, array_to_string(c.reloptions, ', ')
        INTO v_text, v_acl, v_options FROM pg_class c WHERE c.oid = r.object::regclass;
    END IF;
    -- Exactly the one piece added (a view is compared without layout, brackets and the schema name, which PostgreSQL
    -- writes its own way; CREATE OR REPLACE VIEW already refuses other columns)
    IF r.kind = 'function' AND v_text IS DISTINCT FROM replace(r.before_text, r.piece_from, r.piece_to) THEN
      RAISE EXCEPTION '% is not exactly the patched text', r.object;
    END IF;
    IF r.kind = 'view' AND regexp_replace(v_text, '\s+|public\.|[()]', '', 'g')
         IS DISTINCT FROM regexp_replace(replace(r.before_text, r.piece_from, r.piece_to), '\s+|public\.|[()]', '', 'g') THEN
      RAISE EXCEPTION '% is not exactly the patched view', r.object;
    END IF;
    IF position('visit_is_carrier' in v_text) = 0 THEN
      RAISE EXCEPTION '% does not use visit_is_carrier', r.object;
    END IF;
    IF v_acl IS DISTINCT FROM r.before_acl OR v_options IS DISTINCT FROM r.before_options THEN
      RAISE EXCEPTION '% lost its rights or attributes (% / %)', r.object, v_acl, v_options;
    END IF;
  END LOOP;
  IF (SELECT array_to_string(reloptions, ',') FROM pg_class WHERE oid = 'public.appointments'::regclass) IS DISTINCT FROM 'security_invoker=on'
     OR (SELECT array_to_string(reloptions, ',') FROM pg_class WHERE oid = 'public.encounters_view'::regclass) IS DISTINCT FROM 'security_invoker=on' THEN
    RAISE EXCEPTION 'A view lost security_invoker';
  END IF;

  -- The patient app's logins get nothing from the billing extras tables (made by the billing extras file)
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY['stock_pricing_rules', 'stock_reference_prices', 'billing_promotions', 'billing_package_types',
                             'patient_packages', 'payment_plans', 'payment_plan_instalments'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = t AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE'
           AND cmd = 'ALL' AND roles = '{authenticated}' AND qual LIKE '%portal_is_staff()%' AND with_check LIKE '%portal_is_staff()%'
      ) THEN
        RAISE EXCEPTION 'portal_staff_only is missing on %', t;
      END IF;
    END LOOP;
  END IF;
END $$;

DROP FUNCTION pg_temp.billing_followup_patch(text, text, text, text, text);

ROLLBACK;

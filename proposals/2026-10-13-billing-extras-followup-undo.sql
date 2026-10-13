-- =============================================================================================
-- UNDO of proposals/2026-10-13-billing-extras-followup.sql (migration billing_extras_followup_2026_10_13)
-- Every patched object gets back exactly the text it had before (the one piece the follow-up added is taken out), then
-- visit_is_carrier goes and the column comment is the old one. Each object is first checked to still be the follow-up's
-- version (md5); anything else stops the undo and changes nothing. Not applied: for the owner, only if wanted.
-- After it, rows that only carry invoices count as visits again in the places listed in the follow-up (the app's own
-- queries keep leaving them out: src/utils/carrierVisits.ts).
-- =============================================================================================
BEGIN;
SET LOCAL search_path TO public;

CREATE FUNCTION pg_temp.billing_followup_unpatch(p_object text, p_kind text, p_md5_now text, p_md5_before text, p_added text, p_original text)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_text text;
  v_def text;
  v_options text;
BEGIN
  IF p_kind = 'function' THEN
    SELECT p.prosrc, pg_get_functiondef(p.oid) INTO v_text, v_def FROM pg_proc p WHERE p.oid = p_object::regprocedure;
  ELSE
    SELECT pg_get_viewdef(c.oid, true), array_to_string(c.reloptions, ', ') INTO v_text, v_options
      FROM pg_class c WHERE c.oid = p_object::regclass;
  END IF;
  IF md5(v_text) <> p_md5_now THEN
    RAISE EXCEPTION '% is not the follow-up''s version (md5 %); undo it by hand', p_object, md5(v_text);
  END IF;
  IF p_kind = 'function' THEN
    EXECUTE replace(v_def, p_added, p_original);
    SELECT p.prosrc INTO v_text FROM pg_proc p WHERE p.oid = p_object::regprocedure;
  ELSE
    EXECUTE format('CREATE OR REPLACE VIEW %s%s AS %s', p_object,
                   CASE WHEN v_options IS NULL OR v_options = '' THEN '' ELSE ' WITH (' || v_options || ')' END,
                   rtrim(replace(v_text, p_added, p_original), ';'));
    SELECT pg_get_viewdef(c.oid, true) INTO v_text FROM pg_class c WHERE c.oid = p_object::regclass;
  END IF;
  IF md5(v_text) <> p_md5_before THEN
    RAISE EXCEPTION '% did not come back to its earlier text', p_object;
  END IF;
END
$$;

SELECT pg_temp.billing_followup_unpatch('public.generate_visit_number()', 'function',
  '1450ca1122203a68c47b0d761377180f', '5a5d75ec224718e5d3b15840325e3c78',
  E'    BEGIN\n      -- A row that only carries invoices is not a visit: no number, and it never takes one from the patient''s visits\n'
   '      IF public.visit_is_carrier(NEW.automation_source) THEN\n        NEW.visit_number := NULL;\n        RETURN NEW;\n      END IF;\n\n'
   '      -- Get the max visit number for this patient\n',
  E'    BEGIN\n      -- Get the max visit number for this patient\n');

SELECT pg_temp.billing_followup_unpatch('public.get_dashboard_stats(uuid)', 'function',
  '079bb88d416e990396e60562a2f8145a', 'c9353f71b60b2afcd7b584b7dce0148f',
  E'    FROM visits v\n    WHERE v.practice_id = p_practice_id\n      AND NOT public.visit_is_carrier(v.automation_source)\n',
  E'    FROM visits v\n    WHERE v.practice_id = p_practice_id\n');

SELECT pg_temp.billing_followup_unpatch('public.get_patient_visit_counts(uuid[])', 'function',
  '1f6e91f0bd34b286f2e90c2ec575ce4a', '1a4816229ac4a01a4f8fea427010334f',
  E'  WHERE v.patient_id = ANY(patient_ids)\n    AND NOT public.visit_is_carrier(v.automation_source)\n',
  E'  WHERE v.patient_id = ANY(patient_ids)\n');

SELECT pg_temp.billing_followup_unpatch('public.patient_record_counts(uuid[])', 'function',
  'e59c57802785b197725141798a36f306', 'f2f583fed63bf3d6e890c431289e3988',
  '(SELECT count(*) FROM public.visits v WHERE v.patient_id = p.id AND NOT public.visit_is_carrier(v.automation_source))',
  '(SELECT count(*) FROM public.visits v WHERE v.patient_id = p.id)');

SELECT pg_temp.billing_followup_unpatch('public.portal_appointments(uuid)', 'function',
  '29cf3bcf505716be8a3fec203d175f8c', '6601265bbde706fc2cd986918d3f26ee',
  E'  WHERE v.patient_id = p_patient_id\n    AND NOT public.visit_is_carrier(v.automation_source)\n',
  E'  WHERE v.patient_id = p_patient_id\n');

-- PostgreSQL writes a view's text itself: these are the follow-up's views as it writes them
SELECT pg_temp.billing_followup_unpatch('public.encounters_view', 'view',
  'f034188ec83a2288c7c439e5ad1cc9ef', 'ceeaf85b7e25969544ce359e579ad419',
  E'\n  WHERE NOT visit_is_carrier(v.automation_source)\n  ORDER BY v.created_at DESC;',
  E'\n  ORDER BY v.created_at DESC;');

SELECT pg_temp.billing_followup_unpatch('public.appointments', 'view',
  '553524c71cf88bef51a665e7e9083879', '2cfc967edb24ec1756f7a2c7c6de3c05',
  E'\n   FROM visits\n  WHERE NOT visit_is_carrier(visits.automation_source);',
  E'\n   FROM visits;');

DROP FUNCTION pg_temp.billing_followup_unpatch(text, text, text, text, text, text);
DROP FUNCTION public.visit_is_carrier(text);
COMMENT ON COLUMN public.visits.automation_source IS
  'Source of the visit creation: manual (user created), template (follow-up automation), system (other automation)';

COMMIT;

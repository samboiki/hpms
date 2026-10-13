-- Applied 2026-10-13 as migration imaging_reports_2026_10_13 (version 20261013011309; stored statement md5 a4e05f32a099887876db3e1d7a526dc9 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins on two invented requests (rolled back, then checked: no column, function or request
-- left; 58 requests as before): reception could not add a report (42501); the practitioner added one (tidied, dated
-- today, the request completed) and corrected it (re-dated, the completed date kept); an empty or 20,001-character
-- report, a 121-character radiologist, a date in the future or before the request, a cancelled request (22023) and an
-- unknown request (P0002) were refused. Reception read the report; another practice's staff and a patient-app login
-- read 0 rows and could not report (42501); anon could not run it (42501). The policies on imaging_requests were
-- unchanged (fingerprint before and after).
-- =============================================================================================
-- PROPOSAL: radiology reports on imaging requests: the report, its date and who entered it (parity C12)
-- File:   proposals/2026-10-13-imaging-reports.sql                       Drafted: 2026-10-13
-- Code:   src/utils/clinical/imagingReports.ts (the report checks, the request's label; tested),
--         src/services/imagingReportService.ts, src/components/requests/ImagingReport*.tsx (the visit's Imaging tab and
--         the patient file's Imaging tab) and the label printed through the practice's label printer.
--
-- Why (parity C12): imaging requests (imaging_requests: the X-ray, scan or ultrasound a practitioner asks for, with
-- result files in patient_imaging) had a report_text column that no screen filled or showed, so the radiologist's
-- report lived on paper or in an email. Eminance keeps radiology reports with the encounter and prints radiology
-- labels for the film packets.
--
-- What it does (additive: imaging_requests keeps its policies and triggers)
--   1. imaging_requests.reported_on (the date on the radiologist's report), reported_at and reported_by (when and by
--      whom it was entered or last changed). report_text and radiologist_name already exist.
--   2. save_imaging_report(request, report, radiologist, report date): practitioners, nurses and practice
--      administrators of the patient's practice (SECURITY DEFINER, search_path public): the report (1 to 20,000
--      characters), the radiologist (up to 120), the date (not in the future, not before the request). The request
--      becomes completed (its completed date kept, else the report date). A cancelled request takes no report.
--   3. Checks after.
--   Before this file is applied the Imaging tabs show a report already on a request and say adding one is not set up
--   yet.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Needs ar_today().
-- Undo:
--   DROP FUNCTION IF EXISTS public.save_imaging_report(uuid, text, text, date);
--   ALTER TABLE public.imaging_requests DROP COLUMN IF EXISTS reported_on, DROP COLUMN IF EXISTS reported_at,
--     DROP COLUMN IF EXISTS reported_by;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.imaging_requests') IS NULL THEN
    RAISE EXCEPTION 'Stopped: imaging_requests is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'imaging_requests' AND column_name = 'report_text')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'imaging_requests' AND column_name = 'radiologist_name') THEN
    RAISE EXCEPTION 'Stopped: imaging_requests.report_text or radiologist_name is missing';
  END IF;
  IF to_regprocedure('public.ar_today()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: ar_today() is missing; apply proposals/2026-10-07-receipts-and-allocations.sql first';
  END IF;
  PERFORM set_config('onehealth.imaging_policies_before',
    (SELECT md5(string_agg(policyname || cmd || COALESCE(qual, '') || COALESCE(with_check, ''), '|' ORDER BY policyname))
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'imaging_requests'), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. When the report is dated, and who entered it when (nullable columns: imaging_requests is not rewritten)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.imaging_requests ADD COLUMN IF NOT EXISTS reported_on date;
ALTER TABLE public.imaging_requests ADD COLUMN IF NOT EXISTS reported_at timestamptz;
ALTER TABLE public.imaging_requests ADD COLUMN IF NOT EXISTS reported_by uuid;
ALTER TABLE public.imaging_requests DROP CONSTRAINT IF EXISTS imaging_requests_reported_by_fkey;
ALTER TABLE public.imaging_requests ADD CONSTRAINT imaging_requests_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.imaging_requests.reported_on IS 'The date on the radiologist''s report (save_imaging_report).';
COMMENT ON COLUMN public.imaging_requests.reported_at IS 'When the report was entered or last changed in OneHealth.';
COMMENT ON COLUMN public.imaging_requests.reported_by IS 'Who entered or last changed the report (a practitioner, nurse or practice administrator).';

-- ---------------------------------------------------------------------------------------------
-- 2. save_imaging_report: the same checks as checkImagingReport in src/utils/clinical/imagingReports.ts
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_imaging_report(p_request_id uuid, p_report text, p_radiologist text, p_reported_on date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.imaging_requests%ROWTYPE;
  v_practice uuid;
  v_role text;
  v_report text := NULLIF(btrim(COALESCE(p_report, '')), '');
  v_radiologist text := NULLIF(btrim(regexp_replace(COALESCE(p_radiologist, ''), '\s+', ' ', 'g')), '');
  v_on date := COALESCE(p_reported_on, public.ar_today());
  v_at timestamptz := now();
BEGIN
  SELECT * INTO v_request FROM public.imaging_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This imaging request was not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = v_request.patient_id;
  SELECT u.role INTO v_role FROM public.users u
   WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND v_practice IS NOT NULL AND u.practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only staff of the patient''s practice can report on this request' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(v_role, '') NOT IN ('doctor', 'nurse', 'admin') THEN
    RAISE EXCEPTION 'Only a practitioner, nurse or practice admin can add or change a report' USING ERRCODE = '42501';
  END IF;
  IF v_request.status = 'cancelled' THEN
    RAISE EXCEPTION 'This request was cancelled' USING ERRCODE = '22023';
  END IF;
  IF v_report IS NULL THEN
    RAISE EXCEPTION 'Write the report' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_report) > 20000 THEN
    RAISE EXCEPTION 'Keep the report to 20,000 characters' USING ERRCODE = '22023';
  END IF;
  IF v_radiologist IS NOT NULL AND char_length(v_radiologist) > 120 THEN
    RAISE EXCEPTION 'Keep the radiologist''s name to 120 characters' USING ERRCODE = '22023';
  END IF;
  IF v_on > public.ar_today() THEN
    RAISE EXCEPTION 'The report date cannot be in the future' USING ERRCODE = '22023';
  END IF;
  IF v_request.request_date IS NOT NULL AND v_on < v_request.request_date THEN
    RAISE EXCEPTION 'The report cannot be dated before the request' USING ERRCODE = '22023';
  END IF;
  UPDATE public.imaging_requests
     SET report_text = v_report, radiologist_name = v_radiologist, reported_on = v_on, reported_at = v_at,
         reported_by = auth.uid(), status = 'completed', completed_date = COALESCE(completed_date, v_on), updated_at = v_at
   WHERE id = p_request_id;
  RETURN jsonb_build_object('id', p_request_id, 'reported_on', v_on, 'reported_at', v_at);
END
$$;

REVOKE ALL ON FUNCTION public.save_imaging_report(uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_imaging_report(uuid, text, text, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Checks after: the columns and the function are there, anon cannot run it, and the policies did not change
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'imaging_requests'
       AND column_name IN ('reported_on', 'reported_at', 'reported_by') AND is_nullable = 'YES') <> 3 THEN
    RAISE EXCEPTION 'check failed: the report columns are missing';
  END IF;
  IF has_function_privilege('anon', 'public.save_imaging_report(uuid, text, text, date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.save_imaging_report(uuid, text, text, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: save_imaging_report grants';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'save_imaging_report' AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'check failed: save_imaging_report must be SECURITY DEFINER with search_path public';
  END IF;
  IF current_setting('onehealth.imaging_policies_before', true) IS DISTINCT FROM
     (SELECT md5(string_agg(policyname || cmd || COALESCE(qual, '') || COALESCE(with_check, ''), '|' ORDER BY policyname))
        FROM pg_policies WHERE schemaname = 'public' AND tablename = 'imaging_requests') THEN
    RAISE EXCEPTION 'check failed: the policies on imaging_requests changed';
  END IF;
END $$;

ROLLBACK;

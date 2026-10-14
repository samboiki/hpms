-- Applied 2026-10-14 as migration tariff_icd10_suggestions_2026_10_14 (version 20261013224206, UTC; stored statement md5 657d0624ab393b5d2b4a7b2a68c61fdd = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left): the practice's administrator, a doctor
-- and OneHealth support got the same 11 rows (most used first, at most 5 per tariff code; lines older than 24 months,
-- category headings, an asterisk code, a code not in the list and a secondary-only code left out; an invoice without a
-- practice counted for its patient's practice); staff of another practice, an inactive user, a patient-app login, the
-- public key and a missing practice were refused (42501). The first version let the inactive user and the patient-app
-- login through (a NULL in the access check); fixed with COALESCE before applying. The starter table: staff read all
-- 216 rows and could not insert, change or delete (42501); the inactive user and the patient-app login saw 0 rows;
-- the public key could not read; the check in section 6 finds a category heading (Z23) if one is ever added. All
-- repeated after applying; running the applied statement again changed nothing (216 rows, same content).
-- =============================================================================================
-- PROPOSAL: ICD-10 suggestions per tariff code: what the practice itself bills, and a short reviewed starter list
-- File:   proposals/2026-10-14-tariff-icd10-suggestions.sql              Drafted: 2026-10-14 (agent icd10)
-- Code:   src/utils/billing/tariffIcd10Suggestions.ts (the order and wording of the suggestions; tested),
--         src/services/tariffIcd10SuggestionService.ts (reads), src/hooks/useTariffIcd10Suggestions.ts,
--         the ICD-10 code box under a billing line (Icd10CodeInput > Icd10SearchInput > useIcd10Search)
--
-- Why
--   Owner, 14 Oct 2026: map the NAMAF tariff codes to ICD-10 "so that things are proper". Researched first (sources
--   in the hand-over report): as far as can be found there is NO official table from NAMAF, the medical aid funds,
--   the South African Council for Medical Schemes or the Department of Health that ties a tariff code to ICD-10
--   codes. What is published is the opposite split of work: the ICD-10 code is the practitioner's diagnosis for the
--   patient (NAMAF Circular 4 of 2025, 20 Jan 2025: from the national ICD-10 Master Industry Table, at least one
--   3-character code per claim, "no ICD-10 code, no pay" from 1 July 2025; a referral diagnosis, a sign or symptom
--   code or a Z code is encouraged for providers who do not diagnose), and the procedure (tariff) code is a different
--   code. So nothing here is presented as an official link.
--   What the app can honestly offer, always as a suggestion the practitioner confirms:
--     1. what THIS practice has billed with each tariff code in the last 24 months (learned from its own lines);
--     2. a short reviewed starter list for codes whose own NAMAF wording names the situation (an antenatal visit,
--        an immunisation, a hearing test, ...), checked against the medical aids' ICD-10 list.
--   Together with the practice's own usual code per tariff code (tariff_icd10_defaults, 2026-10-08), this is what the
--   billing line offers, in that order.
--
-- What it does (additive; no existing table or policy changes)
--   1. learned_tariff_icd10(practice): per tariff code, the ICD-10 codes most often used as the MAIN code of the
--      practice's invoice lines in the last 24 months (service date, Windhoek), at most 5 per tariff code, with the
--      number of times. Returns only (tariff code, ICD-10 code, times used): no patient, invoice or line ids, no
--      dates. Counts only codes the medical aids' list accepts as a main code today (not a category heading, not an
--      asterisk code, not discontinued, in the list). SECURITY DEFINER (the caller may only read their own
--      practice's lines already, but this returns counts without sending every line to the browser); the caller must
--      be an active staff member of that practice, or OneHealth support. EXECUTE for signed-in users only.
--   2. namaf_tariff_icd10_suggestions: one row per NAMAF discipline, billed code and ICD-10 code, with the source
--      ('starter'), a one-line reason in plain words, the order among the codes of one tariff code and the date it
--      was reviewed. Staff read it (reference data, no patient data); nobody writes it through the API: the list
--      changes by migration only. A future official table would be a new source value with its citation.
--   3. The 216 starter rows (section 5). Each rule was written from the NAMAF 2026 wording (namaf_tariffs), applies
--      only to the row the app offers for that code, and uses an ICD-10 code that is usable as a main code in the
--      list (checked at the end of this file when the list is loaded). Where the code itself names no situation,
--      there is no row: dentists' 4-digit codes are not repeated (the owner's dental sheet already covers them,
--      src/utils/billing/dentalIcd10Map.ts) and no row is invented for general consultations.
--   4. The patient app's staff-only guard on the new table, as on every OneHealth table (when the portal is set up).
--   Needs the practice-isolation helpers rls_my_practice_id() and rls_is_super_admin(), ar_today() (receipts) and the
--   ICD-10 list (proposals/2026-10-12-icd10-master.sql). The NAMAF table is not needed to apply this file.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until it is applied the billing line works as before (the practice's usual code and the built-in
-- suggestions); the app detects the missing function or table and offers nothing more.
-- Undo: DROP FUNCTION IF EXISTS public.learned_tariff_icd10(uuid);
--       DROP TABLE IF EXISTS public.namaf_tariff_icd10_suggestions;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. What the practice has billed: the ICD-10 codes used most with each tariff code
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.learned_tariff_icd10(p_practice_id uuid)
RETURNS TABLE (tariff_code text, icd10_code text, times_used integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  -- COALESCE: a login with no active staff row has no practice (NULL), and NOT (NULL) would let it through
  IF auth.uid() IS NULL OR p_practice_id IS NULL
     OR NOT (COALESCE(p_practice_id = public.rls_my_practice_id(), false) OR public.rls_is_super_admin()) THEN
    RAISE EXCEPTION 'You can only see the diagnoses billed in your own practice.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH billed AS (
    -- The practice's invoices (an invoice without a practice belongs to its patient's practice, as the row policy reads it)
    SELECT upper(btrim(s.code)) AS billed_code,
           s.icd10_primary AS billed_icd10,
           COALESCE(s.service_date, s.created_at::date) AS billed_on
      FROM public.invoice_services s
      JOIN public.invoices_enhanced i ON i.id = s.invoice_id
     WHERE i.practice_id = p_practice_id
       AND s.icd10_primary IS NOT NULL
       AND COALESCE(s.service_date, s.created_at::date) >= (public.ar_today() - INTERVAL '24 months')::date
    UNION ALL
    SELECT upper(btrim(s.code)),
           s.icd10_primary,
           COALESCE(s.service_date, s.created_at::date)
      FROM public.invoice_services s
      JOIN public.invoices_enhanced i ON i.id = s.invoice_id
      JOIN public.patients p ON p.id = i.patient_id
     WHERE i.practice_id IS NULL
       AND p.practice_id = p_practice_id
       AND s.icd10_primary IS NOT NULL
       AND COALESCE(s.service_date, s.created_at::date) >= (public.ar_today() - INTERVAL '24 months')::date
  ),
  counted AS (
    SELECT b.billed_code, b.billed_icd10, count(*)::integer AS used, max(b.billed_on) AS last_on
      FROM billed b
      JOIN public.icd10_codes c ON c.code = b.billed_icd10
     WHERE b.billed_code ~ '^[0-9A-Z]{1,10}$'
       AND c.valid_clinical_use AND c.valid_primary AND NOT c.is_asterisk AND COALESCE(c.status, '') <> 'D'
     GROUP BY b.billed_code, b.billed_icd10
  ),
  ranked AS (
    SELECT k.billed_code, k.billed_icd10, k.used,
           row_number() OVER (PARTITION BY k.billed_code ORDER BY k.used DESC, k.last_on DESC, k.billed_icd10) AS place
      FROM counted k
  )
  SELECT r.billed_code, r.billed_icd10, r.used
    FROM ranked r
   WHERE r.place <= 5
   ORDER BY r.billed_code, r.place;
END
$$;

COMMENT ON FUNCTION public.learned_tariff_icd10(uuid) IS
  'The ICD-10 codes a practice used most as the main code of its invoice lines in the last 24 months, per tariff code (at most 5 each): tariff code, ICD-10 code, times used. No ids, no dates. Own practice only (support: any). Read by the billing line''s ICD-10 box as a suggestion.';

REVOKE ALL ON FUNCTION public.learned_tariff_icd10(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.learned_tariff_icd10(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. The reviewed starter list
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.namaf_tariff_icd10_suggestions (
  -- The NAMAF discipline as in namaf_tariffs: 014 general practitioner, 070 optometrist, 014003 a sub-type of 014
  discipline_code text NOT NULL CHECK (discipline_code ~ '^[0-9]{3}([0-9]{3})?$'),
  -- The code as it is billed (namaf_tariffs.code, invoice_services.code): 2601, 0102, NA70001
  code text NOT NULL CHECK (code ~ '^[0-9A-Z]{1,10}$'),
  -- A main code for the line, so never an external cause code (V-Y)
  icd10_code text NOT NULL CHECK (icd10_code ~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$' AND icd10_code !~ '^[VWXY]'),
  -- 1 is offered first among the starter codes of one tariff code
  sort_order smallint NOT NULL DEFAULT 1 CHECK (sort_order BETWEEN 1 AND 9),
  -- Where the link comes from: OneHealth's own starter list. Nothing here is a NAMAF or fund table.
  source text NOT NULL DEFAULT 'starter' CHECK (source IN ('starter')),
  -- One line in plain words, shown under the code in the billing line's ICD-10 box
  rationale text NOT NULL CHECK (char_length(btrim(rationale)) BETWEEN 5 AND 140),
  reviewed_on date NOT NULL,
  PRIMARY KEY (discipline_code, code, icd10_code)
);

COMMENT ON TABLE public.namaf_tariff_icd10_suggestions IS
  'OneHealth''s starter ICD-10 suggestions for NAMAF codes whose own wording names the situation (antenatal visit, immunisation, hearing test ...). Suggestions only, confirmed by the practitioner; not a NAMAF or fund table. Changed by migration only.';

-- ---------------------------------------------------------------------------------------------
-- 3. Who reads it: signed-in staff (reference data); nobody writes it through the API
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.namaf_tariff_icd10_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.namaf_tariff_icd10_suggestions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.namaf_tariff_icd10_suggestions TO authenticated;

DROP POLICY IF EXISTS namaf_tariff_icd10_suggestions_read ON public.namaf_tariff_icd10_suggestions;
CREATE POLICY namaf_tariff_icd10_suggestions_read ON public.namaf_tariff_icd10_suggestions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)));

-- ---------------------------------------------------------------------------------------------
-- 4. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.namaf_tariff_icd10_suggestions';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.namaf_tariff_icd10_suggestions AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. The starter rows (216): codes x disciplines per line. Repeatable: running it again changes nothing.
--    One number can mean different things in different disciplines (001 is a dental therapist's full mouth
--    examination, but a nurse's consultation and a social worker's first consultation), so a row applies only to the
--    disciplines listed on the same line.
-- ---------------------------------------------------------------------------------------------

INSERT INTO public.namaf_tariff_icd10_suggestions (discipline_code, code, icd10_code, sort_order, source, rationale, reviewed_on)
SELECT d, c, r.icd10, r.sort_order, 'starter', r.rationale, DATE '2026-10-14'
  FROM (VALUES
    (ARRAY['450'], ARRAY['088'], 'Z00.1', 1, 'Well-baby clinic visit: routine child health examination'),
    (ARRAY['NA20001', 'NA20018'], ARRAY['070'], 'Z01.0', 1, 'Refraction: examination of eyes and vision'),
    (ARRAY['NA20005', 'NA70001', 'NA70002', 'NA70003'], ARRAY['070'], 'Z01.0', 1, 'Eye examination: examination of eyes and vision'),
    (ARRAY['NA70004'], ARRAY['070'], 'Z01.0', 1, 'Eye re-examination: examination of eyes and vision'),
    (ARRAY['021', '023', '100', '102'], ARRAY['083'], 'Z01.1', 1, 'Hearing test: examination of ears and hearing'),
    (ARRAY['1100', '1105', '1900', '1905'], ARRAY['082000', '082002'], 'Z01.1', 1, 'Hearing test: examination of ears and hearing'),
    (ARRAY['001'], ARRAY['095'], 'Z01.2', 1, 'Full mouth examination: dental examination'),
    (ARRAY['0102'], ARRAY['010', '014', '014003', '014004', '014300', '014400', '015', '015400', '017', '019', '020', '021', '023', '030', '033', '036', '040', '044', '044300'], 'Z01.8', 1, 'Assessment before anaesthesia or an operation: other special examination'),
    (ARRAY['0105'], ARRAY['010', '014', '014003', '014004', '014300', '014400', '015', '015400', '019', '020', '021', '023', '030', '033', '036', '040', '044', '044300'], 'Z01.8', 1, 'Assessment before anaesthesia or an operation: other special examination'),
    (ARRAY['1115', '1510', '1915'], ARRAY['082000', '082002'], 'Z13.5', 1, 'Hearing screening: special screening examination for eye and ear disorders'),
    (ARRAY['NA20019', 'NA20023', 'NA20024', 'NA20031', 'NA20201', 'NA20210'], ARRAY['070'], 'Z13.5', 1, 'Eye screening: special screening examination for eye and ear disorders'),
    (ARRAY['09997'], ARRAY['014', '014003', '014004', '014300', '014400', '015', '015400', '016', '018001', '023', '027', '027003', '032', '032400', '040', '057', '057300', '058', '060', '088'], 'Z26.9', 1, 'Immunisation, vaccine not named: use the vaccine''s own code (Z23 to Z27) if you know it'),
    (ARRAY['452'], ARRAY['088'], 'Z26.9', 1, 'Immunisation, vaccine not named: use the vaccine''s own code (Z23 to Z27) if you know it'),
    (ARRAY['454'], ARRAY['088'], 'Z26.9', 1, 'Vaccine supplied, vaccine not named: use its own code (Z23 to Z27) if you know it'),
    (ARRAY['09803'], ARRAY['014', '014003', '014004', '014300', '014400', '015', '015400', '016', '057', '058', '060', '077'], 'Z30.1', 1, 'Intrauterine contraceptive device: insertion of the device'),
    (ARRAY['2207'], ARRAY['010', '014', '014003', '014004', '014300', '014400', '015', '015400', '042', '042001', '046', '114'], 'Z30.2', 1, 'Vasectomy is sterilisation'),
    (ARRAY['2497'], ARRAY['010', '014', '014003', '014004', '014300', '014400', '015', '015400', '016', '042', '042001', '114'], 'Z30.2', 1, 'Laparoscopy with sterilisation'),
    (ARRAY['159'], ARRAY['075'], 'Z30.8', 1, 'Semen count after a vasectomy: contraceptive management'),
    (ARRAY['09803'], ARRAY['014', '014003', '014004', '014300', '014400', '015', '015400', '016', '057', '058', '060', '077'], 'Z30.9', 2, 'Intrauterine contraceptive device: contraceptive management'),
    (ARRAY['2601', '2602'], ARRAY['010', '014', '014003', '014004', '014300', '014400', '015', '015400', '016'], 'Z34.9', 1, 'Antenatal visit: supervision of a normal pregnancy (a high-risk pregnancy has its own Z35 codes)'),
    (ARRAY['420'], ARRAY['088'], 'Z34.9', 1, 'Antenatal visit: supervision of a normal pregnancy (a high-risk pregnancy has its own Z35 codes)'),
    (ARRAY['3615', '3617'], ARRAY['010', '014', '014003', '014004', '014300', '014400', '015', '015400', '016'], 'Z36.9', 1, 'Routine scan in pregnancy: antenatal screening'),
    (ARRAY['390001', '390002'], ARRAY['039004'], 'Z36.9', 1, 'Routine scan in pregnancy: antenatal screening'),
    (ARRAY['421'], ARRAY['088'], 'Z39.2', 1, 'Postnatal visit: routine follow-up after the birth'),
    (ARRAY['NA20025', 'NA20026', 'NA20027', 'NA21010', 'NA61011'], ARRAY['070'], 'Z46.0', 1, 'Fitting spectacles or contact lenses: fitting and adjustment'),
    (ARRAY['NA20844', 'NA21004', 'NA21005', 'NA21006', 'NA21844'], ARRAY['070'], 'Z46.0', 1, 'Contact lens check: fitting and adjustment of contact lenses'),
    (ARRAY['200', '201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '300', '301', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311'], ARRAY['084'], 'Z71.3', 1, 'Nutritional counselling: dietary counselling'),
    (ARRAY['450'], ARRAY['088'], 'Z76.2', 2, 'Well-baby clinic visit: health supervision of a healthy infant')
  ) AS r(codes, disciplines, icd10, sort_order, rationale),
  unnest(r.codes) AS c,
  unnest(r.disciplines) AS d
ON CONFLICT (discipline_code, code, icd10_code)
DO UPDATE SET sort_order = EXCLUDED.sort_order, rationale = EXCLUDED.rationale, reviewed_on = EXCLUDED.reviewed_on;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks (each one only when the list it checks against is loaded, so this file also runs on a fresh database)
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_bad text;
BEGIN
  -- Every starter code must be usable as the main code of a claim line in the medical aids' list
  IF to_regclass('public.icd10_codes') IS NOT NULL AND EXISTS (SELECT 1 FROM public.icd10_codes LIMIT 1) THEN
    SELECT string_agg(DISTINCT s.icd10_code, ', ' ORDER BY s.icd10_code) INTO v_bad
      FROM public.namaf_tariff_icd10_suggestions s
      LEFT JOIN public.icd10_codes c ON c.code = s.icd10_code
     WHERE c.code IS NULL OR NOT c.valid_clinical_use OR NOT c.valid_primary OR c.is_asterisk OR COALESCE(c.status, '') = 'D';
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'Check failed: these starter ICD-10 codes cannot be the main code of a claim line: %', v_bad;
    END IF;
  END IF;

  -- Every starter row must be a code the NAMAF list has for that discipline (a typo guard)
  IF to_regclass('public.namaf_tariffs') IS NOT NULL AND EXISTS (SELECT 1 FROM public.namaf_tariffs LIMIT 1) THEN
    SELECT string_agg(DISTINCT s.discipline_code || ':' || s.code, ', ' ORDER BY s.discipline_code || ':' || s.code) INTO v_bad
      FROM public.namaf_tariff_icd10_suggestions s
     WHERE NOT EXISTS (SELECT 1 FROM public.namaf_tariffs n WHERE n.discipline_code = s.discipline_code AND n.code = s.code);
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'Check failed: these starter rows are not codes of that NAMAF discipline: %', v_bad;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'namaf_tariff_icd10_suggestions' ORDER BY policyname;

SELECT has_table_privilege('anon', 'public.namaf_tariff_icd10_suggestions', 'SELECT') AS anon_reads,
       has_table_privilege('authenticated', 'public.namaf_tariff_icd10_suggestions', 'INSERT') AS staff_insert_directly,
       has_function_privilege('anon', 'public.learned_tariff_icd10(uuid)', 'EXECUTE') AS anon_runs_learned,
       has_function_privilege('authenticated', 'public.learned_tariff_icd10(uuid)', 'EXECUTE') AS staff_run_learned,
       (SELECT count(*) FROM public.namaf_tariff_icd10_suggestions) AS starter_rows;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

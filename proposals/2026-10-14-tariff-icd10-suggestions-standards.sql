-- Applied 2026-10-14 as migration tariff_icd10_suggestions_standards_2026_10_14 (version 20261013230203, UTC; stored statement md5 ed77ce320a498291325332d850f7330b = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left): 275 rows (60 following a standard,
-- 215 own) over 61 disciplines; 095 001 became a standard link; a sa-standard row without a standard, a starter row
-- naming one, a badly named standard and a source that is not allowed were all refused (23514); staff read all 275 and
-- could not insert, change or delete (42501); an inactive user and a patient-app login saw 0; the public key was
-- refused (42501). Repeated after applying: running either file again changes nothing.
-- =============================================================================================
-- PROPOSAL: starter ICD-10 links that follow a published South African coding standard (follow-up of
--           proposals/2026-10-14-tariff-icd10-suggestions.sql, which this needs)
-- File:   proposals/2026-10-14-tariff-icd10-suggestions-standards.sql      Drafted: 2026-10-14 (agent icd10)
-- Code:   src/utils/billing/tariffIcd10Suggestions.ts (toStarterMap says "South African coding standard" on these rows),
--         src/services/tariffIcd10SuggestionService.ts (reads the source column)
--
-- Why
--   After the first file was applied, the South African ICD-10 Coding Standards (Version 2, June 2008, compiled by the
--   National Task Team for the Implementation of ICD-10; published by the Council for Medical Schemes:
--   medicalschemes.com/files/ICD10 Codings/ICD Coding Standards Vers 2 June 08.pdf) were read in full. They are not a
--   tariff table and not NAMAF's, and no Namibian adoption of them was found, but they do publish which ICD-10 code to
--   use for named service situations ("Diagnosis Standard National 21", DSN2101-DSN2126), and some NAMAF codes are
--   exactly such a situation. Those links are now marked as following the standard, with its number, so a practitioner
--   and the owner can tell them from OneHealth's own reasoning. What the standards say (and which NAMAF codes match):
--     DSN2104  a patient who did not come for a booked consultation or procedure (Rule D): Z53.2, Z53.8 or Z53.9
--              -> the 24 "appointment not kept" codes of 22 disciplines (Z53.2 first, Z53.9 second)
--     DSN2105  a routine dental examination in which no diagnosis is made or treatment given: Z01.2
--              -> the dental therapist's full mouth examination (095 001); the dentists' 4-digit codes stay with the
--              owner's dental sheet
--     DSN2112  repairs and adjustments to appliances such as spectacles: Z46.0
--              -> optometry "multiple adjustments" and "frame repairs"
--     DSN2114  binocular vision therapy is orthoptic training: Z50.6
--              -> optometry vision training and the orthoptist's orthoptic treatment
--     DSN2120  antenatal and childbirth education classes: Z71.8
--              -> childbirth education and ante/post-natal exercise classes (nurse, nursing agency, private hospital)
--   Not used, on purpose: DSN2102/2103/2118 (a ROUTINE radiological or laboratory examination: Z01.6, Z01.7) because a
--   radiology or pathology code does not say whether the examination was routine; DSN2111/2113/2115 (frames without
--   lenses, repeat spectacle prescription, pharmacy scripts) because no NAMAF code names them; DSN2109/2110 (dental
--   re-cementation, denture repair) because the owner's dental sheet already decides those codes.
--
-- What it does (additive; no policy changes)
--   1. namaf_tariff_icd10_suggestions.reference: the standard a link follows (DSN2104 ...); source gets a second value,
--      'sa-standard'. A constraint keeps the two together: a sa-standard link names its standard, a starter link none.
--   2. 59 new rows and 095 001 re-labelled (60 rows; 275 starter rows in all). Repeatable: running it again changes nothing.
--   3. The same two checks as the first file, over all rows.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until it is applied the app shows the first file's rows only.
-- Undo: DELETE FROM public.namaf_tariff_icd10_suggestions WHERE source = 'sa-standard' AND NOT (discipline_code = '095' AND code = '001');
--       UPDATE public.namaf_tariff_icd10_suggestions SET source = 'starter', reference = NULL,
--              rationale = 'Full mouth examination: dental examination' WHERE discipline_code = '095' AND code = '001';
--       ALTER TABLE public.namaf_tariff_icd10_suggestions DROP CONSTRAINT namaf_tariff_icd10_suggestions_reference_check;
--       ALTER TABLE public.namaf_tariff_icd10_suggestions DROP COLUMN reference;
--       ALTER TABLE public.namaf_tariff_icd10_suggestions DROP CONSTRAINT namaf_tariff_icd10_suggestions_source_check;
--       ALTER TABLE public.namaf_tariff_icd10_suggestions ADD CONSTRAINT namaf_tariff_icd10_suggestions_source_check CHECK (source IN ('starter'));
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Where a link comes from
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.namaf_tariff_icd10_suggestions ADD COLUMN IF NOT EXISTS reference text;

ALTER TABLE public.namaf_tariff_icd10_suggestions DROP CONSTRAINT IF EXISTS namaf_tariff_icd10_suggestions_source_check;
ALTER TABLE public.namaf_tariff_icd10_suggestions DROP CONSTRAINT IF EXISTS namaf_tariff_icd10_suggestions_reference_check;
ALTER TABLE public.namaf_tariff_icd10_suggestions ADD CONSTRAINT namaf_tariff_icd10_suggestions_source_check
  CHECK (source IN ('starter', 'sa-standard'));
-- A link that follows a published standard names it; OneHealth's own reasoning names none
ALTER TABLE public.namaf_tariff_icd10_suggestions ADD CONSTRAINT namaf_tariff_icd10_suggestions_reference_check
  CHECK ((source = 'sa-standard') = (reference IS NOT NULL) AND (reference IS NULL OR reference ~ '^DSN[0-9]{4}$'));

COMMENT ON COLUMN public.namaf_tariff_icd10_suggestions.reference IS
  'The standard of the South African ICD-10 Coding Standards (Version 2, June 2008) that a sa-standard link follows, for example DSN2104; null for OneHealth''s own starter links.';

-- ---------------------------------------------------------------------------------------------
-- 2. The rows: codes x disciplines per line
-- ---------------------------------------------------------------------------------------------

INSERT INTO public.namaf_tariff_icd10_suggestions (discipline_code, code, icd10_code, sort_order, source, reference, rationale, reviewed_on)
SELECT d, c, r.icd10, r.sort_order, 'sa-standard', r.reference, r.rationale, DATE '2026-10-14'
  FROM (VALUES
    (ARRAY['0001', '117'], ARRAY['072'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['003'], ARRAY['095'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['007'], ARRAY['086', '099'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['0107'], ARRAY['082000', '082001', '082002', '084'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['101'], ARRAY['068'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['107'], ARRAY['004', '008', '066', '069001', '074', '083', '089', '091'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['8105'], ARRAY['054', '054400', '064'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['8510'], ARRAY['094'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['8706'], ARRAY['092'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['8805'], ARRAY['064'], 'Z53.2', 1, 'DSN2104', 'Patient did not come: procedure not carried out because of the patient''s decision'),
    (ARRAY['0001', '117'], ARRAY['072'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['003'], ARRAY['095'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['007'], ARRAY['086', '099'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['0107'], ARRAY['082000', '082001', '082002', '084'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['101'], ARRAY['068'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['107'], ARRAY['004', '008', '066', '069001', '074', '083', '089', '091'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['8105'], ARRAY['054', '054400', '064'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['8510'], ARRAY['094'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['8706'], ARRAY['092'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['8805'], ARRAY['064'], 'Z53.9', 2, 'DSN2104', 'Patient did not come, reason not known: procedure not carried out'),
    (ARRAY['001'], ARRAY['095'], 'Z01.2', 1, 'DSN2105', 'Full mouth examination when nothing is found or treated: dental examination'),
    (ARRAY['NA14031', 'NA69019'], ARRAY['070'], 'Z46.0', 1, 'DSN2112', 'Repair or adjustment of spectacles or contact lenses: fitting and adjustment'),
    (ARRAY['003'], ARRAY['074'], 'Z50.6', 1, 'DSN2114', 'Vision therapy: orthoptic training'),
    (ARRAY['NA22008', 'NA22009', 'NA22010', 'NA22011'], ARRAY['070'], 'Z50.6', 1, 'DSN2114', 'Vision therapy: orthoptic training'),
    (ARRAY['407'], ARRAY['080', '088'], 'Z71.8', 1, 'DSN2120', 'Antenatal or childbirth classes: other specified counselling'),
    (ARRAY['425'], ARRAY['088'], 'Z71.8', 1, 'DSN2120', 'Antenatal or childbirth classes: other specified counselling'),
    (ARRAY['58425'], ARRAY['058'], 'Z71.8', 1, 'DSN2120', 'Antenatal or childbirth classes: other specified counselling')
  ) AS r(codes, disciplines, icd10, sort_order, reference, rationale),
  unnest(r.codes) AS c,
  unnest(r.disciplines) AS d
ON CONFLICT (discipline_code, code, icd10_code)
DO UPDATE SET sort_order = EXCLUDED.sort_order, source = EXCLUDED.source, reference = EXCLUDED.reference,
              rationale = EXCLUDED.rationale, reviewed_on = EXCLUDED.reviewed_on;

-- ---------------------------------------------------------------------------------------------
-- 3. Checks, as in the first file, over all rows (each one only when the list it checks against is loaded)
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_bad text;
BEGIN
  IF to_regclass('public.icd10_codes') IS NOT NULL AND EXISTS (SELECT 1 FROM public.icd10_codes LIMIT 1) THEN
    SELECT string_agg(DISTINCT s.icd10_code, ', ' ORDER BY s.icd10_code) INTO v_bad
      FROM public.namaf_tariff_icd10_suggestions s
      LEFT JOIN public.icd10_codes c ON c.code = s.icd10_code
     WHERE c.code IS NULL OR NOT c.valid_clinical_use OR NOT c.valid_primary OR c.is_asterisk OR COALESCE(c.status, '') = 'D';
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'Check failed: these starter ICD-10 codes cannot be the main code of a claim line: %', v_bad;
    END IF;
  END IF;

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
-- 4. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT source, count(*) AS rows, count(DISTINCT discipline_code) AS disciplines, string_agg(DISTINCT reference, ', ' ORDER BY reference) AS standards
  FROM public.namaf_tariff_icd10_suggestions GROUP BY source ORDER BY source;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

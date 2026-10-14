-- Applied 2026-10-14 as migration practice_type_disciplines_2026_10_14 (version 20261013222803; stored statement md5 41964ba8c0862eccc868248275208a7e = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left): 18 types became 29, 28 with a
-- discipline; the old rows kept their ids and descriptions; running it twice changed nothing; a practice administrator
-- and a doctor read the link and could not insert (42501) or change a row (0 rows); OneHealth support inserted, changed
-- and deleted, and a malformed code was refused (23514); a patient-app login read 0 rows and the public key was refused
-- (42501); the dental price list (179 codes) and the views over practice_types were unchanged; policies unchanged.
-- =============================================================================================
-- PROPOSAL: every practice type knows its NAMAF discipline, and the practice types that were missing (parity E1)
-- File:   proposals/2026-10-14-practice-type-disciplines.sql         Drafted: 2026-10-14 (agent tariffs2)
-- Code:   src/services/namafTariffService.ts (loadTypeDisciplines reads the link; loadPracticeNamaf uses it),
--         src/utils/billing/namafTariffs.ts (practiceDiscipline; NAMAF_DISCIPLINE_BY_PRACTICE_TYPE is the built-in
--         copy of the list in section 3, used only while the column is missing; a test keeps the two the same),
--         src/utils/practiceType.ts (plain names for the new types in Settings > Practice)
--
-- Why (owner, 14 Oct 2026): "All the practices, if you open up an optometric practice their codes should be there
--   already. They should be linked to practice type. Dentist to dentist type, general practitioner to general
--   practitioner type. All of that." proposals/2026-10-13-namaf-tariffs.sql loaded the NAMAF 2026 list for 144
--   disciplines, but which discipline a practice bills from was written only in the app's code. It is now a column of
--   the practice type, and the disciplines that had no practice type get one.
--
-- What it does (additive; no policy is changed: practice_types belongs to the practice-isolation work)
--   1. practice_types.namaf_discipline_code: nullable, the NAMAF discipline (014 general practitioner, 054 dentist,
--      070 optometrist, ...) whose benchmark list a practice of the type bills from. NULL: the type has no list of
--      its own ('aesthetic'). The format is checked; that the discipline is in the list is checked by section 3.
--   2. The 11 practice types that are NAMAF disciplines but had no row: anesthesiology 010, internal_medicine 018,
--      psychiatry 022, general_surgery 042, urology 046, occupational_therapy 066, speech_therapy 082000, dietetics 084,
--      biokinetics 091, private_hospital 057, day_clinic 076. Existing rows keep their ids; the practices' own
--      practice_type text and link are not touched (a practice chooses its type in Settings > Practice).
--      speech_therapy bills from 082000, not 082: 082 holds one line (a member refund) while 082000 is the speech
--      therapist and audiologist list (102 lines).
--   3. The discipline of the 17 existing types that have one: medical 014, dental 054, optometry 070, physiotherapy
--      072, psychology 086, nursing 088 (registered nurse), dermatology 012, ent 030, gynecology 016, pediatrics 032,
--      cardiology 021, orthopedics 028, ophthalmology 026, neurology 020, radiology 038, pathology 052, pharmacy 060.
--      A type with a discipline needs no setup: the practice's visits and quotes offer that list's codes.
--   A practice administrator can still choose another discipline for one practice (Admin > Tariffs > Practice tariff,
--   practice_settings 'namaf_discipline'): a dentist who is an orthodontist (064), an anaesthetist in a practice of
--   type medical (010). That choice wins over the type's.
--
-- Until it is applied the app uses its built-in copy of the 17 links (no new types exist yet), so billing is unchanged.
-- Apply: run the part between BEGIN; and ROLLBACK; as one migration (running it again changes nothing).
-- Undo:  DELETE FROM public.practice_types t WHERE t.name IN ('anesthesiology', 'internal_medicine', 'psychiatry',
--          'general_surgery', 'urology', 'occupational_therapy', 'speech_therapy', 'dietetics', 'biokinetics',
--          'private_hospital', 'day_clinic') AND NOT EXISTS (SELECT 1 FROM public.practices p WHERE p.practice_type_id = t.id
--          OR lower(btrim(p.practice_type)) = t.name);
--        ALTER TABLE public.practice_types DROP COLUMN IF EXISTS namaf_discipline_code;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The link
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.practice_types ADD COLUMN IF NOT EXISTS namaf_discipline_code text;

ALTER TABLE public.practice_types DROP CONSTRAINT IF EXISTS practice_types_namaf_discipline_code_check;
ALTER TABLE public.practice_types ADD CONSTRAINT practice_types_namaf_discipline_code_check
  CHECK (namaf_discipline_code IS NULL OR namaf_discipline_code ~ '^[0-9]{3}([0-9]{3})?$');

COMMENT ON COLUMN public.practice_types.namaf_discipline_code IS
  'The NAMAF discipline (namaf_tariffs.discipline_code: 014 general practitioner, 054 dentist, 070 optometrist) whose benchmark list practices of this type bill from. NULL: no list of its own. A practice administrator can choose another discipline for one practice (practice_settings namaf_discipline). Read by src/services/namafTariffService.ts.';

-- ---------------------------------------------------------------------------------------------
-- 2. The practice types that were missing
-- ---------------------------------------------------------------------------------------------

INSERT INTO public.practice_types (name, description, is_active) VALUES
  ('anesthesiology', 'anesthesiology practice type', true),
  ('internal_medicine', 'internal medicine practice type', true),
  ('psychiatry', 'psychiatry practice type', true),
  ('general_surgery', 'general surgery practice type', true),
  ('urology', 'urology practice type', true),
  ('occupational_therapy', 'occupational therapy practice type', true),
  ('speech_therapy', 'speech therapy and audiology practice type', true),
  ('dietetics', 'dietetics practice type', true),
  ('biokinetics', 'biokinetics practice type', true),
  ('private_hospital', 'private hospital practice type', true),
  ('day_clinic', 'day clinic practice type', true)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- 3. The discipline of each practice type ('aesthetic' has none and stays empty)
-- ---------------------------------------------------------------------------------------------

UPDATE public.practice_types AS pt
   SET namaf_discipline_code = v.code, updated_at = now()
  FROM (VALUES
    ('medical', '014'),
    ('dental', '054'),
    ('optometry', '070'),
    ('physiotherapy', '072'),
    ('psychology', '086'),
    ('nursing', '088'),
    ('dermatology', '012'),
    ('ent', '030'),
    ('gynecology', '016'),
    ('pediatrics', '032'),
    ('cardiology', '021'),
    ('orthopedics', '028'),
    ('ophthalmology', '026'),
    ('neurology', '020'),
    ('radiology', '038'),
    ('pathology', '052'),
    ('pharmacy', '060'),
    ('anesthesiology', '010'),
    ('internal_medicine', '018'),
    ('psychiatry', '022'),
    ('general_surgery', '042'),
    ('urology', '046'),
    ('occupational_therapy', '066'),
    ('speech_therapy', '082000'),
    ('dietetics', '084'),
    ('biokinetics', '091'),
    ('private_hospital', '057'),
    ('day_clinic', '076')
  ) AS v(name, code)
 WHERE pt.name = v.name AND pt.namaf_discipline_code IS DISTINCT FROM v.code;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks and result (read only)
-- ---------------------------------------------------------------------------------------------

-- A type whose discipline is not in the NAMAF list: no rows when all is well
SELECT pt.name, pt.namaf_discipline_code AS discipline_not_in_the_list
  FROM public.practice_types pt
 WHERE pt.namaf_discipline_code IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.namaf_tariff_disciplines d WHERE d.discipline_code = pt.namaf_discipline_code);

SELECT pt.name, pt.namaf_discipline_code, d.discipline_name, d.codes, d.priced_codes
  FROM public.practice_types pt
  LEFT JOIN public.namaf_tariff_disciplines d ON d.discipline_code = pt.namaf_discipline_code
 ORDER BY pt.name;

ROLLBACK;

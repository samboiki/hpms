-- Applied 2026-10-08 as migration practice_type_align_2026_10_08
-- =============================================================================================
-- PROPOSAL: a practice's type is stored once in effect: the text matches the linked type
-- File:   proposals/2026-10-08-practice-type-align.sql                  Drafted: 2026-10-08
--
-- Why: practices.practice_type (text, which every discipline rule in the app reads: isDentalPractice,
-- isOptometryPractice in src/utils/billing/tariffRules.ts) and practices.practice_type_id (the link to
-- practice_types) disagreed for 866 of 874 practices: the text held the default 'general' while the link
-- named the real type (516 medical, 139 dental, 71 optometry, 61 psychology, 49 physiotherapy, 23 nursing,
-- 7 dermatology). None of the 866 has staff or patients (directory listings), so nobody's screens change
-- today; when one of them starts using OneHealth, the dental chart, optometry and claim rules now apply
-- from day one. Settings > Practice now writes both columns together, so they cannot drift again.
-- The owner approved this on 2026-10-08.
--
-- Undo (every changed row held 'general'; these 5 already matched and are left out):
--   UPDATE public.practices SET practice_type = 'general'
--    WHERE practice_type_id IS NOT NULL
--      AND id NOT IN ('e0716e54-f808-4905-a1f8-85090dd3d9e2', 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3',
--                     '9f9966b9-d515-470a-b6c5-c15330bbe7b7', 'ffed1160-00ec-4c4f-8810-913a24348d90',
--                     '5da3896d-b9f3-4b0a-996a-3adca867cb30');
-- =============================================================================================

BEGIN;

UPDATE public.practices p
   SET practice_type = pt.name
  FROM public.practice_types pt
 WHERE pt.id = p.practice_type_id
   AND p.practice_type IS DISTINCT FROM pt.name;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.practices p JOIN public.practice_types pt ON pt.id = p.practice_type_id
     WHERE p.practice_type IS DISTINCT FROM pt.name
  ) THEN
    RAISE EXCEPTION 'Check failed: a practice''s type text still differs from its linked type';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

-- Applied 2026-10-08 as migration tooth_flags_2_2026_10_07 (sections 2 and 3)
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: crowns, implants, bridges and amalgam fillings need a tooth number
-- File:    proposals/2026-10-07-tooth-flags-2.sql                       Drafted: 2026-10-08
--
-- Why
--   NAMAF's 2025 schedule for dental practitioners (the owner's D:\emminance\2025_Dental Practitioners
--   (All).pdf, explanation 6 on PDF page 4) makes tooth identification compulsory for every item marked
--   T in the mouth-part (MP) column. These 18 items are marked T, but their practice_tariffs rows for the
--   dental practice type say requires_tooth_number = 'NO'. So the visit screens and quotes bill them
--   without a tooth, and the claim check lets such a line go to the fund, which refuses it ("tooth number
--   required" was one of the five fund messages in the practice's claim history):
--     amalgam restorations 8341, 8342, 8343, 8344 (PDF page 9; tariffRules.ts POSTERIOR_RESTORATION_CODES
--       also says they are "paid once per tooth")
--     crowns 8401, 8403, 8407, 8409, 8411 (page 11) and the preformed metal crown 8357 (page 12)
--     implants 8194, 8195, 8196 (page 17)
--     fixed partial dentures (bridges): pontics 8420, 8422, 8424, the Maryland abutment 8356 and the
--       abutment restoration on an implant 8193 (page 18)
--   Each item's mark was read from its own printed row of the PDF. The same reading gives no T for 8101,
--   8109 and 8145 (corrected to NO by proposals/2026-10-07-tariff-tooth-flags.sql) and T for 8201 and
--   8367 (already YES), so it agrees with what is known. That proposal corrected codes wrongly marked
--   YES; this one corrects codes wrongly marked NO. Only the dental practice type is touched.
--
-- Effect
--   These codes then ask for a tooth on the visit screens and in quotes, and the claim check blocks such
--   a line without one. On 2026-10-08, 3 invoice lines used these codes, all without a tooth (2 not yet
--   in a claim batch): their claims will ask for the tooth before they are sent.
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
-- Rehearsed 2026-10-08 on the live database inside a transaction that was rolled back: section 3
-- passed; 18 rows changed (all of the dental practice type, 0 of any other); afterwards all 18 rows
-- still said NO.
--
-- How to apply
--   1. Review. Run the whole file once as it is (Supabase SQL editor). Section 1 lists the 18 rows (each
--      NO); section 3 must finish without an error and report "18 rows say YES".
--   2. Change the final ROLLBACK to COMMIT and run it again.
--   3. Nothing to deploy. Browsers keep the tariff list for up to 30 minutes (PracticeTariffsContext);
--      the visit screens and quotes read it afresh when they open.
--
-- Contents
--   1. Look first
--   2. Correct the flags (dental practice type only)
--   3. Check
--   Undo: at the end of the file.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Look first: the 18 rows as they are (expected: each NO)
-- ---------------------------------------------------------------------------------------------
SELECT pt.code, pt.requires_tooth_number, pt.is_active, pt.effective_from
FROM public.practice_tariffs pt
JOIN public.practice_types t ON t.id = pt.practice_type_id
WHERE lower(btrim(t.name)) = 'dental'
  AND pt.code IN ('8341', '8342', '8343', '8344', '8401', '8403', '8407', '8409', '8411', '8357',
                  '8194', '8195', '8196', '8420', '8422', '8424', '8356', '8193')
ORDER BY pt.code;

-- ---------------------------------------------------------------------------------------------
-- 2. Correct the flags (dental practice type only)
-- ---------------------------------------------------------------------------------------------
UPDATE public.practice_tariffs
SET requires_tooth_number = 'YES', updated_at = now()
WHERE code IN ('8341', '8342', '8343', '8344', '8401', '8403', '8407', '8409', '8411', '8357',
               '8194', '8195', '8196', '8420', '8422', '8424', '8356', '8193')
  AND COALESCE(requires_tooth_number, '') <> 'YES'
  AND practice_type_id IN (SELECT id FROM public.practice_types WHERE lower(btrim(name)) = 'dental');

-- ---------------------------------------------------------------------------------------------
-- 3. Check: every row of the 18 codes of the dental practice type says YES (and there is one per code)
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_rows integer;
  v_yes integer;
  v_codes integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE pt.requires_tooth_number = 'YES'), count(DISTINCT pt.code)
  INTO v_rows, v_yes, v_codes
  FROM public.practice_tariffs pt
  JOIN public.practice_types t ON t.id = pt.practice_type_id
  WHERE lower(btrim(t.name)) = 'dental'
    AND pt.code IN ('8341', '8342', '8343', '8344', '8401', '8403', '8407', '8409', '8411', '8357',
                    '8194', '8195', '8196', '8420', '8422', '8424', '8356', '8193');
  IF v_yes <> v_rows THEN
    RAISE EXCEPTION 'check failed: % of % rows still do not say YES', v_rows - v_yes, v_rows;
  END IF;
  IF v_codes <> 18 THEN
    RAISE NOTICE 'Only % of the 18 codes are in the dental tariff list (the others were not there to correct)', v_codes;
  END IF;
  RAISE NOTICE 'tooth flags corrected: % rows say YES', v_yes;
END $$;

-- Change to COMMIT once reviewed (see "How to apply" at the top)
ROLLBACK;

-- =============================================================================================
-- Undo (only if needed): set NO again for the same codes of the dental practice type
--   UPDATE public.practice_tariffs SET requires_tooth_number = 'NO', updated_at = now()
--   WHERE code IN ('8341', '8342', '8343', '8344', '8401', '8403', '8407', '8409', '8411', '8357',
--                  '8194', '8195', '8196', '8420', '8422', '8424', '8356', '8193')
--     AND practice_type_id IN (SELECT id FROM public.practice_types WHERE lower(btrim(name)) = 'dental');
-- =============================================================================================

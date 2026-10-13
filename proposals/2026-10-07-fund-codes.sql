-- Fund names for the switch fund codes (proposal, 2026-10-07). Not applied: run in the Supabase SQL editor after review.
--
-- Why: old setup scripts (ADD_MEDICAL_AID_REFERENCES.sql, FIX_MEDICAL_AID_WITH_EXISTING_TABLE.sql) guessed fund
-- names from logo file names. MAG1 was named "Gemhealth Medical Aid" or "Methealth Namibia", but MAG1 is PSEMAS:
-- public/medical aids/MAG1.png is the PSEMAS logo, and the practice's Eminance claim files and PSEMAS remittances
-- use MAG1 for PSEMAS (about two thirds of the practice's claim value). PROS was named "Renaissance Health Medical
-- Aid Fund"; its logo is Prosperity.
-- The app no longer depends on these names for deadlines (fundRules.ts matches MAG1 by code), but staff see them
-- on claim batches, debtors and reports.

-- 1. Look first: current names for the five fund codes
SELECT id, name, short_name, medical_aid_reference
FROM medical_aid_providers
WHERE medical_aid_reference IN ('MAG1', 'NMC1', 'NHPM', 'NAMM', 'PROS')
ORDER BY medical_aid_reference, name;

-- 2. MAG1 is PSEMAS. Only renames the two known wrong guesses, so a name someone already corrected is kept.
UPDATE medical_aid_providers
SET name = 'PSEMAS'
WHERE medical_aid_reference = 'MAG1'
  AND name IN ('Gemhealth Medical Aid', 'Methealth Namibia');

-- 3. PROS: confirm the fund's exact registered name (as printed on its remittance advice) before running.
-- UPDATE medical_aid_providers
-- SET name = '<name on the PROS remittance>'
-- WHERE medical_aid_reference = 'PROS'
--   AND name = 'Renaissance Health Medical Aid Fund';

-- 4. Check: run step 1 again.

-- Dependant code on the patient's medical aid details (proposal, 2026-10-07). Not applied: review, then run in the
-- Supabase SQL editor.
--
-- Why: field 11 of a claim line is the dependant code plus the patient's first name, e.g. "02 NDAPEWA" (20
-- characters). The code is printed on the member's medical aid card (00 or 01 is usually the main member). Without
-- it the fund has to guess which beneficiary is meant; NHP answered the previous software's first run with
-- "patient matched more than one beneficiary" (12 lines) and "not registered as a beneficiary" (13 lines).
-- The app already reads the column when it exists (claims read medical_aid_details with select '*').
-- After applying: add a "Dependant code (from the medical aid card)" input to the medical aid forms
-- (MedicalAidForm, ModernPatientRegistrationForm, EditPatientForm). Not added before, because saving a column
-- that does not exist yet would fail.

-- 1. The column
ALTER TABLE medical_aid_details ADD COLUMN IF NOT EXISTS dependant_code text
  CHECK (dependant_code IS NULL OR dependant_code ~ '^[0-9]{1,3}$');
COMMENT ON COLUMN medical_aid_details.dependant_code IS
  'Dependant code on the medical aid card (e.g. 00 main member, 01 spouse, 02 first child); sent in claim field 11';

-- 2. Check: how many records have a code (counts only)
SELECT relationship_to_main, COUNT(*) AS records, COUNT(dependant_code) AS with_code
FROM medical_aid_details
GROUP BY relationship_to_main
ORDER BY relationship_to_main;

-- Undo: ALTER TABLE medical_aid_details DROP COLUMN IF EXISTS dependant_code;

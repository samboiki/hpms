-- Applied 2026-10-13 as migration patient_town_2026_10_13 (version 20261013012548; stored statement md5 0bc1799a1c0974f5375a76e823abe1cc = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with the payer accounts and fund moves files (rolled back): reception set an invented patient's town and
-- region through the patients policies (1 row); an old region name (Caprivi) was refused (23514); the policies of
-- patients did not change.
-- =============================================================================================
-- PROPOSAL: the town and region of a patient's address, picked from a list of Namibian towns (parity A16)
-- File:   proposals/2026-10-13-patient-town.sql                          Drafted: 2026-10-13
-- Code:   src/utils/address/namibianTowns.ts (the towns and settlements with their region, the search; tested),
--         src/components/address/TownPicker.tsx (the town field that fills the region), used by the registration
--         form and the patient form's Contact tab; src/components/forms/patientTownColumns.ts (the columns probe)
--
-- Why (A16): addresses were free text, so nothing could say where patients live (Eminance fills an address from its
-- postal-code list; that list is South African and has no Namibian towns). Namibia mostly uses PO Box addresses and
-- has no street postcode in general use, so the list is of towns and settlements with their region, not of codes:
-- picking a town fills its region. The postal code stays an optional free-text field for those who use one.
--
-- What it does (additive; the policies of patients are not touched)
--   1. namibian_region: the 14 regions (as named since 2013) as a domain, so a region is always one of them.
--   2. patients.town (free text: a place not on the list can be typed) and patients.region (one of the 14), both
--      nullable. Staff write them through the existing patients policies; the file's change history records each
--      change (audit_patients_trigger). An index serves "patients by town" lists and reports.
--   3. Checks: the policies of patients did not change.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the forms do not show the town and region fields (they probe the columns first).
-- Undo:
--   DROP INDEX IF EXISTS public.patients_town_idx;
--   ALTER TABLE public.patients DROP COLUMN IF EXISTS region, DROP COLUMN IF EXISTS town;
--   DROP DOMAIN IF EXISTS public.namibian_region;   (after the payer accounts file's undo: payer_accounts uses it)
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'patients' AND column_name IN ('town', 'region')
                AND data_type <> 'text') THEN
    RAISE EXCEPTION 'Stopped: patients.town or patients.region exists with another type';
  END IF;
  PERFORM set_config('onehealth.patient_policies_before', (
    SELECT md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname))
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients'
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The 14 regions (the same list as NAMIBIAN_REGIONS in src/utils/address/namibianTowns.ts)
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regtype('public.namibian_region') IS NULL THEN
    CREATE DOMAIN public.namibian_region AS text CHECK (VALUE IN (
      'Erongo', 'Hardap', '//Kharas', 'Kavango East', 'Kavango West', 'Khomas', 'Kunene', 'Ohangwena', 'Omaheke',
      'Omusati', 'Oshana', 'Oshikoto', 'Otjozondjupa', 'Zambezi'
    ));
  END IF;
END $$;

COMMENT ON DOMAIN public.namibian_region IS
  'One of the 14 regions of Namibia as named since 2013 (//Kharas, Kavango East and West, Zambezi).';

-- ---------------------------------------------------------------------------------------------
-- 2. The patient's town and region
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS town text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS region public.namibian_region;

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_town_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_town_check
  CHECK (town IS NULL OR char_length(btrim(town)) BETWEEN 1 AND 80);

COMMENT ON COLUMN public.patients.town IS
  'The town or settlement the patient lives in (picked from the Namibian towns list, or typed). With region, says where patients live; addresses themselves stay free text.';
COMMENT ON COLUMN public.patients.region IS
  'The region of the patient''s town (filled when a town is picked from the list; chosen by hand for a typed place).';

-- Patients by town (lists and reports)
CREATE INDEX IF NOT EXISTS patients_town_idx ON public.patients (practice_id, town) WHERE town IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 3. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY policyname))
        FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients')
     IS DISTINCT FROM current_setting('onehealth.patient_policies_before', true) THEN
    RAISE EXCEPTION 'Check failed: a policy of patients changed';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'patients' AND column_name IN ('town', 'region')) <> 2 THEN
    RAISE EXCEPTION 'Check failed: patients.town and patients.region are not both there';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

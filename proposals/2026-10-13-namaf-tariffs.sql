-- Applied 2026-10-13 as migration namaf_tariffs_2026_10_13 (version 20261013215212; stored statement md5 3a7908d76053db16505ed8b3eb8e881b = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left): a malformed row was refused (23514)
-- and the same discipline, code and start date twice (23505); the practice administrator, a doctor and OneHealth
-- support read the 2 invented rows and the discipline view, and could not insert, change or delete (42501); a
-- patient-app login read 0 rows and could not write (42501); the public key could read neither (42501).
-- =============================================================================================
-- PROPOSAL: the NAMAF 2026 benchmark tariff list for every discipline and every fund (parity E1, A5, E2, D14, F20, O1)
-- File:   proposals/2026-10-13-namaf-tariffs.sql                     Drafted: 2026-10-13 (agent tariffs)
-- Code:   src/utils/billing/namafTariffs.ts (practice type -> NAMAF discipline, the merge into the practice's list,
--         codes with no fixed amount; tested), src/services/namafTariffService.ts (reads, the practice's choice),
--         src/services/practiceTariffService.ts (loadPracticeTariffRows adds the list: visit billing, quotes),
--         src/components/tariffs/NamafListNote.tsx (Admin > Tariffs > Practice tariff), the inpatient ward setup
--
-- Why
--   Only dentistry had a price list (practice_tariffs: 179 dental codes, NAMAF 2025). GP, specialist, optometry,
--   physiotherapy, psychology and every other practice typed each code and price by hand. The owner's file
--   NAMAF_tariffs_NMC_0001.xlsx holds the NAMAF tariff list in force on 13 Oct 2026 for 144 disciplines (43,985 lines,
--   valid 1 Jan - 31 Dec 2026; three blood transfusion lines from 1 Jun 2026). Owner, 13 Oct 2026: it is the NAMAF
--   benchmark for ALL medical aids (the "Scheme 0001" line in the file is where it was extracted, not a limit), the
--   default price for every practice of the matching discipline. Fund lists that exist (PSEMAS dental, fund_tariffs)
--   and a practice's own prices (practice_own_tariffs) still win.
--
-- What it does (additive; practice_tariffs, fund_tariffs and their policies are not touched)
--   1. namaf_tariffs: one row per discipline, code and start date: the file's five-digit tariff code (as funds print
--      it on statements: 08101, 00190, 72001), the NAMAF code that is billed and claimed (8101, 0190, 001), the
--      description, the amount in N$ (NULL or 0: no fixed amount; priced by rule, at cost or by arrangement, so staff
--      type the amount when billing), the NAMAF units, and the dates. Rows come from the owner's file only, loaded
--      by the scratchpad script (below), never typed by staff.
--   2. namaf_tariff_disciplines: the disciplines in the list with their number of codes, priced codes and dates (the
--      Tariffs page's "which list" chooser and its source line).
--   3. Row level security: signed-in staff read (reference prices, no patient data); nobody writes through the API.
--      Patient-app logins read nothing (portal_staff_only).
--   Which discipline a practice bills from is decided in the app: the practice type's discipline (medical -> 014
--   general practitioner, dental -> 054, optometry -> 070, ...), or the one an administrator chose on the Tariffs
--   page (practice_settings 'namaf_discipline', e.g. 010 anaesthetist for a practice of type medical).
--
-- How the rows were loaded (not part of this file: 43,985 lines do not belong in git)
--   scratchpad namaf/tariffs-encode.cjs reads the xlsx, cleans it (codes upper case letters and digits only:
--   "576430<nbsp>" -> 576430, "Modifiers" -> MODIFIERS; descriptions with the broken characters repaired:
--   "RINNÃ‰" -> RINNÉ, stray non-breaking spaces removed; empty descriptions NULL; Excel dates to dates), packs the
--   rows into 58 text chunks with an md5 each, loaded through execute_sql into namaf_load.payload (a load-only schema
--   the API does not expose) and parsed into namaf_tariffs in one statement (INSERT ... ON CONFLICT DO NOTHING on
--   discipline_code, tariff_code, valid_from: running it again adds nothing). The statement refused to insert unless all
--   58 chunks were intact and the rows per discipline and an md5 over every field of every row equalled the file's;
--   namaf_load was then dropped. Loaded 14 Oct 2026: 43,985 rows in 144 disciplines, 33,017 with an amount (the file
--   has 33,017 lines with one), 10,933 with an amount of 0 and 35 with none.
--
-- Apply: run the part between BEGIN; and ROLLBACK; as one migration. Until it is applied (and loaded) the app works as
-- before: practices without a shared list see no codes and the Tariffs page says the NAMAF list is not set up yet.
-- Undo:  DROP VIEW IF EXISTS public.namaf_tariff_disciplines; DROP TABLE IF EXISTS public.namaf_tariffs;
--        DELETE FROM public.practice_settings WHERE setting_key = 'namaf_discipline';
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The list
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.namaf_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The NAMAF discipline as in the file: 014 general practitioner, 054 dentist, 014003 a sub-type of 014
  discipline_code text NOT NULL CHECK (discipline_code ~ '^[0-9]{3}([0-9]{3})?$'),
  discipline_name text NOT NULL CHECK (char_length(btrim(discipline_name)) BETWEEN 1 AND 80),
  -- The file's tariff code: the five-digit form funds print on statements (08101, 00190, 72001)
  tariff_code text NOT NULL CHECK (tariff_code ~ '^[0-9A-Z]{1,12}$'),
  -- The NAMAF code billed and claimed (8101, 0190, 001)
  code text NOT NULL CHECK (code ~ '^[0-9A-Z]{1,10}$'),
  description text CHECK (description IS NULL OR char_length(description) <= 300),
  -- N$. NULL or 0: no fixed amount (by rule, at cost, by arrangement): staff type the amount when billing
  amount numeric(12, 2) CHECK (amount IS NULL OR (amount >= 0 AND amount <= 1000000)),
  -- NAMAF units (amount = units x the discipline's unit value where the code is unit-priced)
  units numeric(10, 2) CHECK (units IS NULL OR units >= 0),
  valid_from date NOT NULL,
  valid_to date CHECK (valid_to IS NULL OR valid_to >= valid_from),
  -- Where the row came from (file and date in force)
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT namaf_tariffs_version_key UNIQUE (discipline_code, tariff_code, valid_from)
);

COMMENT ON TABLE public.namaf_tariffs IS
  'The NAMAF benchmark tariff list per discipline (all funds), loaded from the owner''s file. The app adds the practice''s discipline to its price list: fund lists and the practice''s own prices win (src/utils/billing/namafTariffs.ts). Read-only for staff.';

CREATE INDEX IF NOT EXISTS namaf_tariffs_by_discipline ON public.namaf_tariffs (discipline_code, code);

-- ---------------------------------------------------------------------------------------------
-- 2. The disciplines in the list (the Tariffs page's chooser and source line)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.namaf_tariff_disciplines
WITH (security_invoker = true) AS
SELECT discipline_code,
       min(discipline_name) AS discipline_name,
       count(*)::integer AS codes,
       (count(*) FILTER (WHERE amount > 0))::integer AS priced_codes,
       min(valid_from) AS valid_from,
       max(valid_to) AS valid_to,
       min(source) AS source
FROM public.namaf_tariffs
GROUP BY discipline_code;

COMMENT ON VIEW public.namaf_tariff_disciplines IS 'namaf_tariffs per discipline: codes, priced codes, dates. RLS of namaf_tariffs applies (security_invoker).';

-- ---------------------------------------------------------------------------------------------
-- 3. Who reads it: signed-in staff; nobody writes through the API
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.namaf_tariffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.namaf_tariffs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.namaf_tariff_disciplines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.namaf_tariffs TO authenticated;
GRANT SELECT ON public.namaf_tariff_disciplines TO authenticated;

DROP POLICY IF EXISTS namaf_tariffs_read ON public.namaf_tariffs;
CREATE POLICY namaf_tariffs_read ON public.namaf_tariffs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())));

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.namaf_tariffs';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.namaf_tariffs AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT policyname, permissive, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'namaf_tariffs' ORDER BY policyname;

SELECT has_table_privilege('anon', 'public.namaf_tariffs', 'SELECT') AS anon_reads,
       has_table_privilege('authenticated', 'public.namaf_tariffs', 'INSERT') AS staff_insert,
       has_table_privilege('authenticated', 'public.namaf_tariffs', 'SELECT') AS staff_read;

ROLLBACK;

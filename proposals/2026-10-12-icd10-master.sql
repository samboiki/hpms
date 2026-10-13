-- Applied 2026-10-12 as migration icd10_master_search_2026_10_12 (version 20261012152533; stored statement md5 e70ad47e0184ba52d0ca071c2fd6cf02 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed), which re-ran this whole (repeatable) file to make the search SECURITY DEFINER; the first version went in as icd10_master_2026_10_12 (version 20261012151103, md5 debc6e73a8cfdfb094c71ee3f1600101). Then loaded: 41,008 codes (scripts/db/load-icd10-mit.ts).
-- Rehearsed with simulated logins, first on 11 sample codes, then on the loaded list: a staff login read 41,008 codes;
-- 'J06' found J06, J06.0, J06.8, J06.9 (exact code first, then in order), 'a000' found A00.0, 'acute resp' J06.9 first,
-- 'asthma' J45.9 first; a discontinued code (C14.1) was found only when typed in full; morphology (M8000/0) and
-- X-placeholder (M45.X0) codes were left out; LIKE wildcards and tsquery syntax were ignored; 3 searches took 20 ms
-- (1,387 ms as SECURITY INVOKER); direct inserts and updates were refused (42501); a patient-app login read and found
-- 0 rows; the public key can neither read nor search (42501).
-- =============================================================================================
-- PROPOSAL: the full ICD-10 list the medical aids validate claims against (parity E14)
-- File:   proposals/2026-10-12-icd10-master.sql                         Drafted: 2026-10-12
-- Data:   scripts/db/load-icd10-mit.ts loads the South African ICD-10 Master Industry Table (MIT 2021, 41,008 codes;
--         Namibian funds use it too) with the service key, after this file is applied; run it again for a newer MIT.
-- Code:   src/utils/billing/icd10Master.ts (the list's rules for the code picker and claim review; tested),
--         src/services/icd10Service.ts (search and look-up), src/hooks/useIcd10Search.ts,
--         src/components/billing/Icd10SearchInput.tsx (the one code search on every screen that chooses a code)
--
-- Why (parity E14): the app knew about 45 codes and checked only a code's shape, so a practitioner had to know codes by
-- heart and the funds rejected claims for codes that look right but are not usable: a category heading (J06 instead
-- of J06.9), an asterisk code as the main diagnosis, codes that are not in the list at all.
--
-- What it does (additive; nothing else changes)
--   1. icd10_codes: one row per code as the list writes it (A00.0), with its 3-character category, chapter and group,
--      the five flags (valid for clinical use, valid as the main diagnosis, asterisk, dagger, sequelae), the age range
--      and sex it is meant for, its South African status (A added, M modified, D discontinued) and dates, and the
--      list it came from ('SA MIT 2021').
--   2. Indexes: a code or the start of one (text_pattern_ops for LIKE 'J06%'), and the words of the description
--      (full-text search with the built-in 'simple' configuration: no new extension).
--   3. RLS: signed-in users read it; the public key gets nothing; nobody writes it except migrations and the service
--      key (the load script).
--   4. search_icd10_codes(code, words, limit): codes that start with the code typed, or whose description has every
--      word typed; the exact code first, then codes in order, then usable codes, descriptions that start with the
--      first word, shorter codes and descriptions. Only codes a claim line can carry; a discontinued code only when
--      typed in full. SECURITY DEFINER with the tables' rule inside (staff logins only): under RLS the planner may not
--      use the description index (the @@ operator is not leakproof) and every search read all 41,008 descriptions
--      (450 ms instead of 6 ms). EXECUTE for signed-in users only.
--   5. The patient app's staff-only guard, as on every OneHealth table (when the portal is set up).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration, then run: npx tsx scripts/db/load-icd10-mit.ts <path to the MIT .xlsx>. Until both are done the code
-- picker says the full list is not set up yet, free entry works as before and claim review checks codes by shape only.
-- Undo: DROP FUNCTION IF EXISTS public.search_icd10_codes(text, text[], integer);
--       DROP TABLE IF EXISTS public.icd10_codes;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The list
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.icd10_codes (
  -- As the list writes it: A00, A00.0, S52.50, M45.X0 (X holds the 4th place), M8000/0 (the morphology of a tumour)
  code text PRIMARY KEY CHECK (code ~ '^[A-Z][0-9A-Z./]{2,7}$'),
  -- The 3-character category it belongs to (A00; morphology rows have their own, M800)
  three_char_code text NOT NULL,
  -- The WHO full description
  description text NOT NULL,
  chapter_no text NOT NULL,
  chapter_description text NOT NULL,
  -- The block of clinically similar codes: 001 (A00-A09)
  group_code text NOT NULL,
  group_description text NOT NULL,
  -- False for a category heading: a more specific code exists, and the funds reject the heading
  valid_clinical_use boolean NOT NULL,
  -- False when the code may not be the main (first) diagnosis of a claim line
  valid_primary boolean NOT NULL,
  -- An asterisk (*) code names how a disease shows itself and follows the code of its cause
  is_asterisk boolean NOT NULL,
  -- A dagger code names the cause that an asterisk code goes with
  is_dagger boolean NOT NULL,
  -- A sequelae code: the late effect of an earlier condition
  is_sequelae boolean NOT NULL,
  -- As written in the list: '≤ 19 years', '> 19 years'; null for any age
  age_range text,
  -- M or F: the code is for one sex; null (or U) for either
  gender text CHECK (gender IN ('M', 'F', 'U')),
  -- South African status: A added, M modified, D discontinued (a discontinued code stays in the list)
  status text CHECK (status IN ('A', 'D', 'M')),
  who_start_date date,
  who_end_date date,
  sa_start_date date,
  -- The day the code stopped being valid in South Africa
  sa_end_date date,
  -- The list the row came from, for example 'SA MIT 2021'
  source text NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.icd10_codes IS
  'The ICD-10 list the medical aids validate claims against (South African ICD-10 Master Industry Table; Namibian funds use it too). Loaded by scripts/db/load-icd10-mit.ts with the service key; read by signed-in users.';

-- ---------------------------------------------------------------------------------------------
-- 2. Finding a code: by the start of the code, or by the words of its description
-- ---------------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS icd10_codes_code_prefix ON public.icd10_codes (code text_pattern_ops);
CREATE INDEX IF NOT EXISTS icd10_codes_description_words ON public.icd10_codes USING gin (to_tsvector('simple'::regconfig, description));

-- ---------------------------------------------------------------------------------------------
-- 3. Who reads it: signed-in users; nobody writes it except migrations and the service key
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.icd10_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.icd10_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.icd10_codes TO authenticated;

DROP POLICY IF EXISTS icd10_codes_read ON public.icd10_codes;
CREATE POLICY icd10_codes_read ON public.icd10_codes FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------------------------
-- 4. The code search every screen that chooses a code uses
-- ---------------------------------------------------------------------------------------------

-- p_code: the start of a code as the app tidied it ("a000" -> A00.0); anything else is ignored.
-- p_words: words that must each start a word of the description; only letters and digits reach to_tsquery.
-- SECURITY DEFINER so the description index is used (see the header); the staff rule of the table's policies is the
-- first condition below, and the function only reads.
CREATE OR REPLACE FUNCTION public.search_icd10_codes(p_code text, p_words text[], p_limit integer DEFAULT 30)
RETURNS SETOF public.icd10_codes
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH q AS MATERIALIZED (
    SELECT
      CASE WHEN p_code ~ '^[A-Z][0-9]{1,2}(\.[0-9]{1,2})?$' THEN p_code END AS code,
      (SELECT to_tsquery('simple', string_agg(word || ':*', ' & '))
         FROM (SELECT DISTINCT lower(item) AS word
                 FROM unnest(p_words) AS item
                WHERE item ~ '^[A-Za-z0-9]{1,30}$'
                LIMIT 8) AS words) AS words,
      (SELECT lower(item)
         FROM unnest(p_words) WITH ORDINALITY AS typed(item, position)
        WHERE item ~ '^[A-Za-z0-9]{1,30}$'
        ORDER BY position
        LIMIT 1) AS first_word
  ),
  -- The start of the code (a quick pass over the codes), or every word (through the description index)
  matched AS (
    SELECT c.code FROM public.icd10_codes c WHERE c.code LIKE (SELECT q.code FROM q) || '%'
    UNION
    SELECT c.code FROM public.icd10_codes c WHERE to_tsvector('simple'::regconfig, c.description) @@ (SELECT q.words FROM q)
  )
  SELECT c.*
    FROM public.icd10_codes c
    JOIN matched USING (code)
   CROSS JOIN q
   -- Staff logins only, as the table's policies (a users row; the public key cannot run this at all)
   WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid())
     -- Only codes a claim line can carry: a morphology code (M8000/0) holds the "/" that separates the codes of a
     -- claim line, and an X-placeholder code (M45.X0) does not fit the ICD-10 columns of invoice lines and claims
     AND c.code ~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$'
     -- A discontinued code only when it is typed in full, so the picker can say it is no longer valid
     AND (c.status IS DISTINCT FROM 'D' OR c.code = q.code)
   ORDER BY
     CASE WHEN c.code = q.code THEN 0 WHEN c.code LIKE q.code || '%' THEN 1 ELSE 2 END,
     CASE WHEN c.code LIKE q.code || '%' THEN c.code END,
     c.valid_clinical_use DESC,
     (lower(c.description) LIKE q.first_word || '%') IS TRUE DESC,
     length(c.code),
     length(c.description),
     c.code
   LIMIT least(greatest(COALESCE(p_limit, 30), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.search_icd10_codes(text, text[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_icd10_codes(text, text[], integer) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.icd10_codes';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.icd10_codes AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT policyname, permissive, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'icd10_codes' ORDER BY policyname;

SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'icd10_codes' ORDER BY indexname;

SELECT has_table_privilege('anon', 'public.icd10_codes', 'SELECT') AS anon_reads,
       has_table_privilege('authenticated', 'public.icd10_codes', 'SELECT') AS staff_read,
       has_table_privilege('authenticated', 'public.icd10_codes', 'INSERT') AS staff_insert_directly,
       has_function_privilege('anon', 'public.search_icd10_codes(text, text[], integer)', 'EXECUTE') AS anon_searches,
       has_function_privilege('authenticated', 'public.search_icd10_codes(text, text[], integer)', 'EXECUTE') AS staff_search;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

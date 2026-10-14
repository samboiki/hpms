-- Applied 2026-10-14 as migration icd10_rules_2026_10_14 (version 20261014025230, UTC; stored statement md5 59dee450bdefb6a67238b612e1167ace = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left): on insert, upsert and update the triggers
-- refused a code not in the list, a heading (Z23), a code that is not a main code, an external cause code (V01.0, W19), an
-- asterisk code, a code listed twice, an empty entry, a pattern that is not a regular expression (also as an exclude pattern), a
-- pattern or exclude pattern that matches empty text, a discipline that is not 3 or 6 digits or not in the NAMAF list (23514); no
-- codes, seven codes, a bad rule key, a short reason and no author were refused by the column checks (23514), the same rule key or
-- row twice by the keys (23505); codes typed with spaces or lower case were stored tidy. The practice's administrator, a doctor,
-- OneHealth support and a doctor of another practice read both tables and could not insert, change, delete or truncate (42501); an
-- inactive user and a patient-app login saw 0 rows; the public key was refused (42501); the app's logins cannot run the check
-- functions or use the counter. Applied statement checked again: both tables exist and were empty; running the applied
-- statement again changed nothing (2 triggers, 4 policies), and a code marked discontinued (status D) was refused too.
-- =============================================================================================
-- PROPOSAL: more ICD-10 suggestions for NAMAF codes: the rules table and each discipline's common diagnoses
-- File:   proposals/2026-10-14-icd10-rules.sql                           Drafted: 2026-10-14 (agent icd10-engine)
-- Code:   proposals/2026-10-14-icd10-rule-functions.sql (the functions the app calls and the coverage report),
--         src/utils/billing/tariffIcd10Suggestions.ts, src/services/tariffIcd10SuggestionService.ts,
--         src/hooks/useTariffIcd10Suggestions.ts, the ICD-10 code box under a billing line
--
-- Why
--   Owner, 14 Oct 2026: the 275 reviewed starter links (proposals/2026-10-14-tariff-icd10-suggestions*.sql) are far too
--   few; "find more". There is still no official table from NAMAF or the funds that ties a tariff code to ICD-10 codes
--   (NAMAF Circular 4 of 2025 only asks for an ICD-10 code on every claim line), so everything added here is a
--   SUGGESTION the practitioner confirms, labelled honestly. Two tables of reference data hold it:
--     1. namaf_icd10_rules: "a NAMAF line whose wording matches this pattern is usually done for these conditions"
--        (appendicectomy -> K35.8, K36, K37). One rule reaches every code whose wording fits, in every discipline it
--        names (or in all), so a few hundred rules reach thousands of codes.
--     2. namaf_discipline_common_icd10: the diagnoses most common in each kind of practice (20-40 per discipline), for
--        consultations and for anything no rule covers.
--   Other agents write the rows (with execute_sql, in batches); this file only makes the places and the safeguards.
--
-- What it does (additive; no existing table or policy changes)
--   1. namaf_icd10_rules and namaf_discipline_common_icd10, shaped as agreed in the wave 12 brief.
--   2. A trigger on each that refuses a row whose ICD-10 code is not valid as the main code of a claim line in the
--      medical aids' list (public.icd10_codes: usable clinically, usable as a primary code, not an asterisk code, not
--      discontinued, never an external cause code V-Y; the same test as the starter list's check), a pattern that is
--      not a valid regular expression or that matches every wording, a discipline that is not in the NAMAF list, or a
--      code listed twice in one rule. The codes are tidied on the way in (spaces, capitals). One shared test:
--      icd10_unusable_main_codes(). The checks that read the NAMAF list run only when it is loaded.
--   3. Row security as on the starter list: signed-in staff read (an inactive user and the patient app's logins see
--      nothing; the public key has no access at all); nobody writes through the API: the rows are reference data
--      loaded with execute_sql by the database owner.
--   Needs the ICD-10 list (proposals/2026-10-12-icd10-master.sql). The NAMAF table is not needed to apply this file.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until it is applied, and while the tables are empty, the billing line offers what it offered before.
-- Undo: DROP TABLE IF EXISTS public.namaf_discipline_common_icd10;
--       DROP TABLE IF EXISTS public.namaf_icd10_rules;
--       DROP FUNCTION IF EXISTS public.namaf_discipline_common_icd10_check();
--       DROP FUNCTION IF EXISTS public.namaf_icd10_rules_check();
--       DROP FUNCTION IF EXISTS public.icd10_unusable_main_codes(text[]);
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The two tables
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.namaf_icd10_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- A short name for the rule, for example 'surg-appendix'
  rule_key text NOT NULL UNIQUE CHECK (rule_key ~ '^[a-z0-9][a-z0-9._-]{1,98}[a-z0-9]$'),
  -- NULL = any discipline; else the NAMAF disciplines it applies to, for example {042,042001,114}. A rule for a main
  -- discipline (014) also applies to its sub-types (014003).
  discipline_codes text[] CHECK (discipline_codes IS NULL OR cardinality(discipline_codes) BETWEEN 1 AND 150),
  -- Case-insensitive POSIX regular expression on namaf_tariffs.description (\m and \M mark the start and end of a word)
  pattern text NOT NULL CHECK (char_length(btrim(pattern)) BETWEEN 2 AND 500),
  -- A line that matches this as well is left out
  exclude_pattern text CHECK (exclude_pattern IS NULL OR char_length(btrim(exclude_pattern)) BETWEEN 2 AND 500),
  -- One to six codes, most likely first; each valid as a main code (checked by the trigger)
  icd10 text[] NOT NULL CHECK (cardinality(icd10) BETWEEN 1 AND 6),
  -- In plain words, shown to staff under the code: 'Usual reasons for removing the appendix'
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 160),
  -- Who wrote the rule
  author text NOT NULL CHECK (char_length(btrim(author)) BETWEEN 2 AND 60),
  -- true once a person has checked the rule
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.namaf_icd10_rules IS
  'Rules that suggest ICD-10 codes for NAMAF lines by their wording (appendicectomy: K35.8, K36, K37). Suggestions only, confirmed by the practitioner; not a NAMAF or fund table. Reference data loaded by the database owner; the triggers refuse codes the medical aids'' list does not accept as a main code.';

CREATE TABLE IF NOT EXISTS public.namaf_discipline_common_icd10 (
  -- The NAMAF discipline as in namaf_tariffs: 014 general practitioner, 014003 a sub-type of 014
  discipline_code text NOT NULL CHECK (discipline_code ~ '^[0-9]{3}([0-9]{3})?$'),
  icd10 text NOT NULL,
  -- 1 is the most common diagnosis of the discipline
  rank int NOT NULL CHECK (rank BETWEEN 1 AND 99),
  -- In plain words, shown to staff: 'One of the most common diagnoses in general practice'
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 160),
  -- The published list it comes from (web address and title), if there is one
  source text CHECK (source IS NULL OR char_length(btrim(source)) BETWEEN 5 AND 500),
  author text NOT NULL CHECK (char_length(btrim(author)) BETWEEN 2 AND 60),
  reviewed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (discipline_code, icd10)
);

COMMENT ON TABLE public.namaf_discipline_common_icd10 IS
  'The diagnoses most common in each NAMAF discipline, offered as suggestions in the ICD-10 box of a billing line. Suggestions only, confirmed by the practitioner. Reference data loaded by the database owner; the trigger refuses codes the medical aids'' list does not accept as a main code.';

-- ---------------------------------------------------------------------------------------------
-- 2. The checks: one test for "usable as the main code of a claim line", and a trigger on each table
-- ---------------------------------------------------------------------------------------------

-- The codes (in the order given) that cannot be the main code of a claim line, as one text; NULL when all can. The test of
-- the starter list's checks (proposals/2026-10-14-tariff-icd10-suggestions.sql section 6), with external causes excluded
-- as the starter table's own check does.
CREATE OR REPLACE FUNCTION public.icd10_unusable_main_codes(p_codes text[])
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT string_agg(COALESCE(NULLIF(btrim(t.code), ''), '(empty)'), ', ' ORDER BY t.pos)
    FROM unnest(p_codes) WITH ORDINALITY AS t(code, pos)
    LEFT JOIN public.icd10_codes c ON c.code = upper(btrim(t.code))
   WHERE c.code IS NULL OR NOT c.valid_clinical_use OR NOT c.valid_primary OR c.is_asterisk
      OR COALESCE(c.status, '') = 'D' OR c.code ~ '^[VWXY]'
$$;

COMMENT ON FUNCTION public.icd10_unusable_main_codes(text[]) IS
  'Which of these ICD-10 codes cannot be the main code of a claim line in the medical aids'' list (unknown, heading, asterisk, discontinued, external cause); NULL when all can. Used by the triggers of the ICD-10 rule tables.';

CREATE OR REPLACE FUNCTION public.namaf_icd10_rules_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bad text;
BEGIN
  -- The codes, tidied (spaces, capitals), each once, each usable as the main code of a claim line
  NEW.icd10 := ARRAY(SELECT upper(btrim(t.code)) FROM unnest(NEW.icd10) WITH ORDINALITY AS t(code, pos) ORDER BY t.pos);
  v_bad := public.icd10_unusable_main_codes(NEW.icd10);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Rule %: these ICD-10 codes cannot be the main code of a claim line in the medical aids'' list (spell them with the dot, for example K35.8): %', NEW.rule_key, v_bad
      USING ERRCODE = '23514';
  END IF;
  IF (SELECT count(DISTINCT c) <> count(*) FROM unnest(NEW.icd10) AS c) THEN
    RAISE EXCEPTION 'Rule %: an ICD-10 code is listed twice', NEW.rule_key USING ERRCODE = '23514';
  END IF;

  -- The patterns must be valid regular expressions, and must not match every wording (an empty text matches such a pattern)
  BEGIN
    IF '' ~* NEW.pattern THEN
      RAISE EXCEPTION 'Rule %: the pattern also matches empty text, so it would match every line: %', NEW.rule_key, NEW.pattern USING ERRCODE = '23514';
    END IF;
  EXCEPTION WHEN invalid_regular_expression THEN
    RAISE EXCEPTION 'Rule %: the pattern is not a valid regular expression: %', NEW.rule_key, NEW.pattern USING ERRCODE = '23514';
  END;
  IF NEW.exclude_pattern IS NOT NULL THEN
    BEGIN
      IF '' ~* NEW.exclude_pattern THEN
        RAISE EXCEPTION 'Rule %: the exclude pattern also matches empty text, so it would leave out every line: %', NEW.rule_key, NEW.exclude_pattern USING ERRCODE = '23514';
      END IF;
    EXCEPTION WHEN invalid_regular_expression THEN
      RAISE EXCEPTION 'Rule %: the exclude pattern is not a valid regular expression: %', NEW.rule_key, NEW.exclude_pattern USING ERRCODE = '23514';
    END;
  END IF;

  -- The disciplines: 3 digits (014) or 6 for a sub-type (014003), and in the NAMAF list once it is loaded (a typo guard)
  IF NEW.discipline_codes IS NOT NULL THEN
    SELECT string_agg(COALESCE(t.d, '(empty)'), ', ') INTO v_bad
      FROM unnest(NEW.discipline_codes) AS t(d)
     WHERE t.d IS NULL OR t.d !~ '^[0-9]{3}([0-9]{3})?$';
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'Rule %: a discipline code has 3 digits (014), or 6 for a sub-type (014003): %', NEW.rule_key, v_bad USING ERRCODE = '23514';
    END IF;
    IF to_regclass('public.namaf_tariffs') IS NOT NULL AND EXISTS (SELECT 1 FROM public.namaf_tariffs LIMIT 1) THEN
      SELECT string_agg(t.d, ', ') INTO v_bad
        FROM unnest(NEW.discipline_codes) AS t(d)
       WHERE NOT EXISTS (SELECT 1 FROM public.namaf_tariffs n WHERE n.discipline_code = t.d);
      IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'Rule %: not a discipline of the NAMAF tariff list: %', NEW.rule_key, v_bad USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.namaf_discipline_common_icd10_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bad text;
BEGIN
  NEW.icd10 := upper(btrim(NEW.icd10));
  v_bad := public.icd10_unusable_main_codes(ARRAY[NEW.icd10]);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Discipline %: % cannot be the main code of a claim line in the medical aids'' list (spell it with the dot, for example I10)', NEW.discipline_code, v_bad
      USING ERRCODE = '23514';
  END IF;
  IF to_regclass('public.namaf_tariffs') IS NOT NULL AND EXISTS (SELECT 1 FROM public.namaf_tariffs LIMIT 1)
     AND NOT EXISTS (SELECT 1 FROM public.namaf_tariffs n WHERE n.discipline_code = NEW.discipline_code) THEN
    RAISE EXCEPTION 'Discipline %: not a discipline of the NAMAF tariff list', NEW.discipline_code USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS namaf_icd10_rules_check ON public.namaf_icd10_rules;
CREATE TRIGGER namaf_icd10_rules_check BEFORE INSERT OR UPDATE ON public.namaf_icd10_rules
  FOR EACH ROW EXECUTE FUNCTION public.namaf_icd10_rules_check();

DROP TRIGGER IF EXISTS namaf_discipline_common_icd10_check ON public.namaf_discipline_common_icd10;
CREATE TRIGGER namaf_discipline_common_icd10_check BEFORE INSERT OR UPDATE ON public.namaf_discipline_common_icd10
  FOR EACH ROW EXECUTE FUNCTION public.namaf_discipline_common_icd10_check();

-- Internal: only the triggers (and the database owner) run these
REVOKE ALL ON FUNCTION public.icd10_unusable_main_codes(text[]), public.namaf_icd10_rules_check(),
  public.namaf_discipline_common_icd10_check() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Who reads: signed-in staff (reference data); nobody writes through the API
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.namaf_icd10_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.namaf_discipline_common_icd10 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.namaf_icd10_rules, public.namaf_discipline_common_icd10 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.namaf_icd10_rules, public.namaf_discipline_common_icd10 TO authenticated;

-- The rule table's counter is not for the app's logins either
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', pg_get_serial_sequence('public.namaf_icd10_rules', 'id'));
END $$;

DROP POLICY IF EXISTS namaf_icd10_rules_read ON public.namaf_icd10_rules;
CREATE POLICY namaf_icd10_rules_read ON public.namaf_icd10_rules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)));

DROP POLICY IF EXISTS namaf_discipline_common_icd10_read ON public.namaf_discipline_common_icd10;
CREATE POLICY namaf_discipline_common_icd10_read ON public.namaf_discipline_common_icd10 FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)));

-- ---------------------------------------------------------------------------------------------
-- 4. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.namaf_icd10_rules';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.namaf_icd10_rules AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.namaf_discipline_common_icd10';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.namaf_discipline_common_icd10 AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT c.relname AS table_name, c.relrowsecurity AS row_security,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_reads,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS staff_insert_directly,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
  FROM pg_class c
 WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN ('namaf_icd10_rules', 'namaf_discipline_common_icd10')
 ORDER BY c.relname;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

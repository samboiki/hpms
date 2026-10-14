-- Applied 2026-10-14 as migration icd10_rule_functions_2026_10_14_b (version 20261014031230, UTC; stored statement md5 749b9e789ba091a16acc59bd0ca0aa59 = md5 of the part between BEGIN; and ROLLBACK;)
-- (The same file was applied minutes earlier as icd10_rule_functions_2026_10_14, md5 7bfd69ff80327b2a672eeeea9da9d137; it differed only in
-- the OFFSET 0 fence of section 4, which makes the coverage 22 times faster: 5.7 s -> 0.26 s for a discipline with 308 rules.)
-- Rehearsed with simulated logins (rolled back, then checked that nothing was left), with invented rules and common rows: the
-- practice's administrator and a doctor of another practice got the same rows; a rule written for the exact discipline came before
-- one for its main discipline before one for any, a code several rules give came once with the first rule's reason, an exclude
-- pattern left a rule out, a sub-type (014003, 042001) read its main discipline's rules and common list (its own list when it has
-- one), a code typed with spaces or in the five-digit form was found, an unknown code, a bad discipline and an empty code gave
-- nothing, the source of a common diagnosis was passed on only for a reviewed row; an inactive user and a patient-app login got
-- 42501, the public key was refused (42501); the coverage was refused to every login but OneHealth support (42501) and matched a
-- direct count of the codes. Timed with 1,500 invented rules: one call 10 ms; coverage of one discipline 0.4 to 2.7 s, of all 144
-- disciplines 20 s. Timed again on the 1,479 real rules loaded that day: one call 20 ms; one discipline up to 2.6 s; all 144
-- disciplines 32 s (more than the 8 s a signed-in login is given, so a screen asks for one discipline at a time).
-- =============================================================================================
-- PROPOSAL: the functions behind the extra ICD-10 suggestions: procedure rules, a discipline's common diagnoses, coverage
-- File:   proposals/2026-10-14-icd10-rule-functions.sql                   Drafted: 2026-10-14 (agent icd10-engine)
-- Code:   src/utils/billing/tariffIcd10Suggestions.ts (the order and wording of the suggestions; tested),
--         src/services/tariffIcd10SuggestionService.ts (reads), src/hooks/useTariffIcd10Suggestions.ts,
--         the ICD-10 code box under a billing line (Icd10CodeInput > Icd10SearchInput > useIcd10Search)
--
-- Why
--   proposals/2026-10-14-icd10-rules.sql made the two tables of reference data (namaf_icd10_rules: wording rules for
--   procedures; namaf_discipline_common_icd10: the diagnoses most common in each discipline). The billing line reads them
--   through these functions, one tariff code at a time, so no table is ever sent to the browser whole. Everything they
--   return is a SUGGESTION the practitioner confirms; nothing here fills a diagnosis in.
--
-- What it does (additive; no existing table or policy changes)
--   1. icd10_rule_suggestions(discipline, tariff code): the ICD-10 codes, with the rule's reason and key, of the rules whose
--      discipline is any, or the practice's discipline, or (for a sub-type such as 014003) its main discipline (014), and
--      whose pattern matches the NAMAF wording of that code (and whose exclude pattern does not). Order: rules written for
--      the exact discipline, then for its main discipline, then for any; within those the older rule first, and each
--      rule's own code order. A code several rules give is returned once, by the first. Signed-in staff only.
--   2. icd10_discipline_common(discipline): the discipline's common diagnoses, most common first (its own list, else its
--      main discipline's), with the reason; source (the published list a row comes from) only for rows a person has
--      reviewed. Signed-in staff only.
--   3. icd10_suggestion_coverage(discipline): per discipline, for OneHealth support's dashboard: billed codes, codes
--      matched by at least one rule, the share, codes with a starter link, codes with either, and the size of the common
--      list. One discipline answers at once; all of them (no argument) take several seconds once there are many rules.
--      Support only.
--   4. namaf_discipline_keys(discipline): the discipline and, for a sub-type, its main discipline: the one place that
--      knows how a sub-type reads its main discipline's rules and common list. Internal.
--   Needs proposals/2026-10-14-icd10-rules.sql, the NAMAF list (2026-10-13-namaf-tariffs.sql), the starter list
--   (2026-10-14-tariff-icd10-suggestions.sql) and practice isolation's rls_is_super_admin().
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until it is applied the billing line works as before (the app detects the missing functions and offers
-- nothing more).
-- Undo: DROP FUNCTION IF EXISTS public.icd10_suggestion_coverage(text);
--       DROP FUNCTION IF EXISTS public.icd10_discipline_common(text);
--       DROP FUNCTION IF EXISTS public.icd10_rule_suggestions(text, text);
--       DROP FUNCTION IF EXISTS public.namaf_discipline_keys(text);
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. A discipline and its main discipline
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.namaf_discipline_keys(p_discipline text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN length(btrim(p_discipline)) = 6 THEN ARRAY[btrim(p_discipline), left(btrim(p_discipline), 3)]
              WHEN length(btrim(p_discipline)) = 3 THEN ARRAY[btrim(p_discipline)]
              ELSE ARRAY[]::text[] END
$$;

COMMENT ON FUNCTION public.namaf_discipline_keys(text) IS
  'A NAMAF discipline and, for a 6-digit sub-type (014003), its 3-digit main discipline (014): the codes whose rules and common diagnoses the discipline reads. Empty for anything else.';

-- ---------------------------------------------------------------------------------------------
-- 2. The codes the rules suggest for one tariff code
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.icd10_rule_suggestions(p_discipline text, p_tariff_code text)
RETURNS TABLE (icd10 text, reason text, rule_key text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_keys text[] := public.namaf_discipline_keys(p_discipline);
  v_code text := upper(btrim(p_tariff_code));
  v_description text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true)) THEN
    RAISE EXCEPTION 'The ICD-10 suggestions are for signed-in staff.' USING ERRCODE = '42501';
  END IF;
  IF cardinality(v_keys) = 0 OR COALESCE(v_code, '') = '' THEN
    RETURN;
  END IF;

  -- The wording of the code in this discipline's newest list; when a discipline lists a code twice, the row whose
  -- five-digit form is the code itself, as billing offers it (namafRowsAsTariffs)
  SELECT n.description INTO v_description
    FROM public.namaf_tariffs n
   WHERE n.discipline_code = v_keys[1]
     AND (n.code = v_code OR n.tariff_code = v_code)
     AND btrim(COALESCE(n.description, '')) <> ''
   ORDER BY n.valid_from DESC, (ltrim(n.tariff_code, '0') = ltrim(n.code, '0')) DESC, n.tariff_code
   LIMIT 1;
  IF v_description IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH hits AS (
    SELECT r.id AS rule_id, r.rule_key AS rkey, r.reason AS rreason, u.code AS icd, u.pos,
           CASE WHEN r.discipline_codes IS NULL THEN 2 WHEN r.discipline_codes @> ARRAY[v_keys[1]] THEN 0 ELSE 1 END AS closeness
      FROM public.namaf_icd10_rules r
     CROSS JOIN LATERAL unnest(r.icd10) WITH ORDINALITY AS u(code, pos)
     WHERE (r.discipline_codes IS NULL OR r.discipline_codes && v_keys)
       AND v_description ~* r.pattern
       AND (r.exclude_pattern IS NULL OR v_description !~* r.exclude_pattern)
  ),
  first_rule AS (
    SELECT DISTINCT ON (h.icd) h.icd, h.rreason, h.rkey, h.closeness, h.rule_id, h.pos
      FROM hits h
     ORDER BY h.icd, h.closeness, h.rule_id, h.pos
  )
  SELECT f.icd, f.rreason, f.rkey
    FROM first_rule f
   ORDER BY f.closeness, f.rule_id, f.pos;
END
$$;

COMMENT ON FUNCTION public.icd10_rule_suggestions(text, text) IS
  'ICD-10 codes the wording rules suggest for one NAMAF code of a discipline (a sub-type also reads its main discipline''s rules): code, the rule''s reason in plain words, the rule''s key. Suggestions only; staff only.';

-- ---------------------------------------------------------------------------------------------
-- 3. A discipline's common diagnoses
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.icd10_discipline_common(p_discipline text)
RETURNS TABLE (icd10 text, reason text, rank integer, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_keys text[] := public.namaf_discipline_keys(p_discipline);
  v_use text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_active, true)) THEN
    RAISE EXCEPTION 'The ICD-10 suggestions are for signed-in staff.' USING ERRCODE = '42501';
  END IF;

  -- The discipline's own list; a sub-type without one reads its main discipline's
  SELECT k.key INTO v_use
    FROM unnest(v_keys) WITH ORDINALITY AS k(key, pos)
   WHERE EXISTS (SELECT 1 FROM public.namaf_discipline_common_icd10 c WHERE c.discipline_code = k.key)
   ORDER BY k.pos
   LIMIT 1;
  IF v_use IS NULL THEN
    RETURN;
  END IF;

  -- The source (the published list a row comes from) is only passed on once a person has reviewed the row
  RETURN QUERY
  SELECT c.icd10, c.reason, c.rank, CASE WHEN c.reviewed THEN c.source END
    FROM public.namaf_discipline_common_icd10 c
   WHERE c.discipline_code = v_use
   ORDER BY c.rank, c.icd10;
END
$$;

COMMENT ON FUNCTION public.icd10_discipline_common(text) IS
  'The diagnoses most common in a NAMAF discipline (a sub-type without a list of its own reads its main discipline''s), most common first: code, reason in plain words, rank, and the published list it comes from once a person has reviewed the row. Suggestions only; staff only.';

-- ---------------------------------------------------------------------------------------------
-- 4. Coverage, for OneHealth support's dashboard
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.icd10_suggestion_coverage(p_discipline text DEFAULT NULL)
RETURNS TABLE (
  discipline_code text,
  discipline_name text,
  codes integer,
  codes_with_rule integer,
  share_with_rule numeric,
  codes_with_starter integer,
  codes_with_any integer,
  common_size integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_d text;
BEGIN
  IF NOT public.rls_is_super_admin() THEN
    RAISE EXCEPTION 'Only OneHealth support can read the ICD-10 coverage.' USING ERRCODE = '42501';
  END IF;

  -- One discipline at a time: the rules that apply to it, each tried against that discipline's codes (a rule is the
  -- outer loop, so Postgres compiles its pattern once and not again for every code; see OFFSET 0 below)
  FOR v_d IN
    SELECT DISTINCT n.discipline_code FROM public.namaf_tariffs n WHERE p_discipline IS NULL OR n.discipline_code = btrim(p_discipline) ORDER BY 1
  LOOP
    RETURN QUERY
    WITH cur AS MATERIALIZED (
      -- The newest version of each tariff code of the discipline (a code listed twice counts once below)
      SELECT n.code AS c, NULLIF(btrim(n.description), '') AS descr
        FROM public.namaf_tariffs n
       WHERE n.discipline_code = v_d
         AND n.valid_from = (SELECT max(m.valid_from) FROM public.namaf_tariffs m WHERE m.discipline_code = n.discipline_code AND m.tariff_code = n.tariff_code)
    ),
    applicable AS MATERIALIZED (
      SELECT r.pattern, r.exclude_pattern
        FROM public.namaf_icd10_rules r
       WHERE r.discipline_codes IS NULL OR r.discipline_codes && public.namaf_discipline_keys(v_d)
    ),
    matched AS MATERIALIZED (
      SELECT DISTINCT m.c
        FROM applicable a
       CROSS JOIN LATERAL (
         SELECT l.c FROM cur l
          WHERE l.descr ~* a.pattern AND (a.exclude_pattern IS NULL OR l.descr !~* a.exclude_pattern)
          -- OFFSET 0 keeps this a fence: without it the planner may loop over the codes on the outside and read the whole
          -- rule list again for each of them, so every pattern is compiled again for every code (22 times slower)
          OFFSET 0
       ) m
    ),
    starter AS (
      SELECT DISTINCT s.code AS c FROM public.namaf_tariff_icd10_suggestions s WHERE s.discipline_code = v_d
    ),
    totals AS (
      SELECT (SELECT count(DISTINCT l.c) FROM cur l)::integer AS n_codes,
             (SELECT count(*) FROM matched)::integer AS n_rule,
             (SELECT count(DISTINCT l.c) FROM cur l WHERE l.c IN (SELECT c FROM starter))::integer AS n_starter,
             (SELECT count(DISTINCT l.c) FROM cur l WHERE l.c IN (SELECT c FROM starter UNION SELECT c FROM matched))::integer AS n_any
    )
    SELECT v_d,
           (SELECT n.discipline_name FROM public.namaf_tariffs n WHERE n.discipline_code = v_d LIMIT 1),
           t.n_codes, t.n_rule, round(100.0 * t.n_rule / NULLIF(t.n_codes, 0), 1), t.n_starter, t.n_any,
           (SELECT count(*)::integer FROM public.icd10_discipline_common(v_d))
      FROM totals t;
  END LOOP;
END
$$;

COMMENT ON FUNCTION public.icd10_suggestion_coverage(text) IS
  'Per NAMAF discipline (or one): codes in its newest list, codes matched by at least one ICD-10 rule, the share in percent, codes with a starter link, codes with either, and the size of its common-diagnoses list. Counts every line of the list (consultations, materials and fees too). One discipline takes a second or two; all of them take longer. OneHealth support only.';

-- ---------------------------------------------------------------------------------------------
-- 5. Who may run them: signed-in users (each checks for staff or support itself); never the public key
-- ---------------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.namaf_discipline_keys(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.icd10_rule_suggestions(text, text), public.icd10_discipline_common(text),
  public.icd10_suggestion_coverage(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.icd10_rule_suggestions(text, text), public.icd10_discipline_common(text),
  public.icd10_suggestion_coverage(text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_runs,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS staff_run,
       pg_get_function_result(p.oid) AS returns
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN ('namaf_discipline_keys', 'icd10_rule_suggestions', 'icd10_discipline_common', 'icd10_suggestion_coverage')
 ORDER BY p.proname;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

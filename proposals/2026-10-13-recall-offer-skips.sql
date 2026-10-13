-- Applied 2026-10-13 as migration recall_offer_skips_2026_10_13 (version 20261013043714; stored statement md5 f5ae78d8c31f9aa5c008bf943918c56f = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 afterwards: skip_visit_recall_offers f9d82c5da7e15c285beeff577e5642c2; 2 policies (read, portal guard).
-- Rehearsed (rolled back) with simulated logins, and the checks repeated after applying: a receptionist skipped
-- ' 8159 ', '8159' and '0190a' on a visit (2 rows, upper case, by them), the same code again added 0, a visit saved
-- without a practice but of a patient of the practice 1; another practice's visit, posing as another practice, no
-- visit (42501), no codes, null codes, a code with a space, a null code and 21 codes (22023), a direct insert and
-- delete (42501) were refused. The administrator read the practice's 3 and skipped one more. Another practice's doctor
-- read 0 and could not skip on this practice's visit either way (42501), only on their own. A patient-app login read 0
-- and could not skip (42501); anon 42501 on both.
-- =============================================================================================
-- PROPOSAL: a skipped recall offer is remembered per visit and code, for every computer (parity O2 follow-up)
-- File:   proposals/2026-10-13-recall-offer-skips.sql                    Drafted: 2026-10-13
-- Code:   src/services/recallOfferSkipService.ts (reads and the one write; "not set up" before this file),
--         src/components/visits/recallOffer.tsx (the offer after an invoice is saved; tested in
--         src/components/visits/__tests__/recallOffer.test.tsx and src/services/__tests__/recallOfferSkipService.test.ts)
--
-- Why: when a code with a recall is invoiced (practice_tariff_rules.recall_months), staff are offered the patient's
-- recall: one tap sets it, one tap skips it. The skip was kept in that computer's browser only, so saving the same
-- visit again at reception, or on the practitioner's tablet, offered the same recall again.
--
-- What it does (additive: no existing table, policy or row is changed; visits and patient_recalls are not touched)
--   1. visit_recall_offer_skips: one row per visit and code whose recall offer staff skipped (who and when). A visit
--      that is deleted takes its skips with it.
--   2. RLS: staff of the practice (and OneHealth support) read; nobody writes directly; the patient app's guard.
--   3. skip_visit_recall_offers(practice, visit, codes): any active staff member of the practice, as setting a recall
--      is (set_patient_recall). The visit must be the practice's (its own practice, else its patient's, for visits
--      saved without one); 1 to 20 codes of 1 to 10 letters or digits, kept upper case; a code skipped before stays as
--      it was (who skipped it first). Returns how many were added.
--   4. Checks: row level security, the guard, the function's rights, nothing for the public key.
--   Needs practice isolation's rls_my_practice_id() and rls_is_super_admin().
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then a skip is not remembered: the offer can come back when the visit is saved again (no error).
-- Undo (skips are forgotten; offers come back once per visit):
--   DROP FUNCTION IF EXISTS public.skip_visit_recall_offers(uuid, uuid, text[]);
--   DROP TABLE IF EXISTS public.visit_recall_offer_skips;
-- =============================================================================================

BEGIN;

-- Stop before changing anything when the functions this file builds on are missing
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(signature, ', ') INTO v_missing
    FROM (VALUES ('public.rls_my_practice_id()'), ('public.rls_is_super_admin()')) AS t(signature)
   WHERE to_regprocedure(signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. visit_recall_offer_skips
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.visit_recall_offer_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  -- The code whose recall was offered, as billed (upper case): 8159, 0190
  code text NOT NULL CHECK (code ~ '^[0-9A-Z]{1,10}$'),
  skipped_by uuid DEFAULT auth.uid(),
  skipped_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_recall_offer_skips_visit_code_key UNIQUE (visit_id, code)
);

COMMENT ON TABLE public.visit_recall_offer_skips IS
  'Recall offers staff skipped, per visit and code: saving the visit again on any computer does not offer them again. '
  'Written only by skip_visit_recall_offers().';

CREATE INDEX IF NOT EXISTS visit_recall_offer_skips_practice_idx ON public.visit_recall_offer_skips (practice_id);

-- ---------------------------------------------------------------------------------------------
-- 2. Who reads it: staff of the practice and OneHealth support; nobody writes it directly
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.visit_recall_offer_skips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visit_recall_offer_skips FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.visit_recall_offer_skips TO authenticated;
GRANT ALL ON public.visit_recall_offer_skips TO service_role;

DROP POLICY IF EXISTS visit_recall_offer_skips_read ON public.visit_recall_offer_skips;
CREATE POLICY visit_recall_offer_skips_read ON public.visit_recall_offer_skips FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS portal_staff_only ON public.visit_recall_offer_skips';
    EXECUTE 'CREATE POLICY portal_staff_only ON public.visit_recall_offer_skips AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Remembering a skip: any active staff member of the practice
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.skip_visit_recall_offers(p_practice_id uuid, p_visit_id uuid, p_codes text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codes text[];
  v_added integer;
BEGIN
  IF auth.uid() IS NULL OR p_practice_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.practice_id = p_practice_id
  ) THEN
    RAISE EXCEPTION 'You can only answer recall offers for your own practice.' USING ERRCODE = '42501';
  END IF;
  IF p_visit_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.visits v JOIN public.patients p ON p.id = v.patient_id
     WHERE v.id = p_visit_id AND COALESCE(v.practice_id, p.practice_id) = p_practice_id
  ) THEN
    RAISE EXCEPTION 'This visit is not one of the practice''s.' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT c.code ORDER BY c.code), '{}'::text[]) INTO v_codes
    FROM (SELECT upper(btrim(x)) AS code FROM unnest(COALESCE(p_codes, '{}'::text[])) AS x) c;
  IF cardinality(v_codes) NOT BETWEEN 1 AND 20
     OR EXISTS (SELECT 1 FROM unnest(v_codes) AS c(code) WHERE c.code IS NULL OR c.code !~ '^[0-9A-Z]{1,10}$') THEN
    RAISE EXCEPTION 'Give 1 to 20 codes, each 1 to 10 letters or digits.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.visit_recall_offer_skips (practice_id, visit_id, code, skipped_by)
  SELECT p_practice_id, p_visit_id, c.code, auth.uid() FROM unnest(v_codes) AS c(code)
  ON CONFLICT ON CONSTRAINT visit_recall_offer_skips_visit_code_key DO NOTHING;
  GET DIAGNOSTICS v_added = ROW_COUNT;
  RETURN v_added;
END $$;

REVOKE ALL ON FUNCTION public.skip_visit_recall_offers(uuid, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_visit_recall_offers(uuid, uuid, text[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks: row level security, the guard, the function's rights, nothing for the public key
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.visit_recall_offer_skips'::regclass) THEN
    RAISE EXCEPTION 'check failed: row level security is off on visit_recall_offer_skips';
  END IF;
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visit_recall_offer_skips'
       AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE') THEN
    RAISE EXCEPTION 'check failed: the patient app''s guard is missing on visit_recall_offer_skips';
  END IF;
  IF has_table_privilege('anon', 'public.visit_recall_offer_skips', 'SELECT')
     OR has_table_privilege('authenticated', 'public.visit_recall_offer_skips', 'INSERT')
     OR has_table_privilege('authenticated', 'public.visit_recall_offer_skips', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.visit_recall_offer_skips', 'DELETE') THEN
    RAISE EXCEPTION 'check failed: the public key reads the skips, or staff can write them directly';
  END IF;
  IF has_function_privilege('anon', 'public.skip_visit_recall_offers(uuid, uuid, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: the public key can remember a skip';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.skip_visit_recall_offers(uuid, uuid, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: signed-in staff cannot remember a skip';
  END IF;
  RAISE NOTICE 'recall offer skips ready: row level security on, the guard, the function''s rights checked';
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Result (read only): the policies and the skips (none yet)
-- ---------------------------------------------------------------------------------------------

SELECT tablename, policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'visit_recall_offer_skips' ORDER BY policyname;
SELECT count(*) AS recall_offer_skips FROM public.visit_recall_offer_skips;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

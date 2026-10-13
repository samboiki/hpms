-- Applied 2026-10-12 as migration fund_master_2026_10_12 (version 20261012163229; stored statement md5 a54a67590b3d3f1111d52cf5b8860e23 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Rehearsed with simulated logins (rolled back): seeded 5 funds (NHPM 4 months, NMC1 120 days, MAG1 180 days confirmed;
-- NAMM and PROS 120 days not confirmed); anon read and ran nothing (42501); a patient-app login read 0 rules; a
-- receptionist read the 5 rules and the practice's notes but changed neither, nor wrote a table directly (42501); the
-- practice administrator could not change a rule (42501), saved its note (trimmed, stamped), not another practice's
-- (42501), not for an unknown fund or over 1,000 characters (22023), and saw no change history; an administrator of
-- another practice saw 0 of its notes; support changed NAMMED (one history row, before 120 after 90 days), the same
-- values again wrote nothing, bad deadlines, emails, portals, lengths, terms (22023), another fund's name (23505) and an
-- unknown fund (P0002) were refused; medical_aid_providers kept its 3 policies. Repeated after applying.
-- =============================================================================================
-- PROPOSAL: the fund master - each medical aid's details and claim rules in one place, kept by OneHealth support
--           (parity E10, F11, A6)
-- File:   proposals/2026-10-12-fund-master.sql                Drafted: 2026-10-12
-- Code:   src/utils/billing/fundRules.ts (the rules claim checks, the claims and the remittance screens read; the
--         values below stay in the code as the fallback; tested), src/hooks/useFundRules.ts (reads this table once
--         per session), src/services/fundMasterService.ts (reads and saves for the screen),
--         src/pages/admin/FundMaster.tsx (Administration > Medical aid funds)
--
-- Why (parity E10, F11, A6): medical_aid_providers (name, claim code, claims email, logo) could only be changed by
-- OneHealth support straight in the database; no screen showed it. The funds' rules were written into the app:
-- claim deadlines for NHP, NMC and PSEMAS, membership-number lengths for NMC, NHP and NAMMED, PSEMAS's longer wait
-- before "Funds that have not answered". NAMMED and Prosperity fell to a guessed 120 days that blocked older claim
-- lines although nobody had confirmed that deadline with them. medical_aid_fund_rules in
-- proposals/2026-10-claims.sql (section 3) was never applied; this file replaces that section.
--
-- What it does (additive; medical_aid_providers keeps its policies)
--   1. medical_aid_fund_rules: one row per claim code (medical_aid_providers.medical_aid_reference): the claim
--      deadline in days or months from the service date and whether it is confirmed with the fund (a line past an
--      unconfirmed deadline is flagged, never blocked), the fund's claims portal, its membership-number lengths and a
--      hint for reception, whether a dependant needs the dependant code, and the payment terms the "Funds that have
--      not answered" alert waits for (a practice's own silent_fund_days setting still wins).
--   2. Seeded with the values the app used until now: NHP 4 months, NMC 120 days, PSEMAS 180 days (confirmed);
--      NAMMED and Prosperity 120 days (NOT confirmed); NMC numbers 9 digits, NHP and NAMMED 11; PSEMAS pays within
--      60 days, the others 30; every fund needs the dependant code.
--   3. medical_aid_fund_rule_changes: every change to a fund's details or rules, who made it and when, before and
--      after (OneHealth support reads it).
--   4. practice_fund_notes: a practice's own note per fund (its contact at the fund, how it sends claims).
--   5. RLS: every signed-in staff member reads the rules (claim checks run for every role); a practice reads its own
--      notes; only support reads the change history; nobody writes these tables directly.
--   6. save_fund_rule(...): OneHealth support (rls_is_super_admin) changes a fund's name, claims email, logo, portal
--      and rules in one step, recorded in the change history; save_practice_fund_note(...): the practice's
--      administrators (and support) keep its note. SECURITY DEFINER, checked inside; EXECUTE for signed-in users only.
--   7. The patient app's logins get nothing here, as on every OneHealth table.
--   Needs the practice-isolation helpers rls_is_super_admin() and rls_my_practice_id()
--   (proposals/2026-10-07-practice-isolation.sql).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the app uses the values above from its own code, and Administration > Medical aid funds says
-- the fund rules are not set up yet.
-- Undo: DROP FUNCTION IF EXISTS public.save_practice_fund_note(uuid, text, text);
--       DROP FUNCTION IF EXISTS public.save_fund_rule(uuid, text, text, text, text, integer, integer, boolean, integer[], text, boolean, integer);
--       DROP TABLE IF EXISTS public.practice_fund_notes, public.medical_aid_fund_rule_changes, public.medical_aid_fund_rules;
--       (medical_aid_providers keeps the names, claims emails and logos saved through the screen.)
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The fund rules
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.medical_aid_fund_rules (
  -- The fund's claim code, as on medical_aid_providers and the claim files: MAG1 (PSEMAS), NMC1, NHPM, NAMM, PROS
  medical_aid_reference text PRIMARY KEY CHECK (medical_aid_reference ~ '^[A-Z0-9]{2,10}$'),
  -- The fund refuses claims it receives later than this after the date of service: days or months, one of them
  claim_deadline_days integer CHECK (claim_deadline_days BETWEEN 1 AND 730),
  claim_deadline_months integer CHECK (claim_deadline_months BETWEEN 1 AND 24),
  -- Confirmed with the fund: a line past the deadline is not sent. Not confirmed: it is flagged only
  deadline_confirmed boolean NOT NULL DEFAULT false,
  -- Where the fund takes claims online, if it does (the claims email stays medical_aid_providers.email)
  claims_portal_url text CHECK (claims_portal_url IS NULL OR (claims_portal_url ~ '^https://[^[:space:]]+$' AND char_length(claims_portal_url) <= 300)),
  -- Membership numbers are digits only, one of these lengths (empty: not known); the hint says what reception checks
  membership_digits smallint[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(membership_digits) <= 4 AND array_position(membership_digits, NULL) IS NULL
    AND 1 <= ALL (membership_digits) AND 20 >= ALL (membership_digits)
  ),
  membership_hint text CHECK (membership_hint IS NULL OR char_length(membership_hint) BETWEEN 1 AND 200),
  -- A dependant (spouse, child) is claimed with the dependant code from the card ("01 JOHN")
  dependant_code_required boolean NOT NULL DEFAULT true,
  -- Days the fund usually takes to answer: sent claims without an answer for longer are "Funds that have not answered"
  payment_terms_days smallint CHECK (payment_terms_days BETWEEN 7 AND 365),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Null until a person changes the row: it holds the values the app used before
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medical_aid_fund_rules_one_deadline CHECK ((claim_deadline_days IS NULL) <> (claim_deadline_months IS NULL))
);

COMMENT ON TABLE public.medical_aid_fund_rules IS
  'Claim rules per fund claim code (medical_aid_providers.medical_aid_reference): deadline and whether it is confirmed, claims portal, membership-number lengths and hint, dependant code, payment terms. Changed only through save_fund_rule (OneHealth support); src/utils/billing/fundRules.ts keeps the same values as its fallback.';

-- ---------------------------------------------------------------------------------------------
-- 2. The values the app used until now (src/utils/billing/fundRules.ts, preSubmissionChecks.ts, batchFollowUp.ts)
-- ---------------------------------------------------------------------------------------------

INSERT INTO public.medical_aid_fund_rules
  (medical_aid_reference, claim_deadline_days, claim_deadline_months, deadline_confirmed, membership_digits, dependant_code_required, payment_terms_days)
VALUES
  ('NHPM', NULL, 4, true, '{11}', true, 30),
  ('NMC1', 120, NULL, true, '{9}', true, 30),
  ('MAG1', 180, NULL, true, '{}', true, 60),
  ('NAMM', 120, NULL, false, '{11}', true, 30),
  ('PROS', 120, NULL, false, '{}', true, 30)
ON CONFLICT (medical_aid_reference) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- 3. Who changed a fund's details or rules, when, and from what to what
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.medical_aid_fund_rule_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_aid_reference text NOT NULL,
  provider_id uuid,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  -- The fund's name, claims email, logo and every rule column, before and after
  old_values jsonb,
  new_values jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS medical_aid_fund_rule_changes_fund_idx
  ON public.medical_aid_fund_rule_changes (medical_aid_reference, changed_at DESC);

COMMENT ON TABLE public.medical_aid_fund_rule_changes IS
  'Every change made through save_fund_rule: who, when, the fund''s details and rules before and after. OneHealth support reads it.';

-- ---------------------------------------------------------------------------------------------
-- 4. A practice's own note per fund
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.practice_fund_notes (
  practice_id uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  medical_aid_reference text NOT NULL CHECK (medical_aid_reference ~ '^[A-Z0-9]{2,10}$'),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1000),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (practice_id, medical_aid_reference)
);

COMMENT ON TABLE public.practice_fund_notes IS
  'A practice''s own note on a fund (its contact, how it sends claims). Changed only through save_practice_fund_note (the practice''s administrators).';

-- ---------------------------------------------------------------------------------------------
-- 5. Who reads what; nobody writes these tables directly
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.medical_aid_fund_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_aid_fund_rule_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_fund_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_aid_fund_rules, public.medical_aid_fund_rule_changes, public.practice_fund_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.medical_aid_fund_rules, public.medical_aid_fund_rule_changes, public.practice_fund_notes TO authenticated;

-- The claim checks run for every role, so every signed-in staff member reads the rules
DROP POLICY IF EXISTS medical_aid_fund_rules_read ON public.medical_aid_fund_rules;
CREATE POLICY medical_aid_fund_rules_read ON public.medical_aid_fund_rules FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS medical_aid_fund_rule_changes_read ON public.medical_aid_fund_rule_changes;
CREATE POLICY medical_aid_fund_rule_changes_read ON public.medical_aid_fund_rule_changes FOR SELECT TO authenticated
  USING ((SELECT public.rls_is_super_admin()));

DROP POLICY IF EXISTS practice_fund_notes_read ON public.practice_fund_notes;
CREATE POLICY practice_fund_notes_read ON public.practice_fund_notes FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

-- ---------------------------------------------------------------------------------------------
-- 6. Changing a fund (OneHealth support) and a practice's note (its administrators)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_fund_rule(
  p_provider_id uuid,
  p_name text,
  p_claims_email text,
  p_claims_portal_url text,
  p_logo_url text,
  p_deadline_days integer,
  p_deadline_months integer,
  p_deadline_confirmed boolean,
  p_membership_digits integer[],
  p_membership_hint text,
  p_dependant_code_required boolean,
  p_payment_terms_days integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_provider public.medical_aid_providers%ROWTYPE;
  v_code text;
  v_name text := btrim(COALESCE(p_name, ''));
  v_email text := NULLIF(btrim(COALESCE(p_claims_email, '')), '');
  v_portal text := NULLIF(btrim(COALESCE(p_claims_portal_url, '')), '');
  v_logo text := NULLIF(btrim(COALESCE(p_logo_url, '')), '');
  v_hint text := NULLIF(btrim(COALESCE(p_membership_hint, '')), '');
  v_digits smallint[];
  v_rule jsonb;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF NOT public.rls_is_super_admin() THEN
    RAISE EXCEPTION 'Only OneHealth support can change a fund''s details and rules.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_provider FROM public.medical_aid_providers p WHERE p.id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This fund does not exist.' USING ERRCODE = 'P0002';
  END IF;
  v_code := upper(btrim(COALESCE(v_provider.medical_aid_reference, '')));
  IF v_code !~ '^[A-Z0-9]{2,10}$' THEN
    RAISE EXCEPTION 'This fund has no claim code, so it has no claim rules.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_name) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Give the fund''s name (2 to 100 characters).' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.medical_aid_providers o WHERE o.id <> p_provider_id AND lower(btrim(o.name)) = lower(v_name)) THEN
    RAISE EXCEPTION 'Another fund already has the name %.', v_name USING ERRCODE = '23505';
  END IF;
  IF v_email IS NOT NULL AND (v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR char_length(v_email) > 200) THEN
    RAISE EXCEPTION 'The claims email is not an email address.' USING ERRCODE = '22023';
  END IF;
  IF v_portal IS NOT NULL AND (v_portal !~ '^https://[^[:space:]]+$' OR char_length(v_portal) > 300) THEN
    RAISE EXCEPTION 'The claims portal must be a web address starting with https://.' USING ERRCODE = '22023';
  END IF;
  IF v_logo IS NOT NULL AND (v_logo !~ '^https://[^[:space:]]+$' OR char_length(v_logo) > 500) THEN
    RAISE EXCEPTION 'The logo must be a web address starting with https://.' USING ERRCODE = '22023';
  END IF;
  IF (p_deadline_days IS NULL) = (p_deadline_months IS NULL) THEN
    RAISE EXCEPTION 'Give the claim deadline in days or in months.' USING ERRCODE = '22023';
  END IF;
  IF p_deadline_days IS NOT NULL AND p_deadline_days NOT BETWEEN 1 AND 730 THEN
    RAISE EXCEPTION 'A claim deadline in days is 1 to 730 days.' USING ERRCODE = '22023';
  END IF;
  IF p_deadline_months IS NOT NULL AND p_deadline_months NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'A claim deadline in months is 1 to 24 months.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(COALESCE(p_membership_digits, '{}'::integer[])) > 4
     OR EXISTS (SELECT 1 FROM unnest(p_membership_digits) AS d(n) WHERE d.n IS NULL OR d.n NOT BETWEEN 1 AND 20) THEN
    RAISE EXCEPTION 'Membership numbers: up to 4 lengths, each 1 to 20 digits.' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_hint, '')) > 200 THEN
    RAISE EXCEPTION 'Keep the membership-number hint to 200 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_payment_terms_days IS NOT NULL AND p_payment_terms_days NOT BETWEEN 7 AND 365 THEN
    RAISE EXCEPTION 'Payment terms are 7 to 365 days.' USING ERRCODE = '22023';
  END IF;
  v_digits := COALESCE(
    (SELECT array_agg(DISTINCT d.n ORDER BY d.n)::smallint[] FROM unnest(p_membership_digits) AS d(n)),
    '{}'::smallint[]
  );

  SELECT to_jsonb(r) - ARRAY['created_at', 'updated_at', 'updated_by'] INTO v_rule
    FROM public.medical_aid_fund_rules r WHERE r.medical_aid_reference = v_code FOR UPDATE;
  v_before := jsonb_build_object('name', v_provider.name, 'claims_email', v_provider.email, 'logo_url', v_provider.logo_url)
              || COALESCE(v_rule, '{}'::jsonb);
  v_after := jsonb_build_object(
    'name', v_name,
    'claims_email', v_email,
    'logo_url', v_logo,
    'medical_aid_reference', v_code,
    'claim_deadline_days', p_deadline_days,
    'claim_deadline_months', p_deadline_months,
    'deadline_confirmed', COALESCE(p_deadline_confirmed, false),
    'claims_portal_url', v_portal,
    'membership_digits', to_jsonb(v_digits),
    'membership_hint', v_hint,
    'dependant_code_required', COALESCE(p_dependant_code_required, true),
    'payment_terms_days', p_payment_terms_days
  );
  -- Nothing changed: nothing is written, so "last changed" stays true
  IF v_after = v_before THEN
    RETURN v_after;
  END IF;

  IF (v_provider.name, v_provider.email, v_provider.logo_url) IS DISTINCT FROM (v_name, v_email, v_logo) THEN
    UPDATE public.medical_aid_providers
       SET name = v_name, email = v_email, logo_url = v_logo, updated_at = now()
     WHERE id = p_provider_id;
  END IF;

  INSERT INTO public.medical_aid_fund_rules AS r (
    medical_aid_reference, claim_deadline_days, claim_deadline_months, deadline_confirmed, claims_portal_url,
    membership_digits, membership_hint, dependant_code_required, payment_terms_days, updated_by, updated_at
  )
  VALUES (
    v_code, p_deadline_days, p_deadline_months, COALESCE(p_deadline_confirmed, false), v_portal,
    v_digits, v_hint, COALESCE(p_dependant_code_required, true), p_payment_terms_days, auth.uid(), now()
  )
  ON CONFLICT (medical_aid_reference) DO UPDATE
     SET claim_deadline_days = EXCLUDED.claim_deadline_days,
         claim_deadline_months = EXCLUDED.claim_deadline_months,
         deadline_confirmed = EXCLUDED.deadline_confirmed,
         claims_portal_url = EXCLUDED.claims_portal_url,
         membership_digits = EXCLUDED.membership_digits,
         membership_hint = EXCLUDED.membership_hint,
         dependant_code_required = EXCLUDED.dependant_code_required,
         payment_terms_days = EXCLUDED.payment_terms_days,
         updated_by = EXCLUDED.updated_by,
         updated_at = EXCLUDED.updated_at;

  INSERT INTO public.medical_aid_fund_rule_changes (medical_aid_reference, provider_id, changed_by, old_values, new_values)
  VALUES (v_code, p_provider_id, auth.uid(), v_before, v_after);
  RETURN v_after;
END
$$;

CREATE OR REPLACE FUNCTION public.save_practice_fund_note(p_practice_id uuid, p_fund_code text, p_note text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_code text := upper(btrim(COALESCE(p_fund_code, '')));
  v_note text := btrim(COALESCE(p_note, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.rls_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = p_practice_id
    )
  ) THEN
    RAISE EXCEPTION 'Only the practice''s administrators keep its notes on a fund.' USING ERRCODE = '42501';
  END IF;
  IF p_practice_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.practices p WHERE p.id = p_practice_id) THEN
    RAISE EXCEPTION 'This practice does not exist.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.medical_aid_providers m WHERE upper(btrim(m.medical_aid_reference)) = v_code) THEN
    RAISE EXCEPTION 'There is no fund with the claim code %.', v_code USING ERRCODE = '22023';
  END IF;
  IF char_length(v_note) > 1000 THEN
    RAISE EXCEPTION 'Keep the note to 1,000 characters.' USING ERRCODE = '22023';
  END IF;

  -- An empty note removes the practice's note
  IF v_note = '' THEN
    DELETE FROM public.practice_fund_notes n WHERE n.practice_id = p_practice_id AND n.medical_aid_reference = v_code;
    RETURN NULL;
  END IF;
  INSERT INTO public.practice_fund_notes AS n (practice_id, medical_aid_reference, note, updated_by, updated_at)
  VALUES (p_practice_id, v_code, v_note, auth.uid(), now())
  ON CONFLICT (practice_id, medical_aid_reference) DO UPDATE
     SET note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  RETURN v_note;
END
$$;

REVOKE ALL ON FUNCTION public.save_fund_rule(uuid, text, text, text, text, integer, integer, boolean, integer[], text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_practice_fund_note(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_fund_rule(uuid, text, text, text, text, integer, integer, boolean, integer[], text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_practice_fund_note(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['medical_aid_fund_rules', 'medical_aid_fund_rule_changes', 'practice_fund_notes'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Result (read only)
-- ---------------------------------------------------------------------------------------------

SELECT medical_aid_reference, claim_deadline_days, claim_deadline_months, deadline_confirmed, membership_digits,
       dependant_code_required, payment_terms_days
  FROM public.medical_aid_fund_rules ORDER BY medical_aid_reference;

SELECT tablename, policyname, permissive, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('medical_aid_fund_rules', 'medical_aid_fund_rule_changes', 'practice_fund_notes')
 ORDER BY tablename, policyname;

SELECT has_table_privilege('anon', 'public.medical_aid_fund_rules', 'SELECT') AS anon_reads_rules,
       has_table_privilege('authenticated', 'public.medical_aid_fund_rules', 'UPDATE') AS staff_update_directly,
       has_function_privilege('anon', 'public.save_fund_rule(uuid, text, text, text, text, integer, integer, boolean, integer[], text, boolean, integer)', 'EXECUTE') AS anon_runs,
       has_function_privilege('authenticated', 'public.save_practice_fund_note(uuid, text, text)', 'EXECUTE') AS staff_run_note;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

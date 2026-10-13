-- Applied 2026-10-12 as migration line_teeth_and_billing_practitioners_2026_10_12 (version 20261012175907; md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed = md5 of the stored statement: 658b395b92ec138bfd33341070115607;
-- live prosrc md5 afterwards: sync_invoice_to_batch 41239df0c0a2c7b4403ce4a569ba905c, add_invoice_to_batch 831d7dcb94dc973800eb784a57bf9b4c, set_practitioner_billing c3e04058b59d61235e994013732c27d5).
-- Rehearsed with simulated logins (rolled back; twice, the second time right before applying): the practice's
-- administrator set a partner's own number (typed with spaces, stored without) and 120%; 100% stored nothing; letters
-- and 600% were refused (22023); the administrator of another practice, reception, another practice's doctor and anon
-- were refused (42501), and so was a direct insert; reception read its practice's 1 row, another practice 0, anon
-- nothing. Reception's invoice of 3 lines reached batch_details as: 8368 under the batch's practice number with the
-- invoice practitioner's HPCNA number, teeth 46, surfaces MO, "TOOTH: 46 MO ..."; the partner's 8182 under the
-- partner's own number with NO HPCNA number (claim review stops it), quadrant 4, "QUAD: 4 ..."; 8109 like the first.
-- Surfaces on two teeth, out of order or unknown, surfaces without a tooth and quadrant 5 were refused (23514);
-- changing the surfaces to MOD rebuilt the open batch's line; after the batch was sent, changes left its lines
-- unchanged; add_invoice_to_batch built a line the same way and refused another practice (42501); nobody gained
-- EXECUTE on sync_invoice_to_batch; every batch sent before this file was unchanged (fingerprint). Checked once more
-- after applying.
-- =============================================================================================
-- PROPOSAL: tooth surfaces and quadrants on invoice and claim lines (parity D5); several practitioners, each line
--           billed under its own practitioner's practice number and rate, and never claimed without that
--           practitioner's HPCNA number (parity D31)
-- File:   proposals/2026-10-12-line-teeth-and-billing-practitioners.sql        Drafted: 2026-10-12
-- Code:   src/utils/dental/lineTeeth.ts (teeth, surfaces and quadrants in words), src/utils/dental/workTypes.ts
--         (surfaceCodeProblem: the code for the number of surfaces marked), src/utils/billing/practitionerBilling.ts
--         (who bills a line, a practitioner's rate; tested), src/utils/billing/invoiceLineRow.ts (the stored row),
--         src/services/invoicingSetup.ts (probe), src/services/practitionerBillingService.ts (read and set),
--         src/components/finance/claims/buildClaimLines.ts and src/utils/billing/claimValidation.ts (claim review)
--
-- Why (D5): the visit's tooth chart records surfaces ("MOD") and several teeth, but an invoice line kept only its
-- teeth: the surfaces never reached the invoice or the claim, and a code billed per quadrant (8182 root planing,
-- 8185 gingivectomy) had nowhere to say which quadrant. Eminance keeps tooth, surface and quadrant per line and starts
-- the claim description with the tooth ("TOOTH: NN ...", claim field 15, 30 characters); the claim specification has
-- no surface field (field 37 holds up to 8 two-digit tooth numbers only).
-- Why (D31): partners in one practice bill their own work under their own practice number (claim field 29, the
-- "treating doctor's practice number"), some at their own rate. And every claim line carried the HPCNA number of the
-- invoice's practitioner (sync_invoice_to_batch read it once per invoice), so a line treated by a practitioner without
-- an HPCNA number went to the fund under a colleague's number, without a warning.
--
-- What it does
--   1. invoice_services.tooth_surfaces (the chart's letters in its fixed order, e.g. 'MO'; a one-tooth line only) and
--      invoice_services.tooth_quadrant (1 upper right, 2 upper left, 3 lower left, 4 lower right). Additive: NULL on
--      every existing line.
--   2. batch_details.tooth_surfaces and tooth_quadrant: what the claim line was built with (claim_line_copy copies
--      every column, so resent and reversed lines keep them).
--   3. practitioner_billing: per practice and practitioner, their own practice number (NULL: the practice's) and
--      their rate as a percentage of the practice's price list (NULL: the list itself). Staff of the practice read
--      it; only the practice's administrators (and OneHealth support) change it, through set_practitioner_billing.
--   4. sync_invoice_to_batch (the claim builder run on every invoice-line change) and add_invoice_to_batch (Claims,
--      "add to the fund's batch"): per line, the treating practitioner is the line's own, else the invoice's; the
--      claim line carries THAT practitioner's HPCNA number (empty when there is none, so claim review stops the line)
--      and bills under their own practice number when they have one, else the batch's; the teeth go to field 37
--      (batch_details.tooth_numbers, separated by spaces), the surfaces and the quadrant to the new columns, and the
--      description starts "TOOTH: 46 MO " (or "QUAD: 1 " for a quadrant without teeth). Both functions are edited in
--      their LIVE definitions: every changed statement must be found exactly once or nothing changes, so each guard
--      stays as it is (a sent batch is never rewritten, lines of sent batches are kept, "Do not claim", medicines as
--      GMED with type M/R/D and the NAPPI code, 0201 for materials, ICD-10 per line, the patient's own lines never
--      claimed, the authorisation number, add_invoice_to_batch's practice check). CREATE OR REPLACE keeps owners and
--      privileges (sync_invoice_to_batch stays closed to PUBLIC, anon and authenticated).
--   5. Checks.
--   Policies on invoice_services and batch_details are not touched.
--
-- How to apply: rehearse (scripts/db/rehearsal.ts), then apply the part between BEGIN; and ROLLBACK; as one migration.
-- The app probes the new columns and table (invoicingSetup.ts, practitionerBillingService.ts) and offers surfaces,
-- quadrants, own practice numbers and rates only once they exist.
-- Undo: restore sync_invoice_to_batch and add_invoice_to_batch as proposals/2026-10-09-line-portions.sql left them
--       (prosrc md5 8b6db25a2896be514cc08a8f6ce6acf6 and 74dcd8eb772a2eaa231882172487f0ba), then
--       DROP FUNCTION public.set_practitioner_billing(uuid, text, numeric); DROP TABLE public.practitioner_billing;
--       ALTER TABLE public.batch_details DROP COLUMN tooth_surfaces, DROP COLUMN tooth_quadrant;
--       ALTER TABLE public.invoice_services DROP COLUMN tooth_surfaces, DROP COLUMN tooth_quadrant.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure) <> '8b6db25a2896be514cc08a8f6ce6acf6' THEN
    RAISE EXCEPTION 'Stopped: sync_invoice_to_batch is not the version proposals/2026-10-09-line-portions.sql left; merge by hand';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.add_invoice_to_batch(uuid,uuid)'::regprocedure) <> '74dcd8eb772a2eaa231882172487f0ba' THEN
    RAISE EXCEPTION 'Stopped: add_invoice_to_batch is not the version proposals/2026-10-09-line-portions.sql left; merge by hand';
  END IF;
  IF to_regprocedure('public.rls_my_practice_id()') IS NULL OR to_regprocedure('public.rls_is_staff_admin()') IS NULL
     OR to_regprocedure('public.rls_is_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-practice-isolation.sql and 2026-10-09-staff-records-admins.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Surfaces and quadrant on the invoice line
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS tooth_surfaces text;
ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS tooth_quadrant smallint;

-- The chart's letters in its order (M, O or I, D, B or F, L or P), for a line of one tooth: surfaces belong to a tooth
ALTER TABLE public.invoice_services DROP CONSTRAINT IF EXISTS invoice_services_tooth_surfaces_check;
ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_tooth_surfaces_check
  CHECK (tooth_surfaces IS NULL
         OR (tooth_surfaces <> '' AND tooth_surfaces ~ '^M?[OI]?D?[BF]?[LP]?$' AND btrim(COALESCE(tooth_number, '')) ~ '^[1-8][1-8]$'));

ALTER TABLE public.invoice_services DROP CONSTRAINT IF EXISTS invoice_services_tooth_quadrant_check;
ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_tooth_quadrant_check
  CHECK (tooth_quadrant IS NULL OR tooth_quadrant BETWEEN 1 AND 4);

COMMENT ON COLUMN public.invoice_services.tooth_surfaces IS
  'Surfaces of the line''s one tooth in the chart''s order (M, O or I, D, B or F, L or P), e.g. MO; the claim description starts "TOOTH: 46 MO".';
COMMENT ON COLUMN public.invoice_services.tooth_quadrant IS
  'Quadrant of a code billed per quadrant: 1 upper right, 2 upper left, 3 lower left, 4 lower right.';

-- ---------------------------------------------------------------------------------------------
-- 2. What the claim line was built with
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.batch_details ADD COLUMN IF NOT EXISTS tooth_surfaces text;
ALTER TABLE public.batch_details ADD COLUMN IF NOT EXISTS tooth_quadrant smallint;

COMMENT ON COLUMN public.batch_details.tooth_surfaces IS 'The invoice line''s tooth surfaces when the claim line was built (also at the start of diagnosis, field 15).';
COMMENT ON COLUMN public.batch_details.tooth_quadrant IS 'The invoice line''s quadrant (1-4) when the claim line was built.';

-- ---------------------------------------------------------------------------------------------
-- 3. Each practitioner's own practice number and rate
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.practitioner_billing (
  practice_id     uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  practice_number text CHECK (practice_number IS NULL OR practice_number ~ '^[0-9]{7,15}$'),
  rate_percent    numeric(5,2) CHECK (rate_percent IS NULL OR (rate_percent >= 10 AND rate_percent <= 500)),
  updated_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (practice_id, user_id)
);

COMMENT ON TABLE public.practitioner_billing IS
  'Per practitioner: the practice number their lines are billed under (NULL: the practice''s) and their rate as a percentage of the practice''s price list (NULL: the list). Set through set_practitioner_billing.';

ALTER TABLE public.practitioner_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS practitioner_billing_read ON public.practitioner_billing;
CREATE POLICY practitioner_billing_read ON public.practitioner_billing FOR SELECT TO authenticated
  USING (practice_id = (SELECT public.rls_my_practice_id()) OR (SELECT public.rls_is_super_admin()));

REVOKE ALL ON public.practitioner_billing FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.practitioner_billing TO authenticated;

-- Who bills under which number decides who the fund pays: the practice's administrators (and support) only
CREATE OR REPLACE FUNCTION public.set_practitioner_billing(p_user_id uuid, p_practice_number text, p_rate_percent numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_practice uuid;
  -- As typed, spaces taken out; empty is none
  v_number text := NULLIF(regexp_replace(COALESCE(p_practice_number, ''), '\s', '', 'g'), '');
  -- 100% is the price list itself
  v_rate numeric := NULLIF(p_rate_percent, 100);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change a practitioner''s billing' USING ERRCODE = '42501';
  END IF;
  SELECT u.practice_id INTO v_practice FROM users u WHERE u.id = p_user_id;
  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'The practitioner was not found in a practice' USING ERRCODE = '22023';
  END IF;
  IF NOT ((v_practice = rls_my_practice_id() AND rls_is_staff_admin()) OR rls_is_super_admin()) THEN
    RAISE EXCEPTION 'Only the practice''s administrators choose who bills under which practice number' USING ERRCODE = '42501';
  END IF;
  IF v_number IS NOT NULL AND v_number !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'A practice number has 7 to 15 digits' USING ERRCODE = '22023';
  END IF;
  IF v_rate IS NOT NULL AND (v_rate < 10 OR v_rate > 500 OR v_rate <> round(v_rate, 2)) THEN
    RAISE EXCEPTION 'A rate is a percentage of the price list from 10 to 500' USING ERRCODE = '22023';
  END IF;
  IF v_number IS NULL AND v_rate IS NULL THEN
    DELETE FROM practitioner_billing WHERE practice_id = v_practice AND user_id = p_user_id;
  ELSE
    INSERT INTO practitioner_billing (practice_id, user_id, practice_number, rate_percent, updated_by, updated_at)
    VALUES (v_practice, p_user_id, v_number, v_rate, auth.uid(), now())
    ON CONFLICT (practice_id, user_id) DO UPDATE
      SET practice_number = EXCLUDED.practice_number, rate_percent = EXCLUDED.rate_percent,
          updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN jsonb_build_object('practice_number', v_number, 'rate_percent', v_rate);
END
$function$;

REVOKE ALL ON FUNCTION public.set_practitioner_billing(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_practitioner_billing(uuid, text, numeric) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Claim lines: each line's own practitioner, practice number, teeth, surfaces and quadrant
-- ---------------------------------------------------------------------------------------------

DO $migration$
DECLARE
  v_def text;
  -- The new variables, added to both functions
  v_vars text := $v$
    -- Who treated and who bills each line, and its teeth (2026-10-12-line-teeth-and-billing-practitioners.sql)
    v_line_practitioner UUID;
    v_line_hpcna TEXT;
    v_billing_number TEXT;
    v_teeth TEXT;
    v_surfaces TEXT;
    v_quadrant SMALLINT;
BEGIN$v$;
  -- The description, in both functions: the line's practitioner and practice number first, then its teeth
  v_old_description text := $o$        IF v_service.tooth_number IS NOT NULL AND TRIM(v_service.tooth_number) <> '' THEN
            v_formatted_diagnosis := 'TOOTH: ' || v_service.tooth_number || ' ' || v_service.description;
        ELSE
            v_formatted_diagnosis := v_service.description;
        END IF;$o$;
  v_new_description text := $n$        -- The treating practitioner: the line's own, else the invoice's. The claim line carries THAT practitioner's
        -- HPCNA number (none: claim review stops the line; never a colleague's number) and bills under their own
        -- practice number when they have one (claim field 29), else the batch's
        v_line_practitioner := COALESCE(v_service.practitioner_id, v_invoice.practitioner_id);
        v_line_hpcna := NULL;
        v_billing_number := NULL;
        IF v_line_practitioner IS NOT NULL THEN
            SELECT NULLIF(btrim(u.hpcsa_number), '') INTO v_line_hpcna FROM public.users u WHERE u.id = v_line_practitioner;
            SELECT NULLIF(btrim(pb.practice_number), '') INTO v_billing_number FROM public.practitioner_billing pb
             WHERE pb.practice_id = v_batch.practice_id AND pb.user_id = v_line_practitioner;
        END IF;
        v_billing_number := COALESCE(v_billing_number, v_batch.practice_number);
        -- The teeth (claim field 37: separated by spaces here, joined in the file), the surfaces of a one-tooth line and
        -- the quadrant; the description starts with them, as the funds read it: "TOOTH: 46 MO ...", "QUAD: 1 ..."
        v_teeth := NULLIF(btrim(regexp_replace(COALESCE(v_service.tooth_number, ''), '[[:space:],;]+', ' ', 'g')), '');
        v_surfaces := NULLIF(btrim(v_service.tooth_surfaces), '');
        v_quadrant := v_service.tooth_quadrant;
        IF v_service.tooth_number IS NOT NULL AND TRIM(v_service.tooth_number) <> '' THEN
            v_formatted_diagnosis := 'TOOTH: ' || v_service.tooth_number || COALESCE(' ' || v_surfaces, '') || ' ' || v_service.description;
        ELSIF v_quadrant IS NOT NULL THEN
            v_formatted_diagnosis := 'QUAD: ' || v_quadrant || ' ' || v_service.description;
        ELSE
            v_formatted_diagnosis := v_service.description;
        END IF;$n$;
  v_sync text[][] := ARRAY[
    ARRAY[$o$
    v_diagnostic_code TEXT;
BEGIN$o$, $n$
    v_diagnostic_code TEXT;$n$ || v_vars],
    ARRAY[v_old_description, v_new_description],
    ARRAY[$o$            diagnostic_code, authorisation_number
        ) VALUES ($o$, $n$            diagnostic_code, authorisation_number, tooth_numbers, tooth_surfaces, tooth_quadrant
        ) VALUES ($n$],
    ARRAY[$o$            v_batch.practice_number, REPLACE(COALESCE(v_practitioner_hpcsa, 'NOT_SET'), ',', ''),$o$,
          $n$            v_billing_number, REPLACE(COALESCE(v_line_hpcna, ''), ',', ''),$n$],
    ARRAY[$o$            COALESCE(left(NULLIF(btrim(v_service.authorisation_number), ''), 21), '')
        );$o$, $n$            COALESCE(left(NULLIF(btrim(v_service.authorisation_number), ''), 21), ''),
            -- The line's teeth (claim field 37), surfaces and quadrant
            left(COALESCE(v_teeth, ''), 50), v_surfaces, v_quadrant
        );$n$]
  ];
  v_add text[][] := ARRAY[
    ARRAY[$o$
    v_formatted_diagnosis TEXT;
BEGIN$o$, $n$
    v_formatted_diagnosis TEXT;$n$ || v_vars],
    ARRAY[v_old_description, v_new_description],
    ARRAY[$o$            gender, patient_id_number, patient_id, visit_id
        ) VALUES ($o$, $n$            gender, patient_id_number, patient_id, visit_id, tooth_numbers, tooth_surfaces, tooth_quadrant
        ) VALUES ($n$],
    ARRAY[$o$            v_batch.practice_number,
            REPLACE(COALESCE(v_practitioner_hpcsa, 'NOT_SET'), ',', ''),$o$, $n$            v_billing_number,
            REPLACE(COALESCE(v_line_hpcna, ''), ',', ''),$n$],
    ARRAY[$o$            v_patient.id, v_invoice.visit_id
        );$o$, $n$            v_patient.id, v_invoice.visit_id,
            left(COALESCE(v_teeth, ''), 50), v_surfaces, v_quadrant
        );$n$]
  ];
  v_i integer;
BEGIN
  SELECT pg_get_functiondef('public.sync_invoice_to_batch(uuid)'::regprocedure) INTO v_def;
  FOR v_i IN 1 .. array_length(v_sync, 1) LOOP
    IF (length(v_def) - length(replace(v_def, v_sync[v_i][1], ''))) / length(v_sync[v_i][1]) <> 1 THEN
      RAISE EXCEPTION 'sync_invoice_to_batch: statement % was not found exactly once; nothing changed', v_i;
    END IF;
    v_def := replace(v_def, v_sync[v_i][1], v_sync[v_i][2]);
  END LOOP;
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.add_invoice_to_batch(uuid, uuid)'::regprocedure) INTO v_def;
  FOR v_i IN 1 .. array_length(v_add, 1) LOOP
    IF (length(v_def) - length(replace(v_def, v_add[v_i][1], ''))) / length(v_add[v_i][1]) <> 1 THEN
      RAISE EXCEPTION 'add_invoice_to_batch: statement % was not found exactly once; nothing changed', v_i;
    END IF;
    v_def := replace(v_def, v_add[v_i][1], v_add[v_i][2]);
  END LOOP;
  EXECUTE v_def;
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 5. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_sync text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure);
  v_add text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.add_invoice_to_batch(uuid, uuid)'::regprocedure);
  v_count text := 'paid_by IS DISTINCT FROM ''patient''';
BEGIN
  -- The new per-line practitioner, practice number and teeth, in both functions
  IF position('v_line_hpcna' in v_sync) = 0 OR position('practitioner_billing' in v_sync) = 0 OR position('v_surfaces, v_quadrant' in v_sync) = 0
     OR position('''NOT_SET''' in v_sync) > 0 THEN
    RAISE EXCEPTION 'Check failed: sync_invoice_to_batch does not carry each line''s practitioner, practice number and teeth';
  END IF;
  IF position('v_line_hpcna' in v_add) = 0 OR position('practitioner_billing' in v_add) = 0 OR position('v_surfaces, v_quadrant' in v_add) = 0
     OR position('''NOT_SET''' in v_add) > 0 THEN
    RAISE EXCEPTION 'Check failed: add_invoice_to_batch does not carry each line''s practitioner, practice number and teeth';
  END IF;
  -- Every earlier guard of the claim builder is still there
  IF (length(v_sync) - length(replace(v_sync, 'b.sent_at IS NOT NULL', ''))) / length('b.sent_at IS NOT NULL') <> 2
     OR position('AND NOT EXISTS (' in v_sync) = 0 OR position('no_claims' in v_sync) = 0
     OR position('GMED' in v_sync) = 0 OR position('''0201''' in v_sync) = 0 OR position('v_service.nappi_code' in v_sync) = 0
     OR position('icd10_primary' in v_sync) = 0 OR position('v_service.authorisation_number' in v_sync) = 0
     OR (length(v_sync) - length(replace(v_sync, v_count, ''))) / length(v_count) <> 2 THEN
    RAISE EXCEPTION 'Check failed: a guard of sync_invoice_to_batch is missing';
  END IF;
  IF position(v_count in v_add) = 0 OR position('rls_assert_my_practice' in v_add) = 0 THEN
    RAISE EXCEPTION 'Check failed: add_invoice_to_batch lost its practice check or claims the patient''s own lines';
  END IF;
  -- Nobody gained a way in
  IF has_function_privilege('authenticated', 'public.sync_invoice_to_batch(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.sync_invoice_to_batch(uuid)', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure AND a.grantee = 0)
     OR has_function_privilege('anon', 'public.add_invoice_to_batch(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: a claim function can be run by app users or the public key';
  END IF;
  IF has_function_privilege('anon', 'public.set_practitioner_billing(uuid, text, numeric)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.set_practitioner_billing(uuid, text, numeric)', 'EXECUTE')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.set_practitioner_billing(uuid, text, numeric)'::regprocedure
                     AND prosecdef AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'Check failed: set_practitioner_billing must be for signed-in users only, running as its owner';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.practitioner_billing'::regclass)
     OR has_table_privilege('anon', 'public.practitioner_billing', 'SELECT')
     OR has_table_privilege('authenticated', 'public.practitioner_billing', 'INSERT')
     OR has_table_privilege('authenticated', 'public.practitioner_billing', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.practitioner_billing', 'DELETE') THEN
    RAISE EXCEPTION 'Check failed: practitioner_billing must be read by staff and changed only through set_practitioner_billing';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

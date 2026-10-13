-- Applied 2026-10-09 as migration bundle_extras_2026_10_09 (version 20261009103801; stored statement md5 ecae3356de7e446ee7438d6bbaee202c = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Rehearsed with simulated logins: a receptionist saved a bundle that needs an authorisation number with a line
-- 'j06.9' (saved as J06.9) at N$ 350 and a stock line of the practice's own item, then edited it back to a plain line
-- (lines replaced, flag off); another practice's stock item was refused (22023), an external-cause code and a
-- negative fee by the table checks (23514); staff of another practice saw 0 and could not edit it (P0002); the public
-- key cannot run it (42501).
-- =============================================================================================
-- PROPOSAL: code bundles with a fixed ICD-10 code and fee per line, stock items, and an authorisation prompt (D12)
-- File:   proposals/2026-10-09-bundle-extras.sql                Drafted: 2026-10-09
-- Code:   src/components/quotes/bundles.ts (the rules; tested), src/components/quotes/BundleManager.tsx (editor),
--         src/components/quotes/BundleMenu.tsx (using a bundle on a visit or quote), quoteService.ts (reads, saves)
--
-- Why (parity D12): Eminance macros carry a fixed diagnosis, an override fee and stock items per line, and can ask for
-- the fund's authorisation number when they are used. OneHealth bundles held codes and quantities only, so staff
-- typed the ICD-10 code, changed the fee and added the dispensed item by hand on every visit.
--
-- What it does (additive; the existing bundles and lines are unchanged)
--   1. billing_code_bundles.needs_authorisation: when the bundle is used, its lines need the fund's authorisation
--      number (the claim carries it per line: invoice_services.authorisation_number, 2026-10-09-line-portions.sql).
--   2. billing_code_bundle_lines: icd10_code (a fixed main ICD-10 code for the line, checked as invoice lines are),
--      fee (a fee per unit instead of the price list's, recorded on the line as a changed fee with the bundle's name)
--      and stock_item_id (the line is a stock item, priced and taken off stock as "From stock" lines are).
--   3. save_code_bundle(): the same function with the new fields, and a stock line must name an item of the bundle's
--      own practice (read with the caller's rights). It still runs with the caller's rights, so RLS applies as before.
--   Policies of both tables are not touched.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the bundle editor hides the new fields and bundles work as before.
-- Undo: restore save_code_bundle from proposals/2026-10-07-quotes-and-bundles.sql, then
--       ALTER TABLE public.billing_code_bundle_lines DROP COLUMN icd10_code, DROP COLUMN fee, DROP COLUMN stock_item_id;
--       ALTER TABLE public.billing_code_bundles DROP COLUMN needs_authorisation;
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. and 2. The new columns
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.billing_code_bundles ADD COLUMN IF NOT EXISTS needs_authorisation boolean NOT NULL DEFAULT false;

ALTER TABLE public.billing_code_bundle_lines ADD COLUMN IF NOT EXISTS icd10_code text;
ALTER TABLE public.billing_code_bundle_lines ADD COLUMN IF NOT EXISTS fee numeric(12, 2);
-- No foreign key on purpose: like a tariff code, an item that is gone is reported when the bundle is used, never
-- guessed (and deleting a stock item never touches bundles)
ALTER TABLE public.billing_code_bundle_lines ADD COLUMN IF NOT EXISTS stock_item_id uuid;

ALTER TABLE public.billing_code_bundle_lines DROP CONSTRAINT IF EXISTS billing_code_bundle_lines_icd10_check;
ALTER TABLE public.billing_code_bundle_lines ADD CONSTRAINT billing_code_bundle_lines_icd10_check
  CHECK (icd10_code IS NULL OR (icd10_code ~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$' AND icd10_code !~ '^[VWXY]'));
ALTER TABLE public.billing_code_bundle_lines DROP CONSTRAINT IF EXISTS billing_code_bundle_lines_fee_check;
ALTER TABLE public.billing_code_bundle_lines ADD CONSTRAINT billing_code_bundle_lines_fee_check
  CHECK (fee IS NULL OR (fee >= 0 AND fee <= 1000000));

COMMENT ON COLUMN public.billing_code_bundles.needs_authorisation IS
  'When the bundle is used, its lines need the fund''s authorisation number (asked for then).';
COMMENT ON COLUMN public.billing_code_bundle_lines.icd10_code IS 'A fixed main ICD-10 code for the line when the bundle is used.';
COMMENT ON COLUMN public.billing_code_bundle_lines.fee IS 'A fee per unit instead of the price list''s; recorded on the line as a changed fee.';
COMMENT ON COLUMN public.billing_code_bundle_lines.stock_item_id IS 'The line is this stock item (practice_inventory), priced as "From stock" lines are.';

-- ---------------------------------------------------------------------------------------------
-- 3. save_code_bundle with the new fields (still with the caller's rights)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_code_bundle(p_bundle jsonb, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid := NULLIF(p_bundle->>'id', '')::uuid;
  v_practice uuid;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'A code bundle needs 1 to 30 lines' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.billing_code_bundles (practice_id, name, colour, description, preset_key, needs_authorisation)
    VALUES (
      (p_bundle->>'practice_id')::uuid,
      btrim(p_bundle->>'name'),
      COALESCE(NULLIF(p_bundle->>'colour', ''), 'cyan'),
      NULLIF(btrim(COALESCE(p_bundle->>'description', '')), ''),
      NULLIF(p_bundle->>'preset_key', ''),
      COALESCE((p_bundle->>'needs_authorisation')::boolean, false)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.billing_code_bundles
    SET name = btrim(p_bundle->>'name'),
        colour = COALESCE(NULLIF(p_bundle->>'colour', ''), 'cyan'),
        description = NULLIF(btrim(COALESCE(p_bundle->>'description', '')), ''),
        needs_authorisation = COALESCE((p_bundle->>'needs_authorisation')::boolean, false)
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Code bundle % not found', v_id USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM public.billing_code_bundle_lines WHERE bundle_id = v_id;
  END IF;

  SELECT practice_id INTO v_practice FROM public.billing_code_bundles WHERE id = v_id;

  -- A stock line names an item of the bundle's own practice (read with the caller's rights)
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_lines) AS l(value)
     WHERE NULLIF(l.value->>'stock_item_id', '') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.practice_inventory i
          WHERE i.id = (l.value->>'stock_item_id')::uuid AND i.practice_id = v_practice
       )
  ) THEN
    RAISE EXCEPTION 'A stock item in this bundle is not in the practice''s stock list' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.billing_code_bundle_lines (bundle_id, practice_id, line_no, code, quantity, tooth_number, notes, icd10_code, fee, stock_item_id)
  SELECT v_id,
         v_practice,
         l.ordinality::smallint,
         upper(btrim(l.value->>'code')),
         COALESCE((l.value->>'quantity')::numeric, 1),
         NULLIF(btrim(COALESCE(l.value->>'tooth_number', '')), ''),
         NULLIF(btrim(COALESCE(l.value->>'notes', '')), ''),
         NULLIF(upper(btrim(COALESCE(l.value->>'icd10_code', ''))), ''),
         NULLIF(l.value->>'fee', '')::numeric,
         NULLIF(l.value->>'stock_item_id', '')::uuid
  FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS l(value, ordinality);

  RETURN v_id;
END
$function$;

COMMENT ON FUNCTION public.save_code_bundle(jsonb, jsonb) IS
  'Creates or replaces a code bundle and its lines in one transaction (RLS applies): codes, quantities, teeth, notes, a fixed ICD-10 code and fee per line, stock items, and whether it needs an authorisation number.';

-- ---------------------------------------------------------------------------------------------
-- 4. Checks
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.save_code_bundle(jsonb, jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'Check failed: save_code_bundle must run with the caller''s rights';
  END IF;
  IF has_function_privilege('anon', 'public.save_code_bundle(jsonb, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: the public key can save bundles';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

-- Applied 2026-10-09 as migration line_portions_2026_10_09 (version 20261009103832; stored statement md5 577aa89925d5b8f0591e34479f49a7cc = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed;
-- live prosrc md5 afterwards: sync_invoice_to_batch 8b6db25a2896be514cc08a8f6ce6acf6, add_invoice_to_batch 74dcd8eb772a2eaa231882172487f0ba)
-- Rehearsed as a receptionist on a new medical aid invoice (rolled back): of 3 lines the patient's own line never
-- reached batch_details (2 claim lines) and was stored N$ 0 fund / all patient although the screen sent the opposite;
-- the authorisation number reached the claim line; claim review's move to a batch copied 2 lines, not the patient's;
-- marking a second line the patient's left 1 claim line, marking all left the invoice unclaimed (fund total 0); a
-- 'fund' line kept its whole amount on the fund; a malformed authorisation number was refused (23514); marking the
-- lines of an invoice in a SENT batch left every sent claim line unchanged (fingerprint of all sent batches equal).
-- Repeated after applying.
-- =============================================================================================
-- PROPOSAL: who pays each invoice line, and the fund's authorisation number per line (parity D8, D12)
-- File:   proposals/2026-10-09-line-portions.sql                Drafted: 2026-10-09
-- Code:   src/utils/billing/lineSplit.ts (paid by one side, fixed co-payments, levies; tested),
--         src/utils/billing/invoiceLineRow.ts (the stored row; tested), src/services/invoicingSetup.ts (probe),
--         src/components/visits/BillingLineDetails.tsx (visit Billing tab: "Who pays", "Authorisation number"),
--         src/components/quotes/BundleMenu.tsx (a bundle that needs an authorisation number asks for it)
--
-- Why (parity D8): every line of a medical aid patient was claimed. A practice could not bill a line to the patient
-- only (for example a cosmetic procedure or a report the fund never pays), so it was sent to the fund and came back
-- rejected, or the practice left it off the invoice. Eminance marks such lines "patient liable" per line and per
-- tariff code. Parity D12: a code bundle can need the fund's authorisation number, which the claim carries per line
-- (claim field 31, 21 characters); invoice lines had nowhere to keep it.
--
-- What it does
--   1. invoice_services.paid_by: NULL (as the fund's co-payment and levy say), 'fund' (the medical aid pays all of
--      the line) or 'patient' (the patient pays all of it and it is never claimed). invoice_services.authorisation_number:
--      the fund's authorisation number for the line. Additive; existing lines are NULL in both (unchanged).
--   2. invoice_services_fill_split: a 'patient' line is always all the patient's (medical_aid_covered 0), whatever
--      the screen sent; the trigger also runs when paid_by alone changes. Otherwise exactly as before.
--   3. sync_invoice_to_batch (the claim builder run on every invoice-line change) and add_invoice_to_batch (claim
--      review's "move to another batch") leave 'patient' lines out, and an invoice with only such lines is not
--      claimed; the claim line carries the line's authorisation number. Both are edited in their LIVE definitions:
--      each changed statement must be found exactly once or nothing changes, so every other guard stays as it is
--      (a sent batch is never rewritten; lines in a sent batch are never deleted; "Do not claim" patients; medicines
--      as GMED; ICD-10 per line). CREATE OR REPLACE keeps owners and privileges.
--   4. Checks: the guards are still there and nobody gained EXECUTE.
--   Policies on invoice_services and batch_details are not touched.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. The app probes the two columns (invoicingSetup.ts) and refuses "patient pays all" lines and
-- authorisation numbers until they exist, so nothing is claimed by mistake before.
-- Undo: restore invoice_services_fill_split, sync_invoice_to_batch and add_invoice_to_batch from their definitions
--       before this file (pg_get_functiondef was read on 2026-10-09; sync_invoice_to_batch = the version of
--       proposals/2026-10-09-claim-sent-lines-kept.sql), recreate the trigger without paid_by, then
--       ALTER TABLE public.invoice_services DROP COLUMN paid_by, DROP COLUMN authorisation_number.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. The two columns
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS paid_by text;
ALTER TABLE public.invoice_services ADD COLUMN IF NOT EXISTS authorisation_number text;

ALTER TABLE public.invoice_services DROP CONSTRAINT IF EXISTS invoice_services_paid_by_check;
ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_paid_by_check
  CHECK (paid_by IS NULL OR paid_by IN ('fund', 'patient'));

-- Claim field 31 is 21 characters of a comma-separated file
ALTER TABLE public.invoice_services DROP CONSTRAINT IF EXISTS invoice_services_authorisation_check;
ALTER TABLE public.invoice_services ADD CONSTRAINT invoice_services_authorisation_check
  CHECK (authorisation_number IS NULL OR authorisation_number ~ '^[A-Za-z0-9/.-]{1,21}$');

COMMENT ON COLUMN public.invoice_services.paid_by IS
  'NULL: split by the fund''s co-payment and levy; fund: the medical aid pays all of the line; patient: the patient pays all of it and it is never claimed.';
COMMENT ON COLUMN public.invoice_services.authorisation_number IS
  'The fund''s authorisation number for the line; the claim line carries it (claim field 31).';

-- ---------------------------------------------------------------------------------------------
-- 2. The split: a patient's own line is all the patient's
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invoice_services_fill_split()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_aid boolean;
BEGIN
  IF NEW.total_price IS NULL THEN
    RETURN NEW;
  END IF;
  -- The patient pays all of a line marked so (never claimed), whatever the screen sent
  IF NEW.paid_by = 'patient' THEN
    NEW.medical_aid_covered := 0;
    NEW.patient_portion := NEW.total_price;
    RETURN NEW;
  END IF;
  IF NEW.medical_aid_covered IS NOT NULL AND NEW.patient_portion IS NOT NULL
     AND NEW.medical_aid_covered >= 0 AND NEW.patient_portion >= 0
     AND round((NEW.medical_aid_covered + NEW.patient_portion)::numeric, 2) = round(NEW.total_price::numeric, 2) THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM medical_aid_details m JOIN invoices_enhanced i ON i.patient_id = m.patient_id WHERE i.id = NEW.invoice_id
  ) INTO v_has_aid;
  IF v_has_aid THEN
    NEW.medical_aid_covered := NEW.total_price;
    NEW.patient_portion := 0;
  ELSE
    NEW.medical_aid_covered := 0;
    NEW.patient_portion := NEW.total_price;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS invoice_services_fill_split ON public.invoice_services;
CREATE TRIGGER invoice_services_fill_split
  BEFORE INSERT OR UPDATE OF total_price, medical_aid_covered, patient_portion, paid_by ON public.invoice_services
  FOR EACH ROW EXECUTE FUNCTION public.invoice_services_fill_split();

-- ---------------------------------------------------------------------------------------------
-- 3. Claims: a patient's own line never reaches a claim batch; the authorisation number goes with each line
-- ---------------------------------------------------------------------------------------------

DO $migration$
DECLARE
  v_def text;
  v_pairs text[][] := ARRAY[
    -- Eligibility: an invoice whose lines are all the patient's own is not claimed
    ARRAY[
      $old$    -- Re-evaluate the invoice for batch eligibility
    IF v_invoice.medical_aid_total IS NULL OR v_invoice.medical_aid_total <= 0 OR NOT EXISTS (SELECT 1 FROM public.invoice_services WHERE invoice_id = p_invoice_id) THEN$old$,
      $new$    -- Re-evaluate the invoice for batch eligibility: lines the patient pays all of (paid_by = 'patient') are never
    -- claimed, so an invoice with only such lines is not claimed (2026-10-09-line-portions.sql)
    IF v_invoice.medical_aid_total IS NULL OR v_invoice.medical_aid_total <= 0 OR NOT EXISTS (SELECT 1 FROM public.invoice_services WHERE invoice_id = p_invoice_id AND paid_by IS DISTINCT FROM 'patient') THEN$new$
    ],
    -- The claim lines: every line except the patient's own
    ARRAY[
      $old$    FOR v_service IN SELECT * FROM public.invoice_services WHERE invoice_id = p_invoice_id
    LOOP$old$,
      $new$    FOR v_service IN SELECT * FROM public.invoice_services WHERE invoice_id = p_invoice_id AND paid_by IS DISTINCT FROM 'patient'
    LOOP$new$
    ],
    -- The authorisation number (claim field 31)
    ARRAY[
      $old$type_of_service,
            diagnostic_code
        ) VALUES ($old$,
      $new$type_of_service,
            diagnostic_code, authorisation_number
        ) VALUES ($new$
    ],
    ARRAY[
      $old$            left(COALESCE(v_diagnostic_code, ''), 64)
        );$old$,
      $new$            left(COALESCE(v_diagnostic_code, ''), 64),
            -- The fund's authorisation number for the line, as the visit's Billing tab saved it
            COALESCE(left(NULLIF(btrim(v_service.authorisation_number), ''), 21), '')
        );$new$
    ]
  ];
  v_i integer;
BEGIN
  SELECT pg_get_functiondef('public.sync_invoice_to_batch(uuid)'::regprocedure) INTO v_def;
  FOR v_i IN 1 .. array_length(v_pairs, 1) LOOP
    IF (length(v_def) - length(replace(v_def, v_pairs[v_i][1], ''))) / length(v_pairs[v_i][1]) <> 1 THEN
      RAISE EXCEPTION 'sync_invoice_to_batch: statement % was not found exactly once; nothing changed', v_i;
    END IF;
    v_def := replace(v_def, v_pairs[v_i][1], v_pairs[v_i][2]);
  END LOOP;
  EXECUTE v_def;

  -- Claim review's "move to another batch" copies the invoice's lines too
  SELECT pg_get_functiondef('public.add_invoice_to_batch(uuid, uuid)'::regprocedure) INTO v_def;
  IF (length(v_def) - length(replace(v_def, v_pairs[2][1], ''))) / length(v_pairs[2][1]) <> 1 THEN
    RAISE EXCEPTION 'add_invoice_to_batch: the line loop was not found exactly once; nothing changed';
  END IF;
  EXECUTE replace(v_def, v_pairs[2][1], v_pairs[2][2]);
END $migration$;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  v_sync text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.sync_invoice_to_batch(uuid)'::regprocedure);
  v_add text := (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.add_invoice_to_batch(uuid, uuid)'::regprocedure);
BEGIN
  IF (length(v_sync) - length(replace(v_sync, 'paid_by IS DISTINCT FROM ''patient''', ''))) / length('paid_by IS DISTINCT FROM ''patient''') <> 2
     OR position('v_service.authorisation_number' in v_sync) = 0 THEN
    RAISE EXCEPTION 'Check failed: sync_invoice_to_batch does not leave out the patient''s own lines or carry the authorisation number';
  END IF;
  -- The earlier guards are still there
  IF position('b.sent_at IS NOT NULL' in v_sync) = 0 OR position('AND NOT EXISTS (' in v_sync) = 0
     OR position('no_claims' in v_sync) = 0 OR position('GMED' in v_sync) = 0 OR position('icd10_primary' in v_sync) = 0 THEN
    RAISE EXCEPTION 'Check failed: a guard of sync_invoice_to_batch is missing';
  END IF;
  IF position('paid_by IS DISTINCT FROM ''patient''' in v_add) = 0 OR position('rls_assert_my_practice' in v_add) = 0 THEN
    RAISE EXCEPTION 'Check failed: add_invoice_to_batch does not leave out the patient''s own lines, or lost its practice check';
  END IF;
  IF position('NEW.paid_by = ''patient''' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.invoice_services_fill_split()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: invoice_services_fill_split does not keep the patient''s own lines';
  END IF;
  IF has_function_privilege('authenticated', 'public.sync_invoice_to_batch(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.sync_invoice_to_batch(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.add_invoice_to_batch(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: a claim function can be run by app users or the public key';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

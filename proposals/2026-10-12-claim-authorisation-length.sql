-- Applied 2026-10-12 as migration claim_authorisation_length_2026_10_12 (stored statement md5 41077ce9e91be4838614d17494c09625).
-- Rehearsed: a 21-character number made the line save fail before; after widening it saved and its claim line held it.
-- =============================================================================================
-- PROPOSAL: a claim line holds the whole authorisation number the invoice line accepts (21 characters)
-- File:   proposals/2026-10-12-claim-authorisation-length.sql            Drafted: 2026-10-12
--
-- Why (found by the tooth-surfaces and partner-billing work, 2026-10-12): invoice lines accept an authorisation
-- number of 1-21 characters (invoice_services_authorisation_check; MAX_AUTHORISATION_LENGTH in
-- src/utils/billing/lineSplit.ts; the claim-correction sheet), and sync_invoice_to_batch copies up to 21 of them,
-- but batch_details.authorisation_number was varchar(20). A line with a 21-character number therefore failed to
-- save at all ("value too long for type character varying(20)"): rehearsed on a real line of an open batch. The
-- claim column is widened so nothing is cut off and no save fails. If the fund's claim layout allows only 20
-- characters in field 31, the owner confirms it and the line check and the app's limit become 20 instead.
-- No line holds an authorisation number yet (0 rows), so nothing else changes.
-- Undo: ALTER TABLE public.batch_details ALTER COLUMN authorisation_number TYPE varchar(20);
-- =============================================================================================

BEGIN;

ALTER TABLE public.batch_details ALTER COLUMN authorisation_number TYPE varchar(21);

DO $$
BEGIN
  IF (SELECT character_maximum_length FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'batch_details' AND column_name = 'authorisation_number') <> 21 THEN
    RAISE EXCEPTION 'Check failed: batch_details.authorisation_number is not 21 characters wide';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

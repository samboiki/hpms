-- Claim batch numbers: one sequence per practice number (proposal, 2026-10-07). Not applied: review, then run in
-- the Supabase SQL editor, one section at a time.
--
-- Why: the claim file is named <practice number>_<batch number>_<fund>.Dat and the header repeats the batch number.
-- The specification wants distinct, sequential batch numbers per practice. get_or_create_active_batch_id() numbers
-- each fund's batches from 1 (all six June 2025 batches were number 1), and the funds have already processed runs
-- 1-44 from the practice's previous software (Eminance) under the same practice number. Repeating a number the
-- fund has seen risks the file being treated as a duplicate and not paid.
-- How: the function's body is not in the repository, so instead of rewriting it, a BEFORE INSERT trigger gives
-- every new batch the next number for its practice number, never lower than a starting number the practice sets.
-- Existing batches keep their numbers. Deleting an unsent batch can free its number for the next batch.
-- Note: scripts/seed-demo restores demo batches with fixed numbers; with this trigger they are renumbered.

-- 1. Look first: highest batch number per practice number and fund (no patient data)
SELECT practice_number, medical_aid_reference, COUNT(*) AS batches, MAX(batch_number) AS highest, MAX(batch_date) AS latest
FROM batch_headers
GROUP BY practice_number, medical_aid_reference
ORDER BY practice_number, medical_aid_reference;

-- 2. Where each practice keeps its starting number
ALTER TABLE practices ADD COLUMN IF NOT EXISTS claim_batch_number_start integer
  CHECK (claim_batch_number_start IS NULL OR claim_batch_number_start > 0);
COMMENT ON COLUMN practices.claim_batch_number_start IS
  'First claim batch number OneHealth may use: one more than the last run the previous claims software sent under this practice number';

-- 3. The numbering trigger
CREATE OR REPLACE FUNCTION public.assign_claim_batch_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_highest integer;
  v_start integer;
BEGIN
  -- One batch at a time per practice number, so two batches never get the same number
  PERFORM pg_advisory_xact_lock(hashtext('claim_batch_number:' || NEW.practice_number));
  SELECT COALESCE(MAX(batch_number), 0) INTO v_highest
  FROM batch_headers
  WHERE practice_number = NEW.practice_number;
  SELECT MAX(claim_batch_number_start) INTO v_start
  FROM practices
  WHERE practice_number = NEW.practice_number;
  NEW.batch_number := GREATEST(v_highest + 1, COALESCE(v_start, 1));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_claim_batch_number ON batch_headers;
CREATE TRIGGER trg_assign_claim_batch_number
  BEFORE INSERT ON batch_headers
  FOR EACH ROW EXECUTE FUNCTION public.assign_claim_batch_number();

-- 4. Set the starting number: one more than the last run the funds received from Eminance (runs 1-44 were sent,
-- so 45). Use the 13-digit practice number printed on the claim files.
-- UPDATE practices SET claim_batch_number_start = 45 WHERE practice_number = '<13-digit practice number>';

-- 5. Check: create the next batch in the app (Finance > Claims), then run step 1 again; the new batch must be 45
-- (or one more than the highest number for that practice number).

-- Undo:
-- DROP TRIGGER IF EXISTS trg_assign_claim_batch_number ON batch_headers;
-- DROP FUNCTION IF EXISTS public.assign_claim_batch_number();
-- ALTER TABLE practices DROP COLUMN IF EXISTS claim_batch_number_start;

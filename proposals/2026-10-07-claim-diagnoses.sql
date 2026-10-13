-- Room for every ICD-10 code of a claim line (proposal, 2026-10-07). Not applied: review, then run in the Supabase SQL
-- editor.
--
-- Why: a claim line may carry up to 5 ICD-10 codes ("K02.1/K04.0/Z01.2", claim field 33, at most 64 characters). The batch
-- review saves them in batch_details.diagnostic_code, which is VARCHAR(20): about three codes fit, and the app keeps the
-- ones that fit and says so. Widening the column keeps them all. Widening a VARCHAR never rewrites or changes data.
-- If step 2 fails because a view uses the column ("cannot alter type of a column used by a view"), drop that view,
-- widen, and recreate it from its definition (pg_get_viewdef) in the same transaction; the rehearsal names the view.

-- 1. Look first
SELECT character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'batch_details' AND column_name = 'diagnostic_code';

-- 2. Widen (only if it is shorter than 64)
ALTER TABLE public.batch_details ALTER COLUMN diagnostic_code TYPE varchar(64);

-- 3. Check: step 1 again shows 64.
-- Undo (only if no saved value is longer than 20): ALTER TABLE public.batch_details ALTER COLUMN diagnostic_code TYPE varchar(20);

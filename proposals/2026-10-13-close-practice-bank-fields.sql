-- =============================================================================================
-- PROPOSAL (OWNER STEP, AFTER THE WEBSITES ARE REDEPLOYED): the public key no longer reads practices directly
-- File:   proposals/2026-10-13-close-practice-bank-fields.sql            Drafted: 2026-10-13 (agent dbops)
--
-- Why (owner decision, 13 Oct 2026): close public read of practices' bank and tax fields. The public listing
-- (proposals/2026-10-13-public-practice-listing.sql, applied) gives websites what they need. Column privileges
-- cannot hide columns from a "select=*" request (it fails as a whole), so the live practice websites, which still
-- ask practices for select=* by slug, would stop loading if this ran before they are redeployed. Logs of
-- 13 Oct: the newcharm website ("node", select=*&slug=eq.newcharm-dental) is such a reader.
--
-- What it does: REVOKE SELECT on public.practices from anon (and PUBLIC). Signed-in staff keep their access through
-- the existing practice-isolation policies (no policy changes: practices is a protected table). The policy
-- "Allow anon to select practices" becomes inert (no grant); it can be dropped by the practice-isolation owner.
--
-- How to apply (owner):
--   1. Redeploy the practice websites (hpms-landing on Vercel) from the code that reads practice_listing.
--   2. Open a website (e.g. newcharmdentalpractice.com) and check it loads and the booking form opens.
--   3. Run the part between BEGIN; and ROLLBACK; as migration close_practice_bank_fields_2026_10_13.
-- Undo: GRANT SELECT ON public.practices TO anon;
-- =============================================================================================

BEGIN;

REVOKE SELECT ON public.practices FROM PUBLIC, anon;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.practices', 'SELECT')
     OR has_column_privilege('anon', 'public.practices', 'account_number', 'SELECT')
     OR has_column_privilege('anon', 'public.practices', 'tax_number', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: anon still reads practices';
  END IF;
  IF NOT has_table_privilege('anon', 'public.practice_listing', 'SELECT') THEN
    RAISE EXCEPTION 'Check failed: the public listing is not readable';
  END IF;
END $$;

ROLLBACK;

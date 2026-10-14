-- Applied 2026-10-13 as migration public_practice_listing_2026_10_13 (version 20261013200100; stored statement md5 1148c8ef8f6c091fbbcf168f6d0dbcd1 = md5 of the part between BEGIN; and ROLLBACK;)
-- =============================================================================================
-- PROPOSAL: a public listing of practices for practice websites and the practice directory
-- File:   proposals/2026-10-13-public-practice-listing.sql            Drafted: 2026-10-13 (agent dbops)
-- Code:   hpms-landing/src/lib/tenants.ts (practice website by domain or slug), hpms-landing/src/components/
--         PracticeDirectory.tsx (directory), hpms-landing/src/app/debug/page.tsx and src/app/test/route.ts (checks)
--         now read public.practice_listing instead of practices.
--
-- Why (owner decision, 13 Oct 2026): "Public practice listing view for websites; close public read of bank/tax
-- fields." Today the public key (anon) reads every column of practices (select=*): bank account, branch code,
-- tax and licence numbers, subscription prices, the administrator's contact details. The practice websites
-- (newcharmdentalpractice.com and the other hpms-landing sites, server side, by slug or domain) are the only
-- anonymous readers; the staff app reads practices signed in.
--
-- What it does
--   1. public.practice_listing: one row per practice with only what a website shows: id, slug, name, domain, logo,
--      colours and theme, contact email and phone, address, city, country, postal code, opening hours, features,
--      services, hero texts and image, about text, social links, testimonials, gallery (metadata), Google review
--      link, practice type and the website settings (booking switches, discipline and practice number, which are
--      public in the directory anyway). No bank, tax, licence, subscription, admin, Gmail or password columns.
--      The view runs as its owner (it is the public face of the table), so it keeps working once anon loses direct
--      SELECT on practices (proposals/2026-10-13-close-practice-bank-fields.sql).
--   2. anon and authenticated may SELECT the view; nobody may write through it.
--
-- How to apply: rehearse (anon reads the listing for newcharm-dental by slug, and the view has no bank or tax
--   column), apply the part between BEGIN; and ROLLBACK; (public_practice_listing_2026_10_13), redeploy the practice
--   websites (hpms-landing) with the new code, THEN apply proposals/2026-10-13-close-practice-bank-fields.sql.
-- Undo: DROP VIEW public.practice_listing;
-- =============================================================================================

BEGIN;

CREATE OR REPLACE VIEW public.practice_listing AS
SELECT p.id, p.slug, p.name, p.domain, p.logo_url, p.primary_color, p.secondary_color, p.theme_id,
       p.contact_email, p.contact_phone, p.address, p.city, p.country, p.postal_code,
       p.business_hours, p.features, p.settings, p.services, p.hero_title, p.hero_subtitle, p.hero_image_url,
       p.about_text, p.social_links, p.testimonials, p.metadata, p.google_review_url,
       p.practice_type, p.timezone, p.currency, p.status
  FROM public.practices p;
COMMENT ON VIEW public.practice_listing IS
  'What a practice website or the practice directory may show about a practice (owner, 13 Oct 2026). Never add bank, tax, licence, subscription, administrator or login columns.';

REVOKE ALL ON public.practice_listing FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.practice_listing TO anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'practice_listing'
                AND (column_name ~ '(bank|account|branch_code|swift|tax|license|licence|password|gmail|admin_|subscription|price|cost|premium|budget|registration)')) THEN
    RAISE EXCEPTION 'Check failed: the public listing exposes a private column';
  END IF;
  IF has_table_privilege('anon', 'public.practice_listing', 'INSERT') OR has_table_privilege('anon', 'public.practice_listing', 'UPDATE') THEN
    RAISE EXCEPTION 'Check failed: the listing can be written';
  END IF;
END $$;

ROLLBACK;

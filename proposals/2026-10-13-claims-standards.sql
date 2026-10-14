-- Applied 2026-10-13 as migration claims_standards_2026_10_13 (version 20261013194526; stored statement md5 5679ba279f6c5697bc852e60b6e2a41b = md5 of the part between BEGIN; and ROLLBACK;)
-- =============================================================================================
-- PROPOSAL: the claims standard - researched fund deadlines and membership-number lengths in the fund master
--           (parity F11, A6)
-- File:   proposals/2026-10-13-claims-standards.sql                   Drafted: 2026-10-13
-- Code:   src/utils/billing/fundRules.ts (FUND_RULES: the same values as the app's built-in standard, each with its
--         source; MONTH_END_FUNDS: NHP and NAMMED count to the end of the month, in the code, no column needed);
--         tests in src/utils/billing/__tests__/fundRules.test.ts
--
-- Why: the owner (13 Oct 2026) asked for the claim deadlines and member-number formats to be researched and set as a
-- standard. The fund master (proposals/2026-10-12-fund-master.sql, applied 12 Oct) still holds the seed guesses, and a
-- row in the table wins over the app's built-in values, so the researched values reach the claim checks only once
-- the rows say the same:
--   NAMM  4 months, confirmed (was 120 days, not confirmed). Nammed member guide, "Claims procedures": "not later
--         than the last day of the fourth month following the month in which the service was rendered"
--         (https://www.nammed.com.na/uploads/documents/4260bdcc2c8fbf7db85adf639cbdc921ff17106e.pdf, read 13 Oct
--         2026). The app counts NAMMED's and NHP's months to the end of the month (fundRules.ts MONTH_END_FUNDS).
--   MAG1  membership numbers 9, 13 or 14 digits, with a hint (was: no check). 9 digits on Methealth's PSEMAS
--         statements, 13-14 on older cards that PSEMAS accepted on claims. Lengths only warn, never block.
--   PROS  4 months, still NOT confirmed (was 120 days); 6 digits with a hint. Prosperity publishes no rule; the Napotel
--         booklet 2020 (a fund Prosperity administers) says "four (4) months from the date of service".
--   NHPM, NMC1 unchanged (NHP 4 months, counted to month end by the app; NMC 120 days, Methealth's published rule).
-- Only rows nobody has changed (updated_by IS NULL, still as seeded) are updated: a value OneHealth support set on
-- Administration > Medical aid funds is never overwritten. Each update writes a change-history row (changed_by NULL:
-- this migration), so support can see what moved and why.
--
-- How to apply: after review, run the part between BEGIN; and ROLLBACK; as one migration
-- (name claims_standards_2026_10_13). NOT applied and NOT rehearsed: no database connection on 13 Oct (wave 11).
-- Before applying, rehearse: the three rows change, a row with updated_by set is left alone, three history rows.
-- Undo: support sets the old values on Administration > Medical aid funds, or run
--   UPDATE public.medical_aid_fund_rules SET claim_deadline_days = 120, claim_deadline_months = NULL,
--     deadline_confirmed = false WHERE medical_aid_reference IN ('NAMM', 'PROS') AND updated_by IS NULL;
--   UPDATE public.medical_aid_fund_rules SET membership_digits = '{}', membership_hint = NULL
--     WHERE medical_aid_reference IN ('MAG1', 'PROS') AND updated_by IS NULL;
-- The app works before and after: until applied, these funds keep the seed values from the table.
-- =============================================================================================

BEGIN;

-- 1. The history first, from the rows as they are now (only rows nobody changed)
WITH standard(code, patch) AS (
  VALUES
    ('NAMM', '{"claim_deadline_days": null, "claim_deadline_months": 4, "deadline_confirmed": true}'::jsonb),
    ('MAG1', '{"membership_digits": [9, 13, 14], "membership_hint": "New PSEMAS numbers have 9 digits (with leading zeros); older cards show 13 or 14. Check the card."}'::jsonb),
    ('PROS', '{"claim_deadline_days": null, "claim_deadline_months": 4, "membership_digits": [6], "membership_hint": "Prosperity numbers seen so far have 6 digits; not confirmed with the fund. Check the card."}'::jsonb)
)
INSERT INTO public.medical_aid_fund_rule_changes (medical_aid_reference, provider_id, changed_by, old_values, new_values)
SELECT r.medical_aid_reference,
       (SELECT p.id FROM public.medical_aid_providers p WHERE p.medical_aid_reference = r.medical_aid_reference LIMIT 1),
       NULL,
       to_jsonb(r) - ARRAY['created_at', 'updated_at', 'updated_by'],
       (to_jsonb(r) - ARRAY['created_at', 'updated_at', 'updated_by']) || s.patch
  FROM public.medical_aid_fund_rules r
  JOIN standard s ON s.code = r.medical_aid_reference
 WHERE r.updated_by IS NULL;

-- 2. The researched values
UPDATE public.medical_aid_fund_rules
   SET claim_deadline_days = NULL, claim_deadline_months = 4, deadline_confirmed = true, updated_at = now()
 WHERE medical_aid_reference = 'NAMM' AND updated_by IS NULL;

UPDATE public.medical_aid_fund_rules
   SET membership_digits = '{9,13,14}',
       membership_hint = 'New PSEMAS numbers have 9 digits (with leading zeros); older cards show 13 or 14. Check the card.',
       updated_at = now()
 WHERE medical_aid_reference = 'MAG1' AND updated_by IS NULL;

UPDATE public.medical_aid_fund_rules
   SET claim_deadline_days = NULL, claim_deadline_months = 4, deadline_confirmed = false,
       membership_digits = '{6}',
       membership_hint = 'Prosperity numbers seen so far have 6 digits; not confirmed with the fund. Check the card.',
       updated_at = now()
 WHERE medical_aid_reference = 'PROS' AND updated_by IS NULL;

ROLLBACK;

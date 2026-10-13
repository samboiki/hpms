-- Applied 2026-10-07 as migration practice_protected_columns_2026_10_07
-- Fix 2026-10-08 applied as migration practice_protected_columns_message_2026_10_08 (the refusal names the type too)
-- =============================================================================================
-- PROPOSAL: only administrators change a practice's bank details, numbers and plan
-- File:   proposals/2026-10-07-practice-protected-columns.sql           Drafted: 2026-10-07
--
-- Why: the policy "Allow users to update their own practice" lets every staff member of a practice
-- update its row. So a receptionist could change the bank account printed on every invoice and
-- statement (a payment-redirection fraud), the practice number on claims, or raise the practice's
-- own SMS limit or plan. The policy stays (the theme, hours, contact details and automation
-- switches are legitimately changed by staff); this trigger protects the columns that matter.
--
-- Two tiers, checked for signed-in users only (auth.uid() set). Platform processes (edge functions
-- with the service key, migrations, the SQL editor) have no signed-in user and are not checked.
--   OneHealth support only (users.is_super_admin): the plan, limits, approval and pricing columns.
--   Practice administrators (users.role = 'admin') and support: the practice's name, type, numbers,
--   bank details, website address (slug, domain), owner and claim batch start.
-- Who updates practices today: src/pages/Settings.tsx (practice profile form), src/stores/
-- themeStore.ts (theme_id), src/components/settings/FollowUpAutomation.tsx (the follow-up switch);
-- no database function updates practices. Inserts (new practices) are not affected.
--
-- Undo: DROP TRIGGER IF EXISTS practices_protected_columns ON public.practices;
--       DROP FUNCTION IF EXISTS public.practices_guard_protected_columns();
-- =============================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.practices_guard_protected_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_super boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT u.role, COALESCE(u.is_super_admin, false) INTO v_role, v_super FROM users u WHERE u.id = v_uid;
  IF v_super THEN
    RETURN NEW;
  END IF;

  IF (NEW.status, NEW.subscription_tier, NEW.subscription_expires_at, NEW.max_users, NEW.max_patients,
      NEW.sms_limit, NEW.sms_used, NEW.approval_status, NEW.approved_by, NEW.approved_at, NEW.rejection_reason,
      NEW.submitted_at, NEW.total_monthly_premium, NEW.base_price, NEW.branches_cost, NEW.website_cost,
      NEW.emails_cost, NEW.website_hosting_enabled, NEW.professional_email_count, NEW.number_of_branches)
     IS DISTINCT FROM
     (OLD.status, OLD.subscription_tier, OLD.subscription_expires_at, OLD.max_users, OLD.max_patients,
      OLD.sms_limit, OLD.sms_used, OLD.approval_status, OLD.approved_by, OLD.approved_at, OLD.rejection_reason,
      OLD.submitted_at, OLD.total_monthly_premium, OLD.base_price, OLD.branches_cost, OLD.website_cost,
      OLD.emails_cost, OLD.website_hosting_enabled, OLD.professional_email_count, OLD.number_of_branches) THEN
    RAISE EXCEPTION 'Only OneHealth support can change a practice''s plan, limits or approval.'
      USING ERRCODE = '42501', HINT = 'practice_protected_columns';
  END IF;

  IF v_role IS DISTINCT FROM 'admin' AND
     (NEW.name, NEW.practice_type, NEW.practice_type_id, NEW.practice_number, NEW.tax_number, NEW.license_number,
      NEW.registration_number, NEW.bank_name, NEW.account_holder_name, NEW.account_number, NEW.branch_code,
      NEW.swift_code, NEW.account_type, NEW.slug, NEW.domain, NEW.admin_user_id, NEW.claim_batch_number_start)
     IS DISTINCT FROM
     (OLD.name, OLD.practice_type, OLD.practice_type_id, OLD.practice_number, OLD.tax_number, OLD.license_number,
      OLD.registration_number, OLD.bank_name, OLD.account_holder_name, OLD.account_number, OLD.branch_code,
      OLD.swift_code, OLD.account_type, OLD.slug, OLD.domain, OLD.admin_user_id, OLD.claim_batch_number_start) THEN
    RAISE EXCEPTION 'Only a practice administrator can change the practice''s name, type, numbers or bank details.'
      USING ERRCODE = '42501', HINT = 'practice_protected_columns';
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.practices_guard_protected_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS practices_protected_columns ON public.practices;
CREATE TRIGGER practices_protected_columns BEFORE UPDATE ON public.practices
  FOR EACH ROW EXECUTE FUNCTION public.practices_guard_protected_columns();

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

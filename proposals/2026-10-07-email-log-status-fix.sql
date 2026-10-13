-- Applied 2026-10-07 as migration email_log_status_fix_2026_10_07
-- =============================================================================================
-- PROPOSAL: sent emails are logged as sent
-- File:   proposals/2026-10-07-email-log-status-fix.sql                 Drafted: 2026-10-07
--
-- Why: the trigger update_email_usage_trigger (AFTER UPDATE OF status ON practice_email_logs,
-- function update_email_subscription_usage) updates practice_email_subscriptions columns that do
-- not exist (emails_used, last_email_sent_at, status, start_date, end_date). So every update of a
-- log row to 'sent' fails. The centralized email gateway (supabase/functions/
-- centralized-email-gateway) sends through Resend, then sets the log row to 'sent' without
-- checking the result: the email goes out, the log stays 'pending'. Reproduced 2026-10-07 in a
-- rolled-back test ("column status does not exist"); 146 log rows are 'pending' today.
--
-- The trigger is also redundant: the gateway itself adds 1 to
-- practice_email_subscriptions.current_usage after each sent email. Fixing the function would
-- count every email twice, so the trigger is dropped. The function is kept (unused) so nothing is
-- lost; the stuck 'pending' rows are left as they are, because which of them were really sent
-- cannot be told afterwards (the failed update also carried the provider's message id).
--
-- Undo: CREATE TRIGGER update_email_usage_trigger AFTER UPDATE OF status ON public.practice_email_logs
--         FOR EACH ROW EXECUTE FUNCTION public.update_email_subscription_usage();
-- =============================================================================================

BEGIN;

DROP TRIGGER IF EXISTS update_email_usage_trigger ON public.practice_email_logs;

COMMENT ON FUNCTION public.update_email_subscription_usage() IS
  'Unused since 2026-10-07 (proposals/2026-10-07-email-log-status-fix.sql): it referred to columns practice_email_subscriptions does not have, and the email gateway counts usage itself.';

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

-- Applied 2026-10-08 as migration follow_up_functions_closed_2026_10_08
-- =============================================================================================
-- PROPOSAL: the follow-up automation engine can no longer be run by anyone with the public key
-- File:   proposals/2026-10-08-follow-up-functions-closed.sql           Drafted: 2026-10-08
--
-- Why: process_follow_up_automation(visit) creates follow-up bookings for the visit it is given and
-- run_follow_up_automation() runs that for every practice. Both are SECURITY DEFINER (they run as
-- their owner, past every practice's row security), check nothing about the caller, and could be
-- called by anyone with the public key or any signed-in user of any practice. Found 2026-10-08.
-- Nothing in the app or the database calls them (no trigger, no function, no src/ or supabase/
-- functions caller); only a server-side scheduler with the service key could, and it keeps access.
--
-- Undo: GRANT EXECUTE ON FUNCTION public.process_follow_up_automation(uuid), public.run_follow_up_automation()
--         TO anon, authenticated;
-- =============================================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.process_follow_up_automation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_follow_up_automation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_follow_up_automation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_follow_up_automation() TO service_role;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

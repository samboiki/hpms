-- Applied 2026-10-13 as migration batch_function_grants_2026_10_13 (version 20261013001204; stored statement md5 3ca6cd85c246be0a83ed0d3616f2a7e2 = md5 of the part between BEGIN; and ROLLBACK;)
-- =============================================================================================
-- Only signed-in staff may call get_or_create_active_batch_id (2026-10-13)
--
-- Why: the function finds or opens a fund's claim batch. It runs with the caller's rights, so the table rules
-- already refuse anyone who is not staff of the practice, but it was still callable by PUBLIC and anon.
-- OneHealth never grants functions to anonymous callers. Its only app caller is Finance > Claims
-- (claimsService.addInvoicesToFundBatch, a signed-in user); the database's own functions that call it run
-- as their owner and are unaffected.
--
-- How to apply: run the part between BEGIN; and ROLLBACK; as a migration.
-- Undo: GRANT EXECUTE ON FUNCTION public.get_or_create_active_batch_id(uuid, text) TO PUBLIC, anon;
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_or_create_active_batch_id(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_active_batch_id(uuid, text) TO authenticated, service_role;

ROLLBACK;

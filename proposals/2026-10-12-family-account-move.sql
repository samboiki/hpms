-- Applied 2026-10-12 as migration family_account_move_2026_10_12 (version 20261012191724; stored statement md5 97ece9a0247c46bc496dec98bf3154b7 = md5 of the part between BEGIN; and ROLLBACK;, blank lines at its ends trimmed)
-- Live prosrc md5 of dc_move_account_holder afterwards b321b7ec00ce1caa124440ae3a730afb (SECURITY DEFINER; anon cannot run it).
-- Rehearsed (rolled back) with simulated logins: a receptionist linked a spouse and a child to a holder and moved the account
-- to the spouse: 2 moved, the old holder became the spouse's spouse, the child stayed a child, both old links closed with
-- "Moved to a new account holder: <reason>"; again: already, 0 moved. Refused (P0001): from a paid-for patient, to another
-- family's member, no reason, an unknown relationship; from someone paying for nobody: nothing. Editing history 42501;
-- another practice's doctor and the public key 42501.
-- =============================================================================================
-- PROPOSAL: making a family member the account holder moves the whole family account to them (parity A3)
-- File:   proposals/2026-10-12-family-account-move.sql                    Drafted: 2026-10-12
-- Code:   src/utils/patients/accountMove.ts (who follows, the relationship, unit tested),
--         src/components/finance/debtors/debtorsService.ts (moveAccountHolder), FamilySheet.tsx ("Make account holder"),
--         src/components/modals/ManageBeneficiariesModal.tsx ("Make main member" moves the account first)
--
-- Why (parity A3): "Make main member" rewrites the family's medical aid records, but the billing account stayed with
-- the old main member: statements, credit control and the family's balance kept going to them, and staff had to
-- remove every member from the account with a reason and link them again one by one (dc_unlink_account_holder,
-- dc_link_account_holder). Eminance re-keys the dependant as the main member in one step.
--
-- What it does
--   1. dc_move_account_holder(practice, current holder, new holder, how the current holder is related to the new one,
--      reason): in one transaction it closes every link of the current holder's account (the new holder's own link
--      too), keeping "Moved to a new account holder: <reason>" on each, links the current holder to the new one and
--      every other member to the new one with the relationship they had. Invoices stay where they are; only who pays
--      changes (as dc_unlink_account_holder says). Staff of the practice, as for linking and unlinking.
--      Refused: the current holder is paid for by someone else, the new holder is on another family's account, no
--      reason. Run again after it worked (a second tap, or "Make main member" pressed again to finish a medical aid
--      swap): nothing changes ('already'). The current holder pays for nobody: nothing to move ('nothing').
--   2. No table or policy changes: account_holder_links keeps its triggers (one level only, the history guard).
--   Needs proposals/2026-10-07-debtors-and-controls.sql (account_holder_links, dc_assert_member, dc_assert_patient).
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then "Make main member" changes the medical aid only and says the account was not moved.
-- Undo: DROP FUNCTION IF EXISTS public.dc_move_account_holder(uuid, uuid, uuid, text, text);
-- =============================================================================================

BEGIN;

-- Stop before changing anything when the account functions and the links table are not as expected
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(signature, ', ') INTO v_missing
    FROM (VALUES ('public.dc_assert_member(uuid)'), ('public.dc_assert_patient(uuid,uuid)'),
                 ('public.dc_link_account_holder(uuid,uuid,uuid,text)'), ('public.dc_unlink_account_holder(uuid,uuid,text)')) AS t(signature)
   WHERE to_regprocedure(signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.account_holder_links'::regclass
                    AND tgname = 'dc_10_before_insert' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Stopped: account_holder_links has no dc_10_before_insert (one level only); this file relies on it';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. dc_move_account_holder
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dc_move_account_holder(
  p_practice_id uuid,
  p_from_holder_id uuid,
  p_to_patient_id uuid,
  p_relationship text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reason text := btrim(regexp_replace(COALESCE(p_reason, ''), '\s+', ' ', 'g'));
  v_link account_holder_links%ROWTYPE;
  v_members jsonb := '[]'::jsonb;
  v_member jsonb;
  v_moved integer := 0;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  PERFORM dc_assert_patient(p_practice_id, p_from_holder_id);
  PERFORM dc_assert_patient(p_practice_id, p_to_patient_id);
  IF p_from_holder_id = p_to_patient_id THEN
    RAISE EXCEPTION 'Choose another family member to hold the account';
  END IF;
  IF COALESCE(p_relationship, '') NOT IN ('spouse', 'child', 'dependant', 'other') THEN
    RAISE EXCEPTION 'Choose how the current account holder is related to the new one';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 200 THEN
    RAISE EXCEPTION 'Say why the account moves, in 3 to 200 characters (it is kept with the account)';
  END IF;

  -- One move of this family at a time
  PERFORM 1 FROM account_holder_links
   WHERE practice_id = p_practice_id AND unlinked_at IS NULL
     AND (holder_patient_id = p_from_holder_id OR patient_id IN (p_from_holder_id, p_to_patient_id))
     FOR UPDATE;

  -- Moved already (a second tap, or the medical aid swap run again to finish it): nothing to do
  IF EXISTS (SELECT 1 FROM account_holder_links
              WHERE practice_id = p_practice_id AND patient_id = p_from_holder_id
                AND holder_patient_id = p_to_patient_id AND unlinked_at IS NULL) THEN
    RETURN jsonb_build_object('moved', 0, 'already', true, 'holder_patient_id', p_to_patient_id);
  END IF;
  IF EXISTS (SELECT 1 FROM account_holder_links
              WHERE practice_id = p_practice_id AND patient_id = p_from_holder_id AND unlinked_at IS NULL) THEN
    RAISE EXCEPTION 'Someone else pays for this family. Move the account from the person who pays.';
  END IF;
  IF EXISTS (SELECT 1 FROM account_holder_links
              WHERE practice_id = p_practice_id AND patient_id = p_to_patient_id
                AND holder_patient_id <> p_from_holder_id AND unlinked_at IS NULL) THEN
    RAISE EXCEPTION 'The new account holder is on another family''s account. Remove them from it first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM account_holder_links
                  WHERE practice_id = p_practice_id AND holder_patient_id = p_from_holder_id AND unlinked_at IS NULL) THEN
    RETURN jsonb_build_object('moved', 0, 'nothing', true, 'holder_patient_id', NULL);
  END IF;

  -- 1. Close every link of the current account, the reason kept on each (the history guard allows only this)
  FOR v_link IN
    SELECT * FROM account_holder_links
     WHERE practice_id = p_practice_id AND holder_patient_id = p_from_holder_id AND unlinked_at IS NULL
     ORDER BY linked_at, id
  LOOP
    UPDATE account_holder_links
       SET unlinked_at = now(), unlinked_by = auth.uid(), unlink_reason = 'Moved to a new account holder: ' || v_reason
     WHERE id = v_link.id;
    IF v_link.patient_id <> p_to_patient_id THEN
      v_members := v_members || jsonb_build_array(jsonb_build_object('patient_id', v_link.patient_id, 'relationship', v_link.relationship));
    END IF;
  END LOOP;

  -- 2. The current holder joins the new holder's account
  INSERT INTO account_holder_links (practice_id, patient_id, holder_patient_id, relationship)
  VALUES (p_practice_id, p_from_holder_id, p_to_patient_id, p_relationship);
  v_moved := 1;

  -- 3. Every other member follows, with the relationship they had
  FOR v_member IN SELECT * FROM jsonb_array_elements(v_members) LOOP
    INSERT INTO account_holder_links (practice_id, patient_id, holder_patient_id, relationship)
    VALUES (p_practice_id, (v_member->>'patient_id')::uuid, p_to_patient_id, v_member->>'relationship');
    v_moved := v_moved + 1;
  END LOOP;

  RETURN jsonb_build_object('moved', v_moved, 'holder_patient_id', p_to_patient_id);
END $function$;

COMMENT ON FUNCTION public.dc_move_account_holder(uuid, uuid, uuid, text, text) IS
  'Moves a family account to another member in one step: every link of the current holder is closed with the reason, '
  'the current holder and every other member are linked to the new holder. Staff of the practice.';
REVOKE ALL ON FUNCTION public.dc_move_account_holder(uuid, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dc_move_account_holder(uuid, uuid, uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Checks: the public key cannot run it; it runs with the owner's rights behind its own checks
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.dc_move_account_holder(uuid, uuid, uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'check failed: the public key can run dc_move_account_holder';
  END IF;
  IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = 'public.dc_move_account_holder(uuid, uuid, uuid, text, text)'::regprocedure) THEN
    RAISE EXCEPTION 'check failed: dc_move_account_holder is not SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'family account move ready';
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

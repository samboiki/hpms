-- Applied 2026-10-13 as migration fund_moves_2026_10_13 (version 20261013012952; stored statement md5 2fadf2acc3754bf4fe63cdceafe5d343 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins and an invented patient (rolled back): reception and another practice were refused
-- (42501), no reason was refused (22023); the administrator moved the patient from NMC1 to another fund and option
-- (option tidied, written to scheme and plan_type); the two claims waiting in the NMC1 open batch followed to the new
-- fund's batch; the medical aid's audit row has the move's moment; the same preview again was skipped as changed, a
-- move to where the patient already is as already; staff read the move, another practice 0; a move row cannot be
-- changed; sent claim lines unchanged.
-- =============================================================================================
-- PROPOSAL: move many patients from one fund or option to another in one step (parity A21)
-- File:   proposals/2026-10-13-fund-moves.sql                            Drafted: 2026-10-13
-- Code:   src/utils/accounts/fundMoves.ts (the funds and options the practice's patients are on, who a choice moves,
--         the checks; tested), src/services/fundMoveService.ts, src/components/patients/fundMove/FundMoveDialog.tsx
--         (Patients > More > Move to another fund, administrators), src/components/patients/changeHistory.ts (each
--         patient's change history says why the medical aid changed)
--
-- Why (A21): when a fund closes or renames an option, or members move to another fund at the start of a year, every
-- patient on it had to be changed one file at a time. Eminance replaces a scheme in bulk.
--
-- What it does (additive; the policies of the protected tables are not touched)
--   1. fund_moves: each move: what was chosen, the fund and option moved to, why, who and when, how many patients
--      moved and how many claims followed them. fund_move_patients: each patient's medical aid as it was and as it
--      became. Both are never changed or deleted (a patient's rows go only with the patient).
--   2. apply_fund_move(practice, payload): practice administrators only. For each patient chosen after the preview,
--      the medical aid row is changed only when it is still as the preview showed it (else it is left and reported),
--      in one transaction. The medical aid's own audit trigger records the change in each patient's change history,
--      which shows this move's reason with it. Invoices waiting in a claim batch NOT sent yet follow a patient whose
--      fund (claim code) changed into the new fund's open batch (claim_invoice_into_batch, the claim builder); claims
--      already sent are never touched.
--   3. Staff of the practice read the moves; the patient app's logins read nothing; anon has nothing.
--
-- How to apply: rehearse in a transaction that rolls back, then apply the part between BEGIN; and ROLLBACK; as one
-- migration. Until then the dialog says the move is not set up yet.
-- Undo: DROP FUNCTION IF EXISTS public.apply_fund_move(uuid, jsonb);
--       DROP TABLE IF EXISTS public.fund_move_patients, public.fund_moves;
--       (moves already made are undone by moving the patients back: their before values are in fund_move_patients)
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ') INTO v_missing
    FROM (VALUES ('medical_aid_details', 'id'), ('medical_aid_details', 'patient_id'), ('medical_aid_details', 'provider'),
                 ('medical_aid_details', 'scheme'), ('medical_aid_details', 'plan_type'), ('medical_aid_details', 'medical_aid_provider_id'),
                 ('medical_aid_providers', 'medical_aid_reference'), ('patients', 'merged_into_patient_id'),
                 ('batch_headers', 'medical_aid_reference'), ('invoices_enhanced', 'batch_id')) AS t(table_name, column_name)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these columns are missing: %', v_missing;
  END IF;
  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.dc_assert_role(uuid,text[],text)'), ('public.claim_invoice_into_batch(uuid,uuid)'), ('public.rls_my_practice_id()'),
                 ('public.dc_history_guard()'), ('public.dc_no_truncate()'), ('public.ar_audit_append_only()')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
  PERFORM set_config('onehealth.fund_move_policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('patients', 'medical_aid_details', 'medical_aid_providers', 'invoices_enhanced')
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The moves and each patient's change
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fund_moves (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id    uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  -- What was chosen, as the screen said it ("NMC1, option Standard; main members only")
  from_label     text NOT NULL CHECK (char_length(from_label) <= 300),
  to_provider_id uuid REFERENCES public.medical_aid_providers(id) ON DELETE SET NULL,
  to_provider    text NOT NULL,
  -- NULL: each patient kept their option
  to_option      text CHECK (to_option IS NULL OR char_length(to_option) <= 100),
  reason         text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  patient_count  integer NOT NULL CHECK (patient_count > 0),
  claims_moved   integer NOT NULL DEFAULT 0 CHECK (claims_moved >= 0),
  moved_by       uuid,
  moved_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fund_moves_practice_idx ON public.fund_moves (practice_id, moved_at DESC);
COMMENT ON TABLE public.fund_moves IS
  'Patients moved from one fund or option to another in one step (parity A21), with why, who and when. Written only by apply_fund_move; never changed.';

CREATE TABLE IF NOT EXISTS public.fund_move_patients (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  move_id        uuid NOT NULL REFERENCES public.fund_moves(id) ON DELETE RESTRICT,
  practice_id    uuid NOT NULL,
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- The medical_aid_details row changed (no foreign key: the history outlives the row)
  medical_aid_id uuid NOT NULL,
  -- { provider, scheme, plan_type, medical_aid_provider_id } before and after
  before         jsonb NOT NULL,
  after          jsonb NOT NULL,
  -- The same moment as the medical aid's audit row (one transaction): the change history matches them
  moved_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fund_move_patients_move_idx ON public.fund_move_patients (move_id);
CREATE INDEX IF NOT EXISTS fund_move_patients_patient_idx ON public.fund_move_patients (patient_id, moved_at DESC);
COMMENT ON TABLE public.fund_move_patients IS
  'Each patient''s medical aid before and after a fund move. Never changed; a patient''s rows go only with the patient.';

DROP TRIGGER IF EXISTS fund_moves_append_only ON public.fund_moves;
CREATE TRIGGER fund_moves_append_only BEFORE UPDATE OR DELETE ON public.fund_moves
  FOR EACH ROW EXECUTE FUNCTION public.ar_audit_append_only();
DROP TRIGGER IF EXISTS fund_moves_no_truncate ON public.fund_moves;
CREATE TRIGGER fund_moves_no_truncate BEFORE TRUNCATE ON public.fund_moves
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();
-- A patient's rows may go with the patient (dc_history_guard allows a delete once the patient is gone)
DROP TRIGGER IF EXISTS fund_move_patients_history ON public.fund_move_patients;
CREATE TRIGGER fund_move_patients_history BEFORE UPDATE OR DELETE ON public.fund_move_patients
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('', 'patient_id');
DROP TRIGGER IF EXISTS fund_move_patients_no_truncate ON public.fund_move_patients;
CREATE TRIGGER fund_move_patients_no_truncate BEFORE TRUNCATE ON public.fund_move_patients
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

-- ---------------------------------------------------------------------------------------------
-- 2. The move
-- ---------------------------------------------------------------------------------------------
/*
  apply_fund_move(practice, {
    reason, from_label,
    to: { provider_id, option (empty: each patient keeps their option) },
    patients: [{ patient_id, medical_aid_id, expected: { provider, plan_type, medical_aid_provider_id } }]
  }) -> { move_id, moved, skipped: [{ patient_id, why: 'not_found' | 'changed' | 'already' }], claims_moved }
  Practice administrators only; at most 2,000 patients at a time.
*/
CREATE OR REPLACE FUNCTION public.apply_fund_move(p_practice_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason   text := btrim(COALESCE(p_payload->>'reason', ''));
  v_from     text := left(regexp_replace(btrim(COALESCE(p_payload->>'from_label', '')), '[[:space:]]+', ' ', 'g'), 300);
  v_option   text := NULLIF(regexp_replace(btrim(COALESCE(p_payload->'to'->>'option', '')), '[[:space:]]+', ' ', 'g'), '');
  v_provider medical_aid_providers%ROWTYPE;
  v_item     jsonb;
  v_row      medical_aid_details%ROWTYPE;
  v_before   jsonb;
  v_after    jsonb;
  v_old_ref  text;
  v_rows     jsonb := '[]'::jsonb;
  v_skipped  jsonb := '[]'::jsonb;
  v_follow   uuid[] := '{}';
  v_invoice  record;
  v_claims   integer := 0;
  v_move_id  uuid := gen_random_uuid();
BEGIN
  PERFORM dc_assert_role(p_practice_id, ARRAY['admin'], 'move patients to another fund');
  IF char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Say why the patients move (it is kept on each patient''s file)' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'The reason is too long (at most 500 characters)' USING ERRCODE = '22023';
  END IF;
  IF v_option IS NOT NULL AND char_length(v_option) > 100 THEN
    RAISE EXCEPTION 'The option is too long (at most 100 characters)' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_provider FROM medical_aid_providers
   WHERE id = NULLIF(btrim(COALESCE(p_payload->'to'->>'provider_id', '')), '')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose the fund the patients move to' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_payload->'patients') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'patients') = 0 THEN
    RAISE EXCEPTION 'Choose the patients to move' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_payload->'patients') > 2000 THEN
    RAISE EXCEPTION 'Move at most 2,000 patients at a time' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'patients') LOOP
    SELECT m.* INTO v_row
      FROM medical_aid_details m JOIN patients p ON p.id = m.patient_id
     WHERE m.id = NULLIF(btrim(COALESCE(v_item->>'medical_aid_id', '')), '')::uuid
       AND m.patient_id = NULLIF(btrim(COALESCE(v_item->>'patient_id', '')), '')::uuid
       AND p.practice_id = p_practice_id AND p.merged_into_patient_id IS NULL
       FOR UPDATE OF m;
    IF NOT FOUND THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('patient_id', v_item->>'patient_id', 'why', 'not_found'));
      CONTINUE;
    END IF;
    -- Changed since the preview: left as it is now
    IF btrim(COALESCE(v_row.provider, '')) IS DISTINCT FROM btrim(COALESCE(v_item->'expected'->>'provider', ''))
       OR btrim(COALESCE(v_row.plan_type, '')) IS DISTINCT FROM btrim(COALESCE(v_item->'expected'->>'plan_type', ''))
       OR v_row.medical_aid_provider_id IS DISTINCT FROM NULLIF(btrim(COALESCE(v_item->'expected'->>'medical_aid_provider_id', '')), '')::uuid THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('patient_id', v_row.patient_id, 'why', 'changed'));
      CONTINUE;
    END IF;
    v_before := jsonb_build_object('provider', v_row.provider, 'scheme', v_row.scheme, 'plan_type', v_row.plan_type,
                                   'medical_aid_provider_id', v_row.medical_aid_provider_id);
    v_after := jsonb_build_object('provider', v_provider.name, 'scheme', COALESCE(v_option, v_row.scheme),
                                  'plan_type', COALESCE(v_option, v_row.plan_type), 'medical_aid_provider_id', v_provider.id);
    IF v_after = v_before THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('patient_id', v_row.patient_id, 'why', 'already'));
      CONTINUE;
    END IF;
    SELECT medical_aid_reference INTO v_old_ref FROM medical_aid_providers WHERE id = v_row.medical_aid_provider_id;
    -- The forms write the option to scheme and plan_type alike (MedicalAidForm, EditPatientForm)
    UPDATE medical_aid_details
       SET provider = v_provider.name, medical_aid_provider_id = v_provider.id,
           scheme = COALESCE(v_option, scheme), plan_type = COALESCE(v_option, plan_type), updated_at = now()
     WHERE id = v_row.id;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('patient_id', v_row.patient_id, 'medical_aid_id', v_row.id,
                                                             'before', v_before, 'after', v_after));
    IF v_old_ref IS DISTINCT FROM v_provider.medical_aid_reference THEN
      v_follow := v_follow || v_row.patient_id;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_rows) = 0 THEN
    RETURN jsonb_build_object('move_id', NULL, 'moved', 0, 'skipped', v_skipped, 'claims_moved', 0);
  END IF;

  -- Claims not sent yet follow a patient whose fund changed into the new fund's open batch; sent ones are never touched
  FOR v_invoice IN
    SELECT i.id FROM invoices_enhanced i JOIN batch_headers b ON b.id = i.batch_id
     WHERE i.patient_id = ANY (v_follow) AND i.practice_id = p_practice_id
       AND b.sent_at IS NULL AND lower(COALESCE(b.status, 'active')) IN ('active', 'open', 'draft', 'ready')
       AND b.medical_aid_reference IS DISTINCT FROM v_provider.medical_aid_reference
     ORDER BY i.created_at, i.id
  LOOP
    PERFORM claim_invoice_into_batch(v_invoice.id, NULL);
    v_claims := v_claims + 1;
  END LOOP;

  INSERT INTO fund_moves (id, practice_id, from_label, to_provider_id, to_provider, to_option, reason, patient_count, claims_moved, moved_by)
  VALUES (v_move_id, p_practice_id, COALESCE(NULLIF(v_from, ''), 'Patients chosen'), v_provider.id, v_provider.name, v_option, v_reason,
          jsonb_array_length(v_rows), v_claims, auth.uid());
  INSERT INTO fund_move_patients (move_id, practice_id, patient_id, medical_aid_id, before, after)
  SELECT v_move_id, p_practice_id, (r.item->>'patient_id')::uuid, (r.item->>'medical_aid_id')::uuid, r.item->'before', r.item->'after'
    FROM jsonb_array_elements(v_rows) AS r(item);

  RETURN jsonb_build_object('move_id', v_move_id, 'moved', jsonb_array_length(v_rows), 'skipped', v_skipped, 'claims_moved', v_claims);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Reading (staff of the practice), writing (apply_fund_move only)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.fund_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_move_patients ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['fund_moves', 'fund_move_patients'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_read', v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (practice_id = (SELECT public.rls_my_practice_id()))',
                   v_table || '_read', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_table);
    IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.apply_fund_move(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_fund_move(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
        FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('patients', 'medical_aid_details', 'medical_aid_providers', 'invoices_enhanced'))
     IS DISTINCT FROM current_setting('onehealth.fund_move_policies_before', true) THEN
    RAISE EXCEPTION 'Check failed: a policy of patients, medical_aid_details, medical_aid_providers or invoices_enhanced changed';
  END IF;
  IF has_function_privilege('anon', 'public.apply_fund_move(uuid,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.apply_fund_move(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: apply_fund_move is not for staff only';
  END IF;
  IF has_table_privilege('anon', 'public.fund_moves', 'SELECT') OR has_table_privilege('authenticated', 'public.fund_move_patients', 'INSERT') THEN
    RAISE EXCEPTION 'Check failed: the moves can be read by anon or written by the app';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

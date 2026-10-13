-- =============================================================================================
-- PROPOSAL, NOT APPLIED: cash-up per cashier with their own float; the administrator signs off the day
--                        (parity H11; owner decision of 13 Oct 2026)
-- File:   proposals/2026-10-13-cashier-cash-ups.sql      Drafted: 2026-10-13 (agent w11-finance)
-- Code:   src/services/ledger/cashierCashUp.ts (the same rules, tested), src/components/finance/controls/
--         cashierCashUpService.ts and CashierCashUps.tsx (Finance > Payments > Day end).
--
-- Why
--   The owner decided on 13 Oct 2026: each receptionist cashes up their own takings with their own float (counted
--   cash against the system's receipts, by method, float in and out); the administrator sees every cashier of the day
--   and signs the day off. Today there is one cash-up per practice per day (cash_ups, dc_record_cash_up), which any
--   staff member can close.
--
-- What it does
--   1. public.cashier_cash_ups: one row per count of a cashier's day: the float they started with and keep back, what
--      the receipts they captured say per method (cash includes the float, less the cash refunds they paid out) and
--      what they counted, a note (needed when anything is over or short). A recount by the same cashier replaces the
--      earlier one (kept, with a reason). Never deleted or edited otherwise.
--   2. RLS: staff of the practice read the practice's counts (the administrator sees all cashiers; the screen shows a
--      receptionist their own); nobody writes the table directly.
--   3. public.cashier_record_cash_up(practice, day, payload): the signed-in staff member records THEIR OWN count; the
--      expected figures are worked out here from their own receipts and refunds of the day, never taken from the
--      browser. A month already closed refuses it (dc_assert_open).
--   4. dc_record_cash_up (the day close): administrators only, as the sign-off of the day (live definition edited in
--      place: the change is found exactly once or nothing changes).
--   5. The patient app's logins get nothing (RESTRICTIVE portal_staff_only, once the portal is set up).
--
-- Before it is applied the app says "Cash-up per cashier is not set up yet" in Day end and keeps the day close as it
-- is (shown to administrators only).
--
-- How to apply: rehearse the part between BEGIN; and ROLLBACK; with simulated logins (a receptionist records their own
--   count, cannot record someone else's (there is no way to name another cashier), a recount without a reason is
--   refused; a receptionist cannot close the day (42501) and an administrator can; another practice and anon are
--   refused; a patient-app login reads nothing), then apply it as one migration (cashier_cash_ups_2026_10_13). It needs
--   proposals/2026-10-07-debtors-and-controls.sql and 2026-10-07-receipts-and-allocations.sql applied first.
-- Undo (only while no count was saved; counts are kept for good once saved): DROP FUNCTION
--   public.cashier_record_cash_up(uuid, date, jsonb); DROP TABLE public.cashier_cash_ups; and take the administrator
--   check out of dc_record_cash_up (the edit quoted in section 4).
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.receipts') IS NULL OR to_regclass('public.invoice_adjustments') IS NULL
     OR to_regprocedure('public.ar_amount(jsonb)') IS NULL OR to_regprocedure('public.ar_today()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-receipts-and-allocations.sql first';
  END IF;
  IF to_regclass('public.cash_ups') IS NULL OR to_regprocedure('public.dc_assert_member(uuid)') IS NULL
     OR to_regprocedure('public.dc_assert_role(uuid,text[],text)') IS NULL OR to_regprocedure('public.dc_assert_open(uuid,date,text)') IS NULL
     OR to_regprocedure('public.dc_history_guard()') IS NULL OR to_regprocedure('public.dc_no_truncate()') IS NULL
     OR to_regprocedure('public.dc_record_cash_up(uuid,date,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Stopped: apply proposals/2026-10-07-debtors-and-controls.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The counts
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cashier_cash_ups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  business_date    date NOT NULL,
  -- The staff member who took the money and counts it (auth user id; no foreign key, like receipts.created_by)
  cashier_id       uuid NOT NULL,
  float_in         numeric(14,2) NOT NULL CHECK (float_in >= 0),
  float_out        numeric(14,2) NOT NULL CHECK (float_out >= 0),
  -- What the cashier's own standing receipts said when they counted (cash: float in + cash receipts - cash refunds)
  expected_cash    numeric(14,2) NOT NULL,
  expected_card    numeric(14,2) NOT NULL,
  expected_eft     numeric(14,2) NOT NULL,
  counted_cash     numeric(14,2) NOT NULL CHECK (counted_cash >= 0),
  counted_card     numeric(14,2) NOT NULL CHECK (counted_card >= 0),
  counted_eft      numeric(14,2) NOT NULL CHECK (counted_eft >= 0),
  difference       numeric(14,2) GENERATED ALWAYS AS (
                     (counted_cash - expected_cash) + (counted_card - expected_card) + (counted_eft - expected_eft)) STORED,
  notes            text CHECK (notes IS NULL OR char_length(notes) <= 500),
  counted_at       timestamptz NOT NULL DEFAULT now(),
  superseded_at    timestamptz,
  superseded_by    uuid,
  supersede_reason text,
  CONSTRAINT cashier_cash_ups_float_kept CHECK (float_out <= counted_cash),
  CONSTRAINT cashier_cash_ups_difference_explained CHECK (
    (counted_cash = expected_cash AND counted_card = expected_card AND counted_eft = expected_eft)
    OR NULLIF(btrim(notes), '') IS NOT NULL),
  CONSTRAINT cashier_cash_ups_supersede_complete CHECK (
    (superseded_at IS NULL AND superseded_by IS NULL AND supersede_reason IS NULL)
    OR (superseded_at IS NOT NULL AND NULLIF(btrim(supersede_reason), '') IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS cashier_cash_ups_in_force
  ON public.cashier_cash_ups (practice_id, business_date, cashier_id) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS cashier_cash_ups_day ON public.cashier_cash_ups (practice_id, business_date);
COMMENT ON TABLE public.cashier_cash_ups IS
  'Cash-up per cashier (owner, 13 Oct 2026): each cashier''s own float and count against their own receipts. A recount replaces the earlier one (kept, with a reason).';

DROP TRIGGER IF EXISTS dc_20_history ON public.cashier_cash_ups;
CREATE TRIGGER dc_20_history BEFORE UPDATE OR DELETE ON public.cashier_cash_ups
  FOR EACH ROW EXECUTE FUNCTION public.dc_history_guard('superseded_at,superseded_by,supersede_reason', '');
DROP TRIGGER IF EXISTS dc_99_no_truncate ON public.cashier_cash_ups;
CREATE TRIGGER dc_99_no_truncate BEFORE TRUNCATE ON public.cashier_cash_ups
  FOR EACH STATEMENT EXECUTE FUNCTION public.dc_no_truncate();

-- ---------------------------------------------------------------------------------------------
-- 2. Reading: staff of the practice; writing: only through the function below
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.cashier_cash_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cashier_cash_ups_select ON public.cashier_cash_ups;
CREATE POLICY cashier_cash_ups_select ON public.cashier_cash_ups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.practice_id = cashier_cash_ups.practice_id));
REVOKE ALL ON public.cashier_cash_ups FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cashier_cash_ups TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Recording one's own count
-- ---------------------------------------------------------------------------------------------
/*
  cashier_record_cash_up(practice, day, { "float_in", "float_out", "counted_cash", "counted_card", "counted_eft",
                                          "notes"?, "replace_reason"? })
  Records the signed-in staff member's own count. Returns { id, expected_cash, expected_card, expected_eft, difference }.
*/
CREATE OR REPLACE FUNCTION public.cashier_record_cash_up(p_practice_id uuid, p_day date, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me        uuid := auth.uid();
  v_float_in  numeric(14,2) := ar_amount(p_payload->'float_in');
  v_float_out numeric(14,2) := ar_amount(p_payload->'float_out');
  v_cash      numeric(14,2) := ar_amount(p_payload->'counted_cash');
  v_card      numeric(14,2) := ar_amount(p_payload->'counted_card');
  v_eft       numeric(14,2) := ar_amount(p_payload->'counted_eft');
  v_notes     text := NULLIF(btrim(COALESCE(p_payload->>'notes', '')), '');
  v_reason    text := NULLIF(btrim(COALESCE(p_payload->>'replace_reason', '')), '');
  v_exp_cash  numeric(14,2);
  v_exp_card  numeric(14,2);
  v_exp_eft   numeric(14,2);
  v_current   cashier_cash_ups%ROWTYPE;
  v_row       cashier_cash_ups%ROWTYPE;
BEGIN
  PERFORM dc_assert_member(p_practice_id);
  IF p_day IS NULL OR p_day > ar_today() THEN
    RAISE EXCEPTION 'A day can be cashed up from that day on, not before';
  END IF;
  PERFORM dc_assert_open(p_practice_id, p_day, 'a cash-up');
  IF v_float_in IS NULL OR v_float_out IS NULL OR v_cash IS NULL OR v_card IS NULL OR v_eft IS NULL
     OR v_float_in < 0 OR v_float_out < 0 OR v_cash < 0 OR v_card < 0 OR v_eft < 0 THEN
    RAISE EXCEPTION 'Enter every amount (0 if none)';
  END IF;
  IF v_float_out > v_cash THEN
    RAISE EXCEPTION 'The float kept back (%) is more than the cash counted (%)', ar_format_nad(v_float_out), ar_format_nad(v_cash);
  END IF;
  -- What the cashier's own standing receipts and cash refunds of the day say (src/services/ledger/cashUp.ts cashierReport)
  SELECT v_float_in
         + COALESCE(SUM(r.amount) FILTER (WHERE r.method = 'cash'), 0)
         - COALESCE((SELECT SUM(a.amount) FROM invoice_adjustments a
                      WHERE a.practice_id = p_practice_id AND a.kind = 'refund' AND a.method = 'cash' AND a.effective_on = p_day
                        AND a.created_by = v_me AND a.reversed_at IS NULL), 0),
         COALESCE(SUM(r.amount) FILTER (WHERE r.method = 'card'), 0),
         COALESCE(SUM(r.amount) FILTER (WHERE r.method = 'eft'), 0)
    INTO v_exp_cash, v_exp_card, v_exp_eft
    FROM receipts r
   WHERE r.practice_id = p_practice_id AND r.received_on = p_day AND r.created_by = v_me AND r.reversed_at IS NULL;
  IF (v_cash <> v_exp_cash OR v_card <> v_exp_card OR v_eft <> v_exp_eft) AND v_notes IS NULL THEN
    RAISE EXCEPTION 'Your count is over or short of your receipts. Say why in the note.';
  END IF;
  SELECT * INTO v_current FROM cashier_cash_ups
   WHERE practice_id = p_practice_id AND business_date = p_day AND cashier_id = v_me AND superseded_at IS NULL FOR UPDATE;
  IF FOUND THEN
    IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
      RAISE EXCEPTION 'You already cashed up this day. Say why you count again.';
    END IF;
    UPDATE cashier_cash_ups SET superseded_at = now(), superseded_by = v_me, supersede_reason = v_reason WHERE id = v_current.id;
  END IF;
  INSERT INTO cashier_cash_ups (practice_id, business_date, cashier_id, float_in, float_out, expected_cash, expected_card, expected_eft,
                                counted_cash, counted_card, counted_eft, notes)
  VALUES (p_practice_id, p_day, v_me, v_float_in, v_float_out, v_exp_cash, v_exp_card, v_exp_eft, v_cash, v_card, v_eft, v_notes)
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('id', v_row.id, 'expected_cash', v_row.expected_cash, 'expected_card', v_row.expected_card,
                            'expected_eft', v_row.expected_eft, 'difference', v_row.difference);
END $$;
REVOKE ALL ON FUNCTION public.cashier_record_cash_up(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cashier_record_cash_up(uuid, date, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Closing (signing off) the day: administrators only
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION pg_temp.onehealth_edit_function(p_function regprocedure, p_edits text[]) RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  v_def text := pg_get_functiondef(p_function);
  v_i integer;
BEGIN
  FOR v_i IN 1 .. array_length(p_edits, 1) LOOP
    IF (length(v_def) - length(replace(v_def, p_edits[v_i][1], ''))) / length(p_edits[v_i][1]) <> 1 THEN
      RAISE EXCEPTION '%: change % was not found exactly once; nothing changed', p_function, v_i;
    END IF;
    v_def := replace(v_def, p_edits[v_i][1], p_edits[v_i][2]);
  END LOOP;
  EXECUTE v_def;
END $fn$;

SELECT pg_temp.onehealth_edit_function('public.dc_record_cash_up(uuid,date,jsonb)'::regprocedure, ARRAY[
  ARRAY[$o$  PERFORM dc_assert_member(p_practice_id);$o$, $n$  -- The administrator signs off the day once the cashiers have cashed up (owner, 13 Oct 2026)
  PERFORM dc_assert_role(p_practice_id, ARRAY['admin'], 'sign off the day');$n$]
]);

DROP FUNCTION pg_temp.onehealth_edit_function(regprocedure, text[]);

-- ---------------------------------------------------------------------------------------------
-- 5. The patient app's logins get nothing here, once the portal is set up
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    DROP POLICY IF EXISTS portal_staff_only ON public.cashier_cash_ups;
    CREATE POLICY portal_staff_only ON public.cashier_cash_ups AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.cashier_cash_ups'::regclass) THEN
    RAISE EXCEPTION 'Check failed: row level security is off on cashier_cash_ups';
  END IF;
  IF has_table_privilege('anon', 'public.cashier_cash_ups', 'SELECT')
     OR has_table_privilege('authenticated', 'public.cashier_cash_ups', 'INSERT')
     OR has_table_privilege('authenticated', 'public.cashier_cash_ups', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.cashier_cash_ups', 'DELETE') THEN
    RAISE EXCEPTION 'Check failed: cashier_cash_ups can be written directly or read by anon';
  END IF;
  IF has_function_privilege('anon', 'public.cashier_record_cash_up(uuid,date,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: anon can record a cash-up';
  END IF;
  IF position('sign off the day' in (SELECT prosrc FROM pg_proc WHERE oid = 'public.dc_record_cash_up(uuid,date,jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Check failed: the day close is not limited to administrators';
  END IF;
END $$;

ROLLBACK;

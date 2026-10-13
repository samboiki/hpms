-- Applied 2026-10-13 as migration dental_lab_work_2026_10_13 (version 20261012221801; stored statement md5 47325b821bb62b172fd151d4c912f607 = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked: no table, function or test supplier left): a practitioner
-- of a dental practice ordered a crown on 11 from a visit (numbered, first step recorded), changed it while it was at
-- the lab (the visit kept), moved it back from the lab, sent it back to be remade with a reason and the lab's new date,
-- back again and fitted (5 steps), entered the lab's invoice (2 lines, N$1,970.00, spaces tidied) and billed it at the
-- visit; a bridge on one tooth, an order without teeth or a jaw, tooth 19, another practice's supplier, a day in the
-- future and another patient's visit were refused (23514 / 22023); marking work at the lab fitted, a remake without a
-- reason, changing a fitted order, an amount in fractions of a cent, 31 invoice lines and an invoice on a cancelled
-- order were refused (22023); a direct insert was refused (42501). Reception saw both orders and the 2 lines, moved one
-- on, and could not order (42501); the practice administrator ordered. Staff of another practice saw 0 rows and could
-- not step, invoice or bill (42501); a login without a staff profile saw 0 and could not order; anon read and ran
-- nothing (42501). A practice that is not dental (its type set to general inside the rehearsal) could not order for
-- its own patient ("Lab orders are for dental practices"). 3 tables, 5 functions, 3 staff read policies and 3
-- portal_staff_only guards. The same behaviour checks ran again inside the migration (section 6b).
-- =============================================================================================
-- PROPOSAL: dental lab work - lab orders with their steps and a printable slip, the lab's invoice lines billed
--           under 8099 (the lab slip), and the practice's lab tracking (parity N5, D28, R36)
-- File:   proposals/2026-10-13-dental-lab-work.sql                       Drafted: 2026-10-13
-- Code:   src/utils/dental/labOrders.ts and labSlips.ts (steps, work types, the order and slip checks, due and
--         overdue, tracking by lab, each 8099 claim line paired with its slip; tested),
--         src/services/dental/labOrderService.ts (reads and writes; "not set up yet" before this file),
--         src/components/dental/Lab*.tsx (patient file > Teeth > Lab work, "Send to the lab" on a tooth, the printed
--         slip, the practice's lab tracking, the visit's Billing tab), src/utils/billing/claimFile.ts (the L records)
--         and src/components/finance/claims (the check before a batch is sent). Dental practices only
--         (isDentalPractice in src/utils/billing/tariffRules.ts).
--
-- Why
--   N5: a dental practice sends impressions to a laboratory for crowns, bridges, dentures and guards. OneHealth kept no
--   record of what went to which lab, for which teeth, in which shade, when it was due back or whether it was fitted,
--   and printed nothing for the lab.
--   D28: NAMAF rule 010 bills dental technician fees at cost under 8099, with the lab's invoice; the QEDI claim layout
--   carries the invoice's lines straight after the 8099 line (type of service L) and they must add up to it. A fund
--   refuses 8099 without them. The practice's 2023-2025 claims sent 27 laboratory codes as ordinary lines instead.
--   R36: the front desk needs one list of the work out at the labs: what is due or overdue, by lab.
--
-- What it does
--   1. dental_lab_orders: per patient, numbered per practice: the lab (one of the practice's stock suppliers), the
--      work (crown, bridge, denture ...), the teeth (FDI) and/or the jaw, the shade, notes for the lab, the day it went
--      and the day it is due back, the visit it was started at, its step (sent, received, fitted, remake, cancelled),
--      the lab's invoice (slip) number and the visit whose 8099 line bills it.
--   2. dental_lab_order_events: every step with who, when and, for a remake or a cancellation, why (insert only).
--   3. dental_lab_slip_lines: the lab's invoice lines of an order (its item code, what it is, the amount).
--   4. Functions (SECURITY DEFINER, search_path public) for active staff of the patient's practice, which must be a
--      dental practice: dental_lab_order_save (a new order, or a change while it is at the lab: practitioners, nurses
--      and practice admins), dental_lab_order_set_status (the next step), dental_lab_slip_save (the lab's invoice
--      lines) and dental_lab_order_bill (the visit that bills it under 8099): any staff member, as reception receives
--      the work and the invoice. dental_lab_practice_for is the internal check. Nothing is deleted: a mistaken order is
--      cancelled with why; the lab's lines are replaced as a whole (the order keeps who changed them last).
--   5. Row level security: staff of the practice read; nobody writes the tables directly; the patient app's logins get
--      nothing (portal_staff_only, as on every OneHealth table).
--   6. Checks (the behaviour checks run inside a block that undoes itself).
--   Nothing that exists changes: no policy, trigger or function of another file, no claim line. The app writes the L
--   records into the claim file from these tables (claimFile.labDetailFields), after the claim review's check.
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; followed by tests that end in RAISE EXCEPTION), then
-- apply that part as one migration. Needs receipts' ar_today() and the stock file's stock_suppliers. Until then the
-- Teeth tab says lab work is not set up yet and claim review leaves 8099 lines unchecked.
-- Undo: DROP FUNCTION public.dental_lab_order_bill(uuid, uuid), public.dental_lab_slip_save(uuid, jsonb),
--       public.dental_lab_order_set_status(uuid, text, text, date, date), public.dental_lab_order_save(jsonb),
--       public.dental_lab_practice_for(uuid, boolean);
--       DROP TABLE public.dental_lab_slip_lines, public.dental_lab_order_events, public.dental_lab_orders;
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.practices'), ('public.patients'), ('public.visits'), ('public.users'), ('public.stock_suppliers')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %. Apply the stock proposal first.', v_missing;
  END IF;
  IF to_regprocedure('public.ar_today()') IS NULL THEN
    RAISE EXCEPTION 'Stopped: ar_today() is missing; apply proposals/2026-10-07-receipts-and-allocations.sql first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. dental_lab_orders
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dental_lab_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  -- The visit the order was started at (where the impression was taken)
  visit_id         uuid,
  order_no         integer NOT NULL,
  status           text NOT NULL DEFAULT 'sent',
  status_on        date NOT NULL,
  sent_on          date NOT NULL,
  due_on           date,
  supplier_id      uuid,
  work_type        text NOT NULL,
  teeth            text[] NOT NULL DEFAULT '{}',
  jaw              text,
  shade            text,
  notes            text,
  -- The lab's invoice: its number here, its lines in dental_lab_slip_lines
  slip_number      text,
  -- The visit whose 8099 line bills the lab's invoice (the claim pairs them: src/utils/dental/labSlips.ts)
  billed_visit_id  uuid,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dental_lab_orders_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT dental_lab_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT dental_lab_orders_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT dental_lab_orders_billed_visit_id_fkey FOREIGN KEY (billed_visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT dental_lab_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.stock_suppliers(id) ON DELETE SET NULL,
  CONSTRAINT dental_lab_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT dental_lab_orders_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT dental_lab_orders_number_key UNIQUE (practice_id, order_no),
  CONSTRAINT dental_lab_orders_status_check CHECK (status IN ('sent', 'received', 'fitted', 'remake', 'cancelled')),
  CONSTRAINT dental_lab_orders_work_type_check CHECK (work_type IN ('crown', 'bridge', 'veneer', 'inlay_onlay', 'implant_crown',
    'full_denture', 'partial_denture', 'denture_repair', 'night_guard', 'orthodontic', 'other')),
  -- FDI tooth numbers (permanent 11-48, milk 51-85), at most 32 (the functions keep each once, in order)
  CONSTRAINT dental_lab_orders_teeth_check CHECK (
    cardinality(teeth) <= 32 AND array_position(teeth, NULL) IS NULL
    AND array_to_string(teeth, ',') ~ '^(([1-4][1-8]|[5-8][1-5])(,([1-4][1-8]|[5-8][1-5]))*)?$'),
  CONSTRAINT dental_lab_orders_jaw_check CHECK (jaw IS NULL OR jaw IN ('upper', 'lower', 'both')),
  -- The lab makes the work for teeth or a jaw; work made for teeth names them, a bridge at least two
  CONSTRAINT dental_lab_orders_where_check CHECK (cardinality(teeth) > 0 OR jaw IS NOT NULL),
  CONSTRAINT dental_lab_orders_tooth_work_check CHECK (cardinality(teeth) >= CASE
    WHEN work_type = 'bridge' THEN 2 WHEN work_type IN ('crown', 'veneer', 'inlay_onlay', 'implant_crown') THEN 1 ELSE 0 END),
  CONSTRAINT dental_lab_orders_dates_check CHECK (status_on >= sent_on AND (due_on IS NULL OR due_on >= sent_on)),
  CONSTRAINT dental_lab_orders_text_check CHECK (
    (shade IS NULL OR char_length(shade) BETWEEN 1 AND 20) AND (notes IS NULL OR char_length(notes) BETWEEN 1 AND 500)
    AND (slip_number IS NULL OR slip_number ~ '^[A-Za-z0-9][A-Za-z0-9/-]{0,14}$'))
);
COMMENT ON TABLE public.dental_lab_orders IS
  'Dental lab orders: work sent to a laboratory for a patient (teeth or jaw, shade, lab, dates), its steps in dental_lab_order_events and the lab''s invoice lines in dental_lab_slip_lines (billed under 8099). See proposals/2026-10-13-dental-lab-work.sql.';

CREATE INDEX IF NOT EXISTS dental_lab_orders_patient_idx ON public.dental_lab_orders (patient_id, sent_on);
CREATE INDEX IF NOT EXISTS dental_lab_orders_open_idx ON public.dental_lab_orders (practice_id, status);
CREATE INDEX IF NOT EXISTS dental_lab_orders_visit_idx ON public.dental_lab_orders (visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dental_lab_orders_billed_visit_idx ON public.dental_lab_orders (billed_visit_id) WHERE billed_visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dental_lab_orders_supplier_idx ON public.dental_lab_orders (supplier_id) WHERE supplier_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 2. dental_lab_order_events (insert only, through the functions)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dental_lab_order_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id     uuid NOT NULL,
  practice_id  uuid NOT NULL,
  patient_id   uuid NOT NULL,
  status       text NOT NULL,
  from_status  text,
  reason       text,
  happened_on  date NOT NULL,
  changed_by   uuid,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dental_lab_order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.dental_lab_orders(id) ON DELETE CASCADE,
  CONSTRAINT dental_lab_order_events_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT dental_lab_order_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT dental_lab_order_events_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT dental_lab_order_events_status_check CHECK (
    status IN ('sent', 'received', 'fitted', 'remake', 'cancelled') AND
    (from_status IS NULL OR from_status IN ('sent', 'received', 'fitted', 'remake', 'cancelled'))),
  CONSTRAINT dental_lab_order_events_reason_check CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 200)
);
COMMENT ON TABLE public.dental_lab_order_events IS
  'Every step of a dental lab order (who, when, and why for a remake or a cancellation). Insert only, through the dental_lab_ functions.';

CREATE INDEX IF NOT EXISTS dental_lab_order_events_order_idx ON public.dental_lab_order_events (order_id, changed_at);
CREATE INDEX IF NOT EXISTS dental_lab_order_events_patient_idx ON public.dental_lab_order_events (patient_id);

-- ---------------------------------------------------------------------------------------------
-- 3. dental_lab_slip_lines: the lab's invoice, line by line
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dental_lab_slip_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL,
  practice_id  uuid NOT NULL,
  line_no      smallint NOT NULL,
  -- The lab's item code (a dental technician code such as 9330), when its invoice gives one
  lab_code     text,
  description  text NOT NULL,
  amount       numeric(12,2) NOT NULL,
  CONSTRAINT dental_lab_slip_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.dental_lab_orders(id) ON DELETE CASCADE,
  CONSTRAINT dental_lab_slip_lines_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT dental_lab_slip_lines_line_key UNIQUE (order_id, line_no),
  CONSTRAINT dental_lab_slip_lines_line_no_check CHECK (line_no BETWEEN 1 AND 30),
  CONSTRAINT dental_lab_slip_lines_code_check CHECK (lab_code IS NULL OR lab_code ~ '^[0-9A-Z]{1,10}$'),
  CONSTRAINT dental_lab_slip_lines_description_check CHECK (char_length(btrim(description)) BETWEEN 1 AND 60),
  CONSTRAINT dental_lab_slip_lines_amount_check CHECK (amount > 0 AND amount <= 1000000)
);
COMMENT ON TABLE public.dental_lab_slip_lines IS
  'The lab''s invoice lines of a dental lab order: billed as one 8099 line, claimed as type L lines that add up to it. Written through dental_lab_slip_save.';

CREATE INDEX IF NOT EXISTS dental_lab_slip_lines_practice_idx ON public.dental_lab_slip_lines (practice_id);

-- ---------------------------------------------------------------------------------------------
-- 4. Functions
-- ---------------------------------------------------------------------------------------------

-- 4a. The patient's practice, when the signed-in user is active staff of it and it is a dental practice; raises
--     otherwise. p_clinical: ordering and changing an order need a practitioner, nurse or practice admin.
--     auth.uid() is NULL in the SQL editor and for the service role, so they cannot use these functions.
CREATE OR REPLACE FUNCTION public.dental_lab_practice_for(p_patient_id uuid, p_clinical boolean)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid;
  v_role text;
BEGIN
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = p_patient_id;
  SELECT u.role INTO v_role
    FROM public.users u
   WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND v_practice IS NOT NULL AND u.practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only staff of the patient''s practice can change this patient''s lab work' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.practices pr WHERE pr.id = v_practice AND lower(btrim(COALESCE(pr.practice_type, ''))) = 'dental') THEN
    RAISE EXCEPTION 'Lab orders are for dental practices' USING ERRCODE = '42501';
  END IF;
  IF p_clinical AND COALESCE(v_role, '') NOT IN ('doctor', 'nurse', 'admin') THEN
    RAISE EXCEPTION 'Only a practitioner, nurse or practice admin can order lab work or change an order' USING ERRCODE = '42501';
  END IF;
  RETURN v_practice;
END
$$;

-- 4b. dental_lab_order_save({id?, patient_id, visit_id?, work_type, teeth, jaw?, shade?, notes?, supplier_id?, sent_on?,
--     due_on?}): a new order (numbered per practice, at the lab from the day it went) or a change while it is at the
--     lab (the day it went stays as recorded). Returns {id, order_no, created}.
CREATE OR REPLACE FUNCTION public.dental_lab_order_save(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid := NULLIF(p_payload ->> 'id', '')::uuid;
  v_existing public.dental_lab_orders%ROWTYPE;
  v_patient uuid;
  v_practice uuid;
  v_work text := NULLIF(btrim(COALESCE(p_payload ->> 'work_type', '')), '');
  v_teeth text[] := ARRAY(SELECT DISTINCT btrim(t) FROM jsonb_array_elements_text(COALESCE(p_payload -> 'teeth', '[]'::jsonb)) AS t
                           WHERE btrim(t) <> '' ORDER BY 1);
  v_supplier uuid := NULLIF(p_payload ->> 'supplier_id', '')::uuid;
  v_visit uuid;
  v_today date := public.ar_today();
  v_sent date;
  v_no integer;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.dental_lab_orders WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lab order not found' USING ERRCODE = 'P0002';
    END IF;
    v_patient := v_existing.patient_id;
  ELSE
    v_patient := NULLIF(p_payload ->> 'patient_id', '')::uuid;
  END IF;
  v_practice := public.dental_lab_practice_for(v_patient, true);
  IF v_id IS NOT NULL AND v_existing.status <> 'sent' THEN
    RAISE EXCEPTION 'Order % is back from the lab or closed: its details can no longer change', v_existing.order_no USING ERRCODE = '22023';
  END IF;
  IF v_work IS NULL THEN
    RAISE EXCEPTION 'Choose the work the lab makes' USING ERRCODE = '22023';
  END IF;
  IF v_supplier IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.stock_suppliers s WHERE s.id = v_supplier AND s.practice_id = v_practice) THEN
    RAISE EXCEPTION 'Choose one of your practice''s suppliers as the lab' USING ERRCODE = '22023';
  END IF;
  -- The visit it was started at: kept on a change unless the payload names one
  v_visit := CASE WHEN v_id IS NOT NULL AND NOT (p_payload ? 'visit_id') THEN v_existing.visit_id ELSE NULLIF(p_payload ->> 'visit_id', '')::uuid END;
  IF v_visit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_visit AND v.patient_id = v_patient) THEN
    RAISE EXCEPTION 'The visit is not this patient''s' USING ERRCODE = '23514';
  END IF;

  IF v_id IS NULL THEN
    v_sent := COALESCE(NULLIF(p_payload ->> 'sent_on', '')::date, v_today);
    IF v_sent > v_today THEN
      RAISE EXCEPTION 'The day it went to the lab cannot be in the future' USING ERRCODE = '22023';
    END IF;
    -- One number after the other per practice, also when two people order at once
    PERFORM pg_advisory_xact_lock(hashtext('dental_lab_orders'), hashtext(v_practice::text));
    SELECT COALESCE(max(o.order_no), 0) + 1 INTO v_no FROM public.dental_lab_orders o WHERE o.practice_id = v_practice;
    INSERT INTO public.dental_lab_orders (
      practice_id, patient_id, visit_id, order_no, status, status_on, sent_on, due_on, supplier_id, work_type, teeth, jaw, shade,
      notes, created_by, updated_by
    ) VALUES (
      v_practice, v_patient, v_visit, v_no, 'sent', v_sent, v_sent, NULLIF(p_payload ->> 'due_on', '')::date, v_supplier, v_work, v_teeth,
      NULLIF(p_payload ->> 'jaw', ''), NULLIF(btrim(COALESCE(p_payload ->> 'shade', '')), ''), NULLIF(btrim(COALESCE(p_payload ->> 'notes', '')), ''),
      auth.uid(), auth.uid()
    )
    RETURNING id INTO v_id;
    INSERT INTO public.dental_lab_order_events (order_id, practice_id, patient_id, status, happened_on, changed_by)
    VALUES (v_id, v_practice, v_patient, 'sent', v_sent, auth.uid());
    RETURN jsonb_build_object('id', v_id, 'order_no', v_no, 'created', true);
  END IF;

  UPDATE public.dental_lab_orders
     SET visit_id = v_visit, due_on = NULLIF(p_payload ->> 'due_on', '')::date, supplier_id = v_supplier, work_type = v_work,
         teeth = v_teeth, jaw = NULLIF(p_payload ->> 'jaw', ''), shade = NULLIF(btrim(COALESCE(p_payload ->> 'shade', '')), ''),
         notes = NULLIF(btrim(COALESCE(p_payload ->> 'notes', '')), ''), updated_by = auth.uid(), updated_at = now()
   WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'order_no', v_existing.order_no, 'created', false);
END
$$;

-- 4c. dental_lab_order_set_status(order, status, reason?, on?, due_on?): the next step, dated today or the day it
--     happened (not before the last step). The steps are NEXT_DENTAL_LAB_STATUSES in src/utils/dental/labOrders.ts; a
--     remake or a cancellation says why, and work sent back to be remade may get the lab's new date.
CREATE OR REPLACE FUNCTION public.dental_lab_order_set_status(
  p_order_id uuid, p_status text, p_reason text DEFAULT NULL, p_on date DEFAULT NULL, p_due_on date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.dental_lab_orders%ROWTYPE;
  v_today date := public.ar_today();
  v_on date := COALESCE(p_on, public.ar_today());
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_allowed boolean;
BEGIN
  SELECT * INTO v_order FROM public.dental_lab_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lab order not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.dental_lab_practice_for(v_order.patient_id, false);
  v_allowed := CASE v_order.status
    WHEN 'sent' THEN p_status IN ('received', 'cancelled')
    WHEN 'received' THEN p_status IN ('fitted', 'remake')
    WHEN 'fitted' THEN p_status = 'remake'
    WHEN 'remake' THEN p_status IN ('received', 'cancelled')
    ELSE false
  END;
  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'Order % is % and cannot be marked % now', v_order.order_no,
      CASE v_order.status WHEN 'sent' THEN 'at the lab' WHEN 'received' THEN 'back from the lab' WHEN 'remake' THEN 'being remade' ELSE v_order.status END,
      CASE p_status WHEN 'received' THEN 'back from the lab' WHEN 'remake' THEN 'to be remade' ELSE COALESCE(p_status, '') END
      USING ERRCODE = '22023';
  END IF;
  IF p_status IN ('remake', 'cancelled') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Say why the order is %', CASE p_status WHEN 'remake' THEN 'sent back to be remade' ELSE 'cancelled' END USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_reason, '')) > 200 THEN
    RAISE EXCEPTION 'Keep the reason to 200 characters' USING ERRCODE = '22023';
  END IF;
  IF v_on > v_today OR v_on < v_order.status_on THEN
    RAISE EXCEPTION 'Choose a day from % (the last step) to today', to_char(v_order.status_on, 'FMDD Mon YYYY') USING ERRCODE = '22023';
  END IF;
  IF p_due_on IS NOT NULL AND (p_status <> 'remake' OR p_due_on < v_on) THEN
    RAISE EXCEPTION 'A new due date goes with work sent back to be remade, from the day it went back' USING ERRCODE = '22023';
  END IF;

  UPDATE public.dental_lab_orders
     SET status = p_status, status_on = v_on, due_on = COALESCE(p_due_on, due_on), updated_by = auth.uid(), updated_at = now()
   WHERE id = p_order_id;
  INSERT INTO public.dental_lab_order_events (order_id, practice_id, patient_id, status, from_status, reason, happened_on, changed_by)
  VALUES (p_order_id, v_order.practice_id, v_order.patient_id, p_status, v_order.status, v_reason, v_on, auth.uid());
  RETURN jsonb_build_object('status', p_status, 'status_on', v_on);
END
$$;

-- 4d. dental_lab_slip_save(order, {slip_number?, lines: [{code?, description, amount}]}): the lab's invoice for the
--     order, replacing what was there (no lines: none). Not for a cancelled order. Returns {lines, total}.
CREATE OR REPLACE FUNCTION public.dental_lab_slip_save(p_order_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.dental_lab_orders%ROWTYPE;
  v_lines jsonb := COALESCE(p_payload -> 'lines', '[]'::jsonb);
  v_count integer;
  v_total numeric;
BEGIN
  SELECT * INTO v_order FROM public.dental_lab_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lab order not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.dental_lab_practice_for(v_order.patient_id, false);
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order % is cancelled: it has no lab invoice', v_order.order_no USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_array_length(v_lines) > 30 THEN
    RAISE EXCEPTION 'At most 30 lines from the lab''s invoice' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) AS e(value) WHERE COALESCE(e.value ->> 'amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$') THEN
    RAISE EXCEPTION 'Each amount in N$ and cents, for example 1850.00' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.dental_lab_slip_lines WHERE order_id = p_order_id;
  INSERT INTO public.dental_lab_slip_lines (order_id, practice_id, line_no, lab_code, description, amount)
  SELECT p_order_id, v_order.practice_id, e.ordinality::smallint, NULLIF(upper(btrim(COALESCE(e.value ->> 'code', ''))), ''),
         regexp_replace(btrim(COALESCE(e.value ->> 'description', '')), '\s+', ' ', 'g'), (e.value ->> 'amount')::numeric
    FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS e(value, ordinality);
  UPDATE public.dental_lab_orders
     SET slip_number = NULLIF(btrim(COALESCE(p_payload ->> 'slip_number', '')), ''), updated_by = auth.uid(), updated_at = now()
   WHERE id = p_order_id;
  SELECT count(*), COALESCE(sum(l.amount), 0) INTO v_count, v_total FROM public.dental_lab_slip_lines l WHERE l.order_id = p_order_id;
  RETURN jsonb_build_object('lines', v_count, 'total', v_total);
END
$$;

-- 4e. dental_lab_order_bill(order, visit): the visit whose 8099 line bills the lab's invoice; NULL: billed nowhere.
CREATE OR REPLACE FUNCTION public.dental_lab_order_bill(p_order_id uuid, p_visit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.dental_lab_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.dental_lab_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lab order not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.dental_lab_practice_for(v_order.patient_id, false);
  IF p_visit_id IS NOT NULL AND v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order % is cancelled: it is not billed', v_order.order_no USING ERRCODE = '22023';
  END IF;
  IF p_visit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = p_visit_id AND v.patient_id = v_order.patient_id) THEN
    RAISE EXCEPTION 'The visit is not this patient''s' USING ERRCODE = '23514';
  END IF;
  UPDATE public.dental_lab_orders SET billed_visit_id = p_visit_id, updated_by = auth.uid(), updated_at = now() WHERE id = p_order_id;
  RETURN jsonb_build_object('billed_visit_id', p_visit_id);
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Row level security and grants: active staff of the practice read; nobody writes except through the functions
--    above (and the service role); the patient app's logins get nothing
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.dental_lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_lab_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_lab_slip_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dental_lab_orders_staff_read ON public.dental_lab_orders;
CREATE POLICY dental_lab_orders_staff_read ON public.dental_lab_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = dental_lab_orders.practice_id));

DROP POLICY IF EXISTS dental_lab_order_events_staff_read ON public.dental_lab_order_events;
CREATE POLICY dental_lab_order_events_staff_read ON public.dental_lab_order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = dental_lab_order_events.practice_id));

DROP POLICY IF EXISTS dental_lab_slip_lines_staff_read ON public.dental_lab_slip_lines;
CREATE POLICY dental_lab_slip_lines_staff_read ON public.dental_lab_slip_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = dental_lab_slip_lines.practice_id));

REVOKE ALL ON public.dental_lab_orders, public.dental_lab_order_events, public.dental_lab_slip_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dental_lab_orders, public.dental_lab_order_events, public.dental_lab_slip_lines TO authenticated;
GRANT ALL ON public.dental_lab_orders, public.dental_lab_order_events, public.dental_lab_slip_lines TO service_role;
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', pg_get_serial_sequence('public.dental_lab_order_events', 'id'));
END
$$;

-- Internal: the membership check
REVOKE ALL ON FUNCTION public.dental_lab_practice_for(uuid, boolean) FROM PUBLIC, anon, authenticated;
-- What the app calls
REVOKE ALL ON FUNCTION public.dental_lab_order_save(jsonb), public.dental_lab_order_set_status(uuid, text, text, date, date),
  public.dental_lab_slip_save(uuid, jsonb), public.dental_lab_order_bill(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dental_lab_order_save(jsonb), public.dental_lab_order_set_status(uuid, text, text, date, date),
  public.dental_lab_slip_save(uuid, jsonb), public.dental_lab_order_bill(uuid, uuid) TO authenticated, service_role;

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['dental_lab_orders', 'dental_lab_order_events', 'dental_lab_slip_lines'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks
-- ---------------------------------------------------------------------------------------------

-- 6a. Row level security is on, one staff read policy per table (and the portal's guard), none for anon; signed-in users
--     read but do not write; anon runs nothing; the membership check is internal
DO $$
DECLARE
  t text;
  v_count integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['dental_lab_orders', 'dental_lab_order_events', 'dental_lab_slip_lines'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', t)::regclass) THEN
      RAISE EXCEPTION '%: row level security is off', t;
    END IF;
    SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_staff_read';
    IF v_count <> 1 THEN
      RAISE EXCEPTION '%: expected 1 staff read policy, found %', t, v_count;
    END IF;
    IF to_regprocedure('public.portal_is_staff()') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'portal_staff_only' AND permissive = 'RESTRICTIVE') THEN
      RAISE EXCEPTION '%: the patient app''s staff-only guard is missing', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND 'anon' = ANY (roles)) THEN
      RAISE EXCEPTION '%: a policy is open to anon', t;
    END IF;
    IF NOT has_table_privilege('authenticated', format('public.%I', t), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', t), 'DELETE')
       OR has_table_privilege('anon', format('public.%I', t), 'SELECT') THEN
      RAISE EXCEPTION '%: signed-in users must read only, anon nothing', t;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.dental_lab_order_save(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.dental_lab_order_set_status(uuid, text, text, date, date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.dental_lab_slip_save(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.dental_lab_order_bill(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.dental_lab_practice_for(uuid, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'dental lab functions: anon may not run them, and the membership check is internal';
  END IF;
END $$;

-- 6b. Behaviour, as signed-in users of one dental practice with a patient and a visit (a practitioner, reception and
--     an administrator when there are), a staff member of another practice, a login without a staff profile and the anon
--     key. Runs inside a block that undoes itself: nothing is left behind, also when this file ends in COMMIT.
DO $$
DECLARE
  v_practice uuid;
  v_clinician uuid;
  v_receptionist uuid;
  v_admin uuid;
  v_other uuid;
  v_other_practice uuid;
  v_patient uuid;
  v_visit uuid;
  v_foreign_visit uuid;
  v_supplier uuid;
  v_other_supplier uuid;
  v_result jsonb;
  v_order uuid;
  v_order2 uuid;
  v_count integer;
  v_text text;
  v_today date := public.ar_today();
  v_summary text;
BEGIN
  SELECT u.practice_id, u.id INTO v_practice, v_clinician
    FROM public.users u JOIN public.practices pr ON pr.id = u.practice_id
   WHERE COALESCE(u.is_active, true) AND u.role = 'doctor' AND lower(btrim(COALESCE(pr.practice_type, ''))) = 'dental'
     AND EXISTS (SELECT 1 FROM public.visits v JOIN public.patients p ON p.id = v.patient_id WHERE p.practice_id = u.practice_id)
   ORDER BY u.id
   LIMIT 1;
  SELECT v.patient_id, v.id INTO v_patient, v_visit
    FROM public.visits v JOIN public.patients p ON p.id = v.patient_id
   WHERE p.practice_id = v_practice
   ORDER BY v.id
   LIMIT 1;
  SELECT v.id INTO v_foreign_visit
    FROM public.visits v JOIN public.patients p ON p.id = v.patient_id
   WHERE p.practice_id = v_practice AND v.patient_id <> v_patient
   ORDER BY v.id
   LIMIT 1;
  SELECT u.id INTO v_receptionist FROM public.users u
   WHERE COALESCE(u.is_active, true) AND u.role = 'receptionist' AND u.practice_id = v_practice ORDER BY u.id LIMIT 1;
  SELECT u.id INTO v_admin FROM public.users u
   WHERE COALESCE(u.is_active, true) AND u.role = 'admin' AND u.practice_id = v_practice ORDER BY u.id LIMIT 1;
  SELECT u.id, u.practice_id INTO v_other, v_other_practice FROM public.users u
   WHERE COALESCE(u.is_active, true) AND u.practice_id IS NOT NULL AND u.practice_id <> v_practice ORDER BY u.id LIMIT 1;
  IF v_visit IS NULL OR v_other IS NULL THEN
    RAISE NOTICE 'No dental practice with a practitioner, a visit and staff elsewhere: behaviour checks skipped';
    RETURN;
  END IF;

  BEGIN
    -- A lab (a supplier) of the practice, and one of another practice
    INSERT INTO public.stock_suppliers (practice_id, name) VALUES (v_practice, 'Check dental lab ' || left(md5(random()::text), 6))
      RETURNING id INTO v_supplier;
    INSERT INTO public.stock_suppliers (practice_id, name) VALUES (v_other_practice, 'Check other lab ' || left(md5(random()::text), 6))
      RETURNING id INTO v_other_supplier;

    -- The practitioner orders a crown on 11 from the visit
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_clinician, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    v_result := public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'visit_id', v_visit, 'work_type', 'crown',
      'teeth', jsonb_build_array('11'), 'shade', 'A2', 'notes', 'Check order', 'supplier_id', v_supplier, 'due_on', (v_today + 7)::text));
    v_order := (v_result ->> 'id')::uuid;
    IF (v_result ->> 'order_no')::integer IS NULL OR (SELECT count(*) FROM public.dental_lab_order_events WHERE order_id = v_order) <> 1
       OR (SELECT status FROM public.dental_lab_orders WHERE id = v_order) <> 'sent' THEN
      RAISE EXCEPTION 'check failed: the order, its number or its first step is missing';
    END IF;

    -- Direct writes are refused: everything goes through the functions
    BEGIN
      INSERT INTO public.dental_lab_orders (practice_id, patient_id, order_no, status_on, sent_on, work_type, teeth)
      VALUES (v_practice, v_patient, 999999, v_today, v_today, 'crown', ARRAY['11']);
      RAISE EXCEPTION 'check failed: a direct insert was accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- What the lab needs: a bridge spans two teeth, every order names teeth or a jaw, the lab is the practice's own,
    -- the visit is the patient's, the day it went is not in the future
    BEGIN
      PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'bridge', 'teeth', jsonb_build_array('14')));
      RAISE EXCEPTION 'check failed: a bridge on one tooth was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'partial_denture'));
      RAISE EXCEPTION 'check failed: an order without teeth or a jaw was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'crown', 'teeth', jsonb_build_array('19')));
      RAISE EXCEPTION 'check failed: tooth 19 was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'full_denture', 'jaw', 'upper',
        'supplier_id', v_other_supplier));
      RAISE EXCEPTION 'check failed: another practice''s supplier was accepted as the lab';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'full_denture', 'jaw', 'upper',
        'sent_on', (v_today + 1)::text));
      RAISE EXCEPTION 'check failed: a day in the future was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    IF v_foreign_visit IS NOT NULL THEN
      BEGIN
        PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'night_guard', 'jaw', 'upper',
          'visit_id', v_foreign_visit));
        RAISE EXCEPTION 'check failed: another patient''s visit was accepted';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
    END IF;

    -- A change while it is at the lab; the steps; no change once it is back
    PERFORM public.dental_lab_order_save(jsonb_build_object('id', v_order, 'work_type', 'crown', 'teeth', jsonb_build_array('11'),
      'shade', 'A3', 'supplier_id', v_supplier, 'due_on', (v_today + 7)::text));
    IF (SELECT shade || '|' || COALESCE(visit_id::text, '') FROM public.dental_lab_orders WHERE id = v_order) IS DISTINCT FROM ('A3|' || v_visit::text) THEN
      RAISE EXCEPTION 'check failed: the change was not saved, or it lost the visit the order was started at';
    END IF;
    BEGIN
      PERFORM public.dental_lab_order_set_status(v_order, 'fitted');
      RAISE EXCEPTION 'check failed: work still at the lab was marked fitted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    PERFORM public.dental_lab_order_set_status(v_order, 'received');
    BEGIN
      PERFORM public.dental_lab_order_set_status(v_order, 'remake', ' ');
      RAISE EXCEPTION 'check failed: a remake without a reason was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    PERFORM public.dental_lab_order_set_status(v_order, 'remake', 'Margin open on the distal', NULL, v_today + 5);
    IF (SELECT due_on FROM public.dental_lab_orders WHERE id = v_order) IS DISTINCT FROM v_today + 5 THEN
      RAISE EXCEPTION 'check failed: the remake did not take the lab''s new date';
    END IF;
    PERFORM public.dental_lab_order_set_status(v_order, 'received');
    PERFORM public.dental_lab_order_set_status(v_order, 'fitted');
    IF (SELECT count(*) FROM public.dental_lab_order_events WHERE order_id = v_order) <> 5
       OR (SELECT status FROM public.dental_lab_orders WHERE id = v_order) <> 'fitted' THEN
      RAISE EXCEPTION 'check failed: the order''s steps were not all recorded';
    END IF;
    BEGIN
      PERFORM public.dental_lab_order_save(jsonb_build_object('id', v_order, 'work_type', 'crown', 'teeth', jsonb_build_array('12')));
      RAISE EXCEPTION 'check failed: a fitted order was changed';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    -- The lab's invoice: two lines adding up to 1970.00; an amount in fractions of a cent and 31 lines are refused
    v_result := public.dental_lab_slip_save(v_order, jsonb_build_object('slip_number', 'LS-4471', 'lines', jsonb_build_array(
      jsonb_build_object('code', '9330', 'description', 'Porcelain fused to metal crown', 'amount', 1850),
      jsonb_build_object('description', '  Model   and die ', 'amount', '120.00'))));
    IF (v_result ->> 'lines')::integer <> 2 OR (v_result ->> 'total')::numeric <> 1970
       OR (SELECT description FROM public.dental_lab_slip_lines WHERE order_id = v_order AND line_no = 2) <> 'Model and die'
       OR (SELECT slip_number FROM public.dental_lab_orders WHERE id = v_order) <> 'LS-4471' THEN
      RAISE EXCEPTION 'check failed: the lab''s invoice lines were not saved as given';
    END IF;
    BEGIN
      PERFORM public.dental_lab_slip_save(v_order, jsonb_build_object('lines', jsonb_build_array(
        jsonb_build_object('description', 'Model', 'amount', 12.345))));
      RAISE EXCEPTION 'check failed: an amount in fractions of a cent was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_lab_slip_save(v_order, jsonb_build_object('lines',
        (SELECT jsonb_agg(jsonb_build_object('description', 'Line ' || n, 'amount', 1)) FROM generate_series(1, 31) n)));
      RAISE EXCEPTION 'check failed: 31 lines were accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    -- Billed at the visit (its 8099 line carries the lab's lines); never at another patient's visit
    PERFORM public.dental_lab_order_bill(v_order, v_visit);
    IF (SELECT billed_visit_id FROM public.dental_lab_orders WHERE id = v_order) IS DISTINCT FROM v_visit THEN
      RAISE EXCEPTION 'check failed: the order is not billed at the visit';
    END IF;
    IF v_foreign_visit IS NOT NULL THEN
      BEGIN
        PERFORM public.dental_lab_order_bill(v_order, v_foreign_visit);
        RAISE EXCEPTION 'check failed: the order was billed at another patient''s visit';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
    END IF;

    -- A second order (a full upper denture), cancelled with its reason; a cancelled order takes no invoice
    v_order2 := (public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'full_denture', 'jaw', 'upper',
      'supplier_id', v_supplier)) ->> 'id')::uuid;

    -- Reception sees the work and moves it on, but does not order it
    IF v_receptionist IS NOT NULL THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_receptionist, 'role', 'authenticated')::text, true);
      IF (SELECT count(*) FROM public.dental_lab_orders WHERE patient_id = v_patient) <> 2
         OR (SELECT count(*) FROM public.dental_lab_slip_lines WHERE order_id = v_order) <> 2 THEN
        RAISE EXCEPTION 'check failed: reception does not see the patient''s lab work';
      END IF;
      PERFORM public.dental_lab_order_set_status(v_order2, 'received');
      BEGIN
        PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'night_guard', 'jaw', 'lower'));
        RAISE EXCEPTION 'check failed: reception ordered lab work';
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_clinician, 'role', 'authenticated')::text, true);
      PERFORM public.dental_lab_order_set_status(v_order2, 'remake', 'Bite too high');
    END IF;
    PERFORM public.dental_lab_order_set_status(v_order2, 'cancelled', 'Patient chose another option');
    BEGIN
      PERFORM public.dental_lab_slip_save(v_order2, jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('description', 'x', 'amount', 1))));
      RAISE EXCEPTION 'check failed: a cancelled order took the lab''s invoice';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    -- A practice administrator orders too
    IF v_admin IS NOT NULL THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'night_guard', 'jaw', 'both'));
    END IF;

    -- Staff of another practice see nothing and change nothing
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
    SELECT (SELECT count(*) FROM public.dental_lab_orders WHERE patient_id = v_patient)
         + (SELECT count(*) FROM public.dental_lab_order_events WHERE patient_id = v_patient)
         + (SELECT count(*) FROM public.dental_lab_slip_lines WHERE order_id = v_order) INTO v_count;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'check failed: staff of another practice see % lab rows', v_count;
    END IF;
    BEGIN
      PERFORM public.dental_lab_order_set_status(v_order, 'remake', 'Check');
      RAISE EXCEPTION 'check failed: staff of another practice changed an order';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_lab_slip_save(v_order, jsonb_build_object('lines', '[]'::jsonb));
      RAISE EXCEPTION 'check failed: staff of another practice changed the lab''s invoice';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_lab_order_bill(v_order, NULL);
      RAISE EXCEPTION 'check failed: staff of another practice changed where an order is billed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- A login without a staff profile (a patient-app login) sees nothing and orders nothing
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    IF (SELECT count(*) FROM public.dental_lab_orders) <> 0 OR (SELECT count(*) FROM public.dental_lab_slip_lines) <> 0 THEN
      RAISE EXCEPTION 'check failed: a login without a staff profile sees lab rows';
    END IF;
    BEGIN
      PERFORM public.dental_lab_order_save(jsonb_build_object('patient_id', v_patient, 'work_type', 'night_guard', 'jaw', 'upper'));
      RAISE EXCEPTION 'check failed: a login without a staff profile ordered lab work';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- The anon key reads nothing and runs nothing
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    PERFORM set_config('role', 'anon', true);
    BEGIN
      PERFORM count(*) FROM public.dental_lab_orders;
      RAISE EXCEPTION 'check failed: anon read lab orders';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_lab_order_set_status(v_order, 'remake', 'Check');
      RAISE EXCEPTION 'check failed: anon ran a dental lab function';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    v_summary := format('practitioner ordered and stepped order (5 steps), invoice 2 lines 1970.00, billed at the visit; reception %s; administrator %s; other practice, no-profile login and anon refused',
      CASE WHEN v_receptionist IS NULL THEN 'none in this practice' ELSE 'saw 2 orders, moved one on, could not order' END,
      CASE WHEN v_admin IS NULL THEN 'none in this practice' ELSE 'ordered' END);
    RAISE EXCEPTION USING MESSAGE = 'dental_lab_checks_passed: ' || v_summary;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'dental_lab_checks_passed:%' THEN
      RAISE;
    END IF;
    v_text := SQLERRM;
  END;

  -- Kept for the rehearsal's report (execute_sql drops notices); the test rows above are undone
  PERFORM set_config('onehealth.dental_lab_checks', v_text, true);
  RAISE NOTICE '%', v_text;
END $$;

ROLLBACK;

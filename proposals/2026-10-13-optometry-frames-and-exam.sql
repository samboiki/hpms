-- Applied 2026-10-13 as migration optometry_frames_and_exam_2026_10_13 (version 20261013013711; stored statement md5 c924abd9dc7697f053515ba2601afb4c = md5 of the part between BEGIN; and ROLLBACK;)
-- Rehearsed with simulated logins (rolled back, then checked: no frame table, trigger or check supplier left, optometry_save_exam
-- as before): a practice admin saved a full exam (history, keratometry, ocular health, cup-to-disc) and an older screen's save
-- kept it; a flat reading above the steep one was refused (23514). A frame added with 2 on the shelf got FR000001 and FR000002;
-- 2 more were received with their own barcodes (delivery, payable, ledger 4); a barcode already in use (other case) was
-- refused (23505). A lab order reserved a frame for the patient; a sale on an invoice line sold that frame (salesperson = who
-- reserved it), the line taken off put it back to the order, cancelling the order put it on the shelf. Job costs kept. Put
-- aside, lost (ledger 3) and found (ledger 4); 2 frames back to the supplier on one return (ledger 2). A consignment frame:
-- received with no value and no payable, a costed delivery of it refused, a sale owed N$ 400 plus VAT, the salesperson
-- changed, the supplier's invoice settled as a payable, and it could not become the practice's own. Reception put a frame
-- aside but could not write one off (42501); a direct insert was refused (42501); staff of another practice saw 0 rows and
-- could not change a frame (42501); anon read and ran nothing (42501). 4 tables, 18 functions, 2 triggers, 3 staff read
-- policies, 4 portal_staff_only guards; optometry_exams 48 columns, optometry_frames 11, optometry_lab_orders 35. The same
-- behaviour checks ran again inside the migration (section 9b).
-- =============================================================================================
-- PROPOSAL: optometry - the full eye exam, one barcode per frame with its status and history,
-- consignment frames with what is owed to the supplier, and job costs on lab orders
-- File:    proposals/2026-10-13-optometry-frames-and-exam.sql                  Drafted: 2026-10-13
-- Code:    src/utils/optometry/examParts.ts (case history, keratometry, ocular health, the contact-lens fit),
--          frameUnits.ts (barcodes, statuses, history, receiving and returning frames), consignment.ts,
--          jobCosting.ts, frameReports.ts (all unit tested); src/services/optometry/*; src/components/optometry/*
--          (the visit's Eye exam, Frames, the reports, the Optometry page). Optometry practices only
--          (isOptometryPractice in src/utils/billing/tariffRules.ts).
-- Parity:  Eminance rows M2 (structured exam and contact-lens fitting), M7 (frame stock with barcodes, statuses and
--          audit), M12 (job costing), R34 (frame reports read these tables) and L11 (consignment stock).
--
-- Why
--   M2: the eye exam kept vision, refraction, pressure and fields only. An optometrist's exam starts with the case
--   history and also records keratometry (the cornea's curvature, which decides a contact lens), the health of the
--   front and back of the eye (with the cup-to-disc ratio followed for glaucoma) and how a contact lens fits.
--   M7: a frame was a stock item with a count, so nobody could say which frame was on the wall, which was put aside
--   for a patient, which was sold or sent back. Eminance labels every frame with its own barcode and keeps its status
--   with who changed it and when.
--   L11: optical suppliers leave frames on consignment: the practice sells them but owns them only once sold, and then
--   owes the supplier the agreed cost. OneHealth could not hold stock it does not own.
--   M12: the owner wants each pair of spectacles costed (frame, lenses from the lab, labour) against its price.
--
-- What it does
--   1. optometry_exams: nullable columns for the case history, keratometry, ocular health and the contact-lens fit,
--      with checks; optometry_save_exam replaced: the same as before plus these columns, each written only when the
--      app sends it (an older screen saving an exam never clears them).
--   2. optometry_frame_units (one row per physical frame: its barcode, status, the patient it is reserved for or sold
--      to, the invoice, the salesperson, the delivery it came with or went back on), optometry_frame_unit_events (every
--      change: who, when, why) and optometry_frame_counters (the practice's own barcode numbers, FR000001 ...).
--   3. optometry_frames: consignment, the supplier who owns the frames and what is owed per frame sold;
--      optometry_consignment_lines: what is owed (or no longer owed) for each consignment frame sold, taken back,
--      lost or found, until it is settled with the supplier's invoice.
--   4. A trigger on stock_movements keeps the barcodes in step with the stock ledger, whatever screen moved the stock:
--      frames received get barcodes, a sale marks the frame reserved for that patient (else the oldest) sold, a line
--      taken off an invoice brings it back, returns and write-offs mark theirs. It also records what is owed for a
--      consignment frame. A barcode problem never stops a sale or a delivery (a warning is logged, and the Frames
--      list shows the difference with a button that puts it right); a consignment amount is never skipped.
--   5. A trigger on optometry_lab_orders reserves a frame of the order's model for the patient (or links the one
--      already sold to them) and puts it back when the order is cancelled or its frame changes. Lab orders get the
--      lab's charge for the lenses, the labour and the lab's invoice number (optometry_lab_order_costs).
--   6. Functions the app calls (SECURITY DEFINER, search_path public, staff of the practice): optometry_frames_receive
--      (a delivery of frames with their barcodes, through stock_receive), optometry_frame_units_add (barcodes for
--      frames already on the shelf), optometry_frame_unit_act (put aside, back on the shelf, lost or damaged, found,
--      change the salesperson), optometry_frame_units_return (frames back to the supplier, through
--      stock_return_to_supplier), optometry_consignment_settle (the supplier's invoice becomes the payable, as a
--      delivery's does), optometry_lab_order_costs; optometry_save_frame replaced (consignment).
--   7. Barcodes for frames already on the shelf when this is applied.
--   8. Row level security: staff of the practice read; nobody writes the tables directly; the patient app gets nothing.
--   9. Checks (the behaviour checks run inside a block that undoes itself).
--   Nothing else changes: no policy of the 28 protected tables, no stock function (they are called, not replaced).
--
-- Who may do what (users.role of an active staff member of the practice)
--   Receiving frames, putting aside, back on the shelf, returns and settling consignment: any staff member (as for
--   deliveries). Lost or damaged, found, changing the salesperson: practice admins and practitioners (as for stock
--   adjustments). Job costs: any staff member of the patient's practice (reception enters the lab's invoice).
--
-- Decisions for the owner (also in the report)
--   - Consignment frames carry no stock value and create no payable when they arrive; a frame sold, or lost or
--     damaged, is owed to the supplier at the agreed cost plus VAT. A frame found again or taken back off an invoice
--     is no longer owed. Settling the lines with the supplier's invoice records it as a payable in Finance.
--   - A sold frame's salesperson is whoever reserved it for the patient (the lab order or "put aside"), else whoever
--     billed it; a practice admin or practitioner can change it.
--   - Job costing takes VAT off stock lines (their prices include VAT) and keeps fees as invoiced.
--
-- How to apply: rehearse (the part between BEGIN; and ROLLBACK; followed by tests that end in RAISE EXCEPTION), then
-- apply that part as one migration. Needs the stock file (stock_receive, stock_return_to_supplier, stock_adjust) and
-- the optometry file. Until it is applied the visit's exam shows its earlier parts only, Frames counts stock without
-- barcodes and the new reports say they are not set up yet.
-- Undo:
--   DROP TRIGGER IF EXISTS zz_optometry_frames ON public.stock_movements;
--   DROP TRIGGER IF EXISTS zz_optometry_frame_units ON public.optometry_lab_orders;
--   DROP FUNCTION IF EXISTS public.optometry_frames_after_movement(), public.optometry_frames_after_lab_order(),
--     public.optometry_frame_units_follow(public.stock_movements), public.optometry_frames_receive(jsonb),
--     public.optometry_frame_units_add(uuid, integer, jsonb), public.optometry_frame_unit_act(uuid, text, jsonb),
--     public.optometry_frame_units_return(jsonb), public.optometry_consignment_settle(jsonb),
--     public.optometry_lab_order_costs(uuid, jsonb), public.optometry_frame_unit_log(public.optometry_frame_units, text,
--     text, uuid, uuid, date), public.optometry_next_frame_barcode(uuid), public.optometry_is_frame_item(uuid),
--     public.optometry_actor(), public.optometry_barcode_taken(uuid, text, uuid);
--   DROP TABLE IF EXISTS public.optometry_consignment_lines, public.optometry_frame_unit_events,
--     public.optometry_frame_units, public.optometry_frame_counters;
--   Recreate optometry_save_exam and optometry_save_frame from proposals/2026-10-08-optometry.sql (sections 8g, 8n);
--   then drop the added columns of optometry_exams, optometry_frames and optometry_lab_orders and
--   public.optometry_ocular_health_ok(jsonb), public.optometry_cl_fit_ok(jsonb), public.optometry_text_list(jsonb),
--   public.optometry_json_object(jsonb).
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Preconditions
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
  v_def text;
BEGIN
  SELECT string_agg(t.name, ', ') INTO v_missing
    FROM (VALUES ('public.optometry_exams'), ('public.optometry_frames'), ('public.optometry_lab_orders'), ('public.practice_inventory'),
                 ('public.stock_movements'), ('public.stock_suppliers'), ('public.stock_deliveries'), ('public.stock_settings'),
                 ('public.practice_expenses'), ('public.patients'), ('public.users')) AS t(name)
   WHERE to_regclass(t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these tables are missing: %. Apply the stock and optometry proposals first.', v_missing;
  END IF;
  SELECT string_agg(t.signature, ', ') INTO v_missing
    FROM (VALUES ('public.stock_receive(jsonb)'), ('public.stock_return_to_supplier(jsonb)'), ('public.stock_adjust(jsonb)'),
                 ('public.stock_assert_role(uuid,text[],text)'), ('public.stock_int(jsonb,text,integer,integer)'),
                 ('public.stock_amount(jsonb,text,numeric)'), ('public.stock_save_item(jsonb)'), ('public.optometry_practice_for(uuid,boolean)'),
                 ('public.optometry_va(text)'), ('public.optometry_va_ok(text)'), ('public.optometry_today()'),
                 ('public.optometry_rx_differs(uuid,jsonb)'), ('public.optometry_void_rx(uuid,text)'),
                 ('public.optometry_insert_rx(uuid,uuid,uuid,uuid,text,date,jsonb)')) AS t(signature)
   WHERE to_regprocedure(t.signature) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped: these functions are missing: %', v_missing;
  END IF;
  -- Sections 1 and 6 replace these two functions as proposals/2026-10-08-optometry.sql left them; a later change must be
  -- merged by hand instead of lost. Running this file again is fine.
  v_def := pg_get_functiondef('public.optometry_save_exam(jsonb)'::regprocedure);
  IF md5(v_def) <> 'cfd4eacb17c004793f3c2e1f94400832' AND position('history_reason' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Stopped: optometry_save_exam changed since 2026-10-08; merge section 1 by hand';
  END IF;
  v_def := pg_get_functiondef('public.optometry_save_frame(jsonb,jsonb)'::regprocedure);
  IF md5(v_def) <> '4f80d9c14eb657dc34ed7414ed2d3fa1' AND position('consignment' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Stopped: optometry_save_frame changed since 2026-10-08; merge section 6 by hand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. The full eye exam
-- ---------------------------------------------------------------------------------------------

-- 1a. Pure helpers: a JSON list of words as text[] (empty = NULL), a JSON object (empty = NULL), and the shapes the
--     checks accept (the app sends the same: src/utils/optometry/examParts.ts)
CREATE OR REPLACE FUNCTION public.optometry_text_list(p_value jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'array' AND jsonb_array_length(p_value) > 0
              THEN ARRAY(SELECT jsonb_array_elements_text(p_value)) END
$$;

CREATE OR REPLACE FUNCTION public.optometry_json_object(p_value jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'object' AND p_value <> '{}'::jsonb THEN p_value END
$$;

-- {"<structure>": {"r": "normal"|"abnormal", "l": ..., "note": "..."}}: known structures, at least one eye, a note
-- (1 to 200 characters) with every abnormal finding
CREATE OR REPLACE FUNCTION public.optometry_ocular_health_ok(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_value IS NULL OR (
    jsonb_typeof(p_value) = 'object' AND p_value <> '{}'::jsonb AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(p_value) AS s(structure, finding)
       WHERE s.structure NOT IN ('lids', 'conjunctiva', 'cornea', 'anterior_chamber', 'iris', 'lens', 'vitreous', 'disc', 'macula', 'vessels', 'periphery')
          OR jsonb_typeof(s.finding) IS DISTINCT FROM 'object'
          OR EXISTS (SELECT 1 FROM jsonb_object_keys(s.finding) AS k(key) WHERE k.key NOT IN ('r', 'l', 'note'))
          OR NOT (s.finding ? 'r' OR s.finding ? 'l')
          OR (s.finding ? 'r' AND COALESCE(s.finding ->> 'r', '') NOT IN ('normal', 'abnormal'))
          OR (s.finding ? 'l' AND COALESCE(s.finding ->> 'l', '') NOT IN ('normal', 'abnormal'))
          OR (s.finding ? 'note' AND (jsonb_typeof(s.finding -> 'note') IS DISTINCT FROM 'string'
                                      OR char_length(btrim(s.finding ->> 'note')) NOT BETWEEN 1 AND 200))
          OR ('abnormal' IN (COALESCE(s.finding ->> 'r', ''), COALESCE(s.finding ->> 'l', '')) AND NOT s.finding ? 'note')))
$$;

-- {"r": {"centration": ..., "movement": ..., "coverage": ..., "comfort": ...}, "l": {...}}
CREATE OR REPLACE FUNCTION public.optometry_cl_fit_ok(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_value IS NULL OR (
    jsonb_typeof(p_value) = 'object' AND p_value <> '{}'::jsonb AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(p_value) AS e(eye, fit)
       WHERE e.eye NOT IN ('r', 'l') OR jsonb_typeof(e.fit) IS DISTINCT FROM 'object' OR e.fit = '{}'::jsonb
          OR EXISTS (SELECT 1 FROM jsonb_each_text(e.fit) AS a(aspect, value)
                      WHERE NOT ((a.aspect = 'centration' AND COALESCE(a.value, '') IN ('centred', 'decentred'))
                              OR (a.aspect = 'movement' AND COALESCE(a.value, '') IN ('good', 'tight', 'loose'))
                              OR (a.aspect = 'coverage' AND COALESCE(a.value, '') IN ('full', 'partial'))
                              OR (a.aspect = 'comfort' AND COALESCE(a.value, '') IN ('good', 'fair', 'poor'))))))
$$;

-- 1b. The columns (all nullable: earlier exams simply have none of them)
ALTER TABLE public.optometry_exams
  ADD COLUMN IF NOT EXISTS history_reason text,
  ADD COLUMN IF NOT EXISTS history_last_test text,
  ADD COLUMN IF NOT EXISTS history_symptoms text[],
  ADD COLUMN IF NOT EXISTS history_health text[],
  ADD COLUMN IF NOT EXISTS history_health_note text,
  ADD COLUMN IF NOT EXISTS history_eye text,
  ADD COLUMN IF NOT EXISTS history_family text[],
  ADD COLUMN IF NOT EXISTS history_needs text,
  -- Keratometry in dioptres, the flat (lower) and steep meridians with their axes
  ADD COLUMN IF NOT EXISTS k_r_flat numeric(4,2),
  ADD COLUMN IF NOT EXISTS k_r_flat_axis smallint,
  ADD COLUMN IF NOT EXISTS k_r_steep numeric(4,2),
  ADD COLUMN IF NOT EXISTS k_r_steep_axis smallint,
  ADD COLUMN IF NOT EXISTS k_l_flat numeric(4,2),
  ADD COLUMN IF NOT EXISTS k_l_flat_axis smallint,
  ADD COLUMN IF NOT EXISTS k_l_steep numeric(4,2),
  ADD COLUMN IF NOT EXISTS k_l_steep_axis smallint,
  ADD COLUMN IF NOT EXISTS ocular_health jsonb,
  ADD COLUMN IF NOT EXISTS cd_ratio_r numeric(3,2),
  ADD COLUMN IF NOT EXISTS cd_ratio_l numeric(3,2),
  ADD COLUMN IF NOT EXISTS fundus_method text,
  ADD COLUMN IF NOT EXISTS dilated boolean,
  ADD COLUMN IF NOT EXISTS cl_lens_type text,
  ADD COLUMN IF NOT EXISTS cl_fit jsonb,
  ADD COLUMN IF NOT EXISTS cl_over_r numeric(4,2),
  ADD COLUMN IF NOT EXISTS cl_over_l numeric(4,2),
  ADD COLUMN IF NOT EXISTS cl_va_r text,
  ADD COLUMN IF NOT EXISTS cl_va_l text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_exams'::regclass AND conname = 'optometry_exams_history_check') THEN
    ALTER TABLE public.optometry_exams ADD CONSTRAINT optometry_exams_history_check CHECK (
      (history_reason IS NULL OR char_length(history_reason) BETWEEN 1 AND 200) AND
      (history_last_test IS NULL OR char_length(history_last_test) BETWEEN 1 AND 60) AND
      (history_health_note IS NULL OR char_length(history_health_note) BETWEEN 1 AND 500) AND
      (history_eye IS NULL OR char_length(history_eye) BETWEEN 1 AND 500) AND
      (history_needs IS NULL OR char_length(history_needs) BETWEEN 1 AND 300) AND
      (history_symptoms IS NULL OR (cardinality(history_symptoms) > 0 AND history_symptoms <@ ARRAY['blur_distance', 'blur_near', 'headaches',
        'eye_strain', 'dry_eyes', 'red_itchy', 'flashes_floaters', 'double_vision', 'night_glare', 'pain']::text[])) AND
      (history_health IS NULL OR (cardinality(history_health) > 0 AND history_health <@ ARRAY['diabetes', 'high_blood_pressure', 'thyroid', 'pregnant']::text[])) AND
      (history_family IS NULL OR (cardinality(history_family) > 0 AND history_family <@ ARRAY['glaucoma', 'macular_degeneration', 'cataract', 'squint', 'blindness']::text[])));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_exams'::regclass AND conname = 'optometry_exams_keratometry_check') THEN
    -- All four readings of an eye or none; 30 to 60 dioptres, the flat one the lower; axes 0 to 180
    ALTER TABLE public.optometry_exams ADD CONSTRAINT optometry_exams_keratometry_check CHECK (
      ((k_r_flat IS NULL AND k_r_flat_axis IS NULL AND k_r_steep IS NULL AND k_r_steep_axis IS NULL) OR
       (k_r_flat IS NOT NULL AND k_r_flat_axis IS NOT NULL AND k_r_steep IS NOT NULL AND k_r_steep_axis IS NOT NULL AND
        k_r_flat BETWEEN 30 AND 60 AND k_r_steep BETWEEN 30 AND 60 AND k_r_flat <= k_r_steep AND
        k_r_flat_axis BETWEEN 0 AND 180 AND k_r_steep_axis BETWEEN 0 AND 180)) AND
      ((k_l_flat IS NULL AND k_l_flat_axis IS NULL AND k_l_steep IS NULL AND k_l_steep_axis IS NULL) OR
       (k_l_flat IS NOT NULL AND k_l_flat_axis IS NOT NULL AND k_l_steep IS NOT NULL AND k_l_steep_axis IS NOT NULL AND
        k_l_flat BETWEEN 30 AND 60 AND k_l_steep BETWEEN 30 AND 60 AND k_l_flat <= k_l_steep AND
        k_l_flat_axis BETWEEN 0 AND 180 AND k_l_steep_axis BETWEEN 0 AND 180)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_exams'::regclass AND conname = 'optometry_exams_ocular_check') THEN
    ALTER TABLE public.optometry_exams ADD CONSTRAINT optometry_exams_ocular_check CHECK (
      public.optometry_ocular_health_ok(ocular_health) AND
      (cd_ratio_r IS NULL OR cd_ratio_r BETWEEN 0 AND 1) AND (cd_ratio_l IS NULL OR cd_ratio_l BETWEEN 0 AND 1) AND
      (fundus_method IS NULL OR fundus_method IN ('direct', 'slit_lamp', 'photo', 'other')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_exams'::regclass AND conname = 'optometry_exams_cl_fit_check') THEN
    ALTER TABLE public.optometry_exams ADD CONSTRAINT optometry_exams_cl_fit_check CHECK (
      (cl_lens_type IS NULL OR cl_lens_type IN ('soft', 'toric', 'multifocal', 'rgp', 'scleral', 'other')) AND
      public.optometry_cl_fit_ok(cl_fit) AND
      (cl_over_r IS NULL OR (cl_over_r BETWEEN -10 AND 10 AND cl_over_r * 4 = trunc(cl_over_r * 4))) AND
      (cl_over_l IS NULL OR (cl_over_l BETWEEN -10 AND 10 AND cl_over_l * 4 = trunc(cl_over_l * 4))) AND
      (cl_va_r IS NULL OR public.optometry_va_ok(cl_va_r)) AND (cl_va_l IS NULL OR public.optometry_va_ok(cl_va_l)));
  END IF;
END $$;

-- 1c. optometry_save_exam: as proposals/2026-10-08-optometry.sql section 8g, plus the full exam's columns. A new
--     column is written only when the payload names it, so an exam saved by an older screen keeps them.
CREATE OR REPLACE FUNCTION public.optometry_save_exam(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_visit_id uuid := NULLIF(p_payload ->> 'visit_id', '')::uuid;
  v_patient uuid;
  v_on date;
  v_practice uuid;
  v_exam uuid;
  v_result jsonb;
  v_kind text;
  v_rx jsonb;
  v_current uuid;
BEGIN
  SELECT v.patient_id, COALESCE(v.visit_date, v.scheduled_date, public.optometry_today()) INTO v_patient, v_on
  FROM public.visits v
  WHERE v.id = v_visit_id;
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Save the visit first: the eye exam belongs to a visit' USING ERRCODE = '22023';
  END IF;
  v_practice := public.optometry_practice_for(v_patient, true);

  INSERT INTO public.optometry_exams AS e (
    practice_id, patient_id, visit_id, examined_on, va_unaided_r, va_unaided_l, va_aided_r, va_aided_l,
    iop_r, iop_l, iop_method, iop_time, fields_result, fields_note, cl_fitting_note, notes, recorded_by, updated_by,
    history_reason, history_last_test, history_symptoms, history_health, history_health_note, history_eye, history_family, history_needs,
    k_r_flat, k_r_flat_axis, k_r_steep, k_r_steep_axis, k_l_flat, k_l_flat_axis, k_l_steep, k_l_steep_axis,
    ocular_health, cd_ratio_r, cd_ratio_l, fundus_method, dilated, cl_lens_type, cl_fit, cl_over_r, cl_over_l, cl_va_r, cl_va_l
  ) VALUES (
    v_practice, v_patient, v_visit_id, v_on,
    public.optometry_va(p_payload ->> 'va_unaided_r'), public.optometry_va(p_payload ->> 'va_unaided_l'),
    public.optometry_va(p_payload ->> 'va_aided_r'), public.optometry_va(p_payload ->> 'va_aided_l'),
    NULLIF(p_payload ->> 'iop_r', '')::numeric, NULLIF(p_payload ->> 'iop_l', '')::numeric,
    NULLIF(p_payload ->> 'iop_method', ''), NULLIF(p_payload ->> 'iop_time', '')::time,
    NULLIF(p_payload ->> 'fields_result', ''), NULLIF(btrim(p_payload ->> 'fields_note'), ''),
    NULLIF(btrim(p_payload ->> 'cl_fitting_note'), ''), NULLIF(btrim(p_payload ->> 'notes'), ''),
    auth.uid(), auth.uid(),
    NULLIF(btrim(p_payload ->> 'history_reason'), ''), NULLIF(btrim(p_payload ->> 'history_last_test'), ''),
    public.optometry_text_list(p_payload -> 'history_symptoms'), public.optometry_text_list(p_payload -> 'history_health'),
    NULLIF(btrim(p_payload ->> 'history_health_note'), ''), NULLIF(btrim(p_payload ->> 'history_eye'), ''),
    public.optometry_text_list(p_payload -> 'history_family'), NULLIF(btrim(p_payload ->> 'history_needs'), ''),
    NULLIF(p_payload ->> 'k_r_flat', '')::numeric, NULLIF(p_payload ->> 'k_r_flat_axis', '')::smallint,
    NULLIF(p_payload ->> 'k_r_steep', '')::numeric, NULLIF(p_payload ->> 'k_r_steep_axis', '')::smallint,
    NULLIF(p_payload ->> 'k_l_flat', '')::numeric, NULLIF(p_payload ->> 'k_l_flat_axis', '')::smallint,
    NULLIF(p_payload ->> 'k_l_steep', '')::numeric, NULLIF(p_payload ->> 'k_l_steep_axis', '')::smallint,
    public.optometry_json_object(p_payload -> 'ocular_health'),
    NULLIF(p_payload ->> 'cd_ratio_r', '')::numeric, NULLIF(p_payload ->> 'cd_ratio_l', '')::numeric,
    NULLIF(p_payload ->> 'fundus_method', ''), NULLIF(p_payload ->> 'dilated', '')::boolean,
    NULLIF(p_payload ->> 'cl_lens_type', ''), public.optometry_json_object(p_payload -> 'cl_fit'),
    NULLIF(p_payload ->> 'cl_over_r', '')::numeric, NULLIF(p_payload ->> 'cl_over_l', '')::numeric,
    public.optometry_va(p_payload ->> 'cl_va_r'), public.optometry_va(p_payload ->> 'cl_va_l')
  )
  ON CONFLICT (visit_id) DO UPDATE SET
    va_unaided_r = EXCLUDED.va_unaided_r, va_unaided_l = EXCLUDED.va_unaided_l,
    va_aided_r = EXCLUDED.va_aided_r, va_aided_l = EXCLUDED.va_aided_l,
    iop_r = EXCLUDED.iop_r, iop_l = EXCLUDED.iop_l, iop_method = EXCLUDED.iop_method, iop_time = EXCLUDED.iop_time,
    fields_result = EXCLUDED.fields_result, fields_note = EXCLUDED.fields_note,
    cl_fitting_note = EXCLUDED.cl_fitting_note, notes = EXCLUDED.notes,
    history_reason = CASE WHEN p_payload ? 'history_reason' THEN EXCLUDED.history_reason ELSE e.history_reason END,
    history_last_test = CASE WHEN p_payload ? 'history_last_test' THEN EXCLUDED.history_last_test ELSE e.history_last_test END,
    history_symptoms = CASE WHEN p_payload ? 'history_symptoms' THEN EXCLUDED.history_symptoms ELSE e.history_symptoms END,
    history_health = CASE WHEN p_payload ? 'history_health' THEN EXCLUDED.history_health ELSE e.history_health END,
    history_health_note = CASE WHEN p_payload ? 'history_health_note' THEN EXCLUDED.history_health_note ELSE e.history_health_note END,
    history_eye = CASE WHEN p_payload ? 'history_eye' THEN EXCLUDED.history_eye ELSE e.history_eye END,
    history_family = CASE WHEN p_payload ? 'history_family' THEN EXCLUDED.history_family ELSE e.history_family END,
    history_needs = CASE WHEN p_payload ? 'history_needs' THEN EXCLUDED.history_needs ELSE e.history_needs END,
    k_r_flat = CASE WHEN p_payload ? 'k_r_flat' THEN EXCLUDED.k_r_flat ELSE e.k_r_flat END,
    k_r_flat_axis = CASE WHEN p_payload ? 'k_r_flat_axis' THEN EXCLUDED.k_r_flat_axis ELSE e.k_r_flat_axis END,
    k_r_steep = CASE WHEN p_payload ? 'k_r_steep' THEN EXCLUDED.k_r_steep ELSE e.k_r_steep END,
    k_r_steep_axis = CASE WHEN p_payload ? 'k_r_steep_axis' THEN EXCLUDED.k_r_steep_axis ELSE e.k_r_steep_axis END,
    k_l_flat = CASE WHEN p_payload ? 'k_l_flat' THEN EXCLUDED.k_l_flat ELSE e.k_l_flat END,
    k_l_flat_axis = CASE WHEN p_payload ? 'k_l_flat_axis' THEN EXCLUDED.k_l_flat_axis ELSE e.k_l_flat_axis END,
    k_l_steep = CASE WHEN p_payload ? 'k_l_steep' THEN EXCLUDED.k_l_steep ELSE e.k_l_steep END,
    k_l_steep_axis = CASE WHEN p_payload ? 'k_l_steep_axis' THEN EXCLUDED.k_l_steep_axis ELSE e.k_l_steep_axis END,
    ocular_health = CASE WHEN p_payload ? 'ocular_health' THEN EXCLUDED.ocular_health ELSE e.ocular_health END,
    cd_ratio_r = CASE WHEN p_payload ? 'cd_ratio_r' THEN EXCLUDED.cd_ratio_r ELSE e.cd_ratio_r END,
    cd_ratio_l = CASE WHEN p_payload ? 'cd_ratio_l' THEN EXCLUDED.cd_ratio_l ELSE e.cd_ratio_l END,
    fundus_method = CASE WHEN p_payload ? 'fundus_method' THEN EXCLUDED.fundus_method ELSE e.fundus_method END,
    dilated = CASE WHEN p_payload ? 'dilated' THEN EXCLUDED.dilated ELSE e.dilated END,
    cl_lens_type = CASE WHEN p_payload ? 'cl_lens_type' THEN EXCLUDED.cl_lens_type ELSE e.cl_lens_type END,
    cl_fit = CASE WHEN p_payload ? 'cl_fit' THEN EXCLUDED.cl_fit ELSE e.cl_fit END,
    cl_over_r = CASE WHEN p_payload ? 'cl_over_r' THEN EXCLUDED.cl_over_r ELSE e.cl_over_r END,
    cl_over_l = CASE WHEN p_payload ? 'cl_over_l' THEN EXCLUDED.cl_over_l ELSE e.cl_over_l END,
    cl_va_r = CASE WHEN p_payload ? 'cl_va_r' THEN EXCLUDED.cl_va_r ELSE e.cl_va_r END,
    cl_va_l = CASE WHEN p_payload ? 'cl_va_l' THEN EXCLUDED.cl_va_l ELSE e.cl_va_l END,
    updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING e.id INTO v_exam;
  v_result := jsonb_build_object('exam_id', v_exam);

  FOREACH v_kind IN ARRAY ARRAY['spectacles', 'contact_lenses'] LOOP
    v_rx := p_payload -> CASE v_kind WHEN 'spectacles' THEN 'refraction' ELSE 'contact_lens_rx' END;
    SELECT r.id INTO v_current
    FROM public.optometry_prescriptions r
    WHERE r.exam_id = v_exam AND r.kind = v_kind AND r.voided_at IS NULL
    ORDER BY r.recorded_at DESC
    LIMIT 1;
    IF jsonb_typeof(v_rx) = 'object' THEN
      IF v_current IS NULL OR public.optometry_rx_differs(v_current, v_rx) THEN
        IF v_current IS NOT NULL THEN
          PERFORM public.optometry_void_rx(v_current, 'Changed at the eye exam');
        END IF;
        v_current := public.optometry_insert_rx(v_practice, v_patient, v_visit_id, v_exam, v_kind, v_on, v_rx);
      END IF;
      v_result := v_result || jsonb_build_object(v_kind, v_current);
    ELSIF v_current IS NOT NULL THEN
      PERFORM public.optometry_void_rx(v_current, 'Taken off the eye exam');
    END IF;
  END LOOP;
  RETURN v_result;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. One barcode per frame
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.optometry_frame_units (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id          uuid NOT NULL,
  -- The frame item (practice_inventory, Frames group): the model in a colour and size
  item_id              uuid NOT NULL,
  barcode              text NOT NULL,
  status               text NOT NULL DEFAULT 'in_stock',
  -- Reserved for, or sold to
  patient_id           uuid,
  -- The patient's spectacles order it is for
  lab_order_id         uuid,
  -- Sold on (no foreign keys: invoice lines are rewritten when a visit is saved)
  invoice_id           uuid,
  invoice_line_id      uuid,
  -- The invoice that sold it last: a bill saved again sells the same frame again
  last_invoice_id      uuid,
  sold_on              date,
  -- The salesperson
  sold_by              uuid,
  received_delivery_id uuid,
  returned_delivery_id uuid,
  note                 text,
  -- The day it got its status, who gave it and when
  status_on            date NOT NULL,
  status_changed_by    uuid,
  status_changed_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT optometry_frame_units_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_frame_units_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.practice_inventory(id) ON DELETE CASCADE,
  CONSTRAINT optometry_frame_units_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_units_lab_order_id_fkey FOREIGN KEY (lab_order_id) REFERENCES public.optometry_lab_orders(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_units_sold_by_fkey FOREIGN KEY (sold_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_units_status_changed_by_fkey FOREIGN KEY (status_changed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_units_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_units_received_delivery_id_fkey FOREIGN KEY (received_delivery_id) REFERENCES public.stock_deliveries(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_units_returned_delivery_id_fkey FOREIGN KEY (returned_delivery_id) REFERENCES public.stock_deliveries(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_units_status_check CHECK (status IN ('in_stock', 'reserved', 'sold', 'returned', 'written_off')),
  -- Letters, digits and dashes (what a scanner types), 4 to 40
  CONSTRAINT optometry_frame_units_barcode_check CHECK (barcode ~ '^[A-Za-z0-9][A-Za-z0-9-]{3,39}$'),
  CONSTRAINT optometry_frame_units_note_check CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 200),
  -- A sold frame says when; only a sold frame names its invoice
  CONSTRAINT optometry_frame_units_sold_check CHECK ((status = 'sold') = (sold_on IS NOT NULL) AND (status = 'sold' OR (invoice_id IS NULL AND invoice_line_id IS NULL)))
);
COMMENT ON TABLE public.optometry_frame_units IS
  'One row per physical frame (optometry): its barcode and status (in stock, reserved, sold, back to the supplier, lost or damaged), kept in step with the stock ledger. Every change is in optometry_frame_unit_events. See proposals/2026-10-13-optometry-frames-and-exam.sql.';

-- A barcode names one frame in the practice (upper and lower case alike, as scanners differ)
CREATE UNIQUE INDEX IF NOT EXISTS optometry_frame_units_barcode_key ON public.optometry_frame_units (practice_id, upper(barcode));
CREATE INDEX IF NOT EXISTS optometry_frame_units_item_idx ON public.optometry_frame_units (item_id, status);
CREATE INDEX IF NOT EXISTS optometry_frame_units_practice_idx ON public.optometry_frame_units (practice_id, status);
CREATE INDEX IF NOT EXISTS optometry_frame_units_order_idx ON public.optometry_frame_units (lab_order_id) WHERE lab_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS optometry_frame_units_line_idx ON public.optometry_frame_units (invoice_line_id) WHERE invoice_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS optometry_frame_units_patient_idx ON public.optometry_frame_units (patient_id) WHERE patient_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.optometry_frame_unit_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id      uuid NOT NULL,
  practice_id  uuid NOT NULL,
  status       text NOT NULL,
  from_status  text,
  reason       text,
  patient_id   uuid,
  lab_order_id uuid,
  invoice_id   uuid,
  delivery_id  uuid,
  movement_id  uuid,
  happened_on  date NOT NULL,
  changed_by   uuid,
  -- clock_timestamp: several changes in one save keep their order
  changed_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT optometry_frame_unit_events_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.optometry_frame_units(id) ON DELETE CASCADE,
  CONSTRAINT optometry_frame_unit_events_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_frame_unit_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_unit_events_lab_order_id_fkey FOREIGN KEY (lab_order_id) REFERENCES public.optometry_lab_orders(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_unit_events_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.stock_deliveries(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_unit_events_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_unit_events_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_frame_unit_events_status_check CHECK (
    status IN ('in_stock', 'reserved', 'sold', 'returned', 'written_off') AND
    (from_status IS NULL OR from_status IN ('in_stock', 'reserved', 'sold', 'returned', 'written_off'))),
  CONSTRAINT optometry_frame_unit_events_reason_check CHECK (reason IS NULL OR char_length(reason) <= 200)
);
COMMENT ON TABLE public.optometry_frame_unit_events IS
  'Every change of a frame''s status (who, when, why, and the patient, order, invoice or delivery). Insert only, through the optometry functions and triggers.';

CREATE INDEX IF NOT EXISTS optometry_frame_unit_events_unit_idx ON public.optometry_frame_unit_events (unit_id, changed_at);
CREATE INDEX IF NOT EXISTS optometry_frame_unit_events_practice_idx ON public.optometry_frame_unit_events (practice_id, happened_on);

CREATE TABLE IF NOT EXISTS public.optometry_frame_counters (
  practice_id uuid PRIMARY KEY,
  last_number integer NOT NULL CHECK (last_number >= 0),
  CONSTRAINT optometry_frame_counters_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.optometry_frame_counters IS 'The last of the practice''s own frame barcode numbers (FR000001 ...). Written only by optometry_next_frame_barcode().';

-- 2b. Internal helpers
-- The signed-in staff member (for the "who" columns): NULL for a login without a staff record and for the service role
CREATE OR REPLACE FUNCTION public.optometry_actor()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id FROM public.users u WHERE u.id = auth.uid()
$$;

-- A frame is a stock item with frame details, or one in the Frames group
CREATE OR REPLACE FUNCTION public.optometry_is_frame_item(p_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.optometry_frames f WHERE f.item_id = p_item_id)
      OR EXISTS (SELECT 1 FROM public.practice_inventory i WHERE i.id = p_item_id AND i.item_group = 'Frames')
$$;

-- Whether a barcode already names a frame, or another stock item, of the practice
CREATE OR REPLACE FUNCTION public.optometry_barcode_taken(p_practice_id uuid, p_code text, p_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.optometry_frame_units u WHERE u.practice_id = p_practice_id AND upper(u.barcode) = upper(btrim(p_code)))
      OR EXISTS (SELECT 1 FROM public.practice_inventory i
                  WHERE i.practice_id = p_practice_id AND upper(i.barcode) = upper(btrim(p_code)) AND i.id IS DISTINCT FROM p_item_id)
$$;

-- The practice's next free barcode: FR000001, FR000002 ... (never one already in use)
CREATE OR REPLACE FUNCTION public.optometry_next_frame_barcode(p_practice_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next integer;
  v_code text;
BEGIN
  LOOP
    INSERT INTO public.optometry_frame_counters AS c (practice_id, last_number) VALUES (p_practice_id, 1)
    ON CONFLICT (practice_id) DO UPDATE SET last_number = c.last_number + 1
    RETURNING c.last_number INTO v_next;
    v_code := 'FR' || CASE WHEN v_next < 1000000 THEN lpad(v_next::text, 6, '0') ELSE v_next::text END;
    EXIT WHEN NOT public.optometry_barcode_taken(p_practice_id, v_code, NULL);
  END LOOP;
  RETURN v_code;
END $$;

-- One line of a frame's history, for the frame as it is now
CREATE OR REPLACE FUNCTION public.optometry_frame_unit_log(
  p_unit public.optometry_frame_units, p_from text, p_reason text, p_delivery uuid, p_movement uuid, p_on date)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.optometry_frame_unit_events (unit_id, practice_id, status, from_status, reason, patient_id, lab_order_id, invoice_id,
                                                  delivery_id, movement_id, happened_on, changed_by)
  VALUES (p_unit.id, p_unit.practice_id, p_unit.status, p_from, left(NULLIF(btrim(p_reason), ''), 200), p_unit.patient_id, p_unit.lab_order_id,
          CASE WHEN p_unit.status = 'sold' OR p_from = 'sold' THEN COALESCE(p_unit.invoice_id, p_unit.last_invoice_id) END,
          p_delivery, p_movement, COALESCE(p_on, public.optometry_today()), public.optometry_actor())
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Consignment
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.optometry_frames
  ADD COLUMN IF NOT EXISTS consignment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consignment_supplier_id uuid,
  ADD COLUMN IF NOT EXISTS consignment_cost numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_frames'::regclass AND conname = 'optometry_frames_consignment_supplier_id_fkey') THEN
    ALTER TABLE public.optometry_frames ADD CONSTRAINT optometry_frames_consignment_supplier_id_fkey
      FOREIGN KEY (consignment_supplier_id) REFERENCES public.stock_suppliers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_frames'::regclass AND conname = 'optometry_frames_consignment_check') THEN
    -- A consignment frame says what is owed per frame sold; an owned frame keeps no consignment details
    ALTER TABLE public.optometry_frames ADD CONSTRAINT optometry_frames_consignment_check CHECK (
      (consignment AND consignment_cost IS NOT NULL AND consignment_cost BETWEEN 0 AND 1000000) OR
      (NOT consignment AND consignment_supplier_id IS NULL AND consignment_cost IS NULL));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.optometry_consignment_lines (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL,
  item_id            uuid NOT NULL,
  supplier_id        uuid,
  -- The stock movement it follows (one line per movement)
  movement_id        uuid NOT NULL,
  kind               text NOT NULL,
  -- Frames owed (+) or no longer owed (-)
  quantity           integer NOT NULL,
  -- What is owed per frame (excl VAT) and the VAT rate, when it happened
  cost_each          numeric(12,2) NOT NULL,
  vat_rate           numeric(5,2) NOT NULL,
  invoice_id         uuid,
  invoice_line_id    uuid,
  patient_id         uuid,
  happened_on        date NOT NULL,
  -- Settled with the supplier's invoice (its payable in practice_expenses)
  settled_at         timestamptz,
  settled_by         uuid,
  expense_id         uuid,
  supplier_reference text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT optometry_consignment_lines_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT optometry_consignment_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.practice_inventory(id) ON DELETE RESTRICT,
  CONSTRAINT optometry_consignment_lines_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.stock_suppliers(id) ON DELETE SET NULL,
  CONSTRAINT optometry_consignment_lines_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
  CONSTRAINT optometry_consignment_lines_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL,
  CONSTRAINT optometry_consignment_lines_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT optometry_consignment_lines_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.practice_expenses(id) ON DELETE SET NULL,
  CONSTRAINT optometry_consignment_lines_movement_key UNIQUE (movement_id),
  CONSTRAINT optometry_consignment_lines_kind_check CHECK (kind IN ('sold', 'sale_reversed', 'dispensed', 'dispense_reversed', 'adjusted', 'counted')),
  CONSTRAINT optometry_consignment_lines_values_check CHECK (quantity <> 0 AND cost_each >= 0 AND vat_rate BETWEEN 0 AND 100),
  CONSTRAINT optometry_consignment_lines_settled_check CHECK (
    (settled_at IS NULL AND expense_id IS NULL AND supplier_reference IS NULL) OR
    (settled_at IS NOT NULL AND char_length(btrim(COALESCE(supplier_reference, ''))) BETWEEN 1 AND 60))
);
COMMENT ON TABLE public.optometry_consignment_lines IS
  'What the practice owes a supplier for consignment frames sold or lost (+), or no longer owes (-), at the agreed cost, until settled with the supplier''s invoice. Written by the stock movement trigger and optometry_consignment_settle.';

CREATE INDEX IF NOT EXISTS optometry_consignment_lines_open_idx ON public.optometry_consignment_lines (practice_id, supplier_id) WHERE settled_at IS NULL;
CREATE INDEX IF NOT EXISTS optometry_consignment_lines_invoice_idx ON public.optometry_consignment_lines (invoice_id) WHERE invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 4. The stock ledger moves the barcodes and records what is owed for consignment frames
-- ---------------------------------------------------------------------------------------------

-- 4a. Brings a frame item's barcodes in line with one stock movement: never more frames than the movement moved, and
--     only as far as the barcodes on the shelf (in stock or reserved) differ from what the ledger has on the shelf.
--     Functions that choose particular frames (sections 6) change them before the movement, so nothing is left to do.
CREATE OR REPLACE FUNCTION public.optometry_frame_units_follow(m public.stock_movements)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_on_hand integer;
  v_units integer;
  v_need integer;
  v_unit public.optometry_frame_units;
  v_from text;
  v_target text;
  v_back text;
  v_reason text;
  v_patient uuid := (SELECT p.id FROM public.patients p WHERE p.id = m.patient_id);
  v_actor uuid := public.optometry_actor();
  v_seller uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('optometry_frame_units'), hashtext(m.item_id::text));
  SELECT COALESCE(SUM(s.quantity), 0) INTO v_on_hand FROM public.stock_movements s WHERE s.item_id = m.item_id;
  SELECT count(*) INTO v_units FROM public.optometry_frame_units u WHERE u.item_id = m.item_id AND u.status IN ('in_stock', 'reserved');

  IF m.quantity > 0 THEN
    v_need := LEAST(GREATEST(v_on_hand, 0) - v_units, m.quantity);
    IF v_need <= 0 THEN
      RETURN;
    END IF;
    -- Frames this movement brings back: off an invoice line, back from a return undone, found again
    FOR v_unit IN
      SELECT u.* FROM public.optometry_frame_units u
       WHERE u.item_id = m.item_id AND (
             (m.kind IN ('sale_reversed', 'dispense_reversed') AND u.status = 'sold'
              AND ((m.invoice_line_id IS NOT NULL AND u.invoice_line_id = m.invoice_line_id)
                   OR (m.invoice_line_id IS NULL AND u.patient_id IS NOT DISTINCT FROM v_patient)))
          OR (m.kind = 'delivery_reversed' AND u.status = 'returned' AND u.returned_delivery_id = m.delivery_id)
          OR (m.kind IN ('adjusted', 'counted') AND u.status = 'written_off'))
       ORDER BY u.status_changed_at DESC, u.barcode
       LIMIT v_need
       FOR UPDATE
    LOOP
      v_from := v_unit.status;
      -- Still on an open spectacles order: reserved for the patient again, else back on the shelf
      v_back := CASE WHEN v_from = 'sold' AND v_unit.lab_order_id IS NOT NULL AND EXISTS (
                       SELECT 1 FROM public.optometry_lab_orders o WHERE o.id = v_unit.lab_order_id AND o.status NOT IN ('collected', 'cancelled'))
                     THEN 'reserved' ELSE 'in_stock' END;
      v_reason := CASE m.kind
        WHEN 'delivery_reversed' THEN 'Return ' || COALESCE(m.document_ref, '') || ' undone'
        WHEN 'adjusted' THEN 'Found: ' || COALESCE(m.reason, 'stock adjustment')
        WHEN 'counted' THEN 'Found at the stock count ' || COALESCE(m.document_ref, '')
        ELSE 'Back from invoice ' || COALESCE(m.document_ref, '') || COALESCE(': ' || m.reason, '') END;
      UPDATE public.optometry_frame_units u
         SET status = v_back,
             patient_id = CASE WHEN v_back = 'reserved' THEN u.patient_id END,
             lab_order_id = CASE WHEN v_back = 'reserved' THEN u.lab_order_id END,
             invoice_id = NULL, invoice_line_id = NULL, sold_on = NULL, sold_by = NULL,
             returned_delivery_id = CASE WHEN v_from = 'returned' THEN NULL ELSE u.returned_delivery_id END,
             note = NULL, status_on = m.occurred_on, status_changed_by = v_actor, status_changed_at = clock_timestamp()
       WHERE u.id = v_unit.id
       RETURNING u.* INTO v_unit;
      PERFORM public.optometry_frame_unit_log(v_unit, v_from, v_reason, m.delivery_id, m.id, m.occurred_on);
      v_need := v_need - 1;
    END LOOP;
    -- New frames on the shelf get the practice's own barcodes
    WHILE v_need > 0 LOOP
      INSERT INTO public.optometry_frame_units (practice_id, item_id, barcode, status, received_delivery_id, status_on, status_changed_by, created_by)
      VALUES (m.practice_id, m.item_id, public.optometry_next_frame_barcode(m.practice_id), 'in_stock',
              CASE WHEN m.kind = 'received' THEN m.delivery_id END, m.occurred_on, v_actor, v_actor)
      RETURNING * INTO v_unit;
      PERFORM public.optometry_frame_unit_log(v_unit, NULL,
        CASE m.kind WHEN 'received' THEN 'Delivery ' || COALESCE(m.document_ref, '') WHEN 'opening' THEN 'On the shelf when the frame was added'
                    WHEN 'counted' THEN 'Found at the stock count ' || COALESCE(m.document_ref, '') ELSE 'Added to stock' END,
        m.delivery_id, m.id, m.occurred_on);
      v_need := v_need - 1;
    END LOOP;
    RETURN;
  END IF;

  v_need := LEAST(v_units - GREATEST(v_on_hand, 0), -m.quantity);
  v_target := CASE m.kind WHEN 'sold' THEN 'sold' WHEN 'dispensed' THEN 'sold' WHEN 'returned' THEN 'returned'
                          WHEN 'delivery_reversed' THEN 'returned' WHEN 'adjusted' THEN 'written_off' WHEN 'counted' THEN 'written_off' END;
  -- A kind this file does not know (a later one) is left for the Frames list to show
  IF v_need <= 0 OR v_target IS NULL THEN
    RETURN;
  END IF;
  FOR v_unit IN
    SELECT u.* FROM public.optometry_frame_units u
     WHERE u.item_id = m.item_id AND u.status IN ('in_stock', 'reserved')
       -- A sale never takes a frame reserved for someone else
       AND (v_target <> 'sold' OR u.status = 'in_stock' OR (u.patient_id IS NOT NULL AND u.patient_id = v_patient))
     ORDER BY
       CASE WHEN v_target = 'sold' AND u.status = 'reserved' THEN 0
            WHEN v_target = 'sold' AND u.last_invoice_id IS NOT NULL AND u.last_invoice_id = m.invoice_id THEN 1
            WHEN m.kind = 'delivery_reversed' AND u.received_delivery_id = m.delivery_id THEN 0
            WHEN u.status = 'in_stock' THEN 2 ELSE 3 END,
       u.created_at, u.barcode
     LIMIT v_need
     FOR UPDATE
  LOOP
    v_from := v_unit.status;
    -- The salesperson: who reserved it for the patient, else who billed it
    v_seller := CASE WHEN v_from = 'reserved' THEN COALESCE(v_unit.status_changed_by, v_actor) ELSE COALESCE(v_actor, (SELECT u.id FROM public.users u WHERE u.id = m.created_by)) END;
    UPDATE public.optometry_frame_units u
       SET status = v_target,
           patient_id = CASE WHEN v_target = 'sold' THEN v_patient END,
           lab_order_id = CASE WHEN v_target = 'sold' THEN u.lab_order_id END,
           invoice_id = CASE WHEN v_target = 'sold' THEN m.invoice_id END,
           invoice_line_id = CASE WHEN v_target = 'sold' THEN m.invoice_line_id END,
           last_invoice_id = CASE WHEN v_target = 'sold' AND m.invoice_id IS NOT NULL THEN m.invoice_id ELSE u.last_invoice_id END,
           sold_on = CASE WHEN v_target = 'sold' THEN m.occurred_on END,
           sold_by = CASE WHEN v_target = 'sold' THEN v_seller END,
           returned_delivery_id = CASE WHEN v_target = 'returned' THEN m.delivery_id ELSE u.returned_delivery_id END,
           note = CASE WHEN v_target = 'sold' THEN NULL ELSE left(NULLIF(btrim(COALESCE(m.reason, '')), ''), 200) END,
           status_on = m.occurred_on, status_changed_by = v_actor, status_changed_at = clock_timestamp()
     WHERE u.id = v_unit.id
     RETURNING u.* INTO v_unit;
    PERFORM public.optometry_frame_unit_log(v_unit, v_from,
      CASE m.kind WHEN 'sold' THEN 'Invoice ' || COALESCE(m.document_ref, '') WHEN 'dispensed' THEN 'Given out ' || COALESCE(m.document_ref, '')
                  WHEN 'returned' THEN 'Return ' || COALESCE(m.document_ref, '') || COALESCE(': ' || m.reason, '')
                  WHEN 'delivery_reversed' THEN 'Delivery ' || COALESCE(m.document_ref, '') || ' reversed'
                  WHEN 'counted' THEN 'Missing at the stock count ' || COALESCE(m.document_ref, '')
                  ELSE COALESCE(m.reason, 'Stock adjustment') END,
      m.delivery_id, m.id, m.occurred_on);
  END LOOP;
END $$;

-- 4b. The trigger. A consignment amount is always recorded (its failure stops the movement: a frame sold without what
--     is owed would be the supplier's loss); a barcode problem never stops a sale or a delivery.
CREATE OR REPLACE FUNCTION public.optometry_frames_after_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_frame public.optometry_frames;
BEGIN
  SELECT * INTO v_frame FROM public.optometry_frames f WHERE f.item_id = NEW.item_id;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.practice_inventory i WHERE i.id = NEW.item_id AND i.item_group = 'Frames') THEN
    RETURN NULL;
  END IF;
  -- The supplier's frames come in without a cost: a delivery with one would make the practice pay for them twice (now,
  -- and again when they are sold)
  IF COALESCE(v_frame.consignment, false) AND NEW.kind = 'received' AND NEW.value <> 0 THEN
    RAISE EXCEPTION 'Consignment frames belong to the supplier and are received without a cost: use Optometry > Frames > Receive frames'
      USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_frame.consignment, false) AND NEW.kind IN ('sold', 'sale_reversed', 'dispensed', 'dispense_reversed', 'adjusted', 'counted') THEN
    INSERT INTO public.optometry_consignment_lines (practice_id, item_id, supplier_id, movement_id, kind, quantity, cost_each, vat_rate,
                                                    invoice_id, invoice_line_id, patient_id, happened_on)
    SELECT NEW.practice_id, NEW.item_id, v_frame.consignment_supplier_id, NEW.id, NEW.kind, -NEW.quantity, v_frame.consignment_cost,
           COALESCE(i.vat_rate, s.default_vat_rate, 15), NEW.invoice_id, NEW.invoice_line_id,
           (SELECT p.id FROM public.patients p WHERE p.id = NEW.patient_id), NEW.occurred_on
      FROM public.practice_inventory i
      LEFT JOIN public.stock_settings s ON s.practice_id = i.practice_id
     WHERE i.id = NEW.item_id;
  END IF;
  BEGIN
    PERFORM public.optometry_frame_units_follow(NEW);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Frame barcodes not updated for stock movement %: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_optometry_frames ON public.stock_movements;
CREATE TRIGGER zz_optometry_frames AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.optometry_frames_after_movement();

-- ---------------------------------------------------------------------------------------------
-- 5. Lab orders: their frame reserved for the patient, and the job's costs
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.optometry_frames_after_lab_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit public.optometry_frame_units;
  v_from text;
  v_today date := public.optometry_today();
  v_actor uuid := public.optometry_actor();
BEGIN
  BEGIN
    -- Cancelled, or another frame chosen: the frame reserved for the order goes back on the shelf
    IF TG_OP = 'UPDATE' AND (NEW.status = 'cancelled' OR NEW.frame_item_id IS DISTINCT FROM OLD.frame_item_id) THEN
      FOR v_unit IN SELECT u.* FROM public.optometry_frame_units u WHERE u.lab_order_id = NEW.id AND u.status = 'reserved' FOR UPDATE LOOP
        UPDATE public.optometry_frame_units u
           SET status = 'in_stock', patient_id = NULL, lab_order_id = NULL, note = NULL, status_on = v_today,
               status_changed_by = v_actor, status_changed_at = clock_timestamp()
         WHERE u.id = v_unit.id
         RETURNING u.* INTO v_unit;
        PERFORM public.optometry_frame_unit_log(v_unit, 'reserved',
          'Lab order ' || NEW.order_no || CASE WHEN NEW.status = 'cancelled' THEN ' cancelled' ELSE ': another frame chosen' END, NULL, NULL, v_today);
      END LOOP;
    END IF;
    IF NEW.status IN ('collected', 'cancelled') OR NEW.frame_item_id IS NULL
       OR EXISTS (SELECT 1 FROM public.optometry_frame_units u WHERE u.lab_order_id = NEW.id AND u.item_id = NEW.frame_item_id AND u.status IN ('reserved', 'sold')) THEN
      RETURN NULL;
    END IF;
    -- Billed before the order was saved: the frame already sold to the patient is the order's frame
    SELECT u.* INTO v_unit FROM public.optometry_frame_units u
     WHERE u.item_id = NEW.frame_item_id AND u.status = 'sold' AND u.patient_id = NEW.patient_id AND u.lab_order_id IS NULL
     ORDER BY u.sold_on DESC, u.status_changed_at DESC
     LIMIT 1
     FOR UPDATE;
    IF FOUND THEN
      UPDATE public.optometry_frame_units SET lab_order_id = NEW.id WHERE id = v_unit.id;
      RETURN NULL;
    END IF;
    -- Else the frame put aside for the patient, or the one longest on the shelf
    SELECT u.* INTO v_unit FROM public.optometry_frame_units u
     WHERE u.item_id = NEW.frame_item_id
       AND (u.status = 'in_stock' OR (u.status = 'reserved' AND u.lab_order_id IS NULL AND u.patient_id = NEW.patient_id))
     ORDER BY CASE WHEN u.status = 'reserved' THEN 0 ELSE 1 END, u.created_at, u.barcode
     LIMIT 1
     FOR UPDATE;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    v_from := v_unit.status;
    UPDATE public.optometry_frame_units u
       SET status = 'reserved', patient_id = NEW.patient_id, lab_order_id = NEW.id, status_on = v_today,
           status_changed_by = v_actor, status_changed_at = clock_timestamp()
     WHERE u.id = v_unit.id
     RETURNING u.* INTO v_unit;
    PERFORM public.optometry_frame_unit_log(v_unit, v_from, 'Lab order ' || NEW.order_no, NULL, NULL, v_today);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Frame not reserved for lab order %: %', NEW.order_no, SQLERRM;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_optometry_frame_units ON public.optometry_lab_orders;
CREATE TRIGGER zz_optometry_frame_units AFTER INSERT OR UPDATE OF frame_item_id, status ON public.optometry_lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.optometry_frames_after_lab_order();

ALTER TABLE public.optometry_lab_orders
  ADD COLUMN IF NOT EXISTS lens_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS labour_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS lab_invoice_ref text,
  ADD COLUMN IF NOT EXISTS costs_updated_by uuid,
  ADD COLUMN IF NOT EXISTS costs_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_lab_orders'::regclass AND conname = 'optometry_lab_orders_costs_updated_by_fkey') THEN
    ALTER TABLE public.optometry_lab_orders ADD CONSTRAINT optometry_lab_orders_costs_updated_by_fkey
      FOREIGN KEY (costs_updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.optometry_lab_orders'::regclass AND conname = 'optometry_lab_orders_costs_check') THEN
    ALTER TABLE public.optometry_lab_orders ADD CONSTRAINT optometry_lab_orders_costs_check CHECK (
      (lens_cost IS NULL OR lens_cost BETWEEN 0 AND 1000000) AND (labour_cost IS NULL OR labour_cost BETWEEN 0 AND 1000000) AND
      (lab_invoice_ref IS NULL OR char_length(lab_invoice_ref) BETWEEN 1 AND 40));
  END IF;
END $$;

-- optometry_lab_order_costs(order, {lens_cost?, labour_cost?, lab_invoice_ref?}): what the lab charged for the lenses
-- (excl VAT), the practice's labour and the lab's invoice number; empty = not entered. Any staff member of the
-- patient's practice, in any step of the order (the lab's invoice comes later).
CREATE OR REPLACE FUNCTION public.optometry_lab_order_costs(p_order_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.optometry_lab_orders;
  v_lens numeric := CASE WHEN jsonb_typeof(p_payload -> 'lens_cost') = 'number' THEN public.stock_amount(p_payload -> 'lens_cost', 'The lab''s charge', 1000000) END;
  v_labour numeric := CASE WHEN jsonb_typeof(p_payload -> 'labour_cost') = 'number' THEN public.stock_amount(p_payload -> 'labour_cost', 'The labour', 1000000) END;
  v_ref text := NULLIF(btrim(COALESCE(p_payload ->> 'lab_invoice_ref', '')), '');
BEGIN
  SELECT * INTO v_order FROM public.optometry_lab_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lab order not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.optometry_practice_for(v_order.patient_id, false);
  IF char_length(COALESCE(v_ref, '')) > 40 THEN
    RAISE EXCEPTION 'Keep the lab''s invoice number to 40 characters' USING ERRCODE = '22023';
  END IF;
  UPDATE public.optometry_lab_orders
     SET lens_cost = v_lens, labour_cost = v_labour, lab_invoice_ref = v_ref,
         costs_updated_by = public.optometry_actor(), costs_updated_at = now()
   WHERE id = p_order_id;
  RETURN jsonb_build_object('id', p_order_id, 'lens_cost', v_lens, 'labour_cost', v_labour, 'lab_invoice_ref', v_ref);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. What the app calls
-- ---------------------------------------------------------------------------------------------

-- 6a. optometry_save_frame(item, frame): as proposals/2026-10-08-optometry.sql section 8n, plus consignment:
--     frame {brand, model, colour?, size?, consignment?, consignment_cost?}. A consignment frame belongs to the item's
--     supplier and carries no stock value; it is set when the frame is added (a frame with stock history keeps what
--     it is). A payload without "consignment" keeps the frame as it was.
CREATE OR REPLACE FUNCTION public.optometry_save_frame(p_item jsonb, p_frame jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_brand text := NULLIF(btrim(p_frame ->> 'brand'), '');
  v_model text := NULLIF(btrim(p_frame ->> 'model'), '');
  v_item_id uuid := NULLIF(p_item ->> 'id', '')::uuid;
  v_existing public.optometry_frames;
  v_consignment boolean;
  v_cost numeric;
  v_supplier uuid := NULLIF(p_item ->> 'preferred_supplier_id', '')::uuid;
  v_item jsonb := COALESCE(p_item, '{}'::jsonb);
  v_result jsonb;
  v_id uuid;
  v_practice uuid;
BEGIN
  IF v_brand IS NULL OR v_model IS NULL THEN
    RAISE EXCEPTION 'A frame needs its brand and model' USING ERRCODE = '22023';
  END IF;
  IF v_item_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.optometry_frames f WHERE f.item_id = v_item_id;
  END IF;
  v_consignment := CASE WHEN p_frame ? 'consignment' THEN COALESCE((p_frame ->> 'consignment')::boolean, false) ELSE COALESCE(v_existing.consignment, false) END;
  v_cost := CASE WHEN jsonb_typeof(p_frame -> 'consignment_cost') = 'number'
                 THEN public.stock_amount(p_frame -> 'consignment_cost', 'What is owed to the supplier per frame sold', 1000000)
                 WHEN p_frame ? 'consignment_cost' THEN NULL
                 ELSE v_existing.consignment_cost END;
  IF v_item_id IS NOT NULL AND v_consignment IS DISTINCT FROM COALESCE(v_existing.consignment, false)
     AND EXISTS (SELECT 1 FROM public.stock_movements m WHERE m.item_id = v_item_id) THEN
    RAISE EXCEPTION 'This frame already has stock history, so whether the supplier owns it cannot change. Add the consignment frames as a new frame.'
      USING ERRCODE = '22023';
  END IF;
  IF v_consignment THEN
    IF v_supplier IS NULL THEN
      RAISE EXCEPTION 'A consignment frame belongs to its supplier: choose the supplier' USING ERRCODE = '22023';
    END IF;
    IF v_cost IS NULL THEN
      RAISE EXCEPTION 'Type what the practice pays the supplier per frame sold' USING ERRCODE = '22023';
    END IF;
    -- The supplier's frames are not the practice's stock: no value in the ledger, no payable when they arrive
    v_item := v_item || jsonb_build_object('unit_cost', 0);
  END IF;
  v_result := public.stock_save_item(v_item || jsonb_build_object('item_group', 'Frames', 'category', 'other'));
  v_id := (v_result ->> 'id')::uuid;
  SELECT i.practice_id INTO v_practice FROM public.practice_inventory i WHERE i.id = v_id;
  INSERT INTO public.optometry_frames AS f (item_id, practice_id, brand, model, colour, size, updated_by, consignment, consignment_supplier_id, consignment_cost)
  VALUES (v_id, v_practice, v_brand, v_model, NULLIF(btrim(p_frame ->> 'colour'), ''), NULLIF(btrim(p_frame ->> 'size'), ''), auth.uid(),
          v_consignment, CASE WHEN v_consignment THEN v_supplier END, CASE WHEN v_consignment THEN v_cost END)
  ON CONFLICT (item_id) DO UPDATE SET
    brand = EXCLUDED.brand, model = EXCLUDED.model, colour = EXCLUDED.colour, size = EXCLUDED.size,
    consignment = EXCLUDED.consignment, consignment_supplier_id = EXCLUDED.consignment_supplier_id, consignment_cost = EXCLUDED.consignment_cost,
    updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN v_result;
END
$$;

-- 6b. optometry_frames_receive({practice_id, supplier_id, supplier_reference, document_date?, notes?,
--     lines: [{item_id, quantity, unit_cost (excl VAT; ignored for consignment frames), barcodes?: [..]}]}): frames
--     received from a supplier, each with its own barcode (scanned, or the practice's next numbers), through the stock
--     module's stock_receive (the delivery, its ledger lines and the payable for frames the practice owns). Any staff
--     member. Returns stock_receive's result and the frames {id, item_id, barcode}.
CREATE OR REPLACE FUNCTION public.optometry_frames_receive(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_lines jsonb := p_payload -> 'lines';
  v_line jsonb;
  v_index integer := 0;
  v_item public.practice_inventory;
  v_consignment boolean;
  v_qty integer;
  v_cost numeric;
  v_codes text[];
  v_code text;
  v_stock_lines jsonb := '[]'::jsonb;
  v_units uuid[] := ARRAY[]::uuid[];
  v_unit uuid;
  v_result jsonb;
  v_today date := public.optometry_today();
  v_actor uuid := public.optometry_actor();
BEGIN
  PERFORM public.stock_assert_role(v_practice, NULL, 'record deliveries');
  IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'A delivery of frames has 1 to 100 lines' USING ERRCODE = '22023';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_index := v_index + 1;
    SELECT * INTO v_item FROM public.practice_inventory WHERE id = NULLIF(v_line ->> 'item_id', '')::uuid AND practice_id = v_practice FOR UPDATE;
    IF NOT FOUND OR NOT public.optometry_is_frame_item(v_item.id) THEN
      RAISE EXCEPTION 'Line %: choose one of your practice''s frames', v_index USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(f.consignment, false) INTO v_consignment FROM public.optometry_frames f WHERE f.item_id = v_item.id;
    v_consignment := COALESCE(v_consignment, false);
    v_qty := public.stock_int(v_line -> 'quantity', format('Line %s: the number of frames', v_index), 1, 500);
    v_cost := CASE WHEN v_consignment THEN 0
                   ELSE public.stock_amount(COALESCE(v_line -> 'unit_cost', '0'::jsonb), format('Line %s: the cost per frame', v_index), 1000000) END;
    v_codes := ARRAY(SELECT btrim(c) FROM jsonb_array_elements_text(COALESCE(v_line -> 'barcodes', '[]'::jsonb)) AS c WHERE btrim(c) <> '');
    IF cardinality(v_codes) > 0 AND cardinality(v_codes) <> v_qty THEN
      RAISE EXCEPTION 'Line %: % barcodes for % frames. Scan one per frame, or none for the practice''s own numbers.', v_index, cardinality(v_codes), v_qty
        USING ERRCODE = '22023';
    END IF;
    -- The frames first, so the ledger finds them on the shelf when the delivery is recorded
    FOR i IN 1..v_qty LOOP
      v_code := CASE WHEN cardinality(v_codes) > 0 THEN v_codes[i] ELSE public.optometry_next_frame_barcode(v_practice) END;
      IF v_code !~ '^[A-Za-z0-9][A-Za-z0-9-]{3,39}$' THEN
        RAISE EXCEPTION 'Line %: % is not a barcode (letters, digits and dashes, 4 to 40)', v_index, v_code USING ERRCODE = '22023';
      END IF;
      IF public.optometry_barcode_taken(v_practice, v_code, v_item.id) THEN
        RAISE EXCEPTION 'Barcode % is already used in your practice', v_code USING ERRCODE = '23505';
      END IF;
      INSERT INTO public.optometry_frame_units (practice_id, item_id, barcode, status, status_on, status_changed_by, created_by)
      VALUES (v_practice, v_item.id, v_code, 'in_stock', v_today, v_actor, v_actor)
      RETURNING id INTO v_unit;
      v_units := v_units || v_unit;
    END LOOP;
    v_stock_lines := v_stock_lines || jsonb_build_array(jsonb_build_object('item_id', v_item.id, 'quantity', v_qty, 'line_cost', round(v_qty * v_cost, 2)));
  END LOOP;

  v_result := public.stock_receive(jsonb_build_object(
    'practice_id', v_practice, 'supplier_id', p_payload -> 'supplier_id', 'supplier_reference', p_payload -> 'supplier_reference',
    'document_date', p_payload -> 'document_date', 'notes', p_payload -> 'notes', 'lines', v_stock_lines));
  UPDATE public.optometry_frame_units u SET received_delivery_id = (v_result ->> 'id')::uuid WHERE u.id = ANY (v_units);
  INSERT INTO public.optometry_frame_unit_events (unit_id, practice_id, status, reason, delivery_id, happened_on, changed_by)
  SELECT u.id, u.practice_id, 'in_stock', 'Delivery ' || (v_result ->> 'number'), (v_result ->> 'id')::uuid, v_today, v_actor
    FROM public.optometry_frame_units u WHERE u.id = ANY (v_units);
  RETURN v_result || jsonb_build_object('units', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', u.id, 'item_id', u.item_id, 'barcode', u.barcode) ORDER BY u.created_at, u.barcode), '[]'::jsonb)
      FROM public.optometry_frame_units u WHERE u.id = ANY (v_units)));
END $$;

-- 6c. optometry_frame_units_add(item, count?, barcodes?): barcodes for frames already on the shelf without one (the
--     ledger has more on the shelf than there are barcodes): the barcodes scanned, or the practice's next numbers.
--     Any staff member. Returns the frames {id, item_id, barcode}.
CREATE OR REPLACE FUNCTION public.optometry_frame_units_add(p_item_id uuid, p_count integer, p_barcodes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.practice_inventory;
  v_short integer;
  v_codes text[] := ARRAY(SELECT btrim(c) FROM jsonb_array_elements_text(COALESCE(p_barcodes, '[]'::jsonb)) AS c WHERE btrim(c) <> '');
  v_count integer;
  v_code text;
  v_unit public.optometry_frame_units;
  v_units uuid[] := ARRAY[]::uuid[];
  v_actor uuid := public.optometry_actor();
  v_today date := public.optometry_today();
BEGIN
  SELECT * INTO v_item FROM public.practice_inventory WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Frame not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.stock_assert_role(v_item.practice_id, NULL, 'label frames');
  IF NOT public.optometry_is_frame_item(p_item_id) THEN
    RAISE EXCEPTION '% is not a frame' , v_item.name USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('optometry_frame_units'), hashtext(p_item_id::text));
  SELECT GREATEST(COALESCE(SUM(m.quantity), 0), 0) INTO v_short FROM public.stock_movements m WHERE m.item_id = p_item_id;
  v_short := v_short - (SELECT count(*) FROM public.optometry_frame_units u WHERE u.item_id = p_item_id AND u.status IN ('in_stock', 'reserved'));
  v_count := CASE WHEN cardinality(v_codes) > 0 THEN cardinality(v_codes) ELSE COALESCE(p_count, v_short) END;
  IF v_count < 1 OR v_count > v_short THEN
    RAISE EXCEPTION '% frame(s) on the shelf have no barcode', GREATEST(v_short, 0) USING ERRCODE = '22023';
  END IF;
  FOR i IN 1..v_count LOOP
    v_code := CASE WHEN cardinality(v_codes) > 0 THEN v_codes[i] ELSE public.optometry_next_frame_barcode(v_item.practice_id) END;
    IF v_code !~ '^[A-Za-z0-9][A-Za-z0-9-]{3,39}$' THEN
      RAISE EXCEPTION '% is not a barcode (letters, digits and dashes, 4 to 40)', v_code USING ERRCODE = '22023';
    END IF;
    IF public.optometry_barcode_taken(v_item.practice_id, v_code, p_item_id) THEN
      RAISE EXCEPTION 'Barcode % is already used in your practice', v_code USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.optometry_frame_units (practice_id, item_id, barcode, status, status_on, status_changed_by, created_by)
    VALUES (v_item.practice_id, p_item_id, v_code, 'in_stock', v_today, v_actor, v_actor)
    RETURNING * INTO v_unit;
    PERFORM public.optometry_frame_unit_log(v_unit, NULL, 'Barcode given to a frame on the shelf', NULL, NULL, v_today);
    v_units := v_units || v_unit.id;
  END LOOP;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', u.id, 'item_id', u.item_id, 'barcode', u.barcode) ORDER BY u.created_at, u.barcode), '[]'::jsonb)
            FROM public.optometry_frame_units u WHERE u.id = ANY (v_units));
END $$;

-- 6d. optometry_frame_unit_act(frame, action, {note?, reason_code?, patient_id?, user_id?}):
--     hold (put aside, with who it is for), release (back on the shelf): any staff member;
--     lost (lost or damaged, with what happened), found, seller (the salesperson of a sold frame): practice admins and
--     practitioners. Lost and found change the stock count (stock_adjust) unless the ledger already has the frame
--     off or on the shelf.
CREATE OR REPLACE FUNCTION public.optometry_frame_unit_act(p_unit_id uuid, p_action text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit public.optometry_frame_units;
  v_from text;
  v_note text := NULLIF(btrim(COALESCE(p_payload ->> 'note', '')), '');
  v_code text := NULLIF(p_payload ->> 'reason_code', '');
  v_patient uuid := NULLIF(p_payload ->> 'patient_id', '')::uuid;
  v_seller uuid := NULLIF(p_payload ->> 'user_id', '')::uuid;
  v_on_hand integer;
  v_units integer;
  v_today date := public.optometry_today();
  v_actor uuid := public.optometry_actor();
  v_reason text;
BEGIN
  SELECT * INTO v_unit FROM public.optometry_frame_units WHERE id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Frame not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('optometry_frame_units'), hashtext(v_unit.item_id::text));
  v_from := v_unit.status;
  IF char_length(COALESCE(v_note, '')) > 200 THEN
    RAISE EXCEPTION 'Keep the note to 200 characters' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(SUM(m.quantity), 0) INTO v_on_hand FROM public.stock_movements m WHERE m.item_id = v_unit.item_id;
  SELECT count(*) INTO v_units FROM public.optometry_frame_units u WHERE u.item_id = v_unit.item_id AND u.status IN ('in_stock', 'reserved');

  IF p_action = 'hold' THEN
    PERFORM public.stock_assert_role(v_unit.practice_id, NULL, 'put frames aside');
    IF v_from <> 'in_stock' THEN
      RAISE EXCEPTION 'Only a frame on the shelf can be put aside' USING ERRCODE = '22023';
    END IF;
    IF v_note IS NULL THEN
      RAISE EXCEPTION 'Say who the frame is put aside for, e.g. "Mrs N, until Friday"' USING ERRCODE = '22023';
    END IF;
    IF v_patient IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = v_patient AND p.practice_id = v_unit.practice_id) THEN
      RAISE EXCEPTION 'That patient is not a patient of your practice' USING ERRCODE = '42501';
    END IF;
    UPDATE public.optometry_frame_units u SET status = 'reserved', patient_id = v_patient, note = v_note, status_on = v_today,
           status_changed_by = v_actor, status_changed_at = clock_timestamp()
     WHERE u.id = p_unit_id RETURNING u.* INTO v_unit;
    v_reason := 'Put aside: ' || v_note;
  ELSIF p_action = 'release' THEN
    PERFORM public.stock_assert_role(v_unit.practice_id, NULL, 'put frames back on the shelf');
    IF v_from <> 'reserved' THEN
      RAISE EXCEPTION 'Only a reserved frame can go back on the shelf' USING ERRCODE = '22023';
    END IF;
    UPDATE public.optometry_frame_units u SET status = 'in_stock', patient_id = NULL, lab_order_id = NULL, note = NULL, status_on = v_today,
           status_changed_by = v_actor, status_changed_at = clock_timestamp()
     WHERE u.id = p_unit_id RETURNING u.* INTO v_unit;
    v_reason := COALESCE('Back on the shelf: ' || v_note, 'Back on the shelf');
  ELSIF p_action = 'lost' THEN
    PERFORM public.stock_assert_role(v_unit.practice_id, ARRAY['admin', 'doctor'], 'write frames off');
    IF v_from NOT IN ('in_stock', 'reserved') THEN
      RAISE EXCEPTION 'Only a frame in the practice can be written off' USING ERRCODE = '22023';
    END IF;
    IF v_code IS NULL OR v_code NOT IN ('lost', 'damaged') THEN
      RAISE EXCEPTION 'Choose lost or damaged' USING ERRCODE = '22023';
    END IF;
    IF v_note IS NULL OR char_length(v_note) < 3 THEN
      RAISE EXCEPTION 'Describe what happened (it is kept with the frame)' USING ERRCODE = '22023';
    END IF;
    UPDATE public.optometry_frame_units u SET status = 'written_off', patient_id = NULL, lab_order_id = NULL, note = v_note, status_on = v_today,
           status_changed_by = v_actor, status_changed_at = clock_timestamp()
     WHERE u.id = p_unit_id RETURNING u.* INTO v_unit;
    -- Off the shelf in the ledger too, unless the ledger already has it off (a write-off on the Stock page)
    IF v_units <= GREATEST(v_on_hand, 0) THEN
      PERFORM public.stock_adjust(jsonb_build_object('practice_id', v_unit.practice_id, 'item_id', v_unit.item_id, 'quantity', -1,
        'reason_code', v_code, 'reason', left(v_unit.barcode || ': ' || v_note, 300)));
    END IF;
    v_reason := CASE v_code WHEN 'lost' THEN 'Lost: ' ELSE 'Damaged: ' END || v_note;
  ELSIF p_action = 'found' THEN
    PERFORM public.stock_assert_role(v_unit.practice_id, ARRAY['admin', 'doctor'], 'put found frames back into stock');
    IF v_from <> 'written_off' THEN
      RAISE EXCEPTION 'Only a frame written off can be found' USING ERRCODE = '22023';
    END IF;
    UPDATE public.optometry_frame_units u SET status = 'in_stock', note = NULL, status_on = v_today,
           status_changed_by = v_actor, status_changed_at = clock_timestamp()
     WHERE u.id = p_unit_id RETURNING u.* INTO v_unit;
    -- On the shelf in the ledger too, unless the ledger already has it (found at a count on the Stock page)
    IF v_units >= GREATEST(v_on_hand, 0) THEN
      PERFORM public.stock_adjust(jsonb_build_object('practice_id', v_unit.practice_id, 'item_id', v_unit.item_id, 'quantity', 1,
        'reason_code', 'found', 'reason', left(v_unit.barcode || ': ' || COALESCE(v_note, 'found again'), 300)));
    END IF;
    v_reason := COALESCE('Found: ' || v_note, 'Found');
  ELSIF p_action = 'seller' THEN
    PERFORM public.stock_assert_role(v_unit.practice_id, ARRAY['admin', 'doctor'], 'change who sold a frame');
    IF v_from <> 'sold' THEN
      RAISE EXCEPTION 'Only a sold frame has a salesperson' USING ERRCODE = '22023';
    END IF;
    IF v_seller IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_seller AND u.practice_id = v_unit.practice_id) THEN
      RAISE EXCEPTION 'Choose a staff member of your practice' USING ERRCODE = '22023';
    END IF;
    UPDATE public.optometry_frame_units u SET sold_by = v_seller WHERE u.id = p_unit_id RETURNING u.* INTO v_unit;
    v_reason := 'Salesperson changed to ' || COALESCE((SELECT u.full_name FROM public.users u WHERE u.id = v_seller), 'another staff member');
  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action USING ERRCODE = '22023';
  END IF;
  PERFORM public.optometry_frame_unit_log(v_unit, v_from, v_reason, NULL, NULL, v_today);
  RETURN jsonb_build_object('id', v_unit.id, 'status', v_unit.status);
END $$;

-- 6e. optometry_frame_units_return({practice_id, supplier_id, supplier_reference, reason, unit_ids}): the frames go
--     back to the supplier on one return note, through stock_return_to_supplier (the ledger and the supplier's credit).
--     Any staff member. Returns stock_return_to_supplier's result.
CREATE OR REPLACE FUNCTION public.optometry_frame_units_return(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_ids uuid[] := ARRAY(SELECT DISTINCT NULLIF(x, '')::uuid FROM jsonb_array_elements_text(COALESCE(p_payload -> 'unit_ids', '[]'::jsonb)) AS x WHERE NULLIF(x, '') IS NOT NULL);
  v_reason text := NULLIF(btrim(COALESCE(p_payload ->> 'reason', '')), '');
  v_found integer;
  v_lines jsonb;
  v_result jsonb;
  v_today date := public.optometry_today();
  v_actor uuid := public.optometry_actor();
  v_unit public.optometry_frame_units;
  v_from text;
BEGIN
  PERFORM public.stock_assert_role(v_practice, NULL, 'return stock to a supplier');
  IF cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'Scan or choose the frames that go back' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Say why the frames go back (for example "slow sellers" or "damaged")' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_found FROM public.optometry_frame_units u
   WHERE u.id = ANY (v_ids) AND u.practice_id = v_practice AND u.status IN ('in_stock', 'reserved');
  IF v_found <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Only frames of your practice that are in stock or reserved can go back' USING ERRCODE = '22023';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('item_id', t.item_id, 'quantity', t.quantity)) INTO v_lines
    FROM (SELECT u.item_id, count(*)::integer AS quantity FROM public.optometry_frame_units u WHERE u.id = ANY (v_ids) GROUP BY u.item_id) t;
  -- The frames first, so the ledger does not pick others when the return is recorded
  FOR v_unit IN SELECT u.* FROM public.optometry_frame_units u WHERE u.id = ANY (v_ids) ORDER BY u.barcode FOR UPDATE LOOP
    UPDATE public.optometry_frame_units u SET status = 'returned', patient_id = NULL, lab_order_id = NULL, note = left(v_reason, 200),
           status_on = v_today, status_changed_by = v_actor, status_changed_at = clock_timestamp()
     WHERE u.id = v_unit.id;
  END LOOP;
  v_result := public.stock_return_to_supplier(jsonb_build_object(
    'practice_id', v_practice, 'supplier_id', p_payload -> 'supplier_id', 'supplier_reference', p_payload -> 'supplier_reference',
    'reason', v_reason, 'lines', v_lines));
  FOR v_unit IN SELECT u.* FROM public.optometry_frame_units u WHERE u.id = ANY (v_ids) ORDER BY u.barcode LOOP
    UPDATE public.optometry_frame_units u SET returned_delivery_id = (v_result ->> 'id')::uuid WHERE u.id = v_unit.id RETURNING u.* INTO v_unit;
    v_from := (SELECT e.status FROM public.optometry_frame_unit_events e WHERE e.unit_id = v_unit.id ORDER BY e.changed_at DESC, e.id DESC LIMIT 1);
    PERFORM public.optometry_frame_unit_log(v_unit, v_from, 'Return ' || (v_result ->> 'number') || ': ' || v_reason, (v_result ->> 'id')::uuid, NULL, v_today);
  END LOOP;
  RETURN v_result;
END $$;

-- 6f. optometry_consignment_settle({practice_id, supplier_id, supplier_reference, document_date?, line_ids}): the
--     supplier's invoice for consignment frames sold becomes its payable (Finance > Ledgers > Expenses), as a
--     delivery's does, and the lines are settled. Any staff member.
CREATE OR REPLACE FUNCTION public.optometry_consignment_settle(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practice uuid := NULLIF(p_payload ->> 'practice_id', '')::uuid;
  v_supplier public.stock_suppliers;
  v_reference text := NULLIF(btrim(COALESCE(p_payload ->> 'supplier_reference', '')), '');
  v_date date := COALESCE(NULLIF(p_payload ->> 'document_date', '')::date, public.optometry_today());
  v_ids uuid[] := ARRAY(SELECT DISTINCT NULLIF(x, '')::uuid FROM jsonb_array_elements_text(COALESCE(p_payload -> 'line_ids', '[]'::jsonb)) AS x WHERE NULLIF(x, '') IS NOT NULL);
  v_found integer;
  v_frames integer;
  v_total numeric;
  v_expense uuid;
BEGIN
  PERFORM public.stock_assert_role(v_practice, NULL, 'record supplier invoices');
  SELECT * INTO v_supplier FROM public.stock_suppliers WHERE id = NULLIF(p_payload ->> 'supplier_id', '')::uuid AND practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose the supplier' USING ERRCODE = '22023';
  END IF;
  IF v_reference IS NULL OR char_length(v_reference) > 60 THEN
    RAISE EXCEPTION 'Type the number on the supplier''s invoice (up to 60 characters)' USING ERRCODE = '22023';
  END IF;
  IF v_date > public.optometry_today() THEN
    RAISE EXCEPTION 'The invoice cannot be dated in the future' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.optometry_consignment_lines l WHERE l.practice_id = v_practice AND l.supplier_id = v_supplier.id
                AND lower(l.supplier_reference) = lower(v_reference)) THEN
    RAISE EXCEPTION 'Invoice % from % is already recorded', v_reference, v_supplier.name USING ERRCODE = '23505';
  END IF;
  SELECT count(*), COALESCE(SUM(l.quantity), 0), COALESCE(SUM(l.quantity * l.cost_each + round(l.quantity * l.cost_each * l.vat_rate / 100, 2)), 0)
    INTO v_found, v_frames, v_total
    FROM public.optometry_consignment_lines l
   WHERE l.id = ANY (v_ids) AND l.practice_id = v_practice AND l.supplier_id = v_supplier.id AND l.settled_at IS NULL;
  IF cardinality(v_ids) = 0 OR v_found <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Choose lines of this supplier that are not settled yet' USING ERRCODE = '22023';
  END IF;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Nothing is owed on these lines' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.practice_expenses (practice_id, expense_type, expense_category, name, description, amount, currency, payment_frequency,
                                        vendor_name, vendor_contact, account_number, expense_date, due_date, status, is_recurring, is_active,
                                        created_by, updated_by)
  VALUES (v_practice, 'supplies', 'one_time', left('Consignment frames sold, from ' || v_supplier.name, 255),
          'Supplier invoice ' || v_reference || ' for ' || v_frames || ' consignment frame(s) sold. Recorded by Optometry > Reports > Consignment.',
          v_total, 'NAD', 'once_off', left(v_supplier.name, 255), left(COALESCE(v_supplier.phone, v_supplier.email), 255),
          left(v_supplier.account_number, 255), v_date, v_date + v_supplier.payment_terms_days, 'pending', false, true,
          auth.uid(), auth.uid())
  RETURNING id INTO v_expense;
  UPDATE public.optometry_consignment_lines l
     SET settled_at = now(), settled_by = public.optometry_actor(), expense_id = v_expense, supplier_reference = v_reference
   WHERE l.id = ANY (v_ids);
  RETURN jsonb_build_object('expense_id', v_expense, 'total_incl_vat', v_total, 'frames', v_frames);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Barcodes for the frames already on the shelf
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_item record;
  v_unit public.optometry_frame_units;
BEGIN
  FOR v_item IN
    SELECT i.id, i.practice_id,
           (GREATEST(COALESCE((SELECT SUM(m.quantity) FROM public.stock_movements m WHERE m.item_id = i.id), 0), 0)
             - (SELECT count(*) FROM public.optometry_frame_units u WHERE u.item_id = i.id AND u.status IN ('in_stock', 'reserved')))::integer AS missing
      FROM public.practice_inventory i
     WHERE public.optometry_is_frame_item(i.id)
  LOOP
    FOR i IN 1..GREATEST(v_item.missing, 0) LOOP
      INSERT INTO public.optometry_frame_units (practice_id, item_id, barcode, status, status_on)
      VALUES (v_item.practice_id, v_item.id, public.optometry_next_frame_barcode(v_item.practice_id), 'in_stock', public.optometry_today())
      RETURNING * INTO v_unit;
      PERFORM public.optometry_frame_unit_log(v_unit, NULL, 'Barcode given when frame barcodes were introduced', NULL, NULL, NULL);
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Row level security and grants: active staff of the practice read; nobody writes except through the functions
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.optometry_frame_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_frame_unit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_frame_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optometry_consignment_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS optometry_frame_units_staff_read ON public.optometry_frame_units;
CREATE POLICY optometry_frame_units_staff_read ON public.optometry_frame_units FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_frame_units.practice_id));

DROP POLICY IF EXISTS optometry_frame_unit_events_staff_read ON public.optometry_frame_unit_events;
CREATE POLICY optometry_frame_unit_events_staff_read ON public.optometry_frame_unit_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_frame_unit_events.practice_id));

DROP POLICY IF EXISTS optometry_consignment_lines_staff_read ON public.optometry_consignment_lines;
CREATE POLICY optometry_consignment_lines_staff_read ON public.optometry_consignment_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = optometry_consignment_lines.practice_id));

REVOKE ALL ON public.optometry_frame_units, public.optometry_frame_unit_events, public.optometry_frame_counters,
  public.optometry_consignment_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.optometry_frame_units, public.optometry_frame_unit_events, public.optometry_consignment_lines TO authenticated;
GRANT ALL ON public.optometry_frame_units, public.optometry_frame_unit_events, public.optometry_frame_counters,
  public.optometry_consignment_lines TO service_role;
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', pg_get_serial_sequence('public.optometry_frame_unit_events', 'id'));
END
$$;

-- Internal: the helpers, the ledger's and the lab orders' triggers
REVOKE ALL ON FUNCTION public.optometry_actor(), public.optometry_is_frame_item(uuid), public.optometry_barcode_taken(uuid, text, uuid),
  public.optometry_next_frame_barcode(uuid), public.optometry_frame_unit_log(public.optometry_frame_units, text, text, uuid, uuid, date),
  public.optometry_frame_units_follow(public.stock_movements), public.optometry_frames_after_movement(),
  public.optometry_frames_after_lab_order() FROM PUBLIC, anon, authenticated;
-- Pure helpers the table checks and the exam function use (the service role writes directly)
REVOKE ALL ON FUNCTION public.optometry_text_list(jsonb), public.optometry_json_object(jsonb), public.optometry_ocular_health_ok(jsonb),
  public.optometry_cl_fit_ok(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.optometry_text_list(jsonb), public.optometry_json_object(jsonb), public.optometry_ocular_health_ok(jsonb),
  public.optometry_cl_fit_ok(jsonb) TO authenticated, service_role;
-- What the app calls (optometry_save_exam and optometry_save_frame keep the grants of the optometry file)
REVOKE ALL ON FUNCTION public.optometry_frames_receive(jsonb), public.optometry_frame_units_add(uuid, integer, jsonb),
  public.optometry_frame_unit_act(uuid, text, jsonb), public.optometry_frame_units_return(jsonb), public.optometry_consignment_settle(jsonb),
  public.optometry_lab_order_costs(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.optometry_frames_receive(jsonb), public.optometry_frame_units_add(uuid, integer, jsonb),
  public.optometry_frame_unit_act(uuid, text, jsonb), public.optometry_frame_units_return(jsonb), public.optometry_consignment_settle(jsonb),
  public.optometry_lab_order_costs(uuid, jsonb) TO authenticated, service_role;

-- The patient app's logins get nothing here (as on every OneHealth table), once the portal is set up
DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regprocedure('public.portal_is_staff()') IS NOT NULL THEN
    FOREACH v_table IN ARRAY ARRAY['optometry_frame_units', 'optometry_frame_unit_events', 'optometry_frame_counters', 'optometry_consignment_lines'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS portal_staff_only ON public.%I', v_table);
      EXECUTE format('CREATE POLICY portal_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                     'USING ((SELECT public.portal_is_staff())) WITH CHECK ((SELECT public.portal_is_staff()))', v_table);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 9. Checks
-- ---------------------------------------------------------------------------------------------

-- 9a. Structure: row level security on, one staff read policy per readable table, nothing for anon, the triggers in
--     place, internal functions closed, the checks accept what the app sends and refuse the rest
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['optometry_frame_units', 'optometry_frame_unit_events', 'optometry_consignment_lines'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', t)::regclass) THEN
      RAISE EXCEPTION '%: row level security is off', t;
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_staff_read') <> 1 THEN
      RAISE EXCEPTION '%: the staff read policy is missing', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND 'anon' = ANY (roles))
       OR has_table_privilege('anon', format('public.%I', t), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', t), 'DELETE') THEN
      RAISE EXCEPTION '%: signed-in users must read only, anon nothing', t;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.optometry_frame_counters', 'SELECT') THEN
    RAISE EXCEPTION 'optometry_frame_counters must stay internal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.stock_movements'::regclass AND tgname = 'zz_optometry_frames' AND tgenabled = 'O')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.optometry_lab_orders'::regclass AND tgname = 'zz_optometry_frame_units' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'the frame triggers are missing or disabled';
  END IF;
  IF has_function_privilege('authenticated', 'public.optometry_frame_units_follow(public.stock_movements)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.optometry_next_frame_barcode(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.optometry_frames_receive(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.optometry_consignment_settle(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.optometry_frame_unit_act(uuid, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'optometry frame functions: internal ones are closed, the app''s open to staff, anon gets none';
  END IF;
  IF NOT public.optometry_ocular_health_ok('{"disc": {"r": "abnormal", "l": "normal", "note": "Notched rim"}, "lens": {"r": "normal"}}')
     OR public.optometry_ocular_health_ok('{"disc": {"r": "abnormal"}}')
     OR public.optometry_ocular_health_ok('{"nose": {"r": "normal"}}')
     OR public.optometry_ocular_health_ok('{"disc": {"r": null}}')
     OR NOT public.optometry_cl_fit_ok('{"r": {"movement": "tight", "comfort": "good"}}')
     OR public.optometry_cl_fit_ok('{"r": {"movement": "wobbly"}}')
     OR public.optometry_text_list('[]') IS NOT NULL
     OR public.optometry_text_list('["headaches"]') <> ARRAY['headaches'] THEN
    RAISE EXCEPTION 'the exam checks do not accept what the app sends';
  END IF;
END $$;

-- 9b. Behaviour, as signed-in users of one practice with a patient and a visit (an admin or practitioner, and
--     reception when there is one), staff of another practice and the anon key. Runs inside a block that undoes
--     itself: nothing is left behind.
DO $$
DECLARE
  v_practice uuid;
  v_clinician uuid;
  v_receptionist uuid;
  v_other uuid;
  v_patient uuid;
  v_visit uuid;
  v_supplier uuid;
  v_frame uuid;
  v_consigned uuid;
  v_result jsonb;
  v_rx uuid;
  v_order uuid;
  v_unit uuid;
  v_count integer;
  v_text text;
  v_today date := public.optometry_today();
  v_line uuid := gen_random_uuid();
BEGIN
  SELECT u.practice_id, u.id INTO v_practice, v_clinician
  FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.role IN ('admin', 'doctor') AND u.practice_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.visits v JOIN public.patients p ON p.id = v.patient_id WHERE p.practice_id = u.practice_id)
  ORDER BY u.role, u.id
  LIMIT 1;
  SELECT v.patient_id, v.id INTO v_patient, v_visit
  FROM public.visits v JOIN public.patients p ON p.id = v.patient_id
  WHERE p.practice_id = v_practice
  ORDER BY v.id
  LIMIT 1;
  SELECT u.id INTO v_receptionist FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.role = 'receptionist' AND u.practice_id = v_practice ORDER BY u.id LIMIT 1;
  SELECT u.id INTO v_other FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.practice_id IS NOT NULL AND u.practice_id <> v_practice ORDER BY u.id LIMIT 1;
  IF v_visit IS NULL OR v_other IS NULL THEN
    RAISE NOTICE 'No practice with a practitioner, a visit and staff elsewhere: behaviour checks skipped';
    RETURN;
  END IF;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_clinician, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    -- The full exam is saved and an older screen's save keeps it
    v_result := public.optometry_save_exam(jsonb_build_object('visit_id', v_visit, 'history_reason', 'Check: headaches',
      'history_symptoms', jsonb_build_array('headaches'), 'k_r_flat', 43.25, 'k_r_flat_axis', 180, 'k_r_steep', 44.5, 'k_r_steep_axis', 90,
      'ocular_health', jsonb_build_object('disc', jsonb_build_object('r', 'normal', 'l', 'normal')), 'cd_ratio_r', 0.3,
      'refraction', jsonb_build_object('right', jsonb_build_object('sphere', -1), 'left', jsonb_build_object('sphere', -1))));
    v_rx := (v_result ->> 'spectacles')::uuid;
    PERFORM public.optometry_save_exam(jsonb_build_object('visit_id', v_visit, 'notes', 'Check: saved by an older screen',
      'refraction', jsonb_build_object('right', jsonb_build_object('sphere', -1), 'left', jsonb_build_object('sphere', -1))));
    SELECT history_reason || '|' || k_r_steep || '|' || cd_ratio_r INTO v_text FROM public.optometry_exams WHERE visit_id = v_visit;
    IF v_text IS DISTINCT FROM 'Check: headaches|44.50|0.30' THEN
      RAISE EXCEPTION 'check failed: the full exam was not kept (%)', COALESCE(v_text, 'nothing');
    END IF;
    BEGIN
      PERFORM public.optometry_save_exam(jsonb_build_object('visit_id', v_visit, 'k_l_flat', 45, 'k_l_flat_axis', 90, 'k_l_steep', 43, 'k_l_steep_axis', 180));
      RAISE EXCEPTION 'check failed: a flat reading above the steep one was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- A frame added with 2 on the shelf gets 2 barcodes of the practice's own
    v_supplier := (public.stock_save_supplier(jsonb_build_object('practice_id', v_practice, 'name', 'Check frame supplier')) ->> 'id')::uuid;
    v_frame := (public.optometry_save_frame(
      jsonb_build_object('practice_id', v_practice, 'name', 'Check Frame C1 Black', 'unit', 'each', 'unit_cost', 300, 'opening_quantity', 2,
                         'preferred_supplier_id', v_supplier),
      jsonb_build_object('brand', 'Check Frame', 'model', 'C1', 'colour', 'Black')) ->> 'id')::uuid;
    SELECT count(*) INTO v_count FROM public.optometry_frame_units WHERE item_id = v_frame AND status = 'in_stock' AND barcode LIKE 'FR%';
    IF v_count <> 2 THEN
      RAISE EXCEPTION 'check failed: a frame added with 2 on the shelf has % barcodes', v_count;
    END IF;

    -- Received with their own barcodes: 2 more, the delivery and its payable
    v_result := public.optometry_frames_receive(jsonb_build_object('practice_id', v_practice, 'supplier_id', v_supplier, 'supplier_reference', 'CHK-DN-1',
      'lines', jsonb_build_array(jsonb_build_object('item_id', v_frame, 'quantity', 2, 'unit_cost', 300, 'barcodes', jsonb_build_array('CHK-0001', 'CHK-0002')))));
    IF (v_result ->> 'expense_id') IS NULL OR jsonb_array_length(v_result -> 'units') <> 2
       OR (SELECT count(*) FROM public.optometry_frame_units WHERE item_id = v_frame AND status = 'in_stock') <> 4
       OR (SELECT quantity FROM public.practice_inventory WHERE id = v_frame) <> 4 THEN
      RAISE EXCEPTION 'check failed: receiving frames with their barcodes (%)', v_result;
    END IF;
    BEGIN
      PERFORM public.optometry_frames_receive(jsonb_build_object('practice_id', v_practice, 'supplier_id', v_supplier, 'supplier_reference', 'CHK-DN-2',
        'lines', jsonb_build_array(jsonb_build_object('item_id', v_frame, 'quantity', 1, 'unit_cost', 300, 'barcodes', jsonb_build_array('chk-0001')))));
      RAISE EXCEPTION 'check failed: a barcode already in use was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- A lab order with the frame reserves one for the patient; cancelling it puts it back
    v_order := (public.optometry_lab_order_save(jsonb_build_object('prescription_id', v_rx, 'visit_id', v_visit, 'eyes', 'both',
      'lens_type', 'single_vision', 'material', 'cr39', 'pd_right', 31, 'pd_left', 31, 'frame_item_id', v_frame)) ->> 'id')::uuid;
    SELECT id INTO v_unit FROM public.optometry_frame_units WHERE lab_order_id = v_order AND status = 'reserved' AND patient_id = v_patient;
    IF v_unit IS NULL THEN
      RAISE EXCEPTION 'check failed: the lab order did not reserve a frame';
    END IF;

    -- Sold on an invoice line, as the stock module writes it (its functions write the ledger, so the check does too,
    -- as the database owner): the reserved frame is the one sold, by who reserved it
    PERFORM set_config('role', 'none', true);
    INSERT INTO public.stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, invoice_id, invoice_line_id, patient_id)
    VALUES (v_practice, v_frame, 'sold', -1, -300, v_today, 'CHK-INV', gen_random_uuid(), v_line, v_patient);
    PERFORM set_config('role', 'authenticated', true);
    IF (SELECT status || '|' || COALESCE(sold_by::text, '') FROM public.optometry_frame_units WHERE id = v_unit) IS DISTINCT FROM 'sold|' || v_clinician THEN
      RAISE EXCEPTION 'check failed: the reserved frame was not the one sold';
    END IF;
    -- Taken off the invoice again while the order is open: reserved for the patient again
    PERFORM set_config('role', 'none', true);
    INSERT INTO public.stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, invoice_line_id, patient_id)
    VALUES (v_practice, v_frame, 'sale_reversed', 1, 300, v_today, 'CHK-INV', v_line, v_patient);
    PERFORM set_config('role', 'authenticated', true);
    IF (SELECT status FROM public.optometry_frame_units WHERE id = v_unit) <> 'reserved' THEN
      RAISE EXCEPTION 'check failed: a frame taken off the invoice did not go back to its order';
    END IF;
    PERFORM public.optometry_lab_order_set_status(v_order, 'cancelled', 'Check');
    IF (SELECT status FROM public.optometry_frame_units WHERE id = v_unit) <> 'in_stock' THEN
      RAISE EXCEPTION 'check failed: cancelling the order did not put the frame back';
    END IF;

    -- Job costs on the order
    PERFORM public.optometry_lab_order_costs(v_order, jsonb_build_object('lens_cost', 850.5, 'labour_cost', 150, 'lab_invoice_ref', 'CHK-LAB'));
    IF (SELECT lens_cost + labour_cost FROM public.optometry_lab_orders WHERE id = v_order) <> 1000.5 THEN
      RAISE EXCEPTION 'check failed: the job costs were not kept';
    END IF;

    -- Put aside, lost (the ledger loses one), found (gets it back)
    PERFORM public.optometry_frame_unit_act(v_unit, 'hold', jsonb_build_object('note', 'Check: for a patient until Friday'));
    PERFORM public.optometry_frame_unit_act(v_unit, 'lost', jsonb_build_object('reason_code', 'damaged', 'note', 'Check: dropped'));
    IF (SELECT quantity FROM public.practice_inventory WHERE id = v_frame) <> 3
       OR (SELECT count(*) FROM public.optometry_frame_units WHERE item_id = v_frame AND status IN ('in_stock', 'reserved')) <> 3 THEN
      RAISE EXCEPTION 'check failed: writing a frame off did not take it off the stock';
    END IF;
    PERFORM public.optometry_frame_unit_act(v_unit, 'found', '{}'::jsonb);
    IF (SELECT quantity FROM public.practice_inventory WHERE id = v_frame) <> 4 THEN
      RAISE EXCEPTION 'check failed: a frame found did not come back into stock';
    END IF;

    -- Back to the supplier: the chosen frames, one return note
    v_result := public.optometry_frame_units_return(jsonb_build_object('practice_id', v_practice, 'supplier_id', v_supplier,
      'supplier_reference', 'CHK-RET', 'reason', 'Check: slow sellers',
      'unit_ids', (SELECT jsonb_agg(id) FROM public.optometry_frame_units WHERE item_id = v_frame AND barcode IN ('CHK-0001', 'CHK-0002'))));
    IF (SELECT count(*) FROM public.optometry_frame_units WHERE item_id = v_frame AND status = 'returned' AND returned_delivery_id = (v_result ->> 'id')::uuid) <> 2
       OR (SELECT quantity FROM public.practice_inventory WHERE id = v_frame) <> 2 THEN
      RAISE EXCEPTION 'check failed: the frames did not go back to the supplier';
    END IF;

    -- Consignment: no stock value, no payable; a sale owes the agreed cost plus VAT; settling records the payable
    v_consigned := (public.optometry_save_frame(
      jsonb_build_object('practice_id', v_practice, 'name', 'Check Consigned C2', 'unit', 'each', 'preferred_supplier_id', v_supplier),
      jsonb_build_object('brand', 'Check Consigned', 'model', 'C2', 'consignment', true, 'consignment_cost', 400)) ->> 'id')::uuid;
    v_result := public.optometry_frames_receive(jsonb_build_object('practice_id', v_practice, 'supplier_id', v_supplier, 'supplier_reference', 'CHK-DN-3',
      'lines', jsonb_build_array(jsonb_build_object('item_id', v_consigned, 'quantity', 2, 'unit_cost', 999))));
    IF (v_result ->> 'expense_id') IS NOT NULL OR (SELECT total_value FROM public.practice_inventory WHERE id = v_consigned) <> 0 THEN
      RAISE EXCEPTION 'check failed: consignment frames were given a value or a payable';
    END IF;
    -- Received with a cost through the ordinary delivery: refused (it would be paid for twice)
    BEGIN
      PERFORM public.stock_receive(jsonb_build_object('practice_id', v_practice, 'supplier_id', v_supplier, 'supplier_reference', 'CHK-DN-4',
        'lines', jsonb_build_array(jsonb_build_object('item_id', v_consigned, 'quantity', 1, 'line_cost', 400))));
      RAISE EXCEPTION 'check failed: a consignment frame was received with a cost';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE 'Consignment frames belong to the supplier%' THEN
        RAISE;
      END IF;
    END;
    PERFORM set_config('role', 'none', true);
    INSERT INTO public.stock_movements (practice_id, item_id, kind, quantity, value, occurred_on, document_ref, invoice_id, invoice_line_id, patient_id)
    VALUES (v_practice, v_consigned, 'sold', -1, 0, v_today, 'CHK-INV-2', gen_random_uuid(), gen_random_uuid(), v_patient);
    PERFORM set_config('role', 'authenticated', true);
    IF (SELECT count(*) FROM public.optometry_consignment_lines WHERE item_id = v_consigned AND quantity = 1 AND cost_each = 400) <> 1 THEN
      RAISE EXCEPTION 'check failed: a consignment frame sold is not owed to the supplier';
    END IF;
    -- The salesperson of a sold frame can be changed
    SELECT id INTO v_unit FROM public.optometry_frame_units WHERE item_id = v_consigned AND status = 'sold';
    PERFORM public.optometry_frame_unit_act(v_unit, 'seller', jsonb_build_object('user_id', COALESCE(v_receptionist, v_clinician)));
    IF (SELECT sold_by FROM public.optometry_frame_units WHERE id = v_unit) IS DISTINCT FROM COALESCE(v_receptionist, v_clinician) THEN
      RAISE EXCEPTION 'check failed: the salesperson was not changed';
    END IF;
    v_result := public.optometry_consignment_settle(jsonb_build_object('practice_id', v_practice, 'supplier_id', v_supplier,
      'supplier_reference', 'CHK-SUP-INV', 'line_ids', (SELECT jsonb_agg(id) FROM public.optometry_consignment_lines WHERE item_id = v_consigned)));
    -- N$ 400 plus the practice's VAT on it
    IF (v_result ->> 'total_incl_vat')::numeric <> (SELECT 400 + round(400 * vat_rate / 100, 2) FROM public.optometry_consignment_lines WHERE item_id = v_consigned)
       OR NOT EXISTS (SELECT 1 FROM public.practice_expenses WHERE id = (v_result ->> 'expense_id')::uuid AND amount = (v_result ->> 'total_incl_vat')::numeric)
       OR EXISTS (SELECT 1 FROM public.optometry_consignment_lines WHERE item_id = v_consigned AND settled_at IS NULL) THEN
      RAISE EXCEPTION 'check failed: settling did not record the supplier''s payable (%)', v_result;
    END IF;
    BEGIN
      PERFORM public.optometry_save_frame(jsonb_build_object('id', v_consigned, 'practice_id', v_practice, 'name', 'Check Consigned C2', 'unit', 'each',
        'preferred_supplier_id', v_supplier), jsonb_build_object('brand', 'Check Consigned', 'model', 'C2', 'consignment', false));
      RAISE EXCEPTION 'check failed: a consignment frame with stock history became the practice''s own';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    -- Reception receives frames and puts one aside, but may not write one off
    IF v_receptionist IS NOT NULL THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_receptionist, 'role', 'authenticated')::text, true);
      SELECT id INTO v_unit FROM public.optometry_frame_units WHERE item_id = v_frame AND status = 'in_stock' ORDER BY barcode LIMIT 1;
      PERFORM public.optometry_frame_unit_act(v_unit, 'hold', jsonb_build_object('note', 'Check: reception'));
      BEGIN
        PERFORM public.optometry_frame_unit_act(v_unit, 'lost', jsonb_build_object('reason_code', 'lost', 'note', 'Check: missing'));
        RAISE EXCEPTION 'check failed: reception wrote a frame off';
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END IF;

    -- Direct writes are refused
    BEGIN
      INSERT INTO public.optometry_frame_units (practice_id, item_id, barcode, status_on) VALUES (v_practice, v_frame, 'CHK-9999', v_today);
      RAISE EXCEPTION 'check failed: a direct insert was accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- Staff of another practice see nothing and change nothing
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
    SELECT (SELECT count(*) FROM public.optometry_frame_units WHERE practice_id = v_practice)
         + (SELECT count(*) FROM public.optometry_frame_unit_events WHERE practice_id = v_practice)
         + (SELECT count(*) FROM public.optometry_consignment_lines WHERE practice_id = v_practice) INTO v_count;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'check failed: staff of another practice see % frame rows', v_count;
    END IF;
    BEGIN
      PERFORM public.optometry_frame_unit_act(v_unit, 'release', '{}'::jsonb);
      RAISE EXCEPTION 'check failed: staff of another practice changed a frame';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- The anon key reads nothing and runs nothing
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    PERFORM set_config('role', 'anon', true);
    BEGIN
      PERFORM count(*) FROM public.optometry_frame_units;
      RAISE EXCEPTION 'check failed: anon read frames';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.optometry_frame_unit_act(v_unit, 'release', '{}'::jsonb);
      RAISE EXCEPTION 'check failed: anon ran a frame function';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    RAISE EXCEPTION USING MESSAGE = 'optometry_frames_checks_passed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'optometry_frames_checks_passed' THEN
      RAISE;
    END IF;
  END;
  RAISE NOTICE 'optometry frames and exam checked as practitioner, reception (%), other practice and anon (test rows undone)',
    CASE WHEN v_receptionist IS NULL THEN 'none in this practice' ELSE 'yes' END;
END $$;

ROLLBACK;

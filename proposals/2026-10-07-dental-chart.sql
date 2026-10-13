-- Applied 2026-10-07 as migration dental_chart_2026_10_07
-- =============================================================================================
-- PROPOSAL, NOT APPLIED: the dental chart (what is on each tooth, what is to be done) and the
-- treatment plan that becomes a quote
-- File:    proposals/2026-10-07-dental-chart.sql                       Drafted: 2026-10-07
-- Code:    src/utils/dental/* (tooth numbers, surfaces, the state of each tooth, plan prices and rule
--          checks; unit tested), src/services/dental/dentalChartService.ts (reads and writes),
--          src/components/dental/* (patient file > Teeth; "Teeth" on a visit's Billing tab; "Teeth
--          chart" on quotes and invoices). Dental practices only (isDentalPractice, tariffRules.ts).
--
-- Why
--   Dental practices could put a tooth on a billing line, but nothing was kept per tooth and a visit's
--   treatment plan was free text. Eminance has a tooth chart: the work on each tooth marked existing
--   ("old"), defective or to do; the to-do work becomes a treatment plan with a tariff per tooth, then
--   a quote, then an invoice. The Teeth view already shows every billed line that carries a tooth
--   number (invoice_services.tooth_number) without this file, and says charting is not set up yet.
--   This file adds what is recorded on the chart and the plan.
--
-- This script has NOT been run against any database. It runs inside a transaction that ends in
-- ROLLBACK, so running it by mistake leaves nothing behind.
--
-- How to apply
--   1. Review. Run the whole file once as it is (Supabase SQL editor, or a branch first). It must
--      finish without an error; the last check reports "dental chart ready".
--   2. Change the final ROLLBACK to COMMIT and run it again.
--   3. Nothing to deploy. If the Teeth view still says "not set up yet" a minute later, run:
--        NOTIFY pgrst, 'reload schema';
--   Order: after proposals/2026-10-07-quotes-and-bundles.sql (plan items link to quotes) and BEFORE
--   proposals/2026-10-07-patient-portal.sql (scripts/db/rehearsal.ts DEFAULT_ORDER), so the portal's
--   staff-only guard covers these tables. Where the portal file is already applied, section 5 runs
--   the guard again.
--
-- Rehearsed 2026-10-08 on the live database inside one transaction that was rolled back (checked
-- afterwards: no table, function or quote was left). Section 6's checks passed. As simulated sign-ins
-- (counts only):
--   practitioner of a dental practice: 3 entries added (an existing filling, a planned crown, a
--     planned extraction), 1 marked defective, 2 plan items put on a quote; sees 3 entries and 6 audit
--     lines; a direct INSERT or UPDATE on the table is refused (42501)
--   receptionist of that practice: sees the 3 entries and arranges the plan (1 moved); recording
--     clinical work is refused (42501)
--   staff of another practice: sees 0 entries and 0 audit lines; changing a status or linking a quote
--     is refused (42501)
--   a signed-in login without a staff profile: sees 0 and 0; adding is refused. The anon key: reading
--     and the functions are refused (42501)
--   policies on the two tables: 1 staff read policy each, plus the portal's staff-only guard on each
--
-- What is stored (one row per thing said about a tooth; nothing is ever deleted)
--   - dental_chart_entries: a tooth (FDI number), the work (filling, crown, root canal, implant,
--     bridge, extraction, missing, or other planned work), the surfaces of a filling, and a status:
--       existing   found at an examination (done before, or elsewhere)
--       defective  existing work that needs attention
--       planned    to do: with its tariff code, its planned visit (1, 2, 3 ...) and its order there
--       done       planned work marked done by hand
--       removed    taken off the plan (the patient declined, the plan changed)
--     Billed work is NOT copied here: the app reads the invoice lines with tooth numbers. Planned work
--     whose code was billed on its tooth on or after the day it was planned (or on the invoice its
--     quote became) shows as done without anyone ticking it off, and a cancelled invoice puts it back.
--     visit_id: the visit it was recorded or done at. quote_id: the quote the planned work was put on.
--     invoice_id: the invoice of the visit it was marked done at; the line is the one with this
--     entry's code and tooth (invoice lines get new ids each time a visit's billing is saved again,
--     so a link to a line id would break).
--   - dental_chart_changes: the audit trail, insert only: who recorded each entry and when, every
--     status change, the quote a plan item was put on, and "entered in error" with its reason.
--   A mistake is marked "entered in error" (voided_at, voided_by, void_reason): the entry stays in the
--   tooth's history, crossed out. Moving planned work between visits is not audited (not clinical).
--
-- Who may do what
--   - Active staff of the patient's practice read the chart (row level security; the users row is
--     the source of truth, as in every OneHealth staff policy). A dental chart is a clinical record,
--     so super admins of other practices are not included, and patient-app logins read nothing.
--   - Every write goes through the functions in section 3 (SECURITY DEFINER): each checks that the
--     signed-in user is active staff of the patient's practice, and stamps who and when from the
--     login. Recording, planning, changing a status and "entered in error" need a practitioner,
--     nurse or practice admin (users.role doctor, nurse or admin); any staff member may arrange the
--     plan's visits and put planned work on a quote (reception makes quotes). There are no INSERT,
--     UPDATE or DELETE grants on the tables.
--
-- Contents
--   1. dental_chart_entries
--   2. dental_chart_changes (audit trail)
--   3. Functions: dental_chart_surfaces, dental_chart_practice_for (internal), dental_chart_add,
--      dental_chart_set_status, dental_chart_void, dental_plan_arrange, dental_plan_link_quote
--   4. Row level security and grants
--   5. The patient app's staff-only guard (when the portal file is applied)
--   6. Checks (the behaviour checks run inside a block that undoes itself)
--   Undo: at the end of the file.
-- =============================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. dental_chart_entries
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dental_chart_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL,
  patient_id         uuid NOT NULL,
  tooth              text NOT NULL,
  surfaces           text,
  work               text NOT NULL,
  status             text NOT NULL,
  tariff_code        text,
  plan_visit         smallint,
  plan_order         smallint,
  quote_id           uuid,
  visit_id           uuid,
  invoice_id         uuid,
  note               text,
  recorded_by        uuid,
  recorded_at        timestamptz NOT NULL DEFAULT now(),
  status_changed_at  timestamptz,
  voided_by          uuid,
  voided_at          timestamptz,
  void_reason        text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- Named, because the app reads the user names through these relationships
  CONSTRAINT dental_chart_entries_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT dental_chart_entries_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT dental_chart_entries_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL,
  CONSTRAINT dental_chart_entries_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL,
  CONSTRAINT dental_chart_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices_enhanced(id) ON DELETE SET NULL,
  CONSTRAINT dental_chart_entries_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT dental_chart_entries_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.users(id) ON DELETE SET NULL,
  -- FDI: permanent 11-18 ... 41-48, milk teeth 51-55 ... 81-85 (isValidFdiTooth in src/utils/billing/pricing.ts)
  CONSTRAINT dental_chart_entries_tooth_check CHECK (tooth ~ '^([1-4][1-8]|[5-8][1-5])$'),
  CONSTRAINT dental_chart_entries_work_check
    CHECK (work IN ('filling', 'crown', 'root_canal', 'implant', 'bridge', 'extraction', 'missing', 'other')),
  CONSTRAINT dental_chart_entries_status_check CHECK (status IN ('existing', 'defective', 'planned', 'done', 'removed')),
  -- Surfaces belong to fillings: letters of M O I D B F L P, put in that order by dental_chart_surfaces()
  CONSTRAINT dental_chart_entries_surfaces_check CHECK (surfaces IS NULL OR (work = 'filling' AND surfaces ~ '^[MOIDBFLP]{1,5}$')),
  -- A missing tooth is found, never planned; an extraction and other work are planned, never found
  CONSTRAINT dental_chart_entries_missing_check CHECK (work <> 'missing' OR status = 'existing'),
  CONSTRAINT dental_chart_entries_planned_work_check
    CHECK (work NOT IN ('extraction', 'other') OR status IN ('planned', 'done', 'removed')),
  -- Planned work names its code and its planned visit, and keeps them when it is done or removed
  CONSTRAINT dental_chart_entries_plan_check
    CHECK (status NOT IN ('planned', 'done', 'removed') OR (tariff_code IS NOT NULL AND plan_visit IS NOT NULL)),
  CONSTRAINT dental_chart_entries_code_check CHECK (tariff_code IS NULL OR tariff_code ~ '^[0-9A-Z]{2,10}$'),
  CONSTRAINT dental_chart_entries_plan_visit_check CHECK (plan_visit IS NULL OR plan_visit BETWEEN 1 AND 50),
  CONSTRAINT dental_chart_entries_plan_order_check CHECK (plan_order IS NULL OR plan_order BETWEEN 1 AND 500),
  CONSTRAINT dental_chart_entries_note_check CHECK (note IS NULL OR char_length(note) <= 300),
  -- "Entered in error" always has its reason and its time
  CONSTRAINT dental_chart_entries_void_check CHECK ((voided_at IS NULL) = (void_reason IS NULL))
);
COMMENT ON TABLE public.dental_chart_entries IS
  'Dental chart: work found on a tooth (existing, defective) and planned work (planned, done, removed). Billed work is read from invoice_services.tooth_number. Never deleted; mistakes are entered in error. See proposals/2026-10-07-dental-chart.sql.';
COMMENT ON COLUMN public.dental_chart_entries.tooth IS 'FDI tooth number: 11-48 permanent, 51-85 milk teeth.';
COMMENT ON COLUMN public.dental_chart_entries.surfaces IS 'Fillings: M mesial, O occlusal, I incisal, D distal, B buccal, F labial, L lingual, P palatal, in that order.';
COMMENT ON COLUMN public.dental_chart_entries.plan_visit IS 'Planned work: the planned visit it belongs to (1, 2, 3 ...). Visit numbers are not renumbered when work moves.';
COMMENT ON COLUMN public.dental_chart_entries.invoice_id IS 'The invoice of the visit the work was marked done at. The line is the one with this code and tooth (line ids change when a visit is saved again).';

CREATE INDEX IF NOT EXISTS dental_chart_entries_patient_idx ON public.dental_chart_entries (patient_id, recorded_at);
CREATE INDEX IF NOT EXISTS dental_chart_entries_practice_idx ON public.dental_chart_entries (practice_id);
CREATE INDEX IF NOT EXISTS dental_chart_entries_quote_idx ON public.dental_chart_entries (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dental_chart_entries_visit_idx ON public.dental_chart_entries (visit_id) WHERE visit_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 2. dental_chart_changes: the audit trail (written only by the functions in section 3)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dental_chart_changes (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id     uuid NOT NULL,
  practice_id  uuid NOT NULL,
  patient_id   uuid NOT NULL,
  action       text NOT NULL,
  from_status  text,
  to_status    text,
  -- Kept without a foreign key, so the history still names the quote after a draft is deleted
  quote_id     uuid,
  reason       text,
  changed_by   uuid,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dental_chart_changes_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.dental_chart_entries(id) ON DELETE CASCADE,
  CONSTRAINT dental_chart_changes_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE,
  CONSTRAINT dental_chart_changes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT dental_chart_changes_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT dental_chart_changes_action_check CHECK (action IN ('recorded', 'status', 'quote', 'error')),
  CONSTRAINT dental_chart_changes_reason_check CHECK (reason IS NULL OR char_length(reason) <= 200)
);
COMMENT ON TABLE public.dental_chart_changes IS
  'Audit trail of the dental chart: recorded, status changes, put on a quote, entered in error (who and when). Insert only, through the dental chart functions.';

CREATE INDEX IF NOT EXISTS dental_chart_changes_patient_idx ON public.dental_chart_changes (patient_id, changed_at);
CREATE INDEX IF NOT EXISTS dental_chart_changes_entry_idx ON public.dental_chart_changes (entry_id);

-- ---------------------------------------------------------------------------------------------
-- 3. Functions
-- ---------------------------------------------------------------------------------------------

-- 3a. Filling surfaces once each, in stored order ('dom' -> 'DMO' -> 'MOD'); NULL when none. The app
--     orders them the same way (src/utils/dental/surfaces.ts SURFACE_ORDER).
CREATE OR REPLACE FUNCTION public.dental_chart_surfaces(p_surfaces text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT NULLIF(string_agg(s.letter, '' ORDER BY strpos('MOIDBFLP', s.letter)), '')
  FROM (
    SELECT DISTINCT l AS letter
    FROM unnest(string_to_array(upper(COALESCE(p_surfaces, '')), NULL)) AS l
    WHERE strpos('MOIDBFLP', l) > 0
  ) s
$$;

-- 3b. The patient's practice, when the signed-in user is active staff of it; raises otherwise.
--     p_clinical: recording, planning and status changes need a practitioner, nurse or practice admin.
--     auth.uid() is NULL in the SQL editor and for the service role, so they cannot use these functions
--     (the service role may write to the tables directly).
CREATE OR REPLACE FUNCTION public.dental_chart_practice_for(p_patient_id uuid, p_clinical boolean)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid;
  v_role text;
BEGIN
  SELECT p.practice_id INTO v_practice FROM public.patients p WHERE p.id = p_patient_id;
  SELECT u.role INTO v_role
  FROM public.users u
  WHERE u.id = auth.uid() AND COALESCE(u.is_active, true) AND v_practice IS NOT NULL AND u.practice_id = v_practice;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only staff of the patient''s practice can change this dental chart' USING ERRCODE = '42501';
  END IF;
  IF p_clinical AND COALESCE(v_role, '') NOT IN ('doctor', 'nurse', 'admin') THEN
    RAISE EXCEPTION 'Only a practitioner, nurse or practice admin can record or plan work on the dental chart' USING ERRCODE = '42501';
  END IF;
  RETURN v_practice;
END
$$;

-- 3c. dental_chart_add(patient, entries): records work found on teeth or plans work, 1 to 32 entries
--     at once. Each entry: {tooth, work, status ('existing' | 'defective' | 'planned'), surfaces?,
--     tariff_code? (planned), plan_visit? (planned, default 1), visit_id?, note?}. Planned work goes to
--     the end of its planned visit. Returns the new ids in the order given.
CREATE OR REPLACE FUNCTION public.dental_chart_add(p_patient_id uuid, p_entries jsonb)
RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_practice uuid := public.dental_chart_practice_for(p_patient_id, true);
  v_entry jsonb;
  v_status text;
  v_plan_visit smallint;
  v_visit_id uuid;
  v_id uuid;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'Send 1 to 32 chart entries at a time' USING ERRCODE = '22023';
  END IF;
  FOR v_entry IN SELECT e.value FROM jsonb_array_elements(p_entries) AS e(value) LOOP
    v_status := v_entry->>'status';
    IF v_status IS NULL OR v_status NOT IN ('existing', 'defective', 'planned') THEN
      RAISE EXCEPTION 'A new chart entry is existing, defective or planned' USING ERRCODE = '22023';
    END IF;
    v_visit_id := NULLIF(v_entry->>'visit_id', '')::uuid;
    IF v_visit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.visits v WHERE v.id = v_visit_id AND v.patient_id = p_patient_id
    ) THEN
      RAISE EXCEPTION 'The visit is not this patient''s' USING ERRCODE = '23514';
    END IF;
    v_plan_visit := CASE WHEN v_status = 'planned' THEN COALESCE(NULLIF(v_entry->>'plan_visit', '')::smallint, 1) END;

    INSERT INTO public.dental_chart_entries (
      practice_id, patient_id, tooth, surfaces, work, status, tariff_code, plan_visit, plan_order, visit_id, note, recorded_by
    )
    VALUES (
      v_practice,
      p_patient_id,
      btrim(COALESCE(v_entry->>'tooth', '')),
      public.dental_chart_surfaces(v_entry->>'surfaces'),
      v_entry->>'work',
      v_status,
      CASE WHEN v_status = 'planned' THEN NULLIF(upper(btrim(COALESCE(v_entry->>'tariff_code', ''))), '') END,
      v_plan_visit,
      CASE WHEN v_status = 'planned' THEN (
        SELECT COALESCE(max(o.plan_order), 0) + 1
        FROM public.dental_chart_entries o
        WHERE o.patient_id = p_patient_id AND o.status = 'planned' AND o.plan_visit = v_plan_visit AND o.voided_at IS NULL
      ) END,
      v_visit_id,
      NULLIF(btrim(COALESCE(v_entry->>'note', '')), ''),
      auth.uid()
    )
    RETURNING id INTO v_id;

    INSERT INTO public.dental_chart_changes (entry_id, practice_id, patient_id, action, to_status, changed_by)
    VALUES (v_id, v_practice, p_patient_id, 'recorded', v_status, auth.uid());
    v_ids := v_ids || v_id;
  END LOOP;
  RETURN v_ids;
END
$$;

-- 3d. dental_chart_set_status(entries, status, visit?): the status changes a chart allows:
--       existing -> defective, defective -> existing, done -> defective,
--       planned -> done / removed, done -> planned (marked done by mistake), removed -> planned.
--     Done at a visit (p_visit_id) stores the visit and its invoice. Back on the plan goes to the end of
--     its planned visit. An entry already in the status is left as it is. Returns how many changed.
CREATE OR REPLACE FUNCTION public.dental_chart_set_status(p_entry_ids uuid[], p_status text, p_visit_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  IF p_entry_ids IS NULL OR cardinality(p_entry_ids) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Send 1 to 100 chart entries at a time' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('existing', 'defective', 'planned', 'done', 'removed') THEN
    RAISE EXCEPTION 'Unknown chart status %', COALESCE(p_status, '(none)') USING ERRCODE = '22023';
  END IF;
  FOR r IN
    SELECT e.id, e.patient_id, e.practice_id, e.status, e.plan_visit, e.voided_at
    FROM public.dental_chart_entries e
    WHERE e.id = ANY (p_entry_ids)
    ORDER BY e.recorded_at, e.id
    FOR UPDATE
  LOOP
    PERFORM public.dental_chart_practice_for(r.patient_id, true);
    IF r.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'An entry marked as entered in error cannot be changed' USING ERRCODE = '23514';
    END IF;
    CONTINUE WHEN r.status = p_status;
    IF (r.status, p_status) NOT IN (
      ('existing', 'defective'), ('defective', 'existing'), ('done', 'defective'),
      ('planned', 'done'), ('done', 'planned'), ('planned', 'removed'), ('removed', 'planned')
    ) THEN
      RAISE EXCEPTION 'A % entry cannot become %', r.status, p_status USING ERRCODE = '23514';
    END IF;
    IF p_visit_id IS NOT NULL AND p_status = 'done' AND NOT EXISTS (
      SELECT 1 FROM public.visits v WHERE v.id = p_visit_id AND v.patient_id = r.patient_id
    ) THEN
      RAISE EXCEPTION 'The visit is not this patient''s' USING ERRCODE = '23514';
    END IF;

    UPDATE public.dental_chart_entries e
    SET status = p_status,
        status_changed_at = now(),
        updated_at = now(),
        visit_id = CASE WHEN p_status = 'done' AND p_visit_id IS NOT NULL THEN p_visit_id ELSE e.visit_id END,
        invoice_id = CASE
          WHEN p_status = 'done' AND p_visit_id IS NOT NULL THEN (
            SELECT i.id FROM public.invoices_enhanced i WHERE i.visit_id = p_visit_id ORDER BY i.created_at LIMIT 1
          )
          ELSE e.invoice_id
        END,
        plan_order = CASE
          WHEN p_status = 'planned' THEN (
            SELECT COALESCE(max(o.plan_order), 0) + 1
            FROM public.dental_chart_entries o
            WHERE o.patient_id = r.patient_id AND o.status = 'planned' AND o.plan_visit = r.plan_visit AND o.voided_at IS NULL
          )
          ELSE e.plan_order
        END
    WHERE e.id = r.id;

    INSERT INTO public.dental_chart_changes (entry_id, practice_id, patient_id, action, from_status, to_status, changed_by)
    VALUES (r.id, r.practice_id, r.patient_id, 'status', r.status, p_status, auth.uid());
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END
$$;

-- 3e. dental_chart_void(entry, reason): "entered in error". The entry stays, crossed out, with the
--     reason, who and when. Cannot be undone (record the work again).
CREATE OR REPLACE FUNCTION public.dental_chart_void(p_entry_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r record;
BEGIN
  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'Say in a few words (3 to 200 characters) why the entry was a mistake' USING ERRCODE = '22023';
  END IF;
  SELECT e.id, e.patient_id, e.practice_id, e.voided_at INTO r
  FROM public.dental_chart_entries e
  WHERE e.id = p_entry_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chart entry not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.dental_chart_practice_for(r.patient_id, true);
  IF r.voided_at IS NOT NULL THEN
    RETURN;
  END IF;
  UPDATE public.dental_chart_entries
  SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason), updated_at = now()
  WHERE id = r.id;
  INSERT INTO public.dental_chart_changes (entry_id, practice_id, patient_id, action, reason, changed_by)
  VALUES (r.id, r.practice_id, r.patient_id, 'error', btrim(p_reason), auth.uid());
END
$$;

-- 3f. dental_plan_arrange(patient, places): moves planned work between planned visits and orders it.
--     places: [{id, plan_visit, plan_order}]; only this patient's planned work changes. Any staff member.
CREATE OR REPLACE FUNCTION public.dental_plan_arrange(p_patient_id uuid, p_places jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_place jsonb;
  v_count integer := 0;
BEGIN
  PERFORM public.dental_chart_practice_for(p_patient_id, false);
  IF jsonb_typeof(p_places) IS DISTINCT FROM 'array' OR jsonb_array_length(p_places) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Send 1 to 200 plan places at a time' USING ERRCODE = '22023';
  END IF;
  FOR v_place IN SELECT p.value FROM jsonb_array_elements(p_places) AS p(value) LOOP
    UPDATE public.dental_chart_entries e
    SET plan_visit = (v_place->>'plan_visit')::smallint,
        plan_order = (v_place->>'plan_order')::smallint,
        updated_at = now()
    WHERE e.id = (v_place->>'id')::uuid
      AND e.patient_id = p_patient_id
      AND e.status = 'planned'
      AND e.voided_at IS NULL;
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END
$$;

-- 3g. dental_plan_link_quote(entries, quote): records the quote planned work was put on. The quote
--     must be the same patient's, at the same practice; the entries must be that patient's planned
--     work. Any staff member (reception makes quotes).
CREATE OR REPLACE FUNCTION public.dental_plan_link_quote(p_entry_ids uuid[], p_quote_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_quote record;
  v_practice uuid;
  v_count integer;
BEGIN
  SELECT q.id, q.patient_id, q.practice_id INTO v_quote FROM public.quotes q WHERE q.id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
  END IF;
  v_practice := public.dental_chart_practice_for(v_quote.patient_id, false);
  IF v_quote.practice_id IS DISTINCT FROM v_practice THEN
    RAISE EXCEPTION 'The quote belongs to another practice' USING ERRCODE = '42501';
  END IF;
  IF p_entry_ids IS NULL OR cardinality(p_entry_ids) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Send 1 to 200 chart entries at a time' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_entry_ids) AS wanted(id)
    LEFT JOIN public.dental_chart_entries e ON e.id = wanted.id
    WHERE e.id IS NULL OR e.patient_id <> v_quote.patient_id OR e.status <> 'planned' OR e.voided_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Only this patient''s planned work can be put on the quote' USING ERRCODE = '23514';
  END IF;
  UPDATE public.dental_chart_entries SET quote_id = p_quote_id, updated_at = now() WHERE id = ANY (p_entry_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.dental_chart_changes (entry_id, practice_id, patient_id, action, quote_id, changed_by)
  SELECT e.id, e.practice_id, e.patient_id, 'quote', p_quote_id, auth.uid()
  FROM public.dental_chart_entries e
  WHERE e.id = ANY (p_entry_ids);
  RETURN v_count;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Row level security and grants: active staff of the patient's practice read; nobody writes
--    except through the functions above (and the service role).
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.dental_chart_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_chart_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dental_chart_entries_select ON public.dental_chart_entries;
CREATE POLICY dental_chart_entries_select ON public.dental_chart_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = dental_chart_entries.practice_id));

DROP POLICY IF EXISTS dental_chart_changes_select ON public.dental_chart_changes;
CREATE POLICY dental_chart_changes_select ON public.dental_chart_changes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND COALESCE(u.is_active, true)
    AND u.practice_id = dental_chart_changes.practice_id));

REVOKE ALL ON public.dental_chart_entries, public.dental_chart_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dental_chart_entries, public.dental_chart_changes TO authenticated;
GRANT ALL ON public.dental_chart_entries, public.dental_chart_changes TO service_role;
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated',
    pg_get_serial_sequence('public.dental_chart_changes', 'id'));
END
$$;

REVOKE ALL ON FUNCTION public.dental_chart_practice_for(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dental_chart_surfaces(text), public.dental_chart_add(uuid, jsonb),
  public.dental_chart_set_status(uuid[], text, uuid), public.dental_chart_void(uuid, text),
  public.dental_plan_arrange(uuid, jsonb), public.dental_plan_link_quote(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dental_chart_surfaces(text), public.dental_chart_add(uuid, jsonb),
  public.dental_chart_set_status(uuid[], text, uuid), public.dental_chart_void(uuid, text),
  public.dental_plan_arrange(uuid, jsonb), public.dental_plan_link_quote(uuid[], uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. With the patient portal applied: patient-app logins get nothing from the new tables either
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.portal_apply_staff_guard()') IS NOT NULL THEN
    PERFORM public.portal_apply_staff_guard();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Checks
-- ---------------------------------------------------------------------------------------------

-- 6a. Row level security is on, one staff read policy per table and none for anon; signed-in users
--     may read but not write the tables; anon may not run the functions
DO $$
DECLARE
  t text;
  v_count integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['dental_chart_entries', 'dental_chart_changes'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', t)::regclass) THEN
      RAISE EXCEPTION '%: row level security is off', t;
    END IF;
    SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname LIKE t || '\_%';
    IF v_count <> 1 THEN
      RAISE EXCEPTION '%: expected 1 staff policy, found %', t, v_count;
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
  IF has_function_privilege('anon', 'public.dental_chart_add(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.dental_chart_practice_for(uuid, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'dental chart functions: anon may not run them, and the membership check is internal';
  END IF;
  IF public.dental_chart_surfaces('dom') <> 'MOD' OR public.dental_chart_surfaces('xyz') IS NOT NULL THEN
    RAISE EXCEPTION 'dental_chart_surfaces does not order surfaces as the app does';
  END IF;
END $$;

-- 6b. Behaviour, as signed-in users of one practice with a patient (a practitioner and a
--     receptionist), a staff member of another practice and a login without a staff profile. Runs
--     inside a block that undoes itself: nothing is left behind, also when this file ends in COMMIT
--     (the simulated sign-ins end with the block).
DO $$
DECLARE
  v_practice uuid;
  v_clinician uuid;
  v_receptionist uuid;
  v_other uuid;
  v_patient uuid;
  v_ids uuid[];
  v_quote uuid;
  v_count integer;
  v_text text;
BEGIN
  SELECT u.practice_id, u.id INTO v_practice, v_clinician
  FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.role IN ('doctor', 'nurse', 'admin') AND u.practice_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.patients p WHERE p.practice_id = u.practice_id)
  ORDER BY u.id
  LIMIT 1;
  SELECT p.id INTO v_patient FROM public.patients p WHERE p.practice_id = v_practice ORDER BY p.id LIMIT 1;
  SELECT u.id INTO v_receptionist FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.role = 'receptionist' AND u.practice_id = v_practice ORDER BY u.id LIMIT 1;
  SELECT u.id INTO v_other FROM public.users u
  WHERE COALESCE(u.is_active, true) AND u.practice_id IS NOT NULL AND u.practice_id <> v_practice ORDER BY u.id LIMIT 1;
  IF v_patient IS NULL OR v_other IS NULL THEN
    RAISE NOTICE 'No practice with a practitioner, a patient and staff elsewhere: behaviour checks skipped';
    RETURN;
  END IF;

  BEGIN
    -- A practitioner records an existing filling and plans a crown and an extraction
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_clinician, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    v_ids := public.dental_chart_add(v_patient, jsonb_build_array(
      jsonb_build_object('tooth', '36', 'work', 'filling', 'status', 'existing', 'surfaces', 'dom'),
      jsonb_build_object('tooth', '36', 'work', 'crown', 'status', 'planned', 'tariff_code', '8411'),
      jsonb_build_object('tooth', '46', 'work', 'extraction', 'status', 'planned', 'tariff_code', '8201', 'plan_visit', 2)
    ));
    SELECT surfaces INTO v_text FROM public.dental_chart_entries WHERE id = v_ids[1];
    IF v_text IS DISTINCT FROM 'MOD' OR (SELECT count(*) FROM public.dental_chart_entries WHERE patient_id = v_patient) <> 3
       OR (SELECT count(*) FROM public.dental_chart_changes WHERE patient_id = v_patient) <> 3 THEN
      RAISE EXCEPTION 'check failed: the practitioner does not see the 3 entries, their surfaces or their audit lines';
    END IF;

    -- Direct writes are refused: everything goes through the functions
    BEGIN
      INSERT INTO public.dental_chart_entries (practice_id, patient_id, tooth, work, status) VALUES (v_practice, v_patient, '11', 'missing', 'existing');
      RAISE EXCEPTION 'check failed: a direct insert was accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- The rules: a missing tooth is never planned; existing work is not marked done; a mistake needs a reason
    BEGIN
      PERFORM public.dental_chart_add(v_patient, '[{"tooth": "36", "work": "missing", "status": "planned", "tariff_code": "8201"}]'::jsonb);
      RAISE EXCEPTION 'check failed: a planned "missing" was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_chart_set_status(ARRAY[v_ids[1]], 'done');
      RAISE EXCEPTION 'check failed: existing work was marked done';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.dental_chart_void(v_ids[1], ' ');
      RAISE EXCEPTION 'check failed: entered in error without a reason';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    -- Status changes are stamped in the audit trail
    v_count := public.dental_chart_set_status(ARRAY[v_ids[1]], 'defective');
    IF v_count <> 1 OR (SELECT count(*) FROM public.dental_chart_changes WHERE entry_id = v_ids[1] AND action = 'status' AND changed_by = v_clinician) <> 1 THEN
      RAISE EXCEPTION 'check failed: marking defective was not audited';
    END IF;

    -- The plan is put on a quote of the same patient
    INSERT INTO public.quotes (practice_id, patient_id, quote_number, valid_until)
    VALUES (v_practice, v_patient, 'check', (now() AT TIME ZONE 'Africa/Windhoek')::date + 30)
    RETURNING id INTO v_quote;
    IF public.dental_plan_link_quote(ARRAY[v_ids[2], v_ids[3]], v_quote) <> 2 THEN
      RAISE EXCEPTION 'check failed: the plan was not put on the quote';
    END IF;
    BEGIN
      PERFORM public.dental_plan_link_quote(ARRAY[v_ids[1]], v_quote);
      RAISE EXCEPTION 'check failed: work that is not planned was put on a quote';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Reception arranges the plan and sees the chart, but does not record clinical work
    IF v_receptionist IS NOT NULL THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_receptionist, 'role', 'authenticated')::text, true);
      IF public.dental_plan_arrange(v_patient, jsonb_build_array(jsonb_build_object('id', v_ids[3], 'plan_visit', 1, 'plan_order', 2))) <> 1 THEN
        RAISE EXCEPTION 'check failed: reception could not arrange the plan';
      END IF;
      BEGIN
        PERFORM public.dental_chart_add(v_patient, '[{"tooth": "11", "work": "missing", "status": "existing"}]'::jsonb);
        RAISE EXCEPTION 'check failed: reception recorded clinical work';
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END IF;

    -- Staff of another practice see nothing and change nothing
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
    IF (SELECT count(*) FROM public.dental_chart_entries WHERE patient_id = v_patient) <> 0
       OR (SELECT count(*) FROM public.dental_chart_changes WHERE patient_id = v_patient) <> 0 THEN
      RAISE EXCEPTION 'check failed: staff of another practice see the chart';
    END IF;
    BEGIN
      PERFORM public.dental_chart_set_status(ARRAY[v_ids[2]], 'removed');
      RAISE EXCEPTION 'check failed: staff of another practice changed the chart';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- A login without a staff profile (a patient-app login) sees nothing
    PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    IF (SELECT count(*) FROM public.dental_chart_entries) <> 0 OR (SELECT count(*) FROM public.dental_chart_changes) <> 0 THEN
      RAISE EXCEPTION 'check failed: a login without a staff profile sees chart entries';
    END IF;

    RAISE EXCEPTION USING MESSAGE = 'dental_chart_checks_passed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'dental_chart_checks_passed' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'dental chart ready: row level security on, the functions and their rules checked (test rows undone)';
END $$;

-- Change to COMMIT once reviewed (see "How to apply" at the top)
ROLLBACK;

-- =============================================================================================
-- Undo (only if needed; removes every chart entry and its audit trail):
--   DROP TABLE IF EXISTS public.dental_chart_changes, public.dental_chart_entries;
--   DROP FUNCTION IF EXISTS public.dental_plan_link_quote(uuid[], uuid), public.dental_plan_arrange(uuid, jsonb),
--     public.dental_chart_void(uuid, text), public.dental_chart_set_status(uuid[], text, uuid),
--     public.dental_chart_add(uuid, jsonb), public.dental_chart_practice_for(uuid, boolean),
--     public.dental_chart_surfaces(text);
-- The Teeth view then says "not set up yet" again and still shows the billed history.
-- =============================================================================================

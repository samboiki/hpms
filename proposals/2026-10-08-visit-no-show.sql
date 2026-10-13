-- Applied 2026-10-08 as migration visit_no_show_2026_10_08
-- =============================================================================================
-- PROPOSAL: "Mark No Show" works
-- File:   proposals/2026-10-08-visit-no-show.sql                        Drafted: 2026-10-08
--
-- Why (parity re-audit 2026-10-08, B3/B9/O5, verified): visits_status_check allowed only scheduled,
-- in-progress, completed and cancelled. The app writes those and 'no-show' (src/stores/visitsStore.ts
-- markNoShow, src/utils/visitStage.ts), so every "Mark No Show" failed, and the no-show warning, the
-- missed-appointment list, the diary report and the attendance report always read 0.
-- Same change as section 1 of proposals/2026-10-06-data-fixes.sql, on its own.
--
-- Undo (only when no visit is 'no-show'):
--   ALTER TABLE public.visits DROP CONSTRAINT visits_status_check;
--   ALTER TABLE public.visits ADD CONSTRAINT visits_status_check
--     CHECK (status = ANY (ARRAY['scheduled', 'in-progress', 'completed', 'cancelled']));
-- =============================================================================================

BEGIN;

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_status_check
  CHECK (status = ANY (ARRAY['scheduled'::text, 'in-progress'::text, 'completed'::text, 'cancelled'::text, 'no-show'::text]));

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

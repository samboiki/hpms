-- Applied 2026-10-13 as migration record_versions_2026_10_13 (version 20261012220631; stored statement md5 b35c3972932af2785ea8926605701731 = md5 of the part between BEGIN; and ROLLBACK;)
-- Live prosrc md5 afterwards: record_change_stamp db79ec82248998564a64ee07f421b3da.
-- Rehearsed with simulated logins (rolled back): the practice's receptionist changed a patient (stamped with her and
-- now), its doctor a visit (stamped with him), its administrator an invoice's notes unchanged (stamped, no new invoice
-- history event); the doctor's change to one invoice line stamped the invoice with the doctor (through the totals
-- update); another practice's doctor changed 0 rows and the stamp stayed; anon was refused (42501); an automatic change
-- (service role, nobody signed in) left updated_by empty and moved updated_at; in a closed month the invoice's notes
-- could still be saved and its total was still refused by the period lock; staff can read updated_by, anon cannot read
-- patients; the trigger runs for app users although nobody can call its function.
-- =============================================================================================
-- PROPOSAL: "someone else changed this first" - every change to a patient file, a visit or an invoice moves the
--           record's updated_at and records who made it (parity Q12: protection against two people editing the same
--           record)
-- File:   proposals/2026-10-13-record-versions.sql                          Drafted: 2026-10-13
-- Code:   src/services/recordVersion.ts (reads a record's version and who changed it last; the comparison, tested),
--         src/components/common/RecordChangeGuard.tsx (the check before a save and the "changed by someone else"
--         sheet), called by EditPatientForm (the patient's details), EditVisitTabs (the visit and its invoice) and
--         PremiumAddAppointmentForm (a booking being edited)
--
-- Why (Q12): the last save won. A form keeps what it showed when it was opened and writes all of it back, so a change
-- someone else saved in between was overwritten without anyone knowing. The screens now keep the record's updated_at
-- from when it was opened and compare it before saving; for that, updated_at has to move on EVERY change.
-- visits already had a trigger for it (update_visits_updated_at). patients and invoices_enhanced did not: the patient
-- form never set it, and the database's own changes (payment status, claim batching, SMS opt-outs) left it as it was.
-- Invoice line changes already moved the invoice's updated_at (update_invoice_totals_safe).
--
-- What it does
--   1. patients, visits, invoices_enhanced: a nullable updated_by uuid: the signed-in person who changed the row last;
--      NULL for an automatic change (a server job without a signed-in person). Additive: the policies of these tables
--      are not touched; the columns are readable as every other column (table-level grants).
--   2. record_change_stamp(): sets updated_at = now() and updated_by = auth.uid() on every UPDATE of these rows, as a
--      BEFORE UPDATE trigger on each table (zz_record_change_stamp, named to run after the other BEFORE triggers).
--      Why a trigger on the protected tables patients and invoices_enhanced: only the database sees every change - the
--      screens' saves, the database's own functions and paths that never set updated_at - and knows who made it. The
--      trigger changes no other column and reads nothing; the period lock (dc_lock_invoices) and the invoice history
--      (invoice_audit_invoice) do not look at updated_at, and patient merges keep working (they pause the moved
--      tables' triggers as before). It does not block anything: the screens warn and the person chooses.
--   3. Checks: the policies of the three tables did not change, nobody can call the trigger function, and the stamp
--      works for staff and for automatic changes.
-- Not done: no row is rewritten now (updated_by starts empty and fills as records change).
--
-- How to apply: rehearse (scripts/db/rehearsal.ts, or the part between BEGIN; and ROLLBACK; followed by tests that end
-- in RAISE EXCEPTION), then apply that part as one migration. Before it is applied the screens still compare updated_at
-- (visits and invoice lines already move it) but cannot say who changed a record.
-- Undo:  DROP TRIGGER IF EXISTS zz_record_change_stamp ON public.patients;
--        DROP TRIGGER IF EXISTS zz_record_change_stamp ON public.visits;
--        DROP TRIGGER IF EXISTS zz_record_change_stamp ON public.invoices_enhanced;
--        DROP FUNCTION IF EXISTS public.record_change_stamp();
--        ALTER TABLE public.patients DROP COLUMN IF EXISTS updated_by;
--        ALTER TABLE public.visits DROP COLUMN IF EXISTS updated_by;
--        ALTER TABLE public.invoices_enhanced DROP COLUMN IF EXISTS updated_by;
-- =============================================================================================

-- Runs as a rehearsal (it ends in ROLLBACK): the part between BEGIN; and ROLLBACK; is the migration
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks before
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name IN ('patients', 'visits', 'invoices_enhanced')
                AND column_name = 'updated_by' AND data_type <> 'uuid') THEN
    RAISE EXCEPTION 'Stopped: an updated_by column of another type exists on patients, visits or invoices_enhanced';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN ('patients', 'visits', 'invoices_enhanced')
         AND column_name = 'updated_at' AND data_type = 'timestamp with time zone') <> 3 THEN
    RAISE EXCEPTION 'Stopped: patients, visits and invoices_enhanced must each have updated_at timestamptz';
  END IF;
  -- The policies of the three tables, to check at the end that none changed
  PERFORM set_config('onehealth.policies_before', (
    SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename IN ('patients', 'visits', 'invoices_enhanced')
  ), true);
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Who changed the record last
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.invoices_enhanced ADD COLUMN IF NOT EXISTS updated_by uuid;

COMMENT ON COLUMN public.patients.updated_by IS
  'Who changed the patient''s row last (the signed-in person; NULL for an automatic change). Set by record_change_stamp with updated_at; the screens warn before overwriting a change made after they opened the file.';
COMMENT ON COLUMN public.visits.updated_by IS
  'Who changed the visit''s row last (the signed-in person; NULL for an automatic change). Set by record_change_stamp with updated_at; the screens warn before overwriting a change made after they opened the visit.';
COMMENT ON COLUMN public.invoices_enhanced.updated_by IS
  'Who changed the invoice''s row last, its lines included (the signed-in person; NULL for an automatic change). Set by record_change_stamp with updated_at; the visit screen warns before replacing lines changed after it was opened.';

-- ---------------------------------------------------------------------------------------------
-- 2. Every change moves updated_at and records who made it
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_change_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.record_change_stamp() IS
  'BEFORE UPDATE on patients, visits and invoices_enhanced: updated_at = now(), updated_by = the signed-in person (NULL for an automatic change). The version the screens compare before saving (parity Q12).';

REVOKE ALL ON FUNCTION public.record_change_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_record_change_stamp ON public.patients;
CREATE TRIGGER zz_record_change_stamp BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.record_change_stamp();
DROP TRIGGER IF EXISTS zz_record_change_stamp ON public.visits;
CREATE TRIGGER zz_record_change_stamp BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.record_change_stamp();
DROP TRIGGER IF EXISTS zz_record_change_stamp ON public.invoices_enhanced;
CREATE TRIGGER zz_record_change_stamp BEFORE UPDATE ON public.invoices_enhanced
  FOR EACH ROW EXECUTE FUNCTION public.record_change_stamp();

-- ---------------------------------------------------------------------------------------------
-- 3. Checks after
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|' || COALESCE(qual, '') || '|' || COALESCE(with_check, ''), ';' ORDER BY tablename, policyname))
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename IN ('patients', 'visits', 'invoices_enhanced'))
     IS DISTINCT FROM current_setting('onehealth.policies_before', true) THEN
    RAISE EXCEPTION 'Check failed: a policy of patients, visits or invoices_enhanced changed';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgname = 'zz_record_change_stamp' AND NOT t.tgisinternal AND t.tgenabled = 'O'
         AND t.tgrelid IN ('public.patients'::regclass, 'public.visits'::regclass, 'public.invoices_enhanced'::regclass)) <> 3 THEN
    RAISE EXCEPTION 'Check failed: the change stamp is not on all three tables';
  END IF;
  IF has_function_privilege('anon', 'public.record_change_stamp()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.record_change_stamp()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Check failed: the trigger function can be called by the public key or app users';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

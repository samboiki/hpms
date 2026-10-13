-- Applied 2026-10-12 as migration patient_merge_own_tables_2026_10_12 (stored statement md5 ddc721d7debe0b2500b8c051edb54540).
-- Rehearsed: OneHealth columns 53 before and after (same set, each once), the other application's tables 0.
-- =============================================================================================
-- PROPOSAL: a patient merge moves rows in OneHealth's own tables only
-- File:   proposals/2026-10-12-patient-merge-own-tables.sql             Drafted: 2026-10-12
--
-- Why: patient_merge_columns() (2026-10-09-patient-merge.sql) lists every column with a foreign key to patients,
-- plus beds.patient_id. The database is shared with another application, and 9 of its tables reference patients:
-- bed_allocations, beds, bed_transfer_history, inpatient_medications, nursing_care_records, patient_admissions,
-- patient_locations, visitor_logs and ward_rounds. A merge would have rewritten their rows and switched their
-- triggers off for the duration. OneHealth never touches that application's 25 tables (the list in
-- proposals/2026-10-07-close-anonymous-access.sql), so they are left out here. Their rows keep pointing at the
-- archived file, which is kept, so no reference breaks. No merge had been run (patient_merges: 0 rows).
-- Undo: run patient_merge_columns as it is in proposals/2026-10-09-patient-merge.sql.
-- =============================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.patient_merge_columns()
RETURNS TABLE(tbl regclass, schema_name text, table_name text, col text, pk text, pk_type text)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  -- DISTINCT: a column with two foreign keys to patients is listed once (the earlier UNION did the same)
  SELECT DISTINCT c.conrelid::regclass, n.nspname::text, r.relname::text, a.attname::text, k.attname::text,
         pg_catalog.format_type(k.atttypid, k.atttypmod)
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class r ON r.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = r.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    LEFT JOIN pg_catalog.pg_index i ON i.indrelid = c.conrelid AND i.indisprimary AND i.indnatts = 1
    LEFT JOIN pg_catalog.pg_attribute k ON k.attrelid = c.conrelid AND k.attnum = i.indkey[0]
   WHERE c.contype = 'f' AND c.confrelid = 'public.patients'::regclass AND cardinality(c.conkey) = 1
     AND c.conrelid NOT IN ('public.patients'::regclass, 'public.patient_merges'::regclass)
     -- The other application's tables in this shared database: never touched by OneHealth
     AND NOT (n.nspname = 'public' AND r.relname = ANY (ARRAY[
       'ai_search_logs', 'automation_processing_log', 'bed_allocations', 'bed_transfer_history', 'beds',
       'client_leads', 'expense_items', 'follow_up_automation_log_summary', 'follow_up_automation_logs',
       'hospital_wards', 'inpatient_medications', 'message_engagement_metrics', 'notification_follow_up_sequences',
       'nursing_care_records', 'patient_admissions', 'patient_locations', 'practice_automation_queue_stats',
       'practice_signup_requests', 'social_media_accounts', 'staff_titles', 'system_logs', 'visitor_logs',
       'ward_beds', 'ward_rounds', 'wards']))
     AND r.relname NOT LIKE 'bet%' AND r.relname NOT LIKE 'vw_jukebox%'
$function$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.patient_merge_columns() c
     WHERE c.table_name IN ('bed_allocations', 'beds', 'bed_transfer_history', 'inpatient_medications',
                            'nursing_care_records', 'patient_admissions', 'patient_locations', 'visitor_logs', 'ward_rounds')
  ) THEN
    RAISE EXCEPTION 'Check failed: the merge still lists another application''s table';
  END IF;
END $$;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

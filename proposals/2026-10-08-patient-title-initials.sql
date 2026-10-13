-- Applied 2026-10-08 as migration patient_title_initials_2026_10_08 (version 20261008131126; md5 of the body below
-- without BEGIN/ROLLBACK and this header line: 114fdfaa77da358d5ce18c2054f7f730)
-- =============================================================================================
-- PROPOSAL: Title and initials on the patient file
-- File:   proposals/2026-10-08-patient-title-initials.sql               Drafted: 2026-10-08
--
-- Why (parity re-audit 2026-10-08, A1): Eminance registers every patient with a title and initials, and a practice
-- addresses the patient formally ("Mrs N M Shilongo") on the patient file, letters and statements. patients had
-- neither column. Both are optional: nothing else changes for files without them.
-- The app works before and after this file: the registration and edit forms show Title and Initials only once both
-- columns exist (src/components/forms/patientTitleColumns.ts), and the patient header shows the formal name only when
-- one is filled in (src/services/patientFileService.ts loadFormalName).
-- Access: patients has table grants only (no column grants), so the new columns follow the existing practice policies
-- on patients, which are not changed here; anon has no grant on patients.
-- Apply after: nothing (additive). Rehearsal order: scripts/db/rehearsal.ts.
--
-- Undo (drops what was typed into them):
--   ALTER TABLE public.patients DROP COLUMN IF EXISTS title, DROP COLUMN IF EXISTS initials;
-- =============================================================================================

BEGIN;

-- 1. The columns. The forms save a title from a short list (Mr, Mrs, Ms, Miss, Dr, Prof, Rev) or keep one already on
--    the file, and initials as capital letters without spaces ("NM"); the limits only stop nonsense.
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS title text
  CONSTRAINT patients_title_length CHECK (char_length(title) BETWEEN 1 AND 20);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS initials text
  CONSTRAINT patients_initials_length CHECK (char_length(initials) BETWEEN 1 AND 10);
COMMENT ON COLUMN public.patients.title IS 'Form of address (Mr, Mrs, Ms, Miss, Dr, Prof, Rev); blank when not given';
COMMENT ON COLUMN public.patients.initials IS 'Initials of the first names, capitals without spaces (NM); shown as "Mrs N M Shilongo"';

-- 2. Check (counts only): both columns exist and are empty
SELECT count(*) AS patients, count(title) AS with_title, count(initials) AS with_initials FROM public.patients;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

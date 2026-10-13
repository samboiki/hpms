-- Applied 2026-10-09 as migration diary_default_practitioner_2026_10_08 (version 20261009003032; stored statement md5 baebe0b8a6df456e07ddba903f5bd16e = md5 of the trimmed text between BEGIN; and ROLLBACK; below)
-- Rehearsed with simulated logins: a receptionist saved her own default (read back) but not a colleague's (0 rows); a role change alongside was refused (42501); 51 ids or a blank entry were refused (23514); the public key could neither read nor write the column (42501).
-- =============================================================================================
-- PROPOSAL: Each user's default practitioner in the diary
-- File:   proposals/2026-10-08-diary-default-practitioner.sql         Drafted: 2026-10-08
--
-- Why (parity re-audit 2026-10-08, Q9): Eminance opens each login on its own practitioner. OneHealth's diary opens a
-- doctor on their own column and everyone else on all practitioners (src/utils/diary/diaryDefaultView.ts), and nobody
-- could keep another choice: a receptionist who books for one doctor chose that doctor again every time. Each user can
-- now save whose bookings the diary opens on ("Open the diary on" in the practitioner filter, "Remember as my default"
-- next to the booking form's practitioner); the booking form starts with that practitioner too. It is kept on the
-- user's own staff row, so it follows them to any computer (browser storage is lost on a new device and mixes people
-- up on a shared front-desk computer).
-- The value: NULL = nothing saved (the role's default applies), an empty list = all practitioners, else the chosen
-- practitioners' users.id (at most 50). The ids are not foreign keys (an array cannot be one): the app ignores a saved
-- practitioner who has left the practice and falls back to the role's default.
-- The app works before and after this file: until the column exists the diary opens on the role's default and does
-- not offer to save one (src/services/diaryDefaultService.ts reads the missing column as "not set up").
-- Access: no policy or grant changes. users_self_update already lets a signed-in user update their own row (its check
-- keeps role, practice, active flag and permissions unchanged) and authenticated has table-level SELECT and UPDATE on
-- users, so the column follows the existing policies: staff read their colleagues' rows (users_read) and practice
-- administrators edit their staff's rows (users_practice_admin). anon has column grants only on users, none on this
-- column, so it can neither read nor write it. The only trigger on users sets updated_at.
-- Apply after: nothing (additive). Rehearsal order: scripts/db/rehearsal.ts.
--
-- Undo (forgets everyone's saved default):
--   ALTER TABLE public.users DROP COLUMN IF EXISTS diary_practitioner_ids;
-- =============================================================================================

BEGIN;

-- 1. The column, with limits that only stop nonsense (no blank entries, no more than 50 practitioners)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS diary_practitioner_ids uuid[]
  CONSTRAINT users_diary_practitioner_ids_valid CHECK (
    cardinality(diary_practitioner_ids) <= 50 AND array_position(diary_practitioner_ids, NULL) IS NULL
  );
COMMENT ON COLUMN public.users.diary_practitioner_ids IS
  'Whose bookings the diary opens on for this user: NULL = the role default (a doctor their own column, others everyone), empty = all practitioners, else these practitioners (users.id)';

-- 2. Check (counts only): the column exists and nobody has a default yet
SELECT count(*) AS users, count(diary_practitioner_ids) AS with_default FROM public.users;

-- Change to COMMIT only when this becomes a reviewed migration
ROLLBACK;

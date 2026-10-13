-- =============================================================================================
-- PROPOSAL: remove the stock photos of strangers that older versions saved as staff pictures
-- File:   proposals/2026-10-13-clear-stock-avatars.sql                    Drafted: 2026-10-13
-- Code:   src/utils/avatarUtils.ts (personalAvatar: a stock photo address counts as "no photo"),
--         src/components/layout/ProfileMenu.tsx (UserAvatar: the photo, or the person's initials),
--         src/components/settings/UserManagement/EditUserModal.tsx (no longer saves a stock photo)
--
-- Why (owner decision, 13 Oct 2026: "initials not stock photos"): Settings > Users used to show a photo of a
-- stranger from images.unsplash.com for anyone without their own photo, and Edit User saved that address into
-- users.avatar. Screens that show users.avatar directly (chat, branches, leave requests, the practice profile)
-- therefore still show a stranger's face for those people. The app now ignores such addresses where it uses
-- UserAvatar; this clears them from the data so every screen shows initials instead.
--
-- What it does: users.avatar = NULL where it is an images.unsplash.com address. Nothing else; no policy changes.
-- How to apply: rehearse in a transaction that rolls back (the count it reports is the number of staff records
-- changed), then apply the part between BEGIN; and ROLLBACK; as one migration (service role: it changes other
-- people's rows). The app works before and after.
-- Undo: not needed (the addresses were stock photos, not anyone's picture). Before applying, a copy can be kept:
--   CREATE TABLE public._stock_avatars_backup AS SELECT id, avatar FROM public.users WHERE avatar LIKE 'https://images.unsplash.com/%';
-- =============================================================================================

BEGIN;

DO $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.users
     SET avatar = NULL
   WHERE avatar LIKE 'https://images.unsplash.com/%';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RAISE NOTICE 'Stock photos cleared from % staff records', changed;
END $$;

ROLLBACK;

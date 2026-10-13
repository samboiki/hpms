/**
 * The signed-in user's saved diary default: whose bookings the diary opens on and who a new booking starts with
 * (users.diary_practitioner_ids, proposals/2026-10-08-diary-default-practitioner.sql). The rules are in
 * src/utils/diary/diaryDefaultView.ts; this file only talks to Supabase. Until that SQL is applied the column is
 * missing: loads say 'not_enabled', the diary opens on the role's default and offers nothing to save.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingColumnError } from '../utils/diary/dbErrors';
import { savedDiaryView, type DiaryView } from '../utils/diary/diaryDefaultView';

// The column is not in the generated database types yet, so it is read with the untyped client and checked at runtime
const db = supabase as unknown as SupabaseClient;

const COLUMN = 'diary_practitioner_ids';

export type DiaryDefaultLoad =
  | { state: 'ready'; saved: DiaryView | null }
  | { state: 'not_enabled' }
  | { state: 'error'; message: string };

export type DiaryDefaultSave = { ok: true } | { ok: false; message: string };

/** The user's saved default (null: nothing saved). */
export async function loadDiaryDefault(userId: string): Promise<DiaryDefaultLoad> {
  const { data, error } = await db.from('users').select(COLUMN).eq('id', userId).maybeSingle();
  if (error) {
    if (isMissingColumnError(error)) return { state: 'not_enabled' };
    console.error('Could not load the default practitioner:', error);
    return { state: 'error', message: 'Could not load your default practitioner.' };
  }
  return { state: 'ready', saved: savedDiaryView((data as Record<string, unknown> | null)?.[COLUMN]) };
}

/** Saves the user's default on their own staff row ([] = all practitioners). */
export async function saveDiaryDefault(userId: string, view: DiaryView): Promise<DiaryDefaultSave> {
  const { data, error } = await db.from('users').update({ [COLUMN]: [...view] }).eq('id', userId).select('id');
  if (error) {
    console.error('Could not save the default practitioner:', error);
    return {
      ok: false,
      message: isMissingColumnError(error)
        ? 'Saving a default practitioner is not switched on yet. Your administrator needs to apply the diary update first.'
        : 'Could not save your default. Please try again.'
    };
  }
  // No row back: the database did not let this login change the row
  if (!Array.isArray(data) || data.length === 0) return { ok: false, message: 'Could not save your default. Please try again.' };
  return { ok: true };
}

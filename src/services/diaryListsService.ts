/**
 * A practice's own booking statuses and appointment types (diary_statuses and diary_appointment_types, from
 * proposals/2026-10-12-diary-statuses-and-types.sql). The rules are in src/utils/diary/diaryStatuses.ts and
 * appointmentTypes.ts; this file only talks to Supabase. Before the SQL is applied the tables are missing: loads say
 * 'not_enabled' (the diary works as before, without them) and saves say they are not switched on yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normalizeAppointmentTypeRow, validateAppointmentType, type AppointmentType, type AppointmentTypeInput } from '../utils/diary/appointmentTypes';
import { isMissingFunctionError, isMissingTableError, isPermissionError } from '../utils/diary/dbErrors';
import { normalizeDiaryStatusRow, validateDiaryStatus, type DiaryStatus, type DiaryStatusInput } from '../utils/diary/diaryStatuses';

// The new tables and functions are not in the generated database types yet: rows are read untyped and checked
const db = supabase as unknown as SupabaseClient;

export const DIARY_STATUSES_TABLE = 'diary_statuses';
export const APPOINTMENT_TYPES_TABLE = 'diary_appointment_types';

export const DIARY_LISTS_NOT_ENABLED_MESSAGE =
  'Statuses and appointment types are not switched on yet. OneHealth support switches them on.';

export type DiaryListLoad<T> =
  | { state: 'ready'; items: T[] }
  | { state: 'not_enabled'; items: T[] }
  | { state: 'error'; message: string; items: T[] };

export type DiaryListSave = { ok: true; id: string } | { ok: false; message: string; notEnabled?: boolean };
export type DiaryListRemove = { ok: true } | { ok: false; message: string; notEnabled?: boolean };

// One read per practice for a short while: the diary, the booking form and Diary settings all ask
const CACHE_MS = 30 * 1000;
const cache = new Map<string, { at: number; load: Promise<unknown> }>();

function cachedList<T>(table: string, practiceId: string, normalize: (row: unknown) => T | null): Promise<DiaryListLoad<T>> {
  const key = `${table}:${practiceId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.load as Promise<DiaryListLoad<T>>;
  const load = (async (): Promise<DiaryListLoad<T>> => {
    const { data, error } = await db.from(table).select('*').eq('practice_id', practiceId).order('name', { ascending: true }).limit(200);
    if (error) {
      if (isMissingTableError(error, table)) return { state: 'not_enabled', items: [] };
      console.error(`Could not load ${table}:`, error);
      // Shown after "Could not load the statuses:": plain words, the database's own text stays in the console
      return { state: 'error', message: 'check the connection and try again.', items: [] };
    }
    return { state: 'ready', items: ((data ?? []) as unknown[]).map(normalize).filter((item): item is T => item !== null) };
  })();
  cache.set(key, { at: Date.now(), load });
  return load;
}

/** After a save (or to see someone else's change), read the lists again. */
export function forgetDiaryLists(practiceId?: string): void {
  if (!practiceId) {
    cache.clear();
    return;
  }
  cache.delete(`${DIARY_STATUSES_TABLE}:${practiceId}`);
  cache.delete(`${APPOINTMENT_TYPES_TABLE}:${practiceId}`);
}

/** The practice's statuses, removed ones included (bookings that have one still show it). */
export const loadDiaryStatuses = (practiceId: string): Promise<DiaryListLoad<DiaryStatus>> =>
  cachedList(DIARY_STATUSES_TABLE, practiceId, normalizeDiaryStatusRow);

/** The practice's appointment types, removed ones included (bookings made as one keep it). */
export const loadAppointmentTypes = (practiceId: string): Promise<DiaryListLoad<AppointmentType>> =>
  cachedList(APPOINTMENT_TYPES_TABLE, practiceId, normalizeAppointmentTypeRow);

// The functions refuse in plain words (who may, a name in use, a value out of range, a removed item)
const PLAIN_REFUSALS = new Set(['22023', '23505', 'P0002']);

function refusal(error: { code?: string; message?: string } | null, functionName: string): { ok: false; message: string; notEnabled?: boolean } {
  if (isMissingFunctionError(error, functionName)) return { ok: false, notEnabled: true, message: DIARY_LISTS_NOT_ENABLED_MESSAGE };
  if (isPermissionError(error) || PLAIN_REFUSALS.has(error?.code ?? '')) return { ok: false, message: error?.message || 'Not saved.' };
  console.error(`Could not save (${functionName}):`, error);
  return { ok: false, message: `Not saved: ${error?.message ?? 'unknown error'}` };
}

/** Adds a status (statusId null) or changes one, after the same checks as the database (practice administrators). */
export async function saveDiaryStatus(
  practiceId: string,
  statusId: string | null,
  input: DiaryStatusInput,
  existing: DiaryStatus[]
): Promise<DiaryListSave> {
  const checked = validateDiaryStatus(input, existing, statusId);
  if (!checked.ok) return { ok: false, message: checked.errors.join(' ') };
  const { data, error } = await db.rpc('save_diary_status', {
    p_practice_id: practiceId,
    p_status_id: statusId,
    p_name: checked.value.name,
    p_colour: checked.value.colour,
    p_stage: checked.value.stage
  });
  forgetDiaryLists(practiceId);
  return error ? refusal(error, 'save_diary_status') : { ok: true, id: String(data) };
}

/** Switches a status off: no longer offered; bookings keep it. */
export async function removeDiaryStatus(practiceId: string, statusId: string): Promise<DiaryListRemove> {
  const { data, error } = await db.rpc('remove_diary_status', { p_practice_id: practiceId, p_status_id: statusId });
  forgetDiaryLists(practiceId);
  if (error) return refusal(error, 'remove_diary_status');
  return Number(data) > 0 ? { ok: true } : { ok: false, message: 'Not removed: it was already removed, or belongs to another practice.' };
}

/** Adds an appointment type (typeId null) or changes one, after the same checks as the database. */
export async function saveAppointmentType(
  practiceId: string,
  typeId: string | null,
  input: AppointmentTypeInput,
  existing: AppointmentType[]
): Promise<DiaryListSave> {
  const checked = validateAppointmentType(input, existing, typeId);
  if (!checked.ok) return { ok: false, message: checked.errors.join(' ') };
  const { data, error } = await db.rpc('save_diary_appointment_type', {
    p_practice_id: practiceId,
    p_type_id: typeId,
    p_name: checked.value.name,
    p_visit_type: checked.value.visitType,
    p_length: checked.value.lengthMinutes,
    p_daily_limit: checked.value.dailyLimit
  });
  forgetDiaryLists(practiceId);
  return error ? refusal(error, 'save_diary_appointment_type') : { ok: true, id: String(data) };
}

/** Switches an appointment type off: no longer offered; bookings made as it keep it. */
export async function removeAppointmentType(practiceId: string, typeId: string): Promise<DiaryListRemove> {
  const { data, error } = await db.rpc('remove_diary_appointment_type', { p_practice_id: practiceId, p_type_id: typeId });
  forgetDiaryLists(practiceId);
  if (error) return refusal(error, 'remove_diary_appointment_type');
  return Number(data) > 0 ? { ok: true } : { ok: false, message: 'Not removed: it was already removed, or belongs to another practice.' };
}

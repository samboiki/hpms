/**
 * Diary settings: the default booking length per visit type and the SMS reminder settings
 * (diary_settings), and practitioner working hours (doctor_branch_schedules), from
 * proposals/2026-10-07-diary-2.sql. The rules are in src/utils/diary (bookingLength.ts,
 * workingHours.ts) and supabase/functions/_shared/appointmentReminders.ts; this file only talks to
 * Supabase.
 *
 * Before the SQL is applied the table, columns and functions are missing: loads return the defaults
 * with state 'not_enabled', so the diary keeps working as before (bookings of the type's default
 * length, the practice's opening hours), and saves say the settings are not switched on yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { loadPracticeRow } from '../lib/practiceRow';
import {
  DEFAULT_REMINDER_SETTINGS,
  normalizeReminderSettings,
  validateReminderSettings,
  type ReminderSettings
} from '../../supabase/functions/_shared/appointmentReminders.ts';
import { DEFAULT_TYPE_LENGTHS, normalizeTypeLengths, validateTypeLengths, type TypeLengths } from '../utils/diary/bookingLength';
import { isMissingColumnError, isMissingFunctionError, isMissingTableError, isPermissionError } from '../utils/diary/dbErrors';
import { isSlotLength, normalizePractitionerSlots, type PractitionerSlots } from '../utils/diary/slotLength';
import { normalizeWorkingHoursRow, type SavedWorkingDay, type WorkingHoursRow } from '../utils/diary/workingHours';

// The new tables and functions are not in the generated database types yet: rows are read untyped
// and checked at runtime
const db = supabase as unknown as SupabaseClient;

export const DIARY_SETTINGS_TABLE = 'diary_settings';
const HOURS_TABLE = 'doctor_branch_schedules';
const HOURS_COLUMNS = 'doctor_id, branch_id, day_of_week, start_time, end_time, break_start, break_end, is_active, branch:branches(name)';

export const DIARY_SETTINGS_NOT_ENABLED_MESSAGE =
  'Diary settings are not switched on yet. Your administrator needs to apply the diary update first.';

export interface DiarySettings {
  lengths: TypeLengths;
  /** Each practitioner's diary slot (slotLength.ts); a practitioner without one keeps the diary's defaults */
  slots: PractitionerSlots;
  reminders: ReminderSettings;
  /** When the reminder schedule last checked this practice; null when it never has */
  remindersLastRunAt: string | null;
  /** False until an administrator saves: the defaults apply */
  saved: boolean;
}

export const DEFAULT_DIARY_SETTINGS: DiarySettings = {
  lengths: DEFAULT_TYPE_LENGTHS,
  slots: {},
  reminders: DEFAULT_REMINDER_SETTINGS,
  remindersLastRunAt: null,
  saved: false
};

export type DiarySettingsLoad =
  | { state: 'ready'; settings: DiarySettings }
  | { state: 'not_enabled'; settings: DiarySettings }
  | { state: 'error'; message: string; settings: DiarySettings };

export type WorkingHoursLoad =
  | { state: 'ready'; rows: WorkingHoursRow[] }
  | { state: 'not_enabled'; rows: WorkingHoursRow[] }
  | { state: 'error'; message: string; rows: WorkingHoursRow[] };

export type DiarySave = { ok: true } | { ok: false; message: string; notEnabled?: boolean };

// One read per practice for a short while: the diary, the booking form and "Next free slot" all ask
const CACHE_MS = 30 * 1000;
const settingsCache = new Map<string, { at: number; load: Promise<DiarySettingsLoad> }>();
const hoursCache = new Map<string, { at: number; load: Promise<WorkingHoursLoad> }>();

const cached = <T,>(cache: Map<string, { at: number; load: Promise<T> }>, key: string, read: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.load;
  const load = read();
  cache.set(key, { at: Date.now(), load });
  return load;
};

/** After a save (or to see someone else's change), read the settings again. */
export function forgetDiarySettings(practiceId?: string): void {
  if (practiceId) {
    settingsCache.delete(practiceId);
    hoursCache.delete(practiceId);
  } else {
    settingsCache.clear();
    hoursCache.clear();
  }
}

export function settingsFromRow(row: unknown): DiarySettings {
  if (!row || typeof row !== 'object') return DEFAULT_DIARY_SETTINGS;
  const r = row as Record<string, unknown>;
  return {
    lengths: normalizeTypeLengths(r.type_lengths),
    // Before proposals/2026-10-12-diary-statuses-and-types.sql the column is missing: no practitioner has a slot
    slots: normalizePractitionerSlots(r.practitioner_slots),
    reminders: normalizeReminderSettings(r),
    remindersLastRunAt: typeof r.reminders_last_run_at === 'string' ? r.reminders_last_run_at : null,
    saved: true
  };
}

/** The practice's diary settings (the defaults when none are saved). */
export function loadDiarySettings(practiceId: string): Promise<DiarySettingsLoad> {
  return cached(settingsCache, practiceId, async (): Promise<DiarySettingsLoad> => {
    const { data, error } = await db.from(DIARY_SETTINGS_TABLE).select('*').eq('practice_id', practiceId).maybeSingle();
    if (error) {
      if (isMissingTableError(error, DIARY_SETTINGS_TABLE)) return { state: 'not_enabled', settings: DEFAULT_DIARY_SETTINGS };
      console.error('Could not load the diary settings:', error);
      return { state: 'error', message: error.message, settings: DEFAULT_DIARY_SETTINGS };
    }
    return { state: 'ready', settings: data ? settingsFromRow(data) : DEFAULT_DIARY_SETTINGS };
  });
}

function saveError(error: { message?: string } | null, functionName: string): DiarySave {
  if (isMissingFunctionError(error, functionName)) return { ok: false, notEnabled: true, message: DIARY_SETTINGS_NOT_ENABLED_MESSAGE };
  // The database functions refuse in plain words ("Only a practice administrator can ...")
  if (isPermissionError(error)) return { ok: false, message: error?.message || 'You are not allowed to change this.' };
  console.error(`Could not save (${functionName}):`, error);
  return { ok: false, message: `Not saved: ${error?.message ?? 'unknown error'}` };
}

async function saveSettings(practiceId: string, settings: Record<string, unknown>): Promise<DiarySave> {
  const { error } = await db.rpc('save_diary_settings', { p_practice_id: practiceId, p_settings: settings });
  forgetDiarySettings(practiceId);
  return error ? saveError(error, 'save_diary_settings') : { ok: true };
}

/** Saves the default length per visit type (practice administrators). */
export async function saveBookingLengths(practiceId: string, lengths: TypeLengths): Promise<DiarySave> {
  const checked = validateTypeLengths(lengths);
  if (!checked.ok) return { ok: false, message: checked.errors.join(' ') };
  return saveSettings(practiceId, { type_lengths: checked.lengths });
}

export const SLOTS_NOT_ENABLED_MESSAGE =
  'Slot lengths are not switched on yet. Your administrator needs to apply the diary update (statuses and appointment types) first.';

/**
 * Saves one practitioner's diary slot, or removes it with null (practice administrators). Before the diary update the
 * database's save_diary_settings ignores the key without an error, so the slot is read back to be sure it was kept.
 */
export async function savePractitionerSlot(practiceId: string, practitionerId: string, minutes: number | null): Promise<DiarySave> {
  if (minutes !== null && !isSlotLength(minutes)) return { ok: false, message: 'Choose 10, 15, 20, 30 or 60 minutes.' };
  const result = await saveSettings(practiceId, { practitioner_slots: { [practitionerId]: minutes } });
  if (result.ok && minutes !== null) {
    const load = await loadDiarySettings(practiceId);
    if (load.settings.slots[practitionerId] !== minutes) return { ok: false, notEnabled: true, message: SLOTS_NOT_ENABLED_MESSAGE };
  }
  return result;
}

/** Saves the reminder settings (practice administrators). `repliesLive`: the practice's SMS replies are collected. */
export async function saveReminderSettings(practiceId: string, settings: ReminderSettings, repliesLive: boolean): Promise<DiarySave> {
  const checked = validateReminderSettings(settings, repliesLive);
  if (!checked.ok) return { ok: false, message: checked.errors.join(' ') };
  const valid = checked.settings;
  return saveSettings(practiceId, {
    reminders_enabled: valid.enabled,
    reminder_day_before: valid.dayBefore,
    reminder_day_before_time: valid.dayBeforeTime,
    reminder_same_day: valid.sameDay,
    reminder_same_day_hours: valid.sameDayHoursBefore,
    reminder_template: valid.template
  });
}

/** Every practitioner's working hours in the practice ([] for practitioners without saved hours). */
export function loadWorkingHours(practiceId: string): Promise<WorkingHoursLoad> {
  return cached(hoursCache, practiceId, async (): Promise<WorkingHoursLoad> => {
    const { data, error } = await db.from(HOURS_TABLE).select(HOURS_COLUMNS).eq('practice_id', practiceId).limit(500);
    if (error) {
      // Before the diary update the table has no practice_id or break columns: the hours are not in use yet
      if (isMissingColumnError(error) || isMissingTableError(error, HOURS_TABLE)) return { state: 'not_enabled', rows: [] };
      console.error('Could not load working hours:', error);
      return { state: 'error', message: error.message, rows: [] };
    }
    const rows = ((data ?? []) as unknown[])
      .map(normalizeWorkingHoursRow)
      .filter((row): row is WorkingHoursRow => row !== null);
    return { state: 'ready', rows };
  });
}

/**
 * practices.business_hours as stored (null when it can't be read: the Monday to Friday default applies). From the
 * practice row the menu and the tariff list share (lib/practiceRow.ts), so saving the practice profile refreshes it.
 */
export async function loadPracticeBusinessHours(practiceId: string): Promise<unknown> {
  try {
    const practice = await loadPracticeRow(practiceId);
    return practice?.business_hours ?? null;
  } catch (error) {
    console.error('Could not load the opening hours:', error);
    return null;
  }
}

/** Replaces one practitioner's week (administrators, or the practitioner). An empty list clears it. */
export async function savePractitionerHours(practiceId: string, doctorId: string, days: SavedWorkingDay[]): Promise<DiarySave> {
  const { error } = await db.rpc('save_practitioner_hours', { p_practice_id: practiceId, p_doctor_id: doctorId, p_days: days });
  forgetDiarySettings(practiceId);
  return error ? saveError(error, 'save_practitioner_hours') : { ok: true };
}

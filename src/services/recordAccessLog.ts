/**
 * Record access (parity Q8): a patient's file opened or exported, a sign-in and a sign-out are recorded in
 * record_access_log through log_record_access (proposals/2026-10-13-access-log.sql, exports since
 * 2026-10-13-access-log-exports.sql): who, which patient, when and from which screen - never anything the file holds. Recording must never block or slow a screen or a sign-in: screens do not wait for it,
 * every failure is swallowed (before the SQL exists nothing is recorded), each call gives up after a few seconds, and
 * the same file opened again by the same person within 10 minutes is not sent twice (the database keeps the same rule
 * across tabs and devices). Administrators read the entries in Finance > Reports > Who did what.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// The generated database types do not know the access log yet
const db = supabase as unknown as SupabaseClient;

/** A file opened (once per person and file every 10 minutes), a record exported (every time), a sign-in, a sign-out */
export type AccessEvent = 'patient_opened' | 'record_exported' | 'signed_in' | 'signed_out';

/**
 * Where it happened: the patient file, a visit (opened from the diary, the dashboard or the file), a link to a visit,
 * the sign-in page, anywhere in the app (signing out). The report words them (userActivity.ts ACCESS_SCREENS).
 */
export type AccessScreen = 'patient_file' | 'visit_screen' | 'visit_page' | 'sign_in' | 'app';

/** The same person opening the same file again within this time is one entry */
export const REPEAT_WINDOW_MS = 10 * 60_000;
/** A call that has not answered by then is given up (the screen never waits for it anyway) */
export const GIVE_UP_AFTER_MS = 4_000;
/** Signing out waits at most this long for its entry to go (the screen has already changed; then the session ends) */
export const SIGN_OUT_WAIT_MS = 1_500;

/** Whether an open repeats one sent within the window (in this tab) */
export function isRepeatOpen(lastSentAt: number | undefined, now: number, windowMs: number = REPEAT_WINDOW_MS): boolean {
  return lastSentAt !== undefined && now - lastSentAt >= 0 && now - lastSentAt < windowMs;
}

// Person and file -> when this tab last sent it
const sentOpens = new Map<string, number>();

const quietCodes = new Set(['42883', 'PGRST202', '42P01', 'PGRST205', '42501']);

/** Settles with the call or after `ms`, whichever comes first; never rejects */
export function settleWithin(task: Promise<unknown>, ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    task.then(
      () => { clearTimeout(timer); resolve(); },
      () => { clearTimeout(timer); resolve(); }
    );
  });
}

/**
 * Records one event for the signed-in staff member. Resolves when recorded, skipped or given up; never rejects, so a
 * caller may await it (sign-out, before the session ends) or not (opening a file).
 */
export function logRecordAccess(
  event: AccessEvent,
  options: { screen: AccessScreen; userId: string | null | undefined; patientId?: string | null; now?: number }
): Promise<void> {
  const { screen, userId, patientId = null } = options;
  if (!userId) return Promise.resolve();
  // A file opened or a record exported names its patient; every export is sent, a repeated open is not
  if ((event === 'patient_opened' || event === 'record_exported') && !patientId) return Promise.resolve();
  if (event === 'patient_opened') {
    const key = `${userId}|${patientId}`;
    const now = options.now ?? Date.now();
    if (isRepeatOpen(sentOpens.get(key), now)) return Promise.resolve();
    sentOpens.set(key, now);
  }
  const call = (async () => {
    const { error } = await db.rpc('log_record_access', { p_event: event, p_patient_id: patientId, p_screen: screen });
    // Not set up yet, or not this person's practice (OneHealth support): nothing to record, nothing to say
    if (error && !quietCodes.has(error.code ?? '')) console.warn('Access log: not recorded', error.message);
  })().catch(error => console.warn('Access log: not recorded', error));
  return settleWithin(call, GIVE_UP_AFTER_MS);
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isNotSetUpError } from './invoicingSetup';
import {
  prefsFromRow,
  rowFromPrefs,
  wantsNotification,
  type StaffNotificationPrefs
} from '../utils/notifications/notificationPreferences';
import type { SystemNotification } from '../types/internal-messaging.types';

// Untyped: these tables and columns are newer than the generated types (src/types/database.types.ts)
const db = supabase as unknown as SupabaseClient;

export type PrefsLoad =
  | { status: 'ready'; prefs: StaffNotificationPrefs }
  | { status: 'not_set_up' }
  | { status: 'error'; message: string };

const TABLE = 'user_notification_preferences';

/** The person's own row (the newest, should there be more than one) */
async function ownRow(userId: string) {
  return db
    .from(TABLE)
    .select('id, notifications_enabled, type_preferences')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

/** The person's notification settings; no row yet means everything is shown */
export async function loadNotificationPreferences(userId: string): Promise<PrefsLoad> {
  const { data, error } = await ownRow(userId);
  if (error) {
    if (isNotSetUpError(error)) return { status: 'not_set_up' };
    console.error('Notification settings could not be loaded', error);
    return { status: 'error', message: 'Your notification settings could not be loaded. Please try again.' };
  }
  return { status: 'ready', prefs: prefsFromRow(data) };
}

/** Saves the person's settings: updates their row, or adds one the first time */
export async function saveNotificationPreferences(
  userId: string,
  practiceId: string | null | undefined,
  prefs: StaffNotificationPrefs
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fields = { ...rowFromPrefs(prefs), updated_at: new Date().toISOString() };
  const existing = await ownRow(userId);
  if (existing.error) {
    if (isNotSetUpError(existing.error)) return { ok: false, message: 'Notification settings are not set up yet for this practice.' };
    console.error('Notification settings could not be read before saving', existing.error);
    return { ok: false, message: 'Your notification settings could not be saved. Please try again.' };
  }
  const { data, error } = existing.data
    ? await db.from(TABLE).update(fields).eq('id', existing.data.id).select('id')
    : await db.from(TABLE).insert({ ...fields, user_id: userId, practice_id: practiceId ?? null }).select('id');
  if (error || !data || data.length === 0) {
    console.error('Notification settings could not be saved', error);
    return { ok: false, message: 'Your notification settings could not be saved. Please try again.' };
  }
  return { ok: true };
}

/**
 * Unread notifications the person wants to see (used when their settings hide some kinds: the database's own
 * unread count counts every kind).
 */
export async function countWantedUnread(userId: string, prefs: StaffNotificationPrefs): Promise<number> {
  const { data, error } = await db
    .from('system_notifications')
    .select('notification_type, priority')
    .eq('user_id', userId)
    .in('status', ['pending', 'delivered'])
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as Array<Pick<SystemNotification, 'notification_type' | 'priority'>>)
    .filter(notification => wantsNotification(notification, prefs)).length;
}

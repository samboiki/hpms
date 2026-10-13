import type { SystemNotification } from '../../types/internal-messaging.types';

/**
 * A staff member's in-app notification choices (table user_notification_preferences, one row per person).
 *
 * Owner decision 13 Oct 2026: the notification settings must be real. Staff notifications are shown in the app only
 * (no email, SMS or push is sent to staff), so the settings are the ones the app can honour: notifications on or off,
 * and which kinds to show. The notification lists, the Dashboard panel and the unread counts all use these rules.
 */
export type NotificationTypeKey = 'appointments' | 'reminders' | 'messages' | 'lab_results' | 'billing' | 'announcements';

export interface StaffNotificationPrefs {
  notificationsEnabled: boolean;
  /** A kind that is missing is shown (only a kind switched off is hidden) */
  types: Partial<Record<NotificationTypeKey, boolean>>;
}

export const DEFAULT_NOTIFICATION_PREFS: StaffNotificationPrefs = { notificationsEnabled: true, types: {} };

/** The kinds a person can switch off, in the order the settings list them, and the notifications each covers */
export const NOTIFICATION_TYPE_GROUPS: ReadonlyArray<{ key: NotificationTypeKey; label: string; covers: ReadonlyArray<SystemNotification['notification_type']> }> = [
  { key: 'appointments', label: 'Appointments', covers: ['appointment_cancelled', 'appointment_rescheduled', 'patient_arrived'] },
  { key: 'reminders', label: 'Reminders', covers: ['appointment_reminder'] },
  { key: 'messages', label: 'Messages', covers: ['new_message', 'document_shared'] },
  { key: 'lab_results', label: 'Results and reports', covers: ['lab_results', 'report_ready', 'prescription_ready'] },
  { key: 'billing', label: 'Billing', covers: ['invoice_generated', 'payment_received'] },
  { key: 'announcements', label: 'Announcements', covers: ['announcement'] }
];

const GROUP_OF_TYPE = new Map<string, NotificationTypeKey>(
  NOTIFICATION_TYPE_GROUPS.flatMap(group => group.covers.map(type => [type, group.key] as [string, NotificationTypeKey]))
);

/**
 * Emergencies, system alerts and urgent or critical notifications always show, whatever the settings: a person who
 * switched notifications off must still see an emergency. Kinds with no switch (tasks, leave, payroll) also show.
 */
export function isAlwaysShown(notification: Pick<SystemNotification, 'notification_type' | 'priority'>): boolean {
  if (notification.notification_type === 'emergency' || notification.notification_type === 'system_alert') return true;
  if (notification.priority === 'urgent' || notification.priority === 'critical') return true;
  return !GROUP_OF_TYPE.has(notification.notification_type);
}

/** Whether the person wants to see this notification */
export function wantsNotification(
  notification: Pick<SystemNotification, 'notification_type' | 'priority'>,
  prefs: StaffNotificationPrefs | null | undefined
): boolean {
  if (!prefs || isAlwaysShown(notification)) return true;
  if (!prefs.notificationsEnabled) return false;
  const group = GROUP_OF_TYPE.get(notification.notification_type);
  return !group || prefs.types[group] !== false;
}

/** True when the settings hide anything (then counts must be worked out from the notifications themselves) */
export function prefsHideSomething(prefs: StaffNotificationPrefs | null | undefined): boolean {
  if (!prefs) return false;
  return !prefs.notificationsEnabled || Object.values(prefs.types).some(value => value === false);
}

/** The settings from a stored row (columns notifications_enabled and type_preferences); anything odd means "show" */
export function prefsFromRow(row: { notifications_enabled?: unknown; type_preferences?: unknown } | null | undefined): StaffNotificationPrefs {
  if (!row) return DEFAULT_NOTIFICATION_PREFS;
  const types: Partial<Record<NotificationTypeKey, boolean>> = {};
  const stored = row.type_preferences && typeof row.type_preferences === 'object' ? row.type_preferences as Record<string, unknown> : {};
  for (const group of NOTIFICATION_TYPE_GROUPS) {
    if (stored[group.key] === false) types[group.key] = false;
  }
  return { notificationsEnabled: row.notifications_enabled !== false, types };
}

/** The columns written back (the row's other columns are left as they are) */
export function rowFromPrefs(prefs: StaffNotificationPrefs): { notifications_enabled: boolean; type_preferences: Record<NotificationTypeKey, boolean> } {
  const type_preferences = Object.fromEntries(
    NOTIFICATION_TYPE_GROUPS.map(group => [group.key, prefs.types[group.key] !== false])
  ) as Record<NotificationTypeKey, boolean>;
  return { notifications_enabled: prefs.notificationsEnabled, type_preferences };
}

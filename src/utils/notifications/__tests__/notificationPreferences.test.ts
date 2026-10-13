/**
 * Owner decision 13 Oct 2026: the notification settings must be real. These rules decide what the notification
 * lists, the Dashboard panel and the unread counts show, so a kind someone switched off really disappears, and an
 * emergency never does.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_TYPE_GROUPS,
  prefsFromRow,
  prefsHideSomething,
  rowFromPrefs,
  wantsNotification
} from '../notificationPreferences';

const note = (notification_type: string, priority = 'normal') =>
  ({ notification_type, priority } as Parameters<typeof wantsNotification>[0]);

describe('wantsNotification', () => {
  it('shows everything when the person has not chosen anything (no settings row yet)', () => {
    expect(wantsNotification(note('invoice_generated'), null)).toBe(true);
    expect(wantsNotification(note('invoice_generated'), DEFAULT_NOTIFICATION_PREFS)).toBe(true);
  });

  it('hides a kind the person switched off (billing off: no invoice or payment notices)', () => {
    const prefs = { notificationsEnabled: true, types: { billing: false } };
    expect(wantsNotification(note('invoice_generated'), prefs)).toBe(false);
    expect(wantsNotification(note('payment_received'), prefs)).toBe(false);
    expect(wantsNotification(note('appointment_cancelled'), prefs)).toBe(true);
  });

  it('notifications off hides every kind with a switch', () => {
    const prefs = { notificationsEnabled: false, types: {} };
    for (const group of NOTIFICATION_TYPE_GROUPS) {
      for (const type of group.covers) expect(wantsNotification(note(type), prefs)).toBe(false);
    }
  });

  it('an emergency, a system alert or anything urgent always shows, even with notifications off: safety comes first', () => {
    const off = { notificationsEnabled: false, types: { appointments: false } };
    expect(wantsNotification(note('emergency'), off)).toBe(true);
    expect(wantsNotification(note('system_alert'), off)).toBe(true);
    expect(wantsNotification(note('appointment_cancelled', 'urgent'), off)).toBe(true);
    expect(wantsNotification(note('patient_arrived', 'critical'), off)).toBe(true);
  });

  it('kinds without a switch (tasks, leave, payroll) keep showing: the settings never hide what they do not offer', () => {
    const off = { notificationsEnabled: false, types: {} };
    expect(wantsNotification(note('task_assigned'), off)).toBe(true);
    expect(wantsNotification(note('leave_request'), off)).toBe(true);
  });
});

describe('stored settings', () => {
  it('reads a saved row and writes every switch back (on unless switched off)', () => {
    const prefs = prefsFromRow({ notifications_enabled: true, type_preferences: { messages: false, billing: true } });
    expect(prefs.types).toEqual({ messages: false });
    expect(rowFromPrefs(prefs).type_preferences).toEqual({
      appointments: true, reminders: true, messages: false, lab_results: true, billing: true, announcements: true
    });
  });

  it('an odd stored value means "show" (a broken row must not silence notifications)', () => {
    expect(prefsFromRow({ notifications_enabled: null, type_preferences: 'x' })).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('only settings that hide something make the counts come from the notifications themselves', () => {
    expect(prefsHideSomething(null)).toBe(false);
    expect(prefsHideSomething({ notificationsEnabled: true, types: { reminders: true } })).toBe(false);
    expect(prefsHideSomething({ notificationsEnabled: true, types: { reminders: false } })).toBe(true);
    expect(prefsHideSomething({ notificationsEnabled: false, types: {} })).toBe(true);
  });
});

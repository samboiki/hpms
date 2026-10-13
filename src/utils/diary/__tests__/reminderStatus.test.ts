import { describe, it, expect } from 'vitest';
import {
  normalizeAppointmentSmsLog,
  normalizeAppointmentSmsReply,
  reminderStatusesByVisit,
  summarizeReminderStatus,
  type AppointmentSmsLog,
  type AppointmentSmsReply
} from '../reminderStatus';

const log = (overrides: Partial<AppointmentSmsLog> = {}): AppointmentSmsLog => ({
  id: 'l1',
  visitIds: ['v1'],
  messageType: 'appointment_reminder',
  status: 'delivered',
  createdAt: '2026-10-06T10:00:00Z',
  sentAt: '2026-10-06T10:00:05Z',
  failedAt: null,
  failureReason: null,
  metadata: { source: 'send-appointment-reminders' },
  ...overrides
});

const reply = (overrides: Partial<AppointmentSmsReply> = {}): AppointmentSmsReply => ({
  visitId: 'v1',
  intent: 'confirm',
  receivedAt: '2026-10-06T11:14:00Z',
  ...overrides
});

describe('summarizeReminderStatus', () => {
  it('shows "Confirmed by SMS" once the patient answers the reminder, the thing reception most wants to know', () => {
    const status = summarizeReminderStatus([log()], [reply()]);
    expect(status).toMatchObject({ tone: 'confirmed', label: 'Confirmed by SMS', icon: 'solar:check-circle-bold-duotone' });
    // Times show in the browser's own time zone; midday UTC keeps the date the same in any zone
    expect(status?.detail).toMatch(/^Patient confirmed by SMS on 6 Oct 2026, \d\d:\d\d\. Reminder delivered \(sent on 6 Oct 2026, \d\d:\d\d\)\.$/);
  });

  it('shows a cancellation or a request for a new time, so reception can offer the slot or call back', () => {
    expect(summarizeReminderStatus([log()], [reply({ intent: 'cancel' })])?.tone).toBe('cancelled');
    const moved = summarizeReminderStatus([log()], [reply({ intent: 'reschedule' })]);
    expect(moved?.label).toBe('Wants a new time');
    expect(moved?.detail).toContain('Call them to rebook.');
  });

  it('lets a newer reminder replace an old answer: a booking moved after "YES" is not confirmed any more', () => {
    const status = summarizeReminderStatus([log({ id: 'l2', createdAt: '2026-10-08T10:00:00Z', status: 'sent', sentAt: '2026-10-08T10:00:03Z' })], [reply()]);
    expect(status?.tone).toBe('sent');
    expect(status?.detail).toContain('Earlier: Patient confirmed by SMS');
  });

  it('flags a failed reminder with the reason, because that patient has not been told and needs a call', () => {
    const status = summarizeReminderStatus([log({ status: 'failed', failedAt: '2026-10-06T10:00:02Z', failureReason: 'Invalid number' })], []);
    expect(status).toMatchObject({ tone: 'failed', label: 'Reminder failed' });
    expect(status?.detail).toContain(': Invalid number. Call the patient.');
    // Over the SMS bundle the gateway logs "blocked": the patient was not told either
    expect(summarizeReminderStatus([log({ status: 'blocked' })], [])?.tone).toBe('failed');
  });

  it('calls a booking confirmation SMS by its own name, not a reminder', () => {
    expect(summarizeReminderStatus([log({ messageType: 'appointment_confirmation', status: 'pending' })], [])?.label).toBe('Booking SMS not sent yet');
  });

  it("ignores a waitlist offer linked to the visit: it offers someone else this slot, it does not remind this patient", () => {
    expect(summarizeReminderStatus([log({ metadata: { source: 'waitlist_notification' } })], [])).toBeNull();
    expect(summarizeReminderStatus([log({ messageType: 'birthday' })], [])).toBeNull();
  });

  it('shows nothing for a booking with no SMS at all, so practices that do not use SMS see clean cards', () => {
    expect(summarizeReminderStatus([], [])).toBeNull();
  });
});

describe('reading database rows', () => {
  it('links a log to the visit through visit_id or appointment_id (reminders log the visit as appointment_id)', () => {
    const row = normalizeAppointmentSmsLog({ id: 'l1', appointment_id: 'v1', visit_id: null, message_type: 'appointment_reminder', status: 'sent', created_at: '2026-10-06T10:00:00Z' });
    expect(row?.visitIds).toEqual(['v1']);
    const statuses = reminderStatusesByVisit(['v1', 'v2'], row ? [row] : [], []);
    expect([...statuses.keys()]).toEqual(['v1']);
  });

  it('only keeps replies that confirm, cancel or ask for a new time on a known visit', () => {
    expect(normalizeAppointmentSmsReply({ visit_id: 'v1', intent: 'confirm', received_at: '2026-10-06T11:14:00Z' })).not.toBeNull();
    expect(normalizeAppointmentSmsReply({ visit_id: 'v1', intent: 'rating', received_at: '2026-10-06T11:14:00Z' })).toBeNull();
    expect(normalizeAppointmentSmsReply({ visit_id: null, intent: 'confirm', received_at: '2026-10-06T11:14:00Z' })).toBeNull();
  });
});

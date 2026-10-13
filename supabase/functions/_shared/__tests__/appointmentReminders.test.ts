import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_REMINDER_SETTINGS,
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_REPLY_INVITE,
  SAMPLE_REMINDER_VALUES,
  clinicMinutes,
  formatReminderDate,
  normalizeReminderSettings,
  planDueReminders,
  planManualReminders,
  reminderBookingFromRow,
  reminderSlotKey,
  renderReminderMessage,
  sentReminderFromRow,
  summarizeSkipped,
  unknownReminderPlaceholders,
  validateReminderSettings,
  type ReminderBooking,
  type ReminderContext,
  type ReminderSettings,
  type SentReminder
} from '../appointmentReminders';

// Invented people and numbers. "Today" is Wednesday 7 Oct 2026; Windhoek is UTC+2.
const TODAY = '2026-10-07';
const TOMORROW = '2026-10-08';
/** A moment on 7 Oct 2026 at this Windhoek time */
const at = (hhmm: string, date = TODAY) => new Date(`${date}T${hhmm}:00+02:00`);

const booking = (overrides: Partial<ReminderBooking> = {}): ReminderBooking => ({
  visitId: 'visit-1',
  practiceId: 'practice-1',
  patientId: 'patient-1',
  practitionerId: 'pr-a',
  date: TOMORROW,
  time: '09:30',
  stage: 'scheduled',
  isConfirmed: true,
  createdAt: '2026-10-01T08:00:00Z',
  patientFirstName: 'Maria',
  patientLastName: 'Shikongo',
  cellNumber: '081 000 0001',
  smsOptOut: false,
  ...overrides
});

const settings = (overrides: Partial<ReminderSettings> = {}): ReminderSettings => ({ ...DEFAULT_REMINDER_SETTINGS, enabled: true, ...overrides });

const context = (overrides: Partial<ReminderContext> = {}): ReminderContext => ({
  now: at('10:05'),
  bookings: [booking()],
  sent: [],
  template: DEFAULT_REMINDER_TEMPLATE,
  practiceName: 'Ombili Family Practice',
  practicePhone: '061 000 000',
  practitionerName: (id) => (id === 'pr-a' ? 'Dr. T. Nghipandulwa' : null),
  repliesLive: false,
  ...overrides
});

const due = (overrides: Partial<ReminderContext> = {}, settingsOverrides: Partial<ReminderSettings> = {}) =>
  planDueReminders({ ...context(overrides), settings: settings(settingsOverrides) });

describe('reminder settings', () => {
  it('start switched off, so no practice is charged for SMS it did not ask for', () => {
    expect(normalizeReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(DEFAULT_REMINDER_SETTINGS.enabled).toBe(false);
  });

  it('read a saved row, and fall back to the defaults for anything unreadable', () => {
    expect(
      normalizeReminderSettings({
        reminders_enabled: true,
        reminder_day_before: false,
        reminder_day_before_time: '17:30:00',
        reminder_same_day: true,
        reminder_same_day_hours: 3,
        reminder_template: 'Hi {{patientFirstName}} {{appointmentDate}} {{appointmentTime}}'
      })
    ).toEqual({
      enabled: true,
      dayBefore: false,
      dayBeforeTime: '17:30',
      sameDay: true,
      sameDayHoursBefore: 3,
      template: 'Hi {{patientFirstName}} {{appointmentDate}} {{appointmentTime}}'
    });
    expect(normalizeReminderSettings({ reminder_same_day_hours: 40, reminder_day_before_time: 'soon' })).toMatchObject({
      sameDayHoursBefore: 2,
      dayBeforeTime: '10:00'
    });
  });

  it('refuse a night-time send, because a 23:00 SMS wakes patients and earns STOP replies', () => {
    const result = validateReminderSettings(settings({ dayBeforeTime: '23:00' }), false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/between 07:00 and 19:59/);
  });

  it('refuse a message without the date and time, which the patient cannot act on', () => {
    const result = validateReminderSettings(settings({ template: 'Hi {{patientFirstName}}, see you soon.' }), false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('{{appointmentDate}} and {{appointmentTime}}');
  });

  it('refuse placeholders a reminder cannot fill, so no patient receives "{{offer}}"', () => {
    expect(unknownReminderPlaceholders('{{offer}} on {{appointmentDate}} {{offer}} {{doctorName}}')).toEqual(['{{offer}}']);
    const result = validateReminderSettings(settings({ template: `${DEFAULT_REMINDER_TEMPLATE} {{offer}}` }), false);
    expect(result.ok).toBe(false);
  });

  it('refuse "on" with nothing to send, which would look switched on and send nothing', () => {
    expect(validateReminderSettings(settings({ dayBefore: false, sameDay: false }), false).ok).toBe(false);
  });

  it('accept good settings and tidy the time', () => {
    const result = validateReminderSettings(settings({ dayBeforeTime: '9:05', sameDay: true, sameDayHoursBefore: 2 }), false);
    expect(result).toEqual({ ok: true, settings: expect.objectContaining({ dayBeforeTime: '09:05', sameDay: true }) });
  });

  // A practice's own "Reply 2 to cancel" makes the same false promise as the old default while nobody reads replies
  it('refuse a message that asks patients to reply while their replies are not collected', () => {
    const askingForReplies = settings({ template: `${DEFAULT_REMINDER_TEMPLATE} Reply YES to confirm.` });
    const refused = validateReminderSettings(askingForReplies, false);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.errors.join(' ')).toMatch(/replies are not collected yet/);
    expect(validateReminderSettings(askingForReplies, true).ok).toBe(true);
  });

  it('read a message saved with the old reply line as the practice\'s own text without it', () => {
    expect(normalizeReminderSettings({ reminder_template: `${DEFAULT_REMINDER_TEMPLATE} ${REMINDER_REPLY_INVITE}` }).template).toBe(DEFAULT_REMINDER_TEMPLATE);
  });
});

describe('the reminder SMS', () => {
  const values = { ...SAMPLE_REMINDER_VALUES, practiceName: 'Ombili Family Practice' };

  // Until the practice's replies are collected, "Reply 2 to cancel" would make a patient believe a booking is
  // cancelled that nobody ever cancels
  it('asks for no reply until the practice\'s replies are collected', () => {
    expect(renderReminderMessage(DEFAULT_REMINDER_TEMPLATE, values)).toBe(
      'Ombili Family Practice: Hi Maria, reminder: appointment with Dr. T. Nghipandulwa on Thu 8 Oct at 09:30.'
    );
    expect(due().due[0].message).not.toMatch(/reply/i);
    expect(planManualReminders({ ...context(), date: TOMORROW }).due[0].message).not.toMatch(/reply/i);
  });

  it('adds the reply line the webhook understands once replies are collected, still within one SMS (one credit)', () => {
    const message = due({ repliesLive: true }).due[0].message;
    expect(message).toBe(
      'Ombili Family Practice: Hi Maria, reminder: appointment with Dr. T. Nghipandulwa on Thu 8 Oct at 09:30. Reply 1 to confirm, 2 to cancel, 3 for a new time.'
    );
    expect(message.length).toBeLessThanOrEqual(160);
    expect(planManualReminders({ ...context({ repliesLive: true }), date: TOMORROW }).due[0].message.endsWith(REMINDER_REPLY_INVITE)).toBe(true);
  });

  it('never shows braces or a double space when a value is missing', () => {
    const text = renderReminderMessage('{{practiceName}}: Hi {{patientFirstName}}, call {{practicePhone}} about {{appointmentDate}}.', {
      appointmentDate: 'Thu 8 Oct'
    });
    expect(text).toBe('Your clinic: Hi, call about Thu 8 Oct.');
    expect(text).not.toMatch(/\{\{|\s{2}/);
  });

  it('reads "with us" when the booking has no practitioner, instead of a broken sentence', () => {
    expect(renderReminderMessage('appointment with {{practitionerName}} at {{appointmentTime}}', { appointmentTime: '09:30' })).toBe(
      'appointment with us at 09:30'
    );
  });

  it('fills the {{doctorName}} of older templates like the practitioner', () => {
    expect(renderReminderMessage('with {{doctorName}}', { practitionerName: 'Sr. A. Hamutenya' })).toBe('with Sr. A. Hamutenya');
  });

  it('writes the date day first with the weekday, as patients read it', () => {
    expect(formatReminderDate('2026-10-08')).toBe('Thu 8 Oct');
  });
});

describe('reminderBookingFromRow', () => {
  it('reads a visit with its patient, preferring the booked date over the visit date', () => {
    expect(
      reminderBookingFromRow({
        id: 'v1',
        practice_id: 'p1',
        patient_id: 'pt1',
        doctor_id: 'd1',
        status: 'scheduled',
        is_confirmed: true,
        scheduled_date: '2026-10-08',
        scheduled_time: '09:30:00',
        visit_date: '2026-10-01',
        visit_time: '08:00:00',
        created_at: '2026-10-01T08:00:00Z',
        patient: [{ first_name: 'Maria', last_name: 'Shikongo', cell_number: '0810000001', sms_opt_out: true }]
      })
    ).toMatchObject({ visitId: 'v1', date: '2026-10-08', time: '09:30', stage: 'scheduled', isConfirmed: true, smsOptOut: true });
  });

  it('knows a checked-in patient is no longer just booked', () => {
    expect(reminderBookingFromRow({ id: 'v1', practice_id: 'p1', is_checked_in: true, status: 'scheduled' })?.stage).toBe('checked-in');
    expect(reminderBookingFromRow({ id: 'v1' })).toBeNull();
  });
});

describe('planDueReminders (the schedule)', () => {
  it('sends tomorrow\'s reminders from the chosen time, with the date, time and practitioner filled in', () => {
    const plan = due();
    expect(plan.due).toHaveLength(1);
    expect(plan.due[0]).toMatchObject({ kind: 'day_before', slotKey: '2026-10-08T09:30', phone: '+264810000001' });
    expect(plan.due[0].message).toContain('with Dr. T. Nghipandulwa on Thu 8 Oct at 09:30');
  });

  it('waits until the chosen time, so a 10:00 setting does not send at 07:00', () => {
    expect(due({ now: at('09:50') }).due).toEqual([]);
  });

  it('sends nothing when the practice has not switched reminders on', () => {
    expect(due({}, { enabled: false })).toEqual({ due: [], skipped: [] });
  });

  it('keeps quiet at night even when a run was missed, so nobody is woken by a reminder', () => {
    expect(due({ now: at('06:45') }, { dayBeforeTime: '07:00' }).due).toEqual([]);
    expect(due({ now: at('20:10') }).due).toEqual([]);
    // 23:30 UTC is already 01:30 on 8 Oct in Windhoek
    expect(due({ now: new Date('2026-10-07T23:30:00Z') }).due).toEqual([]);
    expect(clinicMinutes(new Date('2026-10-07T23:30:00Z'))).toBe(90);
  });

  it('never reminds the same booking twice for the same slot', () => {
    const sent: SentReminder[] = [{ visitId: 'visit-1', kind: 'day_before', slotKey: '2026-10-08T09:30', status: 'sent' }];
    const plan = due({ sent });
    expect(plan.due).toEqual([]);
    expect(plan.skipped).toEqual([expect.objectContaining({ reason: 'already_reminded' })]);
  });

  it('reminds again when the booking was moved to a new time, because the patient needs the new time', () => {
    const sent: SentReminder[] = [{ visitId: 'visit-1', kind: 'day_before', slotKey: '2026-10-08T08:00', status: 'sent' }];
    expect(due({ sent }).due).toHaveLength(1);
  });

  it('does not retry a reminder that failed: reception sees it and calls instead of a second SMS', () => {
    const sent: SentReminder[] = [{ visitId: 'visit-1', kind: 'day_before', slotKey: '2026-10-08T09:30', status: 'failed', error: 'No active SMS subscription' }];
    expect(due({ sent }).skipped).toEqual([expect.objectContaining({ reason: 'failed_before', detail: 'No active SMS subscription' })]);
  });

  it('skips a booking made after the reminders went out: the patient has just spoken to reception', () => {
    expect(due({ bookings: [booking({ createdAt: '2026-10-07T09:00:00Z' })] }).skipped).toEqual([
      expect.objectContaining({ reason: 'booked_after_send_time' })
    ]);
  });

  it('respects STOP, a missing cell number, unconfirmed requests and bookings no longer waiting', () => {
    const plan = due({
      bookings: [
        booking({ visitId: 'opted-out', smsOptOut: true }),
        booking({ visitId: 'no-cell', cellNumber: '12' }),
        booking({ visitId: 'request', isConfirmed: false }),
        booking({ visitId: 'cancelled', stage: 'cancelled' }),
        booking({ visitId: 'no-time', time: null })
      ]
    });
    expect(plan.due).toEqual([]);
    expect(Object.fromEntries(plan.skipped.map((item) => [item.booking.visitId, item.reason]))).toEqual({
      'opted-out': 'opted_out',
      'no-cell': 'no_cell_number',
      request: 'not_confirmed',
      cancelled: 'not_scheduled',
      'no-time': 'no_time'
    });
  });

  it('sends the same-day reminder from N hours before until the appointment starts', () => {
    const today = booking({ date: TODAY, time: '13:00', createdAt: '2026-10-01T08:00:00Z' });
    expect(due({ bookings: [today], now: at('10:30') }, { sameDay: true, sameDayHoursBefore: 2 }).due).toEqual([]);
    expect(due({ bookings: [today], now: at('11:00') }, { sameDay: true, sameDayHoursBefore: 2 }).due).toEqual([
      expect.objectContaining({ kind: 'same_day', slotKey: '2026-10-07T13:00' })
    ]);
    expect(due({ bookings: [today], now: at('13:05') }, { sameDay: true }).due).toEqual([]);
  });

  it('keeps the day-before and same-day reminders apart, so both can go when both are on', () => {
    const sent: SentReminder[] = [{ visitId: 'visit-1', kind: 'day_before', slotKey: '2026-10-07T13:00', status: 'sent' }];
    const today = booking({ date: TODAY, time: '13:00' });
    expect(due({ bookings: [today], sent, now: at('11:30') }, { sameDay: true }).due).toHaveLength(1);
  });
});

describe('planManualReminders ("Remind patients" by hand)', () => {
  const manual = (overrides: Partial<ReminderContext> = {}, date = TOMORROW) => planManualReminders({ ...context(overrides), date });

  it('includes every booking of the chosen day, whatever the time and the schedule switch', () => {
    const plan = manual({ now: at('07:40'), bookings: [booking(), booking({ visitId: 'visit-2', time: '16:00', createdAt: '2026-10-07T07:30:00Z' })] });
    expect(plan.due.map((item) => item.booking.visitId)).toEqual(['visit-1', 'visit-2']);
    expect(plan.due.every((item) => item.kind === 'day_before')).toBe(true);
  });

  it("uses the schedule's day-before key, so the schedule does not send the same reminder again later", () => {
    const fromReception = manual().due[0];
    const sent: SentReminder[] = [{ visitId: fromReception.booking.visitId, kind: fromReception.kind, slotKey: fromReception.slotKey, status: 'sent' }];
    expect(due({ sent }).due).toEqual([]);
  });

  it("treats today's bookings as the same-day reminder and leaves out appointments already past", () => {
    const plan = manual({ now: at('10:00'), bookings: [booking({ date: TODAY, time: '09:00' }), booking({ visitId: 'later', date: TODAY, time: '15:00' })] }, TODAY);
    expect(plan.due).toEqual([expect.objectContaining({ kind: 'same_day', slotKey: '2026-10-07T15:00' })]);
    expect(plan.skipped).toEqual([expect.objectContaining({ reason: 'past' })]);
  });

  it('sends nothing for a day that has gone', () => {
    expect(manual({}, '2026-10-06')).toEqual({ due: [], skipped: [] });
  });

  it('counts the reasons for the summary line, most common first', () => {
    const plan = manual({ bookings: [booking({ visitId: 'a', smsOptOut: true }), booking({ visitId: 'b', smsOptOut: true }), booking({ visitId: 'c', cellNumber: null })] });
    expect(summarizeSkipped(plan.skipped)).toEqual([
      { reason: 'opted_out', count: 2 },
      { reason: 'no_cell_number', count: 1 }
    ]);
  });
});

describe('the dedupe key and the log', () => {
  it('is the day and the minute of the slot', () => {
    expect(reminderSlotKey('2026-10-08', '09:30:00')).toBe('2026-10-08T09:30');
  });

  it('reads diary_reminder_log rows and ignores unknown kinds', () => {
    expect(sentReminderFromRow({ visit_id: 'v', kind: 'day_before', slot_key: '2026-10-08T09:30', status: 'sent' })).toEqual({
      visitId: 'v',
      kind: 'day_before',
      slotKey: '2026-10-08T09:30',
      status: 'sent',
      error: null
    });
    expect(sentReminderFromRow({ visit_id: 'v', kind: 'weekly', slot_key: 'x' })).toBeNull();
  });
});

describe('the SQL proposal', () => {
  const sql = readFileSync('proposals/2026-10-07-diary-2.sql', 'utf8');

  // The applied column default still ends in the reply line: a row created with it must read as the app's default,
  // so a new practice never sends a reply request before its replies are collected
  it('has a column default that reads as the app\'s default message', () => {
    const columnDefault = /reminder_template\s+text NOT NULL DEFAULT '((?:[^']|'')*)'/.exec(sql)?.[1]?.replace(/''/g, "'");
    expect(columnDefault).toBeDefined();
    expect(normalizeReminderSettings({ reminder_template: columnDefault }).template).toBe(DEFAULT_REMINDER_TEMPLATE);
  });

  it('allows the same reminder kinds and statuses as the code', () => {
    expect(sql).toContain("kind IN ('day_before', 'same_day')");
    expect(sql).toContain("status IN ('sending', 'sent', 'failed')");
  });
});

describe('a video booking\'s reminder ({{videoLink}})', () => {
  const ROOM = 'https://meet.jit.si/hpms-invented-room';
  const template = '{{practiceName}}: Hi {{patientFirstName}}, video visit on {{appointmentDate}} at {{appointmentTime}}.\nJoin the call: {{videoLink}}';

  it('is a placeholder the reminder settings accept', () => {
    expect(unknownReminderPlaceholders(template)).toEqual([]);
  });

  // A patient seen in the rooms must not get "Join the call:" with nothing after it
  it('carries the room link, and leaves the link line out whole for a booking seen in the rooms', () => {
    const values = { ...SAMPLE_REMINDER_VALUES, practiceName: 'Ombili Family Practice', videoLink: ROOM };
    expect(renderReminderMessage(template, values)).toBe(
      `Ombili Family Practice: Hi Maria, video visit on Thu 8 Oct at 09:30.\nJoin the call: ${ROOM}`
    );
    expect(renderReminderMessage(template, { ...values, videoLink: null })).toBe('Ombili Family Practice: Hi Maria, video visit on Thu 8 Oct at 09:30.');
  });

  it('drops only the link from a line that also carries the date or time, so the patient still learns when', () => {
    expect(renderReminderMessage('Visit on {{appointmentDate}} {{videoLink}}', { appointmentDate: 'Thu 8 Oct' })).toBe('Visit on Thu 8 Oct');
  });

  it('reads the booking\'s link only when it is a secure (https) link', () => {
    expect(reminderBookingFromRow({ id: 'v1', practice_id: 'p1', video_link: ` ${ROOM} ` })?.videoLink).toBe(ROOM);
    expect(reminderBookingFromRow({ id: 'v1', practice_id: 'p1', video_link: 'http://meet.example.com/room' })?.videoLink).toBeNull();
    expect(reminderBookingFromRow({ id: 'v1', practice_id: 'p1' })?.videoLink).toBeNull();
  });

  it('sends each patient their own booking\'s room', () => {
    const plan = due({ bookings: [booking({ videoLink: ROOM }), booking({ visitId: 'visit-2', patientId: 'patient-2', time: '10:00' })] }, { template });
    const messageFor = (visitId: string) => plan.due.find((item) => item.booking.visitId === visitId)?.message;
    expect(messageFor('visit-1')).toContain(`Join the call: ${ROOM}`);
    expect(messageFor('visit-2')).toBe('Ombili Family Practice: Hi Maria, video visit on Thu 8 Oct at 10:00.');
  });
});

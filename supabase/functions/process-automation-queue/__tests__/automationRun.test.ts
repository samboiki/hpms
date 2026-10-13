import { describe, it, expect } from 'vitest';
import {
  claimedAutomationFromRow,
  classifyGatewayResponse,
  planAutomation,
  runAutomations,
  type AutomationRepository,
  type ChannelSend,
  type ClaimedAutomation,
  type SendResult
} from '../automationRun';

// Invented people and practices: none of these exist anywhere.
const NOW = new Date('2026-10-08T08:00:00Z'); // 10:00 in Windhoek

const row = (overrides: Record<string, unknown> = {}) => ({
  queue_id: 'q-1',
  practice_id: 'practice-1',
  automation_id: 'welcome-new-patient',
  queued_at: '2026-10-08T07:55:00Z',
  settings: { enabled: true, sms_enabled: true, email_enabled: true, sms_template: null, email_subject: null, email_body: null },
  practice: { name: 'Eros Family Clinic', contact_phone: '061 123 456' },
  patient: { id: 'p-1', first_name: 'Maria', last_name: 'Shikongo', cell_number: '081 000 0001', email: 'maria@example.com', sms_opt_out: false },
  visit: null,
  ...overrides
});

const item = (overrides: Record<string, unknown> = {}): ClaimedAutomation => {
  const parsed = claimedAutomationFromRow(row(overrides));
  if (!parsed) throw new Error('test row has no queue id');
  return parsed;
};

const booking = (overrides: Record<string, unknown> = {}) => ({
  id: 'v-1',
  patient_id: 'p-1',
  status: 'scheduled',
  is_confirmed: true,
  is_cancelled: false,
  is_checked_in: false,
  is_ready: false,
  is_handoff: false,
  scheduled_date: '2026-10-09',
  scheduled_time: '09:30:00',
  visit_date: '2026-10-09',
  visit_time: '09:30:00',
  practitioner_name: 'Dr. T. Nghipandulwa',
  ...overrides
});

const confirmation = (visitOverrides: Record<string, unknown> = {}, rowOverrides: Record<string, unknown> = {}) =>
  item({
    automation_id: 'appointment-confirmation',
    settings: { enabled: true, sms_enabled: true, email_enabled: false },
    visit: booking(visitOverrides),
    ...rowOverrides
  });

/** A fake gateway and database: records every send and every finish. */
function fakeRepository(options: { sendThrows?: boolean; answer?: SendResult; finishThrowsFor?: string[] } = {}) {
  const sends: Array<{ queueId: string; send: ChannelSend }> = [];
  const finishes: Array<{ queueId: string; sent: boolean; note: string }> = [];
  const repo: AutomationRepository = {
    async send(claimed, send) {
      sends.push({ queueId: claimed.queueId, send });
      if (options.sendThrows) throw new Error('gateway unreachable');
      return options.answer ?? { ok: true, category: 'sent' };
    },
    async finish(queueId, sent, note) {
      if (options.finishThrowsFor?.includes(queueId)) throw new Error('database unreachable');
      finishes.push({ queueId, sent, note });
    }
  };
  return { repo, sends, finishes };
}

describe('an item is never left in processing', () => {
  // A claimed item that is not finished stays 'processing' until the stuck-item release: the screen would show it as
  // waiting and the practice would not know whether the patient got the message
  it('finishes every claimed item exactly once, even when the gateway cannot be reached', async () => {
    const items = [item({ queue_id: 'q-1' }), item({ queue_id: 'q-2' }), confirmation({}, { queue_id: 'q-3' })];
    const { repo, finishes } = fakeRepository({ sendThrows: true });
    const summary = await runAutomations(items, repo, NOW);
    expect(finishes.map((finish) => finish.queueId)).toEqual(['q-1', 'q-2', 'q-3']);
    expect(finishes.every((finish) => finish.sent === false)).toBe(true);
    expect(summary).toMatchObject({ claimed: 3, sent: 0, notSent: 3, finishFailed: 0 });
  });

  it('finishes an item it cannot even read', async () => {
    const unreadable = claimedAutomationFromRow({ queue_id: 'q-9', automation_id: 'birthday-wishes', settings: 'junk', patient: 42 });
    expect(unreadable).not.toBeNull();
    const { repo, finishes, sends } = fakeRepository();
    await runAutomations([unreadable as ClaimedAutomation], repo, NOW);
    expect(sends).toHaveLength(0);
    expect(finishes).toEqual([{ queueId: 'q-9', sent: false, note: 'Not sent: this automation is not offered' }]);
  });

  // The next run settles it from the message logs; this run must still finish the others
  it('keeps going when one outcome cannot be recorded', async () => {
    const { repo, finishes } = fakeRepository({ finishThrowsFor: ['q-1'] });
    const summary = await runAutomations([item({ queue_id: 'q-1' }), item({ queue_id: 'q-2' })], repo, NOW);
    expect(finishes.map((finish) => finish.queueId)).toEqual(['q-2']);
    expect(summary.finishFailed).toBe(1);
  });

  it('a row without a queue id is not an item (it could never be finished)', () => {
    expect(claimedAutomationFromRow({ automation_id: 'welcome-new-patient' })).toBeNull();
  });
});

describe('the welcome message', () => {
  it('goes by SMS and email to a new patient with both', () => {
    const plan = planAutomation(item(), NOW);
    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') return;
    expect(plan.sends.map((send) => send.channel)).toEqual(['sms', 'email']);
    const sms = plan.sends[0];
    expect(sms.channel === 'sms' && sms.to).toBe('+264810000001');
    expect(sms.channel === 'sms' && sms.message).toContain('Welcome, Maria!');
    // 'general' is non-essential in smsMessagePolicy.ts, so the gateway also refuses it for a patient who replied STOP
    expect(sms.channel === 'sms' && sms.messageType).toBe('general');
  });

  // Nothing to send to: the item is closed with the reason, and no SMS or email is attempted (or paid for)
  it('is not sent to a patient without a cell number or email', async () => {
    const { repo, sends, finishes } = fakeRepository();
    await runAutomations([item({ patient: { id: 'p-2', first_name: 'Jo', last_name: 'K', cell_number: null, email: null } })], repo, NOW);
    expect(sends).toHaveLength(0);
    expect(finishes[0]).toMatchObject({ sent: false, note: 'Not sent: no cell number; no email address' });
  });

  // STOP means no automatic SMS (the owner's rule for reminders); email is a different channel the patient gave us
  it('skips the SMS for a patient who replied STOP, and still sends the email', async () => {
    const { repo, sends, finishes } = fakeRepository();
    await runAutomations([item({ patient: { ...row().patient, sms_opt_out: true } })], repo, NOW);
    expect(sends.map((entry) => entry.send.channel)).toEqual(['email']);
    expect(finishes[0]).toEqual({ queueId: 'q-1', sent: true, note: 'Email sent; SMS not sent: the patient replied STOP' });
  });

  it('is not sent days late (when the scheduler was off), because a late welcome reads oddly', () => {
    const plan = planAutomation(item({ queued_at: '2026-10-04T08:00:00Z' }), NOW);
    expect(plan).toEqual({ kind: 'skip', reason: 'too_late' });
  });

  // A practice that switched the card off after the item was queued gets nothing (the claim also closes such items)
  it('is not sent once the practice switched it off', async () => {
    const { repo, sends, finishes } = fakeRepository();
    await runAutomations([item({ settings: { enabled: false } }), item({ queue_id: 'q-2', settings: null })], repo, NOW);
    expect(sends).toHaveLength(0);
    expect(finishes.map((finish) => finish.note)).toEqual(['Not sent: the automation was switched off', 'Not sent: the automation was switched off']);
  });

  it('sends an older HTML email as HTML, with the name escaped', () => {
    const plan = planAutomation(item({ settings: { ...row().settings, email_body: '<p>Welcome {{patientName}}</p>' }, patient: { ...row().patient, last_name: '<b>S</b>' } }), NOW);
    expect(plan.kind === 'send' && plan.sends[1]).toMatchObject({ channel: 'email', text: null, html: '<p>Welcome Maria &lt;b&gt;S&lt;/b&gt;</p>' });
  });
});

describe('the booking confirmation', () => {
  it('says when and with whom, and is linked as an appointment message (replies 2 and 3 work)', () => {
    const live = confirmation();
    const plan = planAutomation({ ...live, practice: { ...live.practice, repliesLive: true } }, NOW);
    expect(plan.kind).toBe('send');
    if (plan.kind !== 'send') return;
    expect(plan.sends).toHaveLength(1);
    expect(plan.sends[0]).toMatchObject({
      channel: 'sms',
      messageType: 'appointment_confirmation',
      message: 'Eros Family Clinic: Hi Maria, you are booked with Dr. T. Nghipandulwa on Fri 9 Oct at 09:30. Reply 2 to cancel, 3 for a new time.'
    });
  });

  // The claim does not say whether the practice's replies are collected; until the sender has looked it up (and
  // support switched it on), "Reply 2 to cancel" would promise a cancellation nobody makes
  it('asks for no reply while the practice\'s replies are not collected', () => {
    const plan = planAutomation(confirmation(), NOW);
    expect(confirmation().practice.repliesLive).toBe(false);
    expect(plan.kind === 'send' && plan.sends[0]).toMatchObject({
      message: 'Eros Family Clinic: Hi Maria, you are booked with Dr. T. Nghipandulwa on Fri 9 Oct at 09:30.'
    });
    const welcome = planAutomation(item({ settings: { ...row().settings, sms_template: 'Hi {{patientFirstName}}! Reply STOP to opt out.' } }), NOW);
    expect(welcome.kind === 'send' && welcome.sends[0]).toMatchObject({ channel: 'sms', message: 'Hi Maria!' });
  });

  // The booking is read as it is when the message goes: a cancelled, unconfirmed, started or past booking must not
  // get a "you are booked" SMS
  it.each([
    [{ is_cancelled: true }, 'booking_cancelled'],
    [{ status: 'cancelled' }, 'booking_cancelled'],
    [{ is_confirmed: false }, 'booking_not_confirmed'],
    [{ is_checked_in: true }, 'booking_started'],
    [{ scheduled_date: '2026-10-08', scheduled_time: '09:59:00' }, 'booking_passed'],
    [{ scheduled_date: null, visit_date: null }, 'booking_no_date'],
    [{ patient_id: 'someone-else' }, 'booking_missing']
  ])('is not sent for a booking that changed (%o)', (visit, reason) => {
    expect(planAutomation(confirmation(visit), NOW)).toEqual({ kind: 'skip', reason });
  });

  it('is not sent when the booking no longer exists', () => {
    expect(planAutomation(item({ automation_id: 'appointment-confirmation', visit: null }), NOW)).toEqual({ kind: 'skip', reason: 'booking_missing' });
  });

  it('is not sent by SMS to a patient who replied STOP (same rule as the diary reminders)', () => {
    const plan = planAutomation(confirmation({}, { patient: { ...row().patient, sms_opt_out: true } }), NOW);
    expect(plan).toEqual({ kind: 'send', sends: [], unused: [{ channel: 'sms', reason: 'opted_out' }] });
  });
});

describe('what is recorded on the item', () => {
  // Staff and support read these notes; they must never carry a patient's name, number or the message itself
  it('holds the reason in plain words and no personal data', async () => {
    const { repo, finishes } = fakeRepository({ answer: { ok: false, category: 'limit_reached' } });
    await runAutomations([item()], repo, NOW);
    const note = finishes[0].note;
    expect(note).toBe('Not sent: the SMS bundle is used up for this month; the email bundle is used up for this month');
    for (const secret of ['Maria', 'Shikongo', '081', '+264', 'maria@example.com', 'Welcome,']) expect(note).not.toContain(secret);
  });

  it('sorts the gateways answers into reasons without keeping their text', () => {
    expect(classifyGatewayResponse(200, { success: true })).toEqual({ ok: true, category: 'sent' });
    expect(classifyGatewayResponse(403, { success: false, code: 'PATIENT_OPTED_OUT' }).category).toBe('opted_out');
    expect(classifyGatewayResponse(403, { error: 'SMS subscription limit reached for this billing period' }).category).toBe('limit_reached');
    expect(classifyGatewayResponse(403, { error: 'No active SMS subscription found for this practice' }).category).toBe('no_subscription');
    expect(classifyGatewayResponse(500, { error: "Not a dialable phone number: check the patient's cell number" }).category).toBe('bad_number');
    expect(classifyGatewayResponse(401, { error: 'Sign in' }).category).toBe('refused');
    expect(classifyGatewayResponse(400, { error: 'Destination +264810000001 rejected' }).category).toBe('failed');
    // A 200 without success is not a sent message
    expect(classifyGatewayResponse(200, {}).ok).toBe(false);
  });
});

describe('the booking confirmation of a video booking', () => {
  const ROOM = 'https://meet.jit.si/hpms-invented-room';
  const settings = { enabled: true, sms_enabled: true, email_enabled: false, sms_template: 'Hi {{patientFirstName}}, booked for {{appointmentDate}} at {{appointmentTime}}.\nJoin the call: {{videoLink}}' };

  // The confirmation is the first message a video patient gets: it carries the room, and a patient coming to the rooms
  // gets no "Join the call:" line
  it('carries the booking\'s own room link, and leaves the line out for a booking in the rooms', () => {
    const video = planAutomation(confirmation({ video_link: ROOM }, { settings }), NOW);
    expect(video.kind === 'send' && video.sends[0]).toMatchObject({ message: `Hi Maria, booked for Fri 9 Oct at 09:30.\nJoin the call: ${ROOM}` });
    const rooms = planAutomation(confirmation({}, { settings }), NOW);
    expect(rooms.kind === 'send' && rooms.sends[0]).toMatchObject({ message: 'Hi Maria, booked for Fri 9 Oct at 09:30.' });
  });

  it('never puts a link that is not secure (https) in the message', () => {
    expect(confirmation({ video_link: 'http://meet.example.com/room' }).visit?.videoLink).toBeNull();
    expect(confirmation({ video_link: ROOM }).visit?.videoLink).toBe(ROOM);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_AUTOMATION, type ListAutomationSettings } from '../listAutomation';
import type { ListMember, PatientFacts } from '../listRules';
import { countSkips, planListSend, runListSend, type SendAttempt, type SendPlan } from '../listSend';

const TODAY = '2026-10-07';
const practice = { name: 'Eros Family Clinic', phone: '061 123 456' };

const member = (id: string, factOverrides: Partial<PatientFacts> = {}, overrides: Partial<ListMember> = {}): ListMember => ({
  patientId: id,
  facts: {
    patientId: id,
    firstName: `First${id}`,
    lastName: `Last${id}`,
    dateOfBirth: '1986-10-07',
    cellNumber: '081 123 4567',
    smsOptOut: false,
    lastCompletedVisitOn: '2026-03-03',
    lastCompletedByType: {},
    completedVisitsLastYear: 1,
    nextBookingOn: null,
    nextBookingTime: null,
    lastNoShowOn: null,
    balanceDue: 0,
    oldestUnpaidOn: null,
    ...factOverrides
  },
  automatic: true,
  manual: false,
  addedAt: null,
  lastSentAt: null,
  lastSentPeriod: null,
  ...overrides
});

const birthdays: ListAutomationSettings = {
  ...DEFAULT_AUTOMATION,
  template: 'Happy birthday, {{first_name}}! From all of us at {{practice_name}}.',
  schedule: 'birthday_morning',
  sendTime: '08:00',
  repeat: 'year'
};

const plan = (members: ListMember[], settings: ListAutomationSettings = birthdays) =>
  planListSend({ members, settings, practice, todayKey: TODAY });

describe('planListSend (the preview staff confirm)', () => {
  it('skips an opted-out patient and the preview says so', () => {
    const result = plan([member('1'), member('2', { smsOptOut: true })]);
    expect(result.recipients.map((r) => r.patientId)).toEqual(['1']);
    expect(result.skipped).toEqual([{ patientId: '2', name: 'First2 Last2', reason: 'opted_out', detail: null }]);
  });

  it('does not greet a patient twice in one year: one already greeted this year is skipped', () => {
    const result = plan([member('1', {}, { lastSentPeriod: '2026' }), member('2', {}, { lastSentPeriod: '2025' })]);
    expect(result.recipients.map((r) => r.patientId)).toEqual(['2']);
    expect(result.skipped[0]).toMatchObject({ patientId: '1', reason: 'already_sent' });
    expect(result.periodKey).toBe('2026');
  });

  it('skips patients without a usable cell number and shows the number that is wrong', () => {
    const result = plan([member('1', { cellNumber: null }), member('2', { cellNumber: '12' })]);
    expect(result.recipients).toEqual([]);
    expect(result.skipped.map((s) => [s.reason, s.detail])).toEqual([
      ['no_cell', null],
      ['invalid_cell', '12']
    ]);
  });

  it('on birthday mornings only greets patients whose birthday is today; the rest wait for their day', () => {
    const result = plan([member('1'), member('2', { dateOfBirth: '1990-10-20' })]);
    expect(result.recipients.map((r) => r.patientId)).toEqual(['1']);
    expect(result.notDueToday).toBe(1);
    expect(result.skipped).toEqual([]);
  });

  it('greets a 29 February patient on 28 February 2027', () => {
    const leapling = member('1', { dateOfBirth: '2000-02-29' });
    const result = planListSend({ members: [leapling], settings: birthdays, practice, todayKey: '2027-02-28' });
    expect(result.recipients).toHaveLength(1);
  });

  it('skips a patient who lacks a detail the message needs and says which one', () => {
    const settings = { ...birthdays, schedule: 'manual' as const, template: 'See you on {{appointment_date}}' };
    const result = plan([member('1')], settings);
    expect(result.skipped).toEqual([
      { patientId: '1', name: 'First1 Last1', reason: 'missing_details', detail: 'no upcoming appointment' }
    ]);
  });

  it('sends to the normalised international number and counts the SMS parts that will be charged', () => {
    const result = plan([member('1')]);
    expect(result.recipients[0]).toMatchObject({
      phone: '+264811234567',
      text: 'Happy birthday, First1! From all of us at Eros Family Clinic.',
      parts: 1
    });
    expect(result.totalParts).toBe(1);
  });

  it('counts skips per reason so the preview can say "3 have no cell number"', () => {
    const result = plan([member('1', { cellNumber: null }), member('2', { cellNumber: null }), member('3', { smsOptOut: true })]);
    expect(countSkips(result.skipped)).toEqual([
      { reason: 'no_cell', count: 2 },
      { reason: 'opted_out', count: 1 }
    ]);
  });
});

describe('runListSend (gateway mocked)', () => {
  const sendPlan = (count: number): SendPlan => ({
    periodKey: '2026',
    recipients: Array.from({ length: count }, (_, i) => ({
      patientId: `p${i + 1}`,
      name: `Patient ${i + 1}`,
      phone: '+264811234567',
      text: 'Hi',
      parts: 1
    })),
    skipped: [],
    notDueToday: 0,
    totalParts: count
  });

  const deps = (send: (id: string) => SendAttempt, claimed?: (ids: string[]) => string[]) => {
    const released: string[] = [];
    const sentTo: string[] = [];
    return {
      released,
      sentTo,
      claim: vi.fn(async (ids: string[]) => (claimed ? claimed(ids) : ids)),
      send: vi.fn(async (recipient: { patientId: string }) => {
        sentTo.push(recipient.patientId);
        return send(recipient.patientId);
      }),
      release: vi.fn(async (id: string) => {
        released.push(id);
      })
    };
  };

  it('claims each patient before sending, so a patient already claimed by another run is not sent twice', async () => {
    const d = deps(() => ({ ok: true, logId: 'log' }), (ids) => ids.filter((id) => id !== 'p2'));
    const result = await runListSend(sendPlan(3), d);
    expect(d.sentTo).toEqual(['p1', 'p3']);
    expect(result).toMatchObject({ sent: 2, alreadyClaimed: 1, stopped: null });
  });

  it('gives the claim back when a send fails, so the next run can still reach that patient', async () => {
    const d = deps((id) => (id === 'p2' ? { ok: false, error: 'Network error', stopAll: false } : { ok: true, logId: null }));
    const result = await runListSend(sendPlan(3), d);
    expect(d.released).toEqual(['p2']);
    expect(result.sent).toBe(2);
    expect(result.failed).toEqual([{ patientId: 'p2', name: 'Patient 2', error: 'Network error' }]);
  });

  it('stops when the SMS bundle runs out and does not mark the rest as messaged', async () => {
    const d = deps((id) =>
      id === 'p2' ? { ok: false, error: 'SMS limit reached', stopAll: true } : { ok: true, logId: null }
    );
    const result = await runListSend(sendPlan(7), d, 5);
    expect(d.sentTo).toEqual(['p1', 'p2']);
    // p2 failed; p3-p5 were claimed in the same batch and are given back; p6-p7 never claimed
    expect(d.released).toEqual(['p2', 'p3', 'p4', 'p5']);
    expect(d.claim).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ sent: 1, stopped: 'limit', stopReason: 'SMS limit reached', notAttempted: 5 });
  });

  it('sends nothing when it cannot record who is being messaged', async () => {
    const d = deps(() => ({ ok: true, logId: null }));
    d.claim.mockRejectedValueOnce(new Error('permission denied'));
    const result = await runListSend(sendPlan(2), d);
    expect(d.sentTo).toEqual([]);
    expect(result).toMatchObject({ sent: 0, stopped: 'error', notAttempted: 2 });
  });

  it('stops before the next patient when staff press Stop', async () => {
    let stop = false;
    const d = deps(() => {
      stop = true;
      return { ok: true, logId: null };
    });
    const result = await runListSend(sendPlan(3), { ...d, shouldStop: () => stop });
    expect(d.sentTo).toEqual(['p1']);
    expect(d.released).toEqual(['p2', 'p3']);
    expect(result).toMatchObject({ sent: 1, stopped: 'cancelled', notAttempted: 2 });
  });
});

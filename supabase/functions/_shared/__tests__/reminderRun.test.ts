import { describe, it, expect, vi } from 'vitest';
import { reminderSmsMetadata, sendReminders, type ReminderClaim, type ReminderRepository } from '../reminderRun';
import type { PlannedReminder } from '../appointmentReminders';

// Invented bookings: none of these exist anywhere.
const reminder = (visitId: string): PlannedReminder => ({
  booking: {
    visitId,
    practiceId: 'practice-1',
    patientId: `patient-${visitId}`,
    practitionerId: 'pr-a',
    date: '2026-10-08',
    time: '09:30',
    stage: 'scheduled',
    isConfirmed: true,
    createdAt: null,
    patientFirstName: 'Maria',
    patientLastName: 'Shikongo',
    cellNumber: '0810000001',
    smsOptOut: false
  },
  kind: 'day_before',
  slotKey: '2026-10-08T09:30',
  phone: '+264810000001',
  message: 'Reminder'
});

/** A fake database and gateway: claims are unique per visit, kind and slot, like the SQL constraint. */
function fakeRepository(options: { failSend?: string[]; claimError?: string[]; finishThrows?: boolean } = {}) {
  const claimed = new Set<string>();
  const events: string[] = [];
  const finished: Array<{ logId: string; sent: boolean; error: string | null }> = [];
  const repo: ReminderRepository = {
    async claim(item): Promise<ReminderClaim> {
      if (options.claimError?.includes(item.booking.visitId)) return { status: 'error', error: 'database unavailable' };
      const key = `${item.booking.visitId}|${item.kind}|${item.slotKey}`;
      if (claimed.has(key)) return { status: 'duplicate' };
      claimed.add(key);
      events.push(`claim ${item.booking.visitId}`);
      return { status: 'claimed', logId: `log-${item.booking.visitId}` };
    },
    async send(item) {
      events.push(`send ${item.booking.visitId}`);
      return options.failSend?.includes(item.booking.visitId) ? { ok: false, error: 'No active SMS subscription' } : { ok: true, smsLogId: `sms-${item.booking.visitId}` };
    },
    async finish(logId, outcome) {
      if (options.finishThrows) throw new Error('network');
      finished.push({ logId, sent: outcome.sent, error: outcome.error });
    }
  };
  return { repo, events, finished };
}

describe('sendReminders', () => {
  it('claims each reminder before sending it, so a crash mid-run can never lead to a second SMS', async () => {
    const { repo, events } = fakeRepository();
    await sendReminders(repo, [reminder('a')], { concurrency: 1 });
    expect(events).toEqual(['claim a', 'send a']);
  });

  it('skips a reminder another run already claimed: two receptionists clicking at once send one SMS', async () => {
    const { repo, events } = fakeRepository();
    const summary = await sendReminders(repo, [reminder('a'), reminder('a')], { concurrency: 1 });
    expect(summary).toMatchObject({ sent: 1, duplicate: 1, failed: 0 });
    expect(events.filter((event) => event === 'send a')).toHaveLength(1);
  });

  it('sends nothing when the claim cannot be recorded, because then nothing proves it was not sent before', async () => {
    const { repo, events } = fakeRepository({ claimError: ['a'] });
    const summary = await sendReminders(repo, [reminder('a')]);
    expect(events).toEqual([]);
    expect(summary.results[0]).toMatchObject({ outcome: 'not_claimed', error: 'database unavailable' });
    expect(summary.failed).toBe(1);
  });

  it("records a failed send with the gateway's reason, which the diary shows to reception", async () => {
    const { repo, finished } = fakeRepository({ failSend: ['b'] });
    const summary = await sendReminders(repo, [reminder('a'), reminder('b')]);
    expect(summary).toMatchObject({ sent: 1, failed: 1 });
    expect(finished).toContainEqual({ logId: 'log-b', sent: false, error: 'No active SMS subscription' });
    expect(finished).toContainEqual({ logId: 'log-a', sent: true, error: null });
  });

  it('keeps going when an outcome cannot be recorded: the claim still blocks a repeat', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { repo } = fakeRepository({ finishThrows: true });
    const summary = await sendReminders(repo, [reminder('a'), reminder('b')]);
    expect(summary.sent).toBe(2);
    warn.mockRestore();
  });

  it('reports progress and keeps the results in the order of the plan', async () => {
    const { repo } = fakeRepository();
    const progress: number[] = [];
    const summary = await sendReminders(repo, ['a', 'b', 'c', 'd'].map(reminder), { concurrency: 3, onProgress: (done) => progress.push(done) });
    expect(progress).toEqual([1, 2, 3, 4]);
    expect(summary.results.map((result) => result.reminder.booking.visitId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('labels the SMS so the diary icon and the reply webhook link it to the booking', () => {
    expect(reminderSmsMetadata(reminder('a'), 'log-a', 'reception')).toEqual({
      source: 'diary_reminders',
      run: 'reception',
      reminder_kind: 'day_before',
      slot_key: '2026-10-08T09:30',
      reminder_log_id: 'log-a'
    });
  });
});

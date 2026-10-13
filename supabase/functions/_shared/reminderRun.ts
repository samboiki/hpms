/**
 * Sends planned reminders (appointmentReminders.ts) without ever sending one twice: each reminder is
 * first claimed in diary_reminder_log (unique per booking, kind and slot) and only the caller that
 * made the claim sends it. A reminder somebody else already claimed (the schedule and reception at
 * the same time, or a double click) is skipped. A failed send is recorded and not retried
 * automatically: the gateway may have passed it on before failing, and a second SMS is worse than
 * a phone call. The diary shows the failure so reception can call the patient.
 *
 * The edge function and the app each supply a ReminderRepository (database and SMS gateway); the
 * tests use fakes. Pure TypeScript (no Deno APIs).
 */
import type { PlannedReminder } from './appointmentReminders.ts';

export type ReminderClaim = { status: 'claimed'; logId: string } | { status: 'duplicate' } | { status: 'error'; error: string };

export type ReminderSendResult = { ok: true; smsLogId: string | null } | { ok: false; error: string };

export interface ReminderRepository {
  /** Record that this reminder is being sent; 'duplicate' when it was claimed before. */
  claim(reminder: PlannedReminder): Promise<ReminderClaim>;
  /** Send the SMS through centralized-sms-gateway, linked to the visit. */
  send(reminder: PlannedReminder, logId: string): Promise<ReminderSendResult>;
  /** Record the outcome on the claim. */
  finish(logId: string, outcome: { sent: boolean; smsLogId: string | null; error: string | null }): Promise<void>;
}

export type ReminderOutcome = 'sent' | 'failed' | 'duplicate' | 'not_claimed';

export interface ReminderResult {
  reminder: PlannedReminder;
  outcome: ReminderOutcome;
  error?: string;
}

export interface ReminderRunSummary {
  sent: number;
  failed: number;
  /** Already claimed by another run: nothing sent */
  duplicate: number;
  results: ReminderResult[];
}

export interface ReminderRunOptions {
  /** SMS sent at the same time (the gateway answers in about a second each) */
  concurrency?: number;
  /** After each reminder, for a progress bar */
  onProgress?: (done: number, total: number) => void;
}

const MAX_ERROR_LENGTH = 300;

const errorText = (error: unknown): string => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH - 3)}...` : message;
};

async function sendOne(repo: ReminderRepository, reminder: PlannedReminder): Promise<ReminderResult> {
  let claim: ReminderClaim;
  try {
    claim = await repo.claim(reminder);
  } catch (error) {
    claim = { status: 'error', error: errorText(error) };
  }
  if (claim.status === 'duplicate') return { reminder, outcome: 'duplicate' };
  // Without a claim there is no proof it was not sent before, so nothing is sent
  if (claim.status === 'error') return { reminder, outcome: 'not_claimed', error: claim.error };

  let result: ReminderSendResult;
  try {
    result = await repo.send(reminder, claim.logId);
  } catch (error) {
    result = { ok: false, error: errorText(error) };
  }
  const outcome = result.ok
    ? { sent: true, smsLogId: result.smsLogId, error: null }
    : { sent: false, smsLogId: null, error: errorText(result.error) };
  try {
    await repo.finish(claim.logId, outcome);
  } catch (error) {
    // The SMS went (or failed) either way; the claim stays and still prevents a second reminder
    console.warn('Could not record the reminder outcome:', errorText(error));
  }
  return result.ok ? { reminder, outcome: 'sent' } : { reminder, outcome: 'failed', error: outcome.error ?? undefined };
}

/** Claims and sends each reminder, a few at a time. Never throws. */
export async function sendReminders(
  repo: ReminderRepository,
  reminders: PlannedReminder[],
  options: ReminderRunOptions = {}
): Promise<ReminderRunSummary> {
  const concurrency = Math.max(1, Math.min(8, Math.floor(options.concurrency ?? 3)));
  const results: ReminderResult[] = new Array(reminders.length);
  let next = 0;
  let done = 0;

  const worker = async () => {
    while (next < reminders.length) {
      const index = next++;
      results[index] = await sendOne(repo, reminders[index]);
      done += 1;
      options.onProgress?.(done, reminders.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, reminders.length) }, worker));

  return {
    sent: results.filter((result) => result.outcome === 'sent').length,
    failed: results.filter((result) => result.outcome === 'failed' || result.outcome === 'not_claimed').length,
    duplicate: results.filter((result) => result.outcome === 'duplicate').length,
    results
  };
}

/** The SMS gateway metadata of a reminder: how the diary and the reply webhook recognise it. */
export function reminderSmsMetadata(reminder: PlannedReminder, logId: string, source: 'schedule' | 'reception'): Record<string, unknown> {
  return {
    source: 'diary_reminders',
    run: source,
    reminder_kind: reminder.kind,
    slot_key: reminder.slotKey,
    reminder_log_id: logId
  };
}

/** Every reminder goes as this message type: the reply webhook reads 1 / 2 / 3 as confirm, cancel, new time. */
export const REMINDER_MESSAGE_TYPE = 'appointment_reminder';

/**
 * Sending a list's message: who gets it, who is skipped and why (the preview staff confirm), and
 * the send loop shared by "Send now" in the browser and the scheduled sender.
 *
 * Nobody gets the same list message twice in a period: before a message goes out the patient is
 * claimed for the period in the database (claim_patient_list_sends). A second run at the same
 * time - the scheduled sender while someone presses Send now, or a double click - cannot claim
 * the same patient. A failed send gives the claim back so a later run can try again.
 *
 * No third-party imports and explicit .ts extensions (Deno).
 */
import { getSmsLength } from '../../components/messages/messageText.ts';
import { normalizePhoneNumber } from '../../components/patients/patientContact.ts';
import { periodKeyFor, type ListAutomationSettings } from './listAutomation.ts';
import { birthdayInYear } from './listDates.ts';
import { buildMessageValues, describeMissingVariable, renderListMessage, type PracticeDetails } from './listMessages.ts';
import type { ListMember, SmartRule } from './listRules.ts';

/** practice_sms_logs.message_type for a list's messages (birthdays and win-backs are not care). */
export function messageTypeForRule(rule: SmartRule | null): 'marketing' | 'follow_up' | 'custom' {
  switch (rule?.type) {
    case 'birthday':
    case 'lapsed':
      return 'marketing';
    case 'recall_due':
    case 'missed_appointment':
    case 'regular_follow_up':
      return 'follow_up';
    default:
      return 'custom';
  }
}

/**
 * Gateway errors after which every other send would fail too (bundle used up, no subscription,
 * gateway not configured, signed out), so a run stops instead of failing patient after patient.
 */
export function isStopAllSmsError(error: string | null | undefined): boolean {
  return /SMS_LIMIT_REACHED|limit reached|subscription|credentials not configured|authentication token|invalid jwt|session has expired/i.test(
    error ?? ''
  );
}

export type SkipReason = 'opted_out' | 'no_cell' | 'invalid_cell' | 'already_sent' | 'no_message' | 'missing_details';

export interface PlannedRecipient {
  patientId: string;
  name: string;
  /** E.164, e.g. +264811234567 */
  phone: string;
  text: string;
  /** SMS parts the message is charged as */
  parts: number;
}

export interface SkippedMember {
  patientId: string;
  name: string;
  reason: SkipReason;
  /** e.g. "no upcoming appointment" */
  detail: string | null;
}

export interface SendPlan {
  periodKey: string;
  recipients: PlannedRecipient[];
  skipped: SkippedMember[];
  /** Left out because it is not their birthday today (birthday-morning sending); not an error */
  notDueToday: number;
  /** SMS parts for all recipients together */
  totalParts: number;
}

const fullName = (member: ListMember): string =>
  `${member.facts.firstName} ${member.facts.lastName}`.trim() || 'Unnamed patient';

/** Is today the member's (celebrated) birthday? */
export function isBirthdayToday(member: ListMember, todayKey: string): boolean {
  return birthdayInYear(member.facts.dateOfBirth, Number(todayKey.slice(0, 4))) === todayKey;
}

/**
 * Who would receive the list's message today and who is skipped. Members are skipped when they
 * opted out of SMS, have no usable cell number, already got this list's message in the current
 * period, or lack a detail the message needs (e.g. an appointment date).
 */
export function planListSend(input: {
  members: readonly ListMember[];
  settings: ListAutomationSettings;
  practice: PracticeDetails;
  todayKey: string;
}): SendPlan {
  const { settings, practice, todayKey } = input;
  const periodKey = periodKeyFor(settings.repeat, todayKey);
  const template = settings.template.trim();
  const recipients: PlannedRecipient[] = [];
  const skipped: SkippedMember[] = [];
  let notDueToday = 0;

  for (const member of input.members) {
    if (settings.schedule === 'birthday_morning' && !isBirthdayToday(member, todayKey)) {
      notDueToday += 1;
      continue;
    }
    const name = fullName(member);
    const skip = (reason: SkipReason, detail: string | null = null) =>
      skipped.push({ patientId: member.patientId, name, reason, detail });

    if (member.facts.smsOptOut) {
      skip('opted_out');
      continue;
    }
    if (!member.facts.cellNumber) {
      skip('no_cell');
      continue;
    }
    const phone = normalizePhoneNumber(member.facts.cellNumber);
    if (!phone) {
      skip('invalid_cell', member.facts.cellNumber);
      continue;
    }
    if (member.lastSentPeriod === periodKey) {
      skip('already_sent');
      continue;
    }
    if (!template) {
      skip('no_message');
      continue;
    }
    const message = renderListMessage(template, buildMessageValues(member.facts, practice, todayKey));
    if (message.missing.length > 0) {
      skip('missing_details', message.missing.map(describeMissingVariable).join(', '));
      continue;
    }
    recipients.push({
      patientId: member.patientId,
      name,
      phone,
      text: message.text,
      parts: getSmsLength(message.text).parts
    });
  }

  return {
    periodKey,
    recipients,
    skipped,
    notDueToday,
    totalParts: recipients.reduce((total, recipient) => total + recipient.parts, 0)
  };
}

/** Skipped members counted per reason, most common first. */
export function countSkips(skipped: readonly SkippedMember[]): Array<{ reason: SkipReason; count: number }> {
  const counts = new Map<SkipReason, number>();
  for (const member of skipped) counts.set(member.reason, (counts.get(member.reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------------------------
// The send loop
// ---------------------------------------------------------------------------------------------

export type SendAttempt =
  | { ok: true; logId: string | null }
  /** stopAll: no point trying anyone else (SMS bundle used up, no subscription, signed out) */
  | { ok: false; error: string; stopAll: boolean };

export interface SendDeps {
  /** Claims patients for the plan's period; returns the ids that were not already claimed */
  claim: (patientIds: string[]) => Promise<string[]>;
  /** Sends one SMS through the centralized gateway */
  send: (recipient: PlannedRecipient) => Promise<SendAttempt>;
  /** Gives a claim back after a failed send so a later run can try again */
  release: (patientId: string) => Promise<void>;
  shouldStop?: () => boolean;
  onProgress?: (progress: { done: number; total: number; sent: number; failed: number }) => void;
}

export interface SendResult {
  sent: number;
  sentPatientIds: string[];
  failed: Array<{ patientId: string; name: string; error: string }>;
  /** Already messaged in this period by another run that claimed them first */
  alreadyClaimed: number;
  /** Not tried because the run stopped */
  notAttempted: number;
  stopped: 'limit' | 'cancelled' | 'error' | null;
  stopReason: string | null;
  /** Failed sends whose claim could not be given back: they wait until the next period */
  unreleased: number;
}

/** What the list card shows about the last send (stored in patient_lists.last_run_summary). */
export interface ListRunSummary {
  mode: 'manual' | 'scheduled';
  /** ISO timestamp */
  at: string;
  sent: number;
  failed: number;
  /** Skipped by the plan (opted out, no cell number, already messaged...) or claimed by another run */
  skipped: number;
  notDueToday: number;
  stopped: SendResult['stopped'];
  stopReason: string | null;
}

export function summarizeRun(plan: SendPlan, result: SendResult, mode: ListRunSummary['mode'], at: Date): ListRunSummary {
  return {
    mode,
    at: at.toISOString(),
    sent: result.sent,
    failed: result.failed.length,
    skipped: plan.skipped.length + result.alreadyClaimed,
    notDueToday: plan.notDueToday,
    stopped: result.stopped,
    stopReason: result.stopReason
  };
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function runListSend(plan: SendPlan, deps: SendDeps, batchSize = 5): Promise<SendResult> {
  const result: SendResult = {
    sent: 0,
    sentPatientIds: [],
    failed: [],
    alreadyClaimed: 0,
    notAttempted: 0,
    stopped: null,
    stopReason: null,
    unreleased: 0
  };
  const total = plan.recipients.length;
  let done = 0;
  const report = () => deps.onProgress?.({ done, total, sent: result.sent, failed: result.failed.length });
  const release = async (patientId: string) => {
    try {
      await deps.release(patientId);
    } catch {
      result.unreleased += 1;
    }
  };

  for (let start = 0; start < total; start += batchSize) {
    const batch = plan.recipients.slice(start, start + batchSize);
    if (deps.shouldStop?.()) {
      result.stopped = 'cancelled';
      result.stopReason = 'Sending was stopped.';
      result.notAttempted += total - start;
      break;
    }

    let claimed: Set<string>;
    try {
      claimed = new Set(await deps.claim(batch.map((recipient) => recipient.patientId)));
    } catch (error) {
      // Without a claim a second run could message the same people, so nothing is sent
      result.stopped = 'error';
      result.stopReason = `Could not record who is being messaged: ${errorText(error)}`;
      result.notAttempted += total - start;
      break;
    }

    for (const recipient of batch) {
      if (!claimed.has(recipient.patientId)) {
        result.alreadyClaimed += 1;
      } else if (result.stopped || deps.shouldStop?.()) {
        if (!result.stopped) {
          result.stopped = 'cancelled';
          result.stopReason = 'Sending was stopped.';
        }
        await release(recipient.patientId);
        result.notAttempted += 1;
      } else {
        let attempt: SendAttempt;
        try {
          attempt = await deps.send(recipient);
        } catch (error) {
          attempt = { ok: false, error: errorText(error), stopAll: false };
        }
        if (attempt.ok) {
          result.sent += 1;
          result.sentPatientIds.push(recipient.patientId);
        } else {
          result.failed.push({ patientId: recipient.patientId, name: recipient.name, error: attempt.error });
          await release(recipient.patientId);
          if (attempt.stopAll) {
            result.stopped = 'limit';
            result.stopReason = attempt.error;
          }
        }
      }
      done += 1;
      report();
    }

    if (result.stopped) {
      result.notAttempted += total - (start + batch.length);
      break;
    }
  }
  return result;
}

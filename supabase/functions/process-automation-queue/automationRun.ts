/**
 * Sends the automation items process-automation-queue claimed (automation_queue_claim) and records each outcome
 * (automation_queue_finish). Every claimed item is finished exactly once, whatever happens while sending, so an item
 * never stays in 'processing'. (If the whole function stops half-way, the next claim puts its items back.)
 *
 * A message the gateway refused is not tried again automatically: it may have been passed on before failing, and a
 * second SMS is worse than a phone call (the diary reminders' rule). The note on the item says why in plain words
 * and never holds a name, a number or the message text.
 *
 * The edge function supplies an AutomationRepository (the gateways and the database); the tests use fakes.
 * Pure TypeScript (no Deno APIs).
 */
import { formatReminderDate, type ReminderValues } from '../_shared/appointmentReminders.ts';
import { practicePhoneForSms, smsVisitStage, visitDateTime, visitStartInstant, type SmsVisit } from '../_shared/smsReplyPlan.ts';
import { normalizePhoneNumber } from '../_shared/smsPhone.ts';
import { withReplyInvite } from '../_shared/smsMessagePolicy.ts';
import {
  AUTOMATION_REPLY_INVITES,
  WELCOME_MAX_AGE_HOURS,
  automationSettingFromRow,
  isWiredAutomationId,
  looksLikeHtml,
  renderAutomationHtml,
  renderAutomationText,
  type AutomationSetting,
  type WiredAutomationId
} from './automationRules.ts';

// ---------------------------------------------------------------------------------------------
// A claimed item (one jsonb row of automation_queue_claim)
// ---------------------------------------------------------------------------------------------

export interface ClaimedPatient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  cellNumber: string | null;
  email: string | null;
  smsOptOut: boolean;
}

export interface ClaimedAutomation {
  queueId: string;
  practiceId: string | null;
  /** null when the item names an automation this sender does not handle */
  automationId: WiredAutomationId | null;
  queuedAt: string | null;
  /** The practice's settings; null when the practice has no settings row */
  setting: AutomationSetting | null;
  /** repliesLive: the practice's SMS replies are collected (practice_features 'sms_replies'), so the SMS may invite one */
  practice: { name: string | null; phone: string | null; repliesLive: boolean };
  patient: ClaimedPatient | null;
  /** videoLink: a video booking's room link (visits.video_link), for {{videoLink}} */
  visit: (SmsVisit & { practitionerName: string | null; videoLink?: string | null }) | null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** One claimed row, or null when it has no queue id (then it cannot be finished either). */
export function claimedAutomationFromRow(row: unknown): ClaimedAutomation | null {
  const r = record(row);
  const queueId = text(r?.queue_id);
  if (!r || !queueId) return null;
  const automationId = isWiredAutomationId(r.automation_id) ? r.automation_id : null;
  const settings = record(r.settings);
  const practice = record(r.practice) ?? {};
  const patient = record(r.patient);
  const visit = record(r.visit);
  return {
    queueId,
    practiceId: text(r.practice_id),
    automationId,
    queuedAt: text(r.queued_at),
    setting: automationId && settings ? automationSettingFromRow(automationId, settings) : null,
    // The claim does not say whether replies are collected: the sender looks it up (practice_features), else none is invited
    practice: { name: text(practice.name), phone: text(practice.contact_phone), repliesLive: false },
    patient: patient && text(patient.id)
      ? {
          id: text(patient.id) as string,
          firstName: text(patient.first_name),
          lastName: text(patient.last_name),
          cellNumber: text(patient.cell_number),
          email: text(patient.email),
          smsOptOut: patient.sms_opt_out === true
        }
      : null,
    visit: visit && text(visit.id)
      ? {
          id: text(visit.id) as string,
          practice_id: text(r.practice_id),
          patient_id: text(visit.patient_id),
          status: text(visit.status),
          is_confirmed: visit.is_confirmed === true,
          is_cancelled: visit.is_cancelled === true,
          is_checked_in: visit.is_checked_in === true,
          is_ready: visit.is_ready === true,
          is_handoff: visit.is_handoff === true,
          scheduled_date: text(visit.scheduled_date),
          scheduled_time: text(visit.scheduled_time),
          visit_date: text(visit.visit_date),
          visit_time: text(visit.visit_time),
          practitionerName: text(visit.practitioner_name),
          // Only a secure link is put in a message (the database allows no other)
          videoLink: /^https:\/\/\S+$/.test(text(visit.video_link) ?? '') ? text(visit.video_link) : null
        }
      : null
  };
}

// ---------------------------------------------------------------------------------------------
// What to send
// ---------------------------------------------------------------------------------------------

/** Why an item is closed without sending anything. */
export type SkipReason =
  | 'unknown_automation'
  | 'switched_off'
  | 'patient_missing'
  | 'too_late'
  | 'booking_missing'
  | 'booking_not_confirmed'
  | 'booking_cancelled'
  | 'booking_started'
  | 'booking_no_date'
  | 'booking_passed'
  | 'no_channel';

export const SKIP_TEXT: Readonly<Record<SkipReason, string>> = {
  unknown_automation: 'Not sent: this automation is not offered',
  switched_off: 'Not sent: the automation was switched off',
  patient_missing: 'Not sent: the patient file no longer exists',
  too_late: `Not sent: it waited more than ${WELCOME_MAX_AGE_HOURS} hours, too late for a welcome`,
  booking_missing: 'Not sent: the booking no longer exists',
  booking_not_confirmed: 'Not sent: the booking request was not confirmed',
  booking_cancelled: 'Not sent: the booking was cancelled',
  booking_started: 'Not sent: the patient had already arrived',
  booking_no_date: 'Not sent: the booking has no date',
  booking_passed: 'Not sent: the appointment time had passed',
  no_channel: 'Not sent: SMS and email are both off'
};

/** Why one channel of an item is not used. */
export type ChannelSkip = 'no_cell_number' | 'bad_cell_number' | 'opted_out' | 'no_email';

const CHANNEL_SKIP_TEXT: Readonly<Record<ChannelSkip, string>> = {
  no_cell_number: 'no cell number',
  bad_cell_number: 'the cell number cannot be dialled',
  opted_out: 'the patient replied STOP',
  no_email: 'no email address'
};

export type Channel = 'sms' | 'email';

export type ChannelSend =
  | { channel: 'sms'; to: string; message: string; messageType: string }
  | { channel: 'email'; to: string; recipientName: string | null; subject: string; text: string | null; html: string | null; emailType: string };

export type AutomationPlan =
  | { kind: 'skip'; reason: SkipReason }
  | { kind: 'send'; sends: ChannelSend[]; unused: Array<{ channel: Channel; reason: ChannelSkip }> };

/** Message types the gateways log; smsMessagePolicy.ts lists 'general' (the welcome) as non-essential. */
export const AUTOMATION_MESSAGE_TYPES: Readonly<Record<WiredAutomationId, string>> = {
  'welcome-new-patient': 'general',
  'appointment-confirmation': 'appointment_confirmation'
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fullName = (patient: ClaimedPatient): string | null =>
  [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || null;

/** Decides what an item sends, or why it sends nothing. */
export function planAutomation(item: ClaimedAutomation, now: Date): AutomationPlan {
  if (!item.automationId) return { kind: 'skip', reason: 'unknown_automation' };
  const setting = item.setting;
  if (!setting || !setting.enabled) return { kind: 'skip', reason: 'switched_off' };
  if (!setting.smsEnabled && !setting.emailEnabled) return { kind: 'skip', reason: 'no_channel' };
  const patient = item.patient;
  if (!patient) return { kind: 'skip', reason: 'patient_missing' };

  const values: ReminderValues = {
    patientFirstName: patient.firstName,
    patientName: fullName(patient),
    practiceName: item.practice.name,
    practicePhone: practicePhoneForSms(item.practice.phone)
  };

  if (item.automationId === 'welcome-new-patient') {
    const queuedAt = item.queuedAt ? Date.parse(item.queuedAt) : NaN;
    if (!Number.isNaN(queuedAt) && now.getTime() - queuedAt > WELCOME_MAX_AGE_HOURS * 3_600_000) {
      return { kind: 'skip', reason: 'too_late' };
    }
  } else {
    // Booking confirmation: read the booking as it is now (it may have moved or been cancelled since)
    const visit = item.visit;
    if (!visit || (visit.patient_id && visit.patient_id !== patient.id)) return { kind: 'skip', reason: 'booking_missing' };
    if (!visit.is_confirmed) return { kind: 'skip', reason: 'booking_not_confirmed' };
    const stage = smsVisitStage(visit);
    if (stage === 'cancelled' || stage === 'no-show') return { kind: 'skip', reason: 'booking_cancelled' };
    if (stage !== 'scheduled') return { kind: 'skip', reason: 'booking_started' };
    const when = visitDateTime(visit);
    const start = visitStartInstant(visit);
    if (!when || !start) return { kind: 'skip', reason: 'booking_no_date' };
    if (start.getTime() <= now.getTime()) return { kind: 'skip', reason: 'booking_passed' };
    values.practitionerName = visit.practitionerName;
    values.appointmentDate = formatReminderDate(when.date);
    values.appointmentTime = when.time;
    values.videoLink = visit.videoLink ?? null;
  }

  const messageType = AUTOMATION_MESSAGE_TYPES[item.automationId];
  const sends: ChannelSend[] = [];
  const unused: Array<{ channel: Channel; reason: ChannelSkip }> = [];

  if (setting.smsEnabled) {
    const phone = normalizePhoneNumber(patient.cellNumber);
    // Patients who replied STOP get no automatic message (the owner's rule for the diary reminders too)
    if (patient.smsOptOut) unused.push({ channel: 'sms', reason: 'opted_out' });
    else if (!patient.cellNumber) unused.push({ channel: 'sms', reason: 'no_cell_number' });
    else if (!phone) unused.push({ channel: 'sms', reason: 'bad_cell_number' });
    else {
      const template = withReplyInvite(setting.smsTemplate, AUTOMATION_REPLY_INVITES[item.automationId], item.practice.repliesLive);
      sends.push({ channel: 'sms', to: phone, message: renderAutomationText(template, values), messageType });
    }
  }

  if (setting.emailEnabled) {
    const email = patient.email && EMAIL.test(patient.email) ? patient.email : null;
    if (!email) unused.push({ channel: 'email', reason: 'no_email' });
    else {
      const html = looksLikeHtml(setting.emailBody);
      sends.push({
        channel: 'email',
        to: email,
        recipientName: fullName(patient),
        subject: renderAutomationText(setting.emailSubject, values),
        text: html ? null : renderAutomationText(setting.emailBody, values),
        html: html ? renderAutomationHtml(setting.emailBody, values) : null,
        emailType: messageType
      });
    }
  }

  return { kind: 'send', sends, unused };
}

// ---------------------------------------------------------------------------------------------
// The gateways' answers
// ---------------------------------------------------------------------------------------------

export type SendCategory = 'sent' | 'opted_out' | 'no_subscription' | 'limit_reached' | 'bad_number' | 'refused' | 'failed';

export interface SendResult {
  ok: boolean;
  category: SendCategory;
}

/** Sorts a gateway's answer into a category. The raw error is never stored: it can hold the number. */
export function classifyGatewayResponse(status: number, body: unknown): SendResult {
  const b = record(body) ?? {};
  if (status >= 200 && status < 300 && b.success === true) return { ok: true, category: 'sent' };
  const error = typeof b.error === 'string' ? b.error : '';
  if (b.code === 'PATIENT_OPTED_OUT') return { ok: false, category: 'opted_out' };
  if (/limit reached/i.test(error)) return { ok: false, category: 'limit_reached' };
  if (/no active .*subscription/i.test(error)) return { ok: false, category: 'no_subscription' };
  if (/dialable|phone number/i.test(error)) return { ok: false, category: 'bad_number' };
  if (status === 401 || status === 403) return { ok: false, category: 'refused' };
  return { ok: false, category: 'failed' };
}

const SEND_TEXT: Readonly<Record<Exclude<SendCategory, 'sent'>, (channel: Channel) => string>> = {
  opted_out: () => 'the patient replied STOP',
  no_subscription: (channel) => `the practice has no active ${channel === 'sms' ? 'SMS' : 'email'} bundle`,
  limit_reached: (channel) => `the ${channel === 'sms' ? 'SMS' : 'email'} bundle is used up for this month`,
  bad_number: () => 'the cell number cannot be dialled',
  refused: (channel) => `the ${channel === 'sms' ? 'SMS' : 'email'} service refused it`,
  failed: (channel) => `the ${channel === 'sms' ? 'SMS' : 'email'} service failed`
};

const CHANNEL_NAME: Readonly<Record<Channel, string>> = { sms: 'SMS', email: 'email' };

export interface ItemOutcome {
  sent: boolean;
  /** Plain words for the queue item: what went out and why anything did not (no names, numbers or text) */
  note: string;
  /** Short codes for the run's log */
  codes: string[];
}

/** The outcome of an item from its plan and the gateways' answers (one result per planned send). */
export function itemOutcome(plan: AutomationPlan, results: Array<{ channel: Channel; result: SendResult }>): ItemOutcome {
  if (plan.kind === 'skip') return { sent: false, note: SKIP_TEXT[plan.reason], codes: [plan.reason] };
  const sentChannels = results.filter((entry) => entry.result.ok).map((entry) => entry.channel);
  const problems = [
    ...results
      .filter((entry) => !entry.result.ok)
      .map((entry) => ({ channel: entry.channel, text: SEND_TEXT[entry.result.category as Exclude<SendCategory, 'sent'>](entry.channel), code: entry.result.category })),
    ...plan.unused.map((entry) => ({ channel: entry.channel, text: CHANNEL_SKIP_TEXT[entry.reason], code: entry.reason }))
  ];
  const codes = problems.map((problem) => `${problem.channel}:${problem.code}`);
  if (sentChannels.length === 0) {
    const reasons = [...new Set(problems.map((problem) => problem.text))];
    return { sent: false, note: `Not sent: ${reasons.join('; ') || 'nothing to send'}`, codes: codes.length > 0 ? codes : ['nothing_to_send'] };
  }
  const sentText = `${sentChannels.map((channel) => CHANNEL_NAME[channel]).join(' and ')} sent`;
  const notSent = problems.map((problem) => `${CHANNEL_NAME[problem.channel]} not sent: ${problem.text}`);
  return { sent: true, note: [sentText.charAt(0).toUpperCase() + sentText.slice(1), ...notSent].join('; '), codes: ['sent', ...codes] };
}

// ---------------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------------

export interface AutomationRepository {
  /** Send one message through centralized-sms-gateway / centralized-email-gateway, linked to the item. */
  send(item: ClaimedAutomation, send: ChannelSend): Promise<SendResult>;
  /** automation_queue_finish: completed (sent) or failed, with the note. */
  finish(queueId: string, sent: boolean, note: string): Promise<void>;
}

export interface AutomationRunSummary {
  claimed: number;
  sent: number;
  notSent: number;
  /** Items whose outcome could not be recorded: the next run's claim settles them from the message logs */
  finishFailed: number;
  /** How often each outcome code came up, for the function's log (no personal data) */
  codes: Record<string, number>;
}

/** Sends each claimed item and records its outcome: one finish per item, even when sending throws. */
export async function runAutomations(items: ClaimedAutomation[], repo: AutomationRepository, now: Date): Promise<AutomationRunSummary> {
  const summary: AutomationRunSummary = { claimed: items.length, sent: 0, notSent: 0, finishFailed: 0, codes: {} };
  for (const item of items) {
    let outcome: ItemOutcome;
    try {
      const plan = planAutomation(item, now);
      const results: Array<{ channel: Channel; result: SendResult }> = [];
      if (plan.kind === 'send') {
        for (const send of plan.sends) {
          let result: SendResult;
          try {
            result = await repo.send(item, send);
          } catch {
            result = { ok: false, category: 'failed' };
          }
          results.push({ channel: send.channel, result });
        }
      }
      outcome = itemOutcome(plan, results);
    } catch {
      outcome = { sent: false, note: 'Not sent: the sender hit an error', codes: ['error'] };
    }

    if (outcome.sent) summary.sent += 1;
    else summary.notSent += 1;
    for (const code of outcome.codes) summary.codes[code] = (summary.codes[code] ?? 0) + 1;

    try {
      await repo.finish(item.queueId, outcome.sent, outcome.note);
    } catch {
      summary.finishFailed += 1;
    }
  }
  return summary;
}

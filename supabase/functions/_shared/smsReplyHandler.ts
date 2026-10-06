/**
 * The reply webhook's work once a call is authenticated and parsed: match the reply, store it once,
 * act on it and send at most one automatic answer. Pure TypeScript (no Deno APIs): every read and
 * write goes through ReplyRepository, implemented with supabase-js and the SMS gateway in
 * sms-reply-webhook/index.ts, and with an in-memory fake in the unit tests.
 *
 * Order matters:
 * 1. Match (original message, practice, patient, visit). Never throws: unknowns stay null for staff.
 * 2. Store the reply. provider_event_id is unique, so a repeated delivery stops here: nothing is
 *    changed or answered twice. A failure to store throws (the webhook answers 500, SMSPortal retries).
 * 3. Act. The automatic answer is sent only after the change succeeded, so it never claims something
 *    that did not happen. Failures are written on the stored reply for staff.
 */
import { isAutoReplyMessage, replyContextFor, type OriginalSmsMessage } from './smsMessagePolicy.ts';
import { normalizePhoneNumber, storedPhoneSearchPattern } from './smsPhone.ts';
import { interpretReply, type SmsReplyIntent } from './smsReplyIntent.ts';
import { smsLogIdFromCustomerId, type SmsPortalReply } from './smsReplyPayload.ts';
import {
  AUTO_REPLY_DAILY_LIMIT_PER_PHONE,
  appendCancellationNote,
  checkVisitForSmsAction,
  clinicDateKey,
  planReplyHandling,
  type PracticeForReply,
  type ReplyPlan,
  type SmsReplyAction,
  type SmsReplyStatus,
  type SmsVisit,
} from './smsReplyPlan.ts';

/** A reply without a usable customerId is matched to the latest message sent to the number in this window. */
export const SMS_LOG_LOOKBACK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** practice_sms_logs columns the webhook reads */
export interface SmsLogRow {
  id: string;
  practice_id: string | null;
  patient_id: string | null;
  visit_id: string | null;
  appointment_id: string | null;
  recipient_phone: string | null;
  message_type: string | null;
  message_content: string | null;
  metadata: unknown;
  created_at: string | null;
}

export interface PatientPhoneRow {
  id: string;
  practice_id: string | null;
  cell_number: string | null;
}

/** A practice_sms_replies row as first stored (status 'new' until the outcome is recorded). */
export interface NewSmsReplyRow {
  practice_id: string | null;
  patient_id: string | null;
  visit_id: string | null;
  sms_log_id: string | null;
  source_phone: string;
  source_phone_e164: string | null;
  destination_phone: string | null;
  message: string;
  original_message: string | null;
  original_message_type: string | null;
  intent: SmsReplyIntent;
  rating: number | null;
  status: SmsReplyStatus;
  provider_event_id: string;
  provider_opt_out: boolean;
  received_at: string;
  raw: unknown;
}

export interface SmsReplyOutcomeRow {
  action_taken: string;
  status: SmsReplyStatus;
  handled_at: string | null;
  auto_reply_log_id: string | null;
}

export interface AutoReplyRequest {
  practiceId: string;
  phone: string;
  text: string;
  patientId: string | null;
  visitId: string | null;
  replyId: string;
  inReplyToLogId: string | null;
}

export type AutoReplyResult = { ok: true; logId: string | null } | { ok: false; error: string };

export interface ReplyRepository {
  findSmsLog(logId: string): Promise<SmsLogRow | null>;
  /** Messages (not failed) to numbers matching the LIKE pattern since the given time, newest first */
  findRecentSmsLogs(phonePattern: string, sinceIso: string): Promise<SmsLogRow[]>;
  /** Patient files whose cell number matches the LIKE pattern, in one practice or (null) in any */
  findPatientsByPhone(phonePattern: string, practiceId: string | null): Promise<PatientPhoneRow[]>;
  findPractice(practiceId: string): Promise<PracticeForReply | null>;
  findVisit(visitId: string): Promise<SmsVisit | null>;
  /** The patient's visits in the practice on or after the date that are not cancelled */
  findUpcomingVisits(patientId: string, practiceId: string, fromDate: string): Promise<SmsVisit[]>;
  /** Store a reply; 'duplicate' when its provider_event_id is already stored. Throws on any other failure. */
  insertReply(row: NewSmsReplyRow): Promise<{ id: string } | 'duplicate'>;
  recordOutcome(replyId: string, outcome: SmsReplyOutcomeRow): Promise<void>;
  /** Automatic answers sent to the number since the given time, or null when unknown */
  countAutoReplies(e164: string, sinceIso: string): Promise<number | null>;
  /** Apply the changes only while the visit is still this patient's scheduled appointment; true when it changed */
  updateScheduledVisit(visitId: string, owner: { patientId: string; practiceId: string }, changes: Record<string, unknown>): Promise<boolean>;
  cancelPendingReminders(visitId: string): Promise<void>;
  /** Set (or clear) sms_opt_out on these patient files of the practice; the number of files changed. Throws on failure. */
  setSmsOptOut(practiceId: string, patientIds: string[], optOut: boolean, atIso: string): Promise<number>;
  /** Send through centralized-sms-gateway (logged and counted against the practice's SMS bundle) */
  sendAutoReply(request: AutoReplyRequest): Promise<AutoReplyResult>;
}

export interface ReplyMatch {
  sourceE164: string | null;
  log: SmsLogRow | null;
  practice: PracticeForReply | null;
  patientId: string | null;
  /** Patient files of the practice that use the sender's number (STOP / START applies to all of them) */
  optOutTargets: string[];
  visit: SmsVisit | null;
  upcomingVisitCount: number;
}

export const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 200);

const samePhone = (stored: string | null | undefined, e164: string) => normalizePhoneNumber(stored) === e164;

const originalOf = (log: SmsLogRow | null): OriginalSmsMessage | null =>
  log ? { messageType: log.message_type, metadata: log.metadata } : null;

/** The message the patient answered: by customerId (exact), else the latest message to the number. */
async function findOriginalMessage(repo: ReplyRepository, reply: SmsPortalReply, sourceE164: string, now: Date): Promise<SmsLogRow | null> {
  const logId = smsLogIdFromCustomerId(reply.customerId);
  if (logId) {
    const log = await repo.findSmsLog(logId);
    // A customerId that points at a message to another number is not trusted
    if (log && samePhone(log.recipient_phone, sourceE164)) return log;
  }
  const pattern = storedPhoneSearchPattern(sourceE164);
  if (!pattern) return null;
  const since = new Date(now.getTime() - SMS_LOG_LOOKBACK_DAYS * DAY_MS).toISOString();
  const candidates = (await repo.findRecentSmsLogs(pattern, since)).filter((log) => samePhone(log.recipient_phone, sourceE164));
  const echoed = reply.sentText?.trim();
  return (echoed ? candidates.find((log) => (log.message_content ?? '').trim() === echoed) : undefined) ?? candidates[0] ?? null;
}

async function patientsWithPhone(repo: ReplyRepository, practiceId: string | null, e164: string): Promise<PatientPhoneRow[]> {
  const pattern = storedPhoneSearchPattern(e164);
  if (!pattern) return [];
  return (await repo.findPatientsByPhone(pattern, practiceId)).filter((patient) => samePhone(patient.cell_number, e164));
}

/** The visit the message was about, else the patient's only upcoming visit that a reply may change. */
async function findVisitFor(
  repo: ReplyRepository,
  log: SmsLogRow | null,
  owner: { patientId: string; practiceId: string },
  now: Date
): Promise<{ visit: SmsVisit | null; upcomingVisitCount: number }> {
  const linkedId = log?.visit_id ?? log?.appointment_id ?? null;
  if (linkedId && UUID_PATTERN.test(linkedId)) {
    const linked = await repo.findVisit(linkedId);
    if (linked) return { visit: linked, upcomingVisitCount: 0 };
  }
  const upcoming = (await repo.findUpcomingVisits(owner.patientId, owner.practiceId, clinicDateKey(now))).filter(
    (visit) => checkVisitForSmsAction(visit, owner, now).ok
  );
  return upcoming.length === 1 ? { visit: upcoming[0], upcomingVisitCount: 1 } : { visit: null, upcomingVisitCount: upcoming.length };
}

/** Who and what the reply is about. Never throws: whatever cannot be matched stays null for staff. */
export async function matchReply(repo: ReplyRepository, reply: SmsPortalReply, now: Date): Promise<ReplyMatch> {
  const sourceE164 = normalizePhoneNumber(reply.sourcePhone);
  const match: ReplyMatch = {
    sourceE164,
    log: null,
    practice: null,
    patientId: null,
    optOutTargets: [],
    visit: null,
    upcomingVisitCount: 0,
  };
  if (!sourceE164) return match;

  try {
    match.log = await findOriginalMessage(repo, reply, sourceE164, now);
    let practiceId = match.log?.practice_id ?? null;
    if (!practiceId) {
      // A fresh text (e.g. BOOK) with no earlier message: route it only when one practice has this number
      const practices = new Set((await patientsWithPhone(repo, null, sourceE164)).map((patient) => patient.practice_id));
      const only = practices.size === 1 ? [...practices][0] : null;
      practiceId = only ?? null;
    }
    if (!practiceId) return match;
    match.practice = await repo.findPractice(practiceId);
    if (!match.practice) return match;

    const files = (await patientsWithPhone(repo, practiceId, sourceE164)).map((patient) => patient.id);
    match.patientId = match.log?.patient_id ?? (files.length === 1 ? files[0] : null);
    match.optOutTargets = [...new Set([match.log?.patient_id, ...files].filter((id): id is string => !!id))];

    if (replyContextFor(originalOf(match.log)) === 'appointment' && match.patientId) {
      const found = await findVisitFor(repo, match.log, { patientId: match.patientId, practiceId }, now);
      match.visit = found.visit;
      match.upcomingVisitCount = found.upcomingVisitCount;
    }
  } catch (error) {
    console.error('sms-reply-webhook: matching failed:', errorText(error));
  }
  return match;
}

const failedPlan = (plan: ReplyPlan, note: string): ReplyPlan => ({ ...plan, action: 'none', status: 'new', note, autoReply: null });

/** Make the change the plan asks for. When it fails, staff get the reply and the patient gets no answer. */
async function carryOut(repo: ReplyRepository, plan: ReplyPlan, match: ReplyMatch, now: Date): Promise<ReplyPlan> {
  const stamp = now.toISOString();
  const owner = match.practice && match.patientId ? { patientId: match.patientId, practiceId: match.practice.id } : null;

  switch (plan.action) {
    case 'confirm_visit': {
      // As visitsStore.confirmVisit does
      const saved = !!match.visit && !!owner && (await repo.updateScheduledVisit(match.visit.id, owner, { is_confirmed: true, updated_at: stamp }));
      return saved ? plan : failedPlan(plan, 'Replied YES, but the appointment changed meanwhile or could not be saved: confirm it by hand.');
    }
    case 'cancel_visit': {
      // As visitsStore.cancelVisit does, with the note that says the patient cancelled by SMS
      const saved =
        !!match.visit &&
        !!owner &&
        (await repo.updateScheduledVisit(match.visit.id, owner, {
          is_cancelled: true,
          status: 'cancelled',
          notes: appendCancellationNote(match.visit.notes),
          updated_at: stamp,
        }));
      if (!saved || !match.visit) {
        return failedPlan(plan, 'Wants to cancel, but the appointment changed meanwhile or could not be saved: cancel it by hand.');
      }
      // As appointmentService.cancelAppointment does: no reminders for a cancelled visit. The visit is
      // cancelled either way; the reminder sender also skips cancelled visits.
      try {
        await repo.cancelPendingReminders(match.visit.id);
      } catch (error) {
        console.warn('sms-reply-webhook: could not cancel pending reminders:', errorText(error));
      }
      return plan;
    }
    case 'opt_out':
    case 'opt_in': {
      const optOut = plan.action === 'opt_out';
      if (!match.practice) return failedPlan(plan, 'No practice matched: change the patient file by hand.');
      try {
        const changed = await repo.setSmsOptOut(match.practice.id, match.optOutTargets, optOut, stamp);
        if (changed === 0) {
          return { ...plan, note: optOut ? 'Asked to stop SMS again (already opted out).' : 'Asked to receive SMS again (already receiving them).' };
        }
        return plan;
      } catch (error) {
        return failedPlan(
          plan,
          `${optOut ? 'Asked to stop SMS' : 'Asked to receive SMS again'}, but the patient file could not be updated (${errorText(error)}): change it by hand.`
        );
      }
    }
    default:
      return plan;
  }
}

export type HandleSmsReplyResult =
  | { duplicate: true }
  | { duplicate: false; replyId: string; intent: SmsReplyIntent; action: SmsReplyAction; status: SmsReplyStatus };

export interface HandleSmsReplyInput {
  reply: SmsPortalReply;
  /** replyIdempotencyKey(reply) */
  eventKey: string;
  /** The body as received, stored for support */
  rawPayload: unknown;
  now: Date;
}

/** Match, store once, act and answer. Throws only when the reply could not be stored. */
export async function handleSmsReply(input: HandleSmsReplyInput, repo: ReplyRepository): Promise<HandleSmsReplyResult> {
  const { reply, eventKey, rawPayload, now } = input;
  const match = await matchReply(repo, reply, now);
  const original = originalOf(match.log);
  const context = replyContextFor(original);
  const interpretation = interpretReply(reply.incomingText, context, { providerOptOut: reply.optOut });
  const visit = context === 'appointment' ? match.visit : null;

  const stored = await repo.insertReply({
    practice_id: match.practice?.id ?? null,
    patient_id: match.practice ? match.patientId : null,
    visit_id: visit?.id ?? null,
    sms_log_id: match.log?.id ?? null,
    source_phone: reply.sourcePhone,
    source_phone_e164: match.sourceE164,
    destination_phone: reply.destinationPhone,
    message: reply.incomingText,
    original_message: match.log?.message_content ?? reply.sentText,
    original_message_type: match.log?.message_type ?? null,
    intent: interpretation.intent,
    rating: interpretation.rating,
    status: 'new',
    provider_event_id: eventKey,
    provider_opt_out: reply.optOut,
    received_at: reply.incomingAt ?? now.toISOString(),
    raw: rawPayload,
  });
  if (stored === 'duplicate') return { duplicate: true };

  let outcome: ReplyPlan;
  let autoReplyLogId: string | null = null;
  try {
    const recentAutoReplies = match.sourceE164
      ? await repo.countAutoReplies(match.sourceE164, new Date(now.getTime() - DAY_MS).toISOString())
      : null;
    const plan = planReplyHandling({
      interpretation,
      practice: match.practice,
      patientId: match.patientId,
      visit,
      upcomingVisitCount: match.upcomingVisitCount,
      optOutTargetCount: match.optOutTargets.length,
      canAutoReply: match.sourceE164 !== null,
      originalIsAutoReply: isAutoReplyMessage(original),
      // Unknown counts as the limit: no automatic answer rather than a possible loop
      autoRepliesInLastDay: recentAutoReplies ?? AUTO_REPLY_DAILY_LIMIT_PER_PHONE,
      providerOptOut: reply.optOut,
      now,
    });
    outcome = await carryOut(repo, plan, match, now);

    if (outcome.autoReply && match.practice && match.sourceE164) {
      const sent = await repo.sendAutoReply({
        practiceId: match.practice.id,
        phone: match.sourceE164,
        text: outcome.autoReply,
        patientId: match.patientId,
        visitId: visit?.id ?? null,
        replyId: stored.id,
        inReplyToLogId: match.log?.id ?? null,
      });
      if (sent.ok) {
        autoReplyLogId = sent.logId;
        outcome = { ...outcome, note: `${outcome.note} Automatic answer sent.` };
      } else {
        outcome = { ...outcome, note: `${outcome.note} Automatic answer not sent: ${sent.error}.` };
      }
    }
  } catch (error) {
    console.error('sms-reply-webhook: handling failed:', errorText(error));
    outcome = { action: 'none', status: 'new', note: `Not handled automatically (${errorText(error)}): please read it.`, autoReply: null };
  }

  await repo.recordOutcome(stored.id, {
    action_taken: outcome.note.slice(0, 1000),
    status: outcome.status,
    handled_at: outcome.status === 'handled' ? now.toISOString() : null,
    auto_reply_log_id: autoReplyLogId,
  });

  return { duplicate: false, replyId: stored.id, intent: interpretation.intent, action: outcome.action, status: outcome.status };
}

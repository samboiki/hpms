/**
 * What the reply webhook does about a reply: which change to make, whether staff must look at it,
 * and the automatic answer. Pure TypeScript (no Deno APIs): unit tested with Vitest.
 *
 * Rules
 * - Only a visit that belongs to the replying patient, is still in the "scheduled" stage and lies in
 *   the future is confirmed or cancelled. A visit under way, finished, a no-show or in the past is
 *   never touched: the reply goes to staff instead.
 * - The automatic answer always says what really happened, so it is only sent after the change
 *   succeeded (the webhook drops it when the database update fails).
 * - No automatic answer to an automatic answer, none when the number cannot receive SMS, and at most
 *   AUTO_REPLY_DAILY_LIMIT_PER_PHONE a day per number (each one costs the practice an SMS credit).
 */
import type { ReplyInterpretation } from './smsReplyIntent.ts';

// ---------------------------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------------------------

export interface SmsVisit {
  id: string;
  practice_id: string | null;
  patient_id: string | null;
  status: string | null;
  is_confirmed?: boolean | null;
  is_cancelled?: boolean | null;
  is_checked_in?: boolean | null;
  is_ready?: boolean | null;
  is_handoff?: boolean | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  visit_date?: string | null;
  visit_time?: string | null;
  notes?: string | null;
}

/** The visits columns the webhook reads (the SmsVisit fields). */
export const SMS_VISIT_COLUMNS =
  'id, practice_id, patient_id, status, is_confirmed, is_cancelled, is_checked_in, is_ready, is_handoff, scheduled_date, scheduled_time, visit_date, visit_time, notes';

export type SmsVisitStage = 'scheduled' | 'checked-in' | 'in-progress' | 'handed-off' | 'completed' | 'no-show' | 'cancelled';

/** Where a visit is in the patient flow: the same rules as getVisitStage in src/utils/visitStage.ts. */
export function smsVisitStage(visit: Pick<SmsVisit, 'status' | 'is_cancelled' | 'is_checked_in' | 'is_ready' | 'is_handoff'>): SmsVisitStage {
  const status = visit.status ?? '';
  if (visit.is_cancelled || status === 'cancelled') return 'cancelled';
  if (status === 'no-show') return 'no-show';
  if (status === 'completed') return 'completed';
  if (visit.is_handoff) return 'handed-off';
  if (status === 'in-progress') return 'in-progress';
  if (visit.is_checked_in || visit.is_ready || status === 'ready') return 'checked-in';
  return 'scheduled';
}

/** Namibia keeps UTC+2 all year (no daylight saving since 2017). Visit dates and times are local. */
export const CLINIC_UTC_OFFSET = '+02:00';

const CLINIC_OFFSET_MINUTES = (() => {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(CLINIC_UTC_OFFSET);
  return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
})();

/** Today's date at the clinic (YYYY-MM-DD). Edge functions run in UTC, which is yesterday before 02:00. */
export function clinicDateKey(now: Date): string {
  return new Date(now.getTime() + CLINIC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_KEY = /^(\d{1,2}):(\d{2})/;

const dateKey = (value: string | null | undefined): string | null => {
  const match = DATE_KEY.exec((value ?? '').trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};
const timeKey = (value: string | null | undefined): string | null => {
  const match = TIME_KEY.exec((value ?? '').trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

/**
 * The visit's local date and time. Bookings write scheduled_* and visit_*; a reschedule moves both,
 * so scheduled_* is read first and the pairs are never mixed.
 */
export function visitDateTime(visit: SmsVisit): { date: string; time: string | null } | null {
  const scheduledDate = dateKey(visit.scheduled_date);
  if (scheduledDate) return { date: scheduledDate, time: timeKey(visit.scheduled_time) };
  const visitDate = dateKey(visit.visit_date);
  if (visitDate) return { date: visitDate, time: timeKey(visit.visit_time) };
  return null;
}

/** When the visit starts. A visit without a time counts until the end of its day. */
export function visitStartInstant(visit: SmsVisit): Date | null {
  const when = visitDateTime(visit);
  if (!when) return null;
  const ms = Date.parse(`${when.date}T${when.time ?? '23:59'}:00${CLINIC_UTC_OFFSET}`);
  return Number.isNaN(ms) ? null : new Date(ms);
}

export type VisitCheckCode = 'missing' | 'other_patient' | 'cancelled' | 'no_show' | 'completed' | 'under_way' | 'no_date' | 'past';

export type VisitCheck = { ok: true } | { ok: false; code: VisitCheckCode; reason: string };

/** May an SMS reply confirm or cancel this visit? */
export function checkVisitForSmsAction(
  visit: SmsVisit | null,
  owner: { patientId: string | null; practiceId: string | null },
  now: Date
): VisitCheck {
  if (!visit) return { ok: false, code: 'missing', reason: 'no appointment was found for this reply' };
  if (!owner.patientId || !owner.practiceId || visit.patient_id !== owner.patientId || visit.practice_id !== owner.practiceId) {
    return { ok: false, code: 'other_patient', reason: "the appointment linked to the message is not this patient's" };
  }
  const stage = smsVisitStage(visit);
  if (stage === 'cancelled') return { ok: false, code: 'cancelled', reason: 'the appointment is already cancelled' };
  if (stage === 'no-show') return { ok: false, code: 'no_show', reason: 'the appointment was marked as a no-show' };
  if (stage === 'completed') return { ok: false, code: 'completed', reason: 'the visit is already completed' };
  if (stage !== 'scheduled') return { ok: false, code: 'under_way', reason: 'the patient is already checked in or being seen' };
  const start = visitStartInstant(visit);
  if (!start) return { ok: false, code: 'no_date', reason: 'the appointment has no date' };
  if (start.getTime() <= now.getTime()) return { ok: false, code: 'past', reason: 'the appointment time has passed' };
  return { ok: true };
}

/** The note the app adds when a patient cancels by SMS (same layout as cancelling in the app). */
export const SMS_CANCELLATION_NOTE = '[Cancelled by patient by SMS]';

export function appendCancellationNote(notes: string | null | undefined): string {
  const existing = (notes ?? '').trim();
  return existing ? `${existing}\n\n${SMS_CANCELLATION_NOTE}` : SMS_CANCELLATION_NOTE;
}

// ---------------------------------------------------------------------------------------------
// Automatic answers
// ---------------------------------------------------------------------------------------------

/** One SMS segment (GSM-7). Longer answers cost the practice two credits. */
export const SMS_SINGLE_MESSAGE_LENGTH = 160;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 7 Oct at 10:00" (day first), "Tue 7 Oct" without a time, or null without a date. */
export function formatVisitWhen(visit: SmsVisit | null): string | null {
  if (!visit) return null;
  const when = visitDateTime(visit);
  if (!when) return null;
  const [year, month, day] = when.date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const date = `${weekday} ${day} ${MONTHS[month - 1]}`;
  return when.time ? `${date} at ${when.time}` : date;
}

/** The practice phone for an SMS: the first number of the field, or null. */
export function practicePhoneForSms(contactPhone: string | null | undefined): string | null {
  const first = (contactPhone ?? '').split(/[,;/|]|\bor\b/i)[0]?.trim() ?? '';
  return /\d{6,}/.test(first.replace(/\D/g, '')) && first.length <= 20 ? first : null;
}

/** Build an answer that fits one SMS: the practice name is shortened (never the instruction). */
export function fitReply(build: (practiceName: string) => string, practiceName: string | null | undefined): string {
  const name = (practiceName ?? '').trim() || 'Your clinic';
  const full = build(name);
  if (full.length <= SMS_SINGLE_MESSAGE_LENGTH) return full;
  const room = SMS_SINGLE_MESSAGE_LENGTH - (full.length - name.length);
  if (room < 8) return full;
  const cut = name.slice(0, room);
  // Cut at the last whole word (the cut may already end exactly at one)
  const atWord = name.charAt(room) === ' ' ? cut.length : cut.lastIndexOf(' ');
  return build((atWord >= 8 ? cut.slice(0, atWord) : cut).trim());
}

const on = (when: string | null) => (when ? `on ${when} ` : '');

/** The automatic answers. Short, plain, and they always name the practice. */
export const AUTO_REPLY_TEXTS = {
  confirmed: (name: string, when: string | null) => `${name}: Thank you, your appointment ${on(when)}is confirmed.`,
  cancelled: (name: string, when: string | null, phone: string | null) =>
    `${name}: Your appointment ${on(when)}is cancelled. Reply BOOK${phone ? ` or call ${phone}` : ''} to make a new one.`,
  reschedule: (name: string) => `${name}: Thank you. We will contact you to find a new time.`,
  booking: (name: string) => `${name}: Thank you, we received your booking request and will contact you to arrange a time.`,
  waitlistAccepted: (name: string) => `${name}: Thank you. We will contact you to confirm the time.`,
  optedOut: (name: string) =>
    `${name}: You will no longer get news or offers by SMS. Messages about your appointments and results will still be sent. Reply START to undo.`,
  optedIn: (name: string) => `${name}: You will get all our SMS messages again. Reply STOP to opt out.`,
  help: (name: string, phone: string | null) =>
    `${name}: ${phone ? `Call us on ${phone}.` : 'Please call the practice.'} Reply 1 to confirm or 2 to cancel an appointment, 3 for a new time, STOP to opt out.`,
  rating: (name: string) => `${name}: Thank you for your feedback.`,
};

// ---------------------------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------------------------

/** At most this many automatic answers per phone number in 24 hours (loops and abuse cost credits). */
export const AUTO_REPLY_DAILY_LIMIT_PER_PHONE = 5;

export type SmsReplyAction = 'confirm_visit' | 'cancel_visit' | 'opt_out' | 'opt_in' | 'none';
export type SmsReplyStatus = 'new' | 'handled';

export interface PracticeForReply {
  id: string;
  name: string | null;
  contactPhone: string | null;
}

export interface ReplyPlanInput {
  interpretation: ReplyInterpretation;
  practice: PracticeForReply | null;
  patientId: string | null;
  /** The visit the original message was about (or the patient's only upcoming visit) */
  visit: SmsVisit | null;
  /** Upcoming visits of the patient, when no single visit could be linked */
  upcomingVisitCount?: number;
  /** Patient files in the practice that use the sender's number (opt-out / opt-in targets) */
  optOutTargetCount: number;
  /** False when the sender's number is not a phone number we can text */
  canAutoReply: boolean;
  /** The patient answered one of the webhook's automatic answers */
  originalIsAutoReply: boolean;
  autoRepliesInLastDay: number;
  /** SMSPortal itself recorded the opt-out (and blocks further messages to the number) */
  providerOptOut: boolean;
  now: Date;
}

export interface ReplyPlan {
  action: SmsReplyAction;
  /** 'new' = waiting for staff ("Needs reply"), 'handled' = nothing left to do */
  status: SmsReplyStatus;
  /** What happened or why staff must look, in plain language */
  note: string;
  autoReply: string | null;
}

const plan = (action: SmsReplyAction, status: SmsReplyStatus, note: string, autoReply: string | null = null): ReplyPlan => ({
  action,
  status,
  note,
  autoReply,
});

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function planVisitAnswer(input: ReplyPlanInput, practice: PracticeForReply, wantsCancel: boolean): ReplyPlan {
  const { visit } = input;
  const check = checkVisitForSmsAction(visit, { patientId: input.patientId, practiceId: practice.id }, input.now);
  const when = formatVisitWhen(visit);
  const phone = practicePhoneForSms(practice.contactPhone);
  const confirmedText = fitReply((name) => AUTO_REPLY_TEXTS.confirmed(name, when), practice.name);
  const cancelledText = fitReply((name) => AUTO_REPLY_TEXTS.cancelled(name, when, phone), practice.name);
  const answered = wantsCancel ? 'Wants to cancel' : 'Replied YES';

  if (!check.ok) {
    if (check.code === 'missing') {
      const count = input.upcomingVisitCount ?? 0;
      return plan(
        'none',
        'new',
        count > 1
          ? `${answered}, but has ${count} upcoming appointments: check which one is meant.`
          : `${answered}, but no upcoming appointment was found.`
      );
    }
    if (check.code === 'cancelled') {
      return wantsCancel
        ? plan('none', 'handled', `The appointment${when ? ` on ${when}` : ''} was already cancelled.`, cancelledText)
        : plan('none', 'new', `Replied YES, but the appointment${when ? ` on ${when}` : ''} is cancelled: call the patient to rebook.`);
    }
    return plan('none', 'new', `${answered}, but ${check.reason}: nothing was changed.`);
  }

  if (wantsCancel) {
    return plan('cancel_visit', 'handled', `Appointment${when ? ` on ${when}` : ''} cancelled by the patient.`, cancelledText);
  }
  if (visit?.is_confirmed) {
    return plan('none', 'handled', `Appointment${when ? ` on ${when}` : ''} was already confirmed.`, confirmedText);
  }
  return plan('confirm_visit', 'handled', `Appointment${when ? ` on ${when}` : ''} confirmed.`, confirmedText);
}

function basePlan(input: ReplyPlanInput): ReplyPlan {
  const { interpretation, practice } = input;
  if (!practice) {
    return plan('none', 'new', 'Could not tell which practice this reply is for (no matching message or patient).');
  }
  const text = (build: (name: string) => string) => fitReply(build, practice.name);

  switch (interpretation.intent) {
    case 'confirm':
      return planVisitAnswer(input, practice, false);
    case 'cancel':
      return planVisitAnswer(input, practice, true);
    case 'reschedule':
      return plan('none', 'new', 'Wants a new appointment time: contact the patient.', text(AUTO_REPLY_TEXTS.reschedule));
    case 'booking':
      return plan('none', 'new', 'Wants to book an appointment: contact the patient.', text(AUTO_REPLY_TEXTS.booking));
    case 'waitlist_accept':
      return plan('none', 'new', 'Wants the offered appointment slot: book it if it is still free.', text(AUTO_REPLY_TEXTS.waitlistAccepted));
    case 'waitlist_decline':
      return plan('none', 'handled', 'Declined the offered appointment slot.');
    case 'opt_out':
      if (input.optOutTargetCount === 0) {
        return plan('none', 'new', 'Asked to stop SMS, but no patient file in this practice has this number: update the file by hand.');
      }
      return plan(
        'opt_out',
        'handled',
        'Opted out of news, offers, birthday and recall SMS. Appointment and results messages continue.',
        // SMSPortal blocks messages to a number on its own opt-out list, so an answer would not arrive
        input.providerOptOut ? null : text(AUTO_REPLY_TEXTS.optedOut)
      );
    case 'opt_in':
      if (input.optOutTargetCount === 0) {
        return plan('none', 'new', 'Asked to receive SMS again, but no patient file in this practice has this number.');
      }
      return plan('opt_in', 'handled', 'Opted back in to all SMS messages.', text(AUTO_REPLY_TEXTS.optedIn));
    case 'help':
      return plan(
        'none',
        'handled',
        'Asked for help: the practice phone number and reply options were sent.',
        text((name) => AUTO_REPLY_TEXTS.help(name, practicePhoneForSms(practice.contactPhone)))
      );
    case 'rating': {
      const rating = interpretation.rating ?? 0;
      return rating <= 3
        ? plan('none', 'new', `Rated the visit ${rating}/5: consider calling the patient.`, text(AUTO_REPLY_TEXTS.rating))
        : plan('none', 'handled', `Rated the visit ${rating}/5.`, text(AUTO_REPLY_TEXTS.rating));
    }
    case 'free_text':
    default:
      return plan('none', 'new', `Needs a person: ${lowerFirst(interpretation.reason)}`);
  }
}

/** Decide what to do about a reply. */
export function planReplyHandling(input: ReplyPlanInput): ReplyPlan {
  const base = basePlan(input);
  if (!base.autoReply) return base;
  if (!input.canAutoReply) return { ...base, autoReply: null, note: `${base.note} No automatic answer: the number cannot receive SMS.` };
  if (input.originalIsAutoReply) {
    return { ...base, autoReply: null, note: `${base.note} No automatic answer: the patient was answering an automatic message.` };
  }
  if (input.autoRepliesInLastDay >= AUTO_REPLY_DAILY_LIMIT_PER_PHONE) {
    return { ...base, autoReply: null, note: `${base.note} No automatic answer: daily limit for this number reached.` };
  }
  return base;
}

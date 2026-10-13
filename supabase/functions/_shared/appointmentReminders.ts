/**
 * Appointment reminders: which bookings are due an SMS reminder, what the SMS says, and the key that
 * makes sure a booking is never reminded twice for the same slot. One set of rules for both senders:
 * the send-appointment-reminders edge function (the automatic schedule) and the diary's "Remind
 * patients" action that reception runs by hand.
 *
 * Rules
 * - Only confirmed bookings that are still in the "scheduled" stage get a reminder: not a website
 *   request nobody confirmed, not a cancelled booking, not a patient already in the waiting room.
 * - A patient who replied STOP (patients.sms_opt_out) gets no reminder (owner decision). Staff can
 *   still send a one-off SMS from the booking.
 * - Each reminder is claimed once per booking, kind and slot (diary_reminder_log, unique) before it is
 *   sent. A booking moved to a new time is a new slot and may be reminded again; the same slot never.
 * - The schedule never sends between 20:00 and 07:00 (Windhoek time), and a booking made after its
 *   reminder time is not reminded automatically: the patient has just spoken to the practice.
 *
 * Pure TypeScript (no Deno APIs): unit tested with Vitest, imported by the app and the edge function.
 */
import {
  clinicDateKey,
  CLINIC_UTC_OFFSET,
  formatVisitWhen,
  practicePhoneForSms,
  smsVisitStage,
  visitDateTime,
  type SmsVisit,
  type SmsVisitStage
} from './smsReplyPlan.ts';
import { normalizePhoneNumber } from './smsPhone.ts';
import { replyInviteProblem, withReplyInvite } from './smsMessagePolicy.ts';

// ---------------------------------------------------------------------------------------------
// Settings (one row per practice in diary_settings, proposals/2026-10-07-diary-2.sql)
// ---------------------------------------------------------------------------------------------

export type ReminderKind = 'day_before' | 'same_day';

export interface ReminderSettings {
  /** The automatic schedule sends reminders. Reception's "Remind patients" works either way. */
  enabled: boolean;
  /** Remind the day before the appointment... */
  dayBefore: boolean;
  /** ...at this time ('HH:mm', Windhoek time) */
  dayBeforeTime: string;
  /** Also remind on the day itself... */
  sameDay: boolean;
  /** ...this many hours before the appointment (1-12) */
  sameDayHoursBefore: number;
  /** The SMS, with {{placeholders}} (REMINDER_PLACEHOLDERS) */
  template: string;
}

/** No automatic reminder before this time or from QUIET_FROM on (minutes since midnight, clinic time). */
export const REMINDER_QUIET_UNTIL = 7 * 60;
export const REMINDER_QUIET_FROM = 20 * 60;

export const REMINDER_HOURS_BEFORE_MIN = 1;
export const REMINDER_HOURS_BEFORE_MAX = 12;
/** Three SMS parts at most: a longer reminder costs the practice too many credits per patient */
export const REMINDER_TEMPLATE_MAX = 459;

/**
 * The reminder's reply line, added only while the practice's replies are collected (withReplyInvite,
 * smsMessagePolicy.ts). The words are the ones the reply webhook understands for an appointment reminder
 * (smsReplyIntent.ts): 1 confirms, 2 cancels, 3 asks for a new time.
 */
export const REMINDER_REPLY_INVITE = 'Reply 1 to confirm, 2 to cancel, 3 for a new time.';

/**
 * Fits one SMS (160 characters) with typical names, the reply line included. The column default in
 * proposals/2026-10-07-diary-2.sql still ends in the reply line; it is read as this text (a unit test compares them).
 */
export const DEFAULT_REMINDER_TEMPLATE =
  '{{practiceName}}: Hi {{patientFirstName}}, reminder: appointment with {{practitionerName}} on {{appointmentDate}} at {{appointmentTime}}.';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  dayBefore: true,
  dayBeforeTime: '10:00',
  sameDay: false,
  sameDayHoursBefore: 2,
  template: DEFAULT_REMINDER_TEMPLATE
};

export interface ReminderPlaceholder {
  /** The placeholder name, written {{name}} in the template */
  name: string;
  /** What staff see on the button that inserts it */
  label: string;
}

export const REMINDER_PLACEHOLDERS: readonly ReminderPlaceholder[] = [
  { name: 'patientFirstName', label: 'First name' },
  { name: 'patientName', label: 'Full name' },
  { name: 'appointmentDate', label: 'Date' },
  { name: 'appointmentTime', label: 'Time' },
  { name: 'practitionerName', label: 'Practitioner' },
  { name: 'practiceName', label: 'Practice name' },
  { name: 'practicePhone', label: 'Practice phone' },
  // A video booking's room link (visits.video_link); its own line is left out for a booking seen in the rooms
  { name: 'videoLink', label: 'Video link (own line)' }
];

/** Older templates in the app call the practitioner {{doctorName}}: it is filled the same way. */
const PLACEHOLDER_ALIASES: Readonly<Record<string, string>> = { doctorName: 'practitionerName' };

/** A reminder must say when: without these the patient cannot act on it. */
export const REQUIRED_REMINDER_PLACEHOLDERS = ['appointmentDate', 'appointmentTime'] as const;

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const TIME = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/** 'HH:mm', 'H:mm' or 'HH:mm:ss' as minutes since midnight, or null. */
export function reminderTimeToMinutes(value: string | null | undefined): number | null {
  const match = TIME.exec((value ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** A room link for a message: only a secure one (the database allows no other, visits_video_link_check) */
const secureLink = (value: unknown): string | null => {
  const link = text(value);
  return link && /^https:\/\/\S+$/.test(link) ? link : null;
};

/**
 * A diary_settings row as reminder settings. Anything missing or unreadable falls back to the defaults. A saved
 * message that ends in the reply line is read without it: OneHealth adds the line only while replies are collected.
 */
export function normalizeReminderSettings(row: unknown): ReminderSettings {
  if (!row || typeof row !== 'object') return { ...DEFAULT_REMINDER_SETTINGS };
  const r = row as Record<string, unknown>;
  const time = reminderTimeToMinutes(text(r.reminder_day_before_time));
  const hours = Number(r.reminder_same_day_hours);
  return {
    enabled: r.reminders_enabled === true,
    dayBefore: typeof r.reminder_day_before === 'boolean' ? r.reminder_day_before : DEFAULT_REMINDER_SETTINGS.dayBefore,
    dayBeforeTime: time === null ? DEFAULT_REMINDER_SETTINGS.dayBeforeTime : toTime(time),
    sameDay: r.reminder_same_day === true,
    sameDayHoursBefore:
      Number.isInteger(hours) && hours >= REMINDER_HOURS_BEFORE_MIN && hours <= REMINDER_HOURS_BEFORE_MAX
        ? hours
        : DEFAULT_REMINDER_SETTINGS.sameDayHoursBefore,
    template: withReplyInvite(text(r.reminder_template) ?? DEFAULT_REMINDER_TEMPLATE, REMINDER_REPLY_INVITE, false)
  };
}

/** Placeholders in a template that a reminder cannot fill ("{{offer}}"), each once. */
export function unknownReminderPlaceholders(template: string): string[] {
  const known = new Set([...REMINDER_PLACEHOLDERS.map((p) => p.name), ...Object.keys(PLACEHOLDER_ALIASES)]);
  const unknown: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    if (!known.has(match[1]) && !unknown.includes(match[0])) unknown.push(match[0]);
  }
  return unknown;
}

export type ReminderSettingsValidation = { ok: true; settings: ReminderSettings } | { ok: false; errors: string[] };

/**
 * Checks the settings form in plain words. Mirrors the CHECK constraints and save_diary_settings in the SQL.
 * `repliesLive`: the practice's SMS replies are collected (smsMessagePolicy.ts); until then the message may not ask
 * patients to reply.
 */
export function validateReminderSettings(input: ReminderSettings, repliesLive: boolean): ReminderSettingsValidation {
  const errors: string[] = [];
  const time = reminderTimeToMinutes(input.dayBeforeTime);
  if (input.dayBefore) {
    if (time === null) errors.push('Choose the time to send the day-before reminder.');
    else if (time < REMINDER_QUIET_UNTIL || time >= REMINDER_QUIET_FROM) {
      errors.push(`Send the day-before reminder between ${toTime(REMINDER_QUIET_UNTIL)} and ${toTime(REMINDER_QUIET_FROM - 1)}, not at night.`);
    }
  }
  const hours = Number(input.sameDayHoursBefore);
  if (input.sameDay && !(Number.isInteger(hours) && hours >= REMINDER_HOURS_BEFORE_MIN && hours <= REMINDER_HOURS_BEFORE_MAX)) {
    errors.push(`The same-day reminder goes ${REMINDER_HOURS_BEFORE_MIN} to ${REMINDER_HOURS_BEFORE_MAX} hours before the appointment.`);
  }
  if (input.enabled && !input.dayBefore && !input.sameDay) {
    errors.push('Choose when to remind: the day before, on the day, or both.');
  }
  const template = input.template.trim();
  if (!template) errors.push('Write the reminder message.');
  else {
    // What is sent, the reply line included while replies are collected
    if (withReplyInvite(template, REMINDER_REPLY_INVITE, repliesLive).length > REMINDER_TEMPLATE_MAX) {
      errors.push(`Keep the message under ${REMINDER_TEMPLATE_MAX} characters (3 SMS).`);
    }
    const unknown = unknownReminderPlaceholders(template);
    if (unknown.length > 0) errors.push(`${unknown.join(', ')} cannot be filled in a reminder. Use the buttons below the message.`);
    const missing = REQUIRED_REMINDER_PLACEHOLDERS.filter((name) => !new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`).test(template));
    if (missing.length > 0) {
      errors.push(`The message must include ${missing.map((name) => `{{${name}}}`).join(' and ')} so the patient knows when to come.`);
    }
    const replyProblem = replyInviteProblem(template, REMINDER_REPLY_INVITE, repliesLive);
    if (replyProblem) errors.push(replyProblem);
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    settings: {
      enabled: input.enabled,
      dayBefore: input.dayBefore,
      dayBeforeTime: time === null ? DEFAULT_REMINDER_SETTINGS.dayBeforeTime : toTime(time),
      sameDay: input.sameDay,
      sameDayHoursBefore: input.sameDay ? hours : input.sameDayHoursBefore,
      // Saved without the reply line: OneHealth adds it while replies are collected
      template: withReplyInvite(template, REMINDER_REPLY_INVITE, false)
    }
  };
}

// ---------------------------------------------------------------------------------------------
// The message
// ---------------------------------------------------------------------------------------------

export interface ReminderValues {
  patientFirstName?: string | null;
  patientName?: string | null;
  practiceName?: string | null;
  practitionerName?: string | null;
  /** "Thu 8 Oct" */
  appointmentDate?: string | null;
  /** "09:30" */
  appointmentTime?: string | null;
  practicePhone?: string | null;
  /** A video booking's room link; null for a booking seen in the rooms */
  videoLink?: string | null;
}

// A {{placeholder}} with the spaces before it, so an empty one leaves no gap ("Hi {{x}}," -> "Hi,")
const PLACEHOLDER_WITH_SPACE = /([ \t]*)\{\{\s*(\w+)\s*\}\}/g;
// A line whose only placeholder is {{videoLink}} ("Join the call: {{videoLink}}"), with its line break
const VIDEO_LINK_ONLY_LINE = /^[^\n{]*\{\{\s*videoLink\s*\}\}[^\n{]*(?:\n|$)/gm;

/**
 * The SMS for one patient. Every placeholder is filled with a real value or dropped, so a patient
 * never receives "{{...}}". Without a practice name the SMS starts "Your clinic:"; without a
 * practitioner it reads "appointment with us". For a booking seen in the rooms, a line that only
 * carries the video link ("Join the call: {{videoLink}}") is left out whole.
 */
export function renderReminderMessage(template: string, values: ReminderValues): string {
  const filled: Record<string, string> = {
    patientFirstName: values.patientFirstName?.trim() ?? '',
    patientName: values.patientName?.trim() ?? '',
    practiceName: values.practiceName?.trim() || 'Your clinic',
    practitionerName: values.practitionerName?.trim() || 'us',
    appointmentDate: values.appointmentDate?.trim() ?? '',
    appointmentTime: values.appointmentTime?.trim() ?? '',
    practicePhone: values.practicePhone?.trim() ?? '',
    videoLink: values.videoLink?.trim() ?? ''
  };
  return (filled.videoLink ? template : template.replace(VIDEO_LINK_ONLY_LINE, ''))
    .replace(PLACEHOLDER_WITH_SPACE, (_match, space: string, rawName: string) => {
      const value = filled[PLACEHOLDER_ALIASES[rawName] ?? rawName];
      return value ? `${space}${value}` : '';
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** "Thu 8 Oct" for a 'yyyy-MM-dd' day (the same words as the reply webhook's answers). */
export function formatReminderDate(dateKey: string): string {
  return formatVisitWhen({ id: '', practice_id: null, patient_id: null, status: null, scheduled_date: dateKey }) ?? dateKey;
}

/** What the settings screen shows as an example. Invented names and an invented room. */
export const SAMPLE_REMINDER_VALUES: ReminderValues = {
  patientFirstName: 'Maria',
  patientName: 'Maria Shikongo',
  practitionerName: 'Dr. T. Nghipandulwa',
  appointmentDate: 'Thu 8 Oct',
  appointmentTime: '09:30',
  practicePhone: '061 123 456',
  videoLink: 'https://meet.jit.si/hpms-example-room'
};

// ---------------------------------------------------------------------------------------------
// Who is due
// ---------------------------------------------------------------------------------------------

/** One booking as the reminder rules need it (a visits row with its patient). */
export interface ReminderBooking {
  visitId: string;
  practiceId: string;
  patientId: string | null;
  practitionerId: string | null;
  /** 'yyyy-MM-dd' (scheduled_date, else visit_date) */
  date: string | null;
  /** 'HH:mm', or null when the booking has no time */
  time: string | null;
  /** Where the visit is in the patient flow (smsVisitStage): only 'scheduled' bookings are reminded */
  stage: SmsVisitStage;
  isConfirmed: boolean;
  createdAt: string | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  cellNumber: string | null;
  smsOptOut: boolean;
  /** A video booking's room link (visits.video_link), for {{videoLink}}; null for a booking seen in the rooms */
  videoLink?: string | null;
}

/** The visits columns reminderBookingFromRow reads, before proposals/2026-10-13-video-bookings.sql. */
export const REMINDER_VISIT_COLUMNS_WITHOUT_VIDEO =
  'id, practice_id, patient_id, doctor_id, status, is_confirmed, is_cancelled, is_checked_in, is_ready, is_handoff, scheduled_date, scheduled_time, visit_date, visit_time, created_at';
/** The visits columns (and patient columns) reminderBookingFromRow reads. */
export const REMINDER_VISIT_COLUMNS = `${REMINDER_VISIT_COLUMNS_WITHOUT_VIDEO}, video_link`;
export const REMINDER_PATIENT_COLUMNS = 'id, first_name, last_name, cell_number, sms_opt_out';
/** Before proposals/2026-10-07-two-way-sms.sql there is no sms_opt_out column, so nobody has opted out. */
export const REMINDER_PATIENT_COLUMNS_WITHOUT_OPT_OUT = 'id, first_name, last_name, cell_number';

/** A visits row with `patient` embedded, or null when it is not a usable booking. */
export function reminderBookingFromRow(row: unknown): ReminderBooking | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const visitId = text(r.id);
  const practiceId = text(r.practice_id);
  if (!visitId || !practiceId) return null;
  const visit: SmsVisit = {
    id: visitId,
    practice_id: practiceId,
    patient_id: text(r.patient_id),
    status: text(r.status),
    is_confirmed: r.is_confirmed === true,
    is_cancelled: r.is_cancelled === true,
    is_checked_in: r.is_checked_in === true,
    is_ready: r.is_ready === true,
    is_handoff: r.is_handoff === true,
    scheduled_date: text(r.scheduled_date),
    scheduled_time: text(r.scheduled_time),
    visit_date: text(r.visit_date),
    visit_time: text(r.visit_time)
  };
  const when = visitDateTime(visit);
  const patientRaw = Array.isArray(r.patient) ? r.patient[0] : r.patient;
  const patient = patientRaw && typeof patientRaw === 'object' ? (patientRaw as Record<string, unknown>) : {};
  return {
    visitId,
    practiceId,
    patientId: visit.patient_id ?? null,
    practitionerId: text(r.doctor_id),
    date: when?.date ?? null,
    time: when?.time ?? null,
    stage: smsVisitStage(visit),
    isConfirmed: r.is_confirmed === true,
    createdAt: text(r.created_at),
    patientFirstName: text(patient.first_name),
    patientLastName: text(patient.last_name),
    cellNumber: text(patient.cell_number),
    smsOptOut: patient.sms_opt_out === true,
    videoLink: secureLink(r.video_link)
  };
}

/** The slot a reminder is for: '2026-10-08T09:30'. A booking moved to another time gets a new key. */
export function reminderSlotKey(date: string, time: string): string {
  return `${date}T${time.slice(0, 5)}`;
}

export type SentReminderStatus = 'sending' | 'sent' | 'failed';

/** A diary_reminder_log row: this reminder was claimed (and sent or failed). */
export interface SentReminder {
  visitId: string;
  kind: ReminderKind;
  slotKey: string;
  status: SentReminderStatus;
  error?: string | null;
}

export function sentReminderFromRow(row: unknown): SentReminder | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const visitId = text(r.visit_id);
  const slotKey = text(r.slot_key);
  const kind = r.kind === 'day_before' || r.kind === 'same_day' ? r.kind : null;
  if (!visitId || !slotKey || !kind) return null;
  const status: SentReminderStatus = r.status === 'sent' || r.status === 'failed' ? r.status : 'sending';
  return { visitId, kind, slotKey, status, error: text(r.error) };
}

export type ReminderSkipReason =
  | 'already_reminded'
  | 'failed_before'
  | 'not_confirmed'
  | 'not_scheduled'
  | 'no_time'
  | 'past'
  | 'no_cell_number'
  | 'opted_out'
  | 'booked_after_send_time';

/** What reception reads next to a patient who will not get the reminder. */
export const REMINDER_SKIP_TEXT: Readonly<Record<ReminderSkipReason, string>> = {
  already_reminded: 'Already reminded for this time',
  failed_before: 'The reminder could not be sent earlier',
  not_confirmed: 'Booking request not confirmed yet',
  not_scheduled: 'Cancelled, already arrived or already seen',
  no_time: 'The booking has no time',
  past: 'The appointment time has passed',
  no_cell_number: 'No usable cell number on the patient file',
  opted_out: 'The patient replied STOP to SMS',
  booked_after_send_time: 'Booked after the reminders went out'
};

export interface PlannedReminder {
  booking: ReminderBooking;
  kind: ReminderKind;
  slotKey: string;
  /** The patient's number in international format (+264...) */
  phone: string;
  message: string;
}

export interface SkippedReminder {
  booking: ReminderBooking;
  kind: ReminderKind;
  reason: ReminderSkipReason;
  /** The gateway's reason when an earlier attempt failed */
  detail?: string | null;
}

export interface ReminderPlan {
  due: PlannedReminder[];
  skipped: SkippedReminder[];
}

export interface ReminderContext {
  now: Date;
  bookings: ReminderBooking[];
  sent: SentReminder[];
  template: string;
  practiceName: string | null;
  /** The practice's phone as stored (the first number is used) */
  practicePhone: string | null;
  practitionerName: (practitionerId: string | null) => string | null | undefined;
  /** The practice's SMS replies are collected (practice_features 'sms_replies'): only then is a reply invited */
  repliesLive: boolean;
}

const CLINIC_OFFSET_MINUTES = (() => {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(CLINIC_UTC_OFFSET);
  return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
})();

/** Minutes since midnight at the clinic (Windhoek keeps UTC+2 all year; edge functions run in UTC). */
export function clinicMinutes(now: Date): number {
  const local = new Date(now.getTime() + CLINIC_OFFSET_MINUTES * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** The day `days` after a 'yyyy-MM-dd' key. */
export function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The instant a clinic-time day and time happen ('yyyy-MM-dd', minutes). */
const clinicInstant = (dateKey: string, minutes: number): number => Date.parse(`${dateKey}T${toTime(minutes)}:00${CLINIC_UTC_OFFSET}`);

function sentFor(sent: SentReminder[], visitId: string, kind: ReminderKind, slotKey: string): SentReminder | undefined {
  return sent.find((row) => row.visitId === visitId && row.kind === kind && row.slotKey === slotKey);
}

/** The checks every reminder passes, automatic or by hand. Returns the reminder, or why not. */
function decide(
  context: ReminderContext,
  booking: ReminderBooking,
  kind: ReminderKind
): { due: PlannedReminder } | { skipped: SkippedReminder } {
  const skip = (reason: ReminderSkipReason, detail?: string | null) => ({ skipped: { booking, kind, reason, detail } });
  if (booking.stage !== 'scheduled') return skip('not_scheduled');
  if (!booking.isConfirmed) return skip('not_confirmed');
  if (!booking.date || !booking.time) return skip('no_time');
  const start = reminderTimeToMinutes(booking.time);
  if (start === null) return skip('no_time');
  if (clinicInstant(booking.date, start) <= context.now.getTime()) return skip('past');
  const slotKey = reminderSlotKey(booking.date, booking.time);
  const earlier = sentFor(context.sent, booking.visitId, kind, slotKey);
  if (earlier?.status === 'failed') return skip('failed_before', earlier.error ?? null);
  if (earlier) return skip('already_reminded');
  if (booking.smsOptOut) return skip('opted_out');
  const phone = normalizePhoneNumber(booking.cellNumber);
  if (!phone) return skip('no_cell_number');
  const message = renderReminderMessage(withReplyInvite(context.template, REMINDER_REPLY_INVITE, context.repliesLive), {
    patientFirstName: booking.patientFirstName,
    patientName: [booking.patientFirstName, booking.patientLastName].filter(Boolean).join(' '),
    practiceName: context.practiceName,
    practitionerName: context.practitionerName(booking.practitionerId) ?? null,
    appointmentDate: formatReminderDate(booking.date),
    appointmentTime: booking.time.slice(0, 5),
    practicePhone: practicePhoneForSms(context.practicePhone),
    videoLink: booking.videoLink ?? null
  });
  return { due: { booking, kind, slotKey, phone, message } };
}

const byStart = (a: { booking: ReminderBooking }, b: { booking: ReminderBooking }) =>
  `${a.booking.date ?? ''}T${a.booking.time ?? ''}`.localeCompare(`${b.booking.date ?? ''}T${b.booking.time ?? ''}`);

function plan(context: ReminderContext, candidates: Array<{ booking: ReminderBooking; kind: ReminderKind; sendAt: number | null }>): ReminderPlan {
  const due: PlannedReminder[] = [];
  const skipped: SkippedReminder[] = [];
  for (const { booking, kind, sendAt } of candidates) {
    const created = booking.createdAt ? Date.parse(booking.createdAt) : NaN;
    if (sendAt !== null && Number.isFinite(created) && created > sendAt) {
      skipped.push({ booking, kind, reason: 'booked_after_send_time' });
      continue;
    }
    const result = decide(context, booking, kind);
    if ('due' in result) due.push(result.due);
    else skipped.push(result.skipped);
  }
  return { due: due.sort(byStart), skipped: skipped.sort(byStart) };
}

/**
 * What the schedule sends now, for one practice. The day-before reminder goes from its set time to
 * 20:00 the day before; the same-day reminder from N hours before the appointment until it starts.
 * Nothing is sent between 20:00 and 07:00, and nothing when the practice switched reminders off.
 */
export function planDueReminders(context: ReminderContext & { settings: ReminderSettings }): ReminderPlan {
  const { settings, now } = context;
  if (!settings.enabled) return { due: [], skipped: [] };
  const minutes = clinicMinutes(now);
  if (minutes < REMINDER_QUIET_UNTIL || minutes >= REMINDER_QUIET_FROM) return { due: [], skipped: [] };
  const today = clinicDateKey(now);
  const tomorrow = addDaysToDateKey(today, 1);
  const dayBeforeAt = reminderTimeToMinutes(settings.dayBeforeTime);
  const candidates: Array<{ booking: ReminderBooking; kind: ReminderKind; sendAt: number | null }> = [];

  for (const booking of context.bookings) {
    if (settings.dayBefore && dayBeforeAt !== null && booking.date === tomorrow && minutes >= dayBeforeAt) {
      candidates.push({ booking, kind: 'day_before', sendAt: clinicInstant(today, dayBeforeAt) });
    }
    const start = reminderTimeToMinutes(booking.time);
    if (settings.sameDay && booking.date === today && start !== null) {
      const sendAt = start - settings.sameDayHoursBefore * 60;
      if (minutes >= sendAt && minutes < start) {
        candidates.push({ booking, kind: 'same_day', sendAt: clinicInstant(today, Math.max(0, sendAt)) });
      }
    }
  }
  return plan({ ...context, template: settings.template }, candidates);
}

/**
 * "Remind patients" by hand: every booking on the chosen day, whatever the time of day and whether
 * the schedule is switched on. A day after today is the day-before reminder, today the same-day
 * one, so the schedule never sends the same reminder again later.
 */
export function planManualReminders(context: ReminderContext & { date: string }): ReminderPlan {
  const today = clinicDateKey(context.now);
  if (context.date < today) return { due: [], skipped: [] };
  const kind: ReminderKind = context.date === today ? 'same_day' : 'day_before';
  const candidates = context.bookings
    .filter((booking) => booking.date === context.date)
    .map((booking) => ({ booking, kind, sendAt: null }));
  return plan(context, candidates);
}

/** Counts of skipped reminders per reason, most common first, for the summary line. */
export function summarizeSkipped(skipped: SkippedReminder[]): Array<{ reason: ReminderSkipReason; count: number }> {
  const counts = new Map<ReminderSkipReason, number>();
  for (const item of skipped) counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

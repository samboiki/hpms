/**
 * Patient app sign-in codes by SMS (auth-sms-hook): who gets one, how often, and which practice pays.
 *
 * Rules
 * - A code is only sent to a number that is the cell number of at least one patient record. Any other
 *   number gets no SMS and exactly the same answer as a number that got one, so the sign-in screen
 *   cannot be used to find out who is a patient of which practice.
 * - Caps per number count every request, found or not (otherwise hitting the cap would reveal that a
 *   number is a patient's). A cap for the whole platform per hour bounds what an attack can cost.
 *   Supabase Auth's own limits (one code per number per minute, SMS per hour) apply before the hook.
 * - The SMS goes through centralized-sms-gateway (logged, counted) and is charged to the practice of
 *   the matching record visited most recently; with no visits, the newest record.
 * - The code itself is never logged: the gateway stores the text with the code hidden
 *   (smsContentForLog in smsMessagePolicy.ts).
 *
 * Pure TypeScript (no Deno APIs): unit tested with Vitest.
 */
import { normalizePhoneNumber } from './smsPhone.ts';

export interface OtpLimits {
  /** Requests for one number in the last hour (Supabase also allows at most one a minute) */
  perNumberPerHour: number;
  /** Requests for one number in the last 24 hours */
  perNumberPerDay: number;
  /** Codes actually sent, all numbers together, in the last hour */
  sentPerHourAllNumbers: number;
}

export const DEFAULT_OTP_LIMITS: OtpLimits = { perNumberPerHour: 5, perNumberPerDay: 10, sentPerHourAllNumbers: 300 };

/** Supabase Auth sends numbers as digits without the "+" (264811234567). Null when not dialable. */
export function hookPhoneToE164(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  return normalizePhoneNumber(value.startsWith('+') ? value : `+${value}`);
}

/** A patient record found by the database search for the number (a loose LIKE match). */
export interface OtpPatientRecord {
  patientId: string;
  practiceId: string | null;
  cellNumber: string | null;
  /** When the record was created (ISO), to choose between records without visits */
  createdAt: string | null;
  /** Latest visit date (yyyy-mm-dd) of this record that is not in the future, if any */
  lastVisitDate: string | null;
}

/**
 * The latest visit day per patient (yyyy-mm-dd) from visit rows, ignoring days after today: "visited
 * most recently" means a visit that happened, not one booked for later.
 */
export function latestVisitDates(
  rows: Array<{ patient_id: string | null; visit_date: string | null }>,
  todayKey: string
): Map<string, string> {
  const latest = new Map<string, string>();
  for (const row of rows) {
    const day = (row.visit_date ?? '').slice(0, 10);
    if (!row.patient_id || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayKey) continue;
    const current = latest.get(row.patient_id);
    if (!current || day > current) latest.set(row.patient_id, day);
  }
  return latest;
}

/** Caps from the function's environment (OTP_LIMIT_*), each falling back to DEFAULT_OTP_LIMITS. */
export function otpLimitsFromEnv(get: (name: string) => string | undefined): OtpLimits {
  const read = (name: string, fallback: number): number => {
    const value = Number((get(name) ?? '').trim());
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };
  return {
    perNumberPerHour: read('OTP_LIMIT_PER_NUMBER_HOUR', DEFAULT_OTP_LIMITS.perNumberPerHour),
    perNumberPerDay: read('OTP_LIMIT_PER_NUMBER_DAY', DEFAULT_OTP_LIMITS.perNumberPerDay),
    sentPerHourAllNumbers: read('OTP_LIMIT_PER_HOUR', DEFAULT_OTP_LIMITS.sentPerHourAllNumbers),
  };
}

/** Records whose cell number really is this number (the LIKE search also matches longer numbers). */
export function recordsForNumber(records: OtpPatientRecord[], phoneE164: string): OtpPatientRecord[] {
  return records.filter((record) => normalizePhoneNumber(record.cellNumber) === phoneE164);
}

const newestFirst = (a: string | null, b: string | null): number => {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : -1;
};

/** The record whose practice pays for the SMS, or null when no record has a practice. */
export function recordToCharge(records: OtpPatientRecord[]): OtpPatientRecord | null {
  const withPractice = records.filter((record) => !!record.practiceId);
  if (withPractice.length === 0) return null;
  const ordered = [...withPractice].sort(
    (a, b) =>
      newestFirst(a.lastVisitDate, b.lastVisitDate) ||
      newestFirst(a.createdAt, b.createdAt) ||
      (a.patientId < b.patientId ? -1 : a.patientId > b.patientId ? 1 : 0)
  );
  return ordered[0];
}

export interface OtpSendCounts {
  /** Requests for this number (any outcome) in the last hour */
  numberLastHour: number;
  /** Requests for this number (any outcome) in the last 24 hours */
  numberLastDay: number;
  /** Codes sent to any number in the last hour */
  sentAllNumbersLastHour: number;
}

export const OTP_REFUSAL_TEXTS = {
  numberCap: 'Too many sign-in codes were asked for this number. Wait an hour, then try again.',
  platformCap: 'Sign-in codes are paused for a few minutes because of high demand. Please try again later.',
} as const;

export type OtpDecision =
  | { action: 'send'; phoneE164: string; practiceId: string; patientId: string }
  /** No SMS, but the caller is answered exactly as if one was sent */
  | { action: 'skip'; outcome: 'invalid_number' | 'no_patient'; phoneE164: string | null }
  /** No SMS, and Supabase Auth shows the message to the person signing in */
  | { action: 'refuse'; outcome: 'rate_limited'; phoneE164: string; httpStatus: 429; message: string };

/**
 * The refusal when a cap is reached, or null. It does not depend on whether the number is a patient's,
 * so the hook checks it before searching patient records.
 */
export function otpCapRefusal(
  phoneE164: string,
  counts: OtpSendCounts,
  limits: OtpLimits = DEFAULT_OTP_LIMITS
): Extract<OtpDecision, { action: 'refuse' }> | null {
  if (counts.numberLastHour >= limits.perNumberPerHour || counts.numberLastDay >= limits.perNumberPerDay) {
    return { action: 'refuse', outcome: 'rate_limited', phoneE164, httpStatus: 429, message: OTP_REFUSAL_TEXTS.numberCap };
  }
  if (counts.sentAllNumbersLastHour >= limits.sentPerHourAllNumbers) {
    return { action: 'refuse', outcome: 'rate_limited', phoneE164, httpStatus: 429, message: OTP_REFUSAL_TEXTS.platformCap };
  }
  return null;
}

export function decideOtpSend(input: {
  rawPhone: string | null | undefined;
  records: OtpPatientRecord[];
  counts: OtpSendCounts;
  limits?: OtpLimits;
}): OtpDecision {
  const phoneE164 = hookPhoneToE164(input.rawPhone);
  if (!phoneE164) return { action: 'skip', outcome: 'invalid_number', phoneE164: null };

  // Caps come before the patient search: the same answer for patients and everyone else
  const refusal = otpCapRefusal(phoneE164, input.counts, input.limits ?? DEFAULT_OTP_LIMITS);
  if (refusal) return refusal;

  const charged = recordToCharge(recordsForNumber(input.records, phoneE164));
  if (!charged || !charged.practiceId) return { action: 'skip', outcome: 'no_patient', phoneE164 };
  return { action: 'send', phoneE164, practiceId: charged.practiceId, patientId: charged.patientId };
}

/** A sign-in code as Supabase Auth generates it (digits only). */
export function isOtpCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{4,10}$/.test(code);
}

/**
 * The SMS text: one GSM-7 segment (ASCII only, under 160 characters). With a web domain, a last line
 * "@<domain> #<code>" lets Android Chrome offer the code on the sign-in screen (WebOTP); iPhones read
 * the code from the message by themselves.
 */
export function otpSmsText(code: string, options: { expiryMinutes?: number; webOtpDomain?: string | null } = {}): string {
  const expiry = options.expiryMinutes && options.expiryMinutes > 0 ? ` It expires in ${options.expiryMinutes} minutes.` : '';
  const text = `Your OneHealth patient app code is ${code}.${expiry} Never share it, not even with clinic staff.`;
  const domain = (options.webOtpDomain ?? '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return domain ? `${text}\n\n@${domain} #${code}` : text;
}

/** A number as it may appear in function logs: "+264*****4567". */
export function maskPhone(phoneE164: string | null | undefined): string {
  const value = phoneE164 ?? '';
  if (value.length <= 8) return value ? '***' : '';
  return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`;
}

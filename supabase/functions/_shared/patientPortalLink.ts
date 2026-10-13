/**
 * Linking a patient app account to patient records (patient-portal edge function, action "link").
 *
 * An SMS code proves that the person holds the phone, not which patient they are: families share
 * phones and numbers are given to new owners. So a record is only linked after a check of that record:
 * - a record with an ID number: the ID number must match (Namibian ID numbers start with the birth date,
 *   so it is the stronger check and the one asked for whenever the practice captured it);
 * - a record without an ID number: the date of birth must match.
 * Only records whose cell number is the account's own number are considered (the edge function finds
 * them; staff keep that number up to date). A spouse sharing the phone therefore cannot open the other's
 * records without the other's date of birth or ID number.
 * Parents add children under 18 with the child's details. Someone 18 or older is never added as a
 * child: each adult adds themselves. Wrong details lock linking for a while (LINK_LIMITS).
 *
 * Pure TypeScript (no Deno APIs): unit tested with Vitest.
 */
import { clinicDateKey } from './smsReplyPlan.ts';

export type LinkRelationship = 'self' | 'child';
export const LINK_RELATIONSHIPS: readonly LinkRelationship[] = ['self', 'child'];

/** Age from which a person must add themselves */
export const ADULT_AGE = 18;

export const LINK_LIMITS = {
  /** Wrong tries allowed per day; the next one waits until the oldest of them is a day old */
  shortWindowHours: 24,
  shortWindowMaxFailures: 5,
  /** Wrong tries allowed per month; after that the person is asked to see reception */
  longWindowDays: 30,
  longWindowMaxFailures: 10,
} as const;

export interface LinkCandidate {
  patientId: string;
  practiceId: string | null;
  dateOfBirth: string | null;
  idNumber: string | null;
}

export interface LinkRequest {
  relationship: string;
  dateOfBirth: string;
  idNumber?: string | null;
}

export type VerifiedBy = 'date_of_birth' | 'id_number';

export type LinkDecision =
  | { outcome: 'linked'; patientIds: string[]; relationship: LinkRelationship; verifiedBy: Record<string, VerifiedBy> }
  | { outcome: 'already_linked' }
  | { outcome: 'no_records' }
  | { outcome: 'locked'; until: string; askReception: boolean }
  | { outcome: 'id_number_required'; attemptsLeft: number }
  | { outcome: 'mismatch'; attemptsLeft: number }
  | { outcome: 'child_is_adult' }
  | { outcome: 'invalid'; message: string };

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const PLACEHOLDER_IDS = new Set(['NA', 'NONE', 'NIL', 'UNKNOWN', 'NOTAPPLICABLE', 'TBA', 'TBC']);

const isRealDate = (year: number, month: number, day: number): boolean => {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};

/** The yyyy-mm-dd part of a stored date or timestamp, or null. */
export function dateKeyOf(value: string | null | undefined): string | null {
  const head = (value ?? '').trim().slice(0, 10);
  const match = DATE_KEY.exec(head);
  if (!match) return null;
  return isRealDate(Number(match[1]), Number(match[2]), Number(match[3])) ? head : null;
}

/** A date of birth typed by the person (yyyy-mm-dd), when it is a real date between 1900 and today. */
export function normalizeDateOfBirth(raw: string | null | undefined, todayKey: string): string | null {
  const key = dateKeyOf(raw);
  if (!key || (raw ?? '').trim().length !== 10) return null;
  return key >= '1900-01-01' && key <= todayKey ? key : null;
}

/**
 * An ID or passport number reduced to letters and digits ("8501 0100 123" -> "85010100123"), or null
 * when there is no usable number (blank, "N/A", "000000", shorter than 6 characters). Such records are
 * checked by date of birth instead.
 */
export function normalizeIdNumber(raw: string | null | undefined): string | null {
  const value = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (value.length < 6) return null;
  if (PLACEHOLDER_IDS.has(value) || /^(.)\1+$/.test(value)) return null;
  return value;
}

/**
 * The birth date in an 11-digit Namibian ID number (YYMMDD...), or null. The century is the one that
 * puts the date on or before today.
 */
export function birthDateFromNamibianId(raw: string | null | undefined, todayKey: string): string | null {
  const id = (raw ?? '').replace(/\D/g, '');
  if (id.length !== 11) return null;
  const yy = Number(id.slice(0, 2));
  const month = Number(id.slice(2, 4));
  const day = Number(id.slice(4, 6));
  const thisYear = Number(todayKey.slice(0, 4));
  let year = 2000 + yy;
  if (year > thisYear) year -= 100;
  if (!isRealDate(year, month, day)) return null;
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return key <= todayKey ? key : null;
}

/** Whole years between a date of birth and a day (both yyyy-mm-dd). */
export function ageOn(dateOfBirth: string, todayKey: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Under 18 on that day. A record without a usable date of birth counts as an adult. */
export function isMinor(dateOfBirth: string | null | undefined, todayKey: string): boolean {
  const key = dateKeyOf(dateOfBirth);
  return !!key && ageOn(key, todayKey) < ADULT_AGE;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const failuresSince = (failureTimes: string[], sinceMs: number): number[] =>
  failureTimes
    .map((time) => Date.parse(time))
    .filter((ms) => !Number.isNaN(ms) && ms > sinceMs)
    .sort((a, b) => b - a); // newest first

/** When linking is locked because of wrong tries: until when, and whether to send the person to reception. */
export function linkLock(failureTimes: string[], now: Date): { until: string; askReception: boolean } | null {
  const nowMs = now.getTime();
  const shortWindow = LINK_LIMITS.shortWindowHours * HOUR_MS;
  const longWindow = LINK_LIMITS.longWindowDays * DAY_MS;
  const recent = failuresSince(failureTimes, nowMs - shortWindow);
  const month = failuresSince(failureTimes, nowMs - longWindow);

  let untilMs = 0;
  let askReception = false;
  if (recent.length >= LINK_LIMITS.shortWindowMaxFailures) {
    untilMs = recent[LINK_LIMITS.shortWindowMaxFailures - 1] + shortWindow;
  }
  if (month.length >= LINK_LIMITS.longWindowMaxFailures) {
    untilMs = Math.max(untilMs, month[LINK_LIMITS.longWindowMaxFailures - 1] + longWindow);
    askReception = true;
  }
  return untilMs > nowMs ? { until: new Date(untilMs).toISOString(), askReception } : null;
}

/** Wrong tries left after one more wrong try now (0 = the next wrong try locks linking). */
export function attemptsLeftAfterFailure(failureTimes: string[], now: Date): number {
  const nowMs = now.getTime();
  const recent = failuresSince(failureTimes, nowMs - LINK_LIMITS.shortWindowHours * HOUR_MS).length + 1;
  const month = failuresSince(failureTimes, nowMs - LINK_LIMITS.longWindowDays * DAY_MS).length + 1;
  return Math.max(0, Math.min(LINK_LIMITS.shortWindowMaxFailures - recent, LINK_LIMITS.longWindowMaxFailures - month));
}

/** A patient_accounts row as the edge function reads it. */
export interface PatientAccountLink {
  patient_id: string;
  phone_e164: string;
  revoked_at: string | null;
}

const digitsOf = (value: string | null | undefined): string => (value ?? '').replace(/\D/g, '');

/**
 * The records a login may act for: links not revoked and made with the login's current number. The same
 * rule as public.portal_linked_patient_ids() in the database (a login whose phone changed sees nothing).
 */
export function activeLinkedPatientIds(links: PatientAccountLink[], loginPhoneE164: string | null): string[] {
  const loginDigits = digitsOf(loginPhoneE164);
  if (!loginDigits) return [];
  return links.filter((link) => !link.revoked_at && digitsOf(link.phone_e164) === loginDigits).map((link) => link.patient_id);
}

/** Outcomes that count as a wrong try (they can be used to guess a date of birth). */
export function countsAsFailure(decision: LinkDecision): boolean {
  return decision.outcome === 'mismatch' || decision.outcome === 'id_number_required';
}

/** How a record is checked, and whether the details given pass that check. */
export function recordCheck(candidate: LinkCandidate, dateOfBirth: string, idNumber: string | null): { by: VerifiedBy; passes: boolean } {
  const recordId = normalizeIdNumber(candidate.idNumber);
  if (recordId) return { by: 'id_number', passes: idNumber === recordId };
  return { by: 'date_of_birth', passes: dateKeyOf(candidate.dateOfBirth) === dateOfBirth };
}

/**
 * Which records to link for one try. `candidates` are all records on the account's number,
 * `linkedPatientIds` those already linked to this account, `failureTimes` its earlier wrong tries.
 */
export function decideLink(input: {
  candidates: LinkCandidate[];
  request: LinkRequest;
  linkedPatientIds: string[];
  failureTimes: string[];
  now: Date;
}): LinkDecision {
  const today = clinicDateKey(input.now);
  const { request } = input;

  if (!LINK_RELATIONSHIPS.includes(request.relationship as LinkRelationship)) {
    return { outcome: 'invalid', message: 'Choose whether you are adding yourself or your child.' };
  }
  const relationship = request.relationship as LinkRelationship;
  const dateOfBirth = normalizeDateOfBirth(request.dateOfBirth, today);
  if (!dateOfBirth) return { outcome: 'invalid', message: 'Enter a real date of birth.' };
  const typedId = (request.idNumber ?? '').trim();
  const idNumber = typedId ? normalizeIdNumber(typedId) : null;
  if (typedId && !idNumber) return { outcome: 'invalid', message: 'Check the ID number: it looks too short.' };

  const lock = linkLock(input.failureTimes, input.now);
  if (lock) return { outcome: 'locked', ...lock };
  if (input.candidates.length === 0) return { outcome: 'no_records' };

  const linked = new Set(input.linkedPatientIds);
  const passing = input.candidates.filter((candidate) => recordCheck(candidate, dateOfBirth, idNumber).passes);
  const toLink = passing.filter((candidate) => !linked.has(candidate.patientId));

  if (toLink.length === 0) {
    if (passing.length > 0) return { outcome: 'already_linked' };
    const attemptsLeft = attemptsLeftAfterFailure(input.failureTimes, input.now);
    // The date of birth fits a record that is checked by ID number, and no ID number was given
    const needsId =
      !idNumber &&
      input.candidates.some(
        (candidate) =>
          !linked.has(candidate.patientId) &&
          !!normalizeIdNumber(candidate.idNumber) &&
          dateKeyOf(candidate.dateOfBirth) === dateOfBirth
      );
    return needsId ? { outcome: 'id_number_required', attemptsLeft } : { outcome: 'mismatch', attemptsLeft };
  }

  if (relationship === 'child' && toLink.some((candidate) => !isMinor(candidate.dateOfBirth, today))) {
    return { outcome: 'child_is_adult' };
  }

  const verifiedBy: Record<string, VerifiedBy> = {};
  for (const candidate of toLink) verifiedBy[candidate.patientId] = recordCheck(candidate, dateOfBirth, idNumber).by;
  return { outcome: 'linked', patientIds: toLink.map((candidate) => candidate.patientId), relationship, verifiedBy };
}

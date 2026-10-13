/**
 * Smart patient lists: the rules that decide who is on a list, and how a list's members are put
 * together from those rules plus the people staff added or excluded by hand.
 *
 * The database gives one row of facts per patient (public.patient_list_facts: last completed
 * visit, next booking, last no-show, balance owed...). Every decision is made here, in tested
 * code that the browser and the scheduled sender (a Deno edge function) both run, so the list a
 * receptionist sees is exactly the list that gets messaged.
 *
 * No third-party imports and explicit .ts extensions (Deno).
 */
import { addMonthsToKey, daysBetweenKeys, isValidDateKey, toDateKey } from '../billing/dates.ts';
import { hasAtMostDecimals } from '../billing/money.ts';
import { birthdayBetween, monthBounds, weekBounds } from './listDates.ts';

export type ListKind = 'manual' | 'smart';
export type BirthdayWindow = 'today' | 'this_week' | 'this_month';

export type SmartRule =
  /** Birthdays today, this week (Monday to Sunday) or this month */
  | { type: 'birthday'; window: BirthdayWindow }
  /**
   * Seen before, but no completed visit (of these types; empty = any) in `months`, nothing booked. A patient with their
   * own recall date (PatientFacts.recallOn) is due on that date instead.
   */
  | { type: 'recall_due'; months: number; visitTypes: string[] }
  /** Last billed one of these tariff codes `months` or more ago (e.g. 8159 scale and polish, 6 months), nothing booked */
  | { type: 'recall_by_code'; months: number; codes: string[] }
  /** Seen before, no completed visit in `months` or more, nothing booked */
  | { type: 'lapsed'; months: number }
  /** Owes at least `minAmount` on invoices unpaid for `minDays` or more */
  | { type: 'outstanding_balance'; minDays: number; minAmount: number }
  /** Missed an appointment in the last `withinDays`, not seen or booked since */
  | { type: 'missed_appointment'; withinDays: number }
  /** Comes regularly (`minVisitsInYear` completed visits in 12 months), last one `everyDays`+ ago, nothing booked */
  | { type: 'regular_follow_up'; everyDays: number; minVisitsInYear: number }
  /** A repeat of a dispensed script is due within `withinDays` (or overdue), not booked in before then */
  | { type: 'repeat_medicine_due'; withinDays: number }
  /** The patient's contact lenses run out within `withinDays` (or ran out lately), not booked in before then */
  | { type: 'contact_lenses_running_out'; withinDays: number };

export type SmartRuleType = SmartRule['type'];

/** One patient's facts as the lists need them (see toPatientFacts for the database row). */
export interface PatientFacts {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  cellNumber: string | null;
  /** The patient asked not to get non-essential SMS (false while the column does not exist yet) */
  smsOptOut: boolean;
  /** Visits marked completed only: a booked, cancelled or missed visit is not a visit that happened */
  lastCompletedVisitOn: string | null;
  /** Last completed visit per visit type, lower case, e.g. { consultation: '2026-03-02' } */
  lastCompletedByType: Readonly<Record<string, string>>;
  /** Last date each tariff code was billed (not on cancelled invoices), e.g. { '8159': '2026-03-02' }; empty until the database returns it */
  lastBilledByCode?: Readonly<Record<string, string>>;
  completedVisitsLastYear: number;
  /** Earliest appointment from today on that is still booked (not cancelled, missed or done) */
  nextBookingOn: string | null;
  nextBookingTime: string | null;
  lastNoShowOn: string | null;
  /** What the patient owes (their share; medical aid portions are claimed from the fund) */
  balanceDue: number;
  /** Date of the oldest invoice the patient still owes on */
  oldestUnpaidOn: string | null;
  /**
   * The earliest day a repeat of the patient's scripts falls due (scripts with repeats left that have not run out);
   * null without one, and until the database returns it (proposals/2026-10-07-dispensing-and-stock.sql)
   */
  nextRepeatDueOn?: string | null;
  /**
   * The day the contact lenses the patient collected run out (the latest of their supplies); null without one, and
   * until the database returns it (proposals/2026-10-08-optometry.sql)
   */
  contactLensesRunOutOn?: string | null;
  /**
   * The patient's own recall date: the earliest recall set on the file or at a visit that no booking has completed yet
   * (the database's patient_recall_status decides when a booking does); null without one, and until the database
   * returns it (proposals/2026-10-12-patient-recalls.sql)
   */
  recallOn?: string | null;
  /** What that recall is for, e.g. "6-monthly check-up" */
  recallReason?: string | null;
}

/** A row of public.patient_list_facts as PostgREST returns it. */
export interface PatientFactsRow {
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  cell_number: string | null;
  sms_opt_out: boolean | null;
  last_completed_visit_on: string | null;
  last_completed_by_type: Record<string, unknown> | null;
  /** Returned once proposals/2026-10-07-patient-lists.sql includes it */
  last_billed_by_code?: Record<string, unknown> | null;
  completed_visits_12m: number | string | null;
  next_booking_on: string | null;
  next_booking_time: string | null;
  last_no_show_on: string | null;
  balance_due: number | string | null;
  oldest_unpaid_on: string | null;
  /** Returned once proposals/2026-10-07-dispensing-and-stock.sql is applied */
  next_repeat_due_on?: string | null;
  /** Returned once proposals/2026-10-08-optometry.sql is applied */
  contact_lenses_run_out_on?: string | null;
  /** Returned once proposals/2026-10-12-patient-recalls.sql is applied */
  recall_on?: string | null;
  recall_reason?: string | null;
}

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

export function toPatientFacts(row: PatientFactsRow): PatientFacts {
  const byType: Record<string, string> = {};
  for (const [type, date] of Object.entries(row.last_completed_by_type ?? {})) {
    const key = typeof date === 'string' ? toDateKey(date) : null;
    if (key) byType[type.trim().toLowerCase()] = key;
  }
  const byCode: Record<string, string> = {};
  for (const [code, date] of Object.entries(row.last_billed_by_code ?? {})) {
    const key = typeof date === 'string' ? toDateKey(date) : null;
    if (key && code.trim()) byCode[code.trim()] = key;
  }
  return {
    patientId: row.patient_id,
    firstName: row.first_name?.trim() ?? '',
    lastName: row.last_name?.trim() ?? '',
    dateOfBirth: toDateKey(row.date_of_birth),
    cellNumber: row.cell_number?.trim() || null,
    smsOptOut: row.sms_opt_out === true,
    lastCompletedVisitOn: toDateKey(row.last_completed_visit_on),
    lastCompletedByType: byType,
    lastBilledByCode: byCode,
    completedVisitsLastYear: Math.max(0, Math.trunc(toNumber(row.completed_visits_12m))),
    nextBookingOn: toDateKey(row.next_booking_on),
    nextBookingTime: row.next_booking_time?.slice(0, 5) || null,
    lastNoShowOn: toDateKey(row.last_no_show_on),
    balanceDue: Math.round(toNumber(row.balance_due) * 100) / 100,
    oldestUnpaidOn: toDateKey(row.oldest_unpaid_on),
    nextRepeatDueOn: toDateKey(row.next_repeat_due_on ?? null),
    contactLensesRunOutOn: toDateKey(row.contact_lenses_run_out_on ?? null),
    recallOn: toDateKey(row.recall_on ?? null),
    recallReason: row.recall_reason?.trim() || null
  };
}

// ---------------------------------------------------------------------------------------------
// Rule validation: rules are stored as jsonb, so anything read back is checked before use.
// ---------------------------------------------------------------------------------------------

export const RULE_LIMITS = {
  months: { min: 1, max: 60 },
  minDays: { min: 0, max: 3650 },
  minAmount: { min: 0, max: 1_000_000 },
  withinDays: { min: 1, max: 365 },
  everyDays: { min: 7, max: 365 },
  minVisitsInYear: { min: 1, max: 52 },
  /** Repeat medicine: due within this many days (0 = due today or overdue) */
  dueWithinDays: { min: 0, max: 60 },
  visitTypes: { maxCount: 10, maxLength: 40 },
  codes: { maxCount: 10 }
} as const;

/**
 * Contact lenses that ran out longer ago than this are not "running out" any more: after three months without lenses
 * from the practice the patient most likely buys them elsewhere, and the lapsed-patients list is the one for them.
 */
export const CONTACT_LENS_OVERDUE_DAYS = 90;

export type RuleValidation = { ok: true; rule: SmartRule } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const wholeNumberIn = (value: unknown, limits: { min: number; max: number }): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= limits.min && value <= limits.max;

const range = (limits: { min: number; max: number }): string => `${limits.min} to ${limits.max}`;

export function validateRule(input: unknown): RuleValidation {
  if (!isRecord(input)) return { ok: false, error: 'The list has no rule.' };
  switch (input.type) {
    case 'birthday': {
      const window = input.window;
      if (window !== 'today' && window !== 'this_week' && window !== 'this_month') {
        return { ok: false, error: 'Choose birthdays today, this week or this month.' };
      }
      return { ok: true, rule: { type: 'birthday', window } };
    }
    case 'recall_due': {
      if (!wholeNumberIn(input.months, RULE_LIMITS.months)) {
        return { ok: false, error: `Months must be a whole number from ${range(RULE_LIMITS.months)}.` };
      }
      const rawTypes = input.visitTypes ?? [];
      if (!Array.isArray(rawTypes) || rawTypes.length > RULE_LIMITS.visitTypes.maxCount) {
        return { ok: false, error: `Choose at most ${RULE_LIMITS.visitTypes.maxCount} visit types.` };
      }
      const visitTypes: string[] = [];
      for (const raw of rawTypes) {
        const type = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (!type || type.length > RULE_LIMITS.visitTypes.maxLength) {
          return { ok: false, error: 'A visit type is empty or too long.' };
        }
        if (!visitTypes.includes(type)) visitTypes.push(type);
      }
      return { ok: true, rule: { type: 'recall_due', months: input.months, visitTypes } };
    }
    case 'recall_by_code': {
      if (!wholeNumberIn(input.months, RULE_LIMITS.months)) {
        return { ok: false, error: `Months must be a whole number from ${range(RULE_LIMITS.months)}.` };
      }
      const rawCodes = input.codes;
      if (!Array.isArray(rawCodes) || rawCodes.length === 0 || rawCodes.length > RULE_LIMITS.codes.maxCount) {
        return { ok: false, error: `Choose 1 to ${RULE_LIMITS.codes.maxCount} tariff codes.` };
      }
      const codes: string[] = [];
      for (const raw of rawCodes) {
        const code = typeof raw === 'string' ? raw.trim() : '';
        if (!/^\d{4}$/.test(code)) return { ok: false, error: `"${String(raw)}" is not a 4-digit tariff code.` };
        if (!codes.includes(code)) codes.push(code);
      }
      return { ok: true, rule: { type: 'recall_by_code', months: input.months, codes } };
    }
    case 'lapsed':
      if (!wholeNumberIn(input.months, RULE_LIMITS.months)) {
        return { ok: false, error: `Months must be a whole number from ${range(RULE_LIMITS.months)}.` };
      }
      return { ok: true, rule: { type: 'lapsed', months: input.months } };
    case 'outstanding_balance': {
      if (!wholeNumberIn(input.minDays, RULE_LIMITS.minDays)) {
        return { ok: false, error: `Days must be a whole number from ${range(RULE_LIMITS.minDays)}.` };
      }
      const amount = input.minAmount;
      if (
        typeof amount !== 'number' ||
        !hasAtMostDecimals(amount, 2) ||
        amount < RULE_LIMITS.minAmount.min ||
        amount > RULE_LIMITS.minAmount.max
      ) {
        return { ok: false, error: 'The amount must be from N$ 0 to N$ 1,000,000, with at most 2 decimals.' };
      }
      return { ok: true, rule: { type: 'outstanding_balance', minDays: input.minDays, minAmount: amount } };
    }
    case 'missed_appointment':
      if (!wholeNumberIn(input.withinDays, RULE_LIMITS.withinDays)) {
        return { ok: false, error: `Days must be a whole number from ${range(RULE_LIMITS.withinDays)}.` };
      }
      return { ok: true, rule: { type: 'missed_appointment', withinDays: input.withinDays } };
    case 'regular_follow_up':
      if (!wholeNumberIn(input.everyDays, RULE_LIMITS.everyDays)) {
        return { ok: false, error: `Days must be a whole number from ${range(RULE_LIMITS.everyDays)}.` };
      }
      if (!wholeNumberIn(input.minVisitsInYear, RULE_LIMITS.minVisitsInYear)) {
        return {
          ok: false,
          error: `Visits per year must be a whole number from ${range(RULE_LIMITS.minVisitsInYear)}.`
        };
      }
      return {
        ok: true,
        rule: { type: 'regular_follow_up', everyDays: input.everyDays, minVisitsInYear: input.minVisitsInYear }
      };
    case 'repeat_medicine_due':
      if (!wholeNumberIn(input.withinDays, RULE_LIMITS.dueWithinDays)) {
        return { ok: false, error: `Days must be a whole number from ${range(RULE_LIMITS.dueWithinDays)}.` };
      }
      return { ok: true, rule: { type: 'repeat_medicine_due', withinDays: input.withinDays } };
    case 'contact_lenses_running_out':
      if (!wholeNumberIn(input.withinDays, RULE_LIMITS.dueWithinDays)) {
        return { ok: false, error: `Days must be a whole number from ${range(RULE_LIMITS.dueWithinDays)}.` };
      }
      return { ok: true, rule: { type: 'contact_lenses_running_out', withinDays: input.withinDays } };
    default:
      return { ok: false, error: 'This kind of smart list is not known.' };
  }
}

// ---------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------

const hasUpcomingBooking = (facts: PatientFacts, todayKey: string): boolean =>
  facts.nextBookingOn !== null && facts.nextBookingOn >= todayKey;

/** The date range a birthday list covers on `todayKey`. */
export function birthdayWindowBounds(window: BirthdayWindow, todayKey: string): { from: string; to: string } {
  if (window === 'today') return { from: todayKey, to: todayKey };
  return window === 'this_week' ? weekBounds(todayKey) : monthBounds(todayKey);
}

/** The last completed visit that counts for a recall: of the chosen types, or of any type. */
export function lastRecallVisit(facts: PatientFacts, visitTypes: readonly string[]): string | null {
  if (visitTypes.length === 0) return facts.lastCompletedVisitOn;
  let latest: string | null = null;
  for (const type of visitTypes) {
    const date = facts.lastCompletedByType[type.trim().toLowerCase()];
    if (date && (latest === null || date > latest)) latest = date;
  }
  return latest;
}

/** The most recent of these tariff codes the patient was billed, and when. */
export function lastBilledCode(facts: PatientFacts, codes: readonly string[]): { code: string; on: string } | null {
  let latest: { code: string; on: string } | null = null;
  for (const code of codes) {
    const on = facts.lastBilledByCode?.[code.trim()];
    if (on && (latest === null || on > latest.on)) latest = { code: code.trim(), on };
  }
  return latest;
}

/** Whether a patient belongs on a smart list today (Windhoek date). */
export function matchesRule(rule: SmartRule, facts: PatientFacts, todayKey: string): boolean {
  if (!isValidDateKey(todayKey)) return false;
  switch (rule.type) {
    case 'birthday': {
      const { from, to } = birthdayWindowBounds(rule.window, todayKey);
      return birthdayBetween(facts.dateOfBirth, from, to) !== null;
    }
    case 'recall_due': {
      // A recall date set for this patient (on the file or at a visit) wins over the months rule: the practitioner chose
      // the day, so they are due on it, not months earlier or later
      const ownRecall = facts.recallOn ?? null;
      if (ownRecall) return ownRecall <= todayKey && !hasUpcomingBooking(facts, todayKey);
      // Only patients the practice has seen: someone who registered but never came is not "due back"
      if (!facts.lastCompletedVisitOn || hasUpcomingBooking(facts, todayKey)) return false;
      const last = lastRecallVisit(facts, rule.visitTypes);
      return last === null || last <= addMonthsToKey(todayKey, -rule.months);
    }
    case 'recall_by_code': {
      // Only patients who had the treatment: the recall follows what was done, not just any visit
      if (hasUpcomingBooking(facts, todayKey)) return false;
      const last = lastBilledCode(facts, rule.codes);
      return last !== null && last.on <= addMonthsToKey(todayKey, -rule.months);
    }
    case 'lapsed':
      return (
        facts.lastCompletedVisitOn !== null &&
        facts.lastCompletedVisitOn <= addMonthsToKey(todayKey, -rule.months) &&
        !hasUpcomingBooking(facts, todayKey)
      );
    case 'outstanding_balance':
      return (
        facts.balanceDue > 0 &&
        facts.balanceDue >= rule.minAmount &&
        facts.oldestUnpaidOn !== null &&
        daysBetweenKeys(facts.oldestUnpaidOn, todayKey) >= rule.minDays
      );
    case 'missed_appointment': {
      const missed = facts.lastNoShowOn;
      if (!missed) return false;
      const daysAgo = daysBetweenKeys(missed, todayKey);
      if (daysAgo < 0 || daysAgo > rule.withinDays) return false;
      // Seen since (even later the same day) or booked again: nothing to follow up
      const seenSince = facts.lastCompletedVisitOn !== null && facts.lastCompletedVisitOn >= missed;
      return !seenSince && !hasUpcomingBooking(facts, todayKey);
    }
    case 'regular_follow_up':
      return (
        facts.completedVisitsLastYear >= rule.minVisitsInYear &&
        facts.lastCompletedVisitOn !== null &&
        daysBetweenKeys(facts.lastCompletedVisitOn, todayKey) >= rule.everyDays &&
        !hasUpcomingBooking(facts, todayKey)
      );
    case 'repeat_medicine_due': {
      const due = facts.nextRepeatDueOn ?? null;
      if (!due || daysBetweenKeys(todayKey, due) > rule.withinDays) return false;
      // Booked to come in by the day it is due (or today, when overdue): the repeat is dispensed then
      const bookedBy = due > todayKey ? due : todayKey;
      return !(hasUpcomingBooking(facts, todayKey) && facts.nextBookingOn !== null && facts.nextBookingOn <= bookedBy);
    }
    case 'contact_lenses_running_out': {
      const runsOut = facts.contactLensesRunOutOn ?? null;
      if (!runsOut) return false;
      const daysLeft = daysBetweenKeys(todayKey, runsOut);
      if (daysLeft > rule.withinDays || daysLeft < -CONTACT_LENS_OVERDUE_DAYS) return false;
      // Booked to come in by the day they run out (or today, once out): the next lenses are ordered then
      const bookedBy = runsOut > todayKey ? runsOut : todayKey;
      return !(hasUpcomingBooking(facts, todayKey) && facts.nextBookingOn !== null && facts.nextBookingOn <= bookedBy);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Members: rule matches plus people added by hand, minus people excluded
// ---------------------------------------------------------------------------------------------

/** A row of public.patient_list_members. Rows exist for people added by hand, exclusions and sends. */
export interface ListMemberRow {
  list_id: string;
  patient_id: string;
  source: 'manual' | 'rule';
  excluded: boolean;
  added_at: string | null;
  last_sent_at: string | null;
  last_sent_period: string | null;
}

export interface ListMember {
  patientId: string;
  facts: PatientFacts;
  /** On the list because the rule matches today */
  automatic: boolean;
  /** Added by hand */
  manual: boolean;
  addedAt: string | null;
  lastSentAt: string | null;
  lastSentPeriod: string | null;
}

export interface ResolvedList {
  members: ListMember[];
  /** Taken off the list by staff; the rule may still match them */
  excluded: ListMember[];
}

const byName = (a: ListMember, b: ListMember): number =>
  a.facts.lastName.localeCompare(b.facts.lastName, 'en', { sensitivity: 'base' }) ||
  a.facts.firstName.localeCompare(b.facts.firstName, 'en', { sensitivity: 'base' }) ||
  a.patientId.localeCompare(b.patientId);

export function resolveListMembers(input: {
  kind: ListKind;
  rule: SmartRule | null;
  facts: readonly PatientFacts[];
  /** This list's rows (rows of other lists are ignored) */
  rows: readonly ListMemberRow[];
  listId: string;
  todayKey: string;
}): ResolvedList {
  const rowsByPatient = new Map<string, ListMemberRow>();
  for (const row of input.rows) {
    if (row.list_id === input.listId) rowsByPatient.set(row.patient_id, row);
  }

  const members: ListMember[] = [];
  const excluded: ListMember[] = [];
  for (const facts of input.facts) {
    const row = rowsByPatient.get(facts.patientId);
    const automatic = input.kind === 'smart' && input.rule !== null && matchesRule(input.rule, facts, input.todayKey);
    const manual = row?.source === 'manual';
    if (!automatic && !manual && !row?.excluded) continue;
    const member: ListMember = {
      patientId: facts.patientId,
      facts,
      automatic,
      manual,
      addedAt: row?.added_at ?? null,
      lastSentAt: row?.last_sent_at ?? null,
      lastSentPeriod: row?.last_sent_period ?? null
    };
    if (row?.excluded) {
      // Only worth showing while they would otherwise be on the list
      if (automatic || manual) excluded.push(member);
    } else {
      members.push(member);
    }
  }
  return { members: members.sort(byName), excluded: excluded.sort(byName) };
}

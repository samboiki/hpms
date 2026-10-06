/**
 * Medical aid fund claim deadlines.
 *
 * Funds refuse claims received after their deadline, counted from the date of service:
 * NHP 4 months, NMC 120 days, PSEMAS 180 days (team research, October 2026; to be confirmed
 * with each fund). A claim is treated as on time up to and including the last day.
 * Funds that are not configured get the shortest known deadline (120 days) so the practice is
 * warned too early rather than too late. proposals/2026-10-claims.sql moves these into a
 * table the practice can maintain.
 */
import { addDaysToKey, addMonthsToKey, daysBetweenKeys, isValidDateKey } from './dates.ts';

export interface FundDeadline {
  days?: number;
  months?: number;
}

export interface FundRule {
  key: string;
  label: string;
  deadline: FundDeadline;
  /** medical_aid_reference values this rule applies to. */
  references: readonly string[];
  /** Matches the provider name when the reference is not listed. */
  namePattern?: RegExp;
  /** False for the fallback rule: the real deadline has not been configured. */
  configured: boolean;
}

export const FUND_RULES: readonly FundRule[] = [
  {
    key: 'NHP',
    label: 'Namibia Health Plan (NHP)',
    deadline: { months: 4 },
    references: ['NHPM', 'NHP'],
    namePattern: /namibia health plan|\bnhp\b/i,
    configured: true
  },
  {
    key: 'NMC',
    label: 'Namibia Medical Care (NMC)',
    deadline: { days: 120 },
    references: ['NMC1', 'NMC'],
    namePattern: /namibia medical care|\bnmc\b/i,
    configured: true
  },
  {
    key: 'PSEMAS',
    label: 'PSEMAS',
    deadline: { days: 180 },
    references: ['PSEMAS'],
    namePattern: /psemas|public service employees?'? medical/i,
    configured: true
  }
];

export const DEFAULT_FUND_RULE: FundRule = {
  key: 'DEFAULT',
  label: 'Deadline not configured for this fund (120 days assumed)',
  deadline: { days: 120 },
  references: [],
  configured: false
};

/** Days before the deadline at which a line is flagged as "expiring soon". */
export const DEADLINE_WARNING_DAYS = 14;

/** Finds the rule for a fund by its medical_aid_reference, then by its name; otherwise the default. */
export function getFundRule(reference: string | null | undefined, providerName?: string | null): FundRule {
  const ref = (reference ?? '').trim().toUpperCase();
  const byReference = FUND_RULES.find(rule => rule.references.includes(ref));
  if (byReference) return byReference;
  const name = providerName ?? '';
  const byName = FUND_RULES.find(rule => rule.namePattern?.test(name));
  return byName ?? DEFAULT_FUND_RULE;
}

/** The last day (yyyy-MM-dd) on which a claim for this service date can still be submitted. */
export function lastSubmissionDay(serviceDate: string, rule: FundRule): string {
  if (rule.deadline.months !== undefined) return addMonthsToKey(serviceDate, rule.deadline.months);
  return addDaysToKey(serviceDate, rule.deadline.days ?? DEFAULT_FUND_RULE.deadline.days ?? 120);
}

export type DeadlineStatus = 'ok' | 'expiring' | 'expired' | 'future' | 'invalid';

export interface DeadlineCheck {
  status: DeadlineStatus;
  lastDay: string | null;
  daysLeft: number | null;
}

/** Checks a service date against the fund deadline as of `today` (both yyyy-MM-dd). */
export function checkClaimDeadline(
  serviceDate: string | null | undefined,
  today: string,
  rule: FundRule,
  warningDays: number = DEADLINE_WARNING_DAYS
): DeadlineCheck {
  if (!isValidDateKey(serviceDate) || !isValidDateKey(today)) {
    return { status: 'invalid', lastDay: null, daysLeft: null };
  }
  if (serviceDate > today) {
    return { status: 'future', lastDay: lastSubmissionDay(serviceDate, rule), daysLeft: null };
  }
  const lastDay = lastSubmissionDay(serviceDate, rule);
  const daysLeft = daysBetweenKeys(today, lastDay);
  if (daysLeft < 0) return { status: 'expired', lastDay, daysLeft };
  if (daysLeft <= warningDays) return { status: 'expiring', lastDay, daysLeft };
  return { status: 'ok', lastDay, daysLeft };
}

/** Describes a fund deadline in words, e.g. "4 months" or "120 days". */
export function describeDeadline(rule: FundRule): string {
  if (rule.deadline.months !== undefined) return `${rule.deadline.months} months`;
  return `${rule.deadline.days ?? 120} days`;
}

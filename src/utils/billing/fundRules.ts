/**
 * Medical aid fund rules: each fund's claim deadline and what the claim checks need to know about the fund.
 *
 * Funds refuse claims received after their deadline, counted from the date of service; a claim is on time up to and
 * including the last day. The rules live in medical_aid_fund_rules (proposals/2026-10-12-fund-master.sql), kept by
 * OneHealth support on Administration > Medical aid funds; src/hooks/useFundRules.ts reads them once per session and
 * puts them in force here (setFundRulesInForce). Until then, and whenever the table cannot be read, FUND_RULES below
 * (the values the app always used) apply, so claims keep working without the table.
 *   deadline        NHP 4 months, NMC 120 days, PSEMAS 180 days (team research, October 2026): confirmed, so a line
 *                   past it is not sent. NAMMED and Prosperity 120 days: NOT confirmed with the fund, so a late line
 *                   is flagged, never blocked. A fund without a rule gets the shortest known deadline (120 days),
 *                   also only flagged: a guess never stops a claim the fund might still pay.
 *   membership      digits only, one of these lengths (NMC 9, NHP and NAMMED 11, learned from accepted claims); a
 *                   number that does not fit is only a warning: reception checks it against the card.
 *   dependant code  a spouse or child is claimed with the code from the card ("01 JOHN"), unless the fund says not.
 *   payment terms   days a fund usually takes to answer (PSEMAS 60, the others 30): how long "Funds that have not
 *                   answered" waits, unless the practice set its own wait (silent_fund_days wins).
 * A fund is found by its claim code (MAG1 is PSEMAS) or its name through src/utils/remittance/funds.ts.
 * Imports end in .ts: supabase/functions-proposals/auto-submit-claims (Deno) reads this file too.
 */
import { addDaysToKey, addMonthsToKey, daysBetweenKeys, isValidDateKey } from './dates.ts';
import { identifyFund } from '../remittance/funds.ts';

export interface FundDeadline {
  days?: number;
  months?: number;
}

export interface FundRule {
  /** The fund's claim code (MAG1, NMC1, NHPM, NAMM, PROS); 'DEFAULT' for a fund without a rule */
  key: string;
  label: string;
  deadline: FundDeadline;
  /** Codes and short names that mean this fund on records and documents, the claim code first */
  references: readonly string[];
  /** False for the fallback rule: no deadline is known for this fund */
  configured: boolean;
  /** The deadline is confirmed with the fund: a line past it is not sent. Not confirmed: the line is only flagged */
  confirmed: boolean;
  /** Lengths of the fund's membership numbers (digits only); empty when not known */
  membershipDigits: readonly number[];
  /** What reception should check when a number does not fit (OneHealth support writes it) */
  membershipHint: string | null;
  /** A dependant is claimed with the dependant code from the card */
  dependantCodeRequired: boolean;
  /** Days the fund usually takes to answer a sent claim; null: the general wait */
  paymentTermsDays: number | null;
  /** Where the fund takes claims online, if it does (the claims email is medical_aid_providers.email) */
  claimsPortalUrl: string | null;
}

/** Days before the deadline at which a line is flagged as "expiring soon". */
export const DEADLINE_WARNING_DAYS = 14;

/** The limits the table and save_fund_rule enforce (proposals/2026-10-12-fund-master.sql) */
export const FUND_RULE_LIMITS = {
  deadlineDays: { min: 1, max: 730 },
  deadlineMonths: { min: 1, max: 24 },
  membershipDigits: { min: 1, max: 20, count: 4 },
  paymentTermsDays: { min: 7, max: 365 },
  hintLength: 200
} as const;

const FUND_CODE = /^[A-Z0-9]{2,10}$/;

interface RuleValues {
  deadline: FundDeadline;
  confirmed: boolean;
  membershipDigits?: readonly number[];
  membershipHint?: string | null;
  dependantCodeRequired?: boolean;
  paymentTermsDays?: number | null;
  claimsPortalUrl?: string | null;
}

/** A configured rule for a claim code: its name and other codes come from the fund's identity (funds.ts) */
function ruleFor(code: string, values: RuleValues, fundName?: string | null): FundRule {
  const identity = identifyFund(code);
  const sameFund = identity?.code === code;
  return {
    key: code,
    label: (sameFund ? identity.label : null) ?? (fundName?.trim() || code),
    deadline: values.deadline,
    references: sameFund ? [code, ...identity.aliases.filter(alias => alias !== code)] : [code],
    configured: true,
    confirmed: values.confirmed,
    membershipDigits: values.membershipDigits ?? [],
    membershipHint: values.membershipHint ?? null,
    dependantCodeRequired: values.dependantCodeRequired ?? true,
    paymentTermsDays: values.paymentTermsDays ?? null,
    claimsPortalUrl: values.claimsPortalUrl ?? null
  };
}

/**
 * The built-in rules: the values the app used before the fund master (and the table's seed). They apply until the
 * table is read, and for any fund it has no usable row for.
 */
export const FUND_RULES: readonly FundRule[] = [
  ruleFor('NHPM', { deadline: { months: 4 }, confirmed: true, membershipDigits: [11], paymentTermsDays: 30 }),
  ruleFor('NMC1', { deadline: { days: 120 }, confirmed: true, membershipDigits: [9], paymentTermsDays: 30 }),
  // PSEMAS pays a median 31 days after the service: at 30 days half its batches would show as not answered
  ruleFor('MAG1', { deadline: { days: 180 }, confirmed: true, paymentTermsDays: 60 }),
  ruleFor('NAMM', { deadline: { days: 120 }, confirmed: false, membershipDigits: [11], paymentTermsDays: 30 }),
  ruleFor('PROS', { deadline: { days: 120 }, confirmed: false, paymentTermsDays: 30 })
];

export const DEFAULT_FUND_RULE: FundRule = {
  key: 'DEFAULT',
  label: 'Deadline not configured for this fund (120 days assumed)',
  deadline: { days: 120 },
  references: [],
  configured: false,
  confirmed: false,
  membershipDigits: [],
  membershipHint: null,
  dependantCodeRequired: true,
  paymentTermsDays: null,
  claimsPortalUrl: null
};

let rulesInForce: readonly FundRule[] = FUND_RULES;

/** The rules the claim checks use now: the fund master's once read (useFundRules), else FUND_RULES */
export const fundRulesInForce = (): readonly FundRule[] => rulesInForce;

/** Puts the fund master's rules in force for this session; null goes back to the built-in FUND_RULES. */
export function setFundRulesInForce(rules: readonly FundRule[] | null): void {
  rulesInForce = rules ?? FUND_RULES;
}

/**
 * Finds the rule for a fund by its medical_aid_reference (its claim code, or another code meaning the same fund:
 * "PSEMAS" is MAG1), then by its name; otherwise the default.
 */
export function getFundRule(reference: string | null | undefined, providerName?: string | null): FundRule {
  const ref = (reference ?? '').trim().toUpperCase();
  const own = ref ? rulesInForce.find(rule => rule.key === ref) : undefined;
  if (own) return own;
  const code = identifyFund(reference, providerName)?.code;
  return (code ? rulesInForce.find(rule => rule.key === code) : undefined) ?? DEFAULT_FUND_RULE;
}

/** A medical_aid_fund_rules row as read (proposals/2026-10-12-fund-master.sql) */
export interface FundRuleRow {
  medical_aid_reference: string | null;
  claim_deadline_days: number | null;
  claim_deadline_months: number | null;
  deadline_confirmed: boolean | null;
  claims_portal_url: string | null;
  membership_digits: readonly number[] | null;
  membership_hint: string | null;
  dependant_code_required: boolean | null;
  payment_terms_days: number | null;
}

const wholeIn = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;

const cleanText = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * One rule from a table row, or null for a row the claim checks cannot trust (no valid code or deadline). The table's
 * own checks make such a row unlikely; the claim checks then keep the built-in rule rather than guess.
 */
export function fundRuleFromRow(row: FundRuleRow, fundName?: string | null): FundRule | null {
  const code = (row.medical_aid_reference ?? '').trim().toUpperCase();
  if (!FUND_CODE.test(code)) return null;
  const { deadlineDays, deadlineMonths, membershipDigits: digitLimits, paymentTermsDays, hintLength } = FUND_RULE_LIMITS;
  const days = wholeIn(row.claim_deadline_days, deadlineDays.min, deadlineDays.max);
  const months = wholeIn(row.claim_deadline_months, deadlineMonths.min, deadlineMonths.max);
  if ((days === null) === (months === null)) return null;
  const lengths = [...new Set((row.membership_digits ?? []).map(length => wholeIn(length, digitLimits.min, digitLimits.max)))];
  const portal = cleanText(row.claims_portal_url);
  const hint = cleanText(row.membership_hint);
  return ruleFor(
    code,
    {
      deadline: days !== null ? { days } : { months: months as number },
      confirmed: row.deadline_confirmed === true,
      membershipDigits: lengths.includes(null) ? [] : (lengths as number[]).sort((a, b) => a - b),
      membershipHint: hint && hint.length <= hintLength ? hint : null,
      dependantCodeRequired: row.dependant_code_required !== false,
      paymentTermsDays: wholeIn(row.payment_terms_days, paymentTermsDays.min, paymentTermsDays.max),
      claimsPortalUrl: portal && /^https:\/\/\S+$/.test(portal) ? portal : null
    },
    fundName
  );
}

/**
 * The rules in force from the table's rows: each usable row replaces the built-in rule of its fund (or adds a fund
 * the app did not know); a fund without a usable row keeps its built-in rule. `fundNames` names a fund the app does
 * not know by its claim code (medical_aid_providers.name).
 */
export function fundRulesFromRows(rows: readonly FundRuleRow[], fundNames?: ReadonlyMap<string, string>): FundRule[] {
  const byCode = new Map(FUND_RULES.map(rule => [rule.key, rule] as const));
  for (const row of rows) {
    const code = (row.medical_aid_reference ?? '').trim().toUpperCase();
    const rule = fundRuleFromRow(row, fundNames?.get(code));
    if (rule) byCode.set(rule.key, rule);
  }
  return [...byCode.values()];
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

/** Why a deadline only warns, in words: null for a confirmed one */
export function deadlineCaveat(rule: FundRule): string | null {
  if (!rule.configured) return 'assumed: no deadline is known for this fund';
  return rule.confirmed ? null : 'not confirmed with the fund';
}

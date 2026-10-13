/**
 * Medical aid fund rules: each fund's claim deadline and what the claim checks need to know about the fund.
 *
 * Funds refuse claims received after their deadline, counted from the date of service; a claim is on time up to and
 * including the last day. The rules live in medical_aid_fund_rules (proposals/2026-10-12-fund-master.sql), kept by
 * OneHealth support on Administration > Medical aid funds; src/hooks/useFundRules.ts reads them once per session and
 * puts them in force here (setFundRulesInForce). Until then, and whenever the table cannot be read, FUND_RULES below
 * (the values the app always used) apply, so claims keep working without the table.
 *   deadline        The standard (researched 13 Oct 2026; sources at FUND_RULES, owner summary in the wave-11 note
 *                   claims-standards.md): NHP and NAMMED to the last day of the 4th month after the month of service
 *                   (their published rules), NMC 120 and PSEMAS 180 calendar days (Methealth): confirmed, so a line
 *                   past it is not sent. Prosperity 4 months: NOT confirmed with the fund, so a late line is flagged,
 *                   never blocked. A fund without a rule gets the shortest known deadline (120 days), also only
 *                   flagged: a guess never stops a claim the fund might still pay.
 *   membership      digits only, one of these lengths (NMC 9, NHP and NAMMED 11, PSEMAS 9 or the old 13-14, Prosperity
 *                   6; learned from claims the funds accepted and their statements, no fund publishes a format); a
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
  /** With months: counted to the last day of the Nth month after the month of service (set by MONTH_END_FUNDS) */
  monthEnd?: boolean;
}

/**
 * Funds whose rules count a months deadline to the end of the month: "not later than the last day of the fourth month
 * following the month in which the service was rendered". The same wording as the Medical Aid Funds Regulations, 1997
 * (GN 12 of 1997, regulation 7(1)(a)), the shortest period a registered fund may set
 * (https://www.lac.org.na/laws/annoREG/Medical%20Aid%20Funds%20Act%2023%20of%201995-Regulations%201997-012.docx).
 *   NAMM  Nammed Medical Aid Fund member guide, "Claims procedures" (https://www.nammed.com.na/uploads/documents/
 *         4260bdcc2c8fbf7db85adf639cbdc921ff17106e.pdf, read 13 Oct 2026)
 *   NHPM  NHP notice "Submission of claims for medical treatment within 4 months after the treatment date"
 *         (https://nhp.com.na/news/submission-of-claims-for-medical-treatment-within-4-months-after-the-treatment-date/)
 *         and User Guide 2026: December's claims run to 30 April (read 13 Oct 2026)
 * Applies to the fund master's months deadline for these funds too, so support only sets the number of months.
 */
export const MONTH_END_FUNDS: ReadonlySet<string> = new Set(['NHPM', 'NAMM']);

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
  const { months } = values.deadline;
  return {
    key: code,
    label: (sameFund ? identity.label : null) ?? (fundName?.trim() || code),
    deadline: months !== undefined && MONTH_END_FUNDS.has(code) ? { months, monthEnd: true } : values.deadline,
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
 * The built-in rules: the standard researched on 13 Oct 2026. They apply until the fund master table is read, and for
 * any fund it has no usable row for; OneHealth support overrides any of them on Administration > Medical aid funds
 * (proposals/2026-10-13-claims-standards.sql brings the table's rows to the same values).
 * Membership lengths: no fund publishes a number format; they are the lengths on claims the fund accepted (the
 * practice's Eminance claim files) and on the funds' own statements, so a mismatch only warns.
 */
export const FUND_RULES: readonly FundRule[] = [
  // Last day of the 4th month after the service month (MONTH_END_FUNDS: NHP's notice and User Guide 2026)
  ruleFor('NHPM', { deadline: { months: 4 }, confirmed: true, membershipDigits: [11], paymentTermsDays: 30 }),
  // Methealth "Claim submission period": NMC 120 calendar days from the date of service, later claims rejected
  // (https://www.methealth.com.na/guidelines2?proc=Claim+Submission+Period, read 13 Oct 2026)
  ruleFor('NMC1', { deadline: { days: 120 }, confirmed: true, membershipDigits: [9], paymentTermsDays: 30 }),
  // Methealth "Claim submission period": PSEMAS 180 calendar days from the date of service (same page; the PSEMAS
  // member guide 2013/14 said the same). Numbers: 9 digits on Methealth's statements (new format, zero-padded); older
  // cards carry a 13 or 14 digit number that PSEMAS accepted on claims.
  // PSEMAS pays a median 31 days after the service: at 30 days half its batches would show as not answered
  ruleFor('MAG1', {
    deadline: { days: 180 },
    confirmed: true,
    membershipDigits: [9, 13, 14],
    membershipHint: 'New PSEMAS numbers have 9 digits (with leading zeros); older cards show 13 or 14. Check the card.',
    paymentTermsDays: 60
  }),
  // Last day of the 4th month after the service month (MONTH_END_FUNDS: Nammed member guide, "Claims procedures")
  ruleFor('NAMM', { deadline: { months: 4 }, confirmed: true, membershipDigits: [11], paymentTermsDays: 30 }),
  // Not confirmed: Prosperity Health publishes no rule; the only source is the Napotel booklet 2020, a fund Prosperity
  // administers: "not later than four (4) months from the date of service"
  // (http://www.napotelmedical.com.na/images/documents/13399_Prosperita_Napotel_Contents.pdf, read 13 Oct 2026).
  // 6 digits: seen on the practice's accepted PROS claim files only.
  ruleFor('PROS', {
    deadline: { months: 4 },
    confirmed: false,
    membershipDigits: [6],
    membershipHint: 'Prosperity numbers seen so far have 6 digits; not confirmed with the fund. Check the card.',
    paymentTermsDays: 30
  })
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
  const { months, monthEnd } = rule.deadline;
  if (months !== undefined && monthEnd) {
    // The day before the first of the month after the Nth month: 10 Jan + 4 -> 31 May
    return addDaysToKey(addMonthsToKey(`${serviceDate.slice(0, 7)}-01`, months + 1), -1);
  }
  if (months !== undefined) return addMonthsToKey(serviceDate, months);
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

/** Describes a fund deadline in words, e.g. "4 months", "120 days" or "4 months to month-end". */
export function describeDeadline(rule: FundRule): string {
  if (rule.deadline.months !== undefined) return `${rule.deadline.months} months${rule.deadline.monthEnd ? ' to month-end' : ''}`;
  return `${rule.deadline.days ?? 120} days`;
}

/**
 * The deadline as a sentence part: "120 days from the service date", or "to the end of the 4th month after the
 * service month" for a fund that counts to the month's end.
 */
export function deadlineFromService(rule: FundRule): string {
  const { months, monthEnd } = rule.deadline;
  if (months !== undefined && monthEnd) return `to the end of the ${ordinal(months)} month after the service month`;
  return `${describeDeadline(rule)} from the service date`;
}

const ordinal = (n: number): string => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
};

/** Why a deadline only warns, in words: null for a confirmed one */
export function deadlineCaveat(rule: FundRule): string | null {
  if (!rule.configured) return 'assumed: no deadline is known for this fund';
  return rule.confirmed ? null : 'not confirmed with the fund';
}

/**
 * Following up sent claim batches: which batches a fund has left unanswered, and how a batch's lines stand.
 * Pure (no database): claimsService loads the batches, what the funds still owe per batch and the line outcomes.
 */
import { daysBetweenKeys, toDateKey } from '../../../utils/billing/dates';
import { isReversalTransactionType } from '../../../utils/billing/claimFile';
import { FUND_RULES, FUND_RULE_LIMITS, fundRulesInForce, type FundRule } from '../../../utils/billing/fundRules';
import { identifyFund } from '../../../utils/remittance/funds';
import type { ClaimLineOutcome } from './status';
import type { BatchHeaderRow } from './types';

/** practice_settings key: how long a fund may take to answer before its batches are flagged */
export const SILENT_FUND_SETTING_KEY = 'silent_fund_days';

/** Days a fund may take to answer: one wait for every fund, and exceptions by fund code (MAG1, NMC1, NHPM, NAMM, PROS) */
export interface SilentFundDays {
  default: number;
  byFund: Record<string, number>;
}

/**
 * A wait shorter than a week flags batches still being processed; longer than a year is past every fund's deadline.
 * The same limits as a fund's payment terms (they are the same wait).
 */
export const SILENT_DAYS_MIN = FUND_RULE_LIMITS.paymentTermsDays.min;
export const SILENT_DAYS_MAX = FUND_RULE_LIMITS.paymentTermsDays.max;

/** The wait for a fund without payment terms of its own */
export const SILENT_DAYS_GENERAL = 30;

const validDays = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= SILENT_DAYS_MIN && value <= SILENT_DAYS_MAX ? value : null;

/**
 * The waits when the practice has not set its own: each fund's payment terms (its rule, kept on Administration >
 * Medical aid funds) where they differ from the general 30 days. Most NMC and NHP claims are paid within 30 days;
 * PSEMAS waits 60 (fundRules.ts says why).
 */
export function silentFundDefaults(rules: readonly FundRule[] = fundRulesInForce()): SilentFundDays {
  const byFund: Record<string, number> = {};
  for (const rule of rules) {
    const days = validDays(rule.paymentTermsDays);
    if (rule.configured && days !== null && days !== SILENT_DAYS_GENERAL) byFund[rule.key] = days;
  }
  return { default: SILENT_DAYS_GENERAL, byFund };
}

/** The waits from the built-in fund rules (PSEMAS 60 days, every other fund 30), before the fund master is read */
export const SILENT_FUND_DEFAULTS: SilentFundDays = silentFundDefaults(FUND_RULES);

export interface SilentBatch {
  batch: BatchHeaderRow;
  /** The fund's claim-file code (MAG1, NMC1, NHPM, NAMM, PROS), or the batch's own reference when unknown */
  fundCode: string;
  /** Whole days since the batch was sent */
  daysSinceSent: number;
  /** What the fund still owes on the batch's invoices; null when that could not be read */
  owedCents: number | null;
}

export interface SilentFund {
  fundCode: string;
  batches: SilentBatch[];
  /** Null when any of its batches' amounts could not be read */
  owedCents: number | null;
  oldestDays: number;
}

/** The fund's code for a batch reference ("PSEMAS" and "MAG1" are the same fund) */
export const fundCodeOf = (reference: string | null | undefined): string =>
  identifyFund(reference)?.code ?? (reference ?? '').trim().toUpperCase();

/**
 * The practice's setting as stored (practice_settings.setting_value), made safe: no row or an unreadable value gives
 * the defaults (the funds' payment terms); a wait outside 7-365 whole days is ignored; funds are kept by their code
 * ("PSEMAS" is MAG1). A stored setting without byFund keeps the defaults' exceptions; one with byFund is complete (a
 * fund left out uses the practice's own default): the practice's own setting always wins over the funds' terms.
 */
export function parseSilentFundDays(value: unknown, defaults: SilentFundDays = SILENT_FUND_DEFAULTS): SilentFundDays {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaults, byFund: { ...defaults.byFund } };
  const stored = value as { default?: unknown; byFund?: unknown };
  const byFund: Record<string, number> = {};
  if (stored.byFund && typeof stored.byFund === 'object' && !Array.isArray(stored.byFund)) {
    for (const [fund, days] of Object.entries(stored.byFund as Record<string, unknown>)) {
      const code = fundCodeOf(fund);
      const valid = validDays(days);
      if (code && valid !== null) byFund[code] = valid;
    }
  } else {
    Object.assign(byFund, defaults.byFund);
  }
  return { default: validDays(stored.default) ?? defaults.default, byFund };
}

/** How long this fund may take to answer */
export const silentDaysFor = (fund: string | null | undefined, settings: SilentFundDays): number =>
  settings.byFund[fundCodeOf(fund)] ?? settings.default;

/** The setting in words: "Warn when a fund has not answered after 30 days; PSEMAS after 60 days." */
export function describeSilentFundDays(settings: SilentFundDays, nameOf: (fundCode: string) => string): string {
  const exceptions = Object.entries(settings.byFund)
    .filter(([, days]) => days !== settings.default)
    .map(([code, days]) => `${nameOf(code)} after ${days} days`)
    .sort();
  return `Warn when a fund has not answered after ${settings.default} days${exceptions.length > 0 ? `; ${exceptions.join('; ')}` : ''}.`;
}

/** The day a timestamp fell on in the practice's (the browser's) calendar */
const localDayOf = (timestamp: string): string | null => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? toDateKey(timestamp) : toDateKey(date);
};

/**
 * Sent batches the fund has not answered (still "Submitted": nothing came back, so the status never moved on) for as
 * long as the practice lets that fund take (silentDaysFor) or longer, while it still owes money on them. A batch the
 * practice was paid for another way (a receipt keyed by hand, a write-off) owes nothing and is left out; when the
 * amounts could not be read (`owedByBatch` null) every unanswered batch is listed, with the amount unknown. Oldest
 * first.
 */
export function silentBatches(
  batches: readonly BatchHeaderRow[],
  owedByBatch: ReadonlyMap<string, number> | null,
  today: string,
  settings: SilentFundDays = SILENT_FUND_DEFAULTS
): SilentBatch[] {
  const silent: SilentBatch[] = [];
  for (const batch of batches) {
    const status = (batch.status ?? (batch.sent_at ? 'sent' : 'active')).toLowerCase();
    // A credit file takes money back from the fund: the fund owes nothing on it, so it is never "not answered"
    if (status !== 'sent' || !batch.sent_at || isReversalTransactionType(batch.transaction_type)) continue;
    const sentDay = localDayOf(batch.sent_at);
    if (!sentDay) continue;
    const daysSinceSent = daysBetweenKeys(sentDay, today);
    if (daysSinceSent < silentDaysFor(batch.medical_aid_reference, settings)) continue;
    const owedCents = owedByBatch ? owedByBatch.get(batch.id) ?? 0 : null;
    if (owedCents !== null && owedCents <= 0) continue;
    silent.push({ batch, fundCode: fundCodeOf(batch.medical_aid_reference), daysSinceSent, owedCents });
  }
  return silent.sort((a, b) => b.daysSinceSent - a.daysSinceSent || a.batch.batch_number - b.batch.batch_number);
}

/** Silent batches per fund, the fund owing most first */
export function silentFunds(silent: readonly SilentBatch[]): SilentFund[] {
  const groups = new Map<string, SilentFund>();
  for (const item of silent) {
    const group = groups.get(item.fundCode) ?? { fundCode: item.fundCode, batches: [], owedCents: 0, oldestDays: 0 };
    group.batches.push(item);
    group.owedCents = group.owedCents === null || item.owedCents === null ? null : group.owedCents + item.owedCents;
    group.oldestDays = Math.max(group.oldestDays, item.daysSinceSent);
    groups.set(item.fundCode, group);
  }
  return [...groups.values()].sort((a, b) => (b.owedCents ?? 0) - (a.owedCents ?? 0) || b.oldestDays - a.oldestDays);
}

export type OutcomeCounts = Record<ClaimLineOutcome | 'none', number>;

/** How many of a batch's lines the fund paid, part paid, did not pay, left waiting, or has not answered */
export function outcomeCounts(lineKeys: readonly string[], outcomeOf: (lineKey: string) => ClaimLineOutcome | undefined): OutcomeCounts {
  const counts: OutcomeCounts = { paid: 0, part_paid: 0, rejected: 0, waiting: 0, none: 0 };
  for (const key of lineKeys) counts[outcomeOf(key) ?? 'none'] += 1;
  return counts;
}

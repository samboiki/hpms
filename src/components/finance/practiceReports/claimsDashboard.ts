/**
 * The claims dashboard (parity G10): what was claimed against what the funds paid, per month and per fund, how long
 * each fund takes to pay, why claims were refused, and the funds that have not answered.
 *
 * The figures per month and fund come from the database (report_claims_by_month,
 * proposals/2026-10-12-claims-dashboard-and-story.sql): every claim line of the batches sent in the period, with the
 * fund's answers as claim_line_outcomes reads them, so they agree with each sent batch's answers. A claim line sent
 * again (field 32) is claimed again and counts again; the dashboard says how many were. The silent funds are the
 * claims screen's own alert (batchFollowUp: silentBatches, silentFunds), as at today.
 */
import { format, parseISO } from 'date-fns';
import { toCents } from '../../../services/ledgerService';
import { fundLabel } from '../../../utils/remittance/funds';
import { CATEGORY_LABELS, type ReasonCategory } from '../../../utils/remittance/reasonCodes';
import { fundCodeOf, type SilentFund } from '../claims/batchFollowUp';
import type { CsvCell } from '../financeExport';
import type { LinkedReport } from './reportTargets';

/** A row of report_claims_by_month */
export interface RawMonthFundRow {
  month: string | null;
  fund_reference: string | null;
  batch_ids: string[] | null;
  lines: number | null;
  claimed: number | string | null;
  paid: number | string | null;
  paid_lines: number | null;
  part_paid_lines: number | null;
  rejected_lines: number | null;
  waiting_lines: number | null;
  unanswered_lines: number | null;
  resent_lines: number | null;
  days_to_pay_total: number | string | null;
  days_to_pay_lines: number | null;
}

export interface MonthFundRow {
  /** yyyy-MM */
  month: string;
  fundCode: string;
  batchIds: string[];
  lines: number;
  claimedCents: number;
  paidCents: number;
  paidLines: number;
  partPaidLines: number;
  rejectedLines: number;
  waitingLines: number;
  unansweredLines: number;
  resentLines: number;
  daysTotal: number;
  daysLines: number;
}

const count = (value: number | string | null | undefined): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

/** Rows as the dashboard uses them, a fund's aliases merged (MAG1 and PSEMAS are one fund) */
export function monthFundRows(raw: readonly RawMonthFundRow[]): MonthFundRow[] {
  const merged = new Map<string, MonthFundRow>();
  for (const row of raw) {
    const month = row.month?.slice(0, 7);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) continue;
    const fundCode = fundCodeOf(row.fund_reference) || 'Fund not recorded';
    const key = `${month}|${fundCode}`;
    const target = merged.get(key) ?? {
      month, fundCode, batchIds: [], lines: 0, claimedCents: 0, paidCents: 0, paidLines: 0, partPaidLines: 0, rejectedLines: 0,
      waitingLines: 0, unansweredLines: 0, resentLines: 0, daysTotal: 0, daysLines: 0
    };
    target.batchIds = [...new Set([...target.batchIds, ...(row.batch_ids ?? [])])];
    target.lines += count(row.lines);
    target.claimedCents += toCents(row.claimed);
    target.paidCents += toCents(row.paid);
    target.paidLines += count(row.paid_lines);
    target.partPaidLines += count(row.part_paid_lines);
    target.rejectedLines += count(row.rejected_lines);
    target.waitingLines += count(row.waiting_lines);
    target.unansweredLines += count(row.unanswered_lines);
    target.resentLines += count(row.resent_lines);
    target.daysTotal += count(row.days_to_pay_total);
    target.daysLines += count(row.days_to_pay_lines);
    merged.set(key, target);
  }
  return [...merged.values()].sort((a, b) => a.month.localeCompare(b.month) || a.fundCode.localeCompare(b.fundCode));
}

export interface ClaimsTotal {
  key: string;
  batchIds: string[];
  lines: number;
  claimedCents: number;
  paidCents: number;
  /** paid / claimed; null when nothing was claimed */
  paidShare: number | null;
  rejectedLines: number;
  unansweredLines: number;
  resentLines: number;
  /** Average days from sending to the fund's answer, over paid and part-paid lines; null when none was paid */
  averageDaysToPay: number | null;
}

function total(key: string, rows: readonly MonthFundRow[]): ClaimsTotal {
  const claimedCents = rows.reduce((sum, row) => sum + row.claimedCents, 0);
  const paidCents = rows.reduce((sum, row) => sum + row.paidCents, 0);
  const daysLines = rows.reduce((sum, row) => sum + row.daysLines, 0);
  const daysTotal = rows.reduce((sum, row) => sum + row.daysTotal, 0);
  return {
    key,
    batchIds: [...new Set(rows.flatMap(row => row.batchIds))],
    lines: rows.reduce((sum, row) => sum + row.lines, 0),
    claimedCents,
    paidCents,
    paidShare: claimedCents > 0 ? paidCents / claimedCents : null,
    rejectedLines: rows.reduce((sum, row) => sum + row.rejectedLines, 0),
    unansweredLines: rows.reduce((sum, row) => sum + row.unansweredLines, 0),
    resentLines: rows.reduce((sum, row) => sum + row.resentLines, 0),
    averageDaysToPay: daysLines > 0 ? Math.round((daysTotal / daysLines) * 10) / 10 : null
  };
}

const groupBy = (rows: readonly MonthFundRow[], key: (row: MonthFundRow) => string): Map<string, MonthFundRow[]> => {
  const groups = new Map<string, MonthFundRow[]>();
  rows.forEach(row => groups.set(key(row), [...(groups.get(key(row)) ?? []), row]));
  return groups;
};

/** Per month, oldest first */
export const totalsByMonth = (rows: readonly MonthFundRow[]): ClaimsTotal[] =>
  [...groupBy(rows, row => row.month).entries()].map(([month, group]) => total(month, group)).sort((a, b) => a.key.localeCompare(b.key));

/** Per fund, the fund claimed most first */
export const totalsByFund = (rows: readonly MonthFundRow[]): ClaimsTotal[] =>
  [...groupBy(rows, row => row.fundCode).entries()].map(([fund, group]) => total(fund, group)).sort((a, b) => b.claimedCents - a.claimedCents || a.key.localeCompare(b.key));

export const totalOf = (rows: readonly MonthFundRow[]): ClaimsTotal => total('all', rows);

// ---------------------------------------------------------------------------------------------
// Rejections by reason
// ---------------------------------------------------------------------------------------------

/** A rejection queue item (claim_rejections) as the dashboard reads it */
export interface RejectionFact {
  id: string;
  claimLineId: string | null;
  category: ReasonCategory;
  plainReason: string;
  atStakeCents: number;
  open: boolean;
}

export interface ReasonTotal {
  category: ReasonCategory;
  reason: string;
  lines: number;
  atStakeCents: number;
  open: number;
  claimLineIds: string[];
}

/** Refusals grouped by the reason in plain words (what to do first), most money at stake first */
export function rejectionsByReason(items: readonly RejectionFact[]): ReasonTotal[] {
  const groups = new Map<string, ReasonTotal>();
  for (const item of items) {
    const reason = item.plainReason.trim() || 'No reason given';
    const key = `${item.category}|${reason}`;
    const group = groups.get(key) ?? { category: item.category, reason, lines: 0, atStakeCents: 0, open: 0, claimLineIds: [] };
    group.lines += 1;
    group.atStakeCents += item.atStakeCents;
    if (item.open) group.open += 1;
    if (item.claimLineId && !group.claimLineIds.includes(item.claimLineId)) group.claimLineIds.push(item.claimLineId);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.atStakeCents - a.atStakeCents || b.lines - a.lines || a.reason.localeCompare(b.reason));
}

// ---------------------------------------------------------------------------------------------
// Tables (screen, CSV and print)
// ---------------------------------------------------------------------------------------------

const amount = (cents: number): number => cents / 100;
const monthName = (month: string): string => format(parseISO(`${month}-01`), 'MMMM yyyy');

export const CLAIMS_NOTES = [
  'Every claim line of the batches sent in the period (credit files left out), by the month the batch was sent, with what the fund has paid on it so far. A line sent again counts again in the month it was sent again.',
  'Days to pay: from sending to the fund\'s latest answer, for the lines the fund paid or part paid.'
];

export function monthTable(totals: readonly ClaimsTotal[], periodLabel: string): LinkedReport {
  const sum = (pick: (t: ClaimsTotal) => number) => totals.reduce((acc, t) => acc + pick(t), 0);
  const all = { lines: sum(t => t.lines), claimedCents: sum(t => t.claimedCents), paidCents: sum(t => t.paidCents), rejectedLines: sum(t => t.rejectedLines), unansweredLines: sum(t => t.unansweredLines) };
  const paidShare = all.claimedCents > 0 ? all.paidCents / all.claimedCents : null;
  return {
    table: {
      title: 'Claimed and paid per month',
      basis: `Batches sent ${periodLabel}`,
      columns: [
        { header: 'Month sent', type: 'text' },
        { header: 'Claim lines', type: 'count' },
        { header: 'Claimed', type: 'money' },
        { header: 'Paid so far', type: 'money' },
        { header: 'Paid share', type: 'percent' },
        { header: 'Not paid', type: 'count' },
        { header: 'No answer yet', type: 'count' }
      ],
      rows: totals.map(t => [monthName(t.key), t.lines, amount(t.claimedCents), amount(t.paidCents), t.paidShare, t.rejectedLines, t.unansweredLines] as CsvCell[]),
      totals: ['Total', all.lines, amount(all.claimedCents), amount(all.paidCents), paidShare, all.rejectedLines, all.unansweredLines],
      notes: CLAIMS_NOTES
    },
    targets: totals.map(t => ({ kind: 'batches' as const, ids: t.batchIds, label: monthName(t.key) }))
  };
}

export function fundTable(totals: readonly ClaimsTotal[], periodLabel: string): LinkedReport {
  return {
    table: {
      title: 'Claimed and paid per fund',
      basis: `Batches sent ${periodLabel}`,
      columns: [
        { header: 'Fund', type: 'text' },
        { header: 'Claim lines', type: 'count' },
        { header: 'Claimed', type: 'money' },
        { header: 'Paid so far', type: 'money' },
        { header: 'Paid share', type: 'percent' },
        { header: 'Average days to pay', type: 'count' },
        { header: 'Not paid', type: 'count' },
        { header: 'No answer yet', type: 'count' },
        { header: 'Sent again', type: 'count' }
      ],
      rows: totals.map(t => [fundLabel(t.key), t.lines, amount(t.claimedCents), amount(t.paidCents), t.paidShare, t.averageDaysToPay, t.rejectedLines, t.unansweredLines, t.resentLines] as CsvCell[]),
      notes: CLAIMS_NOTES
    },
    targets: totals.map(t => ({ kind: 'batches' as const, ids: t.batchIds, label: fundLabel(t.key) }))
  };
}

export function reasonTable(totals: readonly ReasonTotal[], periodLabel: string): LinkedReport {
  return {
    table: {
      title: 'Claims not paid, by reason',
      basis: `Refusals recorded ${periodLabel}`,
      columns: [
        { header: 'Reason', type: 'text' },
        { header: 'What to do', type: 'text' },
        { header: 'Claim lines', type: 'count' },
        { header: 'At stake', type: 'money' },
        { header: 'Still open', type: 'count' }
      ],
      rows: totals.map(t => [t.reason, CATEGORY_LABELS[t.category], t.lines, amount(t.atStakeCents), t.open] as CsvCell[]),
      totals: ['Total', '', totals.reduce((s, t) => s + t.lines, 0), amount(totals.reduce((s, t) => s + t.atStakeCents, 0)), totals.reduce((s, t) => s + t.open, 0)],
      notes: ['From the rejection queue (Finance > Remittances > Rejections): each line a fund refused or paid short, by the reason in plain words.']
    },
    targets: totals.map(t => (t.claimLineIds.length > 0 ? { kind: 'claim_lines' as const, ids: t.claimLineIds, label: t.reason } : null))
  };
}

export function silentFundTable(funds: readonly SilentFund[], todayLabel: string): LinkedReport {
  return {
    table: {
      title: 'Funds that have not answered',
      basis: `As at ${todayLabel}`,
      columns: [
        { header: 'Fund', type: 'text' },
        { header: 'Batches', type: 'count' },
        { header: 'Still owed', type: 'money' },
        { header: 'Oldest (days since sent)', type: 'count' }
      ],
      rows: funds.map(fund => [fundLabel(fund.fundCode), fund.batches.length, fund.owedCents === null ? null : amount(fund.owedCents), fund.oldestDays] as CsvCell[]),
      notes: ['Sent batches the fund has not answered for longer than the practice lets it take (Finance > Batches says how long), while it still owes money on them.']
    },
    targets: funds.map(fund => ({ kind: 'batches' as const, ids: fund.batches.map(item => item.batch.id), label: fundLabel(fund.fundCode) }))
  };
}

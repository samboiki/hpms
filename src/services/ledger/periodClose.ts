import { addDays, addMonths, endOfMonth, format, isValid, parseISO, subMonths } from 'date-fns';
import { formatNad, fromCents } from '../../utils/billing/money';
import { dateKeyFrom, toDateKey, type DateRange } from './dates';
import { toCents } from './money';
import { isEffective, type ArReceipt } from './arModel';
import type { RuleResult } from './arRules';
import { MOVEMENT_KINDS, netOfMovements, zeroMovements, type MovementTotals } from './ledgerMovements';

// ---------------------------------------------------------------------------------------------
// Month end: control totals (opening balance + movements = closing balance, proven against the
// ledger), the checks before a month is closed, and who may close or reopen it. A closed month is
// locked in the database (proposals/2026-10-07-debtors-and-controls.sql): nothing dated in it can
// be added, changed or deleted until an admin reopens it with a reason.
// ---------------------------------------------------------------------------------------------

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthKey = (value: string): boolean => MONTH_KEY.test(value);

/** First to last day of a month (yyyy-MM) */
export function monthRange(monthKey: string): DateRange {
  const start = parseISO(`${monthKey}-01`);
  return { startKey: toDateKey(start), endKey: toDateKey(endOfMonth(start)) };
}

export const previousMonthKey = (monthKey: string): string => format(subMonths(parseISO(`${monthKey}-01`), 1), 'yyyy-MM');

export function formatMonth(monthKey: string): string {
  const date = parseISO(`${monthKey}-01`);
  return isValid(date) ? format(date, 'MMMM yyyy') : monthKey;
}

/** A day as staff read it: "7 Oct 2026" */
export const formatDayKey = (dateKey: string): string => {
  const date = parseISO(dateKey);
  return isValid(date) ? format(date, 'd MMM yyyy') : dateKey;
};

const nadText = (cents: number): string => formatNad(fromCents(cents));

/** Roles that may close and reopen a month */
export const PERIOD_CLOSE_ROLES: readonly string[] = ['admin'];
export const canClosePeriods = (role: string | null | undefined): boolean => PERIOD_CLOSE_ROLES.includes(role ?? '');

// ---------------------------------------------------------------------------------------------
// Closes
// ---------------------------------------------------------------------------------------------

export interface PeriodClose {
  id: string;
  monthKey: string;
  closedAt: string;
  closedBy: string | null;
  notes: string | null;
  /** Control totals and the month-end pack as they were at the close (amounts in cents) */
  snapshot: Record<string, unknown> | null;
  closingCents: number | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
}

export interface RawPeriodCloseRow {
  id: string;
  period_month?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  notes?: string | null;
  snapshot?: unknown;
  closing_balance?: number | string | null;
  reopened_at?: string | null;
  reopened_by?: string | null;
  reopen_reason?: string | null;
}

export function normalizePeriodClose(row: RawPeriodCloseRow): PeriodClose | null {
  const start = dateKeyFrom(row.period_month);
  if (!start || !row.closed_at) return null;
  return {
    id: row.id,
    monthKey: start.slice(0, 7),
    closedAt: row.closed_at,
    closedBy: row.closed_by ?? null,
    notes: row.notes?.trim() || null,
    snapshot: row.snapshot && typeof row.snapshot === 'object' ? (row.snapshot as Record<string, unknown>) : null,
    closingCents: row.closing_balance === null || row.closing_balance === undefined ? null : toCents(row.closing_balance),
    reopenedAt: row.reopened_at ?? null,
    reopenedBy: row.reopened_by ?? null,
    reopenReason: row.reopen_reason?.trim() || null
  };
}

/** The close in force for each month (a reopened close no longer locks anything) */
export function closedMonths(closes: readonly PeriodClose[]): Map<string, PeriodClose> {
  const months = new Map<string, PeriodClose>();
  for (const close of closes) {
    if (close.reopenedAt) continue;
    const current = months.get(close.monthKey);
    if (!current || close.closedAt > current.closedAt) months.set(close.monthKey, close);
  }
  return months;
}

/** The close that locks a day, or null when its month is open */
export const lockFor = (dateKey: string | null, closes: readonly PeriodClose[]): PeriodClose | null =>
  dateKey ? closedMonths(closes).get(dateKey.slice(0, 7)) ?? null : null;

/** The first day on or after `dateKey` whose month is open: where a late entry may be dated */
export function firstOpenDay(dateKey: string, closes: readonly PeriodClose[]): string {
  const closed = closedMonths(closes);
  let day = dateKey;
  // Bounded: at most 100 years of closed months are skipped
  for (let i = 0; i < 1200 && closed.has(day.slice(0, 7)); i += 1) {
    day = toDateKey(addMonths(parseISO(`${day.slice(0, 7)}-01`), 1));
  }
  return day;
}

// ---------------------------------------------------------------------------------------------
// Control totals
// ---------------------------------------------------------------------------------------------

/**
 * The movement totals the database adds up for a month (dc_control_totals): every movement dated
 * before the month, in it, and after it up to today, by the rules of ledgerMovements.ts, and the
 * ledger balance now (each invoice's outstanding balance, overpaid ones negative, less the
 * unallocated credit of standing receipts).
 */
export interface ControlAggregates {
  before: MovementTotals;
  during: MovementTotals;
  after: MovementTotals;
  ledgerNetCents: number;
}

export interface ControlTotals {
  monthKey: string;
  range: DateRange;
  /** Balance brought forward: the closing balance kept at the previous month's close, else the entries before the month */
  openingCents: number;
  openingSource: 'previous_close' | 'computed';
  /** What the entries dated before the month add up to now */
  computedOpeningCents: number;
  /** openingCents - computedOpeningCents: not zero means a closed month changed after it was closed */
  openingDifferenceCents: number;
  movements: MovementTotals;
  netMovementCents: number;
  /** opening + movements */
  closingCents: number;
  /** The ledger balance now, less what happened after the month: what the balances say the month ended on */
  ledgerClosingCents: number;
  /** (entries before + entries in the month) - ledger closing: not zero means the entries do not explain the balances */
  ledgerDifferenceCents: number;
}

/**
 * The month's roll-forward. Opening + invoices - credit notes - write-offs +/- corrections -
 * payments + refunds +/- reversals = closing. Two proofs: the entries must add up to the ledger's
 * balances (otherwise something changed without an entry showing it), and the opening must be the
 * closing balance kept when the previous month was closed (otherwise a closed month changed).
 */
export function controlTotals(monthKey: string, aggregates: ControlAggregates, previousClose?: Pick<PeriodClose, 'closingCents'> | null): ControlTotals {
  const computedOpeningCents = netOfMovements(aggregates.before);
  const netMovementCents = netOfMovements(aggregates.during);
  const previous = previousClose?.closingCents ?? null;
  const openingCents = previous ?? computedOpeningCents;
  const ledgerClosingCents = aggregates.ledgerNetCents - netOfMovements(aggregates.after);
  return {
    monthKey,
    range: monthRange(monthKey),
    openingCents,
    openingSource: previous === null ? 'computed' : 'previous_close',
    computedOpeningCents,
    openingDifferenceCents: openingCents - computedOpeningCents,
    movements: { ...aggregates.during },
    netMovementCents,
    closingCents: openingCents + netMovementCents,
    ledgerClosingCents,
    ledgerDifferenceCents: computedOpeningCents + netMovementCents - ledgerClosingCents
  };
}

const movementTotalsFrom = (value: unknown): MovementTotals | null => {
  if (!value || typeof value !== 'object') return null;
  const json = value as Record<string, unknown>;
  const totals = zeroMovements();
  for (const kind of MOVEMENT_KINDS) {
    const cents = json[kind.key];
    if (cents === undefined || cents === null) continue;
    if (typeof cents !== 'number' || !Number.isInteger(cents)) return null;
    totals[kind.key] = cents;
  }
  return totals;
};

/** The JSON of dc_control_totals (cents); null when it is not that shape */
export function parseControlAggregates(value: unknown): ControlAggregates | null {
  if (!value || typeof value !== 'object') return null;
  const json = value as Record<string, unknown>;
  const before = movementTotalsFrom(json.before);
  const during = movementTotalsFrom(json.during);
  const after = movementTotalsFrom(json.after);
  const ledgerNetCents = json.ledger_net_cents;
  if (!before || !during || !after || typeof ledgerNetCents !== 'number' || !Number.isInteger(ledgerNetCents)) return null;
  return { before, during, after, ledgerNetCents };
}

/**
 * The control totals kept with a close (period_closes.snapshot.control_totals): what the month
 * looked like when it was signed off, so a closed month always shows and prints the same figures.
 * Null when the snapshot does not hold them.
 */
export function controlTotalsFromSnapshot(monthKey: string, snapshot: Record<string, unknown> | null): ControlTotals | null {
  const kept = snapshot?.control_totals;
  const aggregates = parseControlAggregates(kept);
  if (!aggregates || !kept || typeof kept !== 'object') return null;
  const json = kept as Record<string, unknown>;
  const opening = typeof json.opening_cents === 'number' && Number.isInteger(json.opening_cents) ? json.opening_cents : null;
  const totals = controlTotals(monthKey, aggregates, opening === null ? null : { closingCents: opening });
  return { ...totals, openingSource: json.opening_source === 'previous_close' ? 'previous_close' : 'computed' };
}

/** Movement totals as JSON (cents per kind), as dc_control_totals returns and the close stores them */
export const movementTotalsJson = (totals: MovementTotals): Record<string, number> =>
  Object.fromEntries(MOVEMENT_KINDS.map(kind => [kind.key, totals[kind.key]]));

/** The kinds whose totals differ between two sets of movement totals (e.g. the screen's and the database's) */
export const movementDifferences = (a: MovementTotals, b: MovementTotals): string[] =>
  MOVEMENT_KINDS.filter(kind => a[kind.key] !== b[kind.key]).map(kind => kind.label);

// ---------------------------------------------------------------------------------------------
// Checks before a month is closed
// ---------------------------------------------------------------------------------------------

export type CloseCheckKey = 'month_ended' | 'not_closed' | 'role' | 'receipts' | 'cash_ups' | 'ledger' | 'opening' | 'loaded' | 'previous_month';

export interface CloseCheck {
  key: CloseCheckKey;
  ok: boolean;
  /** A failed blocking check stops the close; the others are warnings */
  blocking: boolean;
  title: string;
  detail: string;
  /** What still needs attention (receipt numbers, days) */
  items: string[];
}

export interface CloseCheckInput {
  monthKey: string;
  todayKey: string;
  role: string | null | undefined;
  closes: readonly PeriodClose[];
  /** Standing receipts with money not allocated, received on or before the month's last day */
  unallocatedReceipts: readonly ArReceipt[];
  /** Why each still-unallocated receipt is fine to carry over (receipt id -> reason) */
  explanations: Readonly<Record<string, string>>;
  /** Days of the month on which money was received or refunded */
  cashDays: readonly string[];
  /** Days with a cash-up in force */
  cashedUpDays: ReadonlySet<string>;
  totals: ControlTotals;
  /** The month's movements from the entries loaded on screen (they make the month-end pack) */
  loadedMovements: MovementTotals;
}

/**
 * The checks of the month-end close. Blocking: the month has ended, it is not closed already, the
 * person is an admin, every receipt is allocated or its unallocated money explained, every day
 * money was taken is cashed up, the entries add up to the ledger, the opening balance is the
 * previous close's closing balance, and the entries on screen are the database's. Warning: the
 * previous month is still open.
 */
export function closeChecks(input: CloseCheckInput): { checks: CloseCheck[]; canClose: boolean } {
  const range = monthRange(input.monthKey);
  const closed = closedMonths(input.closes);
  const checks: CloseCheck[] = [];

  const ended = range.endKey < input.todayKey;
  checks.push({
    key: 'month_ended',
    ok: ended,
    blocking: true,
    title: 'The month has ended',
    detail: ended
      ? `${formatMonth(input.monthKey)} ended on ${formatDayKey(range.endKey)}.`
      : `${formatMonth(input.monthKey)} can be closed from ${formatDayKey(toDateKey(addDays(parseISO(range.endKey), 1)))}.`,
    items: []
  });

  const existing = closed.get(input.monthKey);
  checks.push({
    key: 'not_closed',
    ok: !existing,
    blocking: true,
    title: 'Not closed yet',
    detail: existing ? `Closed on ${formatDayKey(dateKeyFrom(existing.closedAt) ?? '')}. Reopen it first to close it again.` : 'This month is open.',
    items: []
  });

  checks.push({
    key: 'role',
    ok: canClosePeriods(input.role),
    blocking: true,
    title: 'Closed by a practice admin',
    detail: canClosePeriods(input.role) ? 'You can close and reopen months.' : 'Only a practice admin can close or reopen a month.',
    items: []
  });

  const unexplained = input.unallocatedReceipts.filter(receipt =>
    isEffective(receipt) && receipt.unallocatedCents > 0 && (receipt.receivedOn ?? '') <= range.endKey && !input.explanations[receipt.id]?.trim());
  checks.push({
    key: 'receipts',
    ok: unexplained.length === 0,
    blocking: true,
    title: 'Every receipt allocated or explained',
    detail: unexplained.length === 0
      ? 'All money received is on invoices, or there is a reason for what is not.'
      : `${unexplained.length} receipt${unexplained.length === 1 ? '' : 's'} still hold unallocated money. Allocate it, or say why it stays (for example a fund payment not matched yet).`,
    items: unexplained.map(receipt => `${receipt.number}: ${nadText(receipt.unallocatedCents)} unallocated`)
  });

  const missing = [...new Set(input.cashDays)].filter(day => day >= range.startKey && day <= range.endKey && !input.cashedUpDays.has(day)).sort();
  checks.push({
    key: 'cash_ups',
    ok: missing.length === 0,
    blocking: true,
    title: 'Every day cashed up',
    detail: missing.length === 0
      ? 'Each day money was received or refunded has a cash-up.'
      : `${missing.length} day${missing.length === 1 ? ' has' : 's have'} payments but no cash-up. Cash them up on Payments > Day end.`,
    items: missing.map(formatDayKey)
  });

  const totals = input.totals;
  checks.push({
    key: 'ledger',
    ok: totals.ledgerDifferenceCents === 0,
    blocking: true,
    title: 'Control totals agree with the ledger',
    detail: totals.ledgerDifferenceCents === 0
      ? `Opening ${nadText(totals.openingCents)} + movements ${nadText(totals.netMovementCents)} = closing ${nadText(totals.closingCents)}, which is what the account balances say.`
      : `The entries add up to ${nadText(totals.computedOpeningCents + totals.netMovementCents)} but the account balances say ${nadText(totals.ledgerClosingCents)} (difference ${nadText(totals.ledgerDifferenceCents)}). Something changed without an entry showing it; find it before closing.`,
    items: []
  });

  if (totals.openingSource === 'previous_close') {
    checks.push({
      key: 'opening',
      ok: totals.openingDifferenceCents === 0,
      blocking: true,
      title: 'Opening balance is last month\'s closing balance',
      detail: totals.openingDifferenceCents === 0
        ? 'The balance brought forward is the closing balance kept when the previous month was closed.'
        : `The entries before this month now add up to ${nadText(totals.computedOpeningCents)}, not the ${nadText(totals.openingCents)} kept at the previous close (difference ${nadText(-totals.openingDifferenceCents)}): something dated in a closed month changed. Reopen that month with a reason and close it again.`,
      items: []
    });
  }

  const notLoaded = movementDifferences(input.loadedMovements, totals.movements);
  checks.push({
    key: 'loaded',
    ok: notLoaded.length === 0,
    blocking: true,
    title: 'The month-end pack has every entry',
    detail: notLoaded.length === 0
      ? 'The entries on this screen add up to the database totals.'
      : `These differ from the database totals: ${notLoaded.join(', ')}. Reload the page and try again.`,
    items: []
  });

  const previousKey = previousMonthKey(input.monthKey);
  const previousClosed = closed.has(previousKey);
  checks.push({
    key: 'previous_month',
    ok: previousClosed,
    blocking: false,
    title: 'Previous month closed',
    detail: previousClosed ? `${formatMonth(previousKey)} is closed.` : `${formatMonth(previousKey)} is still open, so its figures (and this month's opening balance) can still change. Close months in order where you can.`,
    items: []
  });

  return { checks, canClose: checks.every(check => check.ok || !check.blocking) };
}

/** Reopening a closed month: an admin, with a reason (it is kept with the close) */
export function checkReopen(input: { role: string | null | undefined; reason: string; close: PeriodClose | null }): RuleResult {
  if (!input.close || input.close.reopenedAt) return { ok: false, error: 'This month is not closed' };
  if (!canClosePeriods(input.role)) return { ok: false, error: 'Only a practice admin can reopen a month' };
  if (input.reason.trim().length < 5) return { ok: false, error: 'Say why the month is reopened (it is kept with the month)' };
  return { ok: true, error: null };
}

import { formatNad, fromCents } from '../../utils/billing/money';
import { dateKeyFrom } from './dates';
import { toCents } from './money';
import type { CashierLine } from './cashUp';
import type { RuleResult } from './arRules';

// ---------------------------------------------------------------------------------------------
// Cash-up per cashier (owner decision, 13 Oct 2026; parity H11): each receptionist cashes up their own takings with
// their own float. They count the till (the float they started with plus the cash they took, less cash refunds), add
// up the card machine slips and the EFTs they confirmed, and say what they keep back as tomorrow's float. The
// administrator sees every cashier of the day and signs the day off (the existing day close, Finance > Payments >
// Day end). The database checks the same once proposals/2026-10-13-cashier-cash-ups.sql is applied.
// ---------------------------------------------------------------------------------------------

const ok: RuleResult = { ok: true, error: null };
const fail = (error: string): RuleResult => ({ ok: false, error });
const nad = (cents: number): string => formatNad(fromCents(cents));

/** What a cashier counts against the receipts they captured */
export const CASHIER_COUNT_METHODS = ['cash', 'card', 'eft'] as const;
export type CashierCountMethod = (typeof CASHIER_COUNT_METHODS)[number];

export const CASHIER_METHOD_LABELS: Record<CashierCountMethod, string> = {
  cash: 'Cash in the till',
  card: 'Card machine slips',
  eft: 'EFTs confirmed'
};

const COUNT_PROMPTS: Record<CashierCountMethod, string> = {
  cash: 'cash counted in your till',
  card: 'total of your card machine slips',
  eft: 'total of the EFTs you confirmed'
};

export type MethodCents = Record<CashierCountMethod, number>;

/**
 * What the cashier should have, per method: the cash is the float they started with plus their standing cash
 * receipts less the cash refunds they paid out; card and EFT are their standing receipts by that method.
 */
export function cashierExpected(line: Pick<CashierLine, 'byMethod' | 'expectedCashCents'> | null | undefined, floatInCents: number): MethodCents {
  return {
    cash: floatInCents + (line?.expectedCashCents ?? 0),
    card: line?.byMethod.card ?? 0,
    eft: line?.byMethod.eft ?? 0
  };
}

export interface MethodDifference {
  method: CashierCountMethod;
  expectedCents: number;
  countedCents: number;
  /** counted - expected: positive = more than the receipts say */
  differenceCents: number;
}

export function cashierDifferences(expected: MethodCents, counted: MethodCents): MethodDifference[] {
  return CASHIER_COUNT_METHODS.map(method => ({
    method,
    expectedCents: expected[method],
    countedCents: counted[method],
    differenceCents: counted[method] - expected[method]
  }));
}

/** The cash the cashier hands over: what they counted less the float they keep back */
export const handOverCents = (countedCashCents: number, floatOutCents: number): number => countedCashCents - floatOutCents;

export interface CashierCountDraft {
  floatInCents: number | null;
  counted: Record<CashierCountMethod, number | null>;
  floatOutCents: number | null;
  notes: string;
}

/**
 * A cashier's count before it is saved: every amount given (0 is a valid amount), the float kept back no more than the
 * cash counted, and a note when anything is over or short (an unexplained difference is what an auditor asks about).
 */
export function checkCashierCount(draft: CashierCountDraft, expectedWithoutFloat: Pick<CashierLine, 'byMethod' | 'expectedCashCents'> | null): RuleResult {
  const isAmount = (value: number | null): value is number => value !== null && Number.isInteger(value) && value >= 0;
  if (!isAmount(draft.floatInCents)) return fail('Enter the float you started with (0 if none).');
  for (const method of CASHIER_COUNT_METHODS) {
    if (!isAmount(draft.counted[method])) return fail(`Enter the ${COUNT_PROMPTS[method]} (0 if none).`);
  }
  if (!isAmount(draft.floatOutCents)) return fail('Enter the float you keep in the till for tomorrow (0 if none).');
  if (draft.floatOutCents > (draft.counted.cash as number)) {
    return fail(`The float kept back (${nad(draft.floatOutCents)}) is more than the cash counted (${nad(draft.counted.cash as number)}).`);
  }
  const differences = cashierDifferences(cashierExpected(expectedWithoutFloat, draft.floatInCents), draft.counted as MethodCents);
  const off = differences.filter(difference => difference.differenceCents !== 0);
  if (off.length > 0 && !draft.notes.trim()) {
    const first = off[0];
    return fail(`${CASHIER_METHOD_LABELS[first.method]} is ${first.differenceCents > 0 ? 'over' : 'short'} by ${nad(Math.abs(first.differenceCents))}. Say why in the note.`);
  }
  if (draft.notes.trim().length > 500) return fail('Keep the note to 500 characters.');
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Saved counts
// ---------------------------------------------------------------------------------------------

export interface CashierCashUp {
  id: string;
  dateKey: string;
  cashierId: string;
  floatInCents: number;
  floatOutCents: number;
  expected: MethodCents;
  counted: MethodCents;
  notes: string | null;
  countedAt: string | null;
  /** A later count by the same cashier for the same day replaced this one */
  supersededAt: string | null;
}

export interface RawCashierCashUpRow {
  id: string;
  business_date?: string | null;
  cashier_id?: string | null;
  float_in?: number | string | null;
  float_out?: number | string | null;
  expected_cash?: number | string | null;
  expected_card?: number | string | null;
  expected_eft?: number | string | null;
  counted_cash?: number | string | null;
  counted_card?: number | string | null;
  counted_eft?: number | string | null;
  notes?: string | null;
  counted_at?: string | null;
  superseded_at?: string | null;
}

export function normalizeCashierCashUp(row: RawCashierCashUpRow): CashierCashUp | null {
  const dateKey = dateKeyFrom(row.business_date);
  if (!dateKey || !row.cashier_id) return null;
  return {
    id: row.id,
    dateKey,
    cashierId: row.cashier_id,
    floatInCents: toCents(row.float_in),
    floatOutCents: toCents(row.float_out),
    expected: { cash: toCents(row.expected_cash), card: toCents(row.expected_card), eft: toCents(row.expected_eft) },
    counted: { cash: toCents(row.counted_cash), card: toCents(row.counted_card), eft: toCents(row.counted_eft) },
    notes: row.notes?.trim() || null,
    countedAt: row.counted_at ?? null,
    supersededAt: row.superseded_at ?? null
  };
}

/** The count that stands for each cashier: the latest one not replaced */
export function standingCashierCounts(records: readonly CashierCashUp[]): Map<string, CashierCashUp> {
  const byCashier = new Map<string, CashierCashUp>();
  for (const record of records) {
    if (record.supersededAt) continue;
    const current = byCashier.get(record.cashierId);
    if (!current || (record.countedAt ?? '') > (current.countedAt ?? '')) byCashier.set(record.cashierId, record);
  }
  return byCashier;
}

export interface CashierDayRow {
  cashierId: string;
  /** Has takings in the system for the day */
  tookMoney: boolean;
  count: CashierCashUp | null;
  /** Expected from the receipts now (the count keeps what was expected when it was made) */
  expectedNow: MethodCents;
  /** Total over (+) or short (-) of the standing count, all methods */
  differenceCents: number | null;
}

/**
 * Every cashier of the day for the administrator: those who took money and those who counted, with what each still
 * owes the sign-off. A cashier with takings but no count is "not cashed up".
 */
export function cashierDay(lines: readonly CashierLine[], records: readonly CashierCashUp[]): CashierDayRow[] {
  const counts = standingCashierCounts(records);
  const ids = new Set<string>([...lines.map(line => line.userId).filter((id): id is string => !!id), ...counts.keys()]);
  return [...ids].map(cashierId => {
    const line = lines.find(entry => entry.userId === cashierId) ?? null;
    const count = counts.get(cashierId) ?? null;
    const expectedNow = cashierExpected(line, count?.floatInCents ?? 0);
    const differenceCents = count
      ? CASHIER_COUNT_METHODS.reduce((sum, method) => sum + count.counted[method] - count.expected[method], 0)
      : null;
    return { cashierId, tookMoney: !!line && line.receiptCount + line.refundCents > 0, count, expectedNow, differenceCents };
  }).sort((a, b) => Number(!!a.count) - Number(!!b.count) || a.cashierId.localeCompare(b.cashierId));
}

/** Cashiers who took money on the day and have not cashed up yet: the administrator signs off once there are none */
export const cashiersStillToCount = (rows: readonly CashierDayRow[]): CashierDayRow[] => rows.filter(row => row.tookMoney && !row.count);

/** Whether the receipts changed after the cashier counted (a receipt captured later for that day, a reversal) */
export function changedSinceCount(row: CashierDayRow): boolean {
  const count = row.count;
  if (!count) return false;
  return CASHIER_COUNT_METHODS.some(method => count.expected[method] !== row.expectedNow[method]);
}

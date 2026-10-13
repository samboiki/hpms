import type { SupabaseClient } from '@supabase/supabase-js';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import {
  BANKABLE_METHODS,
  normalizeAdjustment,
  normalizeCashUp,
  normalizeDaybookEntry,
  normalizeDaybookPrint,
  normalizeDeposit,
  normalizeInvoice,
  normalizePeriodClose,
  normalizeReceipt,
  parseControlAggregates,
  type ArAdjustment,
  type ArReceipt,
  type BankDeposit,
  type CashUpRecord,
  type ControlAggregates,
  type DateRange,
  type DaybookEntry,
  type DaybookPrint,
  type LedgerInvoice,
  type PeriodClose,
  type RawAdjustmentRow,
  type RawCashUpRow,
  type RawDaybookPrintRow,
  type RawDaybookRow,
  type RawDepositItemRow,
  type RawDepositRow,
  type RawInvoiceRow,
  type RawPeriodCloseRow,
  type RawReceiptRow
} from '../../../services/ledgerService';
import { centsToAmountText } from '../receipts/arPayloads';
import { ADJUSTMENT_COLUMNS, INVOICE_COLUMNS, RECEIPT_COLUMNS, isArNotSetUp, loadStaffNames } from '../receipts/arService';
import { callRpc, errorText, fetchByIds, fetchPages, timed, type LoadState } from '../debtors/debtorsService';

/**
 * Supabase access for the daily and month-end controls: the entries of a day or month, cash-ups,
 * deposit slips, the daybook and month-end closes (proposals/2026-10-07-debtors-and-controls.sql).
 * Reads are practice-scoped; writes are dc_ function calls. Dates are local calendar days.
 */
const db = supabase as unknown as SupabaseClient;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const CASH_UP_COLUMNS = 'id, business_date, expected_cash, counted_cash, difference, totals, notes, closed_by, closed_at, superseded_at, superseded_by, supersede_reason';
const DEPOSIT_COLUMNS = 'id, deposit_number, status, prepared_on, deposited_on, bank_reference, amount, notes, prepared_by, prepared_at, deposited_by, cancelled_at, cancel_reason';
const DAYBOOK_COLUMNS =
  'entry_number, recorded_at, recorded_on, business_date, entry_type, adjustment_kind, document_number, related_document, invoice_id, receipt_id, patient_id, portion, method, amount, debtors_effect, actor';
const PRINT_COLUMNS = 'id, day, kind, copy_number, from_number, to_number, printed_by, printed_at';
const CLOSE_COLUMNS = 'id, period_month, closed_at, closed_by, notes, snapshot, closing_balance, reopened_at, reopened_by, reopen_reason';

function assertRange(range: DateRange): void {
  if (!DATE_KEY.test(range.startKey) || !DATE_KEY.test(range.endKey)) throw new Error('The selected days are not valid dates');
}

/** PostgREST "or" filter: a date column in the range, or a timestamp column within the same local days */
const dateOrTimestampIn = (dateColumn: string, timestampColumn: string, range: DateRange): string => {
  const from = startOfDay(parseISO(range.startKey)).toISOString();
  const to = endOfDay(parseISO(range.endKey)).toISOString();
  return `and(${dateColumn}.gte.${range.startKey},${dateColumn}.lte.${range.endKey}),and(${timestampColumn}.gte.${from},${timestampColumn}.lte.${to})`;
};

export interface LedgerEntries {
  /** Invoices dated in the range (what they bill now) */
  invoices: LedgerInvoice[];
  /** Receipts dated in the range or reversed in it */
  receipts: ArReceipt[];
  /** Adjustments (refunds included) dated in the range or reversed in it */
  adjustments: ArAdjustment[];
}

/** The entries behind the control totals of a range (a day, month to date, a month) */
export async function loadLedgerEntries(practiceId: string, range: DateRange): Promise<LedgerEntries> {
  assertRange(range);
  const createdFrom = startOfDay(parseISO(range.startKey)).toISOString();
  const createdTo = endOfDay(parseISO(range.endKey)).toISOString();
  const [invoiceRows, receiptRows, adjustmentRows] = await timed(Promise.all([
    fetchPages<RawInvoiceRow>('invoices', (from, to) => db
      .from('invoices_enhanced').select(INVOICE_COLUMNS).eq('practice_id', practiceId)
      .or(`and(issue_date.gte.${range.startKey},issue_date.lte.${range.endKey}),and(issue_date.is.null,created_at.gte.${createdFrom},created_at.lte.${createdTo})`)
      .order('id').range(from, to)),
    fetchPages<RawReceiptRow>('receipts', (from, to) => db
      .from('ar_receipt_balances').select(RECEIPT_COLUMNS).eq('practice_id', practiceId)
      .or(dateOrTimestampIn('received_on', 'reversed_at', range)).order('receipt_id').range(from, to)),
    fetchPages<RawAdjustmentRow>('adjustments', (from, to) => db
      .from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).eq('practice_id', practiceId)
      .or(dateOrTimestampIn('effective_on', 'reversed_at', range)).order('id').range(from, to))
  ]), 'the entries');
  return {
    invoices: invoiceRows.map(normalizeInvoice),
    receipts: receiptRows.map(normalizeReceipt),
    adjustments: adjustmentRows.map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null)
  };
}

// ---------------------------------------------------------------------------------------------
// Day end
// ---------------------------------------------------------------------------------------------

export interface DayEndData {
  state: LoadState;
  error: string | null;
  /** From the first of the month to the day: the day and month-to-date figures */
  entries: LedgerEntries;
  /** Every count of the day, the one in force first */
  cashUps: CashUpRecord[];
  /** The close that locks the day's month, if any */
  lockedBy: PeriodClose | null;
  staffNames: Record<string, string>;
}

const emptyEntries = (): LedgerEntries => ({ invoices: [], receipts: [], adjustments: [] });

export async function loadDayEnd(practiceId: string, dayKey: string): Promise<DayEndData> {
  try {
    const monthStart = `${dayKey.slice(0, 7)}-01`;
    const [entries, cashUpRows, closeRows] = await Promise.all([
      loadLedgerEntries(practiceId, { startKey: monthStart, endKey: dayKey }),
      timed(fetchPages<RawCashUpRow>('cash-ups', (from, to) => db
        .from('cash_ups').select(CASH_UP_COLUMNS).eq('practice_id', practiceId).eq('business_date', dayKey).order('closed_at', { ascending: false }).range(from, to)), 'cash-ups'),
      timed(fetchPages<RawPeriodCloseRow>('month-end closes', (from, to) => db
        .from('period_closes').select(CLOSE_COLUMNS).eq('practice_id', practiceId).eq('period_month', monthStart).is('reopened_at', null).range(from, to)), 'month-end closes')
    ]);
    const cashUps = cashUpRows.map(normalizeCashUp).filter((row): row is CashUpRecord => row !== null)
      .sort((a, b) => Number(!!a.supersededAt) - Number(!!b.supersededAt) || (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
    const people = [...entries.receipts.map(r => r.createdBy), ...entries.adjustments.map(a => a.createdBy), ...cashUps.map(c => c.closedBy)];
    const staffNames = await loadStaffNames(practiceId, people).catch(() => ({} as Record<string, string>));
    return {
      state: 'ready',
      error: null,
      entries,
      cashUps,
      lockedBy: closeRows.map(normalizePeriodClose).find((row): row is PeriodClose => row !== null) ?? null,
      staffNames
    };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', error: null, entries: emptyEntries(), cashUps: [], lockedBy: null, staffNames: {} };
    return { state: 'error', error: errorText(error, 'Could not load the day'), entries: emptyEntries(), cashUps: [], lockedBy: null, staffNames: {} };
  }
}

/** dc_record_cash_up: counted cash as exact text, the day's figures (cents) kept with it */
export const recordCashUp = (practiceId: string, dayKey: string, input: { countedCents: number; notes: string; totals: Record<string, number>; replaceReason: string }) =>
  callRpc<{ id: string; expected: number | string; counted: number | string; difference: number | string }>('dc_record_cash_up', {
    p_practice_id: practiceId,
    p_day: dayKey,
    p_payload: {
      counted: centsToAmountText(input.countedCents),
      notes: input.notes.trim() || null,
      totals: input.totals,
      replace_reason: input.replaceReason.trim() || null
    }
  }, 'Closing the day');

// ---------------------------------------------------------------------------------------------
// Deposit slips
// ---------------------------------------------------------------------------------------------

export interface DepositData {
  /** Standing cash receipts (and cash refunds) up to the day, any not banked yet among them */
  receipts: ArReceipt[];
  refunds: ArAdjustment[];
  /** Recent slips, newest first */
  deposits: BankDeposit[];
}

/**
 * What can still go to the bank: standing cash receipts and cash refunds not on a slip, and the
 * slips of the last months. Receipts on a slip that is not cancelled are excluded by
 * depositCandidates; the query keeps the list short by reading only cash.
 */
export async function loadDeposits(practiceId: string, sinceKey: string): Promise<DepositData> {
  const [receiptRows, refundRows, depositRows] = await timed(Promise.all([
    fetchPages<RawReceiptRow>('cash receipts', (from, to) => db
      .from('ar_receipt_balances').select(RECEIPT_COLUMNS).eq('practice_id', practiceId).in('method', [...BANKABLE_METHODS]).is('reversed_at', null)
      .gte('received_on', sinceKey).order('received_on').range(from, to)),
    fetchPages<RawAdjustmentRow>('cash refunds', (from, to) => db
      .from('invoice_adjustments').select(ADJUSTMENT_COLUMNS).eq('practice_id', practiceId).eq('kind', 'refund').eq('method', 'cash').is('reversed_at', null)
      .gte('effective_on', sinceKey).order('effective_on').range(from, to)),
    fetchPages<RawDepositRow>('deposit slips', (from, to) => db
      .from('bank_deposits').select(DEPOSIT_COLUMNS).eq('practice_id', practiceId).gte('prepared_on', sinceKey).order('prepared_at', { ascending: false }).range(from, to))
  ]), 'deposit slips');
  const itemRows = await timed(fetchByIds<RawDepositItemRow & { released_at?: string | null }>(depositRows.map(row => row.id), 'deposit slip lines', (ids, from, to) => db
    .from('bank_deposit_items').select('deposit_id, receipt_id, refund_id, released_at').in('deposit_id', ids).order('id').range(from, to)), 'deposit slips');
  return {
    receipts: receiptRows.map(normalizeReceipt),
    refunds: refundRows.map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null),
    deposits: depositRows.map(row => normalizeDeposit(row, itemRows))
  };
}

export const prepareDeposit = (practiceId: string, receiptIds: readonly string[], refundIds: readonly string[], notes: string) =>
  callRpc<{ id: string; number: string; amount: number | string }>('dc_prepare_deposit', {
    p_practice_id: practiceId,
    p_payload: { receipt_ids: receiptIds, refund_ids: refundIds, notes: notes.trim() || null }
  }, 'Preparing the deposit slip');

export const markDeposited = (depositId: string, bankReference: string, depositedOn: string) =>
  callRpc<{ id: string }>('dc_mark_deposited', { p_deposit_id: depositId, p_bank_reference: bankReference.trim(), p_deposited_on: depositedOn }, 'Marking the slip deposited');

export const cancelDeposit = (depositId: string, reason: string) =>
  callRpc<{ id: string }>('dc_cancel_deposit', { p_deposit_id: depositId, p_reason: reason.trim() }, 'Cancelling the slip');

// ---------------------------------------------------------------------------------------------
// Daybook
// ---------------------------------------------------------------------------------------------

export interface DaybookData {
  state: LoadState;
  error: string | null;
  entries: DaybookEntry[];
  prints: DaybookPrint[];
  staffNames: Record<string, string>;
}

/** The daybook of a day: numbers given first (dc_seal_daybook), so every entry shown has its number */
export async function loadDaybook(practiceId: string, dayKey: string): Promise<DaybookData> {
  try {
    if (!DATE_KEY.test(dayKey)) throw new Error('Choose a valid day');
    await callRpcRaw('dc_seal_daybook', { p_practice_id: practiceId }, 'the daybook');
    const [entryRows, printRows] = await timed(Promise.all([
      fetchPages<RawDaybookRow>('daybook', (from, to) => db
        .from('daybook_entries').select(DAYBOOK_COLUMNS).eq('practice_id', practiceId).eq('recorded_on', dayKey).not('entry_number', 'is', null)
        .order('entry_number').range(from, to)),
      fetchPages<RawDaybookPrintRow>('daybook prints', (from, to) => db
        .from('daybook_prints').select(PRINT_COLUMNS).eq('practice_id', practiceId).eq('day', dayKey).order('copy_number').range(from, to))
    ]), 'the daybook');
    const entries = entryRows.map(normalizeDaybookEntry).filter((row): row is DaybookEntry => row !== null);
    const prints = printRows.map(normalizeDaybookPrint).filter((row): row is DaybookPrint => row !== null);
    const staffNames = await loadStaffNames(practiceId, [...entries.map(entry => entry.actor), ...prints.map(print => print.printedBy)]).catch(() => ({} as Record<string, string>));
    return { state: 'ready', error: null, entries, prints, staffNames };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', error: null, entries: [], prints: [], staffNames: {} };
    return { state: 'error', error: errorText(error, 'Could not load the daybook'), entries: [], prints: [], staffNames: {} };
  }
}

/** A dc_ call whose "not set up" error must stay recognisable (it keeps the database's code) */
async function callRpcRaw(name: string, args: Record<string, unknown>, label: string): Promise<unknown> {
  const { data, error } = await timed(Promise.resolve(db.rpc(name, args)), label);
  if (error) throw Object.assign(new Error(error.message || `${name} failed`), { code: error.code });
  return data;
}

export const recordDaybookPrint = (practiceId: string, dayKey: string, kind: 'print' | 'export') =>
  callRpc<{ id: string; copy_number: number; from_number: number | null; to_number: number | null; entry_count: number; printed_at: string }>(
    'dc_record_daybook_print', { p_practice_id: practiceId, p_day: dayKey, p_kind: kind }, kind === 'print' ? 'Recording the print' : 'Recording the export');

// ---------------------------------------------------------------------------------------------
// Month end
// ---------------------------------------------------------------------------------------------

export interface MonthEndData {
  state: LoadState;
  error: string | null;
  /** Every close of the practice, newest month first (reopened ones included: they are the history) */
  closes: PeriodClose[];
  aggregates: ControlAggregates | null;
  entries: LedgerEntries;
  /** Standing receipts with money not allocated, received up to the month's last day */
  unallocated: ArReceipt[];
  /** Days of the month with a cash-up in force */
  cashedUpDays: Set<string>;
  staffNames: Record<string, string>;
}

export async function loadMonthEnd(practiceId: string, range: DateRange): Promise<MonthEndData> {
  const empty = { closes: [], aggregates: null, entries: emptyEntries(), unallocated: [], cashedUpDays: new Set<string>(), staffNames: {} };
  try {
    assertRange(range);
    const [closeRows, aggregates, entries, unallocatedRows, cashUpRows] = await Promise.all([
      timed(fetchPages<RawPeriodCloseRow>('month-end closes', (from, to) => db
        .from('period_closes').select(CLOSE_COLUMNS).eq('practice_id', practiceId).order('period_month', { ascending: false }).order('closed_at', { ascending: false }).range(from, to)), 'month-end closes'),
      callRpcRaw('dc_control_totals', { p_practice_id: practiceId, p_from: range.startKey, p_to: range.endKey }, 'the control totals'),
      loadLedgerEntries(practiceId, range),
      timed(fetchPages<RawReceiptRow>('unallocated receipts', (from, to) => db
        .from('ar_receipt_balances').select(RECEIPT_COLUMNS).eq('practice_id', practiceId).gt('unallocated', 0).lte('received_on', range.endKey)
        .order('received_on').range(from, to)), 'unallocated receipts'),
      timed(fetchPages<{ business_date: string }>('cash-ups', (from, to) => db
        .from('cash_ups').select('business_date').eq('practice_id', practiceId).is('superseded_at', null)
        .gte('business_date', range.startKey).lte('business_date', range.endKey).order('business_date').range(from, to)), 'cash-ups')
    ]);
    const closes = closeRows.map(normalizePeriodClose).filter((row): row is PeriodClose => row !== null);
    const staffNames = await loadStaffNames(practiceId, closes.flatMap(close => [close.closedBy, close.reopenedBy])).catch(() => ({} as Record<string, string>));
    return {
      state: 'ready',
      error: null,
      closes,
      aggregates: parseControlAggregates(aggregates),
      entries,
      unallocated: unallocatedRows.map(normalizeReceipt),
      cashedUpDays: new Set(cashUpRows.map(row => row.business_date)),
      staffNames
    };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', error: null, ...empty };
    return { state: 'error', error: errorText(error, 'Could not load the month end'), ...empty };
  }
}

/** The closes of a practice (for the Overview status), newest first; not_set_up before the proposal */
export async function loadCloses(practiceId: string): Promise<{ state: LoadState; closes: PeriodClose[] }> {
  try {
    const rows = await timed(fetchPages<RawPeriodCloseRow>('month-end closes', (from, to) => db
      .from('period_closes').select(CLOSE_COLUMNS).eq('practice_id', practiceId).order('period_month', { ascending: false }).range(from, to)), 'month-end closes');
    return { state: 'ready', closes: rows.map(normalizePeriodClose).filter((row): row is PeriodClose => row !== null) };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', closes: [] };
    throw error;
  }
}

/** Days with a cash-up in force in a range (the Overview shows whether today is closed) */
export async function loadCashedUpDays(practiceId: string, range: DateRange): Promise<Set<string>> {
  assertRange(range);
  const rows = await timed(fetchPages<{ business_date: string }>('cash-ups', (from, to) => db
    .from('cash_ups').select('business_date').eq('practice_id', practiceId).is('superseded_at', null)
    .gte('business_date', range.startKey).lte('business_date', range.endKey).order('business_date').range(from, to)), 'cash-ups');
  return new Set(rows.map(row => row.business_date));
}

export const closePeriod = (practiceId: string, monthStartKey: string, payload: Record<string, unknown>) =>
  callRpc<{ id: string; closing_cents: number }>('dc_close_period', { p_practice_id: practiceId, p_month: monthStartKey, p_payload: payload }, 'Closing the month');

export const reopenPeriod = (practiceId: string, monthStartKey: string, reason: string) =>
  callRpc<{ id: string }>('dc_reopen_period', { p_practice_id: practiceId, p_month: monthStartKey, p_reason: reason.trim() }, 'Reopening the month');

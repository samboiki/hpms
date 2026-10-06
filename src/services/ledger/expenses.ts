import { fromCents, toAmount, toCents } from './money';
import { dateKeyFrom, isInRange, monthKeyOf, monthKeysInRange, type DateRange } from './dates';
import { CANCELLED_ALIASES } from './invoices';

// ---------------------------------------------------------------------------------------------
// Practice expenses
// ---------------------------------------------------------------------------------------------

export interface RawExpenseRow {
  id: string;
  name?: string | null;
  expense_type?: string | null;
  expense_category?: string | null;
  amount?: number | string | null;
  expense_date?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  status?: string | null;
  vendor_name?: string | null;
  payment_method?: string | null;
  is_recurring?: boolean | null;
}

export interface LedgerExpense {
  id: string;
  name: string;
  type: string;
  category: string;
  amount: number;
  expenseDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  /** lower-case stored status: pending, paid, overdue, scheduled or cancelled */
  status: string;
  vendor: string | null;
  paymentMethod: string | null;
  isRecurring: boolean;
}

export function normalizeExpense(row: RawExpenseRow): LedgerExpense {
  const status = (row.status ?? '').trim().toLowerCase();
  return {
    id: row.id,
    name: row.name?.trim() || 'Unnamed expense',
    type: row.expense_type?.trim() || 'other',
    category: row.expense_category?.trim() || '',
    amount: toAmount(row.amount),
    expenseDate: dateKeyFrom(row.expense_date),
    dueDate: dateKeyFrom(row.due_date),
    paidDate: dateKeyFrom(row.paid_date),
    status: CANCELLED_ALIASES.includes(status) ? 'cancelled' : status || 'pending',
    vendor: row.vendor_name?.trim() || null,
    paymentMethod: row.payment_method?.trim() || null,
    isRecurring: !!row.is_recurring
  };
}

export const isExpenseCost = (expense: Pick<LedgerExpense, 'status'>): boolean => expense.status !== 'cancelled';
export const isExpenseUnpaid = (expense: Pick<LedgerExpense, 'status'>): boolean =>
  isExpenseCost(expense) && expense.status !== 'paid';

export interface ExpenseSummary {
  total: number;
  paid: number;
  unpaid: number;
  count: number;
  byType: { type: string; amount: number; count: number }[];
}

/** Expenses incurred in a range (by expense date), cancelled excluded. */
export function summarizeExpenses(expenses: LedgerExpense[], range: DateRange): ExpenseSummary {
  let total = 0, paid = 0, count = 0;
  const byType = new Map<string, { cents: number; count: number }>();
  for (const expense of expenses) {
    if (!isExpenseCost(expense) || !isInRange(expense.expenseDate, range)) continue;
    const cents = toCents(expense.amount);
    total += cents;
    if (expense.status === 'paid') paid += cents;
    count += 1;
    const group = byType.get(expense.type) ?? { cents: 0, count: 0 };
    group.cents += cents;
    group.count += 1;
    byType.set(expense.type, group);
  }
  return {
    total: fromCents(total),
    paid: fromCents(paid),
    unpaid: fromCents(total - paid),
    count,
    byType: [...byType.entries()]
      .map(([type, group]) => ({ type, amount: fromCents(group.cents), count: group.count }))
      .sort((a, b) => b.amount - a.amount || a.type.localeCompare(b.type))
  };
}

export interface ExpenseMonthRow {
  monthKey: string;
  total: number;
  paid: number;
  count: number;
}

export function expensesByMonth(expenses: LedgerExpense[], monthKeys: string[]): ExpenseMonthRow[] {
  const rows = new Map(monthKeys.map(key => [key, { total: 0, paid: 0, count: 0 }]));
  for (const expense of expenses) {
    const row = expense.expenseDate ? rows.get(monthKeyOf(expense.expenseDate)) : undefined;
    if (!row || !isExpenseCost(expense)) continue;
    row.total += toCents(expense.amount);
    if (expense.status === 'paid') row.paid += toCents(expense.amount);
    row.count += 1;
  }
  return monthKeys.map(monthKey => {
    const row = rows.get(monthKey)!;
    return { monthKey, total: fromCents(row.total), paid: fromCents(row.paid), count: row.count };
  });
}

export interface ExpenseTypeMonthRow {
  type: string;
  /** Amount per month, in the order of ExpenseTypesByMonth.monthKeys */
  byMonth: number[];
  total: number;
  count: number;
}

export interface ExpenseTypesByMonth {
  /** Every month the range touches, oldest first */
  monthKeys: string[];
  /** Largest type first */
  rows: ExpenseTypeMonthRow[];
  monthTotals: number[];
  total: number;
  count: number;
}

/** Expenses incurred in a range (by expense date) per type and month, cancelled excluded. */
export function expensesByTypeAndMonth(expenses: LedgerExpense[], range: DateRange): ExpenseTypesByMonth {
  const monthKeys = monthKeysInRange(range);
  const monthIndex = new Map(monthKeys.map((key, index) => [key, index]));
  const types = new Map<string, { byMonth: number[]; count: number }>();
  for (const expense of expenses) {
    if (!isExpenseCost(expense) || !expense.expenseDate || !isInRange(expense.expenseDate, range)) continue;
    const index = monthIndex.get(monthKeyOf(expense.expenseDate));
    if (index === undefined) continue;
    const group = types.get(expense.type) ?? { byMonth: monthKeys.map(() => 0), count: 0 };
    group.byMonth[index] += toCents(expense.amount);
    group.count += 1;
    types.set(expense.type, group);
  }
  const rows = [...types.entries()]
    .map(([type, group]) => ({ type, cents: group.byMonth.reduce((sum, cents) => sum + cents, 0), group }))
    .sort((a, b) => b.cents - a.cents || a.type.localeCompare(b.type));
  const monthCents = monthKeys.map((_, index) => rows.reduce((sum, row) => sum + row.group.byMonth[index], 0));
  return {
    monthKeys,
    rows: rows.map(row => ({ type: row.type, byMonth: row.group.byMonth.map(fromCents), total: fromCents(row.cents), count: row.group.count })),
    monthTotals: monthCents.map(fromCents),
    total: fromCents(rows.reduce((sum, row) => sum + row.cents, 0)),
    count: rows.reduce((sum, row) => sum + row.group.count, 0)
  };
}

export interface PayablesSummary {
  total: number;
  count: number;
  /** Unpaid with a due date before the as-at date, or marked overdue */
  overdue: number;
  overdueCount: number;
}

/** Unpaid practice expenses already incurred (expense date on or before the as-at date). */
export function accountsPayable(expenses: LedgerExpense[], asOfKey: string): PayablesSummary {
  let total = 0, count = 0, overdue = 0, overdueCount = 0;
  for (const expense of expenses) {
    if (!isExpenseUnpaid(expense)) continue;
    if (expense.expenseDate && expense.expenseDate > asOfKey) continue; // not incurred yet
    const cents = toCents(expense.amount);
    total += cents;
    count += 1;
    if (expense.status === 'overdue' || (!!expense.dueDate && expense.dueDate < asOfKey)) {
      overdue += cents;
      overdueCount += 1;
    }
  }
  return { total: fromCents(total), count, overdue: fromCents(overdue), overdueCount };
}

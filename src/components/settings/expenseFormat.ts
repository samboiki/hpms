import { format, isValid, parseISO } from 'date-fns';
import { formatAmount, formatNad } from '../../utils/billing/money';

/**
 * Display helpers for the Practice Expenses screen. Kept free of React so they can be unit tested.
 */

/** Expenses saved without a currency were entered with the form's default, NAD. */
export function expenseCurrency(currency?: string | null): string {
  const code = (currency ?? '').trim().toUpperCase();
  return code || 'NAD';
}

/**
 * An amount in the expense's own currency: "N$ 1,234.50" for Namibian dollars, otherwise the
 * currency code ("ZAR 1,234.50"), so a rand amount is never presented as N$.
 */
export function formatExpenseAmount(amount: number | null | undefined, currency?: string | null): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '-';
  const code = expenseCurrency(currency);
  return code === 'NAD' ? formatNad(amount) : `${code} ${formatAmount(amount)}`;
}

/** Label inside the amount box of the expense form: "N$" for NAD, otherwise the currency code. */
export function expenseCurrencyLabel(currency?: string | null): string {
  const code = expenseCurrency(currency);
  return code === 'NAD' ? 'N$' : code;
}

/**
 * Currencies other than NAD among the given expenses. The summary totals add every amount as
 * N$, so the screen names these currencies instead of silently relabelling them.
 */
export function nonNadCurrencies(expenses: ReadonlyArray<{ currency?: string | null }>): string[] {
  const codes = expenses.map(expense => expenseCurrency(expense.currency)).filter(code => code !== 'NAD');
  return Array.from(new Set(codes)).sort();
}

/**
 * Value for a date column or date input, from the LOCAL calendar day. `toISOString()` gives the
 * UTC day, which is the previous day between 00:00 and 02:00 in Namibia (UTC+2).
 */
export function toDateValue(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/** A 'yyyy-MM-dd' date column shown day-first ("06 Oct 2026"); '-' when empty or unreadable. */
export function formatExpenseDate(value?: string | null): string {
  if (!value) return '-';
  const date = parseISO(value.slice(0, 10));
  return isValid(date) ? format(date, 'dd MMM yyyy') : '-';
}

import { describe, it, expect } from 'vitest';
import {
  expenseCurrency,
  expenseCurrencyLabel,
  formatExpenseAmount,
  formatExpenseDate,
  nonNadCurrencies,
  toDateValue
} from '../expenseFormat';

describe('formatExpenseAmount', () => {
  it('shows Namibian dollar expenses as N$ with thousands separators, as on invoices', () => {
    expect(formatExpenseAmount(1234.5, 'NAD')).toBe('N$ 1,234.50');
  });

  it('keeps the currency code for rand expenses, so a ZAR bill is never presented as N$', () => {
    expect(formatExpenseAmount(1234.5, 'ZAR')).toBe('ZAR 1,234.50');
  });

  it('treats expenses saved without a currency as NAD, the form default', () => {
    expect(formatExpenseAmount(80, null)).toBe('N$ 80.00');
    expect(formatExpenseAmount(80, '')).toBe('N$ 80.00');
  });

  it('shows a dash instead of crashing the screen when an amount is missing or not a number', () => {
    expect(formatExpenseAmount(null, 'NAD')).toBe('-');
    expect(formatExpenseAmount(Number.NaN, 'NAD')).toBe('-');
  });
});

describe('currency labels', () => {
  it('labels the amount box N$ for NAD and with the code for other currencies', () => {
    expect(expenseCurrencyLabel('NAD')).toBe('N$');
    expect(expenseCurrencyLabel('ZAR')).toBe('ZAR');
  });

  it('normalises codes so "zar " and "ZAR" are the same currency', () => {
    expect(expenseCurrency(' zar ')).toBe('ZAR');
  });

  it('lists each non-NAD currency once, so the N$ totals can say which amounts they include', () => {
    expect(nonNadCurrencies([{ currency: 'ZAR' }, { currency: 'NAD' }, { currency: 'zar' }, { currency: null }])).toEqual(['ZAR']);
    expect(nonNadCurrencies([{ currency: 'NAD' }])).toEqual([]);
  });
});

describe('expense dates', () => {
  it('dates an expense entered just after midnight with the local day, not the previous UTC day', () => {
    // 00:30 local time on 6 October: toISOString() would give 5 October in Namibia (UTC+2)
    expect(toDateValue(new Date(2026, 9, 6, 0, 30))).toBe('2026-10-06');
  });

  it('shows due dates day-first, as Namibian staff read them', () => {
    expect(formatExpenseDate('2026-10-06')).toBe('06 Oct 2026');
  });

  it('shows a dash for empty or unreadable dates instead of throwing', () => {
    expect(formatExpenseDate(null)).toBe('-');
    expect(formatExpenseDate('not a date')).toBe('-');
  });
});

import { describe, it, expect } from 'vitest';
import {
  formatChange,
  formatDateKey,
  formatMonthKey,
  formatNad,
  formatNadCompact,
  formatPercent,
  formatRangeLabel,
  pluralize
} from '../financeFormat';

describe('formatNad (Namibian dollars, en-NA)', () => {
  it.each([
    [0, 'N$0.00'],
    [1234.5, 'N$1,234.50'],
    [1234567.891, 'N$1,234,567.89'],
    [-80, '-N$80.00'],
    [-0.001, 'N$0.00'],
    [Number.NaN, 'N$0.00']
  ])('%s -> %s', (amount, expected) => {
    expect(formatNad(amount)).toBe(expected);
  });
});

describe('formatNadCompact (chart axes)', () => {
  it.each([
    [950, 'N$950'],
    [12500, 'N$12.5k'],
    [1250000, 'N$1.3m'],
    [-4000, '-N$4k'],
    [0, 'N$0']
  ])('%s -> %s', (amount, expected) => {
    expect(formatNadCompact(amount)).toBe(expected);
  });
});

describe('percentages and changes', () => {
  it('shows a dash rather than 0% or NaN% when a share cannot be computed', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
    expect(formatPercent(0.4567)).toBe('45.7%');
  });

  it('signs changes so growth and decline read differently, and dashes a missing comparison', () => {
    expect(formatChange(12.44)).toBe('+12.4%');
    expect(formatChange(-3)).toBe('-3.0%');
    expect(formatChange(0)).toBe('0.0%');
    expect(formatChange(null)).toBe('—');
  });
});

describe('dates', () => {
  it('formats a date key as the stored calendar day (no UTC shift)', () => {
    expect(formatDateKey('2026-10-01')).toBe('1 Oct 2026');
    expect(formatDateKey(null)).toBe('—');
    expect(formatMonthKey('2026-02')).toBe('Feb 2026');
  });

  it.each([
    [{ startKey: '2026-10-06', endKey: '2026-10-06' }, '6 Oct 2026'],
    [{ startKey: '2026-10-01', endKey: '2026-10-06' }, '1–6 Oct 2026'],
    [{ startKey: '2026-08-01', endKey: '2026-10-06' }, '1 Aug – 6 Oct 2026'],
    [{ startKey: '2025-11-01', endKey: '2026-10-06' }, '1 Nov 2025 – 6 Oct 2026']
  ])('labels %j as "%s"', (range, expected) => {
    expect(formatRangeLabel(range)).toBe(expected);
  });

  it('pluralizes counts', () => {
    expect(pluralize(1, 'invoice')).toBe('1 invoice');
    expect(pluralize(1200, 'invoice')).toBe('1,200 invoices');
  });
});

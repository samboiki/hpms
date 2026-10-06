/** Ledger rules: money, statuses, funder split, local dates and periods, summary and filtering */
import { describe, it, expect } from 'vitest';
import { addDays, getDaysInMonth, format } from 'date-fns';
import {
  buildFinanceSummary,
  dateKeyFrom,
  daysBetween,
  filterInvoices,
  fromCents,
  getPeriodRanges,
  hasUnrecognisedStatus,
  monthKeysEndingAt,
  monthKeysInRange,
  normalizeInvoice,
  normalizeInvoiceStatus,
  percentChange,
  shareOf,
  shiftDateKeyByMonths,
  splitByFunder,
  sumAmounts,
  toCents,
  toDateKey,
  type DateRange,
  type InvoiceStatus,
  type PeriodPreset
} from '../ledgerService';
import { invoice, seededRandom, cents } from './ledgerTestUtils';

// ---------------------------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------------------------

describe('money helpers', () => {
  it.each([
    [100, 10000],
    ['250.50', 25050],
    ['12.34', 1234],
    [0.1, 10],
    [null, 0],
    [undefined, 0],
    ['not a number', 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [true, 0]
  ])('toCents(%s) = %s (numeric columns arrive as strings; junk is never NaN on screen)', (value, expected) => {
    expect(toCents(value)).toBe(expected);
  });

  it('never produces negative zero, which would render as "-N$0.00"', () => {
    expect(Object.is(toCents(-0.001), 0)).toBe(true);
    expect(Object.is(fromCents(toCents(-0.004)), 0)).toBe(true);
  });

  it('sums in cents so totals are exact (0.1 + 0.2 must be 0.30, not 0.30000000000000004)', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts(Array.from({ length: 1000 }, () => 0.01))).toBe(10);
  });

  it.each([
    [110, 100, 10],
    [90, 100, -10],
    [100, 0, null],
    [0, 0, null],
    [-50, -100, 50],
    [50, -100, 150],
    [0, 200, -100]
  ])('percentChange(%s, %s) = %s (no percentage against a zero base)', (current, previous, expected) => {
    const result = percentChange(current, previous);
    if (expected === null) expect(result).toBeNull();
    else expect(result).toBeCloseTo(expected, 10);
  });

  it('shareOf returns null instead of dividing by zero', () => {
    expect(shareOf(5, 0)).toBeNull();
    expect(shareOf(25, 100)).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------------------------
// Statuses and normalisation
// ---------------------------------------------------------------------------------------------

describe('invoice status rules', () => {
  it.each<[string | null, InvoiceStatus]>([
    ['paid', 'paid'],
    ['PAID', 'paid'],
    [' Paid ', 'paid'],
    ['pending', 'pending'],
    ['overdue', 'overdue'],
    ['Overdue', 'overdue'],
    ['cancelled', 'cancelled'],
    ['canceled', 'cancelled'],
    ['void', 'cancelled'],
    [null, 'pending'],
    ['', 'pending'],
    ['partial', 'pending'],
    ['draft', 'pending'],
    ['submitted', 'pending']
  ])('"%s" is treated as %s (only paid and cancelled are final; anything else is still owed)', (raw, expected) => {
    expect(normalizeInvoiceStatus(raw)).toBe(expected);
  });

  it.each([
    ['partial', true],
    ['submitted', true],
    ['paid', false],
    ['Canceled', false],
    [null, false],
    ['', false]
  ])('flags "%s" as an unrecognised status: %s (so the page can say how many were treated as unpaid)', (raw, expected) => {
    expect(hasUnrecognisedStatus({ rawStatus: raw })).toBe(expected);
  });

  it('normalises a raw invoices_enhanced row: string amounts, local dates and a fallback invoice number', () => {
    const result = normalizeInvoice({
      id: 'abcdef12-3456',
      invoice_number: null,
      total: '450.50',
      medical_aid_total: '300',
      patient_total: '150.50',
      payment_status: 'Paid',
      issue_date: '2026-10-01',
      due_date: '2026-10-31',
      payment_method: ' card '
    });
    expect(result).toMatchObject({
      invoiceNumber: 'abcdef12',
      total: 450.5,
      medicalAidTotal: 300,
      status: 'paid',
      rawStatus: 'Paid',
      paymentMethod: 'card',
      issueDate: '2026-10-01'
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Funder split
// ---------------------------------------------------------------------------------------------

describe('splitByFunder: the medical aid owes its portion, the patient owes the rest', () => {
  it.each([
    [100, 100, 100, 0],
    [100, 40, 40, 60],
    [100, 0, 0, 100],
    [100, 150, 100, 0],
    [100, -20, 0, 100],
    [0, 0, 0, 0],
    [-50, 10, 0, -50],
    [99.99, 33.33, 33.33, 66.66]
  ])('total %s with medical aid %s -> medical aid %s, patient %s', (total, medicalAidTotal, medicalAid, patient) => {
    expect(splitByFunder({ total, medicalAidTotal })).toEqual({ medicalAid, patient });
  });

  const random = seededRandom(42);
  const generated = Array.from({ length: 120 }, () => {
    const total = Math.floor(random() * 1000000) / 100;
    const medicalAidTotal = Math.floor((random() * 1.6 - 0.3) * total * 100) / 100;
    return [total, medicalAidTotal] as const;
  });

  it.each(generated)('generated: total %s / medical aid %s always splits back to the total, within bounds', (total, medicalAidTotal) => {
    const split = splitByFunder({ total, medicalAidTotal });
    expect(cents(split.medicalAid) + cents(split.patient)).toBe(cents(total));
    expect(split.medicalAid).toBeGreaterThanOrEqual(0);
    expect(split.medicalAid).toBeLessThanOrEqual(total);
  });
});

// ---------------------------------------------------------------------------------------------
// Local dates and periods
// ---------------------------------------------------------------------------------------------

describe('local calendar dates', () => {
  it('keeps DATE columns as the stored calendar day', () => {
    expect(dateKeyFrom('2026-10-01')).toBe('2026-10-01');
  });

  it('puts a timestamp just after local midnight on the local day, not the UTC day', () => {
    const justAfterMidnight = new Date(2026, 9, 1, 0, 30);
    expect(dateKeyFrom(justAfterMidnight.toISOString())).toBe('2026-10-01');
    expect(toDateKey(justAfterMidnight)).toBe('2026-10-01');
  });

  it('keeps a late-evening timestamp on its own local day', () => {
    expect(dateKeyFrom(new Date(2026, 8, 30, 23, 45).toISOString())).toBe('2026-09-30');
  });

  it.each([null, undefined, '', 'not a date', '2026-02-30', '2026-13-01'])('rejects %s instead of inventing a date', value => {
    expect(dateKeyFrom(value)).toBeNull();
  });

  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(daysBetween('2026-10-31', '2026-10-01')).toBe(-30);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it.each([
    ['2026-09-30', -1, '2026-08-31'],
    ['2026-03-30', -1, '2026-02-28'],
    ['2026-03-31', -1, '2026-02-28'],
    ['2028-03-31', -1, '2028-02-29'],
    ['2026-10-06', -12, '2025-10-06'],
    ['2028-02-29', -12, '2027-02-28'],
    ['2026-01-15', -1, '2025-12-15']
  ])('shiftDateKeyByMonths(%s, %s) = %s (month-ends map to month-ends, other days clamp)', (key, months, expected) => {
    expect(shiftDateKeyByMonths(key, months)).toBe(expected);
  });

  it('lists trend months oldest first, ending with the period end month', () => {
    expect(monthKeysEndingAt('2026-10-06', 12)).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'
    ]);
    expect(monthKeysEndingAt('2026-01-31', 3)).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('lists every month a range touches', () => {
    expect(monthKeysInRange({ startKey: '2025-11-15', endKey: '2026-02-01' })).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthKeysInRange({ startKey: '2026-10-01', endKey: '2026-10-06' })).toEqual(['2026-10']);
  });
});

describe('getPeriodRanges: current period and the like-for-like comparison period', () => {
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0);

  it.each<[string, Date, PeriodPreset, DateRange, DateRange]>([
    ['mid October', at(2026, 10, 6), 'this_month', { startKey: '2026-10-01', endKey: '2026-10-06' }, { startKey: '2026-09-01', endKey: '2026-09-06' }],
    ['mid October', at(2026, 10, 6), 'last_month', { startKey: '2026-09-01', endKey: '2026-09-30' }, { startKey: '2026-08-01', endKey: '2026-08-31' }],
    ['mid October', at(2026, 10, 6), 'last_3_months', { startKey: '2026-08-01', endKey: '2026-10-06' }, { startKey: '2026-05-01', endKey: '2026-07-06' }],
    ['mid October', at(2026, 10, 6), 'last_12_months', { startKey: '2025-11-01', endKey: '2026-10-06' }, { startKey: '2024-11-01', endKey: '2025-10-06' }],
    ['mid October', at(2026, 10, 6), 'this_year', { startKey: '2026-01-01', endKey: '2026-10-06' }, { startKey: '2025-01-01', endKey: '2025-10-06' }],
    ['mid January', at(2026, 1, 15), 'this_month', { startKey: '2026-01-01', endKey: '2026-01-15' }, { startKey: '2025-12-01', endKey: '2025-12-15' }],
    ['mid January', at(2026, 1, 15), 'last_month', { startKey: '2025-12-01', endKey: '2025-12-31' }, { startKey: '2025-11-01', endKey: '2025-11-30' }],
    ['31 March', at(2026, 3, 31), 'this_month', { startKey: '2026-03-01', endKey: '2026-03-31' }, { startKey: '2026-02-01', endKey: '2026-02-28' }],
    ['30 March', at(2026, 3, 30), 'this_month', { startKey: '2026-03-01', endKey: '2026-03-30' }, { startKey: '2026-02-01', endKey: '2026-02-28' }],
    ['leap day', at(2028, 2, 29), 'this_year', { startKey: '2028-01-01', endKey: '2028-02-29' }, { startKey: '2027-01-01', endKey: '2027-02-28' }],
    ['leap day', at(2028, 2, 29), 'this_month', { startKey: '2028-02-01', endKey: '2028-02-29' }, { startKey: '2028-01-01', endKey: '2028-01-31' }],
    ['local midnight on 1 Oct', at(2026, 10, 1, 0), 'this_month', { startKey: '2026-10-01', endKey: '2026-10-01' }, { startKey: '2026-09-01', endKey: '2026-09-01' }],
    ['New Year\'s Eve late', at(2026, 12, 31, 23), 'last_month', { startKey: '2026-11-01', endKey: '2026-11-30' }, { startKey: '2026-10-01', endKey: '2026-10-31' }]
  ])('%s, %s', (_label, now, preset, current, previous) => {
    expect(getPeriodRanges({ preset }, now)).toEqual({ preset, current, previous });
  });

  it('compares a custom range with the same number of days immediately before it', () => {
    const ranges = getPeriodRanges({ preset: 'custom', custom: { startKey: '2026-09-10', endKey: '2026-09-19' } }, at(2026, 10, 6));
    expect(ranges.current).toEqual({ startKey: '2026-09-10', endKey: '2026-09-19' });
    expect(ranges.previous).toEqual({ startKey: '2026-08-31', endKey: '2026-09-09' });
  });

  it('orders a custom range entered back to front and falls back to this month when a date is invalid', () => {
    expect(getPeriodRanges({ preset: 'custom', custom: { startKey: '2026-09-19', endKey: '2026-09-10' } }, at(2026, 10, 6)).current)
      .toEqual({ startKey: '2026-09-10', endKey: '2026-09-19' });
    expect(getPeriodRanges({ preset: 'custom', custom: { startKey: 'bad', endKey: '2026-09-10' } }, at(2026, 10, 6)).current)
      .toEqual({ startKey: '2026-10-01', endKey: '2026-10-06' });
  });

  const everyDayOf2026 = Array.from({ length: 365 }, (_, i) => addDays(new Date(2026, 0, 1, 12), i));
  it.each(everyDayOf2026.map(day => [format(day, 'yyyy-MM-dd'), day] as const))(
    'this month on %s: starts on the 1st, ends today, and compares with the same days of the previous month',
    (todayKey, now) => {
      const { current, previous } = getPeriodRanges({ preset: 'this_month' }, now);
      expect(current).toEqual({ startKey: `${todayKey.slice(0, 7)}-01`, endKey: todayKey });
      expect(previous.startKey.endsWith('-01')).toBe(true);
      expect(previous.endKey < current.startKey).toBe(true);
      expect(daysBetween(previous.startKey, current.startKey)).toBeGreaterThanOrEqual(28);
      const previousMonthDays = getDaysInMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const isMonthEnd = now.getDate() === getDaysInMonth(now);
      const expectedDay = isMonthEnd ? previousMonthDays : Math.min(now.getDate(), previousMonthDays);
      expect(Number(previous.endKey.slice(8))).toBe(expectedDay);
    }
  );
});

// ---------------------------------------------------------------------------------------------
// Summary and filtering
// ---------------------------------------------------------------------------------------------

describe('buildFinanceSummary', () => {
  it('computes the net result exactly in cents', () => {
    expect(buildFinanceSummary({ income: 1000.1, practiceExpenses: 200.2, payroll: 300.3, receivables: 50, payables: 20, inventory: 10 }).netResult)
      .toBe(499.6);
  });

  it.each([
    [null, 100],
    [100, null],
    [null, null]
  ])('has no net result when expenses (%s) or payroll (%s) could not be loaded; a missing figure is not zero', (practiceExpenses, payroll) => {
    expect(buildFinanceSummary({ income: 1000, practiceExpenses, payroll, receivables: 0, payables: null, inventory: null }).netResult).toBeNull();
  });
});

describe('filterInvoices', () => {
  const invoices = [
    invoice({ id: 'ma', invoiceNumber: 'INV-100', patientId: 'p1', total: 100, medicalAidTotal: 100, issueDate: '2026-10-01' }),
    invoice({ id: 'split', invoiceNumber: 'INV-101', patientId: 'p2', total: 100, medicalAidTotal: 40, issueDate: '2026-10-03', status: 'paid' }),
    invoice({ id: 'self', invoiceNumber: 'INV-102', patientId: 'p3', total: 100, medicalAidTotal: 0, issueDate: '2026-09-15', status: 'cancelled' })
  ];
  const names = { p1: 'Ndapewa Shilongo', p2: 'Johannes Nghifikwa', p3: 'Maria Garises' };
  const all = { status: 'all' as const, funder: 'all' as const, search: '', range: null };

  it('lists newest first', () => {
    expect(filterInvoices(invoices, all, names).map(i => i.id)).toEqual(['split', 'ma', 'self']);
  });

  it('shows an invoice split between funders under both funder filters', () => {
    expect(filterInvoices(invoices, { ...all, funder: 'medical_aid' }, names).map(i => i.id)).toEqual(['split', 'ma']);
    expect(filterInvoices(invoices, { ...all, funder: 'patient' }, names).map(i => i.id)).toEqual(['split', 'self']);
  });

  it('filters by status, date range and a case-insensitive search on number or patient name', () => {
    expect(filterInvoices(invoices, { ...all, status: 'cancelled' }, names).map(i => i.id)).toEqual(['self']);
    expect(filterInvoices(invoices, { ...all, range: { startKey: '2026-10-01', endKey: '2026-10-31' } }, names).map(i => i.id)).toEqual(['split', 'ma']);
    expect(filterInvoices(invoices, { ...all, search: 'shilongo' }, names).map(i => i.id)).toEqual(['ma']);
    expect(filterInvoices(invoices, { ...all, search: 'inv-102' }, names).map(i => i.id)).toEqual(['self']);
  });
});

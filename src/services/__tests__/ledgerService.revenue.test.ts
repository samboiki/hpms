/** Ledger rules: revenue, collections, receivables aging, payer mix and tariff codes */
import { describe, it, expect } from 'vitest';
import {
  AGING_BUCKETS,
  agingBucketFor,
  buildAgingReport,
  collectionsByMethod,
  monthKeysInRange,
  monthlyRevenue,
  normalizeLineItem,
  normalizePaymentMethod,
  payerMix,
  receivablesByScheme,
  reconcileLineItems,
  revenueByTariffCode,
  sumAmounts,
  summarizeByStatus,
  summarizeCollections,
  summarizeRevenue,
  UNKNOWN_SCHEME,
  type AgingBucket,
  type DateRange
} from '../ledgerService';
import { invoice, line, randomInvoices, cents } from './ledgerTestUtils';

// ---------------------------------------------------------------------------------------------
// Revenue, collections, trend
// ---------------------------------------------------------------------------------------------

describe('summarizeRevenue', () => {
  const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };

  it('excludes cancelled invoices from revenue (a void invoice was never earned) but reports them', () => {
    const result = summarizeRevenue([
      invoice({ total: 100, status: 'pending' }),
      invoice({ total: 40, status: 'paid' }),
      invoice({ total: 999, status: 'cancelled' })
    ], october);
    expect(result.billed).toBe(140);
    expect(result.invoiceCount).toBe(2);
    expect(result.cancelledCount).toBe(1);
    expect(result.cancelledAmount).toBe(999);
  });

  it('includes both boundary days and nothing outside them', () => {
    const result = summarizeRevenue([
      invoice({ issueDate: '2026-09-30', total: 1 }),
      invoice({ issueDate: '2026-10-01', total: 10 }),
      invoice({ issueDate: '2026-10-31', total: 100 }),
      invoice({ issueDate: '2026-11-01', total: 1000 })
    ], october);
    expect(result.billed).toBe(110);
  });

  it('uses the local creation day when an invoice has no issue date', () => {
    const createdAt = new Date(2026, 9, 1, 0, 30).toISOString(); // 30 Sep in UTC
    const result = summarizeRevenue([invoice({ issueDate: null, createdAt, total: 75 })], october);
    expect(result.billed).toBe(75);
  });

  it('splits revenue by funder so medical aid + patient = billed', () => {
    const result = summarizeRevenue([
      invoice({ total: 300, medicalAidTotal: 300 }),
      invoice({ total: 200, medicalAidTotal: 50 }),
      invoice({ total: 80, medicalAidTotal: 0 })
    ], october);
    expect(result).toMatchObject({ billed: 580, medicalAid: 350, patient: 230 });
  });

  it('averages to the cent and returns explicit zeros (not NaN) for an empty period', () => {
    expect(summarizeRevenue([invoice({ total: 100 }), invoice({ total: 50 }), invoice({ total: 50.01 })], october).averageInvoice).toBe(66.67);
    expect(summarizeRevenue([], october)).toEqual({
      billed: 0, medicalAid: 0, patient: 0, invoiceCount: 0, averageInvoice: 0, cancelledCount: 0, cancelledAmount: 0
    });
  });
});

describe('summarizeCollections', () => {
  const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };

  it('counts only paid invoices as collected; pending, overdue and cancelled are not cash', () => {
    const result = summarizeCollections([
      invoice({ total: 100, status: 'paid', medicalAidTotal: 60 }),
      invoice({ total: 50, status: 'pending' }),
      invoice({ total: 25, status: 'overdue' }),
      invoice({ total: 500, status: 'cancelled' })
    ], october);
    expect(result).toMatchObject({ collected: 100, count: 1, medicalAid: 60, patient: 40 });
    expect(result.collectionRate).toBeCloseTo(100 / 175, 10);
  });

  it('has no collection rate when nothing was billed', () => {
    expect(summarizeCollections([], october).collectionRate).toBeNull();
  });

  it('ignores paid invoices issued outside the period', () => {
    expect(summarizeCollections([invoice({ status: 'paid', issueDate: '2026-09-30' })], october).collected).toBe(0);
  });
});

describe('monthlyRevenue', () => {
  it('returns a row for every month, including months without invoices, so the chart shows real gaps', () => {
    const rows = monthlyRevenue([invoice({ issueDate: '2026-10-02', total: 20 })], ['2026-08', '2026-09', '2026-10']);
    expect(rows.map(r => [r.monthKey, r.billed, r.invoiceCount])).toEqual([['2026-08', 0, 0], ['2026-09', 0, 0], ['2026-10', 20, 1]]);
  });

  it('excludes cancelled invoices and reports the paid subset as collected', () => {
    const [row] = monthlyRevenue([
      invoice({ issueDate: '2026-10-02', total: 100, status: 'paid' }),
      invoice({ issueDate: '2026-10-03', total: 30, status: 'pending' }),
      invoice({ issueDate: '2026-10-04', total: 70, status: 'cancelled' })
    ], ['2026-10']);
    expect(row).toMatchObject({ billed: 130, collected: 100, invoiceCount: 2 });
  });

  it('adds up to the period revenue (generated invoices)', () => {
    const invoices = randomInvoices(400, 7);
    const months = monthKeysInRange({ startKey: '2025-01-01', endKey: '2026-12-31' });
    const monthly = monthlyRevenue(invoices, months);
    const whole = summarizeRevenue(invoices, { startKey: '2025-01-01', endKey: '2026-12-31' });
    expect(sumAmounts(monthly.map(r => r.billed))).toBe(whole.billed);
    expect(sumAmounts(monthly.map(r => r.medicalAid))).toBe(whole.medicalAid);
    expect(monthly.reduce((n, r) => n + r.invoiceCount, 0)).toBe(whole.invoiceCount);
  });
});

describe('summarizeByStatus', () => {
  it('counts and totals each status', () => {
    expect(summarizeByStatus([
      invoice({ status: 'paid', total: 10 }),
      invoice({ status: 'paid', total: 5.5 }),
      invoice({ status: 'cancelled', total: 1 })
    ])).toEqual({
      pending: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
      paid: { count: 2, amount: 15.5 },
      cancelled: { count: 1, amount: 1 }
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Accounts receivable aging
// ---------------------------------------------------------------------------------------------

describe('agingBucketFor: days past due', () => {
  it.each<[number, AgingBucket]>([
    [-365, 'not_due'],
    [-1, 'not_due'],
    [0, 'days_0_30'],
    [1, 'days_0_30'],
    [30, 'days_0_30'],
    [31, 'days_31_60'],
    [60, 'days_31_60'],
    [61, 'days_61_90'],
    [90, 'days_61_90'],
    [91, 'days_over_90'],
    [400, 'days_over_90']
  ])('%s days past due -> %s', (days, bucket) => {
    expect(agingBucketFor(days)).toBe(bucket);
  });

  const bucketOrder = AGING_BUCKETS.map(b => b.key);
  const days = Array.from({ length: 181 }, (_, i) => i - 40);
  it.each(days)('day %s falls in exactly one bucket and buckets never go backwards as days increase', day => {
    const index = bucketOrder.indexOf(agingBucketFor(day));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(bucketOrder.indexOf(agingBucketFor(day + 1))).toBeGreaterThanOrEqual(index);
  });
});

describe('buildAgingReport', () => {
  const asOf = '2026-10-06';

  it('never treats paid or cancelled invoices as receivables', () => {
    const report = buildAgingReport([
      invoice({ status: 'paid', total: 100 }),
      invoice({ status: 'cancelled', total: 100 }),
      invoice({ status: 'pending', total: 30 })
    ], asOf);
    expect(report.total).toBe(30);
    expect(report.count).toBe(1);
  });

  it('ages by due date, not by the stored status label', () => {
    const report = buildAgingReport([
      invoice({ status: 'overdue', dueDate: '2026-10-07', total: 10 }),
      invoice({ status: 'pending', dueDate: '2026-06-01', total: 20 })
    ], asOf);
    expect(report.byBucket.not_due.amount).toBe(10);
    expect(report.byBucket.days_over_90.amount).toBe(20);
  });

  it.each<[string, AgingBucket]>([
    ['2026-10-07', 'not_due'],
    ['2026-10-06', 'days_0_30'],
    ['2026-09-06', 'days_0_30'],
    ['2026-09-05', 'days_31_60'],
    ['2026-08-07', 'days_31_60'],
    ['2026-08-06', 'days_61_90'],
    ['2026-07-08', 'days_61_90'],
    ['2026-07-07', 'days_over_90']
  ])('an invoice due on %s is in %s as at 6 Oct 2026', (dueDate, bucket) => {
    expect(buildAgingReport([invoice({ dueDate })], asOf).items[0].bucket).toBe(bucket);
  });

  it('falls back to the issue date (due on receipt) when there is no due date', () => {
    const report = buildAgingReport([invoice({ dueDate: null, issueDate: '2026-08-01' })], asOf);
    expect(report.items[0].daysPastDue).toBe(66);
    expect(report.items[0].bucket).toBe('days_61_90');
  });

  it('keeps an undated invoice as a receivable in the oldest bucket and counts it as undated', () => {
    const report = buildAgingReport([invoice({ dueDate: null, issueDate: null, createdAt: null, total: 12 })], asOf);
    expect(report.byBucket.days_over_90.amount).toBe(12);
    expect(report.undatedCount).toBe(1);
  });

  it('skips zero-value invoices: nothing is owed on them', () => {
    expect(buildAgingReport([invoice({ total: 0 })], asOf).count).toBe(0);
  });

  it('splits every bucket by funder and reports past due as everything except not-yet-due', () => {
    const report = buildAgingReport([
      invoice({ dueDate: '2026-10-20', total: 100, medicalAidTotal: 100 }),
      invoice({ dueDate: '2026-09-20', total: 50, medicalAidTotal: 30 }),
      invoice({ dueDate: '2026-05-01', total: 25 })
    ], asOf);
    expect(report.byBucket.not_due).toEqual({ amount: 100, medicalAid: 100, patient: 0, count: 1 });
    expect(report.byBucket.days_0_30).toEqual({ amount: 50, medicalAid: 30, patient: 20, count: 1 });
    expect(report.byBucket.days_over_90).toEqual({ amount: 25, medicalAid: 0, patient: 25, count: 1 });
    expect(report).toMatchObject({ total: 175, medicalAid: 130, patient: 45, pastDue: 75 });
  });

  it('lists the oldest debts first', () => {
    const report = buildAgingReport([
      invoice({ invoiceNumber: 'NEW', dueDate: '2026-10-05' }),
      invoice({ invoiceNumber: 'OLD', dueDate: '2026-01-05' }),
      invoice({ invoiceNumber: 'MID', dueDate: '2026-08-05' })
    ], asOf);
    expect(report.items.map(i => i.invoice.invoiceNumber)).toEqual(['OLD', 'MID', 'NEW']);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('generated set %s: buckets add up to the outstanding invoices exactly', seed => {
    const invoices = randomInvoices(300, seed);
    const report = buildAgingReport(invoices, asOf);
    const outstanding = invoices.filter(i => (i.status === 'pending' || i.status === 'overdue') && cents(i.total) !== 0);
    expect(report.count).toBe(outstanding.length);
    expect(cents(report.total)).toBe(outstanding.reduce((sum, i) => sum + cents(i.total), 0));
    const bucketSum = AGING_BUCKETS.reduce((sum, b) => sum + cents(report.byBucket[b.key].amount), 0);
    expect(bucketSum).toBe(cents(report.total));
    AGING_BUCKETS.forEach(b => {
      const bucket = report.byBucket[b.key];
      expect(cents(bucket.medicalAid) + cents(bucket.patient)).toBe(cents(bucket.amount));
    });
    expect(cents(report.medicalAid) + cents(report.patient)).toBe(cents(report.total));
    expect(report.items.every(i => i.invoice.status !== 'paid' && i.invoice.status !== 'cancelled')).toBe(true);
  });
});

describe('receivablesByScheme', () => {
  it('groups the medical aid portion of receivables by scheme, ignoring patient-only invoices', () => {
    const report = buildAgingReport([
      invoice({ patientId: 'a', total: 100, medicalAidTotal: 100, dueDate: '2026-09-01' }),
      invoice({ patientId: 'b', total: 80, medicalAidTotal: 50, dueDate: '2026-10-20' }),
      invoice({ patientId: 'c', total: 40, medicalAidTotal: 40, dueDate: '2026-07-01' }),
      invoice({ patientId: 'a', total: 60, medicalAidTotal: 0 })
    ], '2026-10-06');
    expect(receivablesByScheme(report, { a: 'NAMMED', b: 'NAMMED' })).toEqual([
      { scheme: 'NAMMED', amount: 150, count: 2, oldestDaysPastDue: 35 },
      { scheme: UNKNOWN_SCHEME, amount: 40, count: 1, oldestDaysPastDue: 97 }
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Payer mix
// ---------------------------------------------------------------------------------------------

describe('payerMix', () => {
  const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };

  it('splits billed revenue between medical aid and patient, and medical aid by scheme', () => {
    const mix = payerMix([
      invoice({ patientId: 'a', total: 300, medicalAidTotal: 300 }),
      invoice({ patientId: 'b', total: 100, medicalAidTotal: 60 }),
      invoice({ patientId: 'c', total: 100, medicalAidTotal: 0 }),
      invoice({ patientId: 'a', total: 1000, medicalAidTotal: 1000, status: 'cancelled' })
    ], october, { a: 'NHP', b: 'NAMMED' });
    expect(mix).toMatchObject({ total: 500, medicalAid: 360, patient: 140, medicalAidShare: 0.72, patientShare: 0.28 });
    expect(mix.schemes.map(s => [s.scheme, s.amount])).toEqual([['NHP', 300], ['NAMMED', 60]]);
    expect((mix.medicalAidShare ?? 0) + (mix.patientShare ?? 0)).toBeCloseTo(1, 10);
  });

  it('has no shares when nothing was billed', () => {
    expect(payerMix([], october)).toMatchObject({ total: 0, medicalAidShare: null, patientShare: null, schemes: [] });
  });
});

// ---------------------------------------------------------------------------------------------
// Line items / tariff codes
// ---------------------------------------------------------------------------------------------

describe('normalizeLineItem', () => {
  it('reads invoice_services amounts (medical_aid_covered is an amount) and splits the rest to the patient', () => {
    expect(normalizeLineItem({ invoice_id: 'i', code: ' 0190 ', description: 'Consult', quantity: '2', unit_price: '150', total_price: '300', medical_aid_covered: '200', patient_portion: '100' }))
      .toEqual({ invoiceId: 'i', code: '0190', description: 'Consult', quantity: 2, unitPrice: 150, total: 300, medicalAid: 200, patient: 100 });
  });

  it.each([
    [true, 120, 0],
    [false, 0, 120],
    [null, 0, 120],
    ['500', 120, 0]
  ])('medical_aid_covered %s -> medical aid %s, patient %s (capped at the line total)', (covered, medicalAid, patient) => {
    const result = normalizeLineItem({ invoice_id: 'i', total_price: 120, medical_aid_covered: covered as never });
    expect(result).toMatchObject({ medicalAid, patient });
  });

  it('derives the line total from quantity x unit price when total_price is missing', () => {
    expect(normalizeLineItem({ invoice_id: 'i', quantity: 3, unit_price: '12.50' })?.total).toBe(37.5);
  });

  it('drops lines that are not linked to an invoice', () => {
    expect(normalizeLineItem({ invoice_id: null, total_price: 10 })).toBeNull();
  });
});

describe('revenueByTariffCode', () => {
  const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };
  const invoices = [
    invoice({ id: 'a', issueDate: '2026-10-02' }),
    invoice({ id: 'b', issueDate: '2026-10-03' }),
    invoice({ id: 'void', issueDate: '2026-10-03', status: 'cancelled' }),
    invoice({ id: 'sept', issueDate: '2026-09-28' })
  ];
  const lines = [
    line({ invoiceId: 'a', code: '0190', total: 300, medicalAid: 300, quantity: 2 }),
    line({ invoiceId: 'b', code: '0190', total: 150, medicalAid: 0 }),
    line({ invoiceId: 'b', code: '0308', description: 'Injection', total: 50 }),
    line({ invoiceId: 'void', code: '0190', total: 5000 }),
    line({ invoiceId: 'sept', code: '0190', total: 7000 })
  ];

  it('groups line revenue by tariff code for invoices billed in the period only (no cancelled or other-period lines)', () => {
    const rows = revenueByTariffCode(lines, invoices, october);
    expect(rows.map(r => [r.code, r.revenue, r.quantity, r.invoiceCount, r.medicalAid, r.patient])).toEqual([
      ['0190', 450, 3, 2, 300, 150],
      ['0308', 50, 1, 1, 0, 50]
    ]);
    expect(rows.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 10);
  });

  it('reconciles line items to invoice totals and counts invoices with no line items', () => {
    const withExtra = [...invoices, invoice({ id: 'nolines', issueDate: '2026-10-05', total: 80 })];
    const result = reconcileLineItems(lines, withExtra.map(i => (i.id === 'a' ? { ...i, total: 310 } : i)), october);
    expect(result).toEqual({ invoiceTotal: 490, lineTotal: 500, difference: -10, invoicesWithoutLines: 1 });
  });
});

// ---------------------------------------------------------------------------------------------
// Collections by method
// ---------------------------------------------------------------------------------------------

describe('payment methods', () => {
  it.each([
    ['card', 'card'],
    ['Card', 'card'],
    ['credit card', 'card'],
    ['debit-card', 'card'],
    ['EFT', 'eft'],
    ['bank_transfer', 'eft'],
    ['Bank Transfer', 'eft'],
    ['cash', 'cash'],
    ['medical_aid', 'medical_aid'],
    ['Medical Aid', 'medical_aid'],
    [null, 'not_recorded'],
    ['', 'not_recorded'],
    ['cheque', 'other']
  ])('"%s" is recorded as %s', (raw, expected) => {
    expect(normalizePaymentMethod(raw)).toBe(expected);
  });

  it('groups paid invoices in the period by method, largest first, shares adding up to 100%', () => {
    const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };
    const rows = collectionsByMethod([
      invoice({ status: 'paid', paymentMethod: 'cash', total: 50 }),
      invoice({ status: 'paid', paymentMethod: 'Cash', total: 25 }),
      invoice({ status: 'paid', paymentMethod: 'medical_aid', total: 300 }),
      invoice({ status: 'paid', paymentMethod: null, total: 25 }),
      invoice({ status: 'pending', paymentMethod: 'cash', total: 999 }),
      invoice({ status: 'paid', paymentMethod: 'cash', total: 999, issueDate: '2026-09-01' })
    ], october);
    expect(rows.map(r => [r.method, r.amount, r.count])).toEqual([['medical_aid', 300, 1], ['cash', 75, 2], ['not_recorded', 25, 1]]);
    expect(rows.reduce((sum, r) => sum + (r.share ?? 0), 0)).toBeCloseTo(1, 10);
  });
});

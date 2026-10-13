/**
 * Year to date per tariff code, fund and practitioner (parity R21): a practice reads the year so far month by month,
 * and every figure is the one Finance's own reports give for the same days (Revenue by tariff code, Payer mix,
 * Practitioner productivity and Overview's billed), so the reports never disagree. Invented ids and amounts only.
 */
import { describe, expect, it } from 'vitest';
import {
  doctorProductivity,
  payerMix,
  revenueByTariffCode,
  summarizeRevenue,
  toCents,
  type LedgerLineItem,
  type LedgerVisit
} from '../../../../services/ledgerService';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import {
  NO_PRACTITIONER,
  PATIENT_PORTION,
  monthsOf,
  yearToDateByFund,
  yearToDateByPractitioner,
  yearToDateByTariff,
  yearToDateRange,
  yearToDateTable
} from '../yearToDate';

const RANGE = yearToDateRange('2026-03-13');

const invoices = [
  invoice({ id: 'jan', patientId: 'p1', practitionerId: 'dr-a', visitId: 'v1', issueDate: '2026-01-15', total: 500, medicalAidTotal: 400, patientTotal: 100, status: 'paid' }),
  invoice({ id: 'feb', patientId: 'p2', practitionerId: 'dr-b', issueDate: '2026-02-03', total: 250.5, medicalAidTotal: 0, patientTotal: 250.5 }),
  invoice({ id: 'mar', patientId: 'p1', practitionerId: 'dr-a', issueDate: '2026-03-12', total: 1000, medicalAidTotal: 1200, patientTotal: 0 }),
  // Cancelled: never billed. Last year and after the last day: outside the year to date
  invoice({ id: 'void', patientId: 'p2', practitionerId: 'dr-a', issueDate: '2026-02-10', total: 999, status: 'cancelled', rawStatus: 'cancelled' }),
  invoice({ id: 'old', patientId: 'p2', practitionerId: 'dr-a', issueDate: '2025-12-31', total: 300 }),
  invoice({ id: 'late', patientId: 'p2', practitionerId: 'dr-a', issueDate: '2026-03-14', total: 300 }),
  invoice({ id: 'nopr', patientId: 'p3', practitionerId: null, issueDate: '2026-03-01', total: 80 })
];

const line = (invoiceId: string, code: string, total: number, quantity = 1): LedgerLineItem =>
  ({ invoiceId, code, description: `Service ${code}`, quantity, unitPrice: total / quantity, total, medicalAid: 0, patient: total });

const lines = [
  line('jan', '0190', 400), line('jan', '0201', 100, 2),
  line('feb', '0190', 250.5),
  line('mar', '0191', 700), line('mar', '0201', 300, 3),
  line('void', '0190', 999), line('old', '0190', 300), line('late', '0190', 300),
  line('nopr', '', 80)
];

// The January invoice was on a visit with another doctor: the visit's doctor treated the patient
const visits: LedgerVisit[] = [{ id: 'v1', doctorId: 'dr-c', dateKey: '2026-01-15', stage: 'completed' }];

describe('the year to date', () => {
  it('runs from 1 January to the last day of the period, cut into months that add up to it exactly', () => {
    expect(RANGE).toEqual({ startKey: '2026-01-01', endKey: '2026-03-13' });
    expect(monthsOf(RANGE)).toEqual([
      { monthKey: '2026-01', range: { startKey: '2026-01-01', endKey: '2026-01-31' } },
      { monthKey: '2026-02', range: { startKey: '2026-02-01', endKey: '2026-02-28' } },
      { monthKey: '2026-03', range: { startKey: '2026-03-01', endKey: '2026-03-13' } }
    ]);
  });

  it('per tariff code gives Revenue by tariff code\'s figures for each month and for the year (cancelled invoices never count)', () => {
    const matrix = yearToDateByTariff(lines, invoices, RANGE);
    const byCode = Object.fromEntries(matrix.rows.map(row => [row.key, row]));
    for (const month of monthsOf(RANGE)) {
      for (const row of revenueByTariffCode(lines, invoices, month.range)) {
        expect(byCode[row.code || `desc:${row.description.toLowerCase()}`].byMonth[matrix.monthKeys.indexOf(month.monthKey)]).toBe(toCents(row.revenue));
      }
    }
    const year = revenueByTariffCode(lines, invoices, RANGE);
    expect(matrix.rows.map(row => [row.key, row.totalCents, row.quantity])).toEqual(
      year.map(row => [row.code || `desc:${row.description.toLowerCase()}`, toCents(row.revenue), row.quantity])
    );
    expect(byCode['0190'].byMonth).toEqual([40000, 25050, 0]);
  });

  it('per fund adds up to everything billed, as Overview says: each fund\'s portion as in Payer mix, and the patient\'s own portion', () => {
    const schemes = { p1: 'NMC1' };
    const matrix = yearToDateByFund(invoices, RANGE, schemes);
    const mix = payerMix(invoices, RANGE, schemes);
    expect(matrix.totalCents).toBe(toCents(summarizeRevenue(invoices, RANGE).billed));
    expect(matrix.rows.map(row => [row.key, row.totalCents])).toEqual([
      ...mix.schemes.map(scheme => [scheme.scheme, toCents(scheme.amount)]),
      [PATIENT_PORTION, toCents(mix.patient)]
    ]);
    // A medical aid portion above the invoice total is capped at the total, as everywhere in Finance
    expect(matrix.rows[0].byMonth).toEqual([40000, 0, 100000]);
  });

  it('per practitioner gives Practitioner productivity\'s billed for the year, for the practitioner on the invoice\'s visit', () => {
    const matrix = yearToDateByPractitioner(invoices, visits, RANGE);
    const productivity = doctorProductivity(invoices, visits, RANGE).filter(row => row.invoiceCount > 0);
    expect(matrix.rows.map(row => [row.key, row.totalCents]).sort()).toEqual(
      productivity.map(row => [row.doctorId ?? NO_PRACTITIONER, toCents(row.billed)]).sort()
    );
    expect(matrix.rows.find(row => row.key === 'dr-c')?.totalCents).toBe(50000);
    // "No practitioner recorded" is always the last row
    expect(matrix.rows[matrix.rows.length - 1].key).toBe(NO_PRACTITIONER);
  });

  it('prints one column per month with the year to date and its share, the totals adding up', () => {
    const matrix = yearToDateByFund(invoices, RANGE, { p1: 'NMC1' });
    const report = yearToDateTable(matrix, { title: 'Year to date per fund', header: 'Medical aid fund', basis: 'Billed 1 Jan – 13 Mar 2026', label: row => row.label });
    expect(report.table.columns.map(column => column.header)).toEqual(['Medical aid fund', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Year to date', 'Share']);
    expect(report.table.totals).toEqual(['Total', 500, 250.5, 1080, 1830.5, 1]);
    expect(report.targets.every(target => target === null)).toBe(true);
  });
});

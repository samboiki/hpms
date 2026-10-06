/** Ledger rules behind the Finance reports: daily takings, attendance, doctor productivity, statutory payroll, expenses by category */
import { describe, it, expect } from 'vitest';
import {
  attendanceByMonth,
  classifyDeduction,
  dailyTakings,
  doctorProductivity,
  expensesByTypeAndMonth,
  NO_SHOW_NOTE_MARKER,
  normalizeVisit,
  paidDateKey,
  payslipLinesFrom,
  statutoryPayrollByMonth,
  summarizeAttendance,
  treatingDoctorId,
  type DateRange,
  type LedgerPayslipLine,
  type LedgerVisit
} from '../ledgerService';
import { invoice, payslip, expense } from './ledgerTestUtils';

const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };

/** updated_at as Supabase returns it (a UTC instant) for a local date and time */
const paidAt = (dateKey: string, time = '10:00') => new Date(`${dateKey}T${time}:00`).toISOString();

const paid = (dateKey: string, total: number, paymentMethod: string | null, time?: string) =>
  invoice({ status: 'paid', rawStatus: 'paid', total, paymentMethod, updatedAt: paidAt(dateKey, time) });

let visitSequence = 0;
const visit = (overrides: Partial<LedgerVisit> = {}): LedgerVisit => ({
  id: `visit-${++visitSequence}`,
  doctorId: 'd1',
  dateKey: '2026-10-05',
  stage: 'completed',
  ...overrides
});

// ---------------------------------------------------------------------------------------------
// Daily takings
// ---------------------------------------------------------------------------------------------

describe('daily takings (cash-up)', () => {
  it('counts a payment on the day the invoice was marked paid, not the day it was issued', () => {
    const takings = dailyTakings([
      { ...paid('2026-10-03', 250, 'cash'), issueDate: '2026-08-15' }, // old account settled in October
      { ...paid('2026-11-02', 400, 'cash'), issueDate: '2026-10-20' } // billed in October, paid in November
    ], october);
    expect(takings.days.map(day => [day.dateKey, day.total])).toEqual([['2026-10-03', 250]]);
    expect(takings.total).toBe(250);
  });

  it('never counts unpaid or cancelled invoices, however recently they were updated', () => {
    const today = paidAt('2026-10-06');
    const takings = dailyTakings([
      invoice({ status: 'pending', total: 100, paymentMethod: 'cash', updatedAt: today }),
      invoice({ status: 'overdue', total: 100, paymentMethod: 'card', updatedAt: today }),
      invoice({ status: 'cancelled', total: 100, paymentMethod: 'cash', updatedAt: today }),
      paid('2026-10-06', 75, 'cash')
    ], october);
    expect(takings.count).toBe(1);
    expect(takings.total).toBe(75);
  });

  it('splits each day by payment method, and the methods add up to the day and period totals', () => {
    const takings = dailyTakings([
      paid('2026-10-05', 100, 'cash'),
      paid('2026-10-05', 200, 'Card'),
      paid('2026-10-05', 300, 'bank transfer'),
      paid('2026-10-05', 400, 'medical_aid'),
      paid('2026-10-05', 50, null),
      paid('2026-10-05', 25, 'voucher'),
      paid('2026-10-06', 60, 'cash')
    ], october);
    const monday = takings.days.find(day => day.dateKey === '2026-10-05')!;
    expect(monday.byMethod).toEqual({ cash: 100, card: 200, eft: 300, medical_aid: 400, other: 25, not_recorded: 50 });
    expect(monday.total).toBe(1075);
    expect(monday.count).toBe(6);
    expect(takings.byMethod.cash).toBe(160);
    expect(takings.total).toBe(takings.days.reduce((sum, day) => sum + day.total, 0));
  });

  it('adds money in cents, so many small payments total exactly', () => {
    const takings = dailyTakings([paid('2026-10-02', 0.1, 'cash'), paid('2026-10-02', 0.2, 'cash'), paid('2026-10-02', 33.33, 'card')], october);
    expect(takings.days[0].byMethod.cash).toBe(0.3);
    expect(takings.total).toBe(33.63);
  });

  it('places a payment on the local day it was made, even just after midnight (not the UTC day)', () => {
    const earlyMorning = paid('2026-10-01', 90, 'cash', '00:30');
    expect(paidDateKey(earlyMorning)).toBe('2026-10-01');
    expect(dailyTakings([earlyMorning], october).days[0].dateKey).toBe('2026-10-01');
    expect(dailyTakings([paid('2026-09-30', 90, 'cash', '23:45')], october).count).toBe(0);
  });

  it('lists the most recent day first, and an empty period has no days and nothing taken', () => {
    const takings = dailyTakings([paid('2026-10-01', 10, 'cash'), paid('2026-10-09', 10, 'cash'), paid('2026-10-04', 10, 'cash')], october);
    expect(takings.days.map(day => day.dateKey)).toEqual(['2026-10-09', '2026-10-04', '2026-10-01']);
    expect(dailyTakings([], october)).toEqual({
      days: [],
      byMethod: { cash: 0, card: 0, eft: 0, medical_aid: 0, other: 0, not_recorded: 0 },
      total: 0,
      count: 0
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Appointments and attendance
// ---------------------------------------------------------------------------------------------

describe('appointments and attendance', () => {
  it('puts a rescheduled appointment on its new scheduled day and a walk-in on its visit day', () => {
    expect(normalizeVisit({ id: 'a', scheduled_date: '2026-10-08', visit_date: '2026-10-01', status: 'scheduled' }).dateKey).toBe('2026-10-08');
    expect(normalizeVisit({ id: 'b', scheduled_date: null, visit_date: '2026-10-02', status: 'in-progress' }).dateKey).toBe('2026-10-02');
    expect(normalizeVisit({ id: 'c' }).dateKey).toBeNull();
  });

  it('takes each visit\'s stage from the shared visit stage rules (the cancelled flag wins over the stored status)', () => {
    expect(normalizeVisit({ id: 'a', status: 'completed', is_cancelled: true }).stage).toBe('cancelled');
    expect(normalizeVisit({ id: 'b', status: 'no-show' }).stage).toBe('no-show');
    expect(normalizeVisit({ id: 'c', status: 'scheduled', is_checked_in: true }).stage).toBe('checked-in');
  });

  it('counts a cancelled visit noted "did not attend" as a no-show, because the live visits table rejects the no-show status', () => {
    const noShowNoteIds = new Set(['missed', 'restored']);
    expect(normalizeVisit({ id: 'missed', status: 'cancelled', is_cancelled: true }, noShowNoteIds).stage).toBe('no-show');
    // the patient arrived after all and the visit was reopened: the old note no longer decides
    expect(normalizeVisit({ id: 'restored', status: 'completed' }, noShowNoteIds).stage).toBe('completed');
    expect(normalizeVisit({ id: 'called-off', status: 'cancelled' }, noShowNoteIds).stage).toBe('cancelled');
    expect(NO_SHOW_NOTE_MARKER).toBe('[Cancelled: did not attend (no-show)]');
  });

  it('counts every visit once by how it ended, so booked = attended + no-shows + cancelled + not closed', () => {
    const [row] = attendanceByMonth([
      visit({ stage: 'completed' }),
      visit({ stage: 'completed' }),
      visit({ stage: 'no-show' }),
      visit({ stage: 'cancelled' }),
      visit({ stage: 'scheduled' }),
      visit({ stage: 'handed-off' })
    ], october);
    expect(row).toEqual({ monthKey: '2026-10', booked: 6, attended: 2, noShows: 1, cancelled: 1, open: 2, noShowRate: 1 / 6, cancellationRate: 1 / 6 });
    expect(row.attended + row.noShows + row.cancelled + row.open).toBe(row.booked);
  });

  it('gives a month without bookings no rate rather than 0%, and every month of the range a row', () => {
    const range: DateRange = { startKey: '2026-09-15', endKey: '2026-10-31' };
    const rows = attendanceByMonth([
      visit({ dateKey: '2026-09-10', stage: 'no-show' }), // before the range
      visit({ dateKey: '2026-10-02', stage: 'no-show' }),
      visit({ dateKey: null, stage: 'no-show' })
    ], range);
    expect(rows.map(row => [row.monthKey, row.booked, row.noShowRate])).toEqual([['2026-09', 0, null], ['2026-10', 1, 1]]);
  });

  it('recomputes the total rates from the totals instead of averaging monthly rates', () => {
    const range: DateRange = { startKey: '2026-09-01', endKey: '2026-10-31' };
    const rows = attendanceByMonth([
      visit({ dateKey: '2026-09-03', stage: 'no-show' }),
      visit({ dateKey: '2026-09-04', stage: 'completed' }),
      ...Array.from({ length: 8 }, () => visit({ dateKey: '2026-10-05', stage: 'completed' }))
    ], range);
    expect(rows.map(row => row.noShowRate)).toEqual([0.5, 0]);
    expect(summarizeAttendance(rows)).toMatchObject({ booked: 10, noShows: 1, noShowRate: 0.1, cancellationRate: 0 });
    expect(summarizeAttendance([]).noShowRate).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Doctor productivity
// ---------------------------------------------------------------------------------------------

describe('doctor productivity', () => {
  it('credits an invoice to the doctor who saw the patient, not the doctor who typed the invoice', () => {
    const seen = visit({ id: 'v-locum', doctorId: 'locum' });
    expect(treatingDoctorId(invoice({ visitId: 'v-locum', practitionerId: 'principal' }), new Map([['v-locum', 'locum']]))).toBe('locum');
    const rows = doctorProductivity([invoice({ visitId: 'v-locum', practitionerId: 'principal', total: 500 })], [seen], october);
    expect(rows.map(row => [row.doctorId, row.completedVisits, row.billed])).toEqual([['locum', 1, 500]]);
  });

  it('falls back to the invoice creator when the visit is not known (e.g. outside the period) or has no doctor', () => {
    const rows = doctorProductivity([
      invoice({ visitId: 'v-elsewhere', practitionerId: 'd2', total: 300 }),
      invoice({ visitId: 'v-no-doctor', practitionerId: 'd2', total: 200 })
    ], [visit({ id: 'v-no-doctor', doctorId: null, stage: 'scheduled' })], october);
    expect(rows.map(row => [row.doctorId, row.invoiceCount, row.billed])).toEqual([['d2', 2, 500]]);
  });

  it('excludes cancelled invoices from invoices and billed, and counts as collected only what is marked paid', () => {
    const [row] = doctorProductivity([
      invoice({ practitionerId: 'd1', total: 400, status: 'paid' }),
      invoice({ practitionerId: 'd1', total: 100, status: 'pending' }),
      invoice({ practitionerId: 'd1', total: 999, status: 'cancelled' })
    ], [], october);
    expect(row).toMatchObject({ doctorId: 'd1', invoiceCount: 2, billed: 500, collected: 400, collectionRate: 0.8 });
  });

  it('counts only visits completed on days in the period', () => {
    const [row] = doctorProductivity([], [
      visit({ stage: 'completed' }),
      visit({ stage: 'no-show' }),
      visit({ stage: 'cancelled' }),
      visit({ stage: 'completed', dateKey: '2026-09-30' })
    ], october);
    expect(row).toMatchObject({ doctorId: 'd1', completedVisits: 1, invoiceCount: 0, billedPerVisit: 0, collectionRate: null });
  });

  it('gives billed per visit to the cent, and none without completed visits (never a division by zero)', () => {
    const rows = doctorProductivity(
      [invoice({ practitionerId: 'd1', total: 100 }), invoice({ practitionerId: 'd2', total: 250 })],
      [visit({ doctorId: 'd1' }), visit({ doctorId: 'd1' }), visit({ doctorId: 'd1' })],
      october
    );
    expect(rows.find(row => row.doctorId === 'd1')?.billedPerVisit).toBe(33.33);
    expect(rows.find(row => row.doctorId === 'd2')?.billedPerVisit).toBeNull();
  });

  it('keeps work without a recorded doctor in one row, listed last, so totals still add up', () => {
    const rows = doctorProductivity(
      [invoice({ practitionerId: null, total: 900 }), invoice({ practitionerId: 'd1', total: 100 })],
      [visit({ doctorId: null })],
      october
    );
    expect(rows.map(row => [row.doctorId, row.completedVisits, row.billed])).toEqual([['d1', 0, 100], [null, 1, 900]]);
  });
});

// ---------------------------------------------------------------------------------------------
// Statutory payroll (PAYE, Social Security, pension)
// ---------------------------------------------------------------------------------------------

describe('statutory payroll totals', () => {
  it.each([
    // the names payroll writes today
    ['Tax (PAYE)', 'paye'],
    ['Social Security (SSC)', 'ssc'],
    ['Social Security (employer)', 'ssc'],
    // free-text names on older payslips
    ['PAYE', 'paye'],
    ['Income Tax', 'paye'],
    ['Tax', 'paye'],
    ['SSC contribution', 'ssc'],
    ['Social Security Commission', 'ssc'],
    ['Pension Fund', 'pension'],
    ['Pension (pre-tax)', 'pension'],
    ['Provident fund', 'pension'],
    ['Retirement annuity', 'pension'],
    ['Medical Aid', 'medical_aid'],
    ['NHP medical aid', 'medical_aid'],
    ['Namibia Medical Care', 'medical_aid'],
    ['Loan repayment', 'other'],
    ['Unpaid Leave Deduction', 'other'],
    ['', 'other']
  ])('a deduction named "%s" is %s', (name, expected) => {
    expect(classifyDeduction(name)).toBe(expected);
  });

  it('reads payslip_items when a payslip has them and ignores its JSON details, as the printed payslip does', () => {
    const lines = payslipLinesFrom(
      [
        { payslip_id: 'p1', component_name: 'Basic Salary', type: 'earning', amount: '12000' },
        { payslip_id: 'p1', component_name: 'Tax (PAYE)', type: 'deduction', amount: '1500.25' },
        { payslip_id: 'p1', component_name: 'Social Security (employer)', type: 'company_contribution', amount: 99 },
        { payslip_id: 'p1', component_name: 'Mystery', type: 'adjustment', amount: 5 }
      ],
      [{ id: 'p1', deductions_details: [{ name: 'Old PAYE', amount: 9999 }] }]
    );
    expect(lines).toEqual([
      { payslipId: 'p1', name: 'Basic Salary', type: 'earning', amount: 12000 },
      { payslipId: 'p1', name: 'Tax (PAYE)', type: 'deduction', amount: 1500.25 },
      { payslipId: 'p1', name: 'Social Security (employer)', type: 'company_contribution', amount: 99 }
    ]);
  });

  it('falls back to the JSON details of older payslips and ignores entries that are not lines', () => {
    const lines = payslipLinesFrom([], [{
      id: 'old',
      earnings_details: [{ name: 'Housing', amount: '500' }, { name: 'SSC employer', amount: 81, isCompanyContribution: true }, 'junk', null],
      deductions_details: { not: 'an array' }
    }, {
      id: 'old2',
      deductions_details: [{ name: 'PAYE', amount: '1200.50' }, { amount: 10 }]
    }]);
    expect(lines).toEqual([
      { payslipId: 'old', name: 'Housing', type: 'earning', amount: 500 },
      { payslipId: 'old', name: 'SSC employer', type: 'company_contribution', amount: 81 },
      { payslipId: 'old2', name: 'PAYE', type: 'deduction', amount: 1200.5 },
      { payslipId: 'old2', name: '', type: 'deduction', amount: 10 }
    ]);
  });

  const line = (payslipId: string, name: string, amount: number, type: LedgerPayslipLine['type'] = 'deduction'): LedgerPayslipLine =>
    ({ payslipId, name, type, amount });

  it('splits a payslip from today\'s payroll into PAYE, employee and employer Social Security, pension and medical aid', () => {
    const [row] = statutoryPayrollByMonth(
      [payslip({ id: 'p1', gross: 12000, deductions: 3098, net: 8902 })],
      [
        line('p1', 'Basic Salary', 12000, 'earning'),
        line('p1', 'Tax (PAYE)', 1500),
        line('p1', 'Social Security (SSC)', 99),
        line('p1', 'Social Security (employer)', 99, 'company_contribution'),
        line('p1', 'Pension fund', 700),
        line('p1', 'Medical aid', 799)
      ],
      october
    );
    expect(row).toEqual({
      monthKey: '2026-10', payslips: 1, employees: 1, gross: 12000, paye: 1500, sscEmployee: 99, sscEmployer: 99,
      pension: 700, medicalAid: 799, otherDeductions: 0, net: 8902, unitemisedPayslips: 0, difference: 0
    });
  });

  it('does not treat other employer contributions (e.g. employer pension) as deductions from pay', () => {
    const [row] = statutoryPayrollByMonth(
      [payslip({ id: 'p1', gross: 1000, deductions: 100, net: 900 })],
      [line('p1', 'PAYE', 100), line('p1', 'Pension (employer)', 75, 'company_contribution')],
      october
    );
    expect(row).toMatchObject({ paye: 100, pension: 0, sscEmployer: 0, difference: 0 });
  });

  it('puts all deductions of a payslip without lines under other and flags it, so PAYE is never silently zero', () => {
    const [row] = statutoryPayrollByMonth(
      [payslip({ id: 'bare', gross: 5000, deductions: 600, net: 4400 }), payslip({ id: 'nothing', gross: 2000, deductions: 0, net: 2000 })],
      [],
      october
    );
    expect(row).toMatchObject({ paye: 0, otherDeductions: 600, unitemisedPayslips: 1, difference: 0 });
  });

  it('reports a difference when the lines do not add up to the payslip totals', () => {
    const [row] = statutoryPayrollByMonth(
      [payslip({ id: 'p1', gross: 1000, deductions: 300, net: 700 })],
      [line('p1', 'PAYE', 200)],
      october
    );
    expect(row.difference).toBe(100);
  });

  it('excludes cancelled payslips and counts each payslip in the month its pay period starts', () => {
    const rows = statutoryPayrollByMonth(
      [
        payslip({ id: 'oct', userId: 'a', gross: 1000, deductions: 100, net: 900 }),
        payslip({ id: 'void', userId: 'b', gross: 9999, deductions: 0, net: 9999, status: 'cancelled' }),
        payslip({ id: 'sep', userId: 'a', periodStart: '2026-09-01', paymentDate: '2026-10-01', gross: 800, deductions: 0, net: 800 })
      ],
      [line('oct', 'PAYE', 100)],
      { startKey: '2026-09-01', endKey: '2026-10-31' }
    );
    expect(rows.map(row => [row.monthKey, row.payslips, row.gross, row.paye])).toEqual([['2026-09', 1, 800, 0], ['2026-10', 1, 1000, 100]]);
  });

  it('counts each employee once a month and adds money in cents', () => {
    const [row] = statutoryPayrollByMonth(
      [
        payslip({ id: 'a1', userId: 'a', gross: 0.1, deductions: 0, net: 0.1 }),
        payslip({ id: 'a2', userId: 'a', gross: 0.2, deductions: 0, net: 0.2 }),
        payslip({ id: 'b1', userId: 'b', gross: 1000.05, deductions: 0.3, net: 999.75 })
      ],
      [line('b1', 'SSC', 0.1), line('b1', 'SSC', 0.2)],
      october
    );
    expect(row).toMatchObject({ payslips: 3, employees: 2, gross: 1000.35, sscEmployee: 0.3, net: 1000.05, difference: 0 });
  });
});

// ---------------------------------------------------------------------------------------------
// Expenses by category and month
// ---------------------------------------------------------------------------------------------

describe('expenses by category and month', () => {
  const range: DateRange = { startKey: '2026-09-01', endKey: '2026-10-31' };

  it('puts each expense in its category and month, cancelled excluded, and the month totals add up to the total', () => {
    const table = expensesByTypeAndMonth([
      expense({ type: 'rent', amount: 7500, expenseDate: '2026-09-01', status: 'paid' }),
      expense({ type: 'rent', amount: 7500, expenseDate: '2026-10-01' }),
      expense({ type: 'utilities', amount: 820.4, expenseDate: '2026-10-12' }),
      expense({ type: 'utilities', amount: 0.2, expenseDate: '2026-10-13' }),
      expense({ type: 'rent', amount: 9999, expenseDate: '2026-10-02', status: 'cancelled' })
    ], range);
    expect(table.monthKeys).toEqual(['2026-09', '2026-10']);
    expect(table.rows).toEqual([
      { type: 'rent', byMonth: [7500, 7500], total: 15000, count: 2 },
      { type: 'utilities', byMonth: [0, 820.6], total: 820.6, count: 2 }
    ]);
    expect(table.monthTotals).toEqual([7500, 8320.6]);
    expect(table.total).toBe(15820.6);
    expect(table.count).toBe(4);
  });

  it('only counts expenses dated in the range, and keeps a column for a month without expenses', () => {
    const table = expensesByTypeAndMonth([
      expense({ amount: 100, expenseDate: '2026-08-31' }),
      expense({ amount: 50, expenseDate: '2026-10-05' }),
      expense({ amount: 70, expenseDate: null })
    ], range);
    expect(table.rows).toEqual([{ type: 'rent', byMonth: [0, 50], total: 50, count: 1 }]);
    expect(expensesByTypeAndMonth([], range)).toEqual({ monthKeys: ['2026-09', '2026-10'], rows: [], monthTotals: [0, 0], total: 0, count: 0 });
  });
});

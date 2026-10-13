import { describe, expect, it } from 'vitest';
import type { PracticeCase } from '../../../services/payerAccountService';
import type { InjuryCase } from '../../accounts/injuryCases';
import { casesCsv, filterCases, handedOverCsv, referralRange, referredCsv } from '../specialLists';

// Invented patients and cases only
const injuryCase = (overrides: Partial<InjuryCase>): InjuryCase => ({
  id: 'case',
  patientId: 'p1',
  type: 'injury_on_duty',
  injuryDate: '2026-09-01',
  employerAccountId: null,
  employerName: 'Test Mining',
  employeeNumber: null,
  claimNumber: null,
  payerAccountId: 'fund',
  notes: null,
  closedAt: null,
  removedAt: null,
  createdAt: null,
  ...overrides
});

const row = (overrides: Partial<InjuryCase>, patientName = 'Test Patient'): PracticeCase => ({
  injuryCase: injuryCase(overrides),
  patientName,
  visitCount: 2,
  lastVisit: '2026-10-01'
});

const rows = [
  row({ id: 'iod-open', injuryDate: '2026-09-01' }, 'Test Alpha'),
  row({ id: 'mva-open', type: 'motor_vehicle_accident', injuryDate: '2026-10-02', employerName: null, payerAccountId: 'mva' }, 'Test Bravo'),
  row({ id: 'iod-closed', injuryDate: '2026-05-01', closedAt: '2026-08-01T10:00:00+02:00' }, 'Test Charlie'),
  row({ id: 'removed', injuryDate: '2026-10-05', removedAt: '2026-10-06T10:00:00+02:00' }, 'Test Delta')
];

describe('the injury and accident cases list (R29)', () => {
  // The list is what the practice works through with the funds: open cases by default, a removed case never
  it('shows the open cases, latest injury first, and never one removed by mistake', () => {
    expect(filterCases(rows, { type: 'all', state: 'open' }).map(item => item.injuryCase.id)).toEqual(['mva-open', 'iod-open']);
    expect(filterCases(rows, { type: 'all', state: 'all' }).map(item => item.injuryCase.id)).toEqual(['mva-open', 'iod-open', 'iod-closed']);
  });

  it('narrows to one kind, e.g. the MVA Fund cases', () => {
    expect(filterCases(rows, { type: 'motor_vehicle_accident', state: 'all' }).map(item => item.injuryCase.id)).toEqual(['mva-open']);
    expect(filterCases(rows, { type: 'injury_on_duty', state: 'closed' }).map(item => item.injuryCase.id)).toEqual(['iod-closed']);
  });

  it('exports who pays each case by name', () => {
    const csv = casesCsv(filterCases(rows, { type: 'all', state: 'open' }), { fund: "Employees' Compensation Fund", mva: 'MVA Fund' });
    expect(csv.headers).toEqual(['Patient', 'Case', 'Date', 'Details', 'Paid by', 'State', 'Visits', 'Last visit']);
    expect(csv.rows[0]).toEqual(['Test Bravo', 'Motor vehicle accident', '2026-10-02', 'No claim number yet', 'MVA Fund', 'Open', 2, '2026-10-01']);
    expect(csv.rows[1][4]).toBe("Employees' Compensation Fund");
  });
});

describe('the referred patients and handed-over lists (R29)', () => {
  it('takes the period up to and including today', () => {
    expect(referralRange('last_30', '2026-10-13')).toEqual({ from: '2026-09-14', to: '2026-10-13' });
    expect(referralRange('last_365', '2026-10-13')).toEqual({ from: '2025-10-14', to: '2026-10-13' });
  });

  it('exports the amounts owed in N$ and leaves an unknown amount empty rather than calling it nothing', () => {
    const csv = handedOverCsv([
      { patientId: 'p1', name: 'Test Alpha', setAt: '2026-09-30T10:00:00+02:00', reason: 'No payment after three reminders', owedCents: 125050, people: 3 },
      { patientId: 'p2', name: 'Test Bravo', setAt: '2026-10-01T10:00:00+02:00', reason: '', owedCents: null, people: 1 }
    ]);
    expect(csv.rows).toEqual([
      ['Test Alpha', '2026-09-30', 'No payment after three reminders', 3, '1250.50'],
      ['Test Bravo', '2026-10-01', '', 1, null]
    ]);
    expect(referredCsv([{ referralId: 'r1', patientId: 'p1', name: 'Test Alpha', referringName: 'Dr T Example', referralDate: '2026-10-01', validUntil: null, reason: null }]).rows).toEqual([
      ['Test Alpha', 'Dr T Example', '2026-10-01', null, null]
    ]);
  });
});

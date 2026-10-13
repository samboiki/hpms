/**
 * The special lists of Messages > Lists (parity R29): injury and accident cases, accounts handed over to a collector and
 * patients referred to the practice, with their filters and their CSV columns. Pure: the sheet loads the rows
 * (payerAccountService, specialListsService) and shows what these return.
 */
import { addDaysToKey } from '../billing/dates';
import { CASE_TYPE_LABELS, caseDetails, casePayerName, caseState, type InjuryCaseType } from '../accounts/injuryCases';
import type { PracticeCase } from '../../services/payerAccountService';
import type { HandedOverAccount, ReferredPatient } from '../../services/specialListsService';

export type SpecialList = 'cases' | 'handed_over' | 'referred';

export const SPECIAL_LISTS: ReadonlyArray<{ value: SpecialList; label: string; hint: string }> = [
  { value: 'cases', label: 'Injury on duty and accident cases', hint: "Patients with an injury on duty, occupational disease or road accident case, and who pays it." },
  { value: 'handed_over', label: 'Accounts handed over', hint: 'Accounts flagged "Handed over" to a debt collector, with what each still owes.' },
  { value: 'referred', label: 'Referred patients', hint: 'Patients whose referral letter is dated in the period, with who referred them.' }
];

export type CaseStateFilter = 'open' | 'closed' | 'all';

export interface CaseFilter {
  type: InjuryCaseType | 'all';
  state: CaseStateFilter;
}

export const DEFAULT_CASE_FILTER: CaseFilter = { type: 'all', state: 'open' };

/** The cases of the kind and state chosen, the latest injury first */
export function filterCases(rows: readonly PracticeCase[], filter: CaseFilter): PracticeCase[] {
  return rows
    .filter(row => filter.type === 'all' || row.injuryCase.type === filter.type)
    .filter(row => {
      const state = caseState(row.injuryCase);
      if (state === 'removed') return false;
      return filter.state === 'all' || state === filter.state;
    })
    .sort((a, b) => b.injuryCase.injuryDate.localeCompare(a.injuryCase.injuryDate) || a.patientName.localeCompare(b.patientName));
}

export type ReferralPeriod = 'last_30' | 'last_90' | 'last_365';

export const REFERRAL_PERIODS: ReadonlyArray<{ value: ReferralPeriod; label: string; days: number }> = [
  { value: 'last_30', label: 'The last 30 days', days: 30 },
  { value: 'last_90', label: 'The last 3 months', days: 91 },
  { value: 'last_365', label: 'The last 12 months', days: 365 }
];

/** The letters dated from (days - 1) days ago up to today, today included */
export function referralRange(period: ReferralPeriod, todayKey: string): { from: string; to: string } {
  const days = REFERRAL_PERIODS.find(option => option.value === period)?.days ?? 30;
  return { from: addDaysToKey(todayKey, -(days - 1)), to: todayKey };
}

type Cell = string | number | null;

export interface ListCsv {
  headers: string[];
  rows: Cell[][];
}

export function casesCsv(rows: readonly PracticeCase[], accountNames: Readonly<Record<string, string>>): ListCsv {
  return {
    headers: ['Patient', 'Case', 'Date', 'Details', 'Paid by', 'State', 'Visits', 'Last visit'],
    rows: rows.map(row => [
      row.patientName,
      CASE_TYPE_LABELS[row.injuryCase.type],
      row.injuryCase.injuryDate,
      caseDetails(row.injuryCase, accountNames),
      casePayerName(row.injuryCase, accountNames),
      caseState(row.injuryCase) === 'open' ? 'Open' : 'Closed',
      row.visitCount,
      row.lastVisit
    ])
  };
}

export function handedOverCsv(rows: readonly HandedOverAccount[]): ListCsv {
  return {
    headers: ['Account holder', 'Handed over on', 'Reason', 'Patients on the account', 'Still owed (N$)'],
    rows: rows.map(row => [row.name, row.setAt.slice(0, 10), row.reason, row.people, row.owedCents === null ? null : (row.owedCents / 100).toFixed(2)])
  };
}

export function referredCsv(rows: readonly ReferredPatient[]): ListCsv {
  return {
    headers: ['Patient', 'Referred by', 'Letter dated', 'Valid until', 'Reason'],
    rows: rows.map(row => [row.name, row.referringName, row.referralDate, row.validUntil, row.reason])
  };
}

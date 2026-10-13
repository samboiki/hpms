import { toCents } from '../billing/money';

/**
 * What the patient file says about a patient's medical aid claims that a fund did not pay and that still need
 * someone (the open items of the rejection queue): how many, how much is at stake and the soonest date by which
 * one must be resubmitted. Reception sees it where they are, instead of only in Finance > Remittances.
 */

export interface OpenRejectionRow {
  at_stake: number | string | null;
  resubmit_by: string | null;
}

export interface PatientRejectionSummary {
  count: number;
  /** What the funds have not paid on these lines (never negative) */
  atStakeCents: number;
  /** The earliest resubmission deadline (yyyy-MM-dd), or null when none has one */
  nextDeadline: string | null;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}/;

export function summarizeOpenRejections(rows: readonly OpenRejectionRow[]): PatientRejectionSummary {
  const deadlines = rows
    .map(row => row.resubmit_by)
    .filter((value): value is string => typeof value === 'string' && DATE_KEY.test(value))
    .map(value => value.slice(0, 10))
    .sort();
  return {
    count: rows.length,
    atStakeCents: rows.reduce((sum, row) => sum + Math.max(toCents(Number(row.at_stake ?? 0) || 0), 0), 0),
    nextDeadline: deadlines[0] ?? null
  };
}
